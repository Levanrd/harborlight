import {buildingLock} from './progression';
import {Shield,MapPin,ArrowRight} from 'lucide-react';
import {useGame} from './store';
import {metrics,price,upkeep} from './simulation';
import {crimeLevel,recentlyPatrolled,PATROL_DAYS,POLICE_FLEET} from './police';

export function PolicePanel({choose,focus,overlay}:{choose:()=>void;focus:(key:string)=>void;overlay:()=>void}){
  const s=useGame(),m=metrics(s.city),summary=m.crime;
  const stations=Object.entries(s.city.cells).filter(([,c])=>c.kind==='police');
  const cars=s.traffic.vehicles.filter(v=>v.kind==='police');
  const neighborhoods=Object.entries(s.city.cells).filter(([,c])=>['residential','commercial','industrial'].includes(c.kind)&&c.occupancy>0).sort(([a],[b])=>crimeLevel(s.city,b)-crimeLevel(s.city,a));
  return <><h2>A safer place to call home.</h2><p>Give your neighborhoods a regular patrol. Police cars follow connected streets and wait in traffic. Safety improves when a patrol reaches a neighborhood and completes its visit.</p>
    <div className="dispatch-stats"><div><b>{Math.round(summary.safety)}%</b><span>Residential safety</span></div><div><b>{Math.round(summary.coverage)}%</b><span>Residents recently patrolled</span></div><div><b>{summary.highRisk}</b><span>High crime lots</span></div><div><b>−{summary.happinessPenalty.toFixed(1)}</b><span>Happiness from crime</span></div></div>
    <button className="waste-build police-build" disabled={!!buildingLock(s.city,'police')} onClick={choose}><Shield size={24}/><strong>Police station</strong><span>${price.police.toLocaleString()} · ${upkeep.police}/month</span><p>Two patrol cars, automatic dispatch, and neighborhood visits. Needs road access, power, water, and sewage.</p><b>{buildingLock(s.city,'police')||'Place beside a supplied road'} <ArrowRight size={13}/></b></button>
    <div className="dispatch-actions"><button onClick={()=>s.set({speed:s.speed?0:1})}>{s.speed?'Pause patrols':'Resume patrols'}</button><button onClick={overlay}>Show crime overlay</button></div>
    <h3>Police stations <small>{cars.length} cars on duty · {s.city.crime?.visits||0} completed visits</small></h3>
    {!stations.length&&<p>No police service yet. Place a station, then resume time to start automatic patrols.</p>}
    {stations.map(([k])=>{const fleet=cars.filter(v=>v.station===k),supplied=m.lots[k].supplied;return <div className="waste-facility" key={k}><div className="waste-facility-title"><button onClick={()=>focus(k)}><MapPin size={14}/>Police station · {k}</button><b className={supplied?'positive':'negative'}>{!supplied?'Utilities unavailable':fleet.length?'Patrols active':'Ready for patrols'}</b></div><div className="waste-capacity"><span>{fleet.length} / {POLICE_FLEET} cars on duty</span><span>${upkeep.police} / month</span></div>{fleet.map(v=><div className="waste-truck" key={v.id}><Shield size={13}/><span>Car {v.id} · {v.stage==='onscene'?'Visiting neighborhood':v.stage==='returning'?'Returning to station':v.waiting>2?'Waiting in traffic':'On patrol'}</span>{v.target?<button className="plain" onClick={()=>focus(v.target!)}>Lot {v.target} →</button>:<b>{v.patrolStops} visits</b>}</div>)}</div>;})}
    <h3>Neighborhood watch <small>Highest crime first</small></h3>
    <div className="hotspots">{neighborhoods.slice(0,6).map(([k])=><button key={k} onClick={()=>focus(k)}><span>Lot {k} <small>{recentlyPatrolled(s.city,k)?'Recently patrolled':'Needs a patrol'}</small></span><b className={crimeLevel(s.city,k)>=45?'negative':''}>{crimeLevel(s.city,k).toFixed(1)}% crime</b></button>)}</div>
    {!neighborhoods.length&&<p>Occupied homes and workplaces will appear here as your city grows.</p>}
    <p className="fine">Crime is a simulation index from 0–100. Utility shortages, garbage buildup, and high taxes raise pressure. Each completed visit reduces local crime by 10 points and provides {PATROL_DAYS} days of prevention along two connected road sections. Cars visit up to four locations before returning. They prioritize nearby risk and areas without recent patrols. Safety is 100 minus residential crime; crime lowers happiness and land value. Up to eight stations are supported.</p>
  </>;
}
