# Dungeon Dot

Landscape-first physics dungeon crawler. The game runs from `index.html`.

## V8.11 — Boss health

All 12 bosses start with twice their V8.10 HP in dungeon runs and practice. For example, Dungeon 1's Gatekeeper now has 136 HP, Crystal Eye 108 HP, and Slime King 144 HP. Ash Phoenix also returns with twice its previous rebirth HP. Splitting bosses divide their remaining health evenly between the two halves.

## V8.10 — Controls and combat feel

- **Archer:** The draw ring shows when to release, when a shot is strong (70% draw), and when the bow is reloading. Releasing below 18% cancels the draw, including when the player slides back to center before lifting their thumb.
- **Classic:** The bat ignores input below 22% stick travel and responds to deliberate flicks even when they finish between frames. Clean hits and blocks have distinct sounds controlled by the existing Master and Sound effects settings.
- **Mage:** Rune tracing accepts wider passes between touch samples. The cast indicator distinguishes an invalid trace, a spell on cooldown, and low mana.
- **All heroes:** Menus, rotation, and loss of focus clear held controls and cancel unfinished attacks. Combat pauses while the page is hidden or the display is in portrait.

## V8.9 — Difficulty, elements and character balance (mechanics only)

- **Encounter pacing and damage:** Classic keeps the full room population because its shield can block ranged pressure. Archer and Mage retain a smaller early-floor population and converge to the same room counts by Dungeon 5; they also take 5% and 10% less incoming damage, respectively. The character stats panel shows this mitigation. Existing enemy attack damage and telegraphs remain in place.
- **Healing and recovery:** Enemy Healers now heal their allies only; touching one no longer restores the player's health. Player regeneration is capped at 2.4 HP/s, maximum health at 100, and item stack effects have per-item ceilings. Starting runs remain 50 HP and three lives.
- **Stacked loot:** Item effects cap at one to three stacks (Shield Bloom at three, Glass Eye and Counterweight at two); capped pickups grant 10 coins. Old saves keep their existing shape and values, while gameplay applies the new ceilings without a save migration.
- **Elements:** Level 3 still grants one of Fire, Ice, Lightning, or Poison. Level 8 still grants a distinct second element. All six two-element combinations have repeatable regression coverage, including their two-second combo throttle.
- **No graphic redesign.**

### Regression coverage

Run `node --test tests/core-reliability.test.cjs` with Node.js 20+. The 23-test suite now also checks hero-specific encounter counts and incoming damage, all six Level 8 element pairs, Level 3/8 choice progression, legacy save compatibility under stack limits, capped-pickup compensation, and healer behavior.

---

## V8.8 — Character combat and enemy AI reliability (mechanics only)

- **Classic Bat:** The bat sweep, physical bat collision, and stationary bat defense are now exclusive to Classic Dot. Archer and Mage no longer have an invisible bat that pushes nearby enemies. Classic also cannot hit enemies through neutral stone walls or intact props.
- **Archer:** Piercing arrows now resolve enemies **nearest first along their flight path**. Fast arrows can strike multiple enemies in the same frame; each enemy is hit at most once per arrow. Deflection and coin pickup now occur after solid collision checks, so arrows cannot reflect bullets through walls. Armoured targets stop arrows instead of consuming piercing charges on ineffective hits.
- **Mage:** Automatic targeting prefers living enemies/nests with a clear projectile route, instead of locking onto an enemy hidden behind stone or crates. When none is visible, casts use the last facing direction.
- **Enemy AI:** Ranged enemies only start a telegraphed volley when they have a clear line of fire; cover blocks their sight. Pathfinding searches a wider area for a safe navigable tile, and won't blindly steer directly into a wall when no path exists.
- **No new visuals, items, enemies, or level changes.** Existing character controls and saves continue to work.

### Regression coverage

Run `node --test tests/core-reliability.test.cjs` from a repository clone (Node.js 20+). The existing GitHub Actions workflow runs the expanded **16-test suite** on pushes to `main` and pull requests. Six new tests cover Mage target selection, projectile line-of-sight, arrow sweep ordering, Classic-only bat physics, unreachable enemy navigation, and timed enemy specials.

---

## V8.7 — Core reliability pass (no visual changes)

V8.7 stabilizes **five foundational systems** before the later visual overhaul:

- **Combat accounting:** Pit knockouts now count toward kills and award XP exactly once. They stay out of normal ground-loot/death-effect handling, avoiding unreachable drops and duplicate rewards.
- **Physics:** Sticky-wall impacts no longer apply elemental and magnetic reactions twice; floor safety checks inspect all four diagonal pit directions. Neutral and bouncy walls retain distinct collision responses.
- **Dungeon generation:** Each generated dungeon is checked for valid topology, reciprocal doors, a single boss, connected rooms, and unique coordinates. Generation retries malformed layouts. Saved breakable props are also checked against door-to-center routes and removed selectively if they block progression.
- **Bosses:** The victory handler now guards against being called twice, and the Phoenix rebirth handler tolerates a missing unit. The earlier final-hit HUD freeze fix remains in place.
- **Saves:** Failed storage writes retain their pending checkpoint instead of silently discarding it. The game retries after five seconds and gives explicit error feedback; successful writes clear the retry state.

### Regression tests

Run locally from a clone with Node.js 20 or newer:

```sh
node --test tests/core-reliability.test.cjs
```

The original ten dependency-free tests cover game syntax, **1,200 generated dungeon graphs**, **40 tile layout orientations**, pit reward idempotency, sticky/neutral/bounce wall physics, diagonal pit checks, stored prop clearance, boss final-hit/victory behavior, and save-write failure/retry. GitHub Actions also runs the suite on commits to `main` and pull requests.

The suite is designed to catch regressions; it does **not** prove every boss, item interaction, or full playthrough is bug-free. Continue playtesting on phones, especially complex fights and long runs.

---

## V8.2 Archer Dot

- **Choose a hero:** Start a fresh run as Classic Dot (the original silly bat) or Archer Dot (a bow). Each save slot remembers its own hero; old saves remain Classic Dot. Hero choice does not alter an existing save.
- **Pull-to-draw attack:** On Archer, the right attack stick aims the bow. The farther the stick is pulled from its center, the more powerful the shot. Release the stick to fire one arrow; tiny movements below 18% draw do not fire. The gold ring and percentage show charge strength.
- **Arrow scaling:** Draw strength changes arrow speed from about 292 to 620 world units/second, damage from about 1.26 to 3.8 before upgrades and critical hits, knockback from about 110 to 245, and flight duration from 0.91 to 1.4 seconds. A 0.48-second base reload prevents spamming; Bat Balance upgrades also accelerate bow reloading.
- **Physical arrows:** Arrows hit enemies, bosses, breakable objects, enemy nests, cracked walls, and trap levers. Weapon-hit item synergies work on arrow impacts too. Boss armour and special invulnerability mechanics still require their intended counters; shields remain available.
- **Classic is untouched:** Classic still uses the heavy physics bat, including its impact interactions and projectile reflections. Both heroes keep the hardcore 50-HP/three-life survival rules. Mage Dot is reserved for a later update.

## V8.1 safer and more varied teleporters

- **No entrance traps:** Portals are placed on safe interior floor, at least 125 units away from all four door spawn points (and clear of the center spawn), rather than directly beside the west/east entrances.
- **Actual random portals:** About 32% of regular combat layouts attempt a three-way purple random network, while most other combat rooms have two linked cyan portals. Some rooms deliberately have none. Cursed rooms favor random networks.
- **Safe placement:** Portal locations avoid pits, walls, moving-wall sweep paths, floor traps, narrow bridges, and other portals. A crowded layout can omit portals if there are not enough safe locations.
- **No ping-pong teleporting:** On arrival a body must leave the destination portal before teleportation rearms, even after the cooldown expires. This applies to players and enemies.
- **Stable layouts:** Portal placement is deterministic for each dungeon room, so revisiting a room or loading a cleared-room save does not reshuffle the portals.
- **Clearer visual distinction:** Linked portals are cyan and labeled LINK; random portals are violet, marked `?`, and labeled RANDOM.

The hardcore survival rules and V8.0 enemy combat overhaul are unchanged.

## V8.0 enemy overhaul

- **Distinct melee moves:** Veteran squares charge, rounds feint, armored foes telegraph devastating slams, splitters summon minions, and mergers rally nearby attackers. Healers and regenerators periodically heal nearby allies.
- **Elemental pressure:** Fire, water, electricity, poison, frost, gravity, magnetism, crystal, rubber, mirror, sponge, bomb, and bloodletter foes have their own timed pressure moves, each with a visible warning.
- **Counterplay:** Powerful attacks have approximately 0.5–1 second of windup and individual cooldowns. Strong bat hits interrupt most windups. Danger markers show locked targets or impending blast radii.
- **Ranged overhaul:** Most ranged enemies lock their aim before firing and use distinct volleys: double shots from shooters and bloodcasters, five-shot scatter fans, paired poison and frost projectiles, and predicted artillery landing zones. Lasers retain their separate charge warning.
- **Threat pacing:** At most two simultaneous melee/elemental windups in Dungeon 1, increasing to four in Dungeon 5. Ranged windups have a separate cap. Basic enemies become less dominant at greater depths (81% to 45% of random spawns) while elite odds rise from 7% to 15%.
- **Boss escalation:** Each main boss announces a one-time enrage ring at half health and hastens its next signature attack; existing phase-two patterns remain in place.
- **Bestiary:** Updated 30 enemy descriptions to explain the new moves, warnings, and counters.

The existing 50-HP, three-life rules, browser saves, room events, shield reflections, and practice room are retained.

## V7.9 hardcore survival

- **50 health, 3 lives:** Death respawns you at the current room entrance with full health and a reset encounter. The third death ends the run. The on-screen HUD tracks remaining lives, and a spent run cannot be continued from a saved checkpoint.
- **Scarce recovery:** Base regeneration is 0.6 HP/second (formerly 1.2), with reduced healing bonuses and Healing Flasks now restoring 20 HP. Non-summoned enemies independently have a 3% chance to drop an 8-HP heart and a 0.25% chance to drop an extra life. Breakable chests have a 2% extra-life chance. Lives cap at 5.
- **Real danger:** Standard melee contact deals 14 HP (formerly 8), regular ranged shots 11 HP (formerly 6), scatter shots 8 HP, and artillery impacts 22 HP. Several traps and hazards also hit harder. Abyss falls still cost 25 HP.
- **Boss milestones:** Boss health is reduced by 25% to shorten fights; boss attacks now deal 2.5× damage. Their attack patterns are unchanged, pending a separate enemy and special-attack overhaul.
- **Dungeon scaling:** Square rooms grow from 12 enemies on Dungeon 1 to 20 on Dungeon 5; rectangles from 16 to 28; large rooms from 20 to 36; cursed rooms from 22 to 38.
- **Save compatibility:** Existing browser saves default to three remaining lives. Life losses and gains are written immediately, even during an uncleared fight, to prevent restoring spent lives by reloading a checkpoint.

## V7.8 room encounters

- **Enemy nests:** Occasional destructible nest objectives in combat rooms. Nests spawn basic enemies until destroyed; reflected bullets, bat swings, and nearby barrel explosions can damage them. Clearing a room requires destroying any surviving nests.
- **Interactive traps:** Pressure plates trigger one spike lane when stepped on by a player or enemy, and levers trigger another when struck by the bat. Spike crushers damage enemies and the player. Cracked walls can be shattered with the bat, reflected bullets, or nearby explosive barrels. Controls re-arm after a cooldown.
- **Teamwork AI:** Plain melee enemies take flanking paths, some guard nearby ranged allies, ranged enemies seek cover behind plain bodies, and nearby basic enemies briefly retreat when an armored or elite ally falls. Existing obstacle avoidance remains active.
- **Dungeon events:** Random combat rooms can trigger an ambush, temporary earthquake gaps, a fleeing treasure dot, or an elite invasion. Events occur at most once per room and must resolve before the exit unlocks.

The update leaves the existing save version and cleared-room checkpoints compatible. No new graphics or external dependencies are required.
