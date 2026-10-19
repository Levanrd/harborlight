import {createShowcaseCity} from '../src/showcase';
import {metrics} from '../src/simulation';
import {emptyTraffic,advanceTraffic} from '../src/traffic';
import {emptyFootTraffic,advancePedestrians,pedestrianRoadBlocks} from '../src/pedestrians';
const city=createShowcaseCity(),m=metrics(city),options={operational:new Set(Object.entries(m.lots).filter(([,l])=>l.supplied).map(([k])=>k)),health:m.health,fireRisk:m.fireRisk,autoIncidents:false};
let traffic=emptyTraffic(),foot=emptyFootTraffic();
for(let i=0;i<1800;i++){foot=advancePedestrians(city,foot,traffic,.1);traffic=advanceTraffic(city,traffic,.1,{...options,pedestrianRoads:pedestrianRoadBlocks(foot)}).state;}
console.log({walkers:foot.agents.length,visits:foot.visits,crossings:foot.crossings,waiting:foot.agents.filter(p=>p.waiting).length,vehicles:traffic.vehicles.length,carTrips:traffic.completed});
