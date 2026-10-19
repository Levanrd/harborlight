import {constructionSecond} from './upgradeConstruction';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCity,build,roadPath,decodeCity,constructionChange,undoConstruction,tick,type City} from './simulation';
import {emptyProduction,applyHomeUpgrade,queueProduction,productionSecond,collectProduction} from './production';
import {cityProgress,buildingLock,materialLock,upgradeFactory,factoryType,awardHomeXP} from './progression';

const finish=(c:City)=>{for(let i=0;i<45;i++)c=constructionSecond(c,new Set(Object.keys(c.cells)));return c;};
const conditions={supplied:true,landValue:90,school:true,happiness:80};
function town(){let c=build(createCity(false),'road',roadPath({x:-3,z:0},{x:5,z:0})).city;for(const [kind,x]of [['utility',-3],['residential',0],['industrial',4]] as const)c=build(c,kind,[{x,z:1}]).city;c.cells['0,1']={...c.cells['0,1'],age:20,occupancy:12};c.cells['4,1']={...c.cells['4,1'],age:20,occupancy:16};return c;}
const stocked=():City=>({...town(),production:{...emptyProduction(),inventory:{wood:8,metal:8,stone:8,planks:8,nails:8,bricks:8}}});

test('city levels use exact cumulative XP thresholds and never depend on population',()=>{
  for(const [xp,level]of [[0,1],[99,1],[100,2],[299,2],[300,3],[599,3],[600,4],[999,4],[1000,5],[1200,5]]){const c=town();c.progression!.xp=xp;assert.equal(cityProgress(c).current.level,level);}
  assert.equal(cityProgress(createCity()).current.level,1);
});
test('the first residential upgrade is reachable with only starting materials and grants its milestone once',()=>{
  let c=town();
  // Entire starter recipe produced through real queues, without seeding inventory.
  for(const material of ['wood','metal','metal','planks','nails'] as const){const before=c;c=queueProduction(c,'4,1',material,true).city;assert.notEqual(c,before);for(let i=0;i<10;i++)c={...c,production:productionSecond(c,new Set(['4,1']))};c=collectProduction(c,'4,1').city;}
  const money=c.money,result=applyHomeUpgrade(c,'0,1',conditions);c=result.city;assert.equal(c.progression!.xp,0);assert.equal(c.cells['0,1'].level,1);assert.equal(c.money,money-300);c=finish(c);
  assert.equal(c.progression!.xp,100);assert.equal(cityProgress(c).current.level,2);assert.equal(c.money,money-300+750);assert.equal(c.cells['0,1'].occupancy,12);
  assert.equal(c.production!.inventory.planks,0);assert.match(result.message,/upgrade started/);
  assert.equal(applyHomeUpgrade(c,'0,1',conditions).city,c);
  const loaded=decodeCity(JSON.parse(JSON.stringify(c)));assert.equal(loaded.money,c.money);assert.equal(loaded.progression!.xp,100);assert.equal(tick(loaded).progression!.xp,100);
});
test('build and queue actions enforce unlocks without spending funds or changing the city',()=>{
  const c=town();for(const kind of ['school','playground','police','sports','power','water','sewage','recycling','largepark']){assert.ok(buildingLock(c,kind));assert.equal(build(c,kind,[{x:1,z:1}]).city,c);}
  for(const material of ['stone','bricks'] as const){assert.ok(materialLock(c,material));assert.equal(queueProduction(c,'4,1',material,true).city,c);}
  const level2={...c,progression:{...c.progression!,xp:100}};assert.equal(build(level2,'school',[{x:1,z:1}]).ok,true);assert.equal(materialLock(level2,'stone'),'');assert.ok(materialLock(level2,'bricks'));
  const level5={...c,progression:{...c.progression!,xp:1000}};for(const kind of ['school','police','largepark'])assert.equal(buildingLock(level5,kind),'');assert.equal(materialLock(level5,'bricks'),'');
});
test('level 3 homes require city level 3 and award 200 XP only on success',()=>{
  const c=stocked();c.cells['0,1']={...c.cells['0,1'],level:2,occupancy:24};c.progression!.xp=100;
  assert.equal(applyHomeUpgrade(c,'0,1',conditions).city,c);c.progression!.xp=400;
  const result=finish(applyHomeUpgrade(c,'0,1',conditions).city);assert.equal(result.progression!.xp,600);assert.equal(result.money,c.money-1200+2500);assert.equal(result.cells['0,1'].level,3);assert.equal(applyHomeUpgrade(result,'0,1',conditions).city,result);
});
test('factory tiers unlock at levels 2 and 4, preserve jobs, add slots and survive save/undo',()=>{
  let c=town();assert.equal(upgradeFactory(c,'4,1').city,c);c.progression!.xp=100;c=queueProduction(c,'4,1','wood',true).city;
  const before=c;c=upgradeFactory(c,'4,1').city;assert.equal(factoryType(c,'4,1').slots,3);assert.equal(upgradeFactory(c,'4,1').city,c);c=finish(c);assert.equal(c.money,before.money-900);assert.deepEqual(c.production,before.production);assert.equal(factoryType(c,'4,1').slots,4);assert.equal(c.progression!.xp,100);
  for(let i=0;i<3;i++)c=queueProduction(c,'4,1','wood',true).city;assert.equal(c.production!.queues['4,1'].length,4);assert.equal(queueProduction(c,'4,1','metal',true).city,c);assert.equal(upgradeFactory(c,'4,1').city,c);
  c={...c,progression:{...c.progression!,xp:600}};c=finish(upgradeFactory(c,'4,1').city);c=queueProduction(c,'4,1','metal',true).city;assert.equal(factoryType(c,'4,1').slots,5);assert.equal(c.production!.queues['4,1'].length,5);assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(c))),c);
  const cleared={...c,production:emptyProduction()},removed=build(cleared,'bulldoze',[{x:4,z:1}]).city;assert.equal(undoConstruction(removed,constructionChange(cleared,removed)).cells['4,1'].factoryTier,3);
  const bare=build(town(),'bulldoze',[{x:4,z:1}]).city,built=build(bare,'industrial',[{x:4,z:1}]).city;const advanced={...built,cells:{...built.cells,'4,1':{...built.cells['4,1'],factoryTier:2}}};assert.equal(undoConstruction(advanced,constructionChange(bare,built)),advanced);
});
test('legacy migration credits earlier paid upgrades and retains established access without cash rewards',()=>{
  const c=stocked();delete c.progression;c.production!.upgrades=2;c.cells['1,1']={x:1,z:1,kind:'largepark',age:20,level:1,occupancy:0};
  // A legacy single-lot pocket park does not create a multi-lot footprint.
  c.cells['1,1'].kind='police';const migrated=decodeCity(JSON.parse(JSON.stringify(c)));
  assert.equal(migrated.progression!.xp,200);assert.equal(migrated.money,c.money);assert.equal(buildingLock(migrated,'police'),'');assert.equal(materialLock(migrated,'bricks'),'');assert.ok(buildingLock(migrated,'largepark'));
  assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(migrated))),migrated);
  const awarded=awardHomeXP(migrated,2).city;assert.equal(awarded.money,migrated.money+1500);assert.equal(awarded.progression!.xp,300);
});
test('save validation rejects malformed XP, unlock lists, tiers, and queues beyond tier capacity',()=>{
  const c=town();for(const xp of [-1,1.5,NaN,1000000001])assert.throws(()=>decodeCity({...c,progression:{...c.progression!,xp}}));
  for(const legacyBuildings of [['unknown'],['school','school'],null])assert.throws(()=>decodeCity({...c,progression:{...c.progression!,legacyBuildings}}));
  assert.throws(()=>decodeCity({...c,progression:{...c.progression!,legacyMaterials:['wood']}}));
  for(const factoryTier of [0,4,1.5])assert.throws(()=>decodeCity({...c,cells:{...c.cells,'4,1':{...c.cells['4,1'],factoryTier}}}));
  assert.throws(()=>decodeCity({...c,cells:{...c.cells,'0,1':{...c.cells['0,1'],factoryTier:2}}}));
  const queued={...c,production:{...emptyProduction(),nextId:5,queues:{'4,1':[1,2,3,4].map(id=>({id,material:'wood',remaining:2}))}}};assert.throws(()=>decodeCity(queued));
});
