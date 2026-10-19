import {readFileSync,writeFileSync} from 'node:fs';
import {metrics,type City} from '../src/simulation';
import {vehicleRoadPose} from '../src/vehiclePose';
import {pedestrianRoadBlocks} from '../src/pedestrians';
const {city,traffic,foot}=JSON.parse(readFileSync('tools/baseline-snapshot.json','utf8'));
let elapsed=0,result;
for(let i=0;i<20;i++){const start=performance.now();result=metrics({...city} as City);elapsed+=performance.now()-start;}
const name=process.argv[2]||'baseline';writeFileSync(`tools/${name}-metrics.json`,JSON.stringify(result));console.log('metrics mean ms:',elapsed/20);
const blocked=pedestrianRoadBlocks(foot);console.log('crossings', [...blocked]);
for(const v of traffic.vehicles.filter((v:any)=>v.waiting>30&&v.kind!=='car')){
 const a=v.path[v.index],b=v.path[v.index+1];console.log('LEAD',v);
 console.log('NEAR',traffic.vehicles.filter((o:any)=>o.id!==v.id&&[a,b].includes(o.path[o.index])).map((o:any)=>({id:o.id,kind:o.kind,stage:o.stage,turn:o.uTurn,path:o.path.slice(Math.max(0,o.index-1),o.index+3),progress:o.progress,waiting:o.waiting,pose:vehicleRoadPose(city,o)})));
}
