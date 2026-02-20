# Summit Shredder 3D – Product Requirements Document (PRD)

## 1. Executive Summary

**Summit Shredder 3D** is an infinite runner arcade game that simulates high-speed snowboarding. The game features a low-poly 3D aesthetic, physics-based movement, procedural terrain generation, and a risk/reward system with tricks, obstacles, and loot boxes. It is a single-file HTML5 application utilizing the Three.js library.

---

## 2. Core Gameplay Loop

- **Objective:** Travel as far as possible down an endless, procedurally generated slope to accumulate distance (score) while managing Health (HP) and Lives.
- **Perspective:** Third-person, behind-the-character view with a dynamic following camera.
- **End Condition:** The game ends when the player loses all 3 lives.

---

## 3. Player Mechanics & Controls

### 3.1 Controls

| Input              | Action           | Description                                                                 |
| ------------------ | ---------------- | --------------------------------------------------------------------------- |
| Arrow Left / Right | Steer            | Steer the snowboarder. Curve intensity increases based on hold duration.    |
| Arrow Up           | Carve / Speed Up | When held with Left/Right, preserves 60%+ of speed during aggressive turns. |
| Space Bar          | Jump             | Performs a vertical jump to clear obstacles or reach elevated boxes.        |
| Escape             | Pause            | Toggles the Pause Menu.                                                     |
| Mouse Click        | UI Interaction   | Used for Start, Pause, Resume, and Exit buttons.                            |

### 3.2 Physics Engine

- **Acceleration:** Snowboarder accelerates automatically due to gravity (force: 0.02) up to 90 km/h (0.9 units/frame).
- **Friction:**
  - Straight: minimal friction (0.995).
  - Turning: higher friction (0.94) reduces speed unless Arrow Up is held (then 0.985).
- **Turn Logic:** Turns are calculated using a power curve (`1.6 * turnRatio^1.2`) for a drift feel.
- **Spin-Out:** Holding a turn for more than 2 seconds triggers a "Wipeout" with loss of control, spinning, and significant speed loss.
- **Jumping:** Jump force is 0.35 vertical units.
- **Ramp Jump:** Hitting a ramp launches the player with 0.7 vertical units ("High Launch").

---

## 4. World & Entities

### 4.1 Procedural Generation

- The slope is generated infinitely as the player descends.
- The ground follows the player for the illusion of infinity.
- Obstacles are spawned dynamically with density checks.

### 4.2 Obstacles

- **Trees & Rocks:** Stationary. Collisions deal 20 damage and reduce speed by 50%.
- **Ramps:** Angled platforms; hitting them launches the player into the air ("AIR TIME!").

### 4.3 Interactive Elements

- **Speed Boosts (Green Tracks):** Flat pads; contact sets speed to 1.4 units (Boost Speed).
- **Mystery Boxes:**
  - **Standard Box:** Floating gold cube; requires a jump to break.
  - **Elevated Box:** Positioned higher, often after a ramp; higher chance of better loot.
  - **Hitbox:** Boxes have vertical hitbox assistance to make breaking them while jumping easier.

---

## 5. Economy & Power-ups

### 5.1 Stats

- **Health (HP):** Starts at 100%. Decreases with collisions.
- **Lives:** Start at 3. At 0 HP, lose 1 life and reset HP to 100%.

### 5.2 Loot Table (Box Rewards)

Breaking a Mystery Box triggers a shockwave ring effect, granting one of:

- **Speed Boost:** Instant velocity increase.
- **HP Refill:** Restores 30 HP.
- **Extra Life / Full Heal:** Adds a heart, or fully restores HP if lives are full.
- **Shield:** Grants temporary invincibility (10 seconds), visualized with a wireframe sphere.
- **Dynamite (Trap):** See below.

### 5.3 Dynamite Mechanic

- **Trigger:** 10–20% chance from a box.
- **Effect:** Dynamite stick attaches to player with a chain.
- **Timer:** Explodes after 5 seconds (300 frames), dealing 50 damage.
- **Disarm:** Must jump twice in a row without steering (no Left/Right input) to detach before explosion.

---

## 6. User Interface (UI)

### 6.1 Heads-Up Display (HUD)

- **Top Left:**
  - HP Bar (gradient red)
  - Lives counter (heart icons ❤️❤️❤️)
  - Pause button (||)
- **Top Right:**
  - Distance traveled (meters)
  - Current speed (km/h)
- **Center:**
  - Notification area (popups: "Boost!", "Ouch!", "Trap!", etc.)

### 6.2 Menus

- **Main Menu:** Title, subtitle, control hints, "Hit the Slopes" button.
- **Pause Menu:** Overlay with "Resume", "Options" (disabled), "Exit to Menu".
- **Game Over Screen:** Final distance and "Try Again" button.

### 6.3 Feedback

- **Camera shake** when taking damage.
- **Particles:** Snow spray from the board, explosion effects for boxes/dynamite.
- **Visual Damage:** Player model hops when hit.

---

## 7. Technical Specifications

- **Framework:** Three.js (r128)
- **Architecture:** Single `index.html` with HTML, CSS, JS
- **Rendering:** WebGLRenderer with PCFSoftShadowMap enabled
- **Assets:** Fully procedural (player, trees, rocks via Three.js primitives – BoxGeometry, CylinderGeometry, etc.)
- **Compatibility:**
  - Desktop: Keyboard controls
  - Mobile: Touch zones (left/right for steering, center/tap for jumping)
- **Initialization:** Robust loading checks for Three.js readiness; button blurring prevents focus-stealing bugs.
