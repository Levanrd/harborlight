import assert from 'node:assert/strict';
import {createMasterplan} from '../src/masterplan';
import {metrics,decodeCity} from '../src/simulation';
import {advanceCityClock,emptyClock,decodeClock} from '../src/gameClock';
import {emptyTraffic,advanceTraffic,decodeTraffic} from '../src/traffic';
import {emptyFootTraffic,advancePedestrians,pedestrianRoadBlocks} from '../src/pedestrians';
import {cargoAmount} from '../src/waste';
for(const weather of ['clear','storm','snow'] as const){
  let city={...createMasterplan(),climate:{season:'winter' as const,weather}},clock={...emptyClock(),dayProgress:0},traffic=emptyTraffic(),foot=emptyFootTraffic();
  for(let i=0;i<1200;i++){
    const m=metrics(city);foot=advancePedestrians(city,foot,traffic,.1);
    const result=advanceTraffic(city,traffic,.1,{operational:new Set(Object.entries(m.lots).filter(([,l])=>l.supplied).map(([k])=>k)),health:m.health,fireRisk:m.fireRisk,autoIncidents:false,pedestrianRoads:pedestrianRoadBlocks(foot)});
    traffic=result.state;if(result.waste!==city.waste||result.crime!==city.crime)city={...city,waste:result.waste,crime:result.crime};
    const next=advanceCityClock(city,clock,.1);city=next.city as typeof city;clock=next.clock;
  }
  const w=city.waste!,total=Object.values(w.lots).reduce((a,b)=>a+b,0)+Object.values(w.stored).reduce((a,b)=>a+b,0)+traffic.vehicles.reduce((n,v)=>n+cargoAmount(v),0)+w.recycled+w.exported;
  assert.ok(Math.abs(total-w.generated)<.00001);assert.equal(city.day,createMasterplan().day+1);assert.ok(traffic.completed>0);
  assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(city))),city);assert.deepEqual(decodeClock(clock),clock);decodeTraffic(traffic);
  console.log(JSON.stringify({weather,seconds:120,day:city.day,trips:traffic.completed,visits:foot.visits,walkers:foot.agents.length,patrols:city.crime?.visits,garbageCollected:w.collected,busDeliveries:traffic.transit.delivered,maxWait:Math.max(0,...traffic.vehicles.map(v=>v.waiting)),wasteConserved:true,saveRoundTrip:true}));
}
