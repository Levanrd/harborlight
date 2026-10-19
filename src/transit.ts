import type {City, Cell} from './simulation';

export type BusStop={key:string;name:string};
export type BusRoute={id:number;name:string;color:string;path:string[];stops:string[];buses:number;enabled:boolean};
export type Transit={stops:BusStop[];routes:BusRoute[];nextId:number};
export const emptyTransit=():Transit=>({stops:[],routes:[],nextId:1});
export const transitColors=['#38aeb4','#dc9571','#9a8bce','#ddba58','#6cab76','#ba7fa1'];
export const STOP_COST=250, BUS_COST=1800, BUS_CAPACITY=24;
export const transitUpkeep=(t?:Transit)=>(t?.stops.length||0)*5+(t?.routes.reduce((n,r)=>n+(r.enabled?r.buses*90:0),0)||0);
const distance=(a:string,b:string)=>{const [x,z]=a.split(',').map(Number),[u,v]=b.split(',').map(Number);return Math.abs(x-u)+Math.abs(z-v);};
const adjacent=(c:Cell)=>[[c.x-1,c.z],[c.x+1,c.z],[c.x,c.z-1],[c.x,c.z+1]].map(([x,z])=>`${x},${z}`);

// Drawing anchors are joined only through existing roads; no off-road shortcuts.
export function transitPath(city:City,start:string,end:string):string[]{
  if(city.cells[start]?.kind!=='road'||city.cells[end]?.kind!=='road')return [];
  const queue=[start],previous=new Map<string,string|null>([[start,null]]);
  for(let i=0;i<queue.length;i++){const k=queue[i];if(k===end)break;for(const next of adjacent(city.cells[k]))if(city.cells[next]?.kind==='road'&&!previous.has(next)){queue.push(next);previous.set(next,k);}}
  if(!previous.has(end))return [];const path:string[]=[];for(let k:string|null=end;k!==null;k=previous.get(k)??null)path.unshift(k);return path;
}
export function routeProblem(city:City,r:BusRoute):string|undefined{
  if(!r.enabled)return 'Service paused';
  if(r.path.some((k,i)=>city.cells[k]?.kind!=='road'||i>0&&distance(k,r.path[i-1])!==1))return 'Road missing — rebuild the gap or redraw this route';
  if(r.stops.length<2||r.stops.some(k=>!city.transit?.stops.some(s=>s.key===k)||!r.path.includes(k)))return 'Stop missing — redraw this route';
}
export function placeStop(city:City,k:string):{city:City;message:string}{
  const t=city.transit||emptyTransit();
  if(city.cells[k]?.kind!=='road')return {city,message:'Bus stops go on existing road sections.'};
  if(t.stops.some(s=>s.key===k))return {city,message:'There is already a bus stop here.'};
  if(t.stops.length>=48)return {city,message:'This town supports up to 48 stops.'};
  if(city.money<STOP_COST)return {city,message:'A bus stop costs $250. More funds are needed.'};
  const name=`Stop ${t.nextId}`;
  return {city:{...city,money:city.money-STOP_COST,transit:{...t,nextId:t.nextId+1,stops:[...t.stops,{key:k,name}]}},message:`${name} added · $250. Connect it to another stop with a bus route.`};
}
export function addRoute(city:City,path:string[],name:string,buses=1):{city:City;message:string}{
  const t=city.transit||emptyTransit(),stops=path.filter(k=>t.stops.some(s=>s.key===k));
  if(t.routes.length>=6)return {city,message:'This town supports up to six routes.'};
  if(path.length<2||path.length>400||new Set(path).size!==path.length||stops.length<2||path[0]!==stops[0]||path.at(-1)!==stops.at(-1))return {city,message:'Start and finish at different stops. Include at least two stops without doubling back.'};
  if(!Number.isInteger(buses)||buses<1||buses>3)return {city,message:'Choose one to three buses.'};
  const r:BusRoute={id:t.nextId,name:name.trim().slice(0,28)||`Route ${t.routes.length+1}`,color:transitColors[t.routes.length%6],path:[...path],stops,buses,enabled:true};
  const problem=routeProblem(city,r);if(problem)return {city,message:problem};
  if(city.money<buses*BUS_COST)return {city,message:`Not enough funds. This fleet costs $${buses*BUS_COST}.`};
  return {city:{...city,money:city.money-buses*BUS_COST,transit:{...t,nextId:t.nextId+1,routes:[...t.routes,r]}},message:`${r.name} opened. Buses run both directions. Resume time to start service.`};
}
export function transitTrip(city:City,from:string,to:string,routeIds?:Set<number>):{route:number;from:string;to:string}|undefined{
  for(const r of city.transit?.routes||[]){if(routeIds&&!routeIds.has(r.id)||routeProblem(city,r))continue;
    const a=r.stops.filter(k=>distance(from,k)<=3).sort((a,b)=>distance(from,a)-distance(from,b));
    const b=r.stops.filter(k=>distance(to,k)<=3).sort((a,b)=>distance(to,a)-distance(to,b));
    for(const origin of a)for(const destination of b)if(origin!==destination)return {route:r.id,from:origin,to:destination};
  }
}
const coverageCache=new WeakMap<City['cells'],Map<Transit,number>>();
export function transitCoverage(city:City):number{
  if(!city.transit)return 0;let cache=coverageCache.get(city.cells);if(!cache){cache=new Map();coverageCache.set(city.cells,cache);}const known=cache.get(city.transit);if(known!==undefined)return known;
  const homes=Object.entries(city.cells).filter(([,c])=>c.kind==='residential'&&c.occupancy>0),jobs=Object.entries(city.cells).filter(([,c])=>['industrial','commercial'].includes(c.kind)&&c.occupancy>0);
  let total=0,served=0;for(const [a,h]of homes)for(const [b,j]of jobs){const weight=h.occupancy*j.occupancy;total+=weight;if(transitTrip(city,a,b))served+=weight;}
  const value=total?served/total:0;cache.set(city.transit,value);return value;
}
export function decodeTransit(value:unknown):Transit|undefined{
  if(value===undefined)return undefined;const t=value as Transit;
  const roadKey=(k:unknown)=>typeof k==='string'&&/^-?\d{1,2},-?\d{1,2}$/.test(k)&&k.split(',').every(v=>Math.abs(Number(v))<=19);
  if(!t||!Number.isInteger(t.nextId)||t.nextId<1||!Array.isArray(t.stops)||t.stops.length>48||!Array.isArray(t.routes)||t.routes.length>6)throw new Error('Invalid transit backup.');
  const stops=new Set<string>(),ids=new Set<number>();
  for(const s of t.stops){if(!s||!roadKey(s.key)||stops.has(s.key)||typeof s.name!=='string'||s.name.length>28)throw new Error('Invalid bus stop.');stops.add(s.key);}
  for(const r of t.routes){if(!r||!Number.isInteger(r.id)||r.id<1||r.id>=t.nextId||ids.has(r.id)||typeof r.name!=='string'||r.name.length>28||!/^#[0-9a-f]{6}$/i.test(r.color)||typeof r.enabled!=='boolean'||!Number.isInteger(r.buses)||r.buses<1||r.buses>3||!Array.isArray(r.path)||r.path.length<2||r.path.length>400||!r.path.every(roadKey)||new Set(r.path).size!==r.path.length||r.path.some((k,i)=>i>0&&distance(k,r.path[i-1])!==1)||!Array.isArray(r.stops)||r.stops.length<2||new Set(r.stops).size!==r.stops.length||r.stops.some(k=>!stops.has(k)||!r.path.includes(k))||r.path[0]!==r.stops[0]||r.path.at(-1)!==r.stops.at(-1))throw new Error('Invalid bus route.');ids.add(r.id);}
  return {stops:t.stops.map(s=>({...s})),routes:t.routes.map(r=>({...r,path:[...r.path],stops:[...r.stops]})),nextId:t.nextId};
}
