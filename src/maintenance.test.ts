import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCity,build,roadPath,decodeCity,metrics,type City} from './simulation';
import {advanceTraffic,emptyTraffic,decodeTraffic,type TrafficState} from './traffic';
import {emptyMaintenance,roadSeverity,roadTravelFactor,maintenanceUpkeep,decodeMaintenance} from './maintenance';
function town():City{
  let city=build(createCity(false),'road',roadPath({x:0,z:0},{x:8,z:0})).city;
  for(const [kind,x,z]of [['utility',0,-1],['maintenance',0,1],['residential',4,1],['clinic',6,1]] as const)city=build(city,kind,[{x,z}]).city;
  city.cells['4,1']={...city.cells['4,1'],age:10,occupancy:12};
  return {...city,climate:{season:'winter',weather:'clear'},maintenance:emptyMaintenance()};
}
function run(city:City,traffic:TrafficState,seconds:number,operational=new Set(['0,1'])){
  for(let i=0;i<seconds*10;i++){
    const result=advanceTraffic(city,traffic,.1,{operational,health:100,fireRisk:0,autoIncidents:false});
    traffic=result.state;if(result.maintenance!==city.maintenance)city={...city,maintenance:result.maintenance};
  }return {city,traffic};
}
test('snow accumulates gradually, reduces road speed and melts; pause preserves conditions',()=>{
  const c=town();c.climate!.weather='snow';c.maintenance!.budget=0;
  const snowy=run(c,emptyTraffic(),210);assert.ok(roadSeverity(snowy.city,'4,0')>20&&roadSeverity(snowy.city,'4,0')<23);assert.ok(roadTravelFactor(snowy.city,'4,0')<.93);
  assert.equal(advanceTraffic(snowy.city,snowy.traffic,0,{operational:new Set(),health:100,fireRisk:0}).maintenance,snowy.city.maintenance);
  const thaw=run({...snowy.city,climate:{season:'spring',weather:'clear'}},snowy.traffic,100);assert.equal(thaw.city.maintenance!.roads['4,0'].snow,0);
});
test('a real crew drives to the worksite, repairs the road, resolves resident concern and returns',()=>{
  const city=town();city.maintenance!.roads['4,0']={snow:80,wear:80};
  assert.ok(metrics(city).wellbeing.lots['4,1'].issues.some(i=>i.id==='roads'));
  const dispatched=run(city,emptyTraffic(),1.1);assert.ok(dispatched.traffic.vehicles.some(v=>v.kind==='maintenance'));assert.equal(dispatched.city.maintenance!.completed,0,'dispatch does not repair remotely');
  const done=run(dispatched.city,dispatched.traffic,55);assert.ok(done.city.maintenance!.completed>0);assert.ok(roadSeverity(done.city,'4,0')<55);assert.ok(!metrics(done.city).wellbeing.lots['4,1'].issues.some(i=>i.id==='roads'));assert.ok(!done.traffic.vehicles.some(v=>v.kind==='maintenance'));
  assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(done.city))),done.city);
});
test('utilities and broken connections block dispatch; standby recalls without completing a job',()=>{
  const city=town();city.maintenance!.roads['6,0']={snow:0,wear:80};
  assert.equal(run(city,emptyTraffic(),5,new Set()).traffic.vehicles.length,0);
  const broken={...city,cells:{...city.cells}};delete broken.cells['2,0'];assert.equal(run(broken,emptyTraffic(),5).traffic.vehicles.length,0);
  const active=run(city,emptyTraffic(),1.1),standby=run({...active.city,maintenance:{...active.city.maintenance!,budget:0}},active.traffic,25);
  assert.equal(standby.city.maintenance!.completed,0);assert.equal(standby.traffic.vehicles.length,0);assert.equal(maintenanceUpkeep(standby.city),40);
});
test('emergency priority favors affected service frontages and active crews survive backup',()=>{
  const city=town();city.maintenance!.roads={'2,0':{snow:0,wear:60},'6,0':{snow:0,wear:60}};
  const priority=run(city,emptyTraffic(),1.1);assert.equal(priority.traffic.vehicles.find(v=>v.kind==='maintenance')?.target,'6,0');
  assert.deepEqual(decodeTraffic(JSON.parse(JSON.stringify(priority.traffic))),priority.traffic);
  const balanced=run({...city,maintenance:{...city.maintenance!,priority:'balanced'}},emptyTraffic(),1.1);assert.equal(balanced.traffic.vehicles.find(v=>v.kind==='maintenance')?.target,'2,0');
  assert.equal(maintenanceUpkeep({...city,maintenance:{...city.maintenance!,budget:150}}),340);
});
test('maintenance save validation rejects malformed conditions and keeps legacy cities compatible',()=>{
  assert.equal(decodeCity(createCity(false)).maintenance,undefined);
  for(const bad of [null,{}, {...emptyMaintenance(),budget:200},{...emptyMaintenance(),roads:{'20,0':{snow:0,wear:0}}},{...emptyMaintenance(),roads:{'1,0':{snow:NaN,wear:2}}},{...emptyMaintenance(),roads:{'1,0':{snow:101,wear:2}}}])assert.throws(()=>decodeMaintenance(bad));
});
test('snowplows clear streets they reach, not remote sections',()=>{
  const city=town();city.climate!.weather='snow';city.maintenance!.roads={'0,0':{snow:70,wear:0},'8,0':{snow:70,wear:0}};
  const active=run(city,emptyTraffic(),1.2);assert.equal(active.city.maintenance!.roads['0,0'].snow,0);assert.ok(active.city.maintenance!.roads['8,0'].snow>=70);
});
test('minor priority work cannot starve distant severe damage',()=>{
  const city=town();delete city.cells['6,1'];city.cells['1,1']={x:1,z:1,kind:'clinic',age:10,level:1,occupancy:0};
  city.maintenance!.roads={'1,0':{snow:0,wear:12},'8,0':{snow:0,wear:80}};
  const active=run(city,emptyTraffic(),1.1);assert.equal(active.traffic.vehicles.find(v=>v.kind==='maintenance')?.target,'8,0');
});
test('standby does not snap a moving crew back to the start of its road segment',()=>{
  const city=town();city.maintenance!.budget=0;
  const traffic:TrafficState={...emptyTraffic(),nextId:2,vehicles:[{id:1,kind:'maintenance',station:'0,1',target:'8,0',path:['2,0','3,0','4,0','5,0','6,0','7,0','8,0'],index:0,progress:.4,waiting:0,stage:'outbound'}]};
  const result=run(city,traffic,.1),crew=result.traffic.vehicles[0];assert.equal(crew.path[crew.index],'2,0');assert.ok(crew.progress>.4);assert.equal(crew.stage,'outbound');
});
