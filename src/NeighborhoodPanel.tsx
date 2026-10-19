import {useGame,type Tool} from './store';
import {metrics} from './simulation';
import {coastalConfig,coastalTypes} from './coastal';
import {buildingLock} from './progression';
import {MapPin,Waves,ArrowRight} from 'lucide-react';

export function NeighborhoodPanel({choose,focus}:{choose:(t:Tool)=>void;focus:(key:string)=>void}){
  const s=useGame(),w=metrics(s.city).wellbeing;
  const complaints=Object.entries(w.lots).filter(([,l])=>l.issues.length).sort((a,b)=>a[1].happiness-b[1].happiness);
  return <><h2>A good place to call home.</h2><p>Clean air, nearby care, safe streets and room to play. Neighborhood happiness responds to each home's actual surroundings and services.</p>
    <div className="dispatch-actions"><button onClick={()=>s.set({thoughts:!s.thoughts})} aria-pressed={s.thoughts}>Resident thoughts: {s.thoughts?'on':'off'}</button></div>
    <div className="neighborhood-grid">{w.districts.map(d=><article className="neighborhood-card" key={d.name}><span className="eyebrow">{d.name}</span><strong>{d.happiness}% <small>happiness</small></strong><div className="meter"><i style={{width:d.happiness+'%',background:d.happiness>=75?'#72a58b':'#cb9b61'}}/></div><p>{d.population.toLocaleString()} residents · {d.pollution}% pollution</p><span>{d.issues?`${d.issues} homes have concerns`:'No outstanding concerns'}</span></article>)}</div>
    <h3>Build by the beach</h3><p>Reserve the coast for homes and leisure. Place these buildings on empty, road-adjacent coastal lots; use Parks for the 3×2 beach water park.</p><div className="waste-build-grid">{coastalTypes.map(k=><button className="waste-build" key={k} disabled={!!buildingLock(s.city,k)} onClick={()=>choose(k)}><Waves size={22}/><strong>{coastalConfig[k].name}</strong><span>${coastalConfig[k].cost.toLocaleString()} · 1 lot</span><p>{coastalConfig[k].description}</p><b>{buildingLock(s.city,k)||'Place on the coast'}</b></button>)}<button className="waste-build" disabled={!!buildingLock(s.city,'waterpark')} onClick={()=>choose('waterpark')}><Waves size={22}/><strong>Beach water park</strong><span>$8,500 · 3×2 lots · $180/month</span><p>Pools, slides, palms and recreation for nearby homes.</p><b>{buildingLock(s.city,'waterpark')||'Place on the coast'}</b></button></div>
    <h3>What residents are saying <small>{w.complaints} homes</small></h3><p>Clouds follow walking residents, or appear over their home when nobody is outside. Fix the cause and that concern disappears automatically.</p>
    {!complaints.length&&<p className="positive">All occupied homes currently have clean surroundings, basic services and recreation.</p>}
    {complaints.slice(0,12).map(([k,l])=><article className="resident-concern" key={k}><button onClick={()=>focus(k)}><MapPin size={15}/>{l.district} · Home {k}<b>{l.happiness}%</b></button>{l.issues.map(i=><p key={i.id}><strong>{i.title}.</strong> {i.fix}</p>)}</article>)}
    <p className="fine">Keep industrial and waste campuses at least six lots from housing, with a greenbelt between districts. Schools, clinics and fire stations need utilities and road access; police cars must reach homes to reduce crime. Pollution is a local simulation score, not a physical carbon-emissions model. All districts belong to the same master plan.</p>
  </>;
}
