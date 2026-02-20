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
| Arrow Up           | Lean Forward     | When held with Left/Right, carves with increased control (60% speed cap).   |
| Arrow Down         | Lean Back        | When held alone, increases speed. When held with Left/Right, brakes smoothly to 1 km/h. |
| Space Bar          | Jump             | Performs a single high jump (one jump per press, not repeated).            |
| Escape             | Pause            | Toggles the Pause Menu.                                                     |
| Enter              | Start Game       | Starts the game from the main menu.                                         |
| Mouse Click        | UI Interaction   | Used for Start, Pause, Resume, and Exit buttons.                            |

### 3.2 Physics Engine

#### Speed & Acceleration

- **Base Acceleration:** `0.0045` units/frame (consistent throughout the game, regardless of progress)
- **Max Speed:** `0.85` units/frame (~85 km/h)
- **Boost Speed:** `1.3` units/frame (from speed boost pads)
- **Acceleration Scaling:** When not holding Up, acceleration is multiplied by `0.55` (smooth buildup)

#### Speed Control Mechanics

**Leaning Forward (Up + Steering):**
- Speed capped at **60% of maxSpeed** (ceiling, not floor)
- Minimal acceleration (`0.25` of base) to maintain speed
- Friction: `0.997` (0.3% speed loss per frame - gradual decrease)
- Faster turn interpolation (`0.25` vs `0.15`) for better control
- Provides increased control while maintaining speed

**Leaning Back (Down + Steering):**
- Smooth braking: friction `0.97` (3% speed loss per frame)
- Decreases speed gradually to `0.01` units/frame (1 km/h)
- No acceleration applied (braking only)
- Extra turn angle (+45°) for tighter control while braking

**Steering Only (Left/Right without Up/Down):**
- Speed capped at **75% of maxSpeed**
- Friction: `0.998` (0.2% speed loss per frame)
- Minimum speed floor: 35% of maxSpeed
- Gentler turn angle (50% of full turn)
- Less control, slide feel

**Leaning Back Only (Down without Steering):**
- Same acceleration as default (`0.0045 * 0.55`)
- Progressively reaches maxSpeed
- No friction applied (acceleration handles speed increase)

**Straight Line (No Input):**
- Friction: `0.997` (0.3% speed loss per frame - smooth coast)
- Acceleration applied normally

#### Turn Logic

- Turns calculated using power curve: `1.6 * turnRatio^1.2` for drift feel
- Turn interpolation: `0.15` per frame (default), `0.25` when carving (Up+steer)
- **Spin-Out:** Holding a turn for more than 2 seconds (120 frames) triggers a "Wipeout" with loss of control, spinning, and significant speed loss

#### Jumping

- **Jump Force:** `0.42` vertical units (high jump)
- **Single Jump Per Press:** Holding Space performs one jump (not repeated)
- **Ramp Launch:** Hitting a ramp launches with `0.4` vertical units
- **Ramp Assist:** Tap Space within ~0.8 seconds (50 frames) after ramp launch for assisted boost (`+0.32` vertical units) to reach elevated boxes

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

- **Speed Boosts (Green Tracks):** Flat pads; contact sets speed to `1.3` units (Boost Speed).
- **Mystery Boxes:**
  - **Standard Box:** Floating gold cube; requires a jump to break. Hit from side removes box without damage.
  - **Elevated Box:** Positioned higher (`y = 6.5`), often after a ramp; requires timed jump (Space press) during airtime to break. If missed, shows "Not this time..." notification and player passes underneath.
  - **Hitbox:** Boxes have vertical hitbox assistance (`breakHeight: 6.0` for elevated) to make breaking them while jumping easier.
- **Ramps:** Angled platforms that launch player into air. Player can tap Space after launch for ramp-assisted jump to reach elevated boxes.

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

- **Main Menu:** Title, subtitle, control hints, "Hit the Slopes" button. Can start with Enter key.
- **Pause Menu:** Overlay with "Resume", "Exit to Menu" buttons.
- **Exit Confirm Dialog:** In-game confirmation dialog when exiting to menu ("Exit to menu? Your current progress will be lost.") with Cancel/Exit options.
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
- **Version Control:** Git repository initialized, ready for GitHub integration

## 8. Game Design Philosophy

### Speed & Control Balance

The game mechanics are designed to provide a realistic snowboarding feel with smooth, gradual acceleration and controllable speed:

- **Consistent Acceleration:** Same acceleration rate throughout the game (not scaling with progress)
- **Speed Caps for Control:** 
  - Leaning forward (Up+steer): 60% maxSpeed cap for precise control
  - Steering only: 75% maxSpeed cap for slide feel with less control
- **Gradual Speed Changes:** Friction values are tuned for smooth, gradual speed changes rather than abrupt stops
- **Control Through Leaning:** Different control states (forward lean, back lean, neutral) provide different speed/control trade-offs

### Player Experience

- **Smooth Feel:** Acceleration and friction values tuned for gradual, smooth speed changes
- **Increased Control:** Leaning forward provides better control at the cost of speed cap
- **Realistic Physics:** Speed maintenance and braking feel natural and responsive
- **Single Jump:** One jump per Space press prevents accidental repeated jumps
