import {climateAt,weatherEffects,weatherNames} from './climate';
import {useGame} from './store';
import {trafficSummary} from './traffic';
import {metrics} from './simulation';

export function DispatchPanel({focus}:{focus:(lot:string)=>void}) {
  const {city,traffic,footTraffic,drill,speed,set}=useGame(),summary=trafficSummary(traffic,city),m=metrics(city),weather=climateAt(city.day,city.seed,city.climate).weather,effects=weatherEffects(weather);
  const stations=Object.entries(city.cells).filter(([,c])=>c.kind==='clinic'||c.kind==='fire');
  return <><h2>Keep your city moving.</h2><p>Vehicles queue on their lane and wait for green lights. Response units follow the same roads, so congestion and broken connections matter.</p>
    <p className="climate-summary">{weatherNames[weather]} · weather speed limit {Math.round(effects.roadSpeed*100)}% of normal speed · outdoor activity target {Math.round(effects.outdoor*100)}%. Weather delays service fleets too; congestion and road damage can add further delays.</p>
    <div className="dispatch-stats"><div><b>{summary.active}</b><span>Vehicles on roads</span></div><div><b>{summary.queued}</b><span>Waiting vehicles</span></div><div><b>{summary.congestion}%</b><span>Queued share</span></div><div><b>{summary.lights}</b><span>Signal junctions</span></div></div>
    <div className="dispatch-actions"><button onClick={()=>set({speed:speed?0:1})}>{speed?'Pause simulation':'Resume simulation'}</button><button onClick={()=>{set({overlay:'traffic'});}}>Show congestion overlay</button></div>
    <p role="status">{speed?'Simulation running at '+speed+'×.':'Simulation paused. Press Resume simulation to move vehicles and people.'} Completed trips: {traffic.completed} · longest current wait: {Math.floor(summary.longestWait)}s.</p>
    <p className="fine">Waiting for lights: {summary.waitingReasons.signal} · pedestrian crossings: {summary.waitingReasons.crossing} · traffic ahead: {summary.waitingReasons.traffic} · turning clearance: {summary.waitingReasons.turn}. These counts update as vehicles move.</p>
    <h3>Street life</h3>
    <p>Residents walk between nearby homes, shops, workplaces and parks, then spend time inside before heading back. Use Street life in the city overview to look closer. Time must be running for people to walk.</p>
    <div className="dispatch-stats"><div><b>{footTraffic.agents.filter(p=>p.stage==='walking').length}</b><span>Walking residents</span></div><div><b>{footTraffic.agents.filter(p=>p.stage==='inside').length}</b><span>At destinations</span></div><div><b>{footTraffic.visits}</b><span>Completed visits</span></div><div><b>{footTraffic.crossings}</b><span>Street crossings</span></div></div>
    <p className="fine">People use connected sidewalks and marked crossings. Vehicles yield while a crossing is occupied. Up to 180 local walkers represent neighborhood activity; waiting bus passengers are shown separately. Individual walking trips restart when the city is loaded.</p>
    <h3>Emergency desk <small>{summary.calls.length} active calls</small></h3>
    <p className="fine">One unit per supplied clinic or fire station. Crews travel, work at the scene, then return to base before taking another call. Unanswered real calls after 150 simulation seconds cost funds and occupants; fires also reset building development.</p>
    <div className="dispatch-actions"><button onClick={()=>drill('medical')}>Run ambulance drill</button><button onClick={()=>drill('fire')}>Run fire drill</button></div>
    <p className="fine">Drills cause no damage. Select an occupied lot first to choose the location, or let dispatch choose one. Time must be running for units to move.</p>
    <div className="incident-list">{traffic.incidents.length?[...traffic.incidents].reverse().map(i=><button key={i.id} className={'incident-row '+i.status} onClick={()=>focus(i.lot)}><span><b>{i.kind==='medical'?'Medical call':'Building fire'} {i.drill&&<em>DRILL</em>}</b><small>Lot {i.lot} · {Math.floor((i.closed??traffic.time)-i.created)}s · {i.reason}</small></span><strong>{i.status==='onscene'?'On scene':i.status}</strong></button>):<p>No calls yet. Run a drill to test your response network.</p>}</div>
    <h3>Response fleet</h3>{stations.length?stations.map(([k,c])=>{const unit=traffic.vehicles.find(v=>v.station===k);return <div className="detail" key={k}><span>{c.kind==='clinic'?'Ambulance':'Fire truck'} · base {k}</span><b>{!m.lots[k].supplied?'Utilities unavailable':unit?unit.stage==='onscene'?'Working at scene':unit.stage==='returning'?'Returning to base':'Responding':'Available'}</b></div>}):<p>Build a clinic for ambulances and a fire station for fire trucks.</p>}
    <h3>Busy road sections</h3>{summary.hotspots.length?<div className="hotspots">{summary.hotspots.map(([k,load])=><button key={k} onClick={()=>focus(k)}>Road {k}<b>{load.toFixed(1)} vehicle load</b></button>)}</div>:<p>Occupied homes and workplaces generate trips.</p>}
    <p className="fine">Resolved calls: {traffic.resolved} · Missed calls: {traffic.missed} · Completed civilian trips: {traffic.completed}. Traffic represents a sample of city journeys, capped at 100 civilian vehicles.</p>
  </>;
}
