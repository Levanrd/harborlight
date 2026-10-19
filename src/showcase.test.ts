import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createShowcaseCity} from './showcase';
import {citySaveSlot} from './citySession';
import {metrics,decodeCity,tick,key,isZone} from './simulation';
import {routeProblem} from './transit';
import {storageUsed,collectProduction} from './production';
import {isFacilityRoot} from './recreation';
import {advanceTraffic,emptyTraffic} from './traffic';

test('metropolis has connected, supplied infrastructure, populated districts and working bus routes',()=>{
  const c=createShowcaseCity(),m=metrics(c);
  assert.ok(m.population>=1700);assert.ok(Object.keys(c.cells).length>700);
  for(const kind of ['residential','commercial','industrial','school','clinic','fire','police','landfill','recycling','power','water','sewage','utility','park','playground','sports','largepark','waterpark','railway','seaport','airport']){
    const lots=Object.values(c.cells).filter(l=>l.kind===kind&&isFacilityRoot(l));assert.ok(lots.length,kind);
    if(!['park','playground','sports','largepark','waterpark'].includes(kind))assert.ok(lots.every(l=>m.lots[key(l.x,l.z)].supplied),`${kind} must work`);
  }
  assert.ok(m.coverage.school>=95);assert.equal(m.coverage.clinic,100);assert.equal(m.coverage.fire,100);
  assert.ok(m.happiness>=80);assert.ok(m.net>0);
  for(const r of ['power','water','sewage'] as const)assert.ok(m.resources.capacity[r]>m.resources.usage[r]*1.3);
  assert.equal(c.transit?.routes.length,4);for(const route of c.transit!.routes)assert.equal(routeProblem(c,route),undefined);
  assert.ok(m.regional.facilities.every(f=>f.active&&f.daily>0));
});
test('metropolis production, time, save round-trip and vehicle systems are playable',()=>{
  let c=createShowcaseCity();const original=JSON.stringify(c);
  const ready=Object.entries(c.production!.queues).find(([,q])=>q[0].remaining===0)!;
  const collected=collectProduction(c,ready[0]);assert.notEqual(collected.city,c);assert.equal(storageUsed(collected.city.production),storageUsed(c.production)+2);
  for(let day=0;day<12;day++)c=tick(c);
  assert.ok(c.regional!.passengers>0&&c.regional!.cargo>0);assert.ok(c.money>500000);
  const decoded=decodeCity(JSON.parse(JSON.stringify(c)));assert.deepEqual(decoded,c);
  const m=metrics(c),operational=new Set(Object.entries(m.lots).filter(([,l])=>l.supplied).map(([k])=>k));
  let traffic=emptyTraffic();for(let i=0;i<30;i++){const result=advanceTraffic(c,traffic,.1,{operational,health:m.health,fireRisk:m.fireRisk});traffic=result.state;c={...c,waste:result.waste,crime:result.crime};}
  assert.ok(traffic.vehicles.length>0);assert.ok(Object.values(c.cells).filter(isZone).every(l=>Number.isFinite(l.occupancy)));
  assert.equal(JSON.stringify(createShowcaseCity()),original,'reset must be deterministic');
});
test('all old bookmarks select the single active master-plan slot',()=>{
  assert.equal(citySaveSlot(''),'masterplan-v1');assert.equal(citySaveSlot('?city=showcase'),'masterplan-v1');
  assert.equal(citySaveSlot('?city=current'),'masterplan-v1');assert.equal(citySaveSlot('?city=other-town'),'masterplan-v1');
  assert.equal(citySaveSlot('?city=showcase'),citySaveSlot(''));
});
