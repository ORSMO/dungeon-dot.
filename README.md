# Dungeon Dot

Landscape-first physics dungeon crawler. The game runs from `index.html`.

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
