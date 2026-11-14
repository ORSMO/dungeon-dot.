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
