import {createMasterplan} from '../src/masterplan';
import {metrics,tick} from '../src/simulation';
import {emptyTraffic,advanceTraffic} from '../src/traffic';
import {emptyFootTraffic,advancePedestrians,pedestrianRoadBlocks} from '../src/pedestrians';
import {wasteSummary} from '../src/waste';
let city=createMasterplan(),traffic=emptyTraffic(),foot=emptyFootTraffic(),m=metrics(city);
for(let i=0;i<3600;i++){
  foot=advancePedestrians(city,foot,traffic,.1);
  const r=advanceTraffic(city,traffic,.1,{operational:new Set(Object.entries(m.lots).filter(([,l])=>l.supplied).map(([k])=>k)),health:m.health,fireRisk:m.fireRisk,autoIncidents:false,pedestrianRoads:pedestrianRoadBlocks(foot)});
  traffic=r.state;city={...city,waste:r.waste,crime:r.crime};
  if(i%20===19){city=tick(city);m=metrics(city);}
  if(i%600===599)console.log({seconds:(i+1)/10,happiness:m.happiness,concerns:m.wellbeing.complaints,waste:wasteSummary(city),trucks:traffic.vehicles.filter(v=>v.kind==='garbage').length,collected:city.waste?.collected,walkers:foot.agents.length,visits:foot.visits});
}
console.log('Concern types',Object.values(m.wellbeing.lots).flatMap(l=>l.issues).reduce<Record<string,number>>((a,i)=>({...a,[i.title]:(a[i.title]||0)+1}),{}));
console.log('Vehicles',traffic.vehicles.filter(v=>v.waiting>30).map(v=>({id:v.id,kind:v.kind,waiting:Math.round(v.waiting),turn:v.uTurn,from:v.path[v.index],to:v.path[v.index+1],progress:v.progress})), 'police visits',city.crime?.visits);
