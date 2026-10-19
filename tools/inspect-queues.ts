import {readFileSync} from 'node:fs';
import {vehicleRoadPose} from '../src/vehiclePose';
import {pedestrianRoadBlocks} from '../src/pedestrians';
const {city,traffic,foot}=JSON.parse(readFileSync(`tools/${process.argv[2]||'optimized'}-snapshot.json`,'utf8'));
const crossings=pedestrianRoadBlocks(foot);
console.log('crossings', [...crossings]);
for(const v of traffic.vehicles.filter((v:any)=>v.waiting>30).sort((a:any,b:any)=>b.waiting-a.waiting)){
 const a=v.path[v.index],b=v.path[v.index+1];const blockers=traffic.vehicles.filter((o:any)=>o.id!==v.id&&o.stage!=='onscene'&&((o.path[o.index]===a&&o.path[o.index+1]===b&&o.progress>v.progress)||(o.path[o.index]===b&&o.path[o.index+1]===v.path[v.index+2]&&o.progress<.58)||(o.uTurn&&o.path[o.index]===b))).map((o:any)=>o.id);
 console.log(JSON.stringify({id:v.id,kind:v.kind,wait:Math.round(v.waiting),path:v.path.slice(Math.max(0,v.index-1),v.index+3),p:v.progress,turn:v.uTurn,cross:crossings.has(a)||crossings.has(b),blockers}));
}
console.log('Crossing walkers',foot.agents.filter((p:any)=>p.path[p.index+1]?.crossing&&p.progress>0).map((p:any)=>({id:p.id,index:p.index,progress:p.progress,waiting:p.waiting,path:p.path.slice(p.index,p.index+2)})));
