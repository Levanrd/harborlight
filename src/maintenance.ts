import type {City,Cell} from './simulation';
import type {TrafficState,Vehicle} from './traffic';
import {climateAt} from './climate';
import {setVehicleRoute} from './vehicleManeuvers';

export type RoadCondition={snow:number;wear:number};
export type Maintenance={budget:0|50|100|150;priority:'balanced'|'emergency'|'industry';roads:Record<string,RoadCondition>;completed:number};
export const emptyMaintenance=():Maintenance=>({budget:100,priority:'emergency',roads:{},completed:0});
const adjacent=(c:Cell)=>[[c.x-1,c.z],[c.x+1,c.z],[c.x,c.z-1],[c.x,c.z+1]].map(([x,z])=>`${x},${z}`);
export const roadSeverity=(city:City,k:string)=>{const r=city.maintenance?.roads[k];return r?Math.max(r.snow,r.wear):0;};
export const roadTravelFactor=(city:City,k:string)=>{const r=city.maintenance?.roads[k];return r?Math.max(.45,1-r.snow*.004-r.wear*.0025):1;};
export const maintenanceUpkeep=(city:City)=>Object.values(city.cells).filter(c=>c.kind==='maintenance').length*(40+200*(city.maintenance?.budget??100)/100);
export function maintenanceSummary(city:City){
  const roads=Object.entries(city.cells).filter(([,c])=>c.kind==='road'),values=roads.map(([k])=>roadSeverity(city,k));
  return {roads:roads.length,average:Math.round(100-values.reduce((n,v)=>n+v,0)/Math.max(1,values.length)),poor:values.filter(v=>v>=55).length,needing:values.filter(v=>v>=12).length,depots:Object.entries(city.cells).filter(([,c])=>c.kind==='maintenance'),worst:roads.map(([k])=>({key:k,severity:roadSeverity(city,k)})).filter(r=>r.severity>=12).sort((a,b)=>b.severity-a.severity).slice(0,8)};
}
/** Road damage develops in active seconds, independently of the cosmetic calendar pace. */
export function updateMaintenance(city:City,s:TrafficState,dt:number,operational:Set<string>,routing:{route:(a:string[],b:string[])=>string[];access:(k:string)=>string[]}):Maintenance|undefined{
  let result=city.maintenance;
  const write=()=>{if(!result||result===city.maintenance)result={...(result||emptyMaintenance()),roads:{...result?.roads}};return result;};
  const elapsed=Math.floor(s.time)-Math.floor(s.time-dt),weather=climateAt(city.day,city.seed,city.climate).weather;
  if(elapsed>0){
    const w=write();
    for(const k of Object.keys(w.roads))if(city.cells[k]?.kind!=='road')delete w.roads[k];
    for(const [k,c]of Object.entries(city.cells))if(c.kind==='road'){
      const old=w.roads[k]||{snow:0,wear:0};
      w.roads[k]={snow:Math.max(0,Math.min(100,old.snow+(weather==='snow'?.1:-.3)*elapsed)),wear:Math.min(100,old.wear+(weather==='storm'?.025:weather==='rain'?.01:.003)*elapsed)};
    }
  }
  const budget=result?.budget??100,removed=new Set<number>();
  const sendHome=(v:Vehicle)=>{const path=routing.route([v.path[v.index]],routing.access(v.station!));if(!path.length){removed.add(v.id);return;}setVehicleRoute(city,v,path);v.stage='returning';delete v.target;delete v.serviceUntil;};
  for(const v of s.vehicles.filter(v=>v.kind==='maintenance')){
    const current=v.path[v.index];
    if(!v.station||city.cells[v.station]?.kind!=='maintenance'||city.cells[current]?.kind!=='road'){removed.add(v.id);continue;}
    // A plow clears only the road it has physically reached, including the return trip.
    // Repairing pavement still requires stopping at the assigned worksite.
    if(budget&&operational.has(v.station)&&(result?.roads[current]?.snow||0)>0){const w=write();w.roads[current]={...w.roads[current],snow:Math.max(0,w.roads[current].snow-80)};}
    const valid=v.path.slice(v.index).every((k,i)=>city.cells[k]?.kind==='road'&&(!i||adjacent(city.cells[v.path[v.index+i-1]]).includes(k)));
    if(!valid||v.stage!=='returning'&&(!operational.has(v.station)||!budget||city.cells[v.target||'']?.kind!=='road')){
      // Finish a valid road segment before recalling, rather than snapping back mid-lane.
      if(valid&&v.progress>0)continue;
      sendHome(v);continue;
    }
    if(v.stage==='onscene'){
      if(s.time<(v.serviceUntil||0))continue;
      const w=write(),patch=[current,...adjacent(city.cells[current]).filter(k=>city.cells[k]?.kind==='road')];
      for(const k of patch){const r=w.roads[k]||{snow:0,wear:0};w.roads[k]={snow:Math.max(0,r.snow-80),wear:Math.max(0,r.wear-65)};}
      w.completed++;sendHome(v);continue;
    }
    if(v.index===v.path.length-1){if(v.stage==='returning')removed.add(v.id);else{v.stage='onscene';v.waiting=0;v.serviceUntil=s.time+4/(budget/100);}}
  }
  s.vehicles=s.vehicles.filter(v=>!removed.has(v.id));
  if(!elapsed||!budget)return result;
  const priorities=new Set<string>();
  for(const [k,c]of Object.entries(city.cells))if(result?.priority==='industry'?c.kind==='industrial':result?.priority==='emergency'?['clinic','fire','police'].includes(c.kind):false)for(const r of routing.access(k))priorities.add(r);
  const fleet=budget===50?1:budget===150?3:2;
  for(const [station,c]of Object.entries(city.cells)){
    if(c.kind!=='maintenance'||!operational.has(station)||s.vehicles.filter(v=>v.kind==='maintenance'&&v.station===station).length>=fleet)continue;
    const entrance=routing.access(station).find(k=>!s.vehicles.some(v=>v.path[v.index]===k&&v.progress<.6&&v.stage!=='onscene'));if(!entrance)continue;
    const candidates=Object.entries(result?.roads||{}).filter(([k,r])=>Math.max(r.snow,r.wear)>=12&&city.cells[k]?.kind==='road'&&!s.vehicles.some(v=>v.kind==='maintenance'&&v.target===k));
    const score=(k:string,r:RoadCondition)=>Math.max(r.snow,r.wear)*(priorities.has(k)?2:city.cells[k].avenue?1.2:1)/Math.sqrt(4+Math.abs(city.cells[k].x-c.x)+Math.abs(city.cells[k].z-c.z));
    candidates.sort(([a,ra],[b,rb])=>score(b,rb)-score(a,ra));
    for(const [target]of candidates){const path=routing.route([entrance],[target]);if(!path.length)continue;s.vehicles.push({id:s.nextId++,kind:'maintenance',station,target,path,index:0,progress:0,waiting:0,stage:'outbound'});break;}
  }
  return result;
}
export function decodeMaintenance(value:unknown):Maintenance|undefined{
  if(value===undefined)return undefined;const m=value as Maintenance;
  if(!m||![0,50,100,150].includes(m.budget)||!['balanced','emergency','industry'].includes(m.priority)||!Number.isSafeInteger(m.completed)||m.completed<0||!m.roads||typeof m.roads!=='object'||Array.isArray(m.roads)||Object.keys(m.roads).length>1521)throw Error('Invalid road maintenance save.');
  for(const [k,r]of Object.entries(m.roads))if(!/^-?\d{1,2},-?\d{1,2}$/.test(k)||k.split(',').some(v=>Math.abs(Number(v))>19)||!r||![r.snow,r.wear].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100))throw Error('Invalid road condition in backup.');
  return {budget:m.budget,priority:m.priority,roads:Object.fromEntries(Object.entries(m.roads).map(([k,r])=>[k,{snow:r.snow,wear:r.wear}])),completed:m.completed};
}
