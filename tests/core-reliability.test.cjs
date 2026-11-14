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

test('all 12 bosses have twice the previous HP in dungeons, practice and split forms', () => {
  const result = run([
    declaration('BOSS_HEALTH_MULTIPLIER'),
    source.slice(source.indexOf('const BOSS_BLUEPRINTS ='), source.indexOf('function currentBiome(')),
    'let inPractice=false,dungeonDepth=1,bossFight;const inSandbox=()=>inPractice,W=720,F=640;',
    method('floorDifficulty'),method('bossMaxHealth'),method('bossRadius'),method('bossArmour'),method('createBossUnit'),method('startBossFight'),
    'const rows=[];',
    'for(const [id,oldHp] of Object.entries({gatekeeper:90,crystal:72,slime:96,furnace:112,hydra:98,phoenix:114,briar:122,matriarch:102,mire:120,glacier:118,oracle:104,avalanche:128})){',
    ' for(dungeonDepth of [1,2,5,20])for(inPractice of [false,true]){',
    '  const expected=2*Math.ceil(oldHp*(inPractice?1:1+Math.min(1.5,(dungeonDepth-1)*.12))*(inPractice?1:.75));',
    '  startBossFight(id);const unit=bossFight.units[0];',
    '  rows.push({id,expected,hp:unit.hp,maxHp:unit.maxHp,hud:bossFight.totalMax});',
    '  const part=createBossUnit(id,0,0,true);',
    '  if(part.kind==="slime"&&id!=="phoenix"){const expectedPart=2*Math.ceil(oldHp*.25*(inPractice?1:floorDifficulty())*(inPractice?1:.75));rows.push({id,expected:expectedPart,hp:part.hp,maxHp:part.maxHp,hud:expectedPart});}',
    ' }',
    '}'
  ], 'rows');
  assert.equal(new Set(result.map(row => row.id)).size, 12);
  for (const {id,expected,hp,maxHp,hud} of result) {
    assert.deepEqual([hp,maxHp,hud], [expected,expected,expected], id);
  }
});

test('Phoenix rebirth doubles the old rounded refill and split bosses conserve remaining HP', () => {
  const result = run([
    declaration('BOSS_HEALTH_MULTIPLIER'),
    source.slice(source.indexOf('const BOSS_BLUEPRINTS ='), source.indexOf('function currentBiome(')),
    'let bossFight,dungeonDepth=1,victories=0;const currentRoom={kind:"boss"},W=720,F=640,p={x:30,y:30,vel:0},arenaTime=1;',
    'const inSandbox=()=>false,enemyAttacksEnabled=()=>false,enemies=[],elementFx=[];',
    'const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),bossSignatureRing=()=>{},bossSpiralShot=()=>{},showItemNotice=()=>{},updateBossZoneList=()=>{},updateBossShots=()=>{},updateBossSpecial=()=>{},finishBossFight=()=>victories++;',
    method('floorDifficulty'),method('bossMaxHealth'),method('bossRebirthHealth'),method('bossRadius'),method('bossArmour'),method('createBossUnit'),method('startBossFight'),
    method('handleBiomeBossPhase'), method('updateBossFight'),
    'startBossFight("phoenix");const phoenix=bossFight.units[0];phoenix.hp=0;updateBossFight(0,0);',
    'const rebirth={hp:phoenix.hp,state:phoenix.state,victories};phoenix.hp=0;updateBossFight(0,0);',
    'startBossFight("slime");bossFight.units[0].hp=57.5;updateBossFight(0,0);'
  ], '{rebirth,victories,split:bossFight.split,hp:bossFight.units.map(unit=>unit.hp)}');
  assert.deepEqual(result, {
    rebirth:{hp:84,state:'rebirth',victories:0},
    victories:1,
    split:true,
    hp:[28.75,28.75]
  });
});

const bossPatternMethods=[
  declaration('BOSS_SPECIALS'),method('bossAngleBetween'),method('buildBossSpecial'),method('bossSignatureDamage'),
];
const bossPatternArena='const W=720,F=640,p={x:470,y:350},clamp=(x,a,b)=>Math.max(a,Math.min(b,x));';

test('each boss builds a unique signature with visible warning time in both phases', () => {
  const plans=run([
    bossPatternArena,...bossPatternMethods,
    'const plans=Object.keys(BOSS_SPECIALS).map(variant=>[false,true].map(phase2=>buildBossSpecial({variant,x:360,y:320,r:28,phase2})));'
  ], 'plans');
  assert.equal(new Set(plans.map(([plan])=>plan.rule.name)).size,12);
  assert.equal(new Set(plans.map(([plan])=>JSON.stringify(plan.steps))).size,12);
  for(const [first,second] of plans){
    assert.ok(second.steps.length>=first.steps.length);
    for(const plan of [first,second]){
      assert.ok(plan.steps.length>0);
      assert.ok(plan.steps.every(step=>step.at>=.9&&step.at<=plan.duration&&!step.hit),plan.rule.name);
    }
  }
});

test('Crystal Eye rings and Hydra bullet walls keep the marked gap across all waves', () => {
  const result=run([
    bossPatternArena,...bossPatternMethods,
    'const plans=["crystal","hydra","phoenix"].map(variant=>buildBossSpecial({variant,x:360,y:320,r:28,phase2:true}));',
    'const clear=plans.map(({opening,steps})=>steps.every(step=>opening.width?Math.abs(step.x-opening.x)>opening.width/2:step.angles.every(angle=>Math.abs(bossAngleBetween(angle,opening.angle))>=opening.spread-1e-9)));'
  ], 'clear');
  assert.deepEqual(result,[true,true,true]);
});

test('cleaves respect the marked arc and lightning hits once after its warning', () => {
  const result=run([
    bossPatternArena,...bossPatternMethods,
    'const hits=[],oracle={hp:80,variant:"oracle",kind:"crystal",state:"recover",timer:.4,x:360,y:320,r:25};',
    'const bossFight={units:[oracle],shots:[],hazards:[],special:null,specialCooldown:0,specialTurn:0};',
    'const enemyAttacksEnabled=()=>true,dashInvulnerable=()=>false,hurtBossPlayer=damage=>hits.push(damage);',
    method('bossSpecialHits'),method('resolveBossSpecialStep'),method('updateBossSpecial'),
    'const cleave={type:"arc",x:100,y:100,r:80,angle:0,spread:1};',
    'const inside=bossSpecialHits(cleave,155,110),behind=bossSpecialHits(cleave,50,100),far=bossSpecialHits(cleave,190,100);',
    'updateBossSpecial(0);updateBossSpecial(.92);const before=hits.length;',
    'updateBossSpecial(.03);updateBossSpecial(.05);p.x=700;p.y=600;updateBossSpecial(1.4);'
  ], '{inside,behind,far,before,hits,ended:bossFight.special===null}');
  assert.deepEqual(result,{inside:true,behind:false,far:false,before:0,hits:[8],ended:true});
});

test('split bosses take turns and a dead caster cancels its pending signature', () => {
  const result=run([
    bossPatternArena,...bossPatternMethods,
    'const left={hp:20,variant:"mire",kind:"slime",state:"recover",timer:.5,x:325,y:320,r:22,phase2:true,part:true};',
    'const right={...left,x:395};',
    'const bossFight={units:[left,right],shots:[],hazards:[],special:null,specialCooldown:0,specialTurn:0};',
    'const enemyAttacksEnabled=()=>true,dashInvulnerable=()=>true,hurtBossPlayer=()=>{throw Error("unexpected damage")};',
    method('bossSpecialHits'),method('resolveBossSpecialStep'),method('updateBossSpecial'),
    'updateBossSpecial(0);const first=bossFight.special.unit===left;',
    'updateBossSpecial(2);bossFight.specialCooldown=0;',
    'updateBossSpecial(0);const second=bossFight.special.unit===right;',
    'right.hp=0;const pending=bossFight.special.steps;updateBossSpecial(3);'
  ], '{first,second,cancelled:bossFight.special===null,discharged:pending.some(step=>step.hit)}');
  assert.deepEqual(result,{first:true,second:true,cancelled:true,discharged:false});
});

test('Archer strong shots crack boss armor without a reflection item', () => {
  const result=run([
    declaration('BOW_MIN_DRAW'),method('bowDrawStage'),method('damageBoss'),
    'let arenaTime=1;const bossFight={done:false},elementFx=[],bossSpark=()=>{};',
    'const unit={kind:"crystal",state:"recover",hp:100,armour:2};',
    'unit.lastArrowPower=.5;damageBoss(unit,3,"arrow");const weak=unit.armour;',
    'unit.lastArrowPower=.8;damageBoss(unit,3,"arrow");damageBoss(unit,3,"arrow");const strong=unit.armour;',
    'arenaTime=1.8;damageBoss(unit,3,"arrow");'
  ], '{weak,strong,armour:unit.armour,opening:unit.vulnerable,hp:unit.hp}');
  assert.deepEqual(result,{weak:2,strong:1,armour:0,opening:6,hp:100});
});

test('index HP matches actual dungeon spawns, including elite rounding and Dungeon 14+', () => {
  const result=run([
    declaration('RANGED'), declaration('ROYAL_SLIME'),declaration('ENEMY_SPECIALS'),
    source.slice(source.indexOf('const BIOME_ENEMIES ='),source.indexOf('function currentBiome(')),
    'let dungeonDepth=1;const inSandbox=()=>false;',
    method('floorDifficulty'),method('enemyDefinition'),method('enemyMaxHealth'),method('makeEnemy'),
    method('bossMaxHealth'),method('bossRadius'),method('bossArmour'),method('createBossUnit'),method('bestiaryHealth'),
    'const rows=[];for(dungeonDepth of [1,4,14,30]){',
    ' for(const elite of [false,true]){const enemy=makeEnemy("round",0,0,elite);rows.push([enemy.hp,bestiaryHealth({id:"round"},dungeonDepth,elite)]);}',
    ' const boss=createBossUnit("gatekeeper",0,0);rows.push([boss.hp,bestiaryHealth({id:"boss:gatekeeper",boss:true},dungeonDepth)]);',
    '}'
  ], '{rows,royal:bestiaryHealth({id:"royalSlime"},30)}');
  assert.ok(result.rows.every(([actual,index])=>actual===index));
  assert.deepEqual(result.rows.map(([,hp])=>hp),[3,6,136,5,9,184,8,15,338,8,15,338]);
  assert.equal(result.royal,2);
});

test('index damage uses combat values for elite slams and boss signatures', () => {
  const result=run([
    ...['RANGED','ENEMY_DAMAGE','ENEMY_SPECIAL_DAMAGE','ENEMY_BLEED','ENEMY_PROJECTILES','ENEMY_SPECIALS','BOSS_DAMAGE','ZONE_DAMAGE','BOSS_SPECIALS'].map(declaration),
    method('enemyShotKind'),method('bossDamageAmount'),method('bossSignatureDamage'),
    method('bestiaryEnemyAttacks'),method('bestiaryBossAttacks'),
  ], '{armored:Object.fromEntries(bestiaryEnemyAttacks("armored")),oracle:Object.fromEntries(bestiaryBossAttacks("oracle",{archetype:"crystal",element:"frost"})),ice:Object.fromEntries(bestiaryEnemyAttacks("icewisp"))}');
  assert.equal(result.armored['Ground slam'],'18 HP · 22 elite');
  assert.equal(result.oracle['Sky Verdict'],'20 HP per hit');
  assert.equal(result.oracle['Prism beam'],'10 HP per hit');
  assert.equal(result.ice['Slow'],'2 seconds');
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

test('Archer and Mage get modest damage mitigation to offset the missing shield', () => {
  const result = run([
    'let hero="classic",hp=50;const dashInvulnerable=()=>false,inSandbox=()=>false,sandbox={attacks:true};',
    'const playerStats=()=>({armour:hero==="archer"?.05:hero==="mage"?.10:0});',
    method('damagedHealth'),
    'const damage=[];for(const character of ["classic","archer","mage"]){hero=character;hp=50;hp=damagedHealth(14);damage.push(50-hp)}'
  ], 'damage');
  assert.deepEqual(result.map(value => Math.round(value*10)/10), [14,13.3,12.6]);
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

test('Archer uses the release position and never fires on a cancelled pointer', () => {
  const result = run([
    declaration('BOW_MIN_DRAW'),
    'const hero="archer",R=35,controls={size:100},p={x:10,y:10};',
    'const sticks=[{id:null},{id:7,x:100,y:200,dx:1,dy:0}],arrows=[];',
    'let bowShotCooldown=0,mageGesture=null,editPointer=null;',
    'const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),pt=event=>event;',
    'const combatInputEnabled=()=>true,itemCount=()=>0,upgradeCount=()=>0;',
    method('setStick'), method('bowPower'), method('bowDrawStage'), method('fireArrow'), method('endCanvasPointer'),
    'endCanvasPointer({type:"pointerup",pointerId:7,x:100,y:200});',
    'sticks[1].id=7;endCanvasPointer({type:"pointercancel",pointerId:7,x:135,y:200});',
    'const afterCancels=arrows.length;',
    'sticks[1].id=7;endCanvasPointer({type:"pointerup",pointerId:7,x:100,y:229});'
  ], '{afterCancels,shots:arrows.length,stage:bowDrawStage(arrows[0].power),angle:p.target}');
  assert.deepEqual(result, {afterCancels:0,shots:1,stage:'strong',angle:Math.PI/2});
});

test('Classic ignores center drift and records a flick before the next frame', () => {
  const result = run([
    declaration('BOW_MIN_DRAW'),
    'const hero="classic",R=35,controls={size:100},p={target:0};',
    'const sticks=[{id:null},{id:7,x:100,y:200,dx:0,dy:0}];',
    'let mageGesture=null,editPointer=null;',
    'const combatInputEnabled=()=>true,unlockCombatAudio=()=>{},pt=event=>event;',
    method('setStick'), method('endCanvasPointer'),
    'setStick(sticks[1],{x:100,y:193});const afterDrift=p.target;',
    'endCanvasPointer({type:"pointerup",pointerId:7,x:100,y:190});'
  ], '{afterDrift,afterFlick:p.target,held:sticks[1].id}');
  assert.deepEqual(result, {afterDrift:0,afterFlick:-Math.PI/2,held:null});
});

test('Mage rune tracing detects a fast edge pass and rejects returning to a used rune', () => {
  const result = run([
    declaration('RUNE_TOUCH_RADIUS'),
    'const mageRunes=()=>[{id:"A",x:0,y:0},{id:"B",x:104,y:0},{id:"C",x:52,y:64}];',
    'const mageGesture={path:["A"],last:{x:0,y:0}};',
    method('runeEntryTime'), method('mageGesturePoint'),
    'mageGesturePoint({x:134,y:-29});const path=mageGesture.path.join("");',
    'mageGesturePoint({x:104,y:0});const lingerInvalid=!!mageGesture.invalid;',
    'mageGesturePoint({x:0,y:0});'
  ], '{path,lingerInvalid,repeatInvalid:mageGesture.invalid}');
  assert.deepEqual(result, {path:'AB',lingerInvalid:false,repeatInvalid:true});
});

test('Interrupting controls clears both sticks, the rune trace and any bat momentum', () => {
  const result = run([
    'let mageGesture={id:3},editPointer=null,dashDrag=null;',
    'const sticks=[{id:1,dx:1,dy:0},{id:2,dx:0,dy:1}],p={a:1,target:2,vel:3};',
    'const captured=new Set([1,2,3]);',
    'const c={hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};',
    method('releaseCapture'), method('cancelHeldInputs'),
    'cancelHeldInputs();'
  ], '{mageGesture,sticks,p,captured:[...captured]}');
  assert.deepEqual(result, {
    mageGesture:null,
    sticks:[{id:null,dx:0,dy:0},{id:null,dx:0,dy:0}],
    p:{a:1,target:1,vel:0},
    captured:[]
  });
});
