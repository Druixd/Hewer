# PIN DROP — Game Concept Document

## Hybrid-Casual Puzzle Game

---

## Part 1 — 3 Game Concepts

### Concept 1: Powder Bolt — "Drop the Dots"

| | |
|---|---|
| **Mechanic** | Tap to drop colored powder/ball-bearings through concentric metal plates. Each plate has holes that route the balls to matching-color chamber valleys below. Fill all valleys → level complete. |
| **Core loop** | Strategic hole-alignment → tap → satisfying cascade of balls rolling/clattering through plates → watch each valley fill up |
| **Visual reference** | Marble Sort meets powder flows. Metallic plates, sanded channels, powder concentrates in valleys |
| **ASMR elements** | Rolling ball sounds, clattering through plates, soft powder settle sound, balloon pop on completion |
| **Why it fits** | ✅ One mechanic (drop) ✅ 3-sec understand: *"tap to drop colored balls through holes"* ✅ Very satisfying cascade ✅ Simple plates with holes — easy to scale ✅ Geometric/realistic metal art ✅ Addictive chaining ✅ Skin & unlock economy fits |
| **Caution** | Fluid/Coconut physics simulation can be tricky with too many balls → may need simplified pathfinding |

---

### Concept 2: Wire Link — "Connect the Dots"

| | |
|---|---|
| **Mechanic** | Rotate a central wire spool to connect copper-colored plug tips to matching nodes on a hexagonal board. Each node/plug has a color code. Rotate spool → wire connects matching pairs. More wires connected = more score |
| **Core loop** | Study board → rotate spool → wire snakes across → connect matching pairs → subtle wire-fray cutoff on wrong color = immediate feedback → more connected = bigger chain reaction sound |
| **ASMR elements** | Wire wrapping sounds, satisfying "thunk" when a connection clicks, plastic snap sound |
| **Why it fits** | ✅ One mechanic (rotate to connect) ✅ 3-sec understand: *"rotate the spool, match the colors"* ✅ Satisfying click-connection ASMR ✅ Simple 2D art with glowing wire lines ✅ Collection of wire spool skins ✅ Economy: buy different spools, premium wire themes |
| **Caution** | Scaling levels to avoid "too simple" while keeping it easy requires clever level design |

---

### Concept 3: Pin Drop — "Pin Push" ⭐ CHOSEN

| | |
|---|---|
| **Mechanic** | Tap to drop colored pins from a bi-level top tray through a matching-color hole in a wooden board. The pin drops down, lands in a matching-hole tray below, and stacks vertically with clattering ASMR sound. Fill all colored holes in the bottom tray with matching pins → next level. |
| **Core loop** | Study board → identify matching-color holes → tap pins in right order → watch cascade of pins drop, clatter, and stack → Bottom tray fills |
| **Visual reference** | Dots & Boxes meets pin art. Clean wooden boards, colored pins, crisp stacking visuals |
| **ASMR elements** | **Incredible stacking/clattering ASMR** — pins hitting each other, smooth drop landing, satisfying "click" flush into the bottom hole, confetti burst on level complete |
| **Why it fits** | ✅ One mechanic (tap to drop pin) ✅ **3-sec understand in ANY ad**: *"tap a pin, drops through matching hole"* ✅ **Best ASMR of the three** — stacking pins is inherently satisfying ✅ Only 2-3 art assets needed: pin, board, hole ✅ Collection + skins + power-up economy ✅ Naturally scales (2 pins → 20 pins, more colors) ✅ Perfect for **ultra-short play sessions** — one level = 15-20s |
| **Caution** | None significant |

---

## Criteria Scorecard

| Criterion | Concept 1: Powder Bolt | Concept 2: Wire Link | **Concept 3: Pin Drop** |
|---|---|---|---|
| 1️⃣ Single simple mechanic | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 2️⃣ 3-sec visual clarity | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| 3️⃣ ASMR satisfaction | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| 4️⃣ Easy to develop | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 5️⃣ Uncomplicated artwork | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 6️⃣ Retention hooks | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| 7️⃣ Strong economy potential | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **TOTAL** | **14/28** | **15/28** | **23/28** 🏆 |

---

## Chosen Concept: PIN DROP

### Core Game Design

#### The One Mechanic: TAP TO DROP A PIN

There are **two trays** — a **Top Tray** and a **Bottom Tray** — separated by a removable **Board** in between.

```
┌──────────────────────────┐
│       TOP TRAY           │ ← Pins sit here (colored)
│  [🔴 🔴 🔵 🔵 🟢 🟢]     │ ← Tap any pin
└──────────┬───────────────┘
           │  BOARD (holes)
┌──────────┴───────────────┐
│      BOTTOM TRAY         │ ← Pins stack here
│     [🔴🔵 🟢🔴🔵]        │ ← Must fill ALL holes
└──────────────────────────┘
```

**How it works:**

1. Player taps a pin on the **Top Tray**
2. That pin **drops straight down** through the matching-color hole in the Board
3. It lands into the **Bottom Tray** and stacks vertically with other pins of the same color
4. The goal: **fill every matching-color hole in the Bottom Tray** → level complete
5. **Challenge**: Pins CAN'T stack where there's no hole of their color → order matters

#### Anti-Frustration Rules (Critical for Hybrid-Casual)

- **Unlimited undo**: Mistake → double-tap any placed pin → it pops back to the top tray (FREE, unlimited)
- **Visual color guide**: Matching holes glow subtly when there are pins of that color remaining on the top tray
- **Soft-fail safety net**: If player makes it impossible (all top pins placed, and some bottom slots still empty) → the overturned pins auto-reset to top tray (no penalty, just a retry)

---

### Art Style

Clean, flat 2D — matches reference game aesthetic:

- **Board**: Slight 3D thickness (like a wooden cutting board) — simple rounded rectangle
- **Pins**: Rounded cylinders, 8-10px radius, bright flat colors (6-8 colors initially)
- **Trays**: Minimalist slots with slight inner shadow for depth
- **Background**: Single calming pastel gradient
- **Effects**: Small particle burst on pin drop. Confetti sparkle on level complete.

**Asset count to build MVP:**
~6 pin colors, 1 board sheet, 1 top tray, 1 bottom tray = under 20 sprites total.

---

### ASMR & Satisfaction Design

This is where Pin Drop **dominates** over competitors:

| Moment | ASMR Element |
|---|---|
| **Pin drop** | Weighty "thud" + slight "ting" on impact |
| **Stacking** | Subtle "clack" each time a pin hits the stack below |
| **Correct placement** | Satisfying "click" — pin snaps flush into the hole |
| **Level complete** | Staggered pin pop + sparkle whoosh + soft bell chime |
| **Wrong hole (blocked)** | Error "buzz" + pin bounces gently back up |
| **Undo** | Quick "pop" suction sound |

**UX Feedback Polish:**

- Screen micro-vibrates on correct pin drop (on supported devices)
- Bottom tray fills with a satisfying wave animation
- Level number ticks up with a satisfying clock-tick sound

---

## Retention Design

### 1. Session Loop (15-20 seconds per level)

```
Play Level → Beat Level → Tap to Continue → Beat Level → ...
(can be interrupted at any point — no penalty)
```

### 2. Collection System — "PIN VAULT"

As players progress, they **collect** unique pin skins:

- 🌟 **Golden Pin** — unlock at level 10
- ⚡ **Neon Pin** — unlock at level 25
- 🔮 **Crystal Pin** — unlock at level 50
- 🎨 **Custom gradients** — collectable, purchasable, or ad-rewarded

Players can **equip** any collected pin skin in their vault. This creates:

- Collection dopamine → *"I want that Neon Pin"* → plays more
- Skin showcase → shares screen captures organically

### 3. Progression Milestones

| Milestone | Reward |
|---|---|
| Every 5 levels | New pin skin unlock |
| Every 25 levels | New board theme (dark mode, marble, neon grid) |
| Level 50 | "Golden Era" board + celebration video |
| Every 100 levels | Craftable ultra-rare pin skin |

### 4. Daily Engagement

- **Daily 10-Level Challenge** — beat 10 levels in a row with no undo → exclusive pin skin
- **Login streak** — bronze/silver/gold pin rewards
- **Weekly leaderboard** — fastest time to beat 50 levels

---

## Economy & Monetization

### In-Game Currency: "DROPS"

Earned by completing levels. Used to:

- Unlock custom pin skins (100–500 Drops)
- Unlock board themes (200–1,000 Drops)
- Remove ads (optional, in-app purchase)

### Monetization Stack

| Layer | Method | Placement |
|---|---|---|
| **Interstitial** | Between every 4–5 levels | Standard F2P spacing |
| **Rewarded Video** | +3 Undos (starting with 3 free) / +1 Skip Level / Exclusive skin piece | Opt-in, high value |
| **IAP — Starter Pack** | $1.99 → 5,000 Drops + Remove ads + 5 exclusive pins | First-session offer |
| **IAP — Premium Skins** | $0.99–$2.99 per premium skin collection | Cosmetic whales |
| **IAP — No Ads** | $2.99 one-time | Standard |
| **Bundle Offers** | "Board Theme Pack" — $3.99 | Every 2 weeks themed |

### Revenue Projection Logic (Hybrid Casual Benchmark)

- DAU target: 50K–100K at launch
- ARPDAU target: $0.08–$0.12 (industry average for hybrid casual puzzle)
- ~$8,000–$12,000/day revenue at scale
- Peak potential: $30,000–$50,000/day with strong retention

---

## Competitive Edge

| | Pin Drop (This Game) | Marble Sort | Dots & Boxes |
|---|---|---|---|
| Mechanic simplicity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Ad conversion (20s clip) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| ASMR satisfaction | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Dev time to MVP | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Economy depth | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Retention curve | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## Development Roadmap

### Phase 1 — Core Prototype (2–3 weeks)

- ✅ Board + two trays (Top/Bottom)
- ✅ Pin drop mechanic with color matching
- ✅ 20 basic levels (5 colors × 4 difficulty tiers)
- ✅ Basic undo system
- ✅ Sound effects + ASMR setup
- ✅ Basic particle effects
- ✅ Simple interstitial ad (test mode)
- ✅ Level progression tracker

### Phase 2 — Content Scale (4–6 weeks)

- 100+ levels across 6 color tiers
- Pin collection vault UI
- 6+ board themes
- Level creator (optional, for community)
- Rewarded video integration

### Phase 3 — Polish & Launch (2–4 weeks)

- ASMR sound library finalization
- Progression milestone celebrations
- Daily challenges, login streaks, leaderboard
- A/B tested interstitial intervals
- Launch marketing assets (playable ad build)

### Phase 4 — Live Ops (ongoing)

- Bi-weekly themed events
- New skin drops
- Community challenges
- Seasonal boards

---

## Why Pin Drop Wins on Every Criterion

1. **One mechanic** → Tap. Drop. Match. That's it. No combos. No timers. No moving targets.
2. **3-second ad clarity** → *[close-up] Pin is tapped. It drops through a hole. Board fills. "Tap. Drop. Match. Beat the level."* Done.
3. **Incredible ASMR** → Stacking pins clattering is inherently satisfying — proven by ASMR communities on YouTube with pin-art content.
4. **Dead simple to build** → Two rectangles (trays), a sheet with holes (board), and colored cylinders (pins). No animation rigs. No physics engine. Just conditional placement.
5. **Minimal art** → One pin sprite per color. One board sprite. Two trays. Done.
6. **Retention hooks** → Collection vault, daily challenges, streak login, skin showcase — all proven hybrid casual patterns.
7. **Strong economy** → Three IAP tiers + rewarded video + interstitials. Vault system drives long-term spending. Premium skins drive whale revenue.
