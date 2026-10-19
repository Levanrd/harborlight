import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unlockedCity} from './testCity';
import {build,metrics,decodeCity,constructionChange,undoConstruction,key,type City} from './simulation';
import {createCoastalCity} from './coastalCity';
import {coastalTypes} from './coastal';
import {citySaveSlot} from './citySession';
import {routeProblem} from './transit';

test('coastal tools require the shoreline, keep ordinary housing/jobs and survive save and undo',()=>{
  for(const kind of coastalTypes){
    const c=build(unlockedCity(false),'road',[{x:9,z:0},{x:0,z:0}]).city;
    const inland=build(c,kind,[{x:0,z:1}]);assert.equal(inland.ok,false);assert.equal(inland.city,c);
    const r=build(c,kind,[{x:9,z:1}]);assert.ok(r.ok,r.message);assert.equal(r.city.cells['9,1'].coastal,kind);assert.equal(r.city.cells['9,1'].kind,kind==='resort'?'commercial':'residential');
    assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(r.city))),r.city);assert.deepEqual(undoConstruction(r.city,constructionChange(c,r.city)),c);
    const forged=structuredClone(r.city);forged.cells['9,1'].coastal='beachhouse';forged.cells['9,1'].kind='industrial';assert.throws(()=>decodeCity(forged));
  }
});

test('planned districts separate pollution sources and provide working services, utility reserves and transit',()=>{
  const c=createCoastalCity(),m=metrics(c),cells=Object.values(c.cells),neighbors=cells.filter(c=>['residential','commercial'].includes(c.kind));
  assert.ok(m.population>=1700);assert.equal(m.coverage.school,100);assert.equal(m.coverage.clinic,100);assert.equal(m.coverage.fire,100);
  for(const resource of ['power','water','sewage'] as const)assert.ok(m.resources.capacity[resource]>m.resources.usage[resource]*1.3);
  for(const source of cells.filter(c=>['industrial','landfill','recycling','sewage'].includes(c.kind)))for(const home of neighbors)assert.ok(Math.hypot(home.x-source.x,home.z-source.z)>=6);
  for(const home of cells.filter(c=>c.kind==='residential'))assert.ok(m.lots[key(home.x,home.z)].pollution<15);
  for(const kind of coastalTypes)assert.ok(cells.some(c=>c.coastal===kind));
  assert.ok(cells.some(c=>c.kind==='waterpark'));assert.ok(m.regional.facilities.every(f=>f.active&&f.daily>0));
  for(const route of c.transit!.routes)assert.equal(routeProblem(c,route),undefined);
  assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(c))),c);assert.equal(citySaveSlot('?city=coastal'),citySaveSlot(''));assert.equal(citySaveSlot('?city=coastal'),citySaveSlot('?city=showcase'));
});

test('resident concerns disappear when actual service, pollution, garbage and crime causes are fixed',()=>{
  let c:City=unlockedCity(false);c=build(c,'road',Array.from({length:11},(_,x)=>({x:x-5,z:0}))).city;
  c=build(c,'residential',[{x:0,z:1}]).city;c.cells['0,1']={...c.cells['0,1'],occupancy:12,age:10};
  const before=metrics(c).wellbeing.lots['0,1'];assert.ok(before.issues.some(i=>i.id==='health'));assert.ok(before.issues.some(i=>i.id==='utilities'));
  for(const [kind,x,z]of [['utility',-5,1],['clinic',-3,1],['school',-1,1],['fire',1,1],['park',3,1]] as const){const r=build(c,kind,[{x,z}]);assert.ok(r.ok);c=r.city;}
  const served=metrics(c).wellbeing.lots['0,1'];assert.equal(served.issues.length,0);assert.ok(served.happiness>before.happiness);
  const polluted=build(c,'industrial',[{x:0,z:-1},{x:1,z:-1},{x:-1,z:-1}]).city;
  for(const k of ['0,-1','1,-1','-1,-1'])polluted.cells[k]={...polluted.cells[k],occupancy:32,age:10,level:2};
  const troubled={...polluted,crime:{lots:{'0,1':{level:70}},visits:0},waste:{lots:{'0,1':24},stored:{},generated:24,collected:0,recycled:0,exported:0}};
  const issues=metrics(troubled).wellbeing.lots['0,1'].issues.map(i=>i.id);assert.ok(issues.includes('pollution'));assert.ok(issues.includes('garbage'));assert.ok(issues.includes('safety'));
  assert.equal(metrics(c).wellbeing.lots['0,1'].issues.length,0);assert.ok(metrics(c).wellbeing.happiness>metrics(troubled).wellbeing.happiness);
});

test('water park rejects inland construction and malformed inland imports',()=>{
  const c=build(unlockedCity(false),'road',[{x:8,z:0},{x:0,z:0}]).city;
  assert.equal(build(c,'waterpark',[{x:0,z:1}]).ok,false);
  const r=build(c,'waterpark',[{x:8,z:1}]);assert.ok(r.ok,r.message);assert.equal(metrics(r.city).recreation.facilities.length,1);
  const inland=structuredClone(r.city);inland.cells={};for(const cell of Object.values(r.city.cells)){const moved={...cell,x:cell.x-10,...(cell.recreationRoot?{recreationRoot:'-2,1'}:{})};inland.cells[key(moved.x,moved.z)]=moved;}assert.throws(()=>decodeCity(inland));
});
