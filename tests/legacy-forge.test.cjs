'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {makeGameContext} = require('./game-context.cjs');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptStart = html.indexOf('<script>') + '<script>'.length;
const source = html.slice(scriptStart, html.indexOf('</script>', scriptStart));
const startup = 'requestAnimationFrame(frame)})();';

function play(scenario) {
  let reported = false;
  const context = makeGameContext(() => { reported = true; });
  context.check = (value, message) => assert.ok(value, message);
  context.crypto = globalThis.crypto;
  const helpers = `
    function startBoss(id) {
      const room = dungeon.find(room => room.kind === 'boss');
      room.bossKind = id;
      enterRoom(room.id, room.doors[0].side);
      check(bossFight?.variant === id, 'Wrong boss: ' + bossFight?.variant);
    }
    function resolveBossTick() {
      inv = 10;
      movePlayerAwayFromBoss();
      updateBossFight(0, p.a);
    }
    function movePlayerAwayFromBoss() {
      p.x = 48;
      p.y = 48;
    }
    function earnMarks(count) {
      for (let i = 0; i < count; i++) {
        beginNewSlot(1, true);
        startBoss('gatekeeper');
        bossFight.units[0].hp = 0;
        resolveBossTick();
      }
    }
    function reachLevel(target) {
      while (progress.level < target) {
        progress.levelsThisDepth = 0;
        earnXp(2 * xpRequirement(progress.level));
      }
    }
    const balance = () => getLegacyForge().marks;
    const choice = () => document.querySelector('#element-choice');
  `;
  assert.ok(source.includes(startup), 'Game startup seam is available for simulation');
  vm.runInNewContext(source.replace(startup, () => helpers + scenario + '\nreport();' + startup), context, {timeout: 3000});
  assert.ok(reported);
}

test('only full boss encounters award one Boss Mark across both save slots', () => {
  play(`
    beginNewSlot(1, true);
    startBoss('slime');
    bossFight.units[0].hp = bossFight.units[0].maxHp / 2;
    resolveBossTick();
    check(bossFight.units.length === 2 && balance() === 0, 'Slime split awarded a Mark');
    bossFight.units[0].hp = 0;
    resolveBossTick();
    check(balance() === 0, 'Only one half was defeated');
    bossFight.units[1].hp = 0;
    resolveBossTick();
    check(balance() === 1, 'Full split encounter did not award exactly one Mark');
    flushCheckpoint();
    finishBossFight();
    check(continueSlot(1) && balance() === 1, 'Repeating or resuming a victory duplicated its Mark');

    beginNewSlot(2, true);
    check(balance() === 1, 'The second save slot did not share the profile balance');
    enterSandbox();
    check(spawnSandboxEnemy('boss:slime'), 'Practice boss failed to spawn');
    for (const unit of bossFight.units) unit.hp = 0;
    resolveBossTick();
    check(balance() === 1, 'Practice awarded a Mark');
    leaveSandbox();
    startBoss('phoenix');
    bossFight.units[0].hp = 0;
    resolveBossTick();
    check(bossFight.reborn && balance() === 1, 'Phoenix rebirth awarded a Mark');
    bossFight.units[0].hp = 0;
    resolveBossTick();
    check(balance() === 2, 'Full phoenix encounter did not award one Mark');

    earnMarks(2);
    check(balance() === 4, 'Repeated victories in fresh runs did not award new Marks');
    readProfile();
    check(balance() === 4, 'The Mark balance did not survive a profile read');
  `);
});

test('ten one-time upgrades obey their prices and the two-perk run snapshot', () => {
  play(`
    const upgradeIds = LEGACY_UPGRADES.map(upgrade => upgrade.id);
    check(upgradeIds.length === 10, 'Forge must contain ten upgrades');
    beginNewSlot(2, true);
    check(hp === 50 && lives === 3 && progress.coins === 0, 'Fresh start changed the base health, lives or gold');
    check(!!buyLegacyUpgrade('warChest') && balance() === 0, 'An upgrade could be bought with zero Marks');
    check(!!toggleLegacyUpgrade('warChest'), 'An upgrade could be equipped without ownership');
    earnMarks(LEGACY_UPGRADES.reduce((sum, upgrade) => sum + upgrade.cost, 0));
    for (const {id,cost} of LEGACY_UPGRADES) {
      const before = balance();
      check(!buyLegacyUpgrade(id) && balance() === before - cost, 'Wrong upgrade cost or ownership for ' + id);
      check(!!buyLegacyUpgrade(id) && balance() === before - cost, 'Repeat purchase charged again for ' + id);
    }
    check(getLegacyForge().unlockedUpgrades.length === 10, 'Ownership was not recorded');
    for (const id of getLegacyForge().equippedUpgrades) toggleLegacyUpgrade(id);
    const other = upgradeIds.filter(id => id !== 'warChest');
    check(!toggleLegacyUpgrade('warChest') && !toggleLegacyUpgrade(other[0]), 'Could not fill the two perk slots');
    check(!!toggleLegacyUpgrade(other[1]) && getLegacyForge().equippedUpgrades.length === 2, 'Three perks could be equipped');
    check(continueSlot(2) && progress.coins === 0 && progress.legacyPerks.length === 0, 'Purchases changed an existing run');
    beginNewSlot(2, true);
    check(progress.coins === 8 && progress.legacyPerks.length === 2, 'New run did not receive selected perks');
    check(!toggleLegacyUpgrade('warChest') && progress.legacyPerks.includes('warChest'), 'Unequipping changed a live run');
    check(continueSlot(2) && progress.legacyPerks.includes('warChest') && progress.coins === 8, 'Perk snapshot changed or starting gold paid twice');
  `);
});

test('starting perks produce the advertised combat effects and respect their limits', () => {
  play(`
    const near = (actual, expected) => Math.abs(actual - expected) < 1e-8;
    beginNewSlot(1, true);
    const normalSpeed = playerStats().moveSpeed;
    progress.legacyPerks = ['fleetfoot', 'fortifiedShield'];
    check(near(playerStats().moveSpeed, normalSpeed * 1.05) && near(playerStats().shieldProtection, .08), 'First-dungeon movement or shield bonus is wrong');
    dungeonDepth = 2;
    check(playerStats().moveSpeed === normalSpeed && !playerStats().shieldProtection, 'First-dungeon movement or shield bonus persisted');

    dungeonDepth = 1;
    progress.legacyPerks = ['sparePlating', 'secondWind'];
    check(bodyArmourStats().capacity === 14, 'Spare Plating did not grant two armour');
    check(requestDash() && near(dashCooldown(), DASH_COOLDOWN * .9), 'Second Wind did not reduce dash cooldown');
    dungeonDepth = 2;
    restoreDashState();
    check(bodyArmourStats().capacity === 12 && requestDash() && near(dashCooldown(), DASH_COOLDOWN), 'First-dungeon armour or dash bonus persisted');

    dungeonDepth = 1;
    progress.legacyPerks = ['fieldRations', 'coinfinder'];
    const combat = dungeon.filter(room => room.kind === 'combat');
    enterRoom(combat[0].id, combat[0].doors[0].side);
    coinDrops = [{x:p.x+30, y:p.y, amount:1}];
    updateEconomy(0);
    check(progress.coins === 1, 'Coinfinder did not extend pickup range');
    hp = 40;
    rewardRoom();
    check(hp === 46, 'Field Rations did not heal six HP');
    enterRoom(combat[1].id, combat[1].doors[0].side);
    hp = 40;
    rewardRoom();
    check(hp === 40, 'Field Rations healed twice');
    dungeonDepth = 2;
    coinDrops = [{x:p.x+30, y:p.y, amount:1}];
    updateEconomy(0);
    check(progress.coins === 1 && coinDrops.length === 1, 'First-dungeon pickup bonus persisted');

    selectedHero = 'archer';
    beginNewSlot(1, true);
    progress.legacyPerks = ['quickDraw', 'keenEye'];
    const shot = rangedWeaponShot('sling', .6);
    check(fireArrow(.6, 0) && near(arrows.at(-1).vx, shot.speed * 1.07) && near(bowShotCooldown, shot.reload * .9), 'Archer perks did not adjust actual shots');
    dungeonDepth = 2;
    bowShotCooldown = 0;
    check(fireArrow(.6, 0) && near(arrows.at(-1).vx, shot.speed) && near(bowShotCooldown, shot.reload), 'First-dungeon archer bonuses persisted');

    selectedHero = 'mage';
    beginNewSlot(1, true);
    progress.legacyPerks = ['preparedCasting'];
    const castCost = mageSpell('A').mana;
    for (let cast = 0; cast < 4; cast++) {
      mageMana = 100;
      mageGlobalReady = 0;
      mageCooldowns = {};
      check(castMageSpell('A') && mageMana === 100 - castCost + (cast < 3 ? 2 : 0), 'Prepared Casting discount did not apply exactly three times');
    }
    check(flushCheckpoint() && readSlot(1).data.progress.legacyPreparedCasts === 3, 'Mage discount usage did not persist');
  `);
});

test('a saved boss reward recovers once when the profile write fails', () => {
  play(`
    beginNewSlot(1, true);
    startBoss('gatekeeper');
    const write = localStorage.setItem;
    let blockProfile = true;
    localStorage.setItem = (key, value) => {
      if (blockProfile && key === PROFILE_KEY) throw Error('Simulated profile write failure');
      write(key, value);
    };
    bossFight.units[0].hp = 0;
    resolveBossTick();
    flushCheckpoint();
    check(balance() === 0, 'Unwritten Mark showed up as available');
    const checkpoint = readSlot(1).data;
    check(checkpoint.dungeon[checkpoint.roomId].bossDefeated && checkpoint.progress.legacyBossDepths.includes(1), 'Checkpoint omitted the recoverable reward');
    blockProfile = false;
    readProfile();
    reconcileBossMarks();
    check(balance() === 1, 'Saved reward could not be recovered');
    reconcileBossMarks();
    check(continueSlot(1) && balance() === 1, 'Recovered Mark was paid out again');

    earnMarks(1);
    blockProfile = true;
    check(!!buyLegacyUpgrade('warChest') && balance() === 2 && !getLegacyForge().unlockedUpgrades.length, 'Failed purchase changed ownership or balance');
    blockProfile = false;
    check(!buyLegacyUpgrade('warChest') && balance() === 0, 'Purchase did not retry safely');
  `);
});

test('new locked runs get ordinary level stats, while opened branches unlock per hero and persist', () => {
  play(`
    const expected = {classic:'sword',archer:'bow',mage:'arcane'};
    for (const [character,id] of Object.entries(expected)) {
      selectedHero = character;
      beginNewSlot(2, true);
      const base = playerStats().damage;
      reachLevel(3);
      check(choice().hidden && !levelChoicePending(), 'Locked level 3 showed a choice for ' + character);
      reachLevel(8);
      check(!hasEvolved() && playerStats().damage > base && !/EVOLVED/.test(document.querySelector('#item-notice').textContent), 'Locked level 8 lost stats or triggered evolution');
      check(!!buyLegacyEvolution(id) && balance() === 0, 'Evolution bypassed its cost');
    }

    earnMarks(15);
    for (const [character,id] of Object.entries(expected)) {
      const before = balance();
      check(!buyLegacyEvolution(id) && balance() === before - 5, 'Evolution did not cost five Marks for ' + character);
      check(!!buyLegacyEvolution(id) && balance() === before - 5, 'Duplicate evolution changed the balance');
    }
    check(continueSlot(2) && progress.legacyEvolutions.length === 0 && !hasEvolved(), 'New purchases changed an existing run');

    for (const [character,id] of Object.entries(expected)) {
      selectedHero = character;
      beginNewSlot(2, true);
      reachLevel(3);
      check(!choice().hidden && levelChoicePending(), 'Available level 3 choice was missing for ' + character);
      for (const locked of evolutionChoices(character).map(([key]) => key).filter(key => key !== id)) {
        check(!(character === 'mage' ? selectMageSchool(locked) : selectWeapon(locked)), 'Locked branch could be selected');
      }
      check(character === 'mage' ? selectMageSchool(id) : selectWeapon(id), 'Unlocked branch could not be selected');
      reachLevel(8);
      check(hasEvolved(), 'Unlocked and picked branch failed to evolve for ' + character);
      queueCheckpoint();
      flushCheckpoint();
      check(continueSlot(2) && hasEvolved(), 'The evolved form was not preserved for ' + character);
    }
    const oldSave = JSON.parse(localStorage.getItem(slotKey(2)));
    delete oldSave.progress.legacyEvolutions;
    delete oldSave.progress.legacyPerks;
    localStorage.setItem(slotKey(2), JSON.stringify(oldSave));
    check(continueSlot(2) && hasEvolved() && progress.mageSchool === 'arcane', 'Old checkpoint lost its branch or evolution');
  `);
});
