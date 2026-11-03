# Zombie Apocalypse: Survival

A browser-based 2-player online co-op top-down shooter. Two players join the same room code and fight 10 server-simulated zombies. Works on desktop and mobile browsers.

## Run locally

1. Install Node.js 18 or newer.
2. In this folder run:
   ```bash
   npm install
   npm start
   ```
3. Open `http://localhost:3000`.
4. To test two players on one computer, open a second browser tab and join with the same room code.

## Publish it online (so friends can join from anywhere)

This project needs a Node.js host because real-time multiplayer uses Socket.IO. One simple option is Render:

1. Create a GitHub repository and upload the contents of this folder.
2. In Render, create a **New Web Service** and connect that repository.
3. Set **Build Command** to `npm install` and **Start Command** to `npm start`.
4. Deploy. Render will provide an HTTPS URL; share it with your friend.
5. Both players open that URL, enter the same room code, and join.

No database or environment variables are required for this prototype. Rooms live in server memory, so a server restart clears active games. Use a single server instance (no horizontal scaling) unless you add a Socket.IO shared adapter and shared room state.

## Controls

- Desktop: WASD / arrow keys to move, mouse to aim, click or Space to shoot.
- Mobile: left virtual joystick to move; FIRE button shoots toward the nearest zombie; ◎ toggles auto-aim (the prototype has unlimited ammo).

## Gameplay notes

- The second player joining starts the round.
- Zombies chase the nearest living player and damage them at close range.
- Each shot deals 50 damage; zombies have 100 health.
- Win by eliminating all 10 zombies. Lose when both players are down.
- After a round, either player can start another round with **PLAY AGAIN**.
