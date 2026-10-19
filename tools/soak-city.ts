import {writeFileSync,readFileSync} from 'node:fs';
import {createMasterplan} from '../src/masterplan';
import {metrics,tick,decodeCity} from '../src/simulation';
import {emptyTraffic,advanceTraffic,decodeTraffic} from '../src/traffic';
import {emptyFootTraffic,advancePedestrians,pedestrianRoadBlocks} from '../src/pedestrians';
import {wasteSummary,cargoAmount} from '../src/waste';
let city=createMasterplan(),traffic=emptyTraffic(),foot=emptyFootTraffic(),m=metrics(city);
const seconds=Number(process.argv[2]||360),out=process.argv[3]||'baseline';
if(process.argv[4]){const saved=JSON.parse(readFileSync(process.argv[4],'utf8'));city=decodeCity(saved.city);traffic=decodeTraffic(saved.traffic);foot=saved.foot;m=metrics(city);}
let trafficMs=0,walkingMs=0,metricsMs=0;
for(let i=0;i<seconds*10;i++){
  let start=performance.now();foot=advancePedestrians(city,foot,traffic,.1);walkingMs+=performance.now()-start;
  start=performance.now();const r=advanceTraffic(city,traffic,.1,{operational:new Set(Object.entries(m.lots).filter(([,l])=>l.supplied).map(([k])=>k)),health:m.health,fireRisk:m.fireRisk,autoIncidents:false,pedestrianRoads:pedestrianRoadBlocks(foot)});trafficMs+=performance.now()-start;
  traffic=r.state;city={...city,waste:r.waste,crime:r.crime};
  if(i%20===19){start=performance.now();city=tick(city);m=metrics(city);metricsMs+=performance.now()-start;}
  if(i%600===599)console.log(JSON.stringify({seconds:(i+1)/10,happiness:m.happiness,concerns:m.wellbeing.complaints,waste:wasteSummary(city),cargo:traffic.vehicles.reduce((n,v)=>n+cargoAmount(v),0),collected:city.waste?.collected,walkers:foot.agents.length,visits:foot.visits,patrols:city.crime?.visits,trips:traffic.completed,boarded:traffic.transit.boarded,delivered:traffic.transit.delivered,stuck:traffic.vehicles.filter(v=>v.waiting>30).length}));
}
writeFileSync(`tools/${out}-snapshot.json`,JSON.stringify({city,traffic,foot}));
console.log(JSON.stringify({trafficMs,walkingMs,metricsMs}));
const w=city.waste!,total=Object.values(w.lots).reduce((a,b)=>a+b,0)+Object.values(w.stored).reduce((a,b)=>a+b,0)+traffic.vehicles.reduce((n,v)=>n+cargoAmount(v),0)+w.recycled+w.exported;
if(Math.abs(total-w.generated)>.00001)throw Error(`Waste accounting: ${total} vs ${w.generated}`);
decodeCity(JSON.parse(JSON.stringify(city)));decodeTraffic(JSON.parse(JSON.stringify(traffic)));
console.log(JSON.stringify({wasteConserved:true,saveRoundTrip:true,maxWait:Math.max(0,...traffic.vehicles.map(v=>v.waiting))}));
