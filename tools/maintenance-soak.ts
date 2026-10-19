import assert from 'node:assert/strict';
import {createMasterplan} from '../src/masterplan';
import {metrics,decodeCity} from '../src/simulation';
import {advanceCityClock,emptyClock} from '../src/gameClock';
import {advanceTraffic,emptyTraffic,decodeTraffic} from '../src/traffic';
import {advancePedestrians,emptyFootTraffic,pedestrianRoadBlocks} from '../src/pedestrians';
import {emptyMaintenance,maintenanceSummary} from '../src/maintenance';
let city=createMasterplan(),traffic=emptyTraffic(),foot=emptyFootTraffic(),clock=emptyClock();
city={...city,climate:{season:'winter',weather:'snow'},maintenance:{...emptyMaintenance(),budget:150}};
// Start with an affected network so the test exercises restoration immediately.
for(const [k,c]of Object.entries(city.cells))if(c.kind==='road')city.maintenance!.roads[k]={snow:30,wear:5};
for(let i=0;i<1800;i++){
  const m=metrics(city);foot=advancePedestrians(city,foot,traffic,.1);
  const r=advanceTraffic(city,traffic,.1,{operational:new Set(Object.entries(m.lots).filter(([,l])=>l.supplied).map(([k])=>k)),health:m.health,fireRisk:m.fireRisk,pedestrianRoads:pedestrianRoadBlocks(foot),autoIncidents:false});
  traffic=r.state;city={...city,waste:r.waste,crime:r.crime,maintenance:r.maintenance};({city,clock}=advanceCityClock(city,clock,.1));
}
assert.ok(city.maintenance!.completed>0);assert.ok(traffic.completed>0);assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(city))),city);decodeTraffic(JSON.parse(JSON.stringify(traffic)));
const summary=maintenanceSummary(city);console.log(JSON.stringify({seconds:180,depots:summary.depots.length,completedJobs:city.maintenance!.completed,crews:traffic.vehicles.filter(v=>v.kind==='maintenance').length,roadCondition:summary.average,poorRoads:summary.poor,carTrips:traffic.completed,busDeliveries:traffic.transit.delivered,walkingVisits:foot.visits,maxVehicleWait:Math.max(0,...traffic.vehicles.map(v=>v.waiting)),saveRoundTrip:true}));
