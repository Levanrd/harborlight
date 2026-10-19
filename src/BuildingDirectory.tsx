import {useMemo,useState} from 'react';
import {Building2,Factory,GraduationCap,HeartPulse,House,MapPin,Plane,Search,Shield,Trees,Waves,Zap} from 'lucide-react';
import {useGame} from './store';
import {buildingFamily,buildingGroups,cityBuildingDirectory,type BuildingGroup} from './buildingFamilies';
import type {Cell} from './simulation';
import {labels} from './simulation';
import './buildingDirectory.css';

const icons={homes:House,workplaces:Building2,industry:Factory,civic:GraduationCap,safety:Shield,transport:Plane,coast:Waves,parks:Trees,utilities:Zap};
const roleLabel=(c:Cell)=>c.coastal==='resort'?'Hospitality & jobs':c.kind==='commercial'?(c.level>=3?'Office employment':'Retail & local jobs'):c.kind==='residential'?'Housing':c.kind==='industrial'?'Production & jobs':labels[c.kind as keyof typeof labels];
export function BuildingIdentity({cell}:{cell:Cell}){
  const f=buildingFamily(cell);if(!f)return null;
  const group=buildingGroups[f.group],Icon=cell.kind==='clinic'?HeartPulse:icons[f.group];
  return <div className="building-identity" style={{borderLeftColor:group.color}}><Icon color={group.color} size={25}/><div><small>{group.name}</small><strong>{f.name}</strong><p>{f.description}</p></div></div>;
}
export function BuildingDirectory({focus}:{focus:(cell:Cell)=>void}){
  const city=useGame(s=>s.city),entries=useMemo(()=>cityBuildingDirectory(city),[city]);
  const [group,setGroup]=useState<BuildingGroup|'all'>('all'),[query,setQuery]=useState('');
  const visible=entries.filter(e=>(group==='all'||e.family.group===group)&&`${e.family.name} ${e.family.description} ${buildingGroups[e.family.group].name}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <><h2>A city of distinct places.</h2><p>Explore the architectural families in your city. Homes, workplaces and infrastructure each have their own role and character.</p>
    <div className="building-directory-summary"><b>{entries.length} architectural families</b><span>{entries.reduce((n,e)=>n+e.lots.length,0)} developed buildings & facilities</span></div>
    <label className="building-search"><Search size={18}/><input aria-label="Search building families" placeholder="Search buildings, styles or infrastructure…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="building-filters" aria-label="Building categories"><button aria-pressed={group==='all'} onClick={()=>setGroup('all')}>All</button>{Object.entries(buildingGroups).map(([id,g])=><button key={id} aria-pressed={group===id} onClick={()=>setGroup(id as BuildingGroup)}>{g.name}<span>{entries.filter(e=>e.family.group===id).reduce((n,e)=>n+e.lots.length,0)}</span></button>)}</div>
    <div className="building-directory-grid">{visible.map(({family:f,lots})=>{const group=buildingGroups[f.group],Icon=icons[f.group];return <article key={f.id} className="building-family-card" style={{borderTopColor:group.color}}><div className="building-family-top"><Icon size={32} color={group.color}/><span>{lots.length} {lots.length===1?'building':'buildings'}</span></div><small style={{color:group.color}}>{group.name}</small><h3>{f.name}</h3><p>{f.description}</p><div className="building-family-role">Role: {roleLabel(lots[0])}{['residential','commercial'].includes(lots[0].kind)?` · Level ${[...new Set(lots.map(c=>c.level))].sort().join(' / ')}`:''}</div><button onClick={()=>focus(lots[0])}><MapPin size={15}/> Find in city</button></article>;})}</div>
    {!visible.length&&<p role="status">No developed buildings match this category or search yet.</p>}
    <p className="fine">Styles follow a lot's location and development level. Upgrade homes with materials; commercial buildings grow with demand and services. Architecture does not change a building's function, capacity or service coverage.</p>
  </>;
}
