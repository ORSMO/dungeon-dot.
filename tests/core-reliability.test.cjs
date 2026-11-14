'use strict';
// Run from the repository root: node --test tests/core-reliability.test.cjs
// No dependencies beyond Node.js 20+.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('<script>');
const end = html.indexOf('</script>', start);
assert.ok(start >= 0 && end > start, 'The standalone game script must exist.');
const source = html.slice(start + '<script>'.length, end);

function declaration(name) {
  const from = source.indexOf('const ' + name + '=');
  assert.ok(from >= 0, 'Missing declaration ' + name);
  const to = source.indexOf(';\n', from);
  assert.ok(to > from, 'Missing declaration terminator: ' + name);
  return source.slice(from, to + 1);
}
function method(name) {
  const from = source.indexOf('function ' + name + '(');
  assert.ok(from >= 0, 'Missing function ' + name);
  const open = source.indexOf('{', from);
  let depth = 0, quote = null;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === String.fromCharCode(96)) { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(from, i + 1);
  }
  throw new Error('Unclosed function ' + name);
}
function run(parts, result) {
  return new Function(parts.concat(['return (' + result + ');']).join('\n'))();
}

test('standalone game script parses without syntax errors', () => {
  assert.doesNotThrow(() => new Function(source));
});

test('1,200 generated dungeons have reciprocal doors, unique coordinates and reachable bosses', () => {
  const result = run([
    declaration('ROOM_SHAPES'), declaration('DIRECTIONS'), declaration('CURSE_TYPES'),
    'const selectedBiome=null;',
    method('addSpecialRooms'), method('generateDungeon'), method('validateDungeonTopology'),
    'let valid=0;const lengths=new Set();',
    'for(let i=0;i<1200;i++){const rooms=generateDungeon();lengths.add(rooms.length);if(validateDungeonTopology(rooms))valid++;}',
    'const corrupted=generateDungeon();corrupted[1].doors[0].side="INVALID";'
  ], '{valid,lengths:[...lengths],rejectsInvalid:!validateDungeonTopology(corrupted)}');
  assert.equal(result.valid, 1200);
  assert.equal(result.rejectsInvalid, true);
  assert.ok(result.lengths.every(n => n === 12 || n === 13));
});

test('all 40 tile layout orientations keep the four entry points connected', () => {
  const layout = source.slice(source.indexOf('const ROOM_LAYOUTS='), source.indexOf('// Portal layouts are generated'));
  const result = run([
    'const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));let W=480,F=480,walls=[],holes=[];',
    layout,
    'let tested=0,failed=[],voidTiles=0;',
    'for(const shape of ["square","big","wide","tall"])for(let layoutId=0;layoutId<10;layoutId++){',
    ' W=shape==="square"?480:shape==="big"?720:shape==="wide"?760:440;',
    ' F=shape==="square"?480:shape==="big"?720:shape==="wide"?440:760;',
    ' walls=[];holes=[];floorGaps=[];floorBridges=[];floorTraps=[];',
    ' setupRoomVariant({kind:"combat",shape,id:layoutId,layoutId});voidTiles+=floorGaps.length;',
    ' const step=12,nx=Math.ceil(W/step),ny=Math.ceil(F/step);',
    ' const pass=(x,y)=>x>=0&&y>=0&&x<nx&&y<ny&&safeFloor(x*step+step/2,y*step+step/2,9);',
    ' const anchors=[[W/2,62],[62,F/2],[W-62,F/2],[W/2,F-62],[W/2,F/2]];',
    ' const start=[Math.floor(W/2/step),Math.floor(62/step)],queue=[start],seen=new Set([start[1]*nx+start[0]]);',
    ' for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){',
    ' const xx=x+dx,yy=y+dy,k=yy*nx+xx;if(pass(xx,yy)&&!seen.has(k)){seen.add(k);queue.push([xx,yy])}}}',
    ' const missing=anchors.filter(([x,y])=>!seen.has(Math.floor(y/step)*nx+Math.floor(x/step)));',
    ' if(missing.length)failed.push({shape,layoutId,missing});tested++;',
    '}'
  ], '{tested,failed,voidTiles}');
  assert.equal(result.tested, 40);
  assert.deepEqual(result.failed, []);
  assert.ok(result.voidTiles > 0, 'Some layouts should have pits');
});

test('pit knockouts grant exactly one kill and one XP reward', () => {
  const result = run([
    'let fallingFx=[],p={},kills=0,records=0,xp=0;',
    'const recordEnemyKill=()=>records++;const earnXp=amount=>xp+=amount;const inSandbox=()=>false;',
    method('fallIntoPit'),
    'const enemy={hp:4,x:45,y:80,r:7,shape:"square"};',
    'fallIntoPit(enemy,50,80,false);fallIntoPit(enemy,50,80,false);'
  ], '{kills,records,xp,rewarded:enemy.rewarded}');
  assert.equal(result.kills, 1);
  assert.equal(result.records, 1);
  assert.equal(result.xp, 2); // earnXp() applies the global XP-halving rule.
  assert.equal(result.rewarded, true);
});

test('sticky-wall impact processes elemental and special reactions once', () => {
  const result = run([
    'const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));',
    'let WALL_HIT_COOLDOWN=.18,arenaTime=1,inv=0,p={},hp=50,over=false,counts={element:0,magnet:0,special:0};',
    'const enemyAttacksEnabled=()=>true,curseActive=()=>false,showWallHit=()=>{},elementalHit=()=>counts.element++,flipMagnet=()=>counts.magnet++,specialImpact=()=>counts.special++,damagedHealth=x=>hp-x;',
    method('collideWall'),
    'const wall={x:90,y:90,w:20,h:20,type:"sticky"};',
    'const enemy={x:116,y:100,r:10,vx:-100,vy:0,shape:"square",mass:1,hp:4};',
    'collideWall(enemy,wall);'
  ], 'counts');
  assert.equal(result.element, 1);
  assert.equal(result.magnet, 1);
  assert.equal(result.special, 1);
});

test('neutral walls absorb impact and bounce walls return more speed', () => {
  const result = run([
    'const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));',
    'let WALL_HIT_COOLDOWN=.18,arenaTime=1,inv=0,p={},hp=50,over=false;',
    'const enemyAttacksEnabled=()=>true,curseActive=()=>false,showWallHit=()=>{},elementalHit=()=>{},flipMagnet=()=>{},specialImpact=()=>{},damagedHealth=x=>hp-x;',
    method('collideWall'),
    'const neutral={x:116,y:100,r:10,vx:-100,vy:0,shape:"square",mass:1,hp:4};',
    'const bounce={x:116,y:100,r:10,vx:-100,vy:0,shape:"square",mass:1,hp:4};',
    'collideWall(neutral,{x:90,y:90,w:20,h:20,type:"neutral"});',
    'collideWall(bounce,{x:90,y:90,w:20,h:20,type:"bounce"});'
  ], '{neutral:neutral.vx,bounce:bounce.vx,finite:[neutral,bounce].every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.vx)&&Number.isFinite(e.vy))}');
  assert.equal(result.finite, true);
  assert.ok(result.bounce > result.neutral && result.neutral > 0);
});

test('safe-floor checks include all four diagonal pit directions', () => {
  const result = run([
    'let W=320,F=320,walls=[],holes=[],condition=0;',
    'const floorVoid=(x,y)=>condition===0?(x>130&&y<110):(x<110&&y>130);',
    method('safeFloor'),
    'const ne=safeFloor(120,120,20);condition=1;const sw=safeFloor(120,120,20);'
  ], '{ne,sw}');
  assert.equal(result.ne, false);
  assert.equal(result.sw, false);
});

test('stored props that block the way are removed without deleting the chest', () => {
  const result = run([
    'let W=480,F=480,breakables=[];',
    'const PROP_DEFS={crate:{r:12},chest:{r:12}},safeFloor=()=>true;',
    'const propsKeepRoutesOpen=arr=>!arr.some(x=>x.kind==="crate");',
    method('initRoomProps'),
    'const room={kind:"combat",props:[{id:"safe-chest",kind:"chest",x:150,y:150,hp:4},{id:"blocking-crate",kind:"crate",x:180,y:180,hp:3}]};',
    'initRoomProps(room);'
  ], '{ids:room.props.map(o=>o.id),breakables:breakables.length}');
  assert.deepEqual(result.ids, ['safe-chest']);
  assert.equal(result.breakables, 1);
});

test('boss hint survives the final-hit frame and victory rewards are idempotent', () => {
  const result = run([
    'let bossFight={done:false,units:[],name:"TEST"},currentRoom={kind:"boss",bossDefeated:false,cleared:false},wins=0,rewards=0,records=0,kills=0,coinDrops=[],enemies=[{hp:2}],pendingSplits=[],projectiles=[],artillery=[],gravityWells=[],reactionZones=[],shards=[],poisonPuddles=[],elementFx=[],W=720,F=640,shieldType="curved";',
    'const inSandbox=()=>false,rewardBoss=()=>rewards++,recordBossKill=()=>records++,queueCheckpoint=()=>wins++,showShieldChoice=()=>{},itemCount=()=>0,healPlayer=()=>{};',
    method('bossHint'), method('finishBossFight'),
    'const hint=bossHint();finishBossFight();finishBossFight();'
  ], '{hint,done:bossFight.done,cleared:currentRoom.cleared,rewards,records,wins,kills}');
  assert.match(result.hint, /FINAL HIT/);
  assert.equal(result.done, true);
  assert.equal(result.cleared, true);
  assert.equal(result.rewards, 1);
  assert.equal(result.records, 1);
  assert.equal(result.wins, 1);
  assert.equal(result.kills, 1);
});

test('failed checkpoint writes are retained, throttled and retried successfully', () => {
  const result = run([
    'let savePending=true,saveRetryAt=0,saveError="",activeSlot=1,currentRoom={cleared:true},loadingRun=false,over=false,writes=0,clock=1000,allow=false,notes=0;',
    'const Date={now:()=>clock},inSandbox=()=>false,slotKey=n=>"slot"+n,snapshotRun=()=>({n:1}),localStorage={setItem(){writes++;if(!allow)throw Error("Quota")}},document={querySelector:()=>({set textContent(v){}})},updateSaveIndicator=()=>notes++;',
    method('flushCheckpoint'),
    'const failure=flushCheckpoint(),pendingAfterFailure=savePending;flushCheckpoint();const writesDuringThrottle=writes;',
    'allow=true;clock+=5001;const success=flushCheckpoint();'
  ], '{failure,pendingAfterFailure,writesDuringThrottle,success,writes,savePending,saveRetryAt,notes}');
  assert.equal(result.failure, false);
  assert.equal(result.pendingAfterFailure, true);
  assert.equal(result.writesDuringThrottle, 1);
  assert.equal(result.success, true);
  assert.equal(result.writes, 2);
  assert.equal(result.savePending, false);
  assert.equal(result.saveRetryAt, 0);
});

test('Mage targeting prefers an unobstructed enemy to a closer one behind cover', () => {
  const result = run([
    'const p={x:60,y:120,target:0},enemies=[{x:150,y:120,hp:5},{x:60,y:230,hp:5}],dungeonNests=[];',
    'let bossFight=null;',
    'const weaponLineClear=(x,y,tx,ty)=>tx!==150;',
    method('mageAim'),
    'const aim=mageAim();'
  ], '{tx:aim.tx,ty:aim.ty,angle:aim.a}');
  assert.equal(result.tx, 60);
  assert.equal(result.ty, 230);
  assert.ok(result.angle > 1.5 && result.angle < 1.65);
});

test('weapon line-of-sight blocks stone walls and props, not airborne crossings over pits', () => {
  const result = run([
    'let walls=[{x:105,y:80,w:40,h:80}],breakables=[],floorGaps=[{x:80,y:80,w:80,h:80}],PROP_DEFS={crate:{r:12}};',
    'const nearRect=(x,y,r,w)=>x+r>w.x&&x-r<w.x+w.w&&y+r>w.y&&y-r<w.y+w.h;',
    method('weaponLineClear'),
    'const wallBlocked=weaponLineClear(40,120,200,120,3);',
    'walls=[];const pitClear=weaponLineClear(40,120,200,120,3);',
    'breakables=[{kind:"crate",x:120,y:120,broken:false}];const propBlocked=weaponLineClear(40,120,200,120,3);',
    'breakables[0].broken=true;const brokenClear=weaponLineClear(40,120,200,120,3);'
  ], '{wallBlocked,pitClear,propBlocked,brokenClear}');
  assert.deepEqual(result, {wallBlocked:false,pitClear:true,propBlocked:false,brokenClear:true});
});

test('piercing arrows resolve multiple targets in travel order, never twice', () => {
  const result = run([
    'const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));',
    'const laserDistance=(x,y,l)=>{const dx=l.x2-l.x1,dy=l.y2-l.y1,t=clamp(((x-l.x1)*dx+(y-l.y1)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(x-(l.x1+t*dx),y-(l.y1+t*dy))};',
    'const behind={id:"behind",x:180,y:100,r:8,hp:5},front={id:"front",x:80,y:100,r:8,hp:5};',
    'const enemies=[behind,front],arrow={r:3,hitTargets:new Set([front])};',
    method('arrowSweepTargets'),
    'const segment={x1:20,y1:100,x2:220,y2:100};',
    'const first=arrowSweepTargets({r:3,hitTargets:new Set()},segment).map(v=>v.enemy.id);',
    'const repeat=arrowSweepTargets(arrow,segment).map(v=>v.enemy.id);'
  ], '{first,repeat}');
  assert.deepEqual(result.first, ['front','behind']);
  assert.deepEqual(result.repeat, ['behind']);
});

test('non-Classic heroes do not get an invisible stationary bat', () => {
  const start = source.indexOf('// Solid bat: sweep its full arc');
  assert.ok(start > 0, 'Bat physics block not found.');
  const section = source.slice(start, start + 550);
  assert.match(section, /if\(hero==='classic'\)\{\s*let sweep=/);
  assert.match(source, /if\(!hit&&batHasLine\)/);
});

test('enemy navigation does not blindly steer into a wall when no route exists', () => {
  const result = run([
    'const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));const p={x:240,y:240};',
    'let W=280,F=280,arenaTime=0,enemyNav={w:280,h:280,expire:2,px:240,py:240,nx:7,ny:7,step:40,walkable:new Uint8Array(49),cost:new Float32Array(49).fill(Infinity)};',
    'const navigationSight=()=>false,enemyMovementEnabled=()=>true;',
    'const rebuildEnemyNavigation=()=>{throw new Error("Should not rebuild")};',
    method('navigationVector'),
    'const vec=navigationVector({x:70,y:70,r:9});'
  ], 'vec');
  assert.deepEqual(result, {x:0,y:0});
});

test('enemy specials retain their windup instead of triggering instantly', () => {
  const result = run([
    declaration('ENEMY_SPECIALS'),declaration('ENEMY_CASTS'),
    'let arenaTime=0,dungeonDepth=1,triggered=0;',
    'const p={x:100,y:100},enemyAttacksEnabled=()=>true,executeEnemyAbility=()=>triggered++;',
    'const enemy={shape:"square",x:120,y:110,abilityEnabled:true,abilityCooldown:0,phaseIn:0,hp:5,elite:false},enemies=[enemy];',
    method('updateEnemyAbility'),
    'const kind=ENEMY_SPECIALS.square,range=ENEMY_CASTS[kind][2];',
    'updateEnemyAbility(enemy,.016,p,Math.min(50,range));const started=!!enemy.ability,windup=enemy.ability?.remaining||0;',
    'updateEnemyAbility(enemy,Math.max(.01,windup/2),p,10);const before=triggered;',
    'updateEnemyAbility(enemy,windup+1,p,10);'
  ], '{started,windup,before,triggered}');
  assert.equal(result.started, true);
  assert.ok(result.windup > 0);
  assert.equal(result.before, 0);
  assert.equal(result.triggered, 1);
});

test('combat population eases for shieldless heroes early and converges by depth five', () => {
  const result = run([
    'let hero="classic",dungeonDepth=1;',
    method('roomEnemyTarget'), method('roomEnemyCount'),
    'const rooms=[{shape:"square",count:12},{shape:"wide",count:16},{shape:"big",count:20},{shape:"cursed",count:22}];',
    'const rows=rooms.map(room=>({classic:roomEnemyCount(room,"classic",1),archer:roomEnemyCount(room,"archer",1),mage:roomEnemyCount(room,"mage",1),late:roomEnemyCount(room,"mage",5)}));'
  ], 'rows');
  for (const row of result) {
    assert.ok(row.archer < row.classic);
    assert.equal(row.mage, row.archer);
    assert.equal(row.late, row.classic);
  }
});

test('all six level-eight element pairs trigger their documented combo once per cooldown', () => {
  const result = run([
    declaration('ITEM_STACK_LIMITS'),
    'const ELEMENTS={fire:{},ice:{},storm:{},poison:{}};let progress={elementPrimary:null,elementSecondary:null},arenaTime=10,elementComboClock=0,elementHitCounter=0,combos=[];',
    'const enemies=[],bossFight=null,playerStats=()=>({damage:1}),friendlyDamage=()=>{},elementChain=()=>{};const synergyArea=(...args)=>combos.push(args);let targets=[];',
    method('applyWeaponElement'),
    'const pairs=[["fire","ice"],["fire","storm"],["fire","poison"],["ice","storm"],["ice","poison"],["poison","storm"]];for(const [a,b] of pairs){progress.elementPrimary=a;progress.elementSecondary=b;elementComboClock=0;const target={x:20,y:30,hp:10};applyWeaponElement(target);targets.push({a,b,burn:target.burnUntil,slow:target.slowUntil,toxic:target.toxicUntil});}',
    'const afterFirst=combos.length;applyWeaponElement({x:20,y:30,hp:10});'
  ], '{combos,targets,afterFirst,afterCooldown:combos.length,clock:elementComboClock}');
  assert.equal(result.afterFirst, 6);
  assert.equal(result.afterCooldown, 6);
  assert.deepEqual(result.combos.map(([x,y,r,damage]) => [r,damage]), [[65,2.2],[65,2.7],[60,3],[78,2.3],[68,2.3],[70,2.7]]);
  assert.ok(result.targets.filter(pair => pair.a === 'fire' || pair.b === 'fire').every(pair => pair.burn === 12.5));
  assert.ok(result.targets.filter(pair => pair.a === 'ice' || pair.b === 'ice').every(pair => pair.slow === 11.8));
  assert.ok(result.targets.filter(pair => pair.a === 'poison' || pair.b === 'poison').every(pair => pair.toxic === 13));
});

test('legacy item stacks keep save shape but effective healing and health growth stay bounded', () => {
  const result = run([
    declaration('ITEM_STACK_LIMITS'),
    'let progress={items:{mossCharm:40,emberHeart:40,leechFang:40,glassEye:40},upgrades:{vitality:40,regen:40}},hero="classic";',
    'const itemCount=id=>Math.min(ITEM_STACK_LIMITS[id]??Number.MAX_SAFE_INTEGER,progress?.items[id]||0),upgradeCount=id=>progress?.upgrades[id]||0,hasSynergy=()=>false,PLAYER_REGEN=.6;',
    method('playerStats')
  ], '({moss:itemCount("mossCharm"),leech:itemCount("leechFang"),maxHealth:playerStats().maxHealth,regen:playerStats().regen,stored:progress.items.mossCharm})');
  assert.equal(result.moss, 3);
  assert.equal(result.leech, 3);
  assert.equal(result.maxHealth, 100);
  assert.equal(result.regen, 2.4);
  assert.equal(result.stored, 40, 'older saves remain readable without migration');
});

test('capped item pickups convert into coins instead of silently wasting loot', () => {
  const result = run([
    'const ITEM_DEFS={mossCharm:{}};', declaration('ITEM_STACK_LIMITS'),
    'let progress={items:{mossCharm:3},coins:4},hero="classic",hp=50;',
    'const itemCount=id=>Math.min(ITEM_STACK_LIMITS[id]??Number.MAX_SAFE_INTEGER,progress.items[id]||0),showItemNotice=()=>{},queueCheckpoint=()=>{},updateCharacterMenu=()=>{};',
    method('giveItem'),
    'const accepted=giveItem("mossCharm");'
  ], '({accepted,coins:progress.coins,count:itemCount("mossCharm")})');
  assert.deepEqual(result, {accepted:true,coins:14,count:3});
});

test('healer enemies support allies without granting free player healing on contact', () => {
  assert.doesNotMatch(source, /PLAYER_HEALING_ENABLED/);
  const contact = source.slice(source.indexOf('if(e.shape!==\'healer\'&&enemyAttacksEnabled()'), source.indexOf('\n', source.indexOf('if(e.shape!==\'healer\'&&enemyAttacksEnabled()')));
  assert.ok(contact.length > 0, 'healer contact should use the non-healer damage branch');
  assert.doesNotMatch(contact, /healPlayer|playerStats\(\)\.maxHealth/);
  assert.match(method('executeEnemyAbility'), /if\(kind==='heal'\)\{ally\.hp=Math\.min\(ally\.maxHp,ally\.hp\+\(e\.elite\?4:2\)\)/);
});

test('Level 3 and Level 8 choices stay pending until distinct elements are selected', () => {
  const result = run([
    'const ELEMENTS={fire:{},ice:{},storm:{},poison:{}};let progress={level:3,elementPrimary:null,elementSecondary:null};',
    method('levelChoicePending'),
    'const atLevel3=levelChoicePending();progress.elementPrimary="fire";progress.level=8;const atLevel8=levelChoicePending();progress.elementSecondary="ice";const complete=levelChoicePending();'
  ], '{atLevel3,atLevel8,complete}');
  assert.deepEqual(result, {atLevel3:true,atLevel8:true,complete:false});
});
