import assert from 'node:assert/strict';
import {createMasterplan} from '../src/masterplan';
import {decodeCity,metrics} from '../src/simulation';
import {emptyTraffic,advanceTraffic,decodeTraffic} from '../src/traffic';
import {emptyFootTraffic,advancePedestrians,pedestrianRoadBlocks} from '../src/pedestrians';
import {advanceCityClock,emptyClock} from '../src/gameClock';
import {restoreWasteUtilities,planWasteUtilities} from '../src/wasteRecovery';
import {cargoAmount,wasteSummary} from '../src/waste';

let city=createMasterplan(),traffic=emptyTraffic(),foot=emptyFootTraffic(),clock=emptyClock();
city={...city,climate:{season:'autumn',weather:'clear'},cells:Object.fromEntries(Object.entries(city.cells).filter(([,c])=>c.kind!=='power'&&c.kind!=='utility'))};
const lots=Object.entries(city.cells).filter(([,c])=>c.kind==='residential').slice(0,55);
city={...city,waste:{...city.waste!,lots:Object.fromEntries(lots.map(([k])=>[k,16])),generated:lots.length*16}};
const before=wasteSummary(city),plan=planWasteUtilities(city);
assert.equal(plan.problem,'');assert.ok(plan.additions.length>0);
city=restoreWasteUtilities(city).city;
for(let i=0;i<3600;i++){
  const m=metrics(city);foot=advancePedestrians(city,foot,traffic,.1);
  const r=advanceTraffic(city,traffic,.1,{operational:new Set(Object.entries(m.lots).filter(([,v])=>v.supplied).map(([k])=>k)),health:m.health,fireRisk:m.fireRisk,pedestrianRoads:pedestrianRoadBlocks(foot),autoIncidents:false});
  traffic=r.state;city={...city,waste:r.waste,crime:r.crime,maintenance:r.maintenance};({city,clock}=advanceCityClock(city,clock,.1));
  if(i%600===599)console.log(JSON.stringify({seconds:(i+1)/10,overflow:wasteSummary(city).overflow,waiting:wasteSummary(city).waiting,collected:city.waste?.collected,stalled:traffic.vehicles.filter(v=>v.kind==='garbage'&&v.waiting>30).length}));
}
const after=wasteSummary(city),w=city.waste!;
const total=after.waiting+after.stored+traffic.vehicles.reduce((n,v)=>n+cargoAmount(v),0)+w.recycled+w.exported;
assert.equal(after.overflow,0);assert.ok(Math.abs(total-w.generated)<.00001);
decodeCity(JSON.parse(JSON.stringify(city)));decodeTraffic(JSON.parse(JSON.stringify(traffic)));
console.log(JSON.stringify({before:before.overflow,after:after.overflow,utilitiesBuilt:plan.additions.length,cost:plan.cost,collected:w.collected,wasteConserved:true,saveRoundTrip:true}));
