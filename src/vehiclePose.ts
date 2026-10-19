import {STREET_SCALE} from './worldScale';
import type {City} from './simulation';
import type {Vehicle} from './traffic';
type Point={x:number;z:number};
const direction=(a:Point,b:Point)=>({x:Math.sign(b.x-a.x),z:Math.sign(b.z-a.z)});
/** Rendering follows the existing path; blend a quarter-turn across the shared node. */
export function vehicleRoadPose(city:City,v:Vehicle){
  const a=city.cells[v.path[v.index]],b=city.cells[v.path[v.index+1]]||a;if(!a||!b)return undefined;
  const prevCell=city.cells[v.path[v.index-1]||v.approach||''];
  const d=a===b&&prevCell?direction(prevCell,a):direction(a,b),p=v.progress;
  if(v.uTurn){
    const {dx,dz,progress}=v.uTurn,angle=Math.PI*progress,r=STREET_SCALE.laneOffset;
    return {x:a.x*8+dz*r*Math.cos(angle)+dx*r*Math.sin(angle),z:a.z*8-dx*r*Math.cos(angle)+dz*r*Math.sin(angle),heading:Math.atan2(dx*Math.cos(angle)-dz*Math.sin(angle),dz*Math.cos(angle)+dx*Math.sin(angle)),turn:-1};
  }
  let x=(a.x+d.x*p)*8+d.z*STREET_SCALE.laneOffset,z=(a.z+d.z*p)*8-d.x*STREET_SCALE.laneOffset,heading=Math.atan2(d.x,d.z);
  const curve=(node:Point,incoming:Point,outgoing:Point,t:number)=>{
    const start={x:node.x*8-incoming.x*2+incoming.z*STREET_SCALE.laneOffset,z:node.z*8-incoming.z*2-incoming.x*STREET_SCALE.laneOffset};
    const end={x:node.x*8+outgoing.x*2+outgoing.z*STREET_SCALE.laneOffset,z:node.z*8+outgoing.z*2-outgoing.x*STREET_SCALE.laneOffset};
    const corner={x:node.x*8+(incoming.z+outgoing.z)*STREET_SCALE.laneOffset,z:node.z*8-(incoming.x+outgoing.x)*STREET_SCALE.laneOffset};
    x=(1-t)**2*start.x+2*(1-t)*t*corner.x+t*t*end.x;z=(1-t)**2*start.z+2*(1-t)*t*corner.z+t*t*end.z;
    heading=Math.atan2((1-t)*(corner.x-start.x)+t*(end.x-corner.x),(1-t)*(corner.z-start.z)+t*(end.z-corner.z));
  };
  const prev=city.cells[v.path[v.index-1]],next=city.cells[v.path[v.index+2]];
  if(prev&&p<.25){const incoming=direction(prev,a);if(incoming.x*d.z-incoming.z*d.x)curve(a,incoming,d,(p+.25)/.5);}
  if(next&&p>.75){const outgoing=direction(b,next);if(d.x*outgoing.z-d.z*outgoing.x)curve(b,d,outgoing,(p-.75)/.5);}
  const turn=next?d.x*(next.z-b.z)-d.z*(next.x-b.x):0;
  return {x,z,heading,turn:p>.55?Math.sign(turn):0};
}
