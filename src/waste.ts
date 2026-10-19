import {setVehicleRoute} from './vehicleManeuvers';
import type {City,Cell} from './simulation';
import type {TrafficState,Vehicle} from './traffic';

export type WasteKind='landfill'|'recycling';
export type Waste={lots:Record<string,number>;stored:Record<string,number>;generated:number;collected:number;recycled:number;exported:number};
export const emptyWaste=():Waste=>({lots:{},stored:{},generated:0,collected:0,recycled:0,exported:0});
export const isWasteFacility=(kind:string):kind is WasteKind=>kind==='landfill'||kind==='recycling';
export const wasteCapacity={landfill:2000,recycling:200};
export const wasteFleet={landfill:2,recycling:3};
export const TRUCK_CAPACITY=60, RECYCLE_PER_DAY=12, OVERFLOW=12;
export const cargoAmount=(v:Vehicle)=>Object.values(v.cargo||{}).reduce((sum,n)=>sum+n,0);
// Waste generation follows calendar days; collection fleets use the separate active clock.
export const wasteRate=(c:Cell)=>c.occupancy*(c.kind==='residential'?.0015:c.kind==='commercial'?.002:c.kind==='industrial'?.003:0);
const cellKey=(c:Cell)=>`${c.x},${c.z}`;

export function wasteDay(city:City,operational:Set<string>):Waste{
  const w=city.waste||emptyWaste(),next:Waste={...w,lots:{},stored:{}};
  for(const [k,c]of Object.entries(city.cells)){
    if(['residential','commercial','industrial'].includes(c.kind)){const generated=wasteRate(c);next.lots[k]=(w.lots[k]||0)+generated;next.generated+=generated;}
    if(isWasteFacility(c.kind)){const stored=w.stored[k]||0,processed=c.kind==='recycling'&&operational.has(k)?Math.min(stored,RECYCLE_PER_DAY):0;next.stored[k]=stored-processed;next.recycled+=processed;}
  }
  return next;
}
export function wasteSummary(city:City){
  const w=city.waste||emptyWaste(),homes=Object.values(city.cells).filter(c=>c.kind==='residential'&&c.occupancy>0);
  const residents=homes.reduce((n,c)=>n+c.occupancy,0),burden=homes.reduce((n,c)=>n+Math.min(1,(w.lots[cellKey(c)]||0)/OVERFLOW)*c.occupancy,0)/Math.max(1,residents);
  return {waiting:Object.values(w.lots).reduce((n,v)=>n+v,0),stored:Object.values(w.stored).reduce((n,v)=>n+v,0),overflow:Object.values(w.lots).filter(v=>v>=OVERFLOW).length,cleanliness:Math.round(100*(1-burden)),happinessPenalty:burden*18,generatedPerDay:Object.values(city.cells).reduce((n,c)=>n+wasteRate(c),0)};
}
/** Build once per metrics snapshot. Roads and empty bins emit no pollution. */
export function wastePollutionSampler(city:City){
  const facilities:{cell:Cell;strength:number}[]=[],litter:{cell:Cell;strength:number}[]=[];
  for(const [k,cell]of Object.entries(city.cells)){
    if(isWasteFacility(cell.kind)){const fullness=Math.min(1,(city.waste?.stored[k]||0)/wasteCapacity[cell.kind]);facilities.push({cell,strength:cell.kind==='landfill'?18+fullness*32:4+fullness*6});}
    const garbage=city.waste?.lots[k]||0;if(garbage>OVERFLOW)litter.push({cell,strength:Math.min(25,(garbage-OVERFLOW)*2)});
  }
  return (c:Cell)=>{
    let facilityPollution=0,litterPollution=0;
    for(const p of facilities)facilityPollution+=Math.max(0,1-Math.hypot(c.x-p.cell.x,c.z-p.cell.z)/6)*p.strength;
    for(const p of litter)litterPollution+=Math.max(0,1-Math.hypot(c.x-p.cell.x,c.z-p.cell.z)/2.5)*p.strength;
    return facilityPollution+Math.min(30,litterPollution);
  };
}
export const wastePollution=(city:City,c:Cell)=>wastePollutionSampler(city)(c);
export const clearingCost=(city:City,k:string)=>Math.ceil((city.waste?.stored[k]||0)*2);
export function clearWasteFacility(city:City,k:string):{city:City;message:string}{
  const amount=city.waste?.stored[k]||0,cost=clearingCost(city,k);
  if(!isWasteFacility(city.cells[k]?.kind||'')||!amount)return {city,message:'This facility has no stored waste to haul away.'};
  if(city.money<cost)return {city,message:`Contract hauling needs $${cost.toLocaleString()}.`};
  return {city:{...city,money:city.money-cost,waste:{...city.waste!,stored:{...city.waste!.stored,[k]:0},exported:city.waste!.exported+amount}},message:`${amount.toFixed(1)} waste units hauled away · $${cost.toLocaleString()}. Storage is available again.`};
}

type Routing={route:(starts:string[],ends:string[])=>string[];access:(lot:string)=>string[]};
// Traffic owns vehicle motion; this service owns collection, cargo and unloading.
// Cargo keeps its source lots so interrupted trips never silently erase garbage.
export function updateWasteFleet(city:City,s:TrafficState,dt:number,operational:Set<string>,routing:Routing):Waste|undefined{
  let waste=city.waste,changed=false;
  const write=()=>{if(!changed){waste={...(waste||emptyWaste()),lots:{...waste?.lots},stored:{...waste?.stored}};changed=true;}return waste!;};
  const facilities=Object.entries(city.cells).filter((entry):entry is [string,Cell & {kind:WasteKind}]=>isWasteFacility(entry[1].kind));
  const removed=new Set<number>();
  const restore=(v:Vehicle)=>{if(cargoAmount(v)){const w=write();for(const [k,amount]of Object.entries(v.cargo||{})){const target=city.cells[k]?k:Object.keys(city.cells).find(p=>city.cells[p].kind==='residential');if(target)w.lots[target]=(w.lots[target]||0)+amount;else w.exported+=amount;}}removed.add(v.id);};
  const free=(station:string)=>{const c=city.cells[station];return c&&isWasteFacility(c.kind)?Math.max(0,wasteCapacity[c.kind]-(waste?.stored[station]||0)-s.vehicles.filter(v=>v.kind==='garbage'&&v.station===station&&!removed.has(v.id)).reduce((n,v)=>n+cargoAmount(v),0)):0;};
  const sendHome=(v:Vehicle)=>{const path=routing.route([v.path[v.index]],routing.access(v.station!));if(!path.length){restore(v);return;}setVehicleRoute(city,v,path);v.stage='returning';delete v.target;};
  const assign=(v:Vehicle):boolean=>{
    if(cargoAmount(v)>=TRUCK_CAPACITY-.001||free(v.station!)<.5)return false;
    const current=city.cells[v.path[v.index]];if(!current)return false;
    const candidates=Object.entries(waste?.lots||{}).filter(([k,amount])=>amount>=.5&&city.cells[k]&&!s.vehicles.some(other=>other.kind==='garbage'&&other.id!==v.id&&!removed.has(other.id)&&other.target===k&&other.stage!=='returning'));
    candidates.sort(([a,amountA],[b,amountB])=>{const urgent=Number(amountB>=OVERFLOW)-Number(amountA>=OVERFLOW);if(urgent)return urgent;const ca=city.cells[a],cb=city.cells[b];return amountB/(3+Math.abs(cb.x-current.x)+Math.abs(cb.z-current.z))-amountA/(3+Math.abs(ca.x-current.x)+Math.abs(ca.z-current.z));});
    for(const [target]of candidates){const path=routing.route([v.path[v.index]],routing.access(target));if(!path.length)continue;setVehicleRoute(city,v,path);v.stage='outbound';v.target=target;delete v.serviceUntil;return true;}
    return false;
  };
  for(const v of s.vehicles.filter(v=>v.kind==='garbage')){
    if(!v.station||!isWasteFacility(city.cells[v.station]?.kind||'')||!operational.has(v.station)){restore(v);continue;}
    const remaining=v.path.slice(v.index),valid=remaining.every(k=>city.cells[k]?.kind==='road');
    // Route adjacency is checked directly so a removed current tile is never crossed.
    const contiguous=remaining.every((k,i)=>{if(!i)return true;const a=city.cells[k],b=city.cells[remaining[i-1]];return a&&b&&Math.abs(a.x-b.x)+Math.abs(a.z-b.z)===1;});
    if(!valid||!contiguous||v.stage!=='returning'&&!city.cells[v.target||'']){
      if(city.cells[v.path[v.index]]?.kind!=='road'){restore(v);continue;}
      const path=routing.route([v.path[v.index]],routing.access(v.stage==='returning'?v.station:v.target||''));
      if(path.length){setVehicleRoute(city,v,path);v.stage=v.stage==='returning'?'returning':'outbound';}
      else{sendHome(v);continue;}
    }
    if(v.stage==='onscene'){
      if(s.time<(v.serviceUntil||0))continue;
      const amount=Math.max(0,Math.min(waste?.lots[v.target!]||0,TRUCK_CAPACITY-cargoAmount(v),free(v.station)));
      if(amount>0){const w=write();w.lots[v.target!]-=amount;v.cargo={...v.cargo,[v.target!]:(v.cargo?.[v.target!]||0)+amount};}
      if(!assign(v))sendHome(v);continue;
    }
    if(v.index===v.path.length-1){
      if(v.stage==='returning'){const amount=cargoAmount(v);if(amount){const w=write();w.stored[v.station]=(w.stored[v.station]||0)+amount;w.collected+=amount;}removed.add(v.id);}
      else{v.stage='onscene';v.serviceUntil=s.time+1.5;v.waiting=0;}
    }
  }
  s.vehicles=s.vehicles.filter(v=>!removed.has(v.id));
  if(Math.floor(s.time)!==Math.floor(s.time-dt))for(const [station,c]of facilities){
    if(!operational.has(station)||free(station)<.5||s.vehicles.filter(v=>v.kind==='garbage'&&v.station===station).length>=wasteFleet[c.kind])continue;
    const entrance=routing.access(station).find(k=>!s.vehicles.some(v=>v.path[v.index]===k&&v.progress<.6));if(!entrance)continue;
    const v:Vehicle={id:s.nextId,kind:'garbage',station,cargo:{},path:[entrance],index:0,progress:0,waiting:0,stage:'outbound'};
    if(assign(v)){s.nextId++;s.vehicles.push(v);}
  }
  return waste;
}

export function decodeWaste(value:unknown):Waste|undefined{
  if(value===undefined)return undefined;const w=value as Waste;
  const nonnegative=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  if(!w||![w.generated,w.collected,w.recycled,w.exported].every(nonnegative))throw new Error('Invalid waste statistics.');
  for(const record of [w.lots,w.stored]){if(!record||typeof record!=='object'||Array.isArray(record)||Object.keys(record).length>1521)throw new Error('Invalid waste storage.');for(const [k,n]of Object.entries(record))if(!/^-?\d{1,2},-?\d{1,2}$/.test(k)||k.split(',').some(v=>Math.abs(Number(v))>19)||!nonnegative(n))throw new Error('Invalid waste amount.');}
  return {...w,lots:{...w.lots},stored:{...w.stored}};
}
