'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {makeGameContext} = require('./game-context.cjs');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('<script>') + '<script>'.length;
const script = html.slice(start, html.indexOf('</script>', start));
const startup = 'requestAnimationFrame(frame)})();';

// Run inside the real game closure. Keep unrelated room hazards out of each case.
function checkAttacks(character) {
 const expect=(value,message)=>{if(!value)throw Error(character+': '+message)};
 const cues=[];
 const originalCue=playSoundCue;
 playSoundCue=id=>{expect(DUNGEON_SOUND[id]?.length,'undefined audio cue '+id);cues.push(id)};
 combatAudio={state:'running'};
 hero=selectedHero=character;
 function setup(){
  p={x:W/2+85,y:F/2,a:0,target:0,vel:0,vx:0,vy:0,kvx:0,kvy:0};
  hp=50;inv=0;over=false;arenaTime=10;armourHp=bodyArmourStats().capacity;
  shieldBroken=true;restoreDashState();resetMageRoom();resetRoomSynergies();
  enemies=[];walls.length=holes.length=0;elementFx=[];bossFight=null;pendingSplits=[];
  projectiles=[];artillery=[];hostileZones=[];gravityWells=[];reactionZones=[];
  puddles=[];poisonPuddles=[];shards=[];playerBleed=[];cues.length=0;
 }
 const foe=shape=>{
  const unit=makeEnemy(shape,W/2,F/2);unit.phaseIn=0;enemies.push(unit);return unit;
 };
 const warning=id=>{
  updateDangerAudio();updateDangerAudio();
  expect(cues.filter(cue=>cue===id).length===1,'warning must play once: '+id);
 };
 const rangedShapes=Array.from(new Set([...RANGED,...Object.keys(ENEMY_PROJECTILES)]));
 for(const shape of rangedShapes){
  setup();
  const unit=foe(shape),kind=enemyShotKind(shape);
  if(kind==='laser'){
   unit.laserClock=0;updateLasers(.01);warning('enemy-ready-beam');
   expect(hp===50,'laser damage during warmup');
   updateLasers(2);expect(unit.laserState==='fire'&&cues.includes('enemy-beam'),'laser failed to fire');
   updateLasers(.16);expect(hp<50,'laser missed its beam center');
   continue;
  }
  unit.shotWindup=.5;unit.shotTarget={x:p.x,y:p.y};
  unit.x-=300;updateDangerAudio();
  expect(!cues.includes('enemy-ready-shot'),shape+' warned from out of range');
  unit.x+=300;
  warning('enemy-ready-shot');
  unit.x-=300;updateDangerAudio();unit.x+=300;
  warning('enemy-ready-shot');
  drawEnemyAttackWarnings();
  expect(hp===50&&!projectiles.length&&!artillery.length,shape+' attacked during windup');
  fireRanged(unit,unit.shotTarget);
  expect(cues.includes(ENEMY_SHOT_SOUNDS[kind]),shape+' missing launch sound');
  if(kind==='cannon'){
   rangedUpdate(.8);warning('warn-artillery');
   expect(hp===50,'shell hit during landing warning');
   rangedUpdate(.6);
   expect(hp<50&&cues.includes('enemy-explosion'),'shell failed to explode');
  }else{
   expect(projectiles.length===ENEMY_PROJECTILES[kind].count,shape+' wrong volley size');
   for(const shot of projectiles)expect(hostileShotAppearance(shot)===kind,shape+' wrong projectile art');
   for(let i=0;i<55&&inv===0;i++)rangedUpdate(.02);
   expect(inv>0,shape+' missed its firing lane');
   if(kind==='spitter')expect(poisonPuddles.length,shape+' missing poison pool');
   else if(kind==='frostcaster')expect(p.slowUntil>arenaTime,shape+' failed to slow');
   else if(kind==='bloodcaster')expect(playerBleed.length,shape+' failed to bleed');
   else expect(hp<50,shape+' failed to deal damage');
  }
 }
 for(const [shape,kind] of Object.entries(ENEMY_SPECIALS)){
  setup();
  const unit=foe(shape);unit.abilityCooldown=0;unit.abilityEnabled=true;
  p.x=unit.x+35;
  const ally=foe('round');ally.x-=15;ally.hp=1;ally.maxHp=12;
  updateEnemyAbility(unit,.01,p,35);
  expect(unit.ability?.kind===kind,shape+' failed to begin '+kind);
  const cue='enemy-ready-'+enemyAbilitySoundGroup(kind);
  warning(cue);drawEnemyAttackWarnings();
  expect(hp===50&&!pendingSplits.length,shape+' resolved during windup');
  updateEnemyAbility(unit,unit.ability.remaining+.01,p,35);
  expect(!unit.ability,shape+' stayed in windup after release');
  if(kind==='bomb'){
   expect(unit.bombTimer>0,'bomb did not arm');
   warning('enemy-ready-fuse'); // The cast and the fuse share the same warning.
   updateEnemyBomb(unit,unit.bombTimer+.01);
   expect(unit.hp<=0&&cues.includes('enemy-explosion')&&hp<50,'bomb did not explode');
  }else{
   expect(cues.includes('enemy-'+enemyAbilitySoundGroup(kind)),shape+' missing ability sound');
   const effects={
    charge:unit.vx>0,feint:unit.vx>0,ricochet:unit.vx>0,
    heal:ally.hp>1,rally:ally.allyBoostUntil>arenaTime,brood:pendingSplits.length===2,
    slam:hp<50,blood:hp<50&&playerBleed.length,fire:hp<50,electric:hp<50,
    water:puddles.length,poison:poisonPuddles.length,gravity:gravityWells.length,
    magnet:hp<50,mirror:hp<50,sponge:hp<50,crystal:shards.length,frost:p.slowUntil>arenaTime
   };
   expect(effects[kind],shape+' missing '+kind+' effect');
  }
 }
 setup();
 const knight=foe('cinderknight');knight.biomeClock=.01;
 updateBiomeEnemy(knight,.02);warning('enemy-ready-lunge');
 updateBiomeEnemy(knight,.75);
 expect(knight.vx>0&&cues.includes('enemy-lunge'),'Cinder Knight failed to lunge');
 setup();
 const guard=foe('rootguard');guard.biomeClock=.01;
 updateBiomeEnemy(guard,.02);warning('enemy-ready-magic');
 expect(hostileZones[0]?.type==='roots'&&hp===50,'Root Guard failed to mark a root patch');
 updateBiomeWorld(1.01);updateBiomeWorld(.66);
 expect(cues.includes('enemy-magic')&&hp<50&&p.slowUntil>arenaTime,'Root Guard patch failed to activate');
 setup();
 const melee=foe('square');melee.x=p.x+7;
 resolveEnemyContact(melee,melee.x,melee.y,p);
 expect(hp<50,'body contact failed to deal damage');

 for(const [id,kind] of [['gatekeeper','cannonball'],['crystal','crystal'],['oracle','crystal']]){
  for(const phase2 of [false,true]){
   setup();startBossFight(id);
   const unit=bossFight.units[0];unit.phase2=phase2;unit.state='shotWarn';
   const segments=[],originalMove=g.moveTo,originalLine=g.lineTo;
   let origin;
   g.moveTo=(x,y)=>{origin={x,y}};
   g.lineTo=(x,y)=>segments.push(Math.atan2(y-origin.y,x-origin.x));
   drawBossHazards();
   g.moveTo=originalMove;g.lineTo=originalLine;
   expect(!bossFight.shots.length,id+' warning fired a projectile');
   fireBossVolley(unit,kind);
   const expectedCount=(id==='gatekeeper'?1:id==='crystal'?3:5)+(phase2?2:0);
   expect(segments.length===expectedCount&&bossFight.shots.length===expectedCount,id+' warning count differs from its volley');
   expect(bossFight.shots.every((shot,i)=>Math.abs(segments[i]-Math.atan2(shot.vy,shot.vx))<1e-9),id+' warning lanes missed the actual direction');
  }
 }
 let signatures=0,steps=0,bosses=0;
 for(const id of Object.keys(BOSS_BLUEPRINTS)){
  setup();startBossFight(id);
  currentRoom.kind='boss';
  const unit=bossFight.units[0];
  unit.timer=0;
  updateBossFight(.01,p.a);
  if(unit.kind==='gatekeeper'){
   expect(unit.state==='chargeWarn',id+' missing charge telegraph');
   warning('warn-charge');
   updateBossFight(unit.timer+.01,p.a);
   expect(unit.state==='charge'&&cues.includes('boss-charge'),id+' never charged audibly');
   p.x=unit.x+17;p.y=unit.y;
   updateBossFight(.01,p.a);
   expect(hp<50,id+' charge did not hit');
   p.x=W*.25;unit.x=W-unit.r-18;unit.aim=0;
   updateBossFight(.01,p.a);
   expect(unit.state==='recover'&&bossFight.hazards.length&&cues.includes('boss-crash'),id+' missing crash hazards or sound');
   unit.timer=0;
   updateBossFight(.01,p.a);warning('warn-volley');
   updateBossFight(unit.timer+.01,p.a);
   expect(bossFight.shots.some(shot=>shot.kind==='cannonball')&&cues.includes('boss-cannon'),id+' did not fire its cannon audibly');
  }else if(unit.kind==='crystal'){
   expect(unit.state==='shotWarn'||unit.state==='breathWarn',id+' missing volley telegraph');
   warning('warn-volley');
   updateBossFight(unit.timer+.01,p.a);
   expect(bossFight.shots.length>0&&cues.includes(id==='hydra'?'boss-breath':'boss-shards'),id+' did not fire a volley audibly');
   unit.timer=0;
   updateBossFight(.01,p.a);
   expect(bossFight.hazards.length&&bossFight.hazards.every(hazard=>!hazard.active),id+' missing field telegraph');
   if(id==='oracle'){
    unit.prismClock=0;updateBossSignature(unit,.01);warning('warn-beam');
    updateBossSignature(unit,1.7);updateBossSignature(unit,.02);
    expect(unit.prismState==='fire'&&hp<50&&cues.includes('boss-beam'),'Oracle beam failed to hit or sound');
   }
  }else{
   expect(unit.state==='jumpWarn',id+' missing landing telegraph');
   warning('warn-area');
   updateBossFight(unit.timer+.01,p.a);
   expect(unit.state==='jump'&&hp===50,id+' hit during its launch');
   unit.turn=1;
   updateBossFight(.76,p.a);
   expect(unit.state==='recover'&&hp<50&&bossFight.hazards.length&&cues.includes('boss-crash'),id+' missing landing damage, hazards or sound');
   expect(enemies.length>0,id+' failed to summon on its second landing');
   for(const summoned of enemies){
    updateEnemyBomb(summoned,.02);
    expect(summoned.hp>0,id+' summoned enemy was treated as an armed bomb');
   }
  }
  bosses++;
  for(const phase2 of [false,true]){
   setup();startBossFight(id);
   const unit=bossFight.units[0];unit.phase2=phase2;
   const signature=buildBossSpecial(unit);
   bossFight.special=signature;
   warning('warn-volley');drawBossSpecial();
   updateBossSpecial(Math.min(...signature.steps.map(step=>step.at))-.01);
   expect(hp===50&&!bossFight.shots.length&&signature.steps.every(step=>!step.hit),id+' resolved before the warning ended');
   for(const step of signature.steps){
    const cueCount=cues.length;
    hp=50;inv=0;over=false;armourHp=bodyArmourStats().capacity;bossFight.shots=[];
    if(step.type==='line'){
     p.x=(step.x1+step.x2)/2;p.y=(step.y1+step.y2)/2;
    }else{
     p.x=step.x+(step.type==='arc'?Math.cos(step.angle)*step.r*.75:0);
     p.y=step.y+(step.type==='arc'?Math.sin(step.angle)*step.r*.75:0);
    }
    if(step.type==='volley'){
     resolveBossSpecialStep(signature,step);
     expect(bossFight.shots.length===step.angles.length,id+' failed to emit its full volley');
     const shot=bossFight.shots[0];
     p.x=shot.x+shot.vx*.06;p.y=shot.y+shot.vy*.06;p.a=Math.atan2(shot.vy,shot.vx);
     bossFight.shots=[shot];updateBossShots(.02,p.a);
    }else{
     expect(!bossSpecialHits(step,p.x+W*2,p.y+F*2),id+' shape hit outside its boundary');
     resolveBossSpecialStep(signature,step);
    }
    expect(hp<50,id+' '+step.type+' missed inside its attack');
    expect(cues.length>cueCount&&cues.at(-1).startsWith('boss-'),id+' '+step.type+' released silently');
    steps++;
   }
   signatures++;
  }
 }
 playSoundCue=originalCue;
 return {ranged:rangedShapes.length,specials:Object.keys(ENEMY_SPECIALS).length,bosses,signatures,steps};
}

for(const [character,name] of [['classic','Stick'],['archer','Sling'],['mage','Apprentice']]){
 test(name+' takes regular enemy attacks and every boss signature in both phases',()=>{
  let result;
  const probe='report(('+checkAttacks.toString()+')('+JSON.stringify(character)+'));\n';
  vm.runInNewContext(script.replace(startup,()=>probe+startup),makeGameContext(value=>{result=value}),{timeout:5000});
  assert.deepEqual({...result},{ranged:12,specials:20,bosses:12,signatures:24,steps:91});
 });
}
