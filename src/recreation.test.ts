import {unlockedCity as createCity} from './testCity';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build,roadPath,metrics,decodeCity,constructionChange,undoConstruction,type City} from './simulation';
import {recreationTypes,recreationConfig,recreationMetrics,recreationFootprint} from './recreation';

function street():City{return build(createCity(false),'road',roadPath({x:-15,z:0},{x:10,z:0})).city;}
function neighborhood(){let c=street();for(const x of [-2,8]){c=build(c,'residential',[{x,z:-1}]).city;c.cells[`${x},-1`]={...c.cells[`${x},-1`],occupancy:x===-2?12:36,age:30,level:3};}return c;}

test('recreation reserves full footprints, counts one building and charges construction and upkeep once',()=>{
  for(const kind of recreationTypes){const c=street(),config=recreationConfig[kind],result=build(c,kind,[{x:kind==='waterpark'?8:-2,z:1}]);assert.ok(result.ok,result.message);
    assert.equal(Object.values(result.city.cells).filter(c=>c.kind===kind).length,config.width*config.depth);
    assert.equal(c.money-result.city.money,config.cost);assert.equal(metrics(result.city).expenses-metrics(c).expenses,config.upkeep);
    assert.equal(metrics(result.city).buildings,1);assert.equal(recreationMetrics(result.city).facilities.length,1);
  }
});
test('occupied footprint, shore, funds, missing frontage and overlapping multi-placement reject atomically',()=>{
  const c=build(street(),'park',[{x:0,z:1}]).city;
  for(const [city,x,z]of [[c,-2,1],[street(),11,1],[street(),-2,5],[{...street(),money:1},-2,1]] as const){const result=build(city,'largepark',[{x,z}]);assert.equal(result.ok,false);assert.equal(result.city,city);}
  assert.equal(build(street(),'largepark',[{x:0,z:1},{x:1,z:1}]).ok,false);
});
test('road access on any outside edge activates recreation without utilities; removing access suspends benefits',()=>{
  let c=build(createCity(false),'road',[{x:3,z:2}]).city;c=build(c,'largepark',[{x:0,z:0}]).city;
  assert.equal(recreationMetrics(c).facilities[0].active,true);assert.equal(metrics(c).lots['0,0'].supplied,false);
  const disconnected=build(c,'bulldoze',[{x:3,z:2}]).city;assert.equal(recreationMetrics(disconnected).facilities[0].active,false);assert.equal(recreationMetrics(disconnected).lots['0,0'].happiness,0);
  assert.equal(recreationMetrics(build(disconnected,'road',[{x:3,z:2}]).city).facilities[0].active,true);
});
test('benefits are local, fade with distance and weight the city bonus by affected residents',()=>{
  const c=neighborhood(),withPark=build(c,'playground',[{x:-2,z:1}]).city,before=metrics(c),after=metrics(withPark),r=after.recreation;
  assert.ok(r.lots['-2,-1'].happiness>0);assert.equal(r.lots['8,-1'].happiness,0);assert.equal(r.coverage,25);
  assert.ok(Math.abs(r.happinessBonus-r.lots['-2,-1'].happiness*.25)<1e-10);assert.ok(after.happiness>before.happiness);
  assert.ok(after.lots['-2,-1'].landValue>before.lots['-2,-1'].landValue);assert.equal(after.lots['8,-1'].landValue,before.lots['8,-1'].landValue);
  assert.ok(r.lots['-2,0'].happiness>r.lots['-5,0'].happiness);
});
test('large parks reach further and overlapping amenities have bounded benefits',()=>{
  let c=neighborhood();c=build(c,'largepark',[{x:-4,z:1}]).city;c=build(c,'largepark',[{x:-1,z:1}]).city;c=build(c,'largepark',[{x:2,z:1}]).city;
  assert.equal(metrics(c).recreation.lots['-2,-1'].happiness,12);assert.equal(metrics(c).recreation.lots['-2,-1'].landValue,30);
  const pocket=build(neighborhood(),'park',[{x:1,z:1}]).city,large=build(neighborhood(),'largepark',[{x:1,z:1}]).city;
  assert.equal(metrics(pocket).recreation.lots['8,-1'].happiness,0);assert.ok(metrics(large).recreation.lots['8,-1'].happiness>0);
});
test('demolition of a member removes the whole park for one fee and undo restores the whole footprint',()=>{
  const before=street(),built=build(before,'largepark',[{x:-2,z:1}]).city,change=constructionChange(before,built);
  const cleared=build(built,'bulldoze',[{x:0,z:3},{x:-1,z:2}]).city;
  assert.equal(built.money-cleared.money,20);assert.equal(recreationMetrics(cleared).facilities.length,0);
  assert.equal(Object.values(cleared.cells).some(c=>c.kind==='largepark'),false);
  assert.deepEqual(undoConstruction(cleared,constructionChange(built,cleared)),built);
  assert.deepEqual(undoConstruction(built,change),before);
  assert.equal(build(built,'road',roadPath({x:-2,z:2},{x:2,z:2})).ok,false);
});
test('legacy parks and new recreation survive saves; incomplete, forged and extra footprint members reject',()=>{
  const legacy=createCity(),old=decodeCity(JSON.parse(JSON.stringify(legacy)));assert.deepEqual(old,legacy);
  for(const kind of recreationTypes){const c=build(street(),kind,[{x:kind==='waterpark'?8:-2,z:1}]).city;assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(c))),c);}
  const c=build(street(),'largepark',[{x:-2,z:1}]).city;
  const missing={...c,cells:{...c.cells}};delete missing.cells['0,3'];assert.throws(()=>decodeCity(missing));
  const forged={...c,cells:{...c.cells,'0,0':{...c.cells['0,0'],recreationRoot:'-2,1'}}};assert.throws(()=>decodeCity(forged));
  const extra={...c,cells:{...c.cells,'1,3':{...c.cells['0,3'],x:1}}};assert.throws(()=>decodeCity(extra));
  assert.equal(recreationFootprint('sports',{x:0,z:0}).length,6);
});
