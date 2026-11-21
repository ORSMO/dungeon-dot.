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
    p.x=shop.loot[0].x;p.y=shop.loot[0].y;updateEconomy(0);
    check(document.querySelector('#loot-watch-ad').hidden,'browser exposes test ad');
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

test('a shop ad grants the selected item once, and the chest uses only Test Diamonds', {timeout: 5000}, async () => {
  await play(`
    beginNewSlot(1,true);
    const shop=dungeon.find(room=>room.kind==='shop');enterRoom(shop.id,shop.doors[0].side);
    const bridge=window.DungeonDotPreview;
    const el=id=>document.querySelector('#'+id);
    const item=shop.loot[2],heal=shop.loot[3];p.x=heal.x;p.y=heal.y;updateEconomy(0);
    check(el('loot-watch-ad').hidden,'full health flask shows an ad');
    p.x=item.x;p.y=item.y;progress.coins=4;updateEconomy(0);
    check(el('loot-take').disabled&&!el('loot-watch-ad').hidden,'low gold prevents a free ad offer');
    const skipped=claimShopAd();bridge.reply(adRequests[0],'skipped');await skipped;
    check(!shop.adRewardClaimed&&!item.claimed&&progress.coins===4,'skipped ad paid out');
    progress.coins=60;updateEconomy(0);
    const reward=claimShopAd();
    check(!takeNearbyLoot(),'gold purchase went through while ad was active');
    bridge.reply(adRequests[1],'earned');await reward;
    check(progress.coins===60&&shop.adRewardClaimed&&item.claimed&&itemCount(item.key)===1&&!shop.loot[0].claimed,'shop rewarded the wrong item, wrong currency or too many items');
    check(continueSlot(1)&&currentRoom.adRewardClaimed&&currentRoom.loot[2].claimed&&progress.coins===60,'shop claim did not survive reload');
    p.x=currentRoom.loot[0].x;p.y=currentRoom.loot[0].y;updateEconomy(0);
    check(el('loot-watch-ad').hidden,'another ad was offered after reload');
    await claimShopAd();check(adRequests.length===2&&progress.coins===60,'shop paid twice');
    p.x=W/2;p.y=F/2+100;
    updateEconomy(0);check(!el('shop-diamond-chest').hidden,'chest is unreachable');
    el('shop-diamond-chest').onclick();
    el('diamond-open').onclick();check(!previewWallet.gilded,'chest opened without diamonds');
    el('diamond-buy').onclick();check(previewWallet.diamonds===3&&progress.coins===60,'test purchase touched gold');
    el('diamond-open').onclick();el('diamond-open').onclick();
    check(previewWallet.diamonds===0&&previewWallet.gilded&&progress.coins===60,'chest was not a single diamond purchase');
    check(JSON.parse(localStorage.getItem(PREVIEW_WALLET_KEY)).gilded,'cosmetic was not stored');
  `);
});

test('a saved three-slot shop gains one distinct relic and reprices only unsold stock', {timeout: 5000}, async () => {
  await play(`
    beginNewSlot(1,true);
    const shop=dungeon.find(room=>room.kind==='shop');enterRoom(shop.id,shop.doors[0].side);
    shop.loot=shop.loot.filter(loot=>loot.id!=='shop-item-2');
    shop.loot.forEach((loot,i)=>{loot.price=[20,12,8][i]});
    shop.loot[0].claimed=true;progress.coins=49;shop.adRewardClaimed=true;
    const original=shop.loot.map(({id,key,price,claimed})=>({id,key,price,claimed}));
    queueCheckpoint();flushCheckpoint();check(continueSlot(1),'old three-slot shop did not load');
    const saved=readSlot(1).data.dungeon[shop.id],newRelic=saved.loot[2];
    check(saved.loot.length===4&&newRelic.id==='shop-item-2'&&newRelic.kind==='item'&&newRelic.price===50&&!newRelic.claimed,'second relic was not saved immediately');
    check(newRelic.key!==original[0].key&&progress.coins===49&&saved.adRewardClaimed,'stock repeated an item or reset the balance or ad reward');
    for(const record of original){
      const {id,key,price,claimed}=saved.loot.find(loot=>loot.id===record.id);
      check(key===record.key&&claimed===record.claimed&&(claimed?price===record.price:price>record.price),'migration replaced a shop offer, reopened a sold item or charged a stale price');
    }
    check(continueSlot(1)&&currentRoom.loot[2].key===newRelic.key,'reloading rerolled the stock');
    p.x=newRelic.x;p.y=newRelic.y+12;updateEconomy(0);
    check(!takeNearbyLoot()&&progress.coins===49,'relic was sold for less than the posted price');
    progress.coins=50;updateEconomy(0);
    check(takeNearbyLoot()&&readSlot(1).data.progress.coins===0,'checkout did not charge the posted price');
  `);
});
