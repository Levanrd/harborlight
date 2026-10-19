import {setVehicleRoute} from './vehicleManeuvers';
import type {City,Cell} from './simulation';
import type {TrafficState,Vehicle} from './traffic';

export type CrimeLot={level:number;lastPatrol?:number};
export type Crime={lots:Record<string,CrimeLot>;visits:number};
export const PATROL_DAYS=20, POLICE_FLEET=2;
export const emptyCrime=():Crime=>({lots:{},visits:0});
const occupied=(c:Cell)=>['residential','commercial','industrial'].includes(c.kind)&&c.occupancy>0;
const nearby=(c:Cell)=>[[c.x-1,c.z],[c.x+1,c.z],[c.x,c.z-1],[c.x,c.z+1]].map(([x,z])=>`${x},${z}`);
export const recentlyPatrolled=(city:City,k:string)=>{const day=city.crime?.lots[k]?.lastPatrol;return day!==undefined&&city.day>=day&&city.day-day<PATROL_DAYS;};
export const crimeLevel=(city:City,k:string)=>occupied(city.cells[k]||{kind:'road'} as Cell)?city.crime?.lots[k]?.level||0:0;

export function crimeDay(city:City,operational:Set<string>):Crime{
  const next:Crime={lots:{},visits:city.crime?.visits||0};
  for(const [k,c]of Object.entries(city.cells)){
    if(!occupied(c))continue;
    const previous=city.crime?.lots[k]||{level:0};
    const pressure=(c.kind==='commercial'?38:c.kind==='industrial'?32:28)+(operational.has(k)?0:12)+Math.min(14,(city.waste?.lots[k]||0)/12*14)+Math.max(0,city.tax-10)*1.2;
    const protectedLot=recentlyPatrolled(city,k),target=pressure*(protectedLot?.25:1);
    next.lots[k]={...previous,level:Math.max(0,Math.min(100,previous.level+(target-previous.level)*.04-(protectedLot?.5:0)))};
  }
  return next;
}
export function crimeSummary(city:City){
  const homes=Object.entries(city.cells).filter(([,c])=>c.kind==='residential'&&c.occupancy>0);
  const population=homes.reduce((n,[,c])=>n+c.occupancy,0);
  const average=homes.reduce((n,[k,c])=>n+crimeLevel(city,k)*c.occupancy,0)/Math.max(1,population);
  return {average,safety:100-average,happinessPenalty:average*.2,coverage:population?homes.reduce((n,[k,c])=>n+(recentlyPatrolled(city,k)?c.occupancy:0),0)/population*100:0,highRisk:Object.keys(city.cells).filter(k=>crimeLevel(city,k)>=45).length};
}

type Routing={route:(starts:string[],ends:string[])=>string[];access:(lot:string)=>string[]};
// Traffic controls road motion and signals. Only a completed roadside visit changes crime.
export function updatePoliceFleet(city:City,s:TrafficState,dt:number,operational:Set<string>,routing:Routing):Crime|undefined{
  let crime=city.crime,changed=false;
  const write=()=>{if(!changed){crime={...(crime||emptyCrime()),lots:{...crime?.lots}};changed=true;}return crime!;};
  const removed=new Set<number>();
  const sendHome=(v:Vehicle)=>{const path=routing.route([v.path[v.index]],routing.access(v.station!));if(!path.length){removed.add(v.id);return;}setVehicleRoute(city,v,path);v.stage='returning';delete v.target;delete v.serviceUntil;};
  const assign=(v:Vehicle):boolean=>{
    const current=city.cells[v.path[v.index]];if(!current)return false;
    const candidates=Object.entries(city.cells).filter(([k,c])=>occupied(c)&&!s.vehicles.some(other=>other.kind==='police'&&other.id!==v.id&&!removed.has(other.id)&&other.target===k&&other.stage!=='returning')&&(crime?.lots[k]?.lastPatrol===undefined||city.day-crime.lots[k].lastPatrol!>=5));
    const priority=(k:string,c:Cell)=>(20+(crime?.lots[k]?.level||0)+Math.min(30,city.day-(crime?.lots[k]?.lastPatrol??city.day-30)))/(4+Math.abs(c.x-current.x)+Math.abs(c.z-current.z));
    candidates.sort(([a,ca],[b,cb])=>priority(b,cb)-priority(a,ca));
    for(const [target]of candidates){const path=routing.route([v.path[v.index]],routing.access(target));if(!path.length)continue;setVehicleRoute(city,v,path);v.stage='outbound';v.target=target;v.waiting=0;delete v.serviceUntil;return true;}
    return false;
  };
  const visit=(v:Vehicle)=>{
    const w=write(),roads=new Set([v.path[v.index]]),queue=[{k:v.path[v.index],distance:0}];
    // Presence spreads two connected road sections, never across an isolated street.
    for(let i=0;i<queue.length;i++){const {k,distance}=queue[i];if(distance===2)continue;for(const next of nearby(city.cells[k]))if(city.cells[next]?.kind==='road'&&!roads.has(next)){roads.add(next);queue.push({k:next,distance:distance+1});}}
    for(const [k,c]of Object.entries(city.cells))if(occupied(c)&&routing.access(k).some(r=>roads.has(r))){const old=w.lots[k];w.lots[k]={level:Math.max(0,(old?.level||0)-10),lastPatrol:city.day};}
    w.visits++;v.patrolStops=(v.patrolStops||0)+1;
  };
  for(const v of s.vehicles.filter(v=>v.kind==='police')){
    if(!v.station||city.cells[v.station]?.kind!=='police'||!operational.has(v.station)){removed.add(v.id);continue;}
    const current=v.path[v.index];if(city.cells[current]?.kind!=='road'){removed.add(v.id);continue;}
    const remaining=v.path.slice(v.index),valid=remaining.every((k,i)=>city.cells[k]?.kind==='road'&&(!i||nearby(city.cells[remaining[i-1]]).includes(k)));
    const target=city.cells[v.target||''];
    if(!valid||v.stage!=='returning'&&(!target||!occupied(target)||!routing.access(v.target!).includes(v.path.at(-1)!))){
      const path=target&&occupied(target)?routing.route([current],routing.access(v.target!)):[];
      if(v.stage!=='returning'&&path.length){setVehicleRoute(city,v,path);v.stage='outbound';delete v.serviceUntil;}else{sendHome(v);continue;}
    }
    if(v.stage==='onscene'){
      if(s.time<(v.serviceUntil||0))continue;
      visit(v);if(v.patrolStops!>=4||!assign(v))sendHome(v);continue;
    }
    if(v.index===v.path.length-1){if(v.stage==='returning')removed.add(v.id);else{v.stage='onscene';v.serviceUntil=s.time+3;v.waiting=0;}}
  }
  s.vehicles=s.vehicles.filter(v=>!removed.has(v.id));
  if(Math.floor(s.time)!==Math.floor(s.time-dt))for(const [station,c]of Object.entries(city.cells)){
    if(c.kind!=='police'||!operational.has(station)||s.vehicles.filter(v=>v.kind==='police'&&v.station===station).length>=POLICE_FLEET)continue;
    const entrance=routing.access(station).find(k=>!s.vehicles.some(v=>v.path[v.index]===k&&v.progress<.6&&v.stage!=='onscene'));if(!entrance)continue;
    const v:Vehicle={id:s.nextId,kind:'police',station,patrolStops:0,path:[entrance],index:0,progress:0,waiting:0,stage:'outbound'};
    if(assign(v)){s.nextId++;s.vehicles.push(v);}
  }
  return crime;
}

export function decodeCrime(value:unknown):Crime|undefined{
  if(value===undefined)return undefined;const w=value as Crime;
  if(!w||!Number.isSafeInteger(w.visits)||w.visits<0||!w.lots||typeof w.lots!=='object'||Array.isArray(w.lots)||Object.keys(w.lots).length>1521)throw new Error('Invalid crime statistics.');
  const lots:Record<string,CrimeLot>={};
  for(const [k,v]of Object.entries(w.lots)){
    if(!/^-?\d{1,2},-?\d{1,2}$/.test(k)||k.split(',').some(n=>Math.abs(Number(n))>19)||!v||typeof v.level!=='number'||!Number.isFinite(v.level)||v.level<0||v.level>100||(v.lastPatrol!==undefined&&(!Number.isSafeInteger(v.lastPatrol)||v.lastPatrol<0)))throw new Error('Invalid neighborhood crime in backup.');
    lots[k]={level:v.level,...(v.lastPatrol!==undefined?{lastPatrol:v.lastPatrol}:{})};
  }
  return {lots,visits:w.visits};
}
