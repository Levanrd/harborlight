import {STREET_SCALE} from './worldScale';
import type {Cell,City} from './simulation';
import type {VisualKit} from './cityVisuals';
import * as THREE from 'three';
export function streetLinks(city:City,c:Cell){return [[-1,0],[1,0],[0,-1],[0,1]].map(([dx,dz])=>city.cells[`${c.x+dx},${c.z+dz}`]?.kind==='road');}
export function drawStreetDetails(c:Cell,links:boolean[],g:THREE.Group,kit:VisualKit){
  const [left,right,up,down]=links,b=kit.box,x=c.x*8,z=c.z*8,count=links.filter(Boolean).length;
  const edge=c.avenue?3.55:3.15,walk=4-edge,paint='#d9d9cb',curb='#b7b9af',paving='#d9d6c7';
  for(let i=0;i<4;i++)if(!links[i]){
    const dx=i===0?-1:i===1?1:0,dz=i===2?-1:i===3?1:0;
    b(g,x+dx*(edge+walk/2),.25,z+dz*(edge+walk/2),dx?walk:8,.16,dz?walk:8,paving);
    b(g,x+dx*edge,.25,z+dz*edge,dx?.12:8,.24,dz?.12:8,curb);
    // Concrete gutter and joints break up the old uninterrupted toy-like curb.
    b(g,x+dx*(edge-.17),.255,z+dz*(edge-.17),dx?.22:8,.012,dz?.22:8,'#858b87');
    for(const along of [-3,-1.5,0,1.5,3])b(g,x+dx*edge+(dz?along:0),.49,z+dz*edge+(dx?along:0),dx?.13:.018,.004,dz?.13:.018,'#777e79');
  }
  // Corner sidewalk islands keep junctions readable without changing their graph.
  if(count>=3)for(const dx of [-1,1])for(const dz of [-1,1])b(g,x+dx*3.65,.25,z+dz*3.65,.7,.2,.7,paving);
  const straight=(left&&right&&!up&&!down)||(up&&down&&!left&&!right);
  if(straight){for(const offset of c.avenue?[-.14,.14]:[0])for(const along of c.avenue?[0]:[-2.7,0,2.7]){
    const length=c.avenue?8:1.65;
    b(g,x+(left?along:offset),.272,z+(left?offset:along),left?length:.075,.012,left?.075:length,c.avenue?'#c9ac62':paint);
  }
    // Thin edge lines retain a paved gutter outside the travel lanes.
    for(const side of [-1,1])b(g,x+(left?0:side*STREET_SCALE.laneEdge),.273,z+(left?side*STREET_SCALE.laneEdge:0),left?8:.06,.012,left?.06:8,'#bbbfb5');
  }
  if(straight&&(c.x+c.z)%4===2)for(const direction of [-1,1]){
    const angle=left?direction*Math.PI/2:direction===1?0:Math.PI;
    const laneX=x+(left?0:direction*STREET_SCALE.laneOffset),laneZ=z+(left?-direction*STREET_SCALE.laneOffset:0);
    const mark=(px:number,pz:number,w:number,d:number,rotation=0)=>{const part=b(g,laneX+px*Math.cos(angle)+pz*Math.sin(angle),.28,laneZ-px*Math.sin(angle)+pz*Math.cos(angle),w,.02,d,paint);part.rotation.y=angle+rotation;};
    mark(0,-.15,.1,1.3);mark(-.2,.5,.09,.55,-Math.PI/4);mark(.2,.5,.09,.55,Math.PI/4);
  }
  if(count>=3){for(let i=0;i<4;i++)if(links[i]){
    const dx=i===0?-1:i===1?1:0,dz=i===2?-1:i===3?1:0;
    for(let stripe=-3;stripe<=3;stripe++)b(g,x+dx*2.9+(dz?stripe*.66:0),.28,z+dz*2.9+(dx?stripe*.66:0),dx?.7:.32,.02,dz?.7:.32,paint);
    // Short stop bars stay on the approach lane, outside the pedestrian crossing.
    b(g,x+dx*3.7-(dz?dz*STREET_SCALE.laneOffset:0),.28,z+dz*3.7+(dx?dx*STREET_SCALE.laneOffset:0),dx?.18:2.1,.02,dz?.18:2.1,paint);
  }}
  if(count===2&&!straight){
    // Rounded center markings for the two connected arms; no invented road links.
    const dirs=[[-1,0],[1,0],[0,-1],[0,1]].filter((_,i)=>links[i]);
    for(let i=0;i<8;i++){const t=i/8,u=(i+1)/8;
      const point=(v:number)=>[dirs[0][0]*4*(1-v)**2+dirs[1][0]*4*v*v,dirs[0][1]*4*(1-v)**2+dirs[1][1]*4*v*v];
      const a=point(t),d=point(u),dx=d[0]-a[0],dz=d[1]-a[1];
      const line=b(g,x+(a[0]+d[0])/2,.28,z+(a[1]+d[1])/2,.1,.02,Math.hypot(dx,dz)*.7,paint);line.rotation.y=Math.atan2(dx,dz);
    }
  }
  // Flush manhole cover, tactile crossing pads and expansion seams.
  if(straight&&(Math.abs(c.x*7+c.z*11)%5===0)){
    const cover=new THREE.Mesh(kit.cylinder,kit.material('#697f8e'));cover.position.set(x+.6,.28,z-.7);cover.scale.set(.36,.018,.36);g.add(cover);
    for(let j=-2;j<=2;j++)b(g,x+.6+j*.11,.295,z-.7,.025,.008,.48,'#425563');
    const patch=b(g,x-1.1,.263,z+1.3,1.25,.012,1.8,'#647078');patch.rotation.y=.08;
  }
  if(count>=3)for(const dx of [-1,1])for(const dz of [-1,1]){b(g,x+dx*3.6,.46,z+dz*3.6,.45,.02,.45,'#d7c49e');for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)b(g,x+dx*3.6+i*.12,.485,z+dz*3.6+j*.12,.04,.015,.04,'#929d9e');}
  if(straight&&(c.x+c.z)%4===0){
    const ew=left&&right,sign=b(g,x+(ew?0:3.65),2.5,z+(ew?3.65:0),ew?.8:.1,.5,ew?.1:.8,'#507b70');
    b(g,sign.position.x,.4,sign.position.z,.09,2.1,.09,'#506571');
    // Drain grate set into the curb, away from the wheel paths.
    const gx=x+(ew?1.5:edge-.2),gz=z+(ew?edge-.2:1.5);
    b(g,gx,.275,gz,ew?.75:.25,.02,ew?.25:.75,'#394644');
    for(let i=-2;i<=2;i++)b(g,gx+(ew?i*.13:0),.3,gz+(ew?0:i*.13),ew?.025:.22,.008,ew?.22:.025,'#8b9490');
  }
}
