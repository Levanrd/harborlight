import {signalStopProgress} from './worldScale';
import {unlockedCity as createCity} from './testCity';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build,roadPath,metrics,decodeCity,constructionChange,undoConstruction,type City} from './simulation';
import {advanceTraffic,emptyTraffic,decodeTraffic,type TrafficState} from './traffic';
import {crimeDay,crimeSummary,recentlyPatrolled,emptyCrime} from './police';
import {emptyWaste} from './waste';

function town():City{
  let c=build(createCity(false),'road',roadPath({x:-5,z:0},{x:6,z:0})).city;
  for(const [type,x,z]of [['police',-5,1],['utility',-4,1],['residential',1,1],['commercial',3,1],['industrial',5,1]] as const)c=build(c,type,[{x,z}]).city;
  for(const k of ['1,1','3,1','5,1'])c.cells[k]={...c.cells[k],occupancy:12,age:30};
  return {...c,crime:{lots:{'1,1':{level:60},'3,1':{level:65},'5,1':{level:55}},visits:0}};
}
function run(city:City,state=emptyTraffic(),seconds=60){
  for(let i=0;i<seconds*10;i++){
    const m=metrics(city),result=advanceTraffic(city,state,.1,{operational:new Set(Object.entries(m.lots).filter(([,l])=>l.supplied).map(([k])=>k)),health:m.health,fireRisk:m.fireRisk,autoIncidents:false});
    state=result.state;if(result.crime!==city.crime||result.waste!==city.waste)city={...city,crime:result.crime,waste:result.waste};
  }
  return {city,state};
}

test('crime builds gradually and utility shortages, waste and taxes increase pressure',()=>{
  const c={...town(),crime:emptyCrime()},operational=new Set(Object.keys(c.cells));
  const regular=crimeDay(c,operational),shortage=crimeDay(c,new Set());
  const dirty=crimeDay({...c,waste:{...emptyWaste(),lots:{'1,1':12}},tax:15},operational);
  assert.ok(regular.lots['1,1'].level>0&&regular.lots['1,1'].level<2);
  assert.ok(shortage.lots['1,1'].level>regular.lots['1,1'].level);
  assert.ok(dirty.lots['1,1'].level>regular.lots['1,1'].level);
  assert.ok(regular.lots['3,1'].level>regular.lots['1,1'].level);
  assert.equal(Object.keys(c.crime.lots).length,0);
});
test('crime lowers residential safety, happiness and land value without altering pollution',()=>{
  const c=town(),safe={...c,crime:emptyCrime()};
  assert.equal(crimeSummary(c).safety,40);assert.equal(crimeSummary(c).happinessPenalty,12);
  assert.equal(metrics(safe).happiness-metrics(c).happiness,12);
  assert.ok(metrics(safe).lots['1,1'].landValue>metrics(c).lots['1,1'].landValue);
  assert.equal(metrics(safe).pollution,metrics(c).pollution);
  assert.ok(metrics(c).alerts.some(a=>a.tool==='police'));
});
test('dispatch alone does not improve safety; completed visits reach connected neighborhoods',()=>{
  const original=town(),early=run(original,emptyTraffic(),1.1);
  assert.ok(early.state.vehicles.some(v=>v.kind==='police'));assert.equal(early.city.crime!.visits,0);
  const completed=run(early.city,early.state);
  assert.ok(completed.city.crime!.visits>0);assert.ok(completed.city.crime!.lots['1,1'].level<60);
  assert.ok(metrics(completed.city).happiness>metrics(original).happiness);
  assert.ok(crimeSummary(completed.city).coverage>0);assert.equal(original.crime!.visits,0);
  assert.equal(completed.state.vehicles.filter(v=>v.kind==='police').length,0,'cars return when all lots have recent patrols');
});
test('patrol prevention expires; pause never advances cars or changes crime',()=>{
  const c=town();c.day=10;c.crime!.lots['1,1']={level:30,lastPatrol:10};
  const operational=new Set(Object.keys(c.cells)),protectedDay=crimeDay(c,operational);
  const expired={...c,day:30};assert.equal(recentlyPatrolled(expired,'1,1'),false);
  assert.ok(crimeDay(expired,operational).lots['1,1'].level>protectedDay.lots['1,1'].level);
  const state=emptyTraffic(),result=advanceTraffic(c,state,0,{operational,health:90,fireRisk:10});
  assert.equal(result.state,state);assert.equal(result.crime,c.crime);
});
test('unpowered stations and disconnected streets cannot provide phantom patrols',()=>{
  const c=town(),unpowered=build(c,'bulldoze',[{x:-4,z:1}]).city;
  assert.equal(run(unpowered).state.vehicles.filter(v=>v.kind==='police').length,0);
  const isolated=build(c,'bulldoze',[{x:0,z:0}]).city,result=run(isolated);
  assert.equal(result.city.crime!.visits,0);assert.equal(result.city.crime!.lots['1,1'].level,60);
});
test('interrupted patrols cannot finish a visit and station demolition removes its cars',()=>{
  const started=run(town(),emptyTraffic(),2),car=started.state.vehicles.find(v=>v.kind==='police')!;
  assert.ok(car);const road=started.city.cells[car.path[car.index]];
  const broken=run(build(started.city,'bulldoze',[road]).city,started.state,.1);
  assert.ok(!broken.state.vehicles.some(v=>v.id===car.id));assert.equal(broken.city.crime!.visits,0);
  const gone=run(build(started.city,'bulldoze',[{x:-5,z:1}]).city,started.state,5);
  assert.equal(gone.state.vehicles.filter(v=>v.kind==='police').length,0);assert.equal(gone.city.crime!.visits,0);
});
test('neighborhood prevention follows road connections and cannot cross to an isolated parallel street',()=>{
  let city=town();city=build(city,'road',[{x:1,z:-2}]).city;city=build(city,'residential',[{x:1,z:-3}]).city;
  city.cells['1,-3']={...city.cells['1,-3'],occupancy:12};city.crime!.lots['1,-3']={level:60};
  const state:TrafficState={...emptyTraffic(),nextId:10,vehicles:[{id:1,kind:'police',station:'-5,1',target:'1,1',patrolStops:0,path:['1,0'],index:0,progress:0,waiting:0,stage:'onscene',serviceUntil:0}]};
  const result=run(city,state,.1);assert.equal(result.city.crime!.lots['1,1'].level,50);assert.equal(result.city.crime!.lots['1,-3'].level,60);assert.equal(result.city.crime!.lots['1,-3'].lastPatrol,undefined);
  const outage=run(build(city,'bulldoze',[{x:-4,z:1}]).city,state,.1);assert.equal(outage.city.crime!.visits,0);
});
test('patrol cars obey red lights and fleet size and assignments stay bounded',()=>{
  const city=build(town(),'road',roadPath({x:0,z:-2},{x:0,z:2})).city;
  const state:TrafficState={...emptyTraffic(),time:7,nextId:100,vehicles:[{id:1,kind:'police',station:'-5,1',target:'1,1',patrolStops:0,path:['-1,0','0,0','1,0'],index:0,progress:.1,waiting:0,stage:'outbound'}]};
  const stopped=run(city,state,2).state.vehicles.find(v=>v.id===1)!;
  assert.equal(stopped.index,0);assert.ok(stopped.progress<=.55);assert.ok(stopped.waiting>0);
  let c=city,s=state;
  for(let i=0;i<50;i++){const result=run(c,s,1);c=result.city;s=result.state;const cars=s.vehicles.filter(v=>v.kind==='police');assert.ok(cars.length<=2);const targets=cars.filter(v=>v.target).map(v=>v.target);assert.equal(new Set(targets).size,targets.length);}
  assert.ok(c.crime!.visits>0);
});
test('police construction costs, monthly upkeep, funds and undo work',()=>{
  const c=build(createCity(false),'road',[{x:0,z:0}]).city,result=build(c,'police',[{x:0,z:1}]);
  assert.equal(result.ok,true);assert.equal(c.money-result.city.money,5200);assert.equal(metrics(result.city).expenses-metrics(c).expenses,220);
  assert.deepEqual(undoConstruction(result.city,constructionChange(c,result.city)),c);
  assert.equal(build({...c,money:100},'police',[{x:0,z:1}]).ok,false);
  assert.equal(build(c,'police',[{x:4,z:4}]).ok,false);
});
test('crime and active patrols survive saves; older towns load and malformed patrol data is rejected',()=>{
  const {city,state}=run(town(),emptyTraffic(),2);
  assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(city))),JSON.parse(JSON.stringify(city)));
  assert.deepEqual(decodeTraffic(JSON.parse(JSON.stringify(state))),state);
  assert.equal(decodeCity(createCity()).crime,undefined);
  for(const level of [-1,101,NaN])assert.throws(()=>decodeCity({...city,crime:{visits:0,lots:{'1,1':{level}}}}));
  assert.throws(()=>decodeCity({...city,crime:{visits:0,lots:{'1,1':{level:5,lastPatrol:city.day+1}}}}));
  const car=state.vehicles.find(v=>v.kind==='police')!;
  assert.throws(()=>decodeTraffic({...state,vehicles:[{...car,patrolStops:5}]}));
  assert.throws(()=>decodeTraffic({...state,vehicles:[{...car,target:undefined}]}));
});
