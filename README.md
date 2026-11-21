# Dungeon Dot

Landscape-first physics dungeon crawler. Open `index.html` with the `art/` folder alongside it.

## Android preview

Open `android/` in Android Studio, or run the commands below from this repository with Java 17, Gradle 8.13, Android SDK Platform 36 and Build Tools 35.0.0.

```sh
node --test
gradle -p android :app:lintDebug :app:assembleDebug :app:bundleRelease
```

The Android app bundles the same `index.html` and opens in landscape. Its save slots live inside the app. The test APK appears in `android/app/build/outputs/apk/debug/` as **Dungeon Dot Preview**. The release bundle appears in `android/app/build/outputs/bundle/release/` and needs release signing before a Play Console upload. The preview has its own app ID, so its save data belongs to the preview installation.

## V8.56 — Loot presentation

The nearby item panel now shows painted flask and relic art, keeps the purchase button easy to tap, and gives rare finds a distinct border. Small item plaques appear near visible pedestals and give way to the full card when an item is within reach.

## V8.55 — Visual consistency

Painted portraits and weapon artwork now accompany the level-three choices. The Enemy Index, loot, notices, the practice panel, the control-position editor, the privacy dialog and the landscape prompt use the same bronze, parchment and dungeon artwork as the main menus. Boss notices sit beneath the arena action so they leave the boss bars clear.

Enemy windups, boss landing zones and artillery use a shared visual style with dark outlines and colors suited to each effect. Dashed edges identify warnings, solid edges identify active hazards, and timed attacks show progress around the edge.

## V8.54 — Boss and trap feedback

Boss charges, crashes, landings, volleys, beams, lightning and other signatures now sound as they go off. Dashed aim lines show the actual projectile fan just before the Gatekeeper family, Crystal Eye, Spore Matriarch or Prism Oracle fires. Cinder Hydra keeps its three breath lanes.

Wall bolts, swinging chains, spilled embers and rising floor spikes now have distinct activation sounds. The existing danger warnings still play before the attacks. Damage and attack timings are unchanged.

## V8.53 — Enemy attack audio

Regular enemies now have sound cues for charge and spell windups, ranged shots, laser warmup and fire, and bomb fuses and explosions. The seven projectile families have distinct launch sounds. Cannon fire, artillery impacts, and Root Guard patches also have cues. Nearby windups sound once per attack and repeated cues are rate-limited in crowds. The Sound Effects setting controls these cues.

Run `node --test tests/enemy-attacks.test.cjs` to check regular enemy attacks and all 12 boss signatures in both phases against Stick, Sling, and Apprentice.

## V8.52 — Boss shields

Every boss encounter starts with a single shield. It absorbs 50 damage in Dungeon 1, 75 in Dungeon 2, and 112.5 in Dungeon 3, increasing by 50% per dungeon. Damage uses up the shield before reaching the boss's usual defenses. The shield belongs to the encounter and is shared across split phases or rebirth. The boss HUD and Enemy Index show shield capacity separately from HP.

## V8.51 — Bosses keep attacking

Boss stun states have been removed. Gatekeeper bosses briefly expose their guard after finishing a charge or taking a returned projectile. Returned projectiles, knocked-back minions and broken armor keep their damage or vulnerability effects. They no longer interrupt a boss's current attack. Boss contact remains dangerous during recovery.

## V8.50 — Beyond the Torchlight

The title screen plays an original 58-second stereo instrumental arranged for flute, plucked strings, low bowed strings and bells. The track loops after the first interaction and fades into dungeon audio when a run begins. The Music and ambience slider controls it, and the soundtrack is bundled for offline Android play.

## V8.49 — Monster defeat sounds

Regular, stone-armored and spectral monsters have different defeat sounds. Elites use a heavier hit, and pit or lava falls have their own cues. Simultaneous defeats share a cue so the feedback stays clear during crowded fights.

## V8.48 — Title music, boss phases and danger cues

The main menu has a quiet title theme that starts after the first interaction and fades into the current dungeon's music when play begins. Each biome has a separate boss arrangement. Boss fights have entrance and phase cues, with extra percussion added in the final phase without restarting the track.

The victory recap, a lost life, and the end of a run each have their own cue. Boss windups, nearby artillery and traps have short warning sounds that briefly lower the music. Shield blocks and damage taken have distinct sounds. The existing Master, Sound effects, Music and ambience, and Mute settings control the new audio.

## V8.47 — Combat audio, dungeon feedback and music

Each melee weapon has its own swing and impact cues. Bows, crossbows, slings and javelins have distinct releases, and the five Mage paths have different cast sounds. Gates, portals, breakable props, coins, item pickups, level-ups and room clears have their own audio feedback.

Each biome has an original procedural score and ambience, with faster music during boss fights. The Sound screen's Master, Sound effects, Music and ambience, and Mute settings control the mix. Audio starts after an interaction, and music softens while menus are open. The game generates sound locally both on the web and in the Android app.

## V8.46 — In-run menus

The Character window groups current stats, collected items, run records and the Mage spellbook into separate pages. The character portrait and menu backgrounds use the painted artwork. Pause, Controls and Sound use the same bronze-trimmed layout, with larger buttons and scrollable panels for short landscape screens. The Controls page previews joystick size and opacity as you adjust them. Existing control and audio settings continue to load from the same saved preferences.

## V8.45 — Painted pots and enemy nests

Breakable clay pots have a painted terracotta sprite. Enemy nests show twisted roots and larger amber eggs that stand out on the dungeon floor. A nest's health bar appears nearby or when it takes damage. Pot breakage and nest behavior follow the existing rules.

## V8.44 — Open and closed gates

Dungeon gates use their painted frames without bright rectangular outlines. Locked routes show closed doors and a padlock on the destination sign. When a route unlocks, the panels slide apart to reveal the passage. Cleared rooms show their gates already open on return, and reduced-motion mode opens them immediately.

## V8.43 — Enemy projectiles

Enemy shots and boss volleys have distinct silhouettes: sharp ice shards, smoky embers, poison globes, blood fangs, homing eyes, bolts and iron cannonballs. Reflected shots keep their shape and gain a gold outline. Artillery has a landing marker that fills as the shell approaches.

The colored projectile bodies are sized to their existing hit radii. Trails are short, faint, and hidden in reduced-motion mode. Damage, projectile movement, and reflection follow the existing rules.

## V8.42 — Spell and impact effects

Rune Apprentice spells use etched seals. Summoner magic uses spirit trails, Necromancer spells use bone shards and grave markings, Pyromancer casts use embers, and Arcane spells use geometric lines. Icy spells retain their own markings. Friendly spell fields draw beneath hostile warnings, and the shorter boss panel leaves more room on phones.

Sword hits show a quick slash and a bleed marker. Bat hits show the direction of impact, flail hits have a heavier burst, and spear tips and shafts have distinct effects. Ranged hits, guard blocks, and hits taken by the player have their own cues. Reduced-motion mode keeps the main hit shapes and omits moving impact particles. Combat stats, timing, and save data follow the existing rules.

## V8.41 — Portal and rune effects

Room portals sit in painted stone and bronze rings. Linked and random portals have distinct sigils and colors. Stepping through sends a pulse from the entrance and gathers sparks at the exit.

Mage rune buttons use engraved bronze medallions. Tracing a spell lights each rune and draws a glowing line between them. Successful casts send a gold pulse through the chosen runes, and an invalid trace flashes red. Reduced-motion mode uses steady glows and fades. Portal destinations, gesture timing, spell costs and save compatibility follow the existing game rules.

## V8.40 — Dungeon maps and room details

The floor map has distinct symbols for the start, boss, cursed, treasure and shop rooms. The room map uses each world's colors and shows walls, bridge decks, pits, lava and portals. Door signs show the destination and a padlock while the route is locked.

Pressure plates, levers, enemy nests and the local compass use painted art. Interaction prompts appear as you approach a ready plate or lever, and nest health becomes visible nearby or after taking a hit. The interaction and combat rules use the existing game logic.

## V8.39 — Wall fixtures and swimmable lava

Dungeon walls share ordinary collision behavior and the biome's masonry. Combat rooms can have exposed fixtures away from doorways and bridges. Permanent spikes apply 2 base HP of bleed over 2 seconds on contact, with one active spike bleed at a time. Hit a chain or knock an enemy into it to swing it through the room. Break a brazier to spill hot coals. Bolt launchers show their lane before firing, and weapon hits can fire them early or disable them. Cracked masonry opens a passage that stays open on reentry and in checkpoints.

In the Ember Crucible, pits contain lava. Walking or being knocked in applies burn damage while the player swims at 62% of normal movement speed. Lava deals 3 base HP on entry and every 0.65 seconds while submerged. Use the normal movement controls to reach a bank or bridge. Ordinary pits in the other biomes keep their existing behavior. Existing saves stay compatible.

## V8.38 — Textured walls

Walls now use weathered stone, soot-darkened iron, mossy limestone or frost-covered slate to match each biome. Bounce, spike, sticky and bone walls have their own material textures. Beveled edges and soft shadows distinguish walls from the floor, and the textures continue across connected pieces.

## V8.37 — Continuous walls and bridges

Touching walls of the same material share masonry and a single outer edge. Bridges use planks and rails that continue across adjoining tiles. Art is clipped to the original footprints, and moving, breakable and special walls retain distinct markings.

## V8.36 — Painted character shield

The melee shield now has curved blue enamel plates, bronze rivets, and a painted crest. Blocks catch the light, low durability shows cracks, and a broken shield shows only dim fragments. The combat HUD mirrors these states. Shield coverage, durability and refill rules use the existing mechanics.

## V8.35 — Painted combat HUD

Floating HUD panels now use painted bronze trim, gemstone resource icons and engraved controls. The enemy count keeps its icon and number, and Map, Character and Pause have their own illustrations. Boss portraits, map headings and touch controls share the same metalwork.

## V8.34 — Distinct enemy artwork

Every enemy in the 47-entry Enemy Index has its own painted sprite, including all 12 bosses. Combat, practice and the Enemy Index use the same artwork for each creature. Minions, hybrids and elite enemies still use their existing combat indicators.

This completes the visual pass for weapons, dungeon props, combat HUD and enemy portraits.

## V8.33 — Floating combat controls

The dungeon status strip is replaced by a painted enemy icon and a live count, including living boss units. The arena extends behind the controls, and Map, Character and Pause sit together in the upper corner. Fullscreen, the Test Room, and Main Menu are in Pause.

Passive health regeneration pauses while bleeding and resumes when it ends. Existing save files load without applying their old regeneration toggle.

## V8.32 — Combat HUD and minimaps

The HUD groups health, lives, class resources, and run counters. Bosses have portraits beside their health and attack hints. The floor map highlights the current room, and the local map shows player facing. Use **Map** to hide or show both maps. For Mage, the local map stays on the left to keep rune controls clear.

## V8.31 — Painted doors, traps and loot

Each biome has painted gates with readable route or lock signs. Trap grates distinguish idle, warning and active states and show painted spikes when they can deal damage. Bridges, chests, crates, barrels, coins, hearts, extra lives and loot stands have painted sprites. Room topology, trap timing and pickup rules are unchanged.

## V8.30 — Painted weapons and combat effects

Each melee and ranged weapon has painted art sized to its combat geometry. Flail links follow the moving head, ranged weapons show their current draw, and players can see swing trails and brief impact sparks. Attack ranges, damage and timing use the existing gameplay rules.

## V8.29 — Hero and enemy names

The three starter heroes are Squire, Scout and Rune Apprentice. Their evolutions and the original enemies use names that match their painted designs. Hero paths, weapon IDs and creature records are still stored under the same keys, so older runs and discovered enemies carry forward.

## V8.28 — Illustrated journal and victory recap

The Enemy Index uses the selected enemy's biome artwork behind its portrait and keeps the depth control, damage breakdown and discovery records. Victory has a new sunrise illustration. Sound, controls, character, privacy and evolution panels share the main menu's colors and typography.

## V8.27 — Main menu

The title screen has new painted key art and quick access to continuing a run, starting a new one, the Enemy Index and sound settings. Hero selection and save slots have dedicated screens. Continue opens the last playable checkpoint when there is no active run. Replacing an occupied slot still requires confirmation.

## V8.26 — Painted Realms

Original painted environments replace the procedural floors in all four biomes. The game draws painted hero, enemy and boss sprites, and the title screen has illustrated key art. Animated movement, impact flashes and ground markers help keep characters readable as you fight. The Android packages bundle and verify the same artwork as the browser version. Existing runs load from the same saves.

## V8.25 — Four Worlds

Each biome has its own floor materials, architecture, boss-room seal and HUD accents. The Old Dungeon is a torchlit keep, Ember Crucible an iron foundry, Verdant Hollow an overgrown abbey, and Frostbound Vault an ice cathedral. The menus, enemy index and victory recap take their style from medieval manuscripts. Hero portraits show clothing and gear for their path.

Existing saves select their world art from the saved biome.

## V8.24 — Dungeon victory

Defeat the third dungeon boss to win the run. The recap records your current hero path, deepest dungeon, remaining lives, biggest impact, and biggest damage burst (the most HP one enemy lost in a single frame). Choose **Continue deeper** to use the boss room exits and enter Dungeon 4, or **Save and return to menu** to keep the run for later.

The victory uses the existing save slots. A saved run past Dungeon 3 already counts as a victory. A saved run in the cleared Dungeon 3 boss room can see the recap on load. Test Room bosses do not count.

## V8.23 — Automatic level 8 evolution

The Android closed beta includes an offline privacy policy accessible from the start menu and Settings. The public policy is in [PRIVACY.md](PRIVACY.md). This build has no advertising or analytics. Release bundles use the private upload key retained outside this repository, with Google Play App Signing handling distribution signatures.

At level 8, your current form evolves automatically and the HUD shows **EVOLVED**. The boost is +5 maximum HP, +15% damage, +8% movement speed, +10% swing, reload or cast speed, +10% knockback, +0.15 HP per second and +5 percentage points of damage reduction. Mage also gains +10 maximum mana and +1 mana per second. Existing stat caps apply.

The level 8 reward no longer opens a choice. Saved runs at level 8 or above receive the boost on load and retain previously acquired elements. The Test Room’s XP button can trigger the evolution in practice.

## V8.22 — Apprentice rune combos

Apprentice Dot starts with the basic **A**, **B**, and **C** spells, all six two-rune combos, and **ABC** as the only three-rune combo. Choosing a school at level 3 equips that school’s combos and keeps the three basic spells.

- **AB Rune Burst** (16 mana) pushes back a group. **AC Twin Bolts** (14) fires two angled shots. **BA Force Lance** (16) pierces one enemy.
- **BC Snare Field** (15) slows up to two enemies. **CA Ward Rune** (16) absorbs 25% of the next direct hit within 4.5 seconds. **CB Gathering Sigil** (17) pulls foes together.
- **ABC Arcane Wave** (34) charges a ring around the casting point, then damages and knocks enemies back.

## V8.21 — Complete magic school spellbooks

Every school now has all six two-rune and all six three-rune spells, plus the three Apprentice spells. The full school spellbook opens when you choose your evolution at level 3. The new spells appear in **Stats & Items** in existing school saves.

- **Summoner:** **BA** Spirit Dart, **AC** Recall, **CA** Guardian Step, **CB** Twin Hunt. **ACB** Spirit Relay attacks from your summons’ positions, **BAC** Spirit Stampede clears lanes, **BCA** Sanctuary protects an area, **CAB** Astral Lure draws in enemies, and **CBA** Grand Conjuration empowers familiars.
- **Necromancer:** **BA** Bone Spear, **AC** Grave Snare, **CA** Bone Guard, **CB** Soul Rend. **ACB** Grave Dominion detonates corpses, **BAC** Reaper’s Scythe cleaves marked targets, **BCA** Ossuary raises barricades, **CAB** Haunt sends a shade after one target, and **CBA** Soul Harvest marks a group and can collect a Soul.
- **Pyromancer:** **BA** Cinder Shot, **AC** Wall of Fire, **CA** Backdraft, **CB** Flashpoint. **ACB** Firestorm consumes nearby flame patches, **BAC** Scorching Ray fires a single beam, **BCA** Phoenix Guard retaliates when hit, **CAB** Volcanic Fissure erupts in sequence, and **CBA** Wildfire spreads burns.
- **Arcane Mage:** **BA** Prism Shot, **AC** Mirror Rune, **CA** Slow Field, **CB** Displace. **ACB** Rift Gate redirects three bolt casts, **BAC** Orbiting Shields intercepts shots, **BCA** Phase Anchor returns you to a safe starting point, **CAB** Arc Chain jumps between targets, and **CBA** Stasis Field restrains regular enemies.

Run `node --test` from the repository root to verify the game, including the effects of all 36 new combinations.

## V8.20 — Level-up choice on short screens

The level-up menu fits weapon and school choices across one row on short, wide screens so every card can be tapped. On narrower screens the menu can scroll within the viewport.

## V8.19 — Apprentice and magic schools

New Mage runs begin as **Apprentice Dot** with **A** Magic Bolt, **B** Binding Rune, and **C** Force Pulse. Choose a school at level 3. Each school keeps the basic spells and unlocks these three recipes:

- **Summoner Dot:** **AB** Conjure Familiar (18 mana), **BC** Pack Command (14), **ABC** Guardian Pact (40). Keep up to two familiars, coordinate their strikes, and place a projectile-blocking guardian.
- **Necromancer Dot:** **AB** Grave Mark (14), **BC** Corpse Burst (18), **ABC** Raise the Fallen (32). Earn up to three Souls from marked kills or every three hits on a marked boss. Detonate a visible corpse or spend a Soul. Raise one skeleton per Soul spent.
- **Pyromancer Dot:** **AB** Fire Lance (17), **BC** Flame Trail (20), **ABC** Meteor Drop (45). Burn enemies with piercing shots or fire left along your path, then detonate burning targets with the meteor.
- **Arcane Mage Dot:** **AB** Ricochet Orb (17), **BC** Blink (19), **ABC** Gravity Well (42). Hold the movement stick to aim a bank shot or steer Blink. Blink stops at obstacles and leaves an explosive decoy.

Open **Stats & Items** for the current spellbook and use **+100 XP** in the Test Room to try a school. New runs save the chosen school and stored Souls. Mage runs saved before this release keep their original 15 spells and element choices.

## V8.18 — Melee damage and body armour

Stick, Sword, Bat, Mace and Spear gain 0.5 base damage on light and heavy hits against enemies and bosses. Spear's shaft still deals 45% of its tip damage.

The melee path starts each room with 12 body armour durability. It absorbs 25% of incoming damage after passive reductions, and each point absorbed costs one durability. Hits fully blocked by the curved shield bypass body armour. **Reinforced Plates** adds 4 durability per rank at room entry, while **Armour Padding** adds 5 percentage points of absorption per rank. Each upgrade caps at five ranks and can appear in shops and room rewards. In the Test Room, **Heal / revive** also refills body armour.

## V8.17 — Practice XP

Use **+100 XP** in the Test Room's spawn menu to try level-up rewards. Practice levels can go up to 30 without the dungeon's two-level limit. Leaving the Test Room restores your run's XP, level, weapon, and elements.

## V8.16 — Solid curved shield

The melee path's curved guard stops enemy bodies across its front arc. Melee impacts and grounded boss contact wear down the shield. A blocked hit spares your health even when that hit breaks the guard. Enemies can still hit from an exposed angle. The guard refills when you enter another room.

## V8.15 — Stick and Sling weapon paths

Pick one weapon at level 3 for the rest of the run.

- **Stick Dot** starts with a short, light melee weapon. **Sword** swings faster and wider and applies a three-second bleed that refreshes on hit. **Bat** has extra knockback and deals 50% more direct damage with its dash sweep. **Mace** swings a heavy ball on a trailing chain and deals damage where the ball connects. **Spear** has the longest reach and its shaft deals 45% of the tip's damage.
- **Sling Dot** starts with short-range stones. **Bow** rewards a full draw with more range and damage. **Crossbow** fires a full-power bolt from any valid draw and reloads slowly. **Javelin** has shorter range and can pierce up to three enemies before item bonuses.
- Runs start with 50 HP and three lives. Each dungeon grants at most two levels. Banked XP can advance levels when you next earn XP on a new dungeon floor.
- Mage keeps its spells and level 3 and level 8 elements. Existing saves keep their acquired elements. An older melee or ranged save at level 3 or above can choose its weapon when resumed.

## V8.14 — Classic dash attack

Classic is invulnerable while dashing. The bat hits as it travels even during a steady hold and deals **50% more direct damage** while the dash moves. Each target can take one boosted hit per dash. A wall or pit edge can stop the dash early, and bosses still require their usual openings.

## V8.13 — Enemy Index stats

Open **Enemy Index** from the start screen or in-game settings. The HP slider updates every visible tile and the selected card. Dungeon 14+ is the cap for HP scaling. Enemy cards include standard and elite HP, damage by attack, status effects, and body stats. Boss cards also show armour plates, split health or rebirth HP where applicable, and signature damage. Damage is shown before shields or damage reduction. Use **Show undiscovered stats** to inspect entries early without changing your encounter records.

## V8.12 — Boss signature attacks

| Boss | Signature |
| --- | --- |
| Gatekeeper | Crown Cleave sweeps a wide arc. Dodge behind it and attack during the stun. |
| Crystal Eye | Shard Carousel sends out staggered bullet rings with a marked gap. |
| Slime King | Royal Ripple throws slow waves of globules. The split halves take turns. |
| Furnace Warden | Forge Cross cuts across two marked lanes, then adds a diagonal at low HP. |
| Cinder Hydra | Hydra Barrage rolls bullet walls down the room with a marked passage. |
| Ash Phoenix | Ashwing Salvo fires two wings of bullets with a gap through the middle. |
| Briar Colossus | Thorn Scythe reaches farther, with two sweeping arcs at low HP. |
| Spore Matriarch | Spore Minefield blooms across marked patches in sequence. |
| Mire Twins | Twin Riptide leaves a dry corridor between two incoming waves. |
| Glacier Knight | Ice Guillotine cuts along successive diagonals, adding a third lane at low HP. |
| Prism Oracle | Sky Verdict drops sequential lightning bolts on marked ground. |
| Avalanche Golem | Boulder Trail drops rocks down a staggered path across the arena. |

Signatures begin between normal attacks. The ground previews show where damage will land, and the boss HUD names the active move. Bosses with Crystal Eye armor can also lose a plate to a strong arrow without a reflection item. Gatekeeper variants are safe to approach during their stun.

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
