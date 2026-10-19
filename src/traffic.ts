import {vehicleGap,crossingClearance,signalStopProgress} from './worldScale';
import {updateMaintenance,roadTravelFactor,type Maintenance} from './maintenance';
import {climateAt,weatherEffects} from './climate';
import {prepareUTurn,setVehicleRoute} from './vehicleManeuvers';
import {vehicleRoadPose} from './vehiclePose';
import {updatePoliceFleet,type Crime} from './police';
import {updateWasteFleet,cargoAmount,TRUCK_CAPACITY,type Waste} from './waste';
import {BUS_CAPACITY,routeProblem,transitTrip} from './transit';
import type {City,Cell} from './simulation';

export type IncidentKind='medical'|'fire';
export type Incident={id:number;kind:IncidentKind;lot:string;created:number;status:'waiting'|'responding'|'onscene'|'resolved'|'missed';vehicle?:number;reason:string;drill:boolean;closed?:number};
export type WaitReason='signal'|'crossing'|'traffic'|'turn';
export type Vehicle={waitingFor?:WaitReason;approach?:string;uTurn?:{dx:number;dz:number;progress:number};id:number;kind:'maintenance'|'car'|'ambulance'|'firetruck'|'bus'|'garbage'|'police';patrolStops?:number;target?:string;cargo?:Record<string,number>;route?:number;lastStop?:number;path:string[];index:number;progress:number;waiting:number;station?:string;incident?:number;stage:'outbound'|'onscene'|'returning';serviceUntil?:number};
export type Passenger={id:number;route:number;from:string;to:string;created:number;vehicle?:number};
export type TransitTraffic={passengers:Passenger[];boarded:number;delivered:number;fallback:number;recentBoardings:number[]};
const emptyTransitTraffic=():TransitTraffic=>({passengers:[],boarded:0,delivered:0,fallback:0,recentBoardings:[]});
export type TrafficState={time:number;seed:number;nextId:number;vehicles:Vehicle[];incidents:Incident[];nextIncident:number;spawnClock:number;resolved:number;missed:number;completed:number;locks:Record<string,number>;transit:TransitTraffic};
export type TrafficOptions={operational:Set<string>;health:number;fireRisk:number;autoIncidents?:boolean;pedestrianRoads?:Set<string>;pedestrianCrossings?:{a:{x:number;z:number};b:{x:number;z:number}}[]};
export const emptyTraffic=():TrafficState=>({time:0,seed:8231,nextId:1,vehicles:[],incidents:[],nextIncident:45,spawnClock:0,resolved:0,missed:0,completed:0,locks:{},transit:emptyTransitTraffic()});
const key=(x:number,z:number)=>`${x},${z}`;
const nearby=(c:Cell)=>[[c.x-1,c.z],[c.x+1,c.z],[c.x,c.z-1],[c.x,c.z+1]].map(([x,z])=>key(x,z));
export type RoadGraph={nodes:Map<string,Cell>;edges:Map<string,string[]>;junctions:Set<string>};
const graphs=new WeakMap<City['cells'],RoadGraph>();
export function roadGraph(city:City):RoadGraph {
  let graph=graphs.get(city.cells);if(graph)return graph;
  const nodes=new Map(Object.entries(city.cells).filter(([,c])=>c.kind==='road'));
  const edges=new Map([...nodes].map(([k,c])=>[k,nearby(c).filter(n=>nodes.has(n))]));
  graph={nodes,edges,junctions:new Set([...edges].filter(([,e])=>e.length>=3).map(([k])=>k))};graphs.set(city.cells,graph);return graph;
}
export function roadLoads(state:TrafficState):Record<string,number> {
  const loads:Record<string,number>={};for(const v of state.vehicles){if(v.stage==='onscene')continue;const a=v.path[v.index],b=v.path[v.index+1];const weight=v.kind==='bus'||v.kind==='garbage'?1.5:1;if(a)loads[a]=(loads[a]||0)+(1-v.progress)*weight;if(b)loads[b]=(loads[b]||0)+v.progress*weight;}
  return loads;
}
export function trafficSummary(state:TrafficState,city:City) {
  const moving=state.vehicles.filter(v=>v.stage!=='onscene'),queued=moving.filter(v=>v.waiting>.4).length,loads=roadLoads(state);
  return {active:moving.length,queued,congestion:moving.length?Math.round(queued/moving.length*100):0,lights:roadGraph(city).junctions.size,loads,
    longestWait:Math.max(0,...moving.map(v=>v.waiting)),waitingReasons:Object.fromEntries((['signal','crossing','traffic','turn'] as const).map(reason=>[reason,moving.filter(v=>v.waiting>.4&&v.waitingFor===reason).length])),hotspots:Object.entries(loads).sort((a,b)=>b[1]-a[1]).slice(0,4),calls:state.incidents.filter(i=>!['resolved','missed'].includes(i.status))};
}
// Five seconds green, one amber, then one all-red clearance for each axis.
// New arrivals stop at amber; vehicles already committed finish crossing.
export function signalAspect(time:number,k:string,axis:'ew'|'ns'):'green'|'amber'|'red' {
  const [x,z]=k.split(',').map(Number),phase=((time+(Math.abs(x*3+z*5)%7))%14+14)%14;
  const local=(phase-(axis==='ew'?0:7)+14)%14;
  return local<5?'green':local<6?'amber':'red';
}
/** A dedicated walking admission window every two vehicle cycles gives slower
 * pedestrians time to clear without repeatedly consuming the same axis's green. */
export function pedestrianSignalAllows(time:number,k:string){
  const [x,z]=k.split(',').map(Number),phase=((time+(Math.abs(x*3+z*5)%7))%28+28)%28;
  return phase>=6&&phase<7;
}
export function signalPhase(time:number,k:string):'ew'|'ns'|'clear' {return signalAspect(time,k,'ew')==='green'?'ew':signalAspect(time,k,'ns')==='green'?'ns':'clear';}
export function signalAllows(graph:RoadGraph,from:string,to:string,time:number) {if(!graph.junctions.has(to))return true;const a=graph.nodes.get(from),b=graph.nodes.get(to);return !!a&&!!b&&signalPhase(time,to)===(a.x!==b.x?'ew':'ns');}

export function trafficRoute(city:City,starts:string[],ends:string[],loads:Record<string,number>={}):string[] {
  const graph=roadGraph(city),goals=new Set(ends),distance=new Map<string,number>(),previous=new Map<string,string|null>(),open=new Set<string>();
  for(const k of starts)if(graph.nodes.has(k)){distance.set(k,0);previous.set(k,null);open.add(k);}
  let found:string|undefined;
  while(open.size){let current='';let score=Infinity;for(const k of open){const n=distance.get(k)!;if(n<score){current=k;score=n;}}open.delete(current);if(goals.has(current)){found=current;break;}
    for(const next of graph.edges.get(current)||[]){const cost=score+(graph.nodes.get(next)!.avenue?.7:1)+(loads[next]||0)*2+(1-roadTravelFactor(city,next))*4+(graph.junctions.has(next)?1.5:0);if(cost<(distance.get(next)??Infinity)){distance.set(next,cost);previous.set(next,current);open.add(next);}}}
  if(!found)return[];const path:string[]=[];for(let k:string|null=found;k!==null;k=previous.get(k)??null)path.unshift(k);return path;
}
function roadAccess(city:City,lot:string){const c=city.cells[lot];return c?nearby(c).filter(k=>city.cells[k]?.kind==='road'):[];}
function random(s:TrafficState){s.seed=(s.seed*1664525+1013904223)>>>0;return s.seed/4294967296;}
const active=(i:Incident)=>i.status!=='resolved'&&i.status!=='missed';
export function requestIncident(city:City,state:TrafficState,kind:IncidentKind,drill=true,lot?:string):TrafficState {
  const candidates=Object.entries(city.cells).filter(([k,c])=>c.occupancy>0&&c.kind!=='road'&&!state.incidents.some(i=>active(i)&&i.lot===k));
  if(!candidates.length||state.incidents.filter(active).length>=4)return state;
  const s={...state,incidents:[...state.incidents]},target=candidates.find(([k])=>k===lot)||candidates[Math.floor(random(s)*candidates.length)];
  s.incidents.push({id:s.nextId++,kind,lot:target[0],created:s.time,status:'waiting',reason:'Awaiting dispatch',drill});return s;
}

export function yieldsToCrossing(city:City,v:Vehicle,nextProgress:number,crossings:NonNullable<TrafficOptions['pedestrianCrossings']>){
  const current=vehicleRoadPose(city,v),next=vehicleRoadPose(city,{...v,progress:nextProgress});if(!current||!next)return false;
  const clearance=crossingClearance(v);
  const distance=(p:{x:number;z:number},a:{x:number;z:number},b:{x:number;z:number})=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);};
  return crossings.some(({a,b})=>{const before=distance(current,a,b),after=distance(next,a,b);return after<clearance&&after<=before+.00001;});
}

export function advanceTraffic(city:City,state:TrafficState,dt:number,options:TrafficOptions):{state:TrafficState;waste?:Waste;crime?:Crime;maintenance?:Maintenance;damage:{lot:string;kind:IncidentKind}[]} {
  if(dt<=0)return {state,waste:city.waste,crime:city.crime,maintenance:city.maintenance,damage:[]};dt=Math.min(.5,dt);
  let s:TrafficState={...state,time:state.time+dt,spawnClock:state.spawnClock+dt,vehicles:state.vehicles.map(v=>({...v,...(v.uTurn?{uTurn:{...v.uTurn}}:{})})),incidents:state.incidents.map(i=>({...i})),locks:{...state.locks},transit:{...state.transit,passengers:state.transit.passengers.map(p=>({...p})),recentBoardings:state.transit.recentBoardings.filter(t=>state.time-t<60)}};
  const weather=weatherEffects(climateAt(city.day,city.seed,city.climate).weather);
  const graph=roadGraph(city),damage:{lot:string;kind:IncidentKind}[]=[],loads=roadLoads(s);
  const routes=(city.transit?.routes||[]).filter(r=>!routeProblem(city,r)),routeIds=new Set(routes.map(r=>r.id));
  s.vehicles=s.vehicles.filter(v=>v.kind!=='bus'||routeIds.has(v.route!));
  const retry:Passenger[]=[];
  s.transit.passengers=s.transit.passengers.filter(p=>{const valid=routeIds.has(p.route)&&(!p.vehicle||s.vehicles.some(v=>v.id===p.vehicle));if(!valid||!p.vehicle&&s.time-p.created>90){retry.push(p);s.transit.fallback++;return false;}return true;});
  for(const p of retry){const path=trafficRoute(city,[p.from],[p.to],loads);if(path.length>1&&s.vehicles.filter(v=>v.kind==='car').length<100&&!s.vehicles.some(v=>v.path[v.index]===path[0]&&v.progress<.45))s.vehicles.push({id:s.nextId++,kind:'car',path,index:0,progress:0,waiting:0,stage:'outbound'});}
  for(const r of routes){const fleet=s.vehicles.filter(v=>v.kind==='bus'&&v.route===r.id);if(fleet.length>=r.buses)continue;const path=fleet.length%2?[...r.path].reverse():r.path;if(s.vehicles.some(v=>v.path[v.index]===path[0]&&v.progress<.6))continue;s.vehicles.push({id:s.nextId++,kind:'bus',route:r.id,path:[...path],index:0,progress:0,waiting:0,stage:'outbound'});}
  for(const [k,until]of Object.entries(s.locks))if(until<s.time)delete s.locks[k];
  const waste=updateWasteFleet(city,s,dt,options.operational,{route:(starts,ends)=>trafficRoute(city,starts,ends,loads),access:lot=>roadAccess(city,lot)});
  const crime=updatePoliceFleet(city,s,dt,options.operational,{route:(starts,ends)=>trafficRoute(city,starts,ends,loads),access:lot=>roadAccess(city,lot)});
  const maintenance=updateMaintenance(city,s,dt,options.operational,{route:(a,b)=>trafficRoute(city,a,b,loads),access:k=>roadAccess(city,k)});
  // Reconcile edits without teleporting a vehicle across a newly missing road.
  s.vehicles=s.vehicles.filter(v=>{
    if(v.kind==='maintenance'||v.kind==='garbage'||v.kind==='police')return true;
    const call=s.incidents.find(i=>i.id===v.incident),current=v.path[v.index];
    if(v.kind!=='car'&&v.kind!=='bus'&&(!v.station||!options.operational.has(v.station))){if(call&&active(call)){call.status='waiting';call.vehicle=undefined;call.reason='Station unavailable';}return false;}
    if(v.stage==='onscene')return true;
    const valid=graph.nodes.has(current)&&v.path.slice(v.index+1).every((k,i)=>graph.edges.get(v.path[v.index+i])?.includes(k));
    if(valid)return true;
    if(v.kind!=='car'&&v.kind!=='bus'&&graph.nodes.has(current)){const goals=v.stage==='returning'?roadAccess(city,v.station!):roadAccess(city,call?.lot||'');const route=trafficRoute(city,[current],goals,loads);if(route.length){setVehicleRoute(city,v,route);return true;}}
    if(call&&active(call)){call.status='waiting';call.vehicle=undefined;call.reason='Road route interrupted';}return false;
  });
  for(const call of s.incidents.filter(active)) {
    if(!city.cells[call.lot]){call.status='resolved';call.closed=s.time;call.reason='Lot removed';continue;}
    if(s.time-call.created>150&&call.status!=='onscene'){call.status='missed';call.closed=s.time;call.reason=call.drill?'Drill timed out':'Response deadline missed';s.missed++;if(!call.drill)damage.push({lot:call.lot,kind:call.kind});s.vehicles=s.vehicles.filter(v=>v.incident!==call.id);continue;}
    if(call.status!=='waiting')continue;
    const kind=call.kind==='medical'?'clinic':'fire',stations=Object.entries(city.cells).filter(([k,c])=>c.kind===kind&&options.operational.has(k));
    let best:{station:string;path:string[];cost:number}|undefined;
    for(const [station]of stations){if(s.vehicles.some(v=>v.station===station))continue;const path=trafficRoute(city,roadAccess(city,station),roadAccess(city,call.lot),loads);if(!path.length)continue;
      if(s.vehicles.some(v=>v.path[v.index]===path[0]&&v.progress<.45))continue;
      const cost=path.reduce((n,k)=>n+1+(loads[k]||0)*2,0);if(!best||cost<best.cost)best={station,path,cost};}
    if(best){const id=s.nextId++;s.vehicles.push({id,kind:call.kind==='medical'?'ambulance':'firetruck',station:best.station,incident:call.id,path:best.path,index:0,progress:0,waiting:0,stage:'outbound'});call.status='responding';call.vehicle=id;call.reason='Unit en route';}
    else call.reason=!stations.length?`No supplied ${kind==='clinic'?'clinic':'fire station'}`:stations.every(([k])=>s.vehicles.some(v=>v.station===k))?'All units busy':'No open road route or station exit';
  }
  // Representative trips go between occupied homes and workplaces, not arbitrary road endpoints.
  const homes=Object.entries(city.cells).filter(([,c])=>c.kind==='residential'&&c.occupancy>0),work=Object.entries(city.cells).filter(([,c])=>['commercial','industrial'].includes(c.kind)&&c.occupancy>0);
  const baseTarget=Math.min(100,Math.floor((homes.reduce((n,[,c])=>n+c.occupancy,0)+work.reduce((n,[,c])=>n+c.occupancy,0))/9));
  // Only actual boardings lower car demand. Existing cars finish their trips naturally.
  const reduction=routes.length?Math.min(.55,s.transit.recentBoardings.length/Math.max(1,baseTarget)*.5):0;
  const target=Math.max(0,Math.round(baseTarget*(1-reduction))),liveRoutes=new Set(s.vehicles.filter(v=>v.kind==='bus').map(v=>v.route!));
  if(s.spawnClock>=.5){s.spawnClock=0;for(let count=0;count<3&&s.vehicles.filter(v=>v.kind==='car').length<target&&homes.length&&work.length;count++){
    const home=homes[Math.floor(random(s)*homes.length)][0],job=work[Math.floor(random(s)*work.length)][0],reverse=random(s)>.5;
    const trip=transitTrip(city,reverse?job:home,reverse?home:job,liveRoutes);
    if(trip&&random(s)<.7&&s.transit.passengers.filter(p=>p.route===trip.route&&!p.vehicle).length<BUS_CAPACITY*2&&s.transit.passengers.length<240){s.transit.passengers.push({id:s.nextId++,...trip,created:s.time});continue;}
    const path=trafficRoute(city,roadAccess(city,reverse?job:home),roadAccess(city,reverse?home:job),loads);if(path.length<2||s.vehicles.some(v=>v.path[v.index]===path[0]&&v.progress<.45))continue;
    s.vehicles.push({id:s.nextId++,kind:'car',path,index:0,progress:0,waiting:0,stage:'outbound'});
  }}
  const finished=new Set<number>();
  // Leaders move first. Following distance uses both actual body lengths plus a bumper gap.
  for(const v of [...s.vehicles].sort((a,b)=>b.progress-a.progress||a.id-b.id)) {
    delete v.waitingFor;
    if((v.kind==='maintenance'||v.kind==='garbage'||v.kind==='police')&&(v.stage==='onscene'||v.index===v.path.length-1))continue;
    const call=s.incidents.find(i=>i.id===v.incident);
    if(v.kind==='bus'){
      const route=routes.find(r=>r.id===v.route)!;
      if(v.index===v.path.length-1){setVehicleRoute(city,v,[...v.path].reverse());v.lastStop=undefined;}
      const stop=v.path[v.index];
      if(v.progress===0&&route.stops.includes(stop)&&v.lastStop!==v.index){
        v.lastStop=v.index;v.serviceUntil=s.time+2;v.waiting=0;
        s.transit.passengers=s.transit.passengers.filter(p=>{if(p.vehicle===v.id&&p.to===stop){s.transit.delivered++;return false;}return true;});
        let room=BUS_CAPACITY-s.transit.passengers.filter(p=>p.vehicle===v.id).length;
        for(const p of s.transit.passengers)if(room>0&&!p.vehicle&&p.route===v.route&&p.from===stop&&v.path.slice(v.index+1).includes(p.to)){p.vehicle=v.id;room--;s.transit.boarded++;s.transit.recentBoardings.push(s.time);}
      }
      if(s.time<(v.serviceUntil||0))continue;
    }
    if(v.stage==='onscene'){
      if(s.time<(v.serviceUntil||0))continue;
      if(call&&active(call)){call.status='resolved';call.closed=s.time;call.reason=call.drill?'Drill completed':call.kind==='fire'?'Fire extinguished':'Patient treated';s.resolved++;}
      const route=trafficRoute(city,[v.path.at(-1)!],roadAccess(city,v.station!),loads);if(!route.length){finished.add(v.id);continue;}setVehicleRoute(city,v,route);v.stage='returning';
    }
    // Older saves can contain a detour that doubles back mid-block. Recover by
    // driving a connected alternative, keeping cargo, assignment and position.
    prepareUTurn(city,v);
    if(v.kind!=='bus'&&v.uTurn?.progress===0&&v.waiting>5&&Math.floor(s.time)!==Math.floor(state.time))setVehicleRoute(city,v,v.path.slice(v.index));
    const from=v.path[v.index],to=v.path[v.index+1];
    if(!to){if(v.kind==='car'||v.stage==='returning'){finished.add(v.id);if(v.kind==='car')s.completed++;}else{v.stage='onscene';v.serviceUntil=s.time+(v.kind==='firetruck'?10:7);if(call){call.status='onscene';call.reason='Crew at scene';}}continue;}
    prepareUTurn(city,v);
    if(v.uTurn&&v.uTurn.progress<1){
      const at=city.cells[from],turn=v.uTurn;
      const blocked=options.pedestrianRoads?.has(from)||options.pedestrianRoads?.has(to)||s.vehicles.some(other=>{
        if(other.id===v.id)return false;
        // Legacy saves may already have two buses occupying the same terminal.
        // Let the first arrival turn; the second retains its position and yields.
        if(other.uTurn?.progress===0&&other.path[other.index]===from&&other.id>v.id)return false;
        const pose=vehicleRoadPose(city,other);return pose&&Math.hypot(pose.x-at.x*8,pose.z-at.z*8)<4.6;
      });
      if(turn.progress===0&&(blocked||(s.locks[from]||0)>s.time)){v.waiting+=dt;v.waitingFor='turn';continue;}
      s.locks[from]=s.time+1;
      turn.progress=Math.min(1,turn.progress+dt*weather.roadSpeed/(v.kind==='bus'||v.kind==='garbage'||v.kind==='maintenance'?3:2));v.waiting=0;
      continue;
    }
    const speed=roadTravelFactor(city,to)*weather.roadSpeed*(v.kind==='maintenance'?.85:v.kind==='garbage'?.9:v.kind==='bus'?.85:v.kind==='car'||v.kind==='police'?1.05:1.5)*(graph.nodes.get(from)?.avenue?1.35:1)/(1+Math.max(0,(loads[to]||0)-1)*.2);
    let limit=1;const stopLine=signalStopProgress(v);
    // A crossing already occupied by walkers remains protected until they clear it.
    const crossingBlocked=options.pedestrianCrossings?yieldsToCrossing(city,v,Math.min(1,v.progress+dt*speed),options.pedestrianCrossings):options.pedestrianRoads?.has(from)||options.pedestrianRoads?.has(to);
    if(crossingBlocked){limit=v.progress;v.waitingFor='crossing';}
    for(const other of s.vehicles){if(other.id===v.id||finished.has(other.id)||other.stage==='onscene')continue;if(other.uTurn){const node=other.path[other.index],arrival=other.path[other.index-1]||other.approach;if(from===node&&other.uTurn.progress>0&&other.uTurn.progress<1)limit=v.progress;if(to===node&&(other.uTurn.progress>0||v.progress<=.4||from===arrival&&v.kind==='bus'))limit=Math.min(limit,.4);
      // A waiting reversal is still on its arrival lane. Treating its planned
      // departure as an occupied lane traps committed through traffic forever.
      if(other.uTurn.progress===0)continue;
    }const a=other.path[other.index],b=other.path[other.index+1],gap=vehicleGap(v,other)/8*weather.gap;if(a===from&&b===to&&(other.progress>v.progress||other.progress===v.progress&&other.id<v.id))limit=Math.min(limit,other.progress-gap);if(a===to&&!b&&other.kind==='bus'&&(v.progress<=.4||v.kind==='bus'))limit=Math.min(limit,.4);if(a===to&&b===v.path[v.index+2]&&other.progress<gap)limit=Math.min(limit,1+other.progress-gap);}
    if(limit<1&&!v.waitingFor)v.waitingFor='traffic';
    if(graph.junctions.has(to)&&v.progress<=stopLine+.001&&(!signalAllows(graph,from,to,s.time)||(s.locks[to]||0)>s.time)){if(limit>=stopLine)v.waitingFor=signalAllows(graph,from,to,s.time)?'traffic':'signal';limit=Math.min(limit,stopLine);}
    const next=Math.max(v.progress,Math.min(v.progress+dt*speed,limit));
    if(graph.junctions.has(to)&&v.progress<=stopLine&&next>stopLine)s.locks[to]=s.time+1.25;
    v.waiting=next-v.progress<dt*speed*.15?v.waiting+dt:0;if(!v.waiting)delete v.waitingFor;v.progress=next;if(v.progress>0&&v.uTurn){delete v.uTurn;delete v.approach;}
    if(v.progress>=1){v.index++;v.progress=0;delete v.approach;prepareUTurn(city,v);}
  }
  s.vehicles=s.vehicles.filter(v=>!finished.has(v.id));s.incidents=s.incidents.filter(i=>active(i)||s.time-(i.closed||0)<75).slice(-30);
  if(options.autoIncidents!==false&&s.time>=s.nextIncident){const kind=random(s)<.45+options.fireRisk/400?'fire':'medical';s=requestIncident(city,s,kind,false);s.nextIncident=s.time+Math.max(28,70-options.fireRisk*.2-(100-options.health)*.2);}
  return {state:s,waste,crime,maintenance,damage};
}

export function decodeTraffic(value:unknown):TrafficState {
  if(value===undefined)return emptyTraffic();const s=value as TrafficState;
  const nonnegative=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  if(!s||!nonnegative(s.time)||!nonnegative(s.seed)||!Number.isInteger(s.nextId)||s.nextId<1||!nonnegative(s.nextIncident)||!nonnegative(s.spawnClock)||!nonnegative(s.resolved)||!nonnegative(s.missed)||!nonnegative(s.completed)||!Array.isArray(s.vehicles)||s.vehicles.length>204||!Array.isArray(s.incidents)||s.incidents.length>30)throw new Error('Invalid traffic backup.');
  const roadKey=(k:unknown)=>typeof k==='string'&&/^-?\d{1,2},-?\d{1,2}$/.test(k);
  const ids=new Set<number>();
  for(const v of s.vehicles){if(!v||!Number.isInteger(v.id)||ids.has(v.id)||!['car','ambulance','firetruck','bus','garbage','police','maintenance'].includes(v.kind)||!Array.isArray(v.path)||!v.path.length||v.path.length>1521||!v.path.every(roadKey)||!Number.isInteger(v.index)||v.index<0||v.index>=v.path.length||!nonnegative(v.progress)||v.progress>=1||!nonnegative(v.waiting)||!['outbound','onscene','returning'].includes(v.stage)||(v.kind!=='maintenance'&&v.kind!=='car'&&v.kind!=='bus'&&v.kind!=='garbage'&&v.kind!=='police'&&(!roadKey(v.station)||!Number.isInteger(v.incident)))||(v.kind==='bus'&&(!Number.isInteger(v.route)||v.route!<1||(v.lastStop!==undefined&&(!Number.isInteger(v.lastStop)||v.lastStop<0||v.lastStop>=v.path.length))))||(v.serviceUntil!==undefined&&!nonnegative(v.serviceUntil)))throw new Error('Invalid vehicle in backup.');ids.add(v.id);}
  for(const v of s.vehicles){
    if(v.approach!==undefined&&!roadKey(v.approach))throw new Error('Invalid vehicle approach in backup.');
    if(v.uTurn){const t=v.uTurn;if(!Number.isInteger(t.dx)||!Number.isInteger(t.dz)||Math.abs(t.dx)+Math.abs(t.dz)!==1||!nonnegative(t.progress)||t.progress>1||v.progress!==0||!v.path[v.index+1])throw new Error('Invalid vehicle turn in backup.');const [x,z]=v.path[v.index].split(',').map(Number),[nx,nz]=v.path[v.index+1].split(',').map(Number);if(nx-x!==-t.dx||nz-z!==-t.dz)throw new Error('Invalid turn direction in backup.');}
  }
  for(const v of s.vehicles.filter(v=>v.kind==='maintenance'))if(!roadKey(v.station)||(v.stage!=='returning'&&!roadKey(v.target)))throw new Error('Invalid maintenance truck in backup.');
  for(const v of s.vehicles.filter(v=>v.kind==='police'))if(!roadKey(v.station)||(v.stage!=='returning'&&!roadKey(v.target))||!Number.isInteger(v.patrolStops)||v.patrolStops!<0||v.patrolStops!>4)throw new Error('Invalid patrol car in backup.');
  for(const v of s.vehicles.filter(v=>v.kind==='garbage')){if(!roadKey(v.station)||(v.stage!=='returning'&&!roadKey(v.target))||!v.cargo||typeof v.cargo!=='object'||Array.isArray(v.cargo)||Object.keys(v.cargo).length>1521||Object.entries(v.cargo).some(([k,n])=>!roadKey(k)||!nonnegative(n))||cargoAmount(v)>TRUCK_CAPACITY+.00001)throw new Error('Invalid garbage truck in backup.');}
  for(const i of s.incidents)if(!i||!Number.isInteger(i.id)||!roadKey(i.lot)||!['medical','fire'].includes(i.kind)||!['waiting','responding','onscene','resolved','missed'].includes(i.status)||!nonnegative(i.created)||typeof i.drill!=='boolean'||typeof i.reason!=='string'||(i.closed!==undefined&&!nonnegative(i.closed)))throw new Error('Invalid incident in backup.');
  const locks:Record<string,number>={};for(const [k,v]of Object.entries(s.locks||{})){if(!roadKey(k)||!nonnegative(v))throw new Error('Invalid signal reservation in backup.');locks[k]=v;}const transit=s.transit===undefined?emptyTransitTraffic():s.transit;
  if(!transit||!Array.isArray(transit.passengers)||transit.passengers.length>240||!Array.isArray(transit.recentBoardings)||transit.recentBoardings.length>2000||!transit.recentBoardings.every(nonnegative)||![transit.boarded,transit.delivered,transit.fallback].every(nonnegative))throw new Error('Invalid transit statistics.');
  const passengerIds=new Set<number>();
  for(const p of transit.passengers){if(!p||!Number.isInteger(p.id)||passengerIds.has(p.id)||!Number.isInteger(p.route)||p.route<1||!roadKey(p.from)||!roadKey(p.to)||p.from===p.to||!nonnegative(p.created)||(p.vehicle!==undefined&&(!Number.isInteger(p.vehicle)||!s.vehicles.some(v=>v.id===p.vehicle&&v.kind==='bus'))))throw new Error('Invalid passenger in backup.');passengerIds.add(p.id);}
  for(const v of s.vehicles.filter(v=>v.kind==='bus'))if(transit.passengers.filter(p=>p.vehicle===v.id).length>BUS_CAPACITY)throw new Error('Bus capacity exceeded in backup.');
  return {...s,locks,transit};
}
