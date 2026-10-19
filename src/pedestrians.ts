import {METRES_PER_UNIT,crossingClearance} from './worldScale';
import {climateAt,weatherEffects} from './climate';
import type {City,Cell} from './simulation';
import {pedestrianSignalAllows,type TrafficState} from './traffic';
import {vehicleRoadPose} from './vehiclePose';
import {buildingFootprintScale} from './cityVisuals';
import {PEDESTRIAN_SPACING} from './pedestrianAppearance';

type Point={x:number;z:number};
export type WalkPoint=Point & {crossing?:string;approach?:string};
export type Entrance={key:string;road:string;door:Point;outside:Point;normal:Point;sidewalk:string;kind:Cell['kind']};
type Edge={to:string;crossing?:string;approach?:string};
export type WalkGraph={signature:string;nodes:Map<string,Point>;edges:Map<string,Edge[]>;entrances:Map<string,Entrance>};
export type Walker={id:number;home:string;destination:string;path:WalkPoint[];index:number;progress:number;x:number;z:number;heading:number;walked:number;pace:number;stage:'walking'|'inside';returning:boolean;until:number;waiting:boolean};
export type FootTraffic={agents:Walker[];nextId:number;seed:number;signature:string;clock:number;visits:number;departures:number;crossings:number};
export const emptyFootTraffic=():FootTraffic=>({agents:[],nextId:1,seed:31971,signature:'',clock:0,visits:0,departures:0,crossings:0});
const key=(x:number,z:number)=>`${x},${z}`;
const directions=[[0,1],[1,0],[0,-1],[-1,0]] as const;
const corners=[[-1,-1],[1,-1],[1,1],[-1,1]] as const;
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
let cached:WalkGraph|undefined;

/** The same frontage priority as the zoned building renderer. */
export function buildingEntrance(city:City,c:Cell):Omit<Entrance,'sidewalk'>|undefined{
  const dir=directions.find(([x,z])=>city.cells[key(c.x+x,c.z+z)]?.kind==='road');if(!dir)return;
  const [dx,dz]=dir,road=key(c.x+dx,c.z+dz),res=c.kind==='residential';
  const lateral=res?(c.level===1?.9:1):c.kind==='commercial'&&c.level<3?1.7:0;
  const depth=res?(c.level===1?1.99:2.46):c.kind==='commercial'?(c.level<3?2.15:3):c.kind==='industrial'?2.04:2.8;
  const scale=['residential','commercial','industrial'].includes(c.kind)?buildingFootprintScale(c):{x:1,z:1};
  const normal={x:dx,z:dz},door={x:c.x*8+dx*depth*scale.z+dz*lateral*scale.x,z:c.z*8+dz*depth*scale.z-dx*lateral*scale.x};
  return {key:key(c.x,c.z),road,door,outside:{x:door.x+dx*.9,z:door.z+dz*.9},normal,kind:c.kind};
}

export function walkingGraph(city:City):WalkGraph{
  const eligible=Object.values(city.cells).filter(c=>c.kind==='road'||(!c.recreationRoot||c.recreationRoot===key(c.x,c.z))&&!c.regionalRoot&&['residential','commercial','industrial','park','school','clinic','playground','sports','largepark','waterpark'].includes(c.kind));
  const signature=eligible.map(c=>`${c.x},${c.z}:${c.kind}:${c.level}:${c.age>=3}:${c.occupancy>0}`).join('|');
  if(cached?.signature===signature)return cached;
  const graph:WalkGraph={signature,nodes:new Map(),edges:new Map(),entrances:new Map()};
  const add=(id:string,p:Point)=>{graph.nodes.set(id,p);graph.edges.set(id,[]);};
  const link=(a:string,b:string,crossing?:string,approach?:string)=>{if(!graph.nodes.has(a)||!graph.nodes.has(b))return;graph.edges.get(a)!.push({to:b,crossing,approach});graph.edges.get(b)!.push({to:a,crossing,approach});};
  for(const c of eligible.filter(c=>c.kind==='road')){
    const k=key(c.x,c.z),links=directions.map(([dx,dz])=>city.cells[key(c.x+dx,c.z+dz)]?.kind==='road'),junction=links.filter(Boolean).length>=3;
    corners.forEach(([dx,dz],i)=>add(k+':'+i,{x:c.x*8+dx*3.72,z:c.z*8+dz*3.72}));
    // Each perimeter edge is either a sidewalk or a marked junction crossing.
    for(const [a,b,dir]of [[0,1,2],[1,2,1],[2,3,0],[3,0,3]]){
      if(!links[dir])link(k+':'+a,k+':'+b);
      else if(junction){const [dx,dz]=directions[dir];link(k+':'+a,k+':'+b,k,key(c.x+dx,c.z+dz));}
    }
  }
  for(const c of eligible.filter(c=>c.kind==='road')){
    const k=key(c.x,c.z);for(const [a,b,dx,dz]of [[1,0,1,0],[2,3,1,0],[2,1,0,1],[3,0,0,1]])link(k+':'+a,key(c.x+dx,c.z+dz)+':'+b);
  }
  for(const c of eligible.filter(c=>c.kind!=='road'&&c.age>=3&&(!['residential','commercial','industrial'].includes(c.kind)||c.occupancy>0))){
    const entry=buildingEntrance(city,c);if(!entry)continue;
    const road=city.cells[entry.road],dx=-entry.normal.x,dz=-entry.normal.z,side=entry.key+':entry';
    add(side,{x:road.x*8+dx*3.72,z:road.z*8+dz*3.72});
    // Put the frontage node directly opposite the door along the sidewalk.
    const p=graph.nodes.get(side)!;if(entry.normal.x)p.z=entry.door.z;else p.x=entry.door.x;
    const adjacent=corners.map(([x,z],i)=>({x,z,i})).filter(q=>dx?q.x===dx:q.z===dz);
    adjacent.forEach(q=>link(side,entry.road+':'+q.i));graph.entrances.set(entry.key,{...entry,sidewalk:side});
  }
  cached=graph;return graph;
}

export function walkingRoute(graph:WalkGraph,from:string,to:string):WalkPoint[]{
  const start=graph.entrances.get(from),end=graph.entrances.get(to);if(!start||!end||from===to)return [];
  const open=new Set([start.sidewalk]),cost=new Map([[start.sidewalk,0]]),previous=new Map<string,{from:string;edge:Edge}>();
  while(open.size){let current='',best=Infinity;for(const k of open){const estimate=cost.get(k)!+distance(graph.nodes.get(k)!,graph.nodes.get(end.sidewalk)!);if(estimate<best){best=estimate;current=k;}}open.delete(current);if(current===end.sidewalk)break;
    for(const edge of graph.edges.get(current)||[]){const nextCost=cost.get(current)!+distance(graph.nodes.get(current)!,graph.nodes.get(edge.to)!)+(edge.crossing?4:0);if(nextCost<(cost.get(edge.to)??Infinity)){cost.set(edge.to,nextCost);previous.set(edge.to,{from:current,edge});open.add(edge.to);}}
  }
  if(!cost.has(end.sidewalk))return [];
  const route:WalkPoint[]=[];let current=end.sidewalk;
  while(current!==start.sidewalk){const prev=previous.get(current)!;route.unshift({...graph.nodes.get(current)!,crossing:prev.edge.crossing,approach:prev.edge.approach});current=prev.from;}
  route.unshift({...graph.nodes.get(start.sidewalk)!});
  // Shift crossing paths onto the painted stripes rather than cutting the corner.
  for(let i=1;i<route.length;i++){const p=route[i];if(!p.crossing)continue;const [cx,cz]=p.crossing.split(',').map(Number),a=route[i-1],horizontal=Math.abs(a.z-p.z)<.01;
    const inset=horizontal?{x:a.x,z:cz*8+Math.sign(a.z-cz*8)*2.9}:{x:cx*8+Math.sign(a.x-cx*8)*2.9,z:a.z};
    const exit=horizontal?{x:p.x,z:inset.z,crossing:p.crossing,approach:p.approach}:{x:inset.x,z:p.z,crossing:p.crossing,approach:p.approach};
    route.splice(i,1,inset,exit,{x:p.x,z:p.z});i+=2;
  }
  return [{x:start.door.x-start.normal.x*.18,z:start.door.z-start.normal.z*.18},start.outside,...route,end.outside,{x:end.door.x-end.normal.x*.18,z:end.door.z-end.normal.z*.18}];
}

function pointSegmentDistance(p:Point,a:Point,b:Point){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
export function crossingSafe(city:City,traffic:TrafficState,a:WalkPoint,b:WalkPoint){
  if(!b.crossing)return true;if(!pedestrianSignalAllows(traffic.time,b.crossing))return false;
  return traffic.vehicles.every(v=>{const p=vehicleRoadPose(city,v);return !p||pointSegmentDistance(p,a,b)>crossingClearance(v);});
}
export function pedestrianCrossings(state:FootTraffic){return state.agents.flatMap(p=>{const a=p.path[p.index],b=p.path[p.index+1];return p.stage==='walking'&&p.progress>0&&b?.crossing?[{a,b}]:[];});}
export function pedestrianRoadBlocks(state:FootTraffic){const roads=new Set<string>();for(const p of state.agents){const next=p.path[p.index+1];if(p.stage==='walking'&&p.progress>0&&next?.crossing){roads.add(next.crossing);if(next.approach)roads.add(next.approach);}}return roads;}

/** Representative local trips, separate from population accounting and saved traffic. */
export function advancePedestrians(city:City,state:FootTraffic,traffic:TrafficState,dt:number):FootTraffic{
  if(dt<=0)return state;dt=Math.min(dt,.5);const graph=walkingGraph(city),changed=graph.signature!==state.signature;
  const s:FootTraffic={...state,signature:graph.signature,clock:state.clock+dt,agents:changed?[]:state.agents.map(p=>({...p}))};
  const random=()=>{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;};
  const weather=weatherEffects(climateAt(city.day,city.seed,city.climate).weather);
  const outdoor=(kind:string)=>['park','largepark','playground','sports','waterpark'].includes(kind);
  const entries=[...graph.entrances.values()],homes=entries.filter(e=>e.kind==='residential'),population=homes.reduce((n,e)=>n+city.cells[e.key].occupancy,0),target=Math.ceil(Math.min(180,population/16)*weather.outdoor);
  for(let n=0;n<4&&s.agents.length<target&&homes.length;n++){
    const home=homes[Math.floor(random()*homes.length)],options=entries.filter(e=>e.key!==home.key&&distance(e.door,home.door)<90&&(!outdoor(e.kind)||random()<weather.outdoor)),places=options.filter(e=>e.kind!=='residential'),dest=(places.length?places:options)[Math.floor(random()*(places.length||options.length))];if(!dest)continue;
    const reverse=random()<.32,origin=reverse?dest:home,destination=reverse?home:dest,path=walkingRoute(graph,origin.key,destination.key);if(!path.length)continue;
    // Avoid spawning a stack of people at the same doorway.
    if(s.agents.some(p=>p.stage==='walking'&&distance(p,path[0])<.8))continue;
    s.agents.push({id:s.nextId++,home:origin.key,destination:destination.key,path,index:0,progress:0,x:path[0].x,z:path[0].z,heading:0,walked:0,pace:1.15+random()*.45,stage:'walking',returning:false,until:0,waiting:false});s.departures++;
  }
  const completed=new Set<number>();
  for(const p of s.agents){
    if(p.stage==='inside'){if(!p.returning&&outdoor(city.cells[p.destination]?.kind)&&weather.outdoor<=.35)p.until=Math.min(p.until,s.clock);if(s.clock<p.until)continue;if(p.returning){completed.add(p.id);continue;}p.path=walkingRoute(graph,p.destination,p.home);if(!p.path.length){completed.add(p.id);continue;}p.returning=true;p.index=0;p.progress=0;p.stage='walking';p.x=p.path[0].x;p.z=p.path[0].z;s.departures++;}
    const a=p.path[p.index],b=p.path[p.index+1];if(!b){p.stage='inside';p.until=s.clock+(5+random()*12)*(outdoor(city.cells[p.returning?p.home:p.destination]?.kind)?weather.outdoor:weather.indoorStay);p.waiting=false;s.visits++;continue;}
    p.waiting=false;
    if(p.progress===0&&b.crossing){
      // Admit one wave, then let it finish. Slower life-sized walkers must not
      // continually join on each short all-red interval and starve road traffic.
      const clearing=s.agents.some(q=>q.id!==p.id&&q.stage==='walking'&&q.progress>.12&&q.path[q.index+1]?.crossing===b.crossing);
      if(clearing||!crossingSafe(city,traffic,a,b)){p.waiting=true;continue;}
    }
    const length=distance(a,b),step=Math.min(dt*p.pace/METRES_PER_UNIT*weather.walking,Math.max(0,length*(1-p.progress))),nextProgress=length?Math.min(1,p.progress+step/length):1;
    const nextPosition={x:a.x+(b.x-a.x)*nextProgress,z:a.z+(b.z-a.z)*nextProgress};
    // Queue on the approach instead of stacking bodies at a shared corner.
    if((!b.crossing||p.progress===0)&&s.agents.some(q=>q.id<p.id&&q.stage==='walking'&&distance(q,nextPosition)<PEDESTRIAN_SPACING&&distance(q,nextPosition)<distance(q,p))){p.waiting=true;continue;}
    p.progress=nextProgress;p.walked+=step;
    p.x=a.x+(b.x-a.x)*p.progress;p.z=a.z+(b.z-a.z)*p.progress;p.heading=Math.atan2(b.x-a.x,b.z-a.z);
    if(p.progress>=1){if(b.crossing)s.crossings++;p.index++;p.progress=0;}
  }
  s.agents=s.agents.filter(p=>!completed.has(p.id));return s;
}
