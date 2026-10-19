import {signalStopProgress} from './worldScale';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build,createCity,roadPath,decodeCity,metrics,type City} from './simulation';
import {placeStop,addRoute,transitPath,transitCoverage,routeProblem,transitUpkeep,BUS_CAPACITY} from './transit';
import {advanceTraffic,emptyTraffic,decodeTraffic,type TrafficState} from './traffic';
const options={operational:new Set<string>(),health:90,fireRisk:10,autoIncidents:false};
function town(){let c=build(createCity(false),'road',roadPath({x:-8,z:0},{x:8,z:0})).city;for(const x of [-8,-7,-6,6,7,8]){c=build(c,x<0?'residential':'commercial',[{x,z:1}]).city;const k=`${x},1`;c.cells[k]={...c.cells[k],age:30,occupancy:x<0?12:16};}return c;}
function line(city=town(),buses=2){let c=placeStop(city,'-8,0').city;c=placeStop(c,'8,0').city;return addRoute(c,transitPath(c,'-8,0','8,0'),'Crosstown',buses).city;}
function run(c:City,seconds:number,state=emptyTraffic()){let cars=0,queued=0,samples=0;for(let i=0;i<seconds*10;i++){state=advanceTraffic(c,state,.1,options).state;if(i>seconds*5){cars+=state.vehicles.filter(v=>v.kind==='car').length;queued+=state.vehicles.filter(v=>v.kind==='car'&&v.waiting>.4).length;samples++;}for(const v of state.vehicles.filter(v=>v.kind==='bus'))assert.ok(state.transit.passengers.filter(p=>p.vehicle===v.id).length<=BUS_CAPACITY);}return {state,cars:cars/samples,queued:queued/samples};}

test('stops and drawn routes require roads, funds, and distinct stop endpoints',()=>{
  const c=town();assert.equal(placeStop(c,'0,1').city,c);assert.equal(placeStop({...c,money:249},'0,0').city.money,249);
  const stop=placeStop(c,'-8,0').city;assert.equal(stop.money,c.money-250);assert.equal(placeStop(stop,'-8,0').city,stop);
  assert.equal(addRoute(stop,transitPath(c,'-8,0','8,0'),'Bad').city,stop);
  const ready=placeStop(stop,'8,0').city;assert.equal(addRoute(ready,['-8,0','8,0'],'Jump').city,ready);
  assert.equal(addRoute(ready,['-8,0','-7,0','-8,0'],'Backtrack').city,ready);
  assert.equal(addRoute({...ready,money:100},transitPath(c,'-8,0','8,0'),'No money').city.money,100);
  const connected=line();assert.equal(connected.transit!.routes.length,1);assert.equal(transitCoverage(connected),1);assert.equal(transitUpkeep(connected.transit),190);assert.equal(metrics(connected).expenses-metrics(c).expenses,190);
});
test('bus passengers board, dwell, travel both directions, and arrive within capacity',()=>{
  const c=line();let s=advanceTraffic(c,emptyTraffic(),.1,options).state;
  assert.equal(s.vehicles.filter(v=>v.kind==='bus').length,1);
  const bus=s.vehicles.find(v=>v.kind==='bus')!;assert.equal(bus.progress,0);assert.ok(bus.serviceUntil!>s.time);
  const result=run(c,120,s).state;assert.equal(result.vehicles.filter(v=>v.kind==='bus').length,2);assert.ok(result.transit.boarded>30);assert.ok(result.transit.delivered>20);assert.ok(result.vehicles.filter(v=>v.kind==='bus').some(v=>v.path[0]==='8,0'));
});
test('successful transit reduces car load while terminal yielding stays bounded',()=>{
  const baseline=run(town(),150),transit=run(line(),150);assert.ok(transit.state.transit.delivered>50);
  assert.ok(transit.cars<baseline.cars*.8,`cars with transit ${transit.cars}, without ${baseline.cars}`);
  // Brief yielding to a turning bus is expected, even when baseline traffic has no queue.
  assert.ok(transit.queued<=baseline.queued+.5,`queued with transit ${transit.queued}, without ${baseline.queued}`);
});
test('paused or broken lines withdraw buses and return riders to car demand; rebuilding restores service',()=>{
  const c=line(),s=run(c,30).state,r=c.transit!.routes[0];
  const paused={...c,transit:{...c.transit!,routes:[{...r,enabled:false}]}};assert.equal(transitCoverage(paused),0);
  const off=advanceTraffic(paused,s,.1,options).state;assert.equal(off.vehicles.filter(v=>v.kind==='bus').length,0);assert.equal(off.transit.passengers.length,0);
  const broken=build(c,'bulldoze',[{x:0,z:0}]).city;assert.match(routeProblem(broken,r)!,/Road missing/);assert.deepEqual(transitPath(broken,'-8,0','8,0'),[]);
  assert.equal(run(broken,1,s).state.vehicles.filter(v=>v.kind==='bus').length,0);
  const repaired=build(broken,'road',[{x:0,z:0}]).city;assert.equal(routeProblem(repaired,r),undefined);assert.ok(run(repaired,20).state.vehicles.some(v=>v.kind==='bus'));
});
test('transit save round-trip preserves routes, fleets, riders and legacy saves',()=>{
  const c=line(),s=run(c,30).state;assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(c))),c);assert.deepEqual(decodeTraffic(JSON.parse(JSON.stringify(s))),s);
  const old={...emptyTraffic()} as Partial<TrafficState>;delete old.transit;assert.deepEqual(decodeTraffic(old).transit,emptyTraffic().transit);assert.equal(decodeCity(town()).transit,undefined);
  assert.throws(()=>decodeCity({...c,transit:{...c.transit,routes:[{...c.transit!.routes[0],buses:400}]}}));
  assert.throws(()=>decodeCity({...c,transit:{...c.transit,routes:[{...c.transit!.routes[0],path:['-8,0','8,0']}]}}));
  assert.throws(()=>decodeTraffic({...s,transit:{...s.transit,passengers:[{id:10000,route:1,from:'bad',to:'8,0',created:0}]}}));
});

test('buses obey red signals and stop boarding is counted only once during a dwell',()=>{
  let c=line(town(),1);c=build(c,'road',roadPath({x:0,z:-2},{x:0,z:2})).city;
  const r=c.transit!.routes[0];let s:TrafficState={...emptyTraffic(),time:7,vehicles:[{id:1,kind:'bus' as const,route:r.id,path:r.path,index:7,progress:.1,waiting:0,stage:'outbound' as const}],nextId:2};
  s=run(c,2,s).state;assert.equal(s.vehicles.find(v=>v.id===1)!.progress,signalStopProgress(s.vehicles.find(v=>v.id===1)!));assert.equal(s.vehicles.find(v=>v.id===1)!.index,7);
  const waiting={...emptyTraffic(),nextId:3,transit:{...emptyTraffic().transit,passengers:[{id:1,route:r.id,from:'-8,0',to:'8,0',created:0}]}};
  const boarded=advanceTraffic(c,waiting,.1,options).state;assert.equal(boarded.transit.boarded,1);assert.ok(boarded.transit.passengers[0].vehicle);
  const dwell=advanceTraffic(c,boarded,.5,options).state;assert.equal(dwell.transit.boarded,1);assert.equal(dwell.vehicles.find(v=>v.kind==='bus')!.progress,0);
});
