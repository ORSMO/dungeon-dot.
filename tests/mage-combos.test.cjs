'use strict';
// Run from the repository root with Node.js 20+: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptStart = html.indexOf('<script>') + '<script>'.length;
const source = html.slice(scriptStart, html.indexOf('</script>', scriptStart));
const startup = 'requestAnimationFrame(frame)})();';
assert.ok(source.includes(startup), 'Game startup is available for the simulation.');

const {makeGameContext} = require('./game-context.cjs');

// Insert the probe into the game's closure so it can exercise real casts and ticks.
function runComboChecks(testSchool) {
  function goodCast(path) {
    mageMana=100;mageGlobalReady=0;mageCooldowns={};
    const cost=mageSpell(path).mana;
    if (!castMageSpell(path)||mageMana!==100-cost) throw Error('Cast or mana cost failed: '+path+' '+mageLastCast);
  }
  function magicTicks(count) {
    for (let i=0;i<count;i++){arenaTime+=.033;updateMage(.033)}
  }
  function dummy(x,y,health=20) {
    const enemy=makeEnemy('round',x,y);enemy.hp=enemy.maxHp=health;enemies.push(enemy);return enemy;
  }
  const combos={
   apprentice:{
    AB:({target,cast})=>{
     cast();if(target.hp>=60||target.vx<=0||target.burnUntil)throw Error('Rune Burst did not hit and push with non-elemental magic');
    },
    AC:({target,cast,tick})=>{
     target.x=p.x+105;
     const left=dummy(p.x+127,p.y-30),right=dummy(p.x+127,p.y+30);
     cast();tick(12);
     if(left.hp>=20||right.hp>=20)throw Error('Twin Bolts did not hit the separate lanes');
    },
    BA:({target,cast,tick})=>{
     const second=dummy(p.x+103,p.y),third=dummy(p.x+144,p.y);
     cast();tick(15);
     if(target.hp>=60||second.hp>=20||third.hp!==20)throw Error('Force Lance did not pierce exactly one enemy');
    },
    BC:({target,cast,tick})=>{
     const second=dummy(target.x,target.y-16),third=dummy(target.x,target.y+16);
     cast();tick(3);
     if(!(target.slowUntil>arenaTime&&second.slowUntil>arenaTime)||third.slowUntil>arenaTime)throw Error('Snare Field did not slow exactly two enemies');
    },
    CA:({cast})=>{
     cast();damagedHealth(2,true);
     if(!mageActiveZone('apprenticeWard')||damagedHealth(10)!==43.25||damagedHealth(10)!==41)throw Error('Ward Rune did not reduce exactly one direct hit');
    },
    CB:({target,cast})=>{
     const other=dummy(p.x+103,p.y);
     cast();if(target.hp>=60||other.hp>=20||other.vx>=0)throw Error('Gathering Sigil did not pull the group toward the aim point');
    },
    ABC:({target,cast,tick})=>{
     cast();tick(8);
     if(target.hp!==60)throw Error('Arcane Wave hit before its warning');
     tick(6);if(target.hp>=60||target.vx<=0)throw Error('Arcane Wave did not release a hit and knockback');
    }
   },
   summoner:{
    BA:({target,cast,tick})=>{cast();tick(9);if(!(target.spiritMarkUntil>arenaTime))throw Error('Spirit Dart did not mark')},
    AC:({target,cast,tick})=>{
     mageSummon('familiar',p.x+90,p.y);const pet=mageSummons[0];cast();tick(7);
     if(pet.x>=p.x+65||target.vx===0)throw Error('Recall did not pull the pet back and shove the enemy');
    },
    CA:({target,cast})=>{
     mageSummon('guardian',p.x+180,p.y);cast();if(mageSummons[0].x!==p.x+76)throw Error('Guardian Step did not move the guardian');
     if(target.hp>=60)throw Error('Guardian Step did not slam on landing');
     mageGlobalReady=0;mageCooldowns={};const mana=mageMana;
     if(castMageSpell('CA')||mageMana!==mana||mageCooldowns.CA)throw Error('Guardian Step charged for an unchanged position');
    },
    CB:({cast})=>{
     mageSummon('familiar',p.x+25,p.y);mageSummon('familiar',p.x+28,p.y);dummy(p.x+95,p.y+20);
     cast();if(new Set(mageSummons.map(unit=>unit.command?.target)).size!==2)throw Error('Twin Hunt shared a target');
    },
    ACB:({target,cast,tick})=>{
     mageSummon('guardian',target.x,target.y);mageSummon('familiar',target.x,target.y);
     for(const unit of mageSummons)unit.attackAt=arenaTime+20;
     cast();tick(22);if(Math.abs(60-target.hp-7*playerStats().damage)>1e-8)throw Error('Spirit Relay hit the same target more than once');
     mageSummons=mageSummons.filter(unit=>unit.type==='guardian');target.hp=60;
     goodCast('ACB');tick(12);if(Math.abs(60-target.hp-7*playerStats().damage)>1e-8)throw Error('Spirit Relay did not work with just the guardian');
    },
    ABC:({target,cast,tick})=>{
     mageSummon('familiar',p.x-45,p.y);cast();
     const guardian=mageSummons.find(unit=>unit.type==='guardian');
     if(!guardian||target.hp!==60||mageSummons.length!==2)throw Error('Guardian Pact did not deploy with a telegraphed slam');
     tick(7);if(target.hp>=60)throw Error('Guardian Pact failed to damage a close target on arrival');
     const shot={x:guardian.x+30,y:guardian.y,r:3,life:1};
     if(!mageBlocksShot(shot,guardian.x-30,guardian.y)||shot.life!==0)throw Error('Guardian Pact did not intercept a crossing hostile shot');
     const reflected={...shot,life:1,reflected:true};
     if(mageBlocksShot(reflected,guardian.x-30,guardian.y))throw Error('Guardian Pact intercepted a friendly shot');
     sticks[0].dy=1;goodCast('ABC');
     const replacement=mageSummons.filter(unit=>unit.type==='guardian');
     if(replacement.length!==1||replacement[0].y<=p.y+65)throw Error('Guardian Pact did not replace the old guardian in the movement direction');
     tick(182);if(mageSummons.some(unit=>unit.type==='guardian'))throw Error('The guardian outlasted its duration');
    },
    BAC:({target,cast,tick})=>{
     cast();if(mageBolts.length!==3)throw Error('Stampede did not launch its three lanes');tick(10);
     if(target.hp>=60)throw Error('Stampede missed its lane');
    },
    BCA:({cast})=>{cast();if(Math.abs(damagedHealth(10)-44.6)>1e-8)throw Error('Sanctuary did not absorb 40%')},
    CAB:({target,cast,tick})=>{
     cast();if(mageDecoyTarget(target)!==mageActiveZone('lure'))throw Error('Astral Lure did not attract');
     tick(85);if(target.hp>=60||mageActiveZone('lure'))throw Error('Astral Lure did not burst');
    },
    CBA:({cast})=>{
     cast();if(mageSummons.length!==1||!(mageSummons[0].empoweredUntil>arenaTime))throw Error('Grand Conjuration did not empower its fallback familiar');
    }
   },
   necromancer:{
    AB:({cast,tick})=>{
     enemies=[];startBossFight('gatekeeper');const boss=bossFight.units[0];boss.x=p.x+90;boss.y=p.y;
     const health=boss.hp,shield=bossFight.shieldHp;
     cast();tick(8);
     if(boss.hp!==health||bossFight.shieldHp>=shield||boss.graveMarkUntil<=arenaTime)throw Error('Grave Mark did not stick through the shield');
     mageHurt(boss,1.85);mageHurt(boss,1.85);
     if(mageSouls)throw Error('Simultaneous hits paid out a Soul');
     arenaTime+=.32;mageHurt(boss,1.85);arenaTime+=.32;mageHurt(boss,1.85);
     if(mageSouls!==1)throw Error('Three spaced shield hits did not earn a Soul');
    },
    BC:({target,cast})=>{
     const mana=mageMana;
     if(castMageSpell('BC')||mageMana!==mana||mageCooldowns.BC)throw Error('Corpse Burst charged without a body or Soul');
     mageSouls=1;mageCorpses=[{x:target.x-10,y:target.y,until:arenaTime+8}];
     cast();
     if(mageCorpses.length||mageSouls!==1||target.hp>=60)throw Error('Corpse Burst did not use the nearby corpse first');
     const before=target.hp;
     goodCast('BC');
     if(mageSouls||target.hp>=before)throw Error('Corpse Burst did not use one Soul when no body remained');
    },
    BA:({target,cast,tick})=>{const second=dummy(p.x+102,p.y);cast();tick(12);if(target.hp>=60||second.hp>=20)throw Error('Bone Spear did not pierce')},
    AC:({target,cast,tick})=>{cast();tick(1);if(!(target.mageStasisUntil>arenaTime))throw Error('Grave Snare did not restrain')},
    CA:({cast})=>{
     mageSouls=1;cast();
     if(damagedHealth(2,true)!==48.2||!mageActiveZone('boneGuard'))throw Error('Bleeding used up Bone Guard');
     if(mageSouls||Math.abs(damagedHealth(10)-44.15)>1e-8||damagedHealth(10)!==41)throw Error('Bone Guard did not guard exactly one hit');
    },
    CB:({target,cast})=>{
     hp=30;target.hp=1;target.graveMarkUntil=arenaTime+5;cast();
     if(hp!==32||target.hp>0)throw Error('Soul Rend did not heal after the marked kill');
    },
    ABC:({target,cast,tick})=>{
     const mana=mageMana;
     if(castMageSpell('ABC')||mageMana!==mana||mageCooldowns.ABC)throw Error('Raise the Fallen charged without a Soul or corpse');
     mageCorpses=[{x:p.x+28,y:p.y,until:arenaTime+8}];
     cast();
     if(mageCorpses.length||mageSummons.filter(unit=>unit.type==='skeleton').length!==1)throw Error('No-Soul Raise did not animate one corpse');
     tick(34);if(target.hp>=60)throw Error('Raised skeleton never reached and damaged its target');
     mageSummons=[];mageSouls=3;
     dummy(p.x+104,p.y-44);dummy(p.x+108,p.y+50);
     goodCast('ABC');
     if(mageSouls||mageSummons.filter(unit=>unit.type==='skeleton').length!==3)throw Error('Raise the Fallen did not convert three Souls into three skeletons');
     if(new Set(mageSummons.map(unit=>unit.command?.target)).size!==3||new Set(mageSummons.map(unit=>unit.attackAt)).size!==3)throw Error('Raised skeletons did not coordinate separate targets or stagger their attacks');
     mageSouls=1;mageGlobalReady=0;mageCooldowns={};
     const after=mageMana;
     if(castMageSpell('ABC')||mageSouls!==1||mageMana!==after||mageSummons.length!==3)throw Error('Raise the Fallen spent resources while all skeleton slots were occupied');
    },
    ACB:({target,cast,tick})=>{
     mageCorpses=[0,12,24].map(n=>({x:target.x+n,y:target.y,until:arenaTime+8}));
     cast();if(mageCorpses.length||mageZones.filter(zone=>zone.type==='comboBurst').length!==3)throw Error('Grave Dominion did not consume three corpses');
     tick(41);if(target.hp>=46)throw Error('Grave Dominion did not run its blast sequence');
    },
    BAC:({target,cast})=>{
     const second=dummy(target.x,target.y+25,60);target.graveMarkUntil=arenaTime+3;cast();
     if(!(target.hp<second.hp&&second.hp<60))throw Error('Reaper’s Scythe missed its mark bonus');
    },
    BCA:({cast,tick})=>{
     cast();if(!walls.some(wall=>wall.mageBone))throw Error('Ossuary did not place a barricade');
     tick(123);if(walls.some(wall=>wall.mageBone))throw Error('Ossuary barricade did not expire');
    },
    CAB:({target,cast,tick})=>{
     mageSouls=1;target.hp=1;const neighbor=dummy(target.x+28,target.y);
     cast();if(target.graveMarkUntil<=arenaTime)throw Error('Haunt did not immediately mark its target');tick(26);
     if(mageSouls||target.hp>0||neighbor.hp>=20||mageActiveZone('haunt'))throw Error('Haunt did not spend a Soul and burst');
    },
    CBA:({target,cast})=>{
     const second=dummy(p.x+102,p.y);target.graveMarkUntil=arenaTime+5;cast();
     if(mageSouls!==1||!(second.graveMarkUntil>arenaTime))throw Error('Soul Harvest did not mark the group and collect one Soul');
     second.hp=0;goodCast('CBA');
     if(mageSouls!==1)throw Error('Soul Harvest paid twice for one target');
    }
   },
   pyromancer:{
    BA:({target,cast,tick})=>{
     const neighbor=dummy(p.x+90,p.y+10);cast();tick(9);
     if(target.hp>=60||neighbor.hp>=20||!(neighbor.burnUntil>arenaTime))throw Error('Cinder Shot did not splash and ignite');
    },
    AC:({target,cast,tick})=>{
     target.x=p.x+91;cast();tick(1);
     if(mageZones.filter(zone=>zone.type==='trail').length!==5||target.hp>=60)throw Error('Wall of Fire did not spread across aim');
    },
    CA:({cast})=>{
     const flanker=dummy(p.x+41,p.y+56);
     mageZone('trail',p.x+20,p.y,24,3,1);cast();
     if(flanker.vy<=0)throw Error('Backdraft did not widen near fire');
    },
    CB:({target,cast})=>{
     target.burnUntil=arenaTime+3;target.burnPower=1;cast();
     if(target.burnUntil>arenaTime||target.hp>=60)throw Error('Flashpoint did not spend the burn');
    },
    ACB:({target,cast,tick})=>{
     for(const offset of [-15,0,15])mageZone('trail',target.x+offset,target.y,24,2,1);
     cast();const storm=mageActiveZone('firestorm');
     if(!storm||storm.r!==87||mageZones.some(zone=>zone.type==='trail'&&zone.life>0))throw Error('Firestorm did not consume its three patches');
     tick(38);if(target.hp>=57)throw Error('Firestorm did not damage repeatedly');
    },
    BAC:({target,cast,tick})=>{
     walls.push({x:p.x+100,y:p.y-55,w:27,h:110,type:'neutral'});
     const covered=dummy(p.x+150,p.y);cast();tick(14);
     if(target.hp>=60||covered.hp!==20)throw Error('Scorching Ray ignored cover or missed');
    },
    BCA:({cast})=>{
     cast();damagedHealth(2,true);
     if(mageBolts.length||!mageActiveZone('phoenixGuard'))throw Error('Bleeding set off Phoenix Guard');
     if(damagedHealth(10)!==41||mageBolts.length!==8||mageActiveZone('phoenixGuard'))throw Error('Phoenix Guard did not return eight bolts');
     damagedHealth(10);if(mageBolts.length!==8)throw Error('Phoenix Guard triggered twice');
    },
    CAB:({target,cast,tick})=>{
     cast();if(mageZones.filter(zone=>zone.type==='comboBurst').length!==3)throw Error('Fissure did not stage three eruptions');
     tick(36);if(Math.abs(60-target.hp-7.4*playerStats().damage)>1e-8)throw Error('Fissure touched one target more than once');
    },
    CBA:({target,cast})=>{
     target.burnUntil=arenaTime+1;const other=dummy(target.x+35,target.y);cast();
     if(!(other.burnUntil>arenaTime&&target.burnUntil>=arenaTime+3.5))throw Error('Wildfire did not spread or extend its burns');
    }
   },
   arcane:{
    BA:({target,cast,tick})=>{
     cast();tick(9);
     if(target.hp>=60||mageBolts.filter(bolt=>bolt.life>0&&bolt.hit.has(target)).length!==2)throw Error('Prism Shot did not split');
    },
    AC:({cast,tick})=>{
     cast();goodCast('AB');tick(8);
     if(!mageBolts.some(bolt=>bolt.bounces===1&&Math.abs(bolt.vy)>120))throw Error('Mirror Rune did not turn the orb');
    },
    CA:({cast})=>{
     cast();const field=mageActiveZone('slowShot');
     if(mageShotSpeed({x:field.x,y:field.y})!==.48||mageShotSpeed({x:field.x,y:field.y,reflected:true})!==1)throw Error('Slow Field did not distinguish hostile and friendly shots');
    },
    CB:({target,cast})=>{
     mageZone('decoy',target.x,target.y+80,24,2,2.6);cast();
     if(target.vy<=0||target.hp>=60)throw Error('Displace did not shove toward the decoy');
    },
    ACB:({cast})=>{
     cast();const gate=mageActiveZone('rift');for(let i=0;i<3;i++)goodCast('A');
     if(gate.charges!==0||gate.life>0||mageBolts.some(bolt=>Math.hypot(bolt.x-gate.x,bolt.y-gate.y)>23))throw Error('Rift Gate did not redirect three casts');
     goodCast('A');if(mageBolts.at(-1).x>p.x+30)throw Error('Rift Gate redirected an extra cast');
    },
    BAC:({cast})=>{
     cast();const orbit=mageActiveZone('orbit');
     for(let i=0;i<3;i++){
      const point=mageOrbPosition(orbit,i),shot={...point,life:1,r:3};
      if(!mageBlocksShot(shot,point.x-4,point.y))throw Error('Orbiting shield did not intercept');
     }
     if(orbit.life>0||orbit.shields.some(Boolean))throw Error('Orbiting shields did not exhaust');
    },
    BCA:({cast,tick})=>{
     const x=p.x,y=p.y;cast();p.x+=42;p.y+=45;tick(94);
     if(p.x!==x||p.y!==y)throw Error('Phase Anchor did not return to the starting point');
    },
    CAB:({target,cast})=>{
     for(let i=1;i<=5;i++)dummy(target.x+i*36,target.y,60);
     cast();if(enemies.filter(enemy=>enemy.hp<60).length!==5)throw Error('Arc Chain exceeded or missed its target count');
    },
    CBA:({target,cast,tick})=>{
     startBossFight('gatekeeper');const boss=bossFight.units[0];boss.x=target.x+23;boss.y=target.y+28;
     const health=boss.hp,shield=bossFight.shieldHp;cast();tick(1);
     if(!(target.mageStasisUntil>arenaTime)||boss.mageStasisUntil||boss.hp!==health||bossFight.shieldHp>=shield)
      throw Error('Stasis Field did not restrain the mob and damage the boss shield');
    }
   }
  };
  let advancedCount=0;
  for(const [school,checks] of Object.entries(combos)){
   if(school!==testSchool)continue;
   selectedHero='mage';beginNewSlot(1,true);enterSandbox();
   if(school!=='apprentice'){
    progress.level=3;openElementChoice();selectMageSchool(school);
   }
   document.querySelector('#sandbox-panel').hidden=true;
   for(const [path,check] of Object.entries(checks)){
    resetMageRoom();mageSouls=0;enemies=[];bossFight=null;walls.length=0;breakables.length=0;
    projectiles=[];p.x=420;p.y=370;p.a=p.target=0;p.kvx=p.kvy=0;hp=50;inv=0;sandbox.attacks=true;
    sticks[0].dx=sticks[0].dy=0;
    const target=dummy(p.x+62,p.y,60);
    try{check({target,cast:()=>goodCast(path),tick:magicTicks})}
    catch(error){throw Error(school+'/'+path+': '+error.message)}
    drawMageEffects();advancedCount++;
   }
   leaveSandbox();
  }
  return advancedCount;
}

for (const [school,total] of [['apprentice',7],['summoner',10],['necromancer',12],['pyromancer',9],['arcane',9]]) {
  test(school+' casts and applies all '+total+' combinations in the game runtime', () => {
    let count;
    const probe = 'report((' + runComboChecks.toString() + ')(' + JSON.stringify(school) + '));';
    vm.runInNewContext(source.replace(startup, () => probe + startup), makeGameContext(value=>{count=value}), {timeout:5000});
    assert.equal(count, total);
  });
}
