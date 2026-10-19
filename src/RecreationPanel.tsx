import {buildingLock} from './progression';
import {Trees,MapPin,ArrowRight} from 'lucide-react';
import {useGame} from './store';
import {metrics} from './simulation';
import {recreationConfig,recreationTypes,type RecreationKind} from './recreation';

export function RecreationPanel({choose,focus,overlay}:{choose:(kind:RecreationKind)=>void;focus:(key:string)=>void;overlay:()=>void}){
  const city=useGame(s=>s.city),m=metrics(city),r=m.recreation;
  const underserved=Object.entries(city.cells).filter(([,c])=>c.kind==='residential'&&c.occupancy>0).sort(([a],[b])=>r.lots[a].happiness-r.lots[b].happiness);
  return <><h2>Make room for everyday joy.</h2><p>Bring play, sport, and green space closer to home. Recreation improves nearby happiness and land value, with benefits fading as distance increases.</p>
    <div className="dispatch-stats"><div><b>{Math.round(r.coverage)}%</b><span>Residents in reach</span></div><div><b>+{r.happinessBonus.toFixed(1)}</b><span>City happiness from recreation</span></div><div><b>{r.facilities.length}</b><span>Recreation facilities</span></div><div><b>${r.upkeep}</b><span>Monthly upkeep</span></div></div>
    <div className="waste-build-grid recreation-build-grid">{recreationTypes.map(kind=>{const c=recreationConfig[kind];return <button className="waste-build" key={kind} disabled={!!buildingLock(city,kind)} onClick={()=>choose(kind)}><Trees size={21}/><strong>{c.name}</strong><span>${c.cost.toLocaleString()} · ${c.upkeep}/month · {c.width}×{c.depth} lots</span><p>{c.description}</p><span>{c.radius}-lot radius · up to +{c.happiness} happiness / +{c.landValue} land value</span><b>{buildingLock(city,kind)||'Place recreation'} <ArrowRight size={13}/></b></button>;})}</div>
    <div className="dispatch-actions"><button onClick={overlay}>Show recreation overlay</button></div>
    <h3>Your green spaces</h3>{!r.facilities.length&&<p>Choose a facility above to start. The full footprint must be empty, with a road touching any edge.</p>}
    {r.facilities.map(f=><div className="waste-facility" key={f.key}><div className="waste-facility-title"><button onClick={()=>focus(f.key)}><MapPin size={14}/>{f.config.name} · {f.key}</button><b className={f.active?'positive':'negative'}>{f.active?'Open':'Needs road access'}</b></div><div className="waste-capacity"><span>{f.residents} residents in reach</span><span>{f.config.radius}-lot radius · ${f.config.upkeep}/month</span></div></div>)}
    <h3>Where to add recreation <small>Homes with the least benefit</small></h3><div className="hotspots">{underserved.slice(0,6).map(([k,c])=><button key={k} onClick={()=>focus(k)}><span>Home {k}<small>{c.occupancy} residents</small></span><b>+{r.lots[k].happiness.toFixed(1)} happiness</b></button>)}</div>
    <p className="fine">Click sets the top-left corner of the footprint on the north-up map; the preview shows all required lots. Recreation needs road access, but outdoor facilities do not need utilities. Benefits use straight-line distance from the facility center. Overlapping facilities combine up to +12 happiness and +30 land value per lot. The city bonus is weighted by the residents who benefit. Greenery also reduces nearby pollution. Removing any part demolishes the whole facility for $20; Undo restores the entire area. Existing pocket parks now provide local happiness rather than a citywide flat bonus.</p>
  </>;
}
