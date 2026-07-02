# Standalone Survivor-Like Feature Spec: Cluefield Runs

Author: Nitish

Status: Standalone concept. Not integrated into HEWER.

## Thesis

Cluefield Runs is a mobile survivor-like feature where every run produces mystery evidence, not just currency.

The player survives waves, builds combat synergies, tags clues under pressure, extracts evidence, and uses that evidence to advance a case board and a social resolution layer.

The core tension: **combat gives adrenaline, clues give meaning, and the case board gives the run a reason to matter after the timer ends**.

## Product Fit

Survivor-like games work on mobile because they compress action into three readable decisions:

- move well
- choose upgrades
- survive escalation

The weakness is repetition. After enough runs, the player often sees the same output: coins, gear, shards, event currency, and another stat ladder.

Cluefield Runs adds a second output layer. A run can still reward currency, but its memorable reward is evidence. The player does not only ask, "Did I get stronger?" They ask, "What did I learn?"

## Core Loop

1. Enter a district run tied to an active case.
2. Move with one-thumb survivor controls while weapons auto-fire.
3. Fight waves, elites, hazards, and case-specific enemies.
4. Discover clue nodes during combat.
5. Hold, escort, scan, or protect a clue long enough to secure it.
6. Extract or survive the timer to bank evidence.
7. Place evidence on a case board.
8. Advance suspect theories, unlock new districts, and contribute to a social case.
9. Resolve the case for rewards, cosmetics, narrative branches, and the next case chain.

The key rule: clue discovery happens inside the run, not only in a post-run chest. The player must choose between safety, damage, and investigation.

## Combat Design

Combat stays one-thumb first. The player moves; weapons fire automatically; upgrades create build identity.

Run variables:

- weapon family: firearm, trap, ritual, forensic tech, companion drone
- evidence modifier: some builds reveal clues better, not just kill better
- threat profile: mobs, elites, stalkers, hazards, case boss
- panic timer: clue opportunities become stronger near danger spikes

Example upgrade choices:

- **Chain Lightning:** clears swarms but can destroy fragile clue containers.
- **UV Sweep:** reveals hidden evidence trails in a cone.
- **Bloodhound Drone:** tags clue carriers but has weak damage.
- **Ricochet Rounds:** strong in alleys, risky near civilians or clue props.
- **Cold Case Instinct:** slows time when a rare clue spawns.

The catch: if the best combat build is also the best clue build, the mystery layer becomes fake. Evidence tools should create tactical friction.

## Clue System

Clues have two values: factual utility and theory utility.

### Factual Utility

A clue can identify:

- suspect
- location
- motive
- method
- timeline
- hidden route
- boss weakness
- event modifier

### Theory Utility

A clue can support multiple interpretations. It can also conflict with other evidence.

Clue types:

- **Hard clue:** fingerprint, weapon fragment, ledger ID.
- **Soft clue:** rumor, witness line, symbol, location pattern.
- **Damaged clue:** evidence secured after combat damage or near-death extraction.
- **Social clue:** discovered by another player or club event.
- **Red herring:** useful when disproven.

The system should reward pattern reading, not collection count. Ten weak clues should not automatically beat three coherent clues.

## Run-To-Case Progression

Each case should run for roughly 3 to 7 sessions.

Case stages:

1. **Lead:** the player gets a district, suspect pool, and first objective.
2. **Pressure:** stronger enemies appear because the player is getting close.
3. **Contradiction:** one clue challenges the obvious suspect.
4. **Confrontation:** a boss-like run tests the current theory.
5. **Resolution:** the player submits an accusation or joins a group verdict.

Progression currencies should stay split:

- **Combat growth:** weapons, talents, survivor stats.
- **Investigation growth:** case board slots, analysis tools, clue preservation.
- **Social growth:** credibility, vote weight, group rewards, case-season identity.

That split protects the fantasy. A stronger fighter survives better. A better investigator reads the case better.

## Social Mystery Resolution

The social layer should be asynchronous by default. The player should never need four friends online to finish a case.

Modes:

- **Public case board:** players contribute clues to a shared case instance.
- **Theory voting:** players choose suspect, motive, and method before a deadline.
- **Credibility score:** accuracy improves future influence, but never hard-locks new players.
- **Structured debate prompts:** preset arguments generated from owned clues.
- **Case aftermath:** correct theories unlock bonus runs, cosmetics, and story branches.

Failure state: social systems can become popularity contests. The design needs evidence-backed voting, limited spam, and clear confidence bands.

Practical rule: players vote with theories, not chat volume.

## Monetization Direction

The monetization should be hybrid but restrained:

- rewarded ads for revive, clue scan, or one extra post-run choice
- battle pass around case seasons
- cosmetics for survivors, boards, clue effects, and kill effects
- convenience boosts for analysis timers or loadout presets
- limited-time case events with leaderboard rewards
- optional club contribution bundles that do not reveal guaranteed truth

Avoid selling guaranteed answers. If players can buy the culprit, the mystery dies.

## MVP

The MVP should prove four things:

- one-thumb survivor combat feels good
- clues are visible and desirable during combat
- the case board creates curiosity between runs
- asynchronous social resolution adds stakes without requiring real-time multiplayer

Minimum content:

- 1 case
- 3 districts
- 6 suspects
- 20 to 30 clue fragments
- 6 weapon families
- 12 to 18 upgrade choices
- 1 asynchronous group vote
- 1 final accusation screen

## UX Mockups

The current mockup set illustrates three moments:

1. **Cluefield Run:** live survivor combat with clue tagging under pressure.
2. **Case Board:** post-run evidence placement and suspect path progress.
3. **Club Case:** asynchronous group contribution toward a weekly mystery.

Saved mockups:

- [cluefield_run.png](../mockups/cluefield_run.png)
- [case_board.png](../mockups/case_board.png)
- [club_case.png](../mockups/club_case.png)

## Acceptance Criteria

The feature works if a player can explain the loop in one sentence:

> I survive the run to grab clues, then use those clues to solve the case.

It fails if the clue layer becomes either decorative or mandatory homework. The run must still be fun without perfect case optimization, but the best players should feel the extra value of reading evidence well.

## Source Links

- Vampire Survivors official site: [poncle.games](https://poncle.games/vampire-survivors)
- Vampire Survivors on Google Play: [play.google.com](https://play.google.com/store/apps/details?hl=en_US&id=com.poncle.vampiresurvivors)
- Survivor.io on Google Play: [play.google.com](https://play.google.com/store/apps/details?hl=en_US&id=com.dxx.firenow)
- MobileGamer.biz on Survivor.io early revenue: [mobilegamer.biz](https://mobilegamer.biz/two-months-in-survivor-io-passes-75m-from-37m-downloads/)
- Brotato on Google Play: [play.google.com](https://play.google.com/store/apps/details?hl=en_US&id=com.brotato.shooting.survivors.action.roguelike)
- 20 Minutes Till Dawn on Google Play: [play.google.com](https://play.google.com/store/apps/details?hl=en_US&id=com.Flanne.MinutesTillDawn.roguelike.shooting.fr.gp)
- Heroes vs Hordes on Google Play: [play.google.com](https://play.google.com/store/apps/details?hl=en_US&id=com.swiftgames.survival)
- Deep Rock Galactic: Survivor Steam page: [store.steampowered.com](https://store.steampowered.com/app/2321470/Deep_Rock_Galactic_Survivor/)
- June's Journey official site: [junesjourney.com](https://www.junesjourney.com/)
- Merge Mansion on Google Play: [play.google.com](https://play.google.com/store/apps/details?hl=en_US&id=com.everywear.game5)
- Sensor Tower Live Ops Strategies 2025: [sensortower.com](https://sensortower.com/blog/top-grossing-mobile-games-live-ops-strategies-2025-report)
