const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(__dirname));
app.get('/health', (_, res) => res.json({ ok: true, game: 'Zombie Apocalypse Survival' }));

const rooms = new Map();
const W = 1600, H = 900, MAX_ZOMBIES = 10;
const rand = (a,b) => a + Math.random() * (b-a);
function newRoom(code) {
  const room = { code, players: {}, zombies: [], bullets: [], started: false, over: false, nextBullet: 0, created: Date.now() };
  for (let i=0;i<MAX_ZOMBIES;i++) room.zombies.push({ id:i, x:rand(130,W-130), y:rand(100,H-100), hp:100, speed:rand(48,68), attackAt:0 });
  return room;
}
function publicState(room) {
  return { code:room.code, started:room.started, over:room.over, players:Object.values(room.players).map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,hp:p.hp,kills:p.kills,alive:p.hp>0})), zombies:room.zombies, bullets:room.bullets };
}
function emitState(room) { io.to(room.code).emit('state', publicState(room)); }
function leaveRoom(socket) {
  const code = socket.data.room; if (!code) return;
  const room = rooms.get(code); if (room) {
    delete room.players[socket.id]; socket.to(code).emit('notice', 'Your teammate disconnected.');
    if (!Object.keys(room.players).length) rooms.delete(code); else emitState(room);
  }
  socket.leave(code); socket.data.room = null;
}
io.on('connection', socket => {
  socket.on('join', ({code, name}) => {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
    if (code.length < 4) return socket.emit('joinError','Enter a room code with at least 4 characters.');
    let room = rooms.get(code); if (!room) { room = newRoom(code); rooms.set(code,room); }
    if (Object.keys(room.players).length >= 2) return socket.emit('joinError','This room already has 2 players. Try another code.');
    if (room.started && room.over) return socket.emit('joinError','This round has ended. Create a new room.');
    leaveRoom(socket);
    const index = Object.keys(room.players).length;
    room.players[socket.id] = { id:socket.id, name:String(name||`Player ${index+1}`).slice(0,16), x:index===0?250:350, y:index===0?450:520, hp:100, kills:0, lastShot:0, lastMove:0 };
    socket.join(code); socket.data.room = code;
    socket.emit('joined',{code,playerId:socket.id,world:{width:W,height:H}});
    io.to(code).emit('notice', `${room.players[socket.id].name} joined (${Object.keys(room.players).length}/2)`);
    if (Object.keys(room.players).length===2) { room.started=true; io.to(code).emit('notice','TEAM READY — SURVIVE THE HORDE!'); }
    emitState(room);
  });
  socket.on('move', data => {
    const room=rooms.get(socket.data.room), p=room?.players[socket.id]; if(!p||!room.started||room.over) return;
    const x=Number(data.x), y=Number(data.y); if(!Number.isFinite(x)||!Number.isFinite(y)) return;
    p.x=Math.max(28,Math.min(W-28,x)); p.y=Math.max(28,Math.min(H-28,y));
  });
  socket.on('shoot', data => {
    const room=rooms.get(socket.data.room), p=room?.players[socket.id]; if(!p||!room.started||room.over||p.hp<=0) return;
    const now=Date.now(); if(now-p.lastShot<180) return; p.lastShot=now;
    const angle=Number(data.angle); if(!Number.isFinite(angle)) return;
    room.bullets.push({id:room.nextBullet++,owner:p.id,x:p.x,y:p.y,vx:Math.cos(angle)*760,vy:Math.sin(angle)*760,life:1.15});
  });
  socket.on('restart', () => {
    const room=rooms.get(socket.data.room); if(!room||Object.keys(room.players).length!==2) return;
    room.zombies=[]; for(let i=0;i<MAX_ZOMBIES;i++) room.zombies.push({id:i,x:rand(130,W-130),y:rand(100,H-100),hp:100,speed:rand(48,68),attackAt:0});
    room.bullets=[]; room.over=false; room.started=true;
    Object.values(room.players).forEach((p,i)=>{p.x=250+i*100;p.y=450+i*70;p.hp=100;p.kills=0;});
    io.to(room.code).emit('notice','NEW ROUND — 10 ZOMBIES INCOMING!'); emitState(room);
  });
  socket.on('disconnect',()=>leaveRoom(socket));
});

let last=Date.now();
setInterval(()=>{
  const now=Date.now(), dt=Math.min((now-last)/1000,.05); last=now;
  for(const room of rooms.values()) {
    if(!room.started||room.over) continue;
    const players=Object.values(room.players).filter(p=>p.hp>0);
    for(const z of room.zombies) {
      if(z.hp<=0||!players.length) continue;
      let target=players.reduce((a,b)=>Math.hypot(a.x-z.x,a.y-z.y)<Math.hypot(b.x-z.x,b.y-z.y)?a:b);
      const dx=target.x-z.x,dy=target.y-z.y,d=Math.hypot(dx,dy)||1;
      if(d>34){z.x+=dx/d*z.speed*dt;z.y+=dy/d*z.speed*dt;}
      else if(now-z.attackAt>850){target.hp=Math.max(0,target.hp-8);z.attackAt=now;io.to(room.code).emit('hit',{playerId:target.id});}
    }
    for(const b of room.bullets) {
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
      if(b.life<=0) continue;
      for(const z of room.zombies) if(z.hp>0&&Math.hypot(z.x-b.x,z.y-b.y)<27){
        z.hp-=50;b.life=0;
        const shooter=room.players[b.owner]; if(shooter&&z.hp<=0) shooter.kills++;
        break;
      }
    }
    room.bullets=room.bullets.filter(b=>b.life>0&&b.x>-20&&b.x<W+20&&b.y>-20&&b.y<H+20);
    if(room.zombies.every(z=>z.hp<=0)){room.over=true;io.to(room.code).emit('gameOver',{won:true});}
    else if(Object.values(room.players).every(p=>p.hp<=0)){room.over=true;io.to(room.code).emit('gameOver',{won:false});}
    emitState(room);
  }
},50);

const PORT=process.env.PORT||3000;
server.listen(PORT,'0.0.0.0',()=>console.log(`Zombie Apocalypse Survival running on ${PORT}`));
