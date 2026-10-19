import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCity,build,roadPath,type City} from './simulation';
import {advanceTraffic,emptyTraffic,requestIncident,type Vehicle} from './traffic';
import {advancePedestrians,emptyFootTraffic,walkingGraph,walkingRoute} from './pedestrians';
import {weatherEffects,type WeatherKind} from './climate';

const options={operational:new Set(['-3,1']),health:100,fireRisk:0,autoIncidents:false};
function town(weather:WeatherKind):City{
  let c=build(createCity(false),'road',roadPath({x:-4,z:0},{x:5,z:0})).city;
  for(const [kind,x]of [['clinic',-3],['residential',3],['park',4],['commercial',2]] as const)c=build(c,kind,[{x,z:1}]).city;
  for(const cell of Object.values(c.cells)){cell.age=20;if(cell.kind==='commercial')cell.occupancy=16;}
  c.cells['3,1']={...c.cells['3,1'],age:20,occupancy:160};
  return {...c,climate:{season:'winter',weather}};
}
test('poor visibility and wet roads slow moving cars without changing routes or teleporting',()=>{
  const vehicle:Vehicle={id:1,kind:'car',path:['0,0','1,0','2,0'],index:0,progress:0,waiting:0,stage:'outbound'};
  const state={...emptyTraffic(),vehicles:[vehicle]};
  const clear=advanceTraffic(town('clear'),state,.1,options).state.vehicles.find(v=>v.id===1)!;
  for(const weather of ['rain','storm','fog','snow'] as const){
    const v=advanceTraffic(town(weather),state,.1,options).state.vehicles.find(v=>v.id===1)!;
    assert.ok(Math.abs(v.progress/clear.progress-weatherEffects(weather).roadSpeed)<1e-8);assert.deepEqual(v.path,vehicle.path);assert.equal(v.index,0);
  }
});
test('storm delays an actual ambulance response, but the crew still resolves the call and returns',()=>{
  function arrival(weather:WeatherKind){const city=town(weather);city.cells['2,1'].occupancy=0;let state=requestIncident(city,emptyTraffic(),'medical',true,'3,1'),at=0;for(let i=0;i<1200;i++){state=advanceTraffic(city,state,.1,options).state;if(!at&&state.incidents[0]?.status==='onscene')at=state.time;}assert.equal(state.resolved,1);assert.equal(state.missed,0);assert.ok(!state.vehicles.some(v=>v.kind==='ambulance'));return at;}
  const clear=arrival('clear'),storm=arrival('storm');assert.ok(clear>0);assert.ok(storm>clear*1.3);
});
test('bad weather opens a larger following gap without moving an existing queue backwards',()=>{
  const car=(id:number,progress:number):Vehicle=>({id,kind:'car',path:['0,0','1,0','2,0'],index:0,progress,waiting:0,stage:'outbound'});
  const start={...emptyTraffic(),vehicles:[car(1,.8),car(2,.3)]};
  const fair=advanceTraffic(town('clear'),start,.5,options).state.vehicles;
  const wet=advanceTraffic(town('storm'),start,.5,options).state.vehicles;
  const tail=wet.find(v=>v.id===2)!;
  assert.ok(tail.progress>=.3);assert.ok(tail.progress<fair.find(v=>v.id===2)!.progress);
});
test('storm lowers pedestrian trip targets and sends existing park visitors home along their paths',()=>{
  const clear=town('clear'),storm=town('storm'),traffic=emptyTraffic();let fair=emptyFootTraffic(),wet=emptyFootTraffic();
  for(let i=0;i<30;i++){fair=advancePedestrians(clear,fair,traffic,.1);wet=advancePedestrians(storm,wet,traffic,.1);}
  assert.ok(fair.agents.length>wet.agents.length);assert.ok(wet.agents.length<=Math.ceil(160/16*.2));
  const graph=walkingGraph(clear),path=walkingRoute(graph,'3,1','4,1');assert.ok(path.length);
  const endpoint=path.at(-1)!;
  const visitor={...emptyFootTraffic(),signature:graph.signature,agents:[{id:1,home:'3,1',destination:'4,1',path,index:path.length-1,progress:0,x:endpoint.x,z:endpoint.z,heading:0,walked:0,pace:1.3,stage:'inside' as const,returning:false,until:1000,waiting:false}],nextId:2};
  const result=advancePedestrians(storm,visitor,traffic,.1),person=result.agents.find(p=>p.id===1)!;
  assert.equal(person.returning,true);assert.equal(person.stage,'walking');assert.ok(Math.hypot(person.x-endpoint.x,person.z-endpoint.z)<1);assert.ok(person.path.length>1);
  assert.equal(advancePedestrians(storm,result,traffic,0),result);
});
