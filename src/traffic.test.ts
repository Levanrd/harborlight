import {signalStopProgress} from './worldScale';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCity,build,roadPath,metrics,type City} from './simulation';
import {advanceTraffic,emptyTraffic,requestIncident,trafficRoute,roadGraph,signalAllows,signalPhase,signalAspect,decodeTraffic,trafficSummary,type TrafficState,type TrafficOptions,type Vehicle} from './traffic';
const options:TrafficOptions={operational:new Set(['-3,1','-2,1']),health:90,fireRisk:30,autoIncidents:false};
function town(){let c=build(createCity(false),'road',roadPath({x:-4,z:0},{x:5,z:0})).city;for(const [kind,x]of [['clinic',-3],['fire',-2],['residential',3],['residential',4]] as const)c=build(c,kind,[{x,z:1}]).city;for(const k of ['3,1','4,1'])c.cells[k]={...c.cells[k],age:20,occupancy:12};return c;}
function run(c:City,s:TrafficState,seconds:number,o=options){let damage:{lot:string;kind:string}[]=[];for(let i=0;i<seconds*10;i++){const result=advanceTraffic(c,s,.1,o);s=result.state;damage.push(...result.damage);}return {state:s,damage};}
const car=(id:number,path:string[],progress=0):Vehicle=>({id,kind:'car',path,index:0,progress,waiting:0,stage:'outbound'});

test('ambulance and fire truck dispatch, work at scene, and return to base',()=>{
  const c=town();let s=requestIncident(c,emptyTraffic(),'medical',true,'3,1');s=requestIncident(c,s,'fire',true,'4,1');s=advanceTraffic(c,s,.1,options).state;
  assert.ok(s.vehicles.some(v=>v.kind==='ambulance'));assert.ok(s.vehicles.some(v=>v.kind==='firetruck'));assert.ok(s.incidents.every(i=>i.status==='responding'));
  s=run(c,s,65).state;assert.equal(s.resolved,2);assert.equal(s.vehicles.length,0);assert.equal(s.missed,0);
});
test('one responder per station; a second call waits for the return trip',()=>{
  const c=town();let s=requestIncident(c,emptyTraffic(),'medical',true,'3,1');s=requestIncident(c,s,'medical',true,'4,1');s=advanceTraffic(c,s,.1,options).state;
  assert.equal(s.vehicles.length,1);assert.equal(s.incidents[1].reason,'All units busy');
  s=run(c,s,95).state;assert.equal(s.resolved,2);
});
test('missing services and disconnected roads leave calls waiting without phantom dispatch',()=>{
  let c=town();const s=requestIncident(c,emptyTraffic(),'fire',true,'3,1');let next=advanceTraffic(c,s,.1,{...options,operational:new Set<string>()}).state;assert.equal(next.vehicles.length,0);assert.match(next.incidents[0].reason,/No supplied/);
  c=build(c,'bulldoze',[{x:0,z:0}]).city;next=advanceTraffic(c,s,.1,options).state;assert.equal(next.vehicles.length,0);assert.match(next.incidents[0].reason,/road route/);
});
test('road deletion during a response safely requeues the call',()=>{
  let c=town();let s=advanceTraffic(c,requestIncident(c,emptyTraffic(),'medical',true,'3,1'),.1,options).state;
  c=build(c,'bulldoze',[{x:0,z:0}]).city;s=advanceTraffic(c,s,.1,options).state;assert.equal(s.vehicles.length,0);assert.equal(s.incidents[0].status,'waiting');
});
test('missed real calls emit damage once; drills never emit damage',()=>{
  const c=town(),none={...options,operational:new Set<string>()};let s=requestIncident(c,emptyTraffic(),'fire',false,'3,1');let result=run(c,s,152,none);assert.equal(result.damage.length,1);assert.equal(result.state.missed,1);
  s=requestIncident(c,emptyTraffic(),'fire',true,'3,1');result=run(c,s,152,none);assert.equal(result.damage.length,0);assert.equal(result.state.missed,1);
});
function cross(){let c=build(createCity(false),'road',roadPath({x:-2,z:0},{x:2,z:0})).city;return build(c,'road',roadPath({x:0,z:-2},{x:0,z:2})).city;}
test('three-lens signals show amber before all-red and match vehicle permission',()=>{
  const graph=roadGraph(cross());
  assert.equal(signalAspect(4.9,'0,0','ew'),'green');
  assert.equal(signalAspect(5.5,'0,0','ew'),'amber');
  assert.equal(signalAspect(6.5,'0,0','ew'),'red');
  assert.equal(signalAspect(6.5,'0,0','ns'),'red');
  assert.equal(signalAspect(12.5,'0,0','ns'),'amber');
  assert.equal(signalAllows(graph,'-1,0','0,0',5.5),false);
  for(const k of ['0,0','-6,2','10,-8'])for(let t=0;t<28;t+=.1){
    const ew=signalAspect(t,k,'ew'),ns=signalAspect(t,k,'ns');
    assert.ok(ew==='red'||ns==='red','conflicting approaches must never both proceed');
    assert.equal(signalPhase(t,k),ew==='green'?'ew':ns==='green'?'ns':'clear');
  }
});
test('traffic lights alternate axes with clearance and cars wait at red',()=>{
  const c=cross(),g=roadGraph(c);assert.equal(signalPhase(1,'0,0'),'ew');assert.equal(signalPhase(6.5,'0,0'),'clear');assert.equal(signalPhase(8,'0,0'),'ns');assert.equal(signalAllows(g,'-1,0','0,0',8),false);
  let s={...emptyTraffic(),time:7,vehicles:[car(1,['-1,0','0,0','1,0'],.2)]};s=run(c,s,3).state;assert.equal(s.vehicles[0].index,0);assert.equal(s.vehicles[0].progress,signalStopProgress(s.vehicles[0]));assert.ok(trafficSummary(s,c).queued>0);
  s=run(c,s,7).state;assert.ok(s.completed===1||s.vehicles[0].index>0);
});
test('following vehicles keep a gap and intersection entry is reserved',()=>{
  const c=cross();let s={...emptyTraffic(),time:8,vehicles:[car(1,['0,-1','0,0','0,1'],signalStopProgress(car(1,[]))),car(2,['-1,0','0,0','1,0'],signalStopProgress(car(2,[])))]};s=advanceTraffic(c,s,.1,options).state;assert.ok(s.vehicles[0].progress>signalStopProgress(s.vehicles[0]));assert.equal(s.vehicles[1].progress,signalStopProgress(s.vehicles[1]));
  const straight=build(createCity(false),'road',roadPath({x:0,z:0},{x:5,z:0})).city;let convoy={...emptyTraffic(),vehicles:[car(1,['0,0','1,0','2,0'],.8),car(2,['0,0','1,0','2,0'],.3)]};
  convoy=advanceTraffic(straight,convoy,.1,options).state;assert.ok(convoy.vehicles[0].progress-convoy.vehicles[1].progress>=.38);
});
test('routing avoids a congested road when an alternate connection exists',()=>{
  let c=build(createCity(false),'road',roadPath({x:0,z:0},{x:5,z:0})).city;c=build(c,'road',roadPath({x:0,z:1},{x:5,z:1})).city;
  const route=trafficRoute(c,['0,0'],['5,0'],{'2,0':10,'3,0':10});assert.ok(route.length);assert.ok(!route.includes('2,0'));assert.ok(!route.includes('3,0'));
});
test('pause leaves traffic unchanged and saved incidents/vehicles round-trip',()=>{
  const c=town(),s=advanceTraffic(c,requestIncident(c,emptyTraffic(),'medical'),.1,options).state;assert.equal(advanceTraffic(c,s,0,options).state,s);assert.deepEqual(decodeTraffic(JSON.parse(JSON.stringify(s))),{...s,locks:{}});
  assert.deepEqual(decodeTraffic(undefined),emptyTraffic());assert.throws(()=>decodeTraffic({...s,time:NaN}));assert.throws(()=>decodeTraffic({...s,vehicles:[{...s.vehicles[0],path:['bad']}]}));
});

test('busy starter town keeps traffic flowing and completes both responses',()=>{const city=createCity(),m=metrics(city),operational=new Set(Object.entries(m.lots).filter(([,l])=>l.supplied).map(([k])=>k));let state=requestIncident(city,emptyTraffic(),'medical',true,'-3,-7');state=requestIncident(city,state,'fire',true,'5,5');const result=run(city,state,120,{...options,operational});assert.equal(result.state.resolved,2);assert.equal(result.state.missed,0);assert.ok(result.state.completed>100);});


// A crossing on the same road cell must not freeze vehicles already driving away.
test('occupied crosswalks stop approaching cars but let departing lanes clear',()=>{
  const city=cross(),crossings=[{a:{x:-3,z:-3.5},b:{x:3,z:-3.5}}];
  const approach=car(1,['0,-1','0,0','0,1'],.2),depart=car(2,['0,0','0,1','0,2'],.4);
  const state={...emptyTraffic(),time:8,vehicles:[approach,depart]};
  const next=advanceTraffic(city,state,.1,{...options,pedestrianRoads:new Set(['0,0','0,-1']),pedestrianCrossings:crossings}).state;
  assert.equal(next.vehicles[0].progress,approach.progress,'approaching car yields before occupied stripes');
  assert.equal(next.vehicles[0].waitingFor,'crossing');
  assert.ok(next.vehicles[1].progress>depart.progress,'outbound lane clears the junction');
  const clear=advanceTraffic(city,next,.1,{...options,pedestrianCrossings:[]}).state;
  assert.ok(clear.vehicles[0].progress>approach.progress,'movement resumes after walkers clear');
});
test('dispatch distinguishes signal waits and preserves them through save loading',()=>{
  const city=cross(),state={...emptyTraffic(),time:7,nextId:2,vehicles:[car(1,['-1,0','0,0','1,0'],signalStopProgress(car(1,[])))]};
  let next=state;for(let i=0;i<10;i++)next=advanceTraffic(city,next,.1,options).state;
  assert.equal(next.vehicles[0].waitingFor,'signal');assert.equal(trafficSummary(next,city).waitingReasons.signal,1);
  assert.deepEqual(decodeTraffic(JSON.parse(JSON.stringify(next))),next);
});
