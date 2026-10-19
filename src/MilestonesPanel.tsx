import {Trophy,Check,Lock,ArrowRight} from 'lucide-react';
import {useGame} from './store';
import {cityProgress,milestones} from './progression';
import {labels,type Kind} from './simulation';
import './progression.css';

export function MilestonesPanel({production}:{production:()=>void}){
  const city=useGame(s=>s.city),p=cityProgress(city);
  return <><h2>A city worth growing.</h2><p>Upgrade homes, earn experience, and open new possibilities for your city.</p>
    <div className="milestone-summary"><div className="level-medal"><Trophy size={26}/><b>{p.current.level}</b></div><div><span>CITY LEVEL {p.current.level}</span><h3>{p.current.name}</h3><strong>{p.xp.toLocaleString()} total XP</strong></div></div>
    <div className="meter milestone-meter" role="progressbar" aria-label="City level progress" aria-valuenow={p.xp} aria-valuemin={p.current.xp} aria-valuemax={p.next?.xp||Math.max(p.xp,1000)}><i style={{width:p.fraction*100+'%'}}/></div>
    <p>{p.next?`${p.remaining} XP to level ${p.next.level} · ${p.next.name}`:'All city milestones unlocked. Keep upgrading homes to earn lifetime XP.'}</p>
    <div className="xp-guide"><strong>Every home makes a difference.</strong><p>Level 1 → 2 home: <b>100 XP</b> · Level 2 → 3 home: <b>200 XP</b></p><p>Milestone cash rewards arrive automatically once when you cross each threshold. Production, construction, and factory upgrades do not earn XP.</p><button className="primary" onClick={production}>Produce materials & upgrade homes <ArrowRight size={16}/></button></div>
    <div className="milestone-list">{milestones.map(m=>{const unlocked=p.xp>=m.xp;return <article key={m.level} className={'milestone '+(unlocked?'unlocked':p.next?.level===m.level?'next':'')}><div className="milestone-heading"><span className="milestone-number">{unlocked?<Check size={18}/>:<Lock size={16}/>} {m.level}</span><div><h3>{m.name}</h3><small>{m.xp.toLocaleString()} XP · {unlocked?'Reached':p.next?.level===m.level?'Next milestone':'Locked'}</small></div><b>{m.reward?`+$${m.reward.toLocaleString()}`:'Starting access'}</b></div><ul>{m.unlocks.map(u=><li key={u}>{u}</li>)}</ul></article>;})}</div>
    {(p.legacyBuildings.length>0||p.legacyMaterials.length>0)&&<p className="fine">Retained access from your existing town: {[...p.legacyBuildings.map(k=>labels[k as Kind]||k),...p.legacyMaterials.map(k=>k[0].toUpperCase()+k.slice(1))].join(', ')}. Earlier paid upgrades receive 100 XP each on migration; past milestone cash is not paid again. Existing buildings continue to operate.</p>}
  </>;
}
