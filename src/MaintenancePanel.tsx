import {useGame} from './store';
import {emptyMaintenance,maintenanceSummary,maintenanceUpkeep,roadTravelFactor,type Maintenance} from './maintenance';
import {metrics,build,validLand} from './simulation';

export function MaintenancePanel({choose,overlay,focus}:{choose:()=>void;overlay:()=>void;focus:(k:string)=>void}){
  const {city,traffic,set,revision}=useGame(),m=city.maintenance||emptyMaintenance(),summary=maintenanceSummary(city),lots=metrics(city).lots;
  function settings(part:Partial<Maintenance>){const current=useGame.getState();set({city:{...current.city,maintenance:{...(current.city.maintenance||emptyMaintenance()),...part}}});}
  function autoBuild(){
    // Offer a vacant, supplied roadside parcel; never replace an existing building.
    const state=useGame.getState(),status=metrics(state.city),candidates:{x:number;z:number;score:number}[]=[];
    for(let x=-19;x<=19;x++)for(let z=-19;z<=19;z++)if(validLand(x,z)&&!state.city.cells[`${x},${z}`]&&[[x-1,z],[x+1,z],[x,z-1],[x,z+1]].some(([a,b])=>status.lots[`${a},${b}`]?.supplied&&state.city.cells[`${a},${b}`]?.kind==='road')){
      const nearest=summary.depots.length?Math.min(...summary.depots.map(([,c])=>Math.abs(c.x-x)+Math.abs(c.z-z))):12;
      candidates.push({x,z,score:Math.abs(z-10)+Math.abs(x)/3-Math.min(15,nearest)});
    }
    candidates.sort((a,b)=>a.score-b.score);
    const position=candidates[0];if(!position){set({notice:'No vacant supplied roadside parcel is available. Choose a site manually.'});return;}
    const result=build(state.city,'maintenance',[position]);set({city:result.city,notice:result.ok?`Maintenance depot built at ${position.x},${position.z}. Resume to dispatch crews.`:result.message,revision:revision+(result.ok?1:0)});
  }
  return <><h2>Keep every street connected.</h2><p>Snow and storm damage build up gradually. Crews repair connected road sections after reaching the work site. Snowplows also clear streets along their route. Snow melts when the weather clears.</p>
    <div className="dispatch-stats"><div><b>{summary.average}%</b><span>Road condition</span></div><div><b>{summary.poor}</b><span>Severely affected</span></div><div><b>{traffic.vehicles.filter(v=>v.kind==='maintenance').length}</b><span>Crews deployed</span></div><div><b>{m.completed}</b><span>Jobs completed</span></div></div>
    <div className="dispatch-actions"><button onClick={choose}>Choose depot site · $3,800</button><button disabled={city.money<3800||summary.depots.length>=8} onClick={autoBuild}>Build depot on a vacant service lot · $3,800</button><button onClick={overlay}>Show road conditions</button></div>
    <label className="tax-label">Maintenance funding<select aria-label="Maintenance funding" value={m.budget} onChange={e=>settings({budget:Number(e.target.value) as Maintenance['budget']})}><option value="0">Standby · no new dispatch</option><option value="50">Economy · 1 truck per depot</option><option value="100">Standard · 2 trucks per depot</option><option value="150">Intensive · 3 trucks per depot</option></select></label>
    <label className="tax-label">Dispatch priority<select aria-label="Maintenance priority" value={m.priority} onChange={e=>settings({priority:e.target.value as Maintenance['priority']})}><option value="emergency">Emergency access</option><option value="balanced">Closest affected streets</option><option value="industry">Industrial access</option></select></label>
    <p className="climate-summary">${maintenanceUpkeep(city).toLocaleString()}/month · {summary.needing} road sections need attention. Emergency priority favors clinic, fire and police frontages; industrial priority favors factory frontages. Avenues also receive preference.</p>
    <h3>Maintenance depots</h3>{summary.depots.length?summary.depots.map(([k])=><button className="menu-row" key={k} onClick={()=>focus(k)}>Depot {k}<b>{!lots[k]?.supplied?'Needs utilities':m.budget===0?'Standby':`${traffic.vehicles.filter(v=>v.kind==='maintenance'&&v.station===k).length} deployed`}</b></button>):<p>No depots yet. Build on a road connected to power, water and sewage to start the service.</p>}
    <h3>Roads needing attention</h3>{summary.worst.length?summary.worst.map(r=><button className="menu-row" key={r.key} onClick={()=>focus(r.key)}>Road {r.key}<b>{Math.round(r.severity)}% affected · {Math.round(roadTravelFactor(city,r.key)*100)}% surface speed</b></button>):<p>The road network is in good condition.</p>}
    {traffic.vehicles.some(v=>v.kind==='maintenance')&&<><h3>Live crews</h3>{traffic.vehicles.filter(v=>v.kind==='maintenance').map(v=><button className="menu-row" key={v.id} onClick={()=>focus(v.path[v.index])}>Crew {v.id} · depot {v.station}<b>{v.stage==='onscene'?'Clearing and repairing':v.stage==='returning'?'Returning to depot':v.waiting>1?'Waiting in traffic':`En route to ${v.target}`}</b></button>)}</>}
    <p className="fine">Orange trucks carry a plow and repair equipment. They obey traffic signals and yield at crossings. Repairs reduce accumulated snow and wear; rain, fog and storm visibility still limit safe travel. Standby recalls deployed crews and retains $40/month per depot for the building. Changing funding does not remove a truck mid-trip. Road concerns and neighborhood happiness recover when local access improves.</p>
  </>;
}
