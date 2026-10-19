import {signalStopProgress} from './worldScale';
import {unlockedCity as createCity} from './testCity';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build,roadPath,metrics,tick,decodeCity,constructionChange,undoConstruction,type City} from './simulation';
import {advanceTraffic,emptyTraffic,decodeTraffic,trafficRoute,type TrafficState} from './traffic';
import {emptyWaste,wasteDay,wasteSummary,cargoAmount,clearWasteFacility,wasteCapacity,wastePollution,wastePollutionSampler,isWasteFacility,OVERFLOW,updateWasteFleet} from './waste';
import {planWasteUtilities,restoreWasteUtilities} from './wasteRecovery';

function town(kind:'landfill'|'recycling'='landfill'){
  let c=build(createCity(false),'road',roadPath({x:-5,z:0},{x:6,z:0})).city;
  for(const [type,x,z]of [[kind,-5,1],['utility',-4,1],['residential',1,1],['commercial',3,1],['industrial',5,1]] as const)c=build(c,type,[{x,z}]).city;
  for(const k of ['1,1','3,1','5,1'])c.cells[k]={...c.cells[k],occupancy:12,age:30};
  return {...c,waste:{...emptyWaste(),lots:{'1,1':30,'3,1':25,'5,1':20}}};
}
function run(city:City,state=emptyTraffic(),seconds=90,economy=false){
  for(let i=0;i<seconds*10;i++){const m=metrics(city),result=advanceTraffic(city,state,.1,{operational:new Set(Object.entries(m.lots).filter(([,l])=>l.supplied).map(([k])=>k)),health:m.health,fireRisk:m.fireRisk,autoIncidents:false});state=result.state;if(result.waste!==city.waste)city={...city,waste:result.waste};if(economy&&i%20===19)city=tick(city);}
  return {city,state};
}
const total=(city:City,state:TrafficState)=>Object.values(city.waste?.lots||{}).reduce((a,b)=>a+b,0)+Object.values(city.waste?.stored||{}).reduce((a,b)=>a+b,0)+state.vehicles.filter(v=>v.kind==='garbage').reduce((n,v)=>n+cargoAmount(v),0)+(city.waste?.recycled||0)+(city.waste?.exported||0);

test('occupied lots generate daily garbage; pauses do not advance waste or traffic',()=>{
  const c=town(),w=wasteDay(c,new Set());assert.ok(w.lots['1,1']>30);assert.ok(w.lots['5,1']-20>w.lots['1,1']-30);assert.ok(w.generated>0);
  const state=emptyTraffic(),paused=advanceTraffic(c,state,0,{operational:new Set(),health:90,fireRisk:10});assert.equal(paused.state,state);assert.equal(paused.waste,c.waste);assert.equal(c.waste.lots['1,1'],30);
});
test('uncollected waste lowers happiness and raises pollution; recycling has less local pollution',()=>{
  const dirty=town(),clean={...dirty,waste:emptyWaste()};assert.ok(metrics(dirty).happiness<metrics(clean).happiness);assert.ok(metrics(dirty).lots['1,1'].pollution>metrics(clean).lots['1,1'].pollution);assert.equal(wasteSummary(dirty).overflow,3);
  const landfill=town(),recycling=town('recycling');assert.ok(metrics(landfill).lots['-4,1'].pollution>metrics(recycling).lots['-4,1'].pollution);
});

test('contained rubbish does not emit street litter pollution before bins overflow',()=>{
  const c:City=town(),home=c.cells['1,1'];c.waste!.lots={'1,1':OVERFLOW};const contained=wastePollution(c,home);
  c.waste!.lots={};assert.equal(wastePollution(c,home),contained);
  c.waste!.lots={'1,1':OVERFLOW+3};assert.ok(wastePollution(c,home)>contained);
});
test('garbage trucks visit lots, collect cargo, unload and preserve total waste',()=>{
  const original=town(),{city,state}=run(original);assert.ok(city.waste!.collected>=74.99);assert.ok(wasteSummary(city).waiting<.01);assert.ok(metrics(city).happiness>metrics(original).happiness);assert.ok(Math.abs(total(city,state)-75)<.00001);assert.equal(original.waste.collected,0);
});
test('recycling processes delivered waste only with working utilities',()=>{
  const c=town('recycling');c.waste.stored={'-5,1':40};const without=wasteDay(c,new Set()),withUtilities=wasteDay(c,new Set(['-5,1']));assert.equal(without.stored['-5,1'],40);assert.equal(withUtilities.stored['-5,1'],28);assert.equal(withUtilities.recycled,12);
  const {city,state}=run(c,emptyTraffic(),90,true);assert.ok(city.waste!.recycled>40);assert.ok(Math.abs(total(city,state)-(115+city.waste!.generated))<.00001);
});
test('full storage stops pickups; paid hauling releases space without losing accounting',()=>{
  const c=town();c.waste.stored={'-5,1':1995};const full=run(c);assert.ok(full.city.waste!.stored['-5,1']<=2000);assert.ok(Math.abs(full.city.waste!.stored['-5,1']-2000)<.00001);assert.ok(full.city.waste!.collected<=5.00001);assert.ok(Math.abs(total(full.city,full.state)-2070)<.00001);
  const cleared=clearWasteFacility(full.city,'-5,1');assert.equal(cleared.city.money,full.city.money-4000);assert.equal(cleared.city.waste!.exported,2000);assert.equal(cleared.city.waste!.stored['-5,1'],0);assert.ok(run(cleared.city,full.state).city.waste!.collected>5);
  const poor={...full.city,money:1};assert.equal(clearWasteFacility(poor,'-5,1').city,poor);
});
test('missing utilities or a road break cannot dispatch phantom collection',()=>{
  let c:City=town();c=build(c,'bulldoze',[{x:-4,z:1}]).city;assert.equal(run(c,emptyTraffic(),10).state.vehicles.filter(v=>v.kind==='garbage').length,0);
  const isolated=build(town(),'bulldoze',[{x:0,z:0}]).city;const result=run(isolated,emptyTraffic(),10);assert.equal(result.city.waste!.collected,0);assert.equal(result.state.vehicles.filter(v=>v.kind==='garbage').length,0);
});
test('interrupted loaded trucks restore their cargo; filled facilities cannot be demolished or undone',()=>{
  const original=town();let result=run(original,emptyTraffic(),15);assert.ok(result.state.vehicles.some(v=>v.kind==='garbage'&&cargoAmount(v)>0));
  const loaded=result.state.vehicles.find(v=>v.kind==='garbage'&&cargoAmount(v)>0)!,road=result.city.cells[loaded.path[loaded.index]];
  result=run(build(result.city,'bulldoze',[road]).city,result.state,1);assert.ok(Math.abs(total(result.city,result.state)-75)<.00001);
  const full=run(original).city;assert.equal(build(full,'bulldoze',[{x:-5,z:1}]).ok,false);
  const before=build(createCity(false),'road',roadPath({x:-5,z:0},{x:6,z:0})).city,after=build(before,'landfill',[{x:-5,z:1}]).city,change=constructionChange(before,after);
  const used={...after,waste:{...emptyWaste(),stored:{'-5,1':1}}};assert.equal(undoConstruction(used,change),used);
});
test('waste and active collection survive backups, and legacy saves remain valid',()=>{
  const {city,state}=run(town(),emptyTraffic(),15);assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(city))),city);assert.deepEqual(decodeTraffic(JSON.parse(JSON.stringify(state))),state);assert.equal(decodeCity(createCity()).waste,undefined);
  assert.throws(()=>decodeCity({...city,waste:{...city.waste,lots:{'1,1':-3}}}));assert.throws(()=>decodeCity({...city,waste:{...city.waste,collected:NaN}}));
  const truck=state.vehicles.find(v=>v.kind==='garbage')!;assert.throws(()=>decodeTraffic({...state,vehicles:[{...truck,cargo:{'1,1':61}}]}));
  assert.equal(wasteCapacity.recycling,200);
});

test('collection trucks obey red lights before continuing to their pickup',()=>{
  const city=build(town(),'road',roadPath({x:0,z:-2},{x:0,z:2})).city;
  const state:TrafficState={...emptyTraffic(),time:7,nextId:100,vehicles:[{id:1,kind:'garbage',station:'-5,1',target:'1,1',cargo:{},path:['-1,0','0,0','1,0'],index:0,progress:.1,waiting:0,stage:'outbound'}]};
  const red=run(city,state,2),truck=red.state.vehicles.find(v=>v.id===1)!;
  assert.equal(truck.index,0);assert.equal(truck.progress,signalStopProgress(truck));assert.ok(truck.waiting>0);
  const green=run(red.city,red.state,70);assert.ok(green.city.waste!.collected>0);
});

test('pollution sampling matches the full-city formula, including overflow and storage changes',()=>{
  let city:City=town();city={...city,waste:{...emptyWaste(),lots:{'3,1':OVERFLOW+9,'5,1':OVERFLOW},stored:{'-5,1':1400}}};
  const reference=(c:City['cells'][string])=>{let facilities=0,litter=0;for(const [k,p]of Object.entries(city.cells)){const distance=Math.hypot(c.x-p.x,c.z-p.z);if(isWasteFacility(p.kind)){const fullness=Math.min(1,(city.waste?.stored[k]||0)/wasteCapacity[p.kind]);facilities+=Math.max(0,1-distance/6)*(p.kind==='landfill'?18+fullness*32:4+fullness*6);}const amount=city.waste?.lots[k]||0;if(amount>OVERFLOW)litter+=Math.max(0,1-distance/2.5)*Math.min(25,(amount-OVERFLOW)*2);}return facilities+Math.min(30,litter);};
  for(const change of [false,true]){if(change)city={...city,waste:emptyWaste()};const sample=wastePollutionSampler(city);for(const c of Object.values(city.cells))assert.equal(sample(c),reference(c));}
});

test('overflowing bins outrank nearby small pickups and police do not reserve garbage targets',()=>{
  const c=build(town(),'commercial',[{x:-3,z:1}]).city;
  c.waste={...emptyWaste(),lots:{'5,1':12,'-3,1':11}};
  const s=emptyTraffic();s.time=1;s.nextId=2;
  s.vehicles=[{id:1,kind:'police',target:'5,1',station:'-4,1',path:['5,0'],index:0,progress:0,waiting:0,stage:'onscene'}];
  updateWasteFleet(c,s,.1,new Set(['-5,1']),{route:(a,b)=>trafficRoute(c,a,b),access:k=>{const p=c.cells[k];return p?[`${p.x},0`]:[];}});
  assert.equal(s.vehicles.find(v=>v.kind==='garbage')?.target,'5,1');
});

test('missing collection utilities are built on vacant lots and real trucks clear overflowing bins',()=>{
  const c=build(town(),'bulldoze',[{x:-4,z:1}]).city;
  assert.equal(metrics(c).lots['-5,1'].supplied,false);
  const before=JSON.stringify(c),plan=planWasteUtilities(c);
  assert.equal(plan.problem,'');assert.equal(plan.additions.length,3);
  assert.deepEqual(new Set(plan.additions.map(p=>p.kind)),new Set(['power','water','sewage']));
  assert.equal(JSON.stringify(c),before);
  const repaired=restoreWasteUtilities(c).city;
  assert.equal(repaired.money,c.money-plan.cost);
  assert.equal(metrics(repaired).lots['-5,1'].supplied,true);
  for(const [k,cell]of Object.entries(c.cells))assert.deepEqual(repaired.cells[k],cell);
  assert.equal(repaired.waste,c.waste,'utility construction must not erase garbage');
  const result=run(repaired,emptyTraffic(),120);
  assert.equal(wasteSummary(result.city).overflow,0);
  assert.ok(result.city.waste!.collected>74.99);
  assert.ok(Math.abs(total(result.city,result.state)-75)<.00001);
  assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(result.city))),result.city);
  assert.equal(restoreWasteUtilities(repaired).city,repaired,'already supplied city needs no construction');
});

test('utility recovery respects treasury and disconnected facilities without partial construction',()=>{
  const c=build(town(),'bulldoze',[{x:-4,z:1}]).city,poor={...c,money:1};
  assert.equal(restoreWasteUtilities(poor).city,poor);
  assert.match(restoreWasteUtilities(poor).message,/treasury/);
  const isolated=build(c,'bulldoze',[{x:-5,z:0}]).city;
  assert.equal(restoreWasteUtilities(isolated).city,isolated);
  assert.match(restoreWasteUtilities(isolated).message,/road access/);
});

test('utility repair only adds the missing resource to the affected network',()=>{
  let c=build(town(),'bulldoze',[{x:-4,z:1}]).city;
  c=build(c,'power',[{x:-4,z:1}]).city;c=build(c,'water',[{x:-3,z:1}]).city;
  const plan=planWasteUtilities(c);
  assert.equal(plan.problem,'');assert.deepEqual(plan.additions.map(p=>p.kind),['sewage']);
  assert.equal(metrics(plan.city).lots['-5,1'].supplied,true);
});
