'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {makeGameContext} = require('./game-context.cjs');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
const startup = 'requestAnimationFrame(frame)})();';

async function play(scenario, preview = true) {
  let finish, fail;
  const completed = new Promise((resolve, reject) => {finish = resolve; fail = reject});
  const context = makeGameContext(finish);
  context.check = (value, message) => assert.ok(value, message);
  context.fail = fail;
  if (preview) {
    context.adRequests = [];
    context.window.DungeonDotPreview = {
      postMessage: id => context.adRequests.push(id),
      reply(id, result) {this.onmessage({data: id + ':' + result})}
    };
  }
  for (const id of ['revive-offer', 'diamond-chest']) {
    const dialog = context.document.querySelector('#' + id);
    dialog.open = false;
    dialog.showModal = () => {dialog.open = true};
    dialog.close = () => {dialog.open = false};
  }
  const probe = `(async()=>{${scenario};report(true)})().catch(fail);`;
  assert.ok(script.includes(startup));
  vm.runInNewContext(script.replace(startup, () => probe + startup), context, {timeout: 3000});
  await completed;
}

test('gold is scarcer and the browser keeps the normal last-life outcome', {timeout: 5000}, async () => {
  await play(`
    const originalRandom = Math.random;
    Math.random = () => .44;
    check(enemyCoinReward({elite:false},0,0,false)===1,'regular drop below threshold');
    Math.random = () => .45;
    check(enemyCoinReward({elite:false},0,0,false)===0,'regular drop at threshold');
    check(enemyCoinReward({elite:true},1,0,true)===6,'elite, relic and cursed bonuses');
    Math.random = originalRandom;
    beginNewSlot(1,true);
    const shop=dungeon.find(room=>room.kind==='shop');enterRoom(shop.id,shop.doors[0].side);
    showShopPreviewActions();
    check(document.querySelector('#shop-preview-actions').hidden,'browser exposes test shop');
    lives=1;hp=0;over=true;resolvePlayerDeath();
    check(lives===0&&!document.querySelector('#revive-offer').open&&!resumableSave(readSlot(1).data),'browser last life failed');
  `, false);
});

test('two rewarded ads revive once and the first ad credit survives a saved run', {timeout: 5000}, async () => {
  await play(`
    beginNewSlot(1,true);
    const combat=dungeon.find(room=>room.kind==='combat');enterRoom(combat.id,combat.doors[0].side);
    lives=1;hp=0;over=true;resolvePlayerDeath();
    const bridge=window.DungeonDotPreview,dialog=document.querySelector('#revive-offer');
    check(dialog.open&&lives===0&&adRequests.length===0,'ad did not require opt-in');
    const bundle=watchReviveAds();bridge.reply(adRequests[0],'earned');await Promise.resolve();
    check(adRequests.length===2&&lives===0&&readSlot(1).data.progress.reviveAds===1,'the second ad did not follow the first');
    bridge.reply(adRequests[1],'skipped');await bundle;
    check(dialog.open&&lives===0&&progress.reviveAds===1,'skipping granted a life or lost credit');
    check(continueSlot(1)&&dialog.open&&progress.reviveAds===1,'failed to resume through checkpoint');
    const final=watchReviveAds();bridge.reply(adRequests[2],'earned');await final;
    check(adRequests.length===3&&lives===1&&hp===50&&!over&&!dialog.open,'revive did not grant one life');
    check(readSlot(1).data.progress.reviveUsed&&readSlot(1).data.lives===1,'life or used flag not saved');
    hp=0;over=true;resolvePlayerDeath();
    check(lives===0&&!dialog.open&&adRequests.length===3,'second revive was offered');
  `);
});

test('ending a revive offer cancels loading and ignores its stale ad callback', {timeout: 5000}, async () => {
  await play(`
    beginNewSlot(1,true);lives=1;hp=0;over=true;resolvePlayerDeath();
    const watching=watchReviveAds(),id=adRequests[0];
    endReviveOffer();window.DungeonDotPreview.reply(id,'earned');await watching;
    check(adRequests[1]==='cancel:'+id&&adRequests.length===2,'request was left running');
    check(lives===0&&!resumableSave(readSlot(1).data),'ended run was revived');
  `);
});

test('shop grants ad gold once and spends only Test Diamonds on the fixed reward', {timeout: 5000}, async () => {
  await play(`
    beginNewSlot(1,true);
    const shop=dungeon.find(room=>room.kind==='shop');enterRoom(shop.id,shop.doors[0].side);
    const bridge=window.DungeonDotPreview;
    const skipped=claimShopAd();bridge.reply(adRequests[0],'skipped');await skipped;
    check(!shop.adRewardClaimed&&progress.coins===0,'skipped ad paid out');
    const reward=claimShopAd();bridge.reply(adRequests[1],'earned');await reward;
    check(progress.coins===5&&shop.adRewardClaimed,'shop ad reward missing');
    check(continueSlot(1)&&currentRoom.adRewardClaimed&&progress.coins===5,'shop claim did not survive reload');
    await claimShopAd();check(adRequests.length===2&&progress.coins===5,'shop paid twice');
    const el=id=>document.querySelector('#'+id);
    p.x=W/2;p.y=F/2+100;
    updateEconomy(0);check(!el('shop-diamond-chest').hidden,'chest is unreachable');
    el('shop-diamond-chest').onclick();
    el('diamond-open').onclick();check(!previewWallet.gilded,'chest opened without diamonds');
    el('diamond-buy').onclick();check(previewWallet.diamonds===3&&progress.coins===5,'test purchase touched gold');
    el('diamond-open').onclick();el('diamond-open').onclick();
    check(previewWallet.diamonds===0&&previewWallet.gilded&&progress.coins===5,'chest was not a single diamond purchase');
    check(JSON.parse(localStorage.getItem(PREVIEW_WALLET_KEY)).gilded,'cosmetic was not stored');
  `);
});
