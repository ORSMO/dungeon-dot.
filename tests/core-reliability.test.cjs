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
    'const hero="classic",dashBatSweeps=()=>false,meleeIsSwinging=()=>false,inSandbox=()=>false,enemyAttacksEnabled=()=>false,blockShieldBody=()=>false,enemies=[],elementFx=[];',
    declaration('BOSS_DAMAGE'),
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

test('Classic is protected through the final moving dash frame and loses protection afterwards', () => {
  const result=run([
    declaration('DASH_DURATION'),method('dashCooldown'),method('classicDashBatActive'),method('classicDashProtected'),
    method('dashInvulnerable'),method('requestDash'),method('moveDash'),method('damagedHealth'),method('bodyArmourStats'),declaration('BODY_ARMOUR_MAX_RANK'),
    'const hero="classic",W=480,F=480,sticks=[{dx:1,dy:0}],holes=[],p={x:100,y:100,a:0};',
    'const dash={remaining:0,readyAt:0,immuneUntil:0,trail:[],batPath:null,batHits:new Set()};',
    'let arenaTime=10,inv=0,hp=50,wall=false,armourHp=12;const progress={upgrades:{}};',
    'const combatInputEnabled=()=>true,queueCheckpoint=()=>{},updateDashButton=()=>{},blocked=()=>wall,inSandbox=()=>false,playerStats=()=>({armour:0}),updateBodyArmour=()=>{};',
    'requestDash();arenaTime+=.18;moveDash(.18);const finalFrame=damagedHealth(9);',
    'dash.batPath=null;const after=damagedHealth(9);',
    'arenaTime+=2;requestDash();wall=true;moveDash(.016);const blockedWithoutMoving=damagedHealth(9);'
  ], '{finalFrame,after,blockedWithoutMoving,inv,armourHp}');
  assert.deepEqual(result,{finalFrame:50,after:43.25,blockedWithoutMoving:43.25,inv:0,armourHp:7.5});
});

test('Classic dash sweeps the travel path, respects cover, and boosts only bat damage by 50%', () => {
  const result=run([
    'let hero="classic",cover=false;const p={x:80,y:70,a:0},progress={weapon:"bat"};',
    'const dash={batPath:{x0:10,y0:70,x1:80,y1:70},batHits:new Set()};',
    'const target={x:55,y:70,r:5};',
    'const weaponLineClear=()=>!cover,playerStats=()=>({damage:1,crit:0}),itemCount=()=>0;',
    method('laserDistance'),method('bossBatSegment'),method('equippedWeapon'),method('classicDashBatActive'),method('dashBatSweeps'),method('playerDamageAmount'),
    'const swept=dashBatSweeps(target,0);',
    'cover=true;const blocked=dashBatSweeps(target,0);cover=false;',
    'dash.batHits.add(target);const repeat=dashBatSweeps(target,0);',
    'const dashBat=playerDamageAmount(2,"bat"),arrow=playerDamageAmount(2,"arrow"),item=playerDamageAmount(2,"item");',
    'progress.weapon="sword";dash.batHits.clear();const swordSwept=dashBatSweeps(target,0),sword=playerDamageAmount(2,"bat");',
    'progress.weapon="bat";dash.batPath=null;const after=playerDamageAmount(2,"bat");'
  ], '{swept,blocked,repeat,dashBat,arrow,item,swordSwept,sword,after}');
  assert.deepEqual(result,{swept:true,blocked:false,repeat:false,dashBat:3,arrow:2,item:2,swordSwept:false,sword:2,after:2});
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
  const start = source.indexOf('// The melee weapon uses the same swept shape');
  assert.ok(start > 0, 'Melee physics block not found.');
  const section = source.slice(start, start + 550);
  assert.match(section, /if\(hero==='classic'\)resolveMeleeContact\(/);
  assert.match(method('updateBossFight'), /swingHit=hero==='classic'/);
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
    'let hero="classic",hp=50,armourHp=0;const dashInvulnerable=()=>false,inSandbox=()=>false,sandbox={attacks:true};',
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

const shieldRig=[
  ...['SHIELD_RADIUS','SHIELD_HALF_ARC','SHIELD_EDGE','RANGED','ENEMY_DAMAGE'].map(declaration),
  'let hero="classic",shieldType="curved",shieldHp=100,shieldBroken=false,shieldCooldown=0,shieldLastHit=-99;',
  'let hp=50,inv=0,over=false,arenaTime=1,dashing=false,bleeds=0,attacks=true;',
  'const p={x:100,y:100,a:0,vx:0,vy:0,kvx:0,kvy:0},W=400,F=300,walls=[],breakables=[],PROP_DEFS={};',
  'const clamp=(n,min,max)=>Math.min(max,Math.max(min,n)),playerStats=()=>({shieldProtection:0});',
  'const classicDashProtected=()=>dashing,shieldUpdate=()=>{},queueCheckpoint=()=>{},enemyAttacksEnabled=()=>attacks;',
  'const damagedHealth=amount=>hp-amount,addEnemyBleed=()=>bleeds++;',
  ...['nearRect','shieldActive','shieldDamage','shieldBodyPoint','blockShieldBody','enemyContactDamage','resolveEnemyContact'].map(method),
  'const mob=(x,y,shape="round")=>({x,y,r:10,vx:-260,vy:0,shape});'
];

test('the solid guard catches a melee charge even if its frame movement crosses the player', () => {
  const result=run([
    ...shieldRig,
    'const enemy=mob(89,100);enemy.chargeUntil=2;',
    'resolveEnemyContact(enemy,130,100,p);'
  ],'{hp,shieldHp,enemyX:enemy.x,bounced:enemy.vx>0,inv,push:p.kvx}');
  assert.deepEqual(result,{hp:50,shieldHp:82,enemyX:125.7,bounced:true,inv:0,push:0});
});

test('blocked bloodletter contact cannot bleed the player, even when the shield breaks', () => {
  const result=run([
    ...shieldRig,
    'shieldHp=6;const enemy=mob(115,100,"bloodletter");resolveEnemyContact(enemy,128,100,p);',
    'const blocked={hp,bleeds,shieldHp,shieldBroken};',
    'enemy.x=115;resolveEnemyContact(enemy,128,100,p);'
  ],'{blocked,hp,bleeds}');
  assert.deepEqual(result,{blocked:{hp:50,bleeds:0,shieldHp:0,shieldBroken:true},hp:42,bleeds:1});
});

test('the guard follows aim and leaves the rear and side exposed', () => {
  const result=run([
    ...shieldRig,
    'p.a=Math.PI/2;const enemy=mob(100,116);resolveEnemyContact(enemy,100,129,p);',
    'const afterFront={hp,shieldHp};const rear=mob(100,83);resolveEnemyContact(rear,100,70,p);',
    'const afterRear={hp,shieldHp};inv=0;const side=mob(115,92);resolveEnemyContact(side,130,84,p);'
  ],'{afterFront,afterRear,hp,shieldHp}');
  assert.deepEqual(result,{afterFront:{hp:50,shieldHp:86},afterRear:{hp:36,shieldHp:86},hp:22,shieldHp:86});
});

test('repeated pressure has a per-enemy durability cooldown and a dash preserves durability', () => {
  const result=run([
    ...shieldRig,
    'const enemy=mob(122,100),second=mob(122,100);',
    'const block=target=>{target.x=122;resolveEnemyContact(target,129,100,p)};',
    'block(enemy);arenaTime+=.3;block(enemy);block(second);const crowded=shieldHp;',
    'arenaTime+=.4;dashing=true;block(enemy);const duringDash=shieldHp;',
    'dashing=false;block(enemy);const afterDash=shieldHp;',
    'arenaTime+=.7;attacks=false;block(enemy);'
  ],'{crowded,duringDash,afterDash,shieldHp,hp}');
  assert.deepEqual(result,{crowded:72,duringDash:72,afterDash:58,shieldHp:58,hp:50});
});

test('collision correction cannot push enemies through the curved guard or into a wall', () => {
  const result=run([
    ...shieldRig,
    'const enemy=mob(95,100);const across=blockShieldBody(enemy,126,100,p,14);',
    'walls.push({x:135,y:70,w:15,h:70});enemy.x=120;',
    'const atWall=blockShieldBody(enemy,124,100,p,14);'
  ],'{across,atWall,enemyX:enemy.x,shieldHp,hp}');
  assert.deepEqual(result,{across:true,atWall:true,enemyX:124,shieldHp:86,hp:50});
});

test('a boss charge stops at the guard and the impact that breaks it spares the player', () => {
  const result=run([
    ...shieldRig,declaration('BOSS_DAMAGE'),
    'const currentRoom={kind:"boss"},unit={x:151,y:100,r:30,state:"charge",hp:60,maxHp:60,hitCooldown:0};',
    'const bossFight={units:[unit]},enemies=[],inSandbox=()=>false,dashBatSweeps=()=>false,meleeIsSwinging=()=>false;',
    'const updateBossSpecial=()=>{},updateBossZoneList=()=>{},updateBossShots=()=>{},updateBossSignature=()=>{},handleBiomeBossPhase=()=>{};',
    'const updateBiomeBossUnit=unit=>{unit.x-=14;return true};',
    ...['bossDamageAmount','hurtBossPlayer','updateBossFight'].map(method),
    'updateBossFight(.035,0);const first={hp,shieldHp,bossX:unit.x,playerX:p.x};',
    'arenaTime+=.7;updateBossFight(.035,0);const broken={hp,shieldHp,shieldBroken};',
    'arenaTime+=.7;updateBossFight(.035,0);'
  ],'{first,broken,hp}');
  assert.deepEqual(result,{
    first:{hp:50,shieldHp:28,bossX:145.7,playerX:100},
    broken:{hp:50,shieldHp:0,shieldBroken:true},hp:10
  });
});

test('healer enemies support allies without granting free player healing on contact', () => {
  const result=run([
    ...shieldRig,
    'hp=30;const healer=mob(117,100,"healer");resolveEnemyContact(healer,128,100,p);',
    'hero="mage";resolveEnemyContact(healer,128,100,p);'
  ],'{hp,shieldHp,inv}');
  assert.deepEqual(result,{hp:30,shieldHp:100,inv:0});
  assert.match(method('executeEnemyAbility'), /if\(kind==='heal'\)\{ally\.hp=Math\.min\(ally\.maxHp,ally\.hp\+\(e\.elite\?4:2\)\)/);
});

test('body armour absorbs a share, exhausts its durability on the breaking hit, and refills on room entry', () => {
  const result=run([
    declaration('BODY_ARMOUR_MAX_RANK'),
    'const hero="classic",progress={upgrades:{}},sandbox={attacks:false};',
    'let hp=50,armourHp=12,breaks=0,practice=false,checkpoints=0;',
    'let shieldType="curved",shieldHp=100,shieldBroken=false,shieldCooldown=0,shieldLastHit=-99,shieldLaserTick=0;',
    'const dashInvulnerable=()=>false,inSandbox=()=>practice,playerStats=()=>({armour:0}),shieldUpdate=()=>{},updateBodyArmour=()=>{},showItemNotice=()=>breaks++,queueCheckpoint=()=>checkpoints++;',
    ...['bodyArmourStats','damagedHealth','refillRoomDefences'].map(method),
    'practice=true;hp=damagedHealth(12);const protectedPractice={hp,armourHp};practice=false;',
    'hp=damagedHealth(20);const first={hp,armourHp};',
    'hp=damagedHealth(32);const broken={hp,armourHp};hp=damagedHealth(3);',
    'progress.upgrades={armourPlates:5,armourPadding:5};refillRoomDefences();'
  ],'{protectedPractice,first,broken,hp,armourHp,breaks,checkpoints,absorption:bodyArmourStats().absorption}');
  assert.deepEqual(result,{
    protectedPractice:{hp:50,armourHp:12},first:{hp:35,armourHp:7},broken:{hp:10,armourHp:0},
    hp:7,armourHp:32,breaks:1,checkpoints:2,absorption:.5
  });
});

test('legacy Mage level 3 and level 8 choices stay pending until distinct elements are selected', () => {
  const result = run([
    'const hero="mage";let progress={level:3,legacyMage:true,elementPrimary:null,elementSecondary:null};',
    method('levelChoicePending'),
    'const atLevel3=levelChoicePending();progress.elementPrimary="fire";progress.level=8;const atLevel8=levelChoicePending();progress.elementSecondary="ice";const complete=levelChoicePending();'
  ], '{atLevel3,atLevel8,complete}');
  assert.deepEqual(result, {atLevel3:true,atLevel8:true,complete:false});
});

const schoolSpells=[
  ...['APPRENTICE_SPELLS','MAGE_SCHOOLS','MAGE_SPELLS'].map(declaration),
  method('mageSpell'),method('mageSpellbook')
];

test('Apprentice evolves once and receives only the three spells in the selected school', () => {
  const result=run([
    ...schoolSpells,method('levelChoicePending'),method('selectMageSchool'),
    'const hero="mage",progress={level:2,mageSchool:null},document={querySelector:()=>({})};',
    'const runHeroName=()=>progress.mageSchool,showItemNotice=()=>{},hud=()=>{},queueCheckpoint=()=>{},flushCheckpoint=()=>{};',
    'const starter=Object.keys(mageSpellbook()),early=selectMageSchool("summoner");progress.level=3;',
    'const choices=Object.keys(MAGE_SCHOOLS).map(school=>Object.values(MAGE_SCHOOLS[school].spells).map(spell=>spell.name));',
    'const invalid=selectMageSchool("constructor"),chosen=selectMageSchool("necromancer");',
    'progress.level=8;const later=selectMageSchool("arcane"),paths=Object.keys(mageSpellbook()),locked=mageSpell("BA")===null;',
    'progress.legacyMage=true;const original=[Object.keys(mageSpellbook()).length,mageSpell("A").name];'
  ],'{starter,early,choices,invalid,chosen,later,paths,locked,original}');
  assert.deepEqual(result,{
    starter:['A','B','C'],early:false,choices:[
      ['Conjure Familiar','Pack Command','Guardian Pact'],['Grave Mark','Corpse Burst','Raise the Fallen'],
      ['Fire Lance','Flame Trail','Meteor Drop'],['Ricochet Orb','Blink','Gravity Well']
    ],invalid:false,chosen:true,later:false,paths:['A','B','C','AB','BC','ABC'],locked:true,original:[15,'Ember Bolt']
  });
});

test('failed magic casts preserve mana and a successful cast enforces both cooldowns', () => {
  const result=run([
    ...schoolSpells,method('castMageSpell'),
    'let mageMana=100,arenaTime=1,mageGlobalReady=0,mageCastCount=0,resource=false,feedback="";',
    'const progress={mageSchool:"necromancer"},mageCooldowns={},mageInputEnabled=()=>true,mageAim=()=>({a:0});',
    'const castSchoolSpell=()=>resource?undefined:"NEED A SOUL",itemCount=()=>0,upgradeCount=()=>0,playerStats=()=>({swing:1});',
    'const refreshManaHud=()=>{},queueCheckpoint=()=>{},showMageFeedback=(kind,label)=>feedback=label;',
    'const locked=castMageSpell("CBA"),failed=castMageSpell("ABC"),before={mageMana,mageGlobalReady,feedback};',
    'resource=true;const applied=castMageSpell("ABC"),duringGlobal=castMageSpell("A");arenaTime=2;const duringSpell=castMageSpell("ABC");'
  ],'{locked,failed,before,applied,duringGlobal,duringSpell,mageMana,mageCastCount,ready:mageCooldowns.ABC}');
  assert.deepEqual(result,{
    locked:false,failed:false,before:{mageMana:100,mageGlobalReady:0,feedback:'NEED A SOUL'},
    applied:true,duringGlobal:false,duringSpell:false,mageMana:68,mageCastCount:1,ready:6.5
  });
});

test('Grave Mark earns Souls from corpses and hits on a solo boss up to the cap', () => {
  const result=run([
    declaration('MAGE_SOUL_LIMIT'),method('gainMageSoul'),method('mageHurt'),method('rememberMageCorpse'),
    'const progress={mageSchool:"necromancer"},itemCount=()=>0,canDamage=()=>true,refreshManaHud=()=>{},queueCheckpoint=()=>{},mageOnHit=()=>{};',
    'let arenaTime=1,mageSouls=0;const mageCorpses=[],friendlyDamage=(enemy,amount)=>{enemy.hp=Math.max(0,enemy.hp-amount);return true};',
    'const enemy={x:10,y:18,hp:2};mageHurt(enemy,2.8,"grave");rememberMageCorpse(enemy);const afterKill=mageSouls;',
    'const boss={hp:90,kind:"gatekeeper"};mageHurt(boss,2.8,"grave");mageHurt(boss,1.85);mageHurt(boss,1.85);const fromBoss=mageSouls;',
    'for(let i=0;i<9;i++)mageHurt(boss,1.85);'
  ],'{afterKill,fromBoss,mageSouls,corpses:mageCorpses.length}');
  assert.deepEqual(result,{afterKill:1,fromBoss:2,mageSouls:3,corpses:1});
});

test('Ricochet Orb reflects off a wall and can bounce only as many times as configured', () => {
  const result=run([
    method('nearRect'),method('moveMageBolt'),
    'let sparks=0;const bossSpark=()=>sparks++,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),W=300,F=300;',
    'const walls=[{x:130,y:45,w:15,h:120},{x:70,y:45,w:15,h:120}];',
    'const bolt={x:115,y:100,vx:460,vy:0,r:5,bounces:2};',
    'const first=moveMageBolt(bolt,.05),reversed=bolt.vx<0,nearWall=bolt.x<125;',
    'const second=moveMageBolt(bolt,.1),third=moveMageBolt(bolt,.1);'
  ],'{first,second,third,reversed,nearWall,sparks,bounces:bolt.bounces}');
  assert.deepEqual(result,{first:true,second:true,third:false,reversed:true,nearWall:true,sparks:2,bounces:0});
});

test('Blink follows the movement stick, respects barriers, and places its decoy at takeoff', () => {
  const result=run([
    method('mageMoveAim'),method('mageBlink'),
    'const sticks=[{dx:1,dy:0}],p={x:100,y:100,kvx:30,kvy:20},zones=[],breakables=[],mageTargets=()=>[],bossSpark=()=>{};',
    'const safeFloor=(x,y)=>x<144,mageZone=(type,x,y)=>zones.push({type,x,y});',
    'const success=mageBlink(Math.PI),position={...p};p.x=136;const blocked=mageBlink(Math.PI);'
  ],'{success,position,blocked,zones}');
  assert.deepEqual(result,{
    success:undefined,position:{x:140,y:100,kvx:0,kvy:0,sticky:null},blocked:'NO SAFE BLINK',zones:[{type:'decoy',x:100,y:100}]
  });
});

test('a meteor ignites bystanders once even when multiple burning targets are nearby', () => {
  const result=run([
    method('detonateMageMeteor'),
    'const arenaTime=1,first={x:145,y:100,r:10,hp:20,burnUntil:3},second={x:147,y:110,r:10,hp:20,burnUntil:3};',
    'const neighbor={x:185,y:104,r:10,hp:20},covered={x:180,y:112,r:10,hp:20};',
    'const mageTargets=()=>[first,second,neighbor,covered],bossSpark=()=>{},mageArea=()=>{};',
    'const weaponLineClear=(x,y,tx)=>tx!==180,mageHurt=(enemy,damage)=>enemy.hp-=damage;',
    'detonateMageMeteor({x:100,y:100,r:72,power:8.5});'
  ],'{neighbor:neighbor.hp,covered:covered.hp}');
  assert.deepEqual(result,{neighbor:17.9,covered:20});
});

test('weapon choices are class-specific, permanent, and available from level 3', () => {
  const result=run([
    declaration('WEAPON_PATHS'),
    'let hero="classic";const progress={level:2,weapon:null};',
    'const p={a:0},document={querySelector:()=>({hidden:false})};let arrows=[],bowShotCooldown=0;',
    'const inSandbox=()=>false,showItemNotice=()=>{},updateHeroHud=()=>{},hud=()=>{},queueCheckpoint=()=>{},flushCheckpoint=()=>{};',
    ...['equippedWeapon','weaponChoices','validWeaponChoice','runHeroName','levelChoicePending','selectWeapon'].map(method),
    'const stick=equippedWeapon(),early=selectWeapon("sword");progress.level=3;',
    'const wrongClass=selectWeapon("bow"),melee=weaponChoices().map(([id])=>id),selected=selectWeapon("sword");',
    'progress.level=8;const repeat=selectWeapon("bat"),stillSword=equippedWeapon();',
    'hero="archer";progress.level=3;progress.weapon=null;const sling=equippedWeapon(),ranged=weaponChoices().map(([id])=>id);',
    'const selectedRanged=selectWeapon("javelin");'
  ],'{stick,early,wrongClass,melee,selected,repeat,stillSword,sling,ranged,selectedRanged}');
  assert.deepEqual(result,{
    stick:'stick',early:false,wrongClass:false,melee:['sword','bat','flail','spear'],selected:true,repeat:false,
    stillSword:'sword',sling:'sling',ranged:['bow','crossbow','javelin'],selectedRanged:true
  });
});

test('excess XP is banked after two levels and pays for levels on the next floor', () => {
  const result=run([
    method('xpRequirement'),method('advanceRunLevels'),
    'const progress={level:1,xp:300,levelsThisDepth:0};const first=advanceRunLevels(progress),initial={...progress};',
    'const capped=advanceRunLevels(progress);progress.levelsThisDepth=0;const next=advanceRunLevels(progress);'
  ],'{first,initial,capped,next,progress}');
  assert.deepEqual(result,{
    first:2,initial:{level:3,xp:238,levelsThisDepth:2},capped:0,next:2,progress:{level:5,xp:104,levelsThisDepth:2}
  });
});

test('practice XP bypasses the dungeon limit, opens rewards and stops at level 30', () => {
  const result=run([
    'let practice=false,choices=0;const progress={level:1,xp:0,levelsThisDepth:2},sandbox={};',
    'const inSandbox=()=>practice,hud=()=>{},levelChoicePending=()=>progress.level>=3,openElementChoice=()=>choices++;',
    ...['xpRequirement','levelSummary','advanceRunLevels','addPracticeXp'].map(method),
    'addPracticeXp();const outside={...progress};',
    'practice=true;addPracticeXp();const inside={...progress};',
    'progress.level=29;progress.xp=xpRequirement(29)-1;addPracticeXp();const atCap={...progress};addPracticeXp();'
  ],'{outside,inside,atCap,progress,choices}');
  assert.deepEqual(result,{
    outside:{level:1,xp:0,levelsThisDepth:2},inside:{level:3,xp:38,levelsThisDepth:2},
    atCap:{level:30,xp:99,levelsThisDepth:2},progress:{level:30,xp:99,levelsThisDepth:2},choices:2
  });
});

test('sword width, flail ball, and spear tip match their combat geometry', () => {
  const result=run([
    declaration('WEAPON_PATHS'),
    'let cover=false;const hero="classic",p={x:100,y:100,a:0},progress={weapon:null};',
    'const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),weaponLineClear=()=>!cover;',
    ...['equippedWeapon','weaponForm','flailHead','meleeSegment','meleeSweep','meleeHitDamage'].map(method),
    'const stickReach=!!meleeSweep(169,100,3,0);progress.weapon="spear";',
    'const shaft=meleeSweep(138,100,3,0),tip=meleeSweep(169,100,3,0);',
    'const shaftRatio=meleeHitDamage("spear",true,shaft.tip,true)/meleeHitDamage("spear",true,tip.tip,true);',
    'cover=true;const blocked=!!meleeSweep(169,100,3,0);cover=false;',
    'progress.weapon="flail";const chain=!!meleeSweep(140,100,2,0),ball=!!meleeSweep(158,100,2,0);',
    'p.flailLag=.6;const lagged=flailHead(0,.6),trailingBall=!!meleeSweep(100+lagged.x,100+lagged.y,2,0,.6);',
    'p.flailLag=0;progress.weapon="bat";const batWide=!!meleeSweep(145,107,2,0);',
    'progress.weapon="sword";const swordWide=!!meleeSweep(145,107,2,0);'
  ],'{stickReach,shaft:shaft.tip,tip:tip.tip,shaftRatio,blocked,chain,ball,trailingBall,batWide,swordWide}');
  assert.deepEqual(result,{
    stickReach:false,shaft:false,tip:true,shaftRatio:.45,blocked:false,
    chain:false,ball:true,trailingBall:true,batWide:false,swordWide:true
  });
});

test('all five melee weapons get 0.5 more damage on light and heavy hits against enemies and bosses', () => {
  const actual=run([
    declaration('WEAPON_PATHS'),method('meleeHitDamage'),
    'const keys=["stick","sword","bat","flail","spear"];',
    'const damage=keys.map(weapon=>[false,true].flatMap(boss=>[false,true].map(heavy=>meleeHitDamage(weapon,boss,true,heavy))));'
  ],'damage');
  assert.deepEqual(actual,[
    [1.35,2.05,7.5,10.5],[1.5,2.2,7.5,10.5],[1.5,2.5,8.5,12.5],[3,4.9,13.5,20.5],[1.85,2.75,9.5,13.5]
  ]);
});

test('sword bleed refreshes its duration and only hurts vulnerable targets', () => {
  const result=run([
    'let arenaTime=1,bleedStacks=0,mantleCooldown=0,friendlyZones=[];',
    'const hero="classic",equippedWeapon=()=>"sword",temporaryBleed=[];',
    'const normal={hp:4},armored={hp:4,kind:"crystal",armour:1};const enemies=[normal],bossFight={units:[armored]};',
    method('applySwordBleed'),method('updateItemEffects'),
    'applySwordBleed(normal);applySwordBleed(armored);updateItemEffects(1);',
    'arenaTime=2;applySwordBleed(normal);const first=normal.hp;',
    'arenaTime=4.5;armored.armour=0;updateItemEffects(1);const refreshed=normal.hp;',
    'arenaTime=5;updateItemEffects(1);'
  ],'{first,refreshed,finished:normal.hp,armorHP:armored.hp,until:normal.swordBleedUntil}');
  assert.equal(result.first,3.35);
  assert.ok(Math.abs(result.refreshed-2.7)<1e-9);
  assert.equal(result.finished,result.refreshed);
  assert.equal(result.armorHP,4);
  assert.equal(result.until,5);
});

test('ranged weapon power, reload, and pierce profiles stay distinct', () => {
  const shots=run([method('rangedWeaponShot')],`{
    sling:rangedWeaponShot("sling",1),bow:rangedWeaponShot("bow",1),javelin:rangedWeaponShot("javelin",1),
    crossbow:rangedWeaponShot("crossbow",.3),fullBolt:rangedWeaponShot("crossbow",1)
  }`);
  assert.ok(shots.sling.damage<shots.bow.damage);
  assert.ok(shots.sling.impact>=145);
  assert.equal(shots.bow.speed,620);
  assert.equal(shots.crossbow.power,1);
  assert.equal(shots.crossbow.damage,shots.fullBolt.damage);
  assert.ok(shots.crossbow.reload>shots.javelin.reload);
  assert.equal(shots.javelin.pierce,2);
  assert.ok(shots.javelin.speed*shots.javelin.life<shots.bow.speed*shots.bow.life);
});

test('Archer uses the release position and never fires on a cancelled pointer', () => {
  const result = run([
    declaration('BOW_MIN_DRAW'),
    'const hero="archer",R=35,controls={size:100},p={x:10,y:10};',
    'const sticks=[{id:null},{id:7,x:100,y:200,dx:1,dy:0}],arrows=[];',
    'let bowShotCooldown=0,mageGesture=null,editPointer=null;',
    'const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),pt=event=>event;',
    'const combatInputEnabled=()=>true,itemCount=()=>0,upgradeCount=()=>0,equippedWeapon=()=>"bow";',
    method('setStick'), method('bowPower'), method('bowDrawStage'), method('rangedWeaponShot'), method('fireArrow'), method('endCanvasPointer'),
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
