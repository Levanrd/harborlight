import {HardHat,MapPin} from 'lucide-react';
import {useGame} from './store';
import {metrics} from './simulation';
import {upgradePhase,upgradePhases} from './upgradeConstruction';
import './construction.css';
export function ConstructionProgress({lot,onFocus}:{lot:string;onFocus?:()=>void}){
  const s=useGame(),c=s.city.cells[lot],p=c?.upgrade;if(!p)return null;
  const supplied=metrics(s.city).lots[lot]?.supplied,progress=Math.floor((1-p.remaining/p.duration)*100);
  return <section className="construction-progress" aria-label="Upgrade construction"><div><HardHat size={21}/><strong>{p.kind==='factory'?'Factory expansion':'Building upgrade'}</strong><b>{progress}%</b></div><p>{upgradePhases[upgradePhase(p)]} · {p.kind==='factory'?'Tier':'Level'} {p.target}</p><progress aria-label="Construction progress" value={p.duration-p.remaining} max={p.duration}/><small>{!supplied?'Waiting for road-connected utilities':!s.speed?'Paused — resume the city':`${p.remaining}s of work remaining at 1×`}</small><p>Existing capacity stays available. The completed upgrade unlocks new capacity{p.kind==='home'?' and XP':''}.</p><button onClick={()=>{if(onFocus){onFocus();return;}s.set({selected:c,tool:'inspect'});window.dispatchEvent(new CustomEvent('city-camera',{detail:{focus:c}}));}}><MapPin size={14}/>View construction site</button></section>;
}
