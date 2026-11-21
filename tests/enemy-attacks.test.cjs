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

test('the first combat room teaches all three classes, retries cleanly, and only rewards a full clear',()=>{
 const probe=`
  const passed=[];
  const check=(value,reason)=>{if(!value)throw Error(hero+': '+reason)};
  for(const character of ['classic','archer','mage']){
   selectedHero=character;beginNewSlot(1,true);
   const entry=dungeon[0].doors[0],room=dungeon[entry.to],side=DIRECTIONS[entry.side].opposite;
   check(hp===50&&lives===3&&room.openingLesson,'starting stats or lesson marker');
   enterRoom(room.id,side);
   const clean=()=>[walls,holes,portals,floorTraps,breakables,dungeonNests,wallFixtures].every(items=>!items.length)&&!dungeonEvent;
   const first=()=>enemies.length===1&&enemies[0].shape===(character==='classic'?'square':'round')&&!enemies[0].abilityEnabled;
   check(first()&&clean()&&!room.cleared&&!document.querySelector('#opening-guide').hidden,'opening room or first lesson '+JSON.stringify({first:first(),layout:[walls,holes,portals,floorTraps,breakables,dungeonNests,wallFixtures].map(items=>items.length),event:!!dungeonEvent,cleared:room.cleared,guide:document.querySelector('#opening-guide').hidden,enemies:enemies.map(e=>e.shape)} ));
   const kill=()=>{for(const enemy of enemies)enemy.hp=0;collectDefeatedEnemies();enemies=[];updateRoomProgress()};
   kill();
   check(enemies.length===1&&enemies[0].shape==='shooter'&&openingWave===1&&!room.cleared&&!room.clearRewarded,'marksman wave or premature reward');
   hp=1;inv=0;hp=damagedHealth(20,false,'shot');over=hp<=0;resolvePlayerDeath();
   check(first()&&hp===50&&lives===2&&openingWave===0,'death did not reset the lesson');
   check(document.querySelector('#item-notice').textContent.includes('Enemy projectile'),'death recap lacks the cause');
   kill();kill();
   check(room.cleared&&room.clearRewarded&&progress.roomsCleared===1&&document.querySelector('#opening-guide').hidden,'completion not rewarded exactly once');
   flushCheckpoint();
   check(continueSlot(1)&&currentRoom.openingLesson&&currentRoom.cleared&&enemies.length===0,'saved lesson cleared did not reopen safely');
   const old=readSlot(1).data;delete old.dungeon[room.id].openingLesson;
   localStorage.setItem(slotKey(2),JSON.stringify(old));
   check(continueSlot(2)&&!currentRoom.openingLesson&&currentRoom.cleared,'old save unexpectedly gained a lesson');
   dungeonDepth=2;selectedBiome='red';buildDungeon();
   check(!dungeon.some(room=>room.openingLesson),'lesson repeated on a deeper floor');
   passed.push(character);
  }
  report(passed);
 `;
 let result;
 vm.runInNewContext(script.replace(startup,()=>probe+startup),makeGameContext(value=>{result=value}),{timeout:5000});
 assert.deepEqual(Array.from(result),['classic','archer','mage']);
});

test('authored encounters keep every doorway and objective reachable across biomes and classes',()=>{
 const probe=`
  const variants=[null,'red','green','blue'],passed=[];
  for(const character of ['classic','archer','mage']){
   selectedHero=character;beginNewSlot(1,true);
   for(const biome of variants){
    dungeonDepth=biome===null?1:2;selectedBiome=biome;buildDungeon();
    const id=biome??'basic',matches=dungeon.filter(room=>room.encounter===id);
    const check=(value,reason)=>{if(!value)throw Error(character+' / '+id+': '+reason)};
    check(matches.length===1&&!matches[0].openingLesson&&validateDungeonTopology(dungeon),'bad encounter assignment');
    const room=matches[0],entry=room.doors[0].side;
    enterRoom(room.id,entry);
    check(enemies.length===8&&!dungeonEvent&&!portals.length,'unexpected roster, event or portal');
    const startPoints=[[62,F/2],[W-62,F/2],[W/2,62],[W/2,F-62]];
    for(const e of enemies){
     check(safeFloor(e.x,e.y,e.r+2),'spawn in blocked geometry: '+e.shape);
     check(startPoints.every(([x,y])=>Math.hypot(x-e.x,y-e.y)>75),'spawn crowds a door: '+e.shape);
    }
    // Flood-fill a player-radius route over the full authored floor.
    const step=8,key=(x,y)=>x+','+y,queue=[[W/2,F/2]],seen=new Set([key(W/2,F/2)]);
    for(let i=0;i<queue.length;i++){
     const [x,y]=queue[i];
     for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){
      const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(!seen.has(k)&&safeFloor(nx,ny,9)){seen.add(k);queue.push([nx,ny])}
     }
    }
    const targets=[...startPoints,...enemies.map(e=>[e.x,e.y]),...dungeonNests.map(n=>[n.x,n.y])];
    for(const [x,y] of targets)check(queue.some(([a,b])=>Math.hypot(x-a,y-b)<=12),'route to objective blocked');
    check(!document.querySelector('#opening-guide').hidden,'missing encounter hint');
    if(id==='basic'){
     const bolt=wallFixtures[0],shooter=enemies.find(e=>e.shape==='shooter');
     p.x=bolt.x+40;p.y=bolt.y;arenaTime=bolt.readyAt+1;shooter.shotWindup=.5;
     updateWallFixtures(.01);check(!bolt.warnUntil,'bolt stacked with ranged windup');
     shooter.shotWindup=0;updateWallFixtures(.01);check(bolt.warnUntil>arenaTime,'wall bolt did not start');
    }else if(id==='red'){
     check(floorGaps.length===2&&floorBridges.length===2&&wallFixtures[0]?.kind==='brazier','missing Foundry features');
     check(floorVoid(.35*W,.29*F)&&!floorVoid(.35*W,.5*F)&&!floorVoid(.35*W,.10*F),'lava crossing lacks a bridge or outside route');
    }else if(id==='green'){
     const nest=dungeonNests[0];
     enemies=[];updateRoomProgress();check(!room.cleared&&nest.hp===8,'nest did not gate the clear');
     nest.spawned=nest.spawnLimit;nest.clock=0;updateDungeonMechanics(.1);
     check(enemies.length===0,'nest ignored reinforcement cap');
     nest.hp=0;
    }else{
     p.x=W/2;p.y=F/2;check(groundSlideFactor()===1,'middle Frost lane is slippery');
     p.x=terrainPatches[0].x;p.y=terrainPatches[0].y;check(groundSlideFactor()>1,'missing ice lane');
    }
    enemies=[];updateRoomProgress();check(room.cleared&&document.querySelector('#opening-guide').hidden,'clear did not unlock');
    flushCheckpoint();
    check(continueSlot(1)&&currentRoom.cleared&&currentRoom.encounter===id&&enemies.length===0,'encounter changed or respawned after reload');
    passed.push(character+'/'+id);
   }
  }
  report(passed.length);
 `;
 let result;
 vm.runInNewContext(script.replace(startup,()=>probe+startup),makeGameContext(value=>{result=value}),{timeout:5000});
 assert.equal(result,12);
});

test('all boss entrances become locked Old Dungeon routes and advance depth after victory',()=>{
 const probe=`
  const check=(value,reason)=>{if(!value)throw Error(reason)};
  selectedHero='classic';beginNewSlot(1,true);
  for(const side of Object.keys(DIRECTIONS)){
   const room=dungeon.find(r=>r.kind==='boss');
   enterRoom(room.id,side);room.doors[0].side=side;
   const doors=roomDoors(),keep=doors.find(door=>door.side===side);
   check(doors.length===4&&new Set(doors.map(d=>d.side)).size===4,'boss gates need four distinct sides');
   check(keep.kind==='biome'&&keep.biome==='basic'&&doors.every(d=>d.kind==='biome'),'entrance still points back');
   roomEntrySide=null;check(roomDoors().find(d=>d.biome==='basic').side===side,'save reload lost the entrance');
   const depth=dungeonDepth,dir=DIRECTIONS[side];
   p.x=keep.x;p.y=keep.y;sticks[0].dx=dir.dx;sticks[0].dy=dir.dy;doorCooldown=0;
   checkRoomDoors(.01);check(dungeonDepth===depth&&currentRoom===room,'locked entrance advanced the run');
  }
  const room=currentRoom,gate=roomDoors().find(d=>d.biome==='basic'),dir=DIRECTIONS[gate.side];
  dungeonDepth=3;room.bossDefeated=true;room.cleared=true;progress.levelsThisDepth=2;
  p.x=gate.x;p.y=gate.y;sticks[0].dx=dir.dx;sticks[0].dy=dir.dy;doorCooldown=0;
  checkRoomDoors(.01);check(dungeonDepth===3&&currentRoom===room,'entrance skipped the victory recap');
  room.victoryRecapSeen=true;checkRoomDoors(.01);
  check(dungeonDepth===4&&selectedBiome===null&&currentRoom.kind==='start'&&progress.levelsThisDepth===0,'Old Dungeon route did not start a fresh deeper floor');
  flushCheckpoint();
  check(continueSlot(1)&&dungeonDepth===4&&selectedBiome===null&&currentRoom.kind==='start','Old Dungeon route did not survive save reload');
  report(true);
 `;
 let result;
 vm.runInNewContext(script.replace(startup,()=>probe+startup),makeGameContext(value=>{result=value}),{timeout:5000});
 assert.equal(result,true);
});

test('the first regular room after the lesson eases the population spike for each class',()=>{
 const probe=`
  const checks=[];
  for(const character of ['classic','archer','mage']){
   selectedHero=character;beginNewSlot(1,true);
   let seed=19247;
   Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
   lastDungeonSignature='';buildDungeon();enterRoom(0);
   const lesson=dungeon[dungeon[0].doors[0].to];
   const room=lesson.doors.map(door=>dungeon[door.to]).find(r=>r.shape==='big'&&followsOpeningLesson(r));
   if(!room)throw Error('Fixed seed lost its large room after the lesson');
   enterRoom(room.id,room.doors.find(door=>door.to===lesson.id).side);
   if(dungeonEvent||enemies.length!==room.count)throw Error('Early room has an event or wrong population');
   checks.push(room.count);
  }
  report(checks);
 `;
 let result;
 vm.runInNewContext(script.replace(startup,()=>probe+startup),makeGameContext(value=>{result=value}),{timeout:5000});
 assert.deepEqual(Array.from(result),[12,9,9]);
});

test('deep trials grant seals only on live clears and survive a reload without replaying evolution',()=>{
 const probe=`
  const check=(value,message)=>{if(!value)throw Error(message)};
  const snapshotDepths=[];
  selectedHero='mage';beginNewSlot(1,true);
  progress.level=7;progress.mageSchool='arcane';progress.xp=xpRequirement(7)-1;
  gainRunXp(1);
  check(hasEvolved()&&evolutionAt===arenaTime&&document.querySelector('#element-choice').hidden,'evolution cue or modal');
  for(const depth of [5,8,12]){
   for(const biome of [null,'red','green','blue']){
    dungeonDepth=depth;selectedBiome=biome;buildDungeon();enterRoom(0);
    const encounter=dungeon.find(room=>room.encounter),trial=DEEP_TRIALS[depth];
    check(!trial.veterans||dungeon[0].doors[0].to===encounter.id,'veterans were not on the route');
    enterRoom(encounter.id,encounter.doors[0].side);
    const count=enemies.filter(enemy=>enemy.elite).length;
    check(count===trial.veterans&&enemies.length===8&&enemies.every(e=>safeFloor(e.x,e.y,e.r+2)),'wrong veteran count or blocked spawn: '+biome);
    enemies=[];for(const nest of dungeonNests)nest.hp=0;updateRoomProgress();
    const boss=dungeon.find(room=>room.kind==='boss');enterRoom(boss.id,boss.doors[0].side);
    check(bossFight.shieldHp===bossShieldCapacity(depth),'trial affected boss shield');
    const unit=bossFight.units[0];
    bossFight.specialCooldown=0;updateBossSpecial(0);
    check(bossFight.specialCooldown===7.2*trial.signaturePace&&bossFight.special.steps.every(step=>step.at>=.9),'signature timing or warning');
    if(biome!=='blue')continue;
    const earned=progress.trialsCleared.length;
    for(const member of bossFight.units)member.hp=0;
    finishBossFight();finishBossFight();
    check(progress.trialsCleared.length===earned+1&&progress.trialsCleared.at(-1)===depth,'wrong seal count');
    flushCheckpoint();
    check(continueSlot(1)&&progress.trialsCleared.includes(depth)&&hasEvolved()&&evolutionAt===-Infinity,'seal save/load or replayed evolution');
    snapshotDepths.push(depth);
   }
  }
  dungeonDepth=12;currentRoom={kind:'sandbox'};startBossFight('gatekeeper');
  check(bossFight.trialSignaturePace===1&&bossFight.shieldMax===50,'practice inherited a trial');
  finishBossFight();
  check(progress.trialsCleared.join(',')==='5,8,12','practice changed earned seals');
  report(snapshotDepths);
 `;
 let result;
 vm.runInNewContext(script.replace(startup,()=>probe+startup),makeGameContext(value=>{result=value}),{timeout:5000});
 assert.deepEqual(Array.from(result),[5,8,12]);
});
