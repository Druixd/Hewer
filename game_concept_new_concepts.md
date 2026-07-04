# THREE UNIQUE HYBRID-CASUAL PUZZLE CONCEPTS

*Unexplored mechanics. Zero direct competitors in mobile.*

---

## Concept 1: THERMOMORPH — "Heat & Shape"

| | |
|---|---|
| **Core Mechanic** | Tap a shape to HEAT it → it EXPANDS. Tap again to COOL it → it SHRINKS. Use expansion/shrinkage to fit shapes through gaps, bridge connections, or open pathways. Fill all target zones → level complete. |
| **One sentence** | "Heat it to grow, cool it to shrink, fit it through." |
| **ASMR elements** | Metal ticking as it cools, faint heat shimmer sound on expansion, satisfying SNAP when a gap closes perfectly, soft metallic chime on level complete |
| **Why it's never been done** | Thermal expansion has only appeared as a side-effect in physics sandboxes — never as the *framing puzzle mechanic* in a mobile game |
| **Mechanic to scale** | 2 shapes → 20 shapes, precision timing (grow JUST enough), multiple colors requiring different heat levels |
| **Art** | Geometric metal shapes. Hot = warm glow (orange tint). Cold = blue tint. Flat 2D — 1 sprite per color, glow is a CSS filter |
| **3-sec ad understanding** | *[Screen: Red shape is tapped. It GROWS. Green shape tapped → SHRINKS. Red fits through gap. "Heat to grow. Cool to shrink. Beat the level."]* |
| **Ease of dev** | ⭐⭐⭐⭐⭐ — Resize sprite on tap. No physics. No pathfinding. Switch color overlay on tap. 1 button. |

---

### 🎨 AI Image Generation Prompt — Thermomorph

```
A mobile puzzle game screenshot, clean flat 2D minimalist art style like Marble Sort and Good Job Games.
Scene: A puzzle level mid-play. A rectangular metallic board with a warm amber/brass gradient background and subtle rivet details.
In the top-left area, six geometric shapes sit in a holding bay: circles, rectangles, and diamonds in six flat colors (red, orange, yellow, green, blue, purple).
Some shapes are RED-HOT with a glowing orange aura (expanded, slightly larger). Others are COLD with a blue frost shimmer (shrunken, slightly smaller).
Between the shape bay and a glowing circular target zone at bottom-right, there is a wall with two gaps: one small gap (only shrunk shapes fit) and one wide gap (only expanded shapes fit).
One hot red circle is mid-transition, smoothly growing from cold to hot state with a subtle orange heat-haze ripple effect.
UI overlay: minimal. A small word "TAP TO HEAT" floating above a hot shape, "TAP TO COOL" above a cold one. Level indicator "LEVEL 7" in top-right corner. Score counter "42" top-left.
Color palette: warm amber board (#D4A44C), cold blue accents (#4A90D9), flat bright shape colors, dark charcoal UI text.
Style: ultra-clean, no gradients on shapes, hard shadows, satisfying geometric precision. Like a cross between Marble Sort's polished feel and Good Job's minimal geometry.
--ar 9:16 --style raw
```

---

## Concept 2: PHASE SHIFT — "Change State"

| | |
|---|---|
| **Core Mechanic** | Tap an object to cycle its state: ICE → WATER → STEAM. Each state has different physics: ICE = solid, blocks paths, can be pushed. WATER = flows down, fills containers. STEAM = rises, floats upward. Use state changes to navigate obstacles and reach the goal. |
| **One sentence** | "Freeze it to block. Boil it to rise. What goes up must come back down." |
| **ASMR elements** | Water drip/hiss when boiling, crisp ice cracking on freeze, soft steam hiss, satisfying "plop" when water lands |
| **Why it's never been done** | Phase changes appear in educational games and obscure PC puzzle games, but never in hybrid-casual mobile — no one simplified it to a single-tap loop |
| **Art** | Flat blobs with texture cues: Ice = frosted texture overlay, Water = smooth blue, Steam = wispy translucent. Same base shape, 3 textures |
| **3-sec ad** | *[Ice blob frozen → pushed to block a gate → tap → boils → rises over gate → tap again → steams → floats up → "Freeze. Boil. Soar. Solve it."]* |
| **Ease of dev** | ⭐⭐⭐⭐ — 3 states × same sprite = 3 visual modes + 3 behavior modes. No physics engine needed per se — just conditionals |

---

### 🎨 AI Image Generation Prompt — Phase Shift

```
A mobile puzzle game screenshot, vibrant flat 2D style inspired by Circle Cube and Sort Express.
Scene: A puzzle level mid-play. A soft gray-blue container/puzzle chamber with three sections stacked vertically — bottom has a glowing GOAL zone.
Three identical blob shapes (squishy rounded rectangle blobs) each in a different phase state:
- BOTTOM: An ICE blob — frosted white-blue texture with tiny ice crystal sparkles, sitting solid on a ledge, blocking a path.
- MIDDLE: A WATER blob — smooth glossy blue, dripping slightly, flowing down a channel toward the goal.
- TOP: A STEAM blob — translucent white-wispy, floating upward with soft wisp trails, drifting toward an upper platform.
The scene shows the mechanic clearly: the same shape in THREE different visual states, each behaving differently.
A small tap indicator (finger icon) hovers near the water blob, suggesting the player just tapped to change its state.
UI overlay: minimal. A tiny state-switch arrow "ICE → WATER → STEAM" in top-left. Level counter "LEVEL 3" top-right.
Color palette: frosted ice blue (#B8D4E3), water navy (#2E5F8A), steam translucent white with blue tint, soft gray chamber (#E8ECF0).
Style: polished flat design, glossy water effect on water blob, crystalline edge highlights on ice blob, soft opacity on steam blob. Clean shapes like Circle Cube.
--ar 9:16 --style raw
```

---

## Concept 3: SURFACE TENSION — "Float & Connect"

| | |
|---|---|
| **Core Mechanic** | Color-coded objects float on a water surface. DRAG one object → surface tension pulls a chain of other same-color objects (they're linked). Pull to move them to a destination zone. Pull TOO HARD (beyond surface tension limit) → chain BREAKS. Connect all colored objects to matching zones → level complete. |
| **One sentence** | "Drag to pull, chain to connect, break to lose." |
| **ASMR elements** | Water surface "plip" when object drops, gentle tinkling as chain tightens, satisfying SNAP sound when chain connects to destination, soft surface ripple on reset |
| **Why it's never been done** | Water surface physics appear in toy apps and browser demos, but the "tension chain" mechanic has never been the core of a puzzle game |
| **Art** | Colored circles floating on blue gradient. Connection "strings" = thin glowing lines between linked objects. Minimalist |
| **3-sec ad** | *[Blue circle dragged → 3 blue circles link behind, tethered → released → chain flies across → "Drag. Chain. Solve."]* |
| **Ease of dev** | ⭐⭐⭐⭐ — Sprite array, linear tether between objects, distance threshold for breaking |

---

### 🎨 AI Image Generation Prompt — Surface Tension

```
A mobile puzzle game screenshot, minimalist flat 2D style like Busters and Spyke Games.
Scene: A puzzle level mid-play. A calm water surface fills the screen — soft blue gradient (#3A7BD5 to #6DB3F2) with subtle horizontal ripple lines.
Four colored circular objects float on the surface: 3 red circles, 2 yellow circles, 4 green circles, each linked by thin glowing tension lines (red lines connecting red circles, yellow for yellow, green for green).
A player's finger (white stylized cursor finger) is DRAGGING one red circle to the right. The tension line between it and the next red circle stretches into a visible elastic band — about to reach the breaking point, with a subtle red "tension glow" on the stretched line.
Each color group has a matching destination zone: a soft glowing circle outline at the right side of the screen — red zone, yellow zone, green zone.
UI overlay: minimal. A tiny tension meter bar in top-right showing "SAFE → BREAK". Level counter "LEVEL 5" top-left in a rounded pill.
Color palette: soft water blue, flat bright circle colors (red #E74C3C, yellow #F1C40F, green #2ECC71), thin glowing neon-white tension lines.
Style: ultra-minimal, flat geometric, soft water reflections under circles, tension lines glow brighter as they stretch. Clean like Spyke Games — no clutter, pure readability.
--ar 9:16 --style raw
```
