import * as THREE from 'three';
import {RegionalDetails} from './regionalDetails';
import {batchScenery,type VisualKit} from './cityVisuals';
import {waterEdge,type Cell} from './simulation';
import {regionalConfig,type RegionalKind} from './regional';
import {airportPose,seaportPose,regionalCycleSeconds} from './regionalMotion';
export function drawRegional(c:Cell,g:THREE.Group,kit:VisualKit,details:RegionalDetails){
  const {box:b,tree}=kit,kind=c.kind as RegionalKind,cfg=regionalConfig[kind],x=(c.x+(cfg.width-1)/2)*8,z=(c.z+(cfg.depth-1)/2)*8;
  const w=cfg.width*8-1,d=cfg.depth*8-1;
  if(kind==='railway')b(g,x,.3,z,w,.18,d,'#aebdb6');
  if(kind==='airport'){details.airport(g,x,z);
  }else if(kind==='railway'){
    for(const zz of [z-3,z+3]){b(g,x,.5,zz,w,.12,2.8,'#7a8584');for(let i=-14;i<=14;i+=1.2)b(g,x+i,.63,zz,.35,.1,2.7,'#927b68');for(const side of [-1,1])b(g,x,.75,zz+side*.8,w,.12,.12,'#c6d1cd');}
    b(g,x,.5,z,w-2,.7,2.5,'#d9d6c7');
    for(const dx of [-10,-5,0,5,10]){b(g,x+dx,1.2,z,.22,3,.22,'#506571');b(g,x+dx,3.9,z,.2,.1,4,'#fff0b0');}
    b(g,x,4.2,z,w-1,.3,4.5,'#7aa6b8');b(g,x-7,.6,z-6,11,3.8,3,'#e6d3b2');b(g,x-7,1.1,z-4.45,9.5,2.5,.08,'#578caa');b(g,x-7,4.4,z-6,12,.25,3.5,'#ede3ce');
    b(g,x+8,1.2,z,2.3,.35,.7,'#927b68');tree(g,x+13,z-6,.8);
  }else{details.seaport(g,x,z,waterEdge(z)+7);
  }
}
export type RegionalActor={group:THREE.Group;cell:Cell;time:number};
export function createRegionalActor(c:Cell,kit:VisualKit,details:RegionalDetails):RegionalActor{
  const group=new THREE.Group(),b=kit.box;
  if(c.kind==='airport'){details.aircraft(group);
  }else if(c.kind==='railway'){
    for(const dx of [-4,0,4]){b(group,dx,0,0,3.8,1.5,1.7,'#e9e6d6');b(group,dx,1.5,0,3.8,.18,1.8,'#79b9dc');for(const side of [-1,1]){b(group,dx,.6,side*.86,3.2,.55,.04,'#477e99');b(group,dx,.25,side*.87,3.6,.18,.05,'#cb9663');}}
  }else{details.ship(group);}
  // The vessel/airframe moves as a whole; only the gear needs a separate batch.
  const gear=group.getObjectByName('Landing gear');gear?.removeFromParent();
  batchScenery(group);
  if(gear){batchScenery(gear as THREE.Group);group.add(gear);}
  return {group,cell:c,time:Math.abs(c.x+c.z)%8};
}
/** Visual service cycles follow the simulation speed; accounting stays in tick(). */
export function animateRegionalActor(actor:RegionalActor,dt:number,active:boolean){
  const {group,cell:c}=actor,cfg=regionalConfig[c.kind as RegionalKind],x=(c.x+(cfg.width-1)/2)*8,z=(c.z+(cfg.depth-1)/2)*8;
  if(active)actor.time+=dt;
  group.visible=true;
  if(c.kind==='airport'){
    const pose=airportPose(actor.time);group.position.set(x+pose.x,pose.y,z+pose.z);group.rotation.set(0,pose.yaw,pose.pitch);group.visible=pose.visible;group.userData.phase=pose.phase;
    const gear=group.getObjectByName('Landing gear');if(gear)gear.visible=pose.gear;
  }else if(c.kind==='railway'){
    const t=actor.time%regionalCycleSeconds.railway,xx=t<6?-9+t*1.5:t<18?0:Math.min(9,(t-18)*1.5);group.position.set(x+xx,1,z+3);group.visible=t<24;
  }else{const pose=seaportPose(actor.time,z);group.position.set(pose.x,pose.y,pose.z);group.rotation.set(0,pose.yaw,pose.roll);group.visible=pose.visible;group.userData.phase=pose.phase;}
}
