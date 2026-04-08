# 🤖⚽ Robo-Soccer

**Robot Football Championship** — A browser-based 2D robot soccer game with AI opponents, physics-based gameplay, and stunning visuals.

![Robo-Soccer](https://img.shields.io/badge/Game-Robo--Soccer-00b4ff?style=for-the-badge&logo=github)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

---

## 🎮 Play Now

Simply open `index.html` in your browser — no build step or dependencies required!

Or serve locally:
```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

---

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `W A S D` / `Arrow Keys` | Move your selected robot |
| `Space` | Boost kick |
| `Tab` | Switch to next robot |
| `P` | Pause / Resume |

---

## ✨ Features

- **4v4 Robot Soccer** — Control the Blue Bots against AI-powered Red Bots
- **Physics Engine** — Realistic ball bouncing, friction, and collision mechanics
- **Smart AI** — Opponents with goalkeeper positioning, ball-chasing, and strategic play
- **3 Difficulty Levels** — Easy, Medium, and Hard
- **Particle Effects** — Kick sparks, goal celebrations, and ball trails
- **Animated Robots** — Each robot has eyes, antenna, jersey numbers, and team glow
- **Full Match System** — 3-minute timer, live scoreboard, goal replays, and game-over screen
- **Responsive Design** — Adapts to any screen size
- **Dark Futuristic Theme** — Neon glows, glassmorphism, and smooth animations

---

## 📁 Project Structure

```
robo-soccer/
├── index.html    # Game page with screens & HUD
├── style.css     # Dark futuristic UI styling
├── game.js       # Full game engine (~650 lines)
└── README.md     # You are here
```

---

## 🧠 How the AI Works

- **Goalkeeper** — Tracks the ball's Y-position and stays near the goal line
- **Field Players** — Chase the ball when nearby, position themselves strategically behind the ball relative to the opponent's goal
- **Difficulty** adjusts AI speed and reaction frequency

---

## 🚀 Tech Stack

- **HTML5 Canvas** — Game rendering
- **Vanilla JavaScript** — Game logic, physics, and AI
- **Vanilla CSS** — UI with modern design tokens
- **Google Fonts** — Orbitron + Rajdhani for a futuristic look

No frameworks. No dependencies. Zero build step. Pure web.

---

## 📄 License

MIT — feel free to fork, modify, and share!
