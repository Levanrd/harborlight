// Local-only integration harness; use a separate origin from the user's game.
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {World} from '../src/World';
import {RegionalPanel} from '../src/RegionalPanel';
import {regionalConfig,isRegional} from '../src/regional';
import {useGame,saveCity,loadCity} from '../src/store';
import {decodeCity,metrics} from '../src/simulation';
import fixture from './regional-fixture.json';
import '../src/style.css';
if(!import.meta.env.DEV||location.port!=='5184')throw Error('Use the isolated development server on port 5184 for this test city.');
useGame.getState().set({city:decodeCity(fixture),speed:0,revision:1});
function Preview(){
  const s=useGame(),[panel,setPanel]=useState(true),[status,setStatus]=useState('Disposable sample city; your main town is separate.');
  useEffect(()=>{const a=setInterval(()=>{const s=useGame.getState();for(let i=0;i<s.speed;i++)s.step();},2000),b=setInterval(()=>{const s=useGame.getState();s.advance(.1*s.speed);},100);return()=>{clearInterval(a);clearInterval(b);};},[]);
  const m=metrics(s.city);
  return <><World/><header style={{position:'fixed',top:16,left:16,right:16,display:'flex',flexWrap:'wrap',alignItems:'center',gap:14,padding:16,borderRadius:12,background:'#f4f6edf5',zIndex:5,fontSize:12}}><strong>REGIONAL TRANSPORT / PLAYTEST</strong><span>Day {s.city.day} · ${Math.round(s.city.money).toLocaleString()} · {m.regional.passengers} passengers/day · {m.regional.cargo} cargo/day</span><button onClick={()=>setPanel(true)}>Regional desk</button><button onClick={()=>s.set({speed:s.speed?0:1})}>{s.speed?'Pause':'Run city'}</button><button onClick={()=>s.set({lighting:s.lighting==='night'?'day':'night'})}>Day / night</button><button onClick={()=>window.dispatchEvent(new CustomEvent('city-camera',{detail:'home'}))}>Overview</button><button onClick={async()=>{await saveCity();setStatus('Test city saved.');}}>Save test city</button><button onClick={async()=>{await loadCity();setStatus('Test city reloaded.');}}>Reload test city</button><output>{status}</output></header>
  {panel&&<div className="modal-backdrop"><section className="modal management-modal" role="dialog" aria-label="Regional transport"><button className="modal-close" onClick={()=>setPanel(false)}>Close desk</button><RegionalPanel choose={kind=>{s.setTool(kind);setPanel(false);}} focus={k=>{const c=s.city.cells[k];if(c&&isRegional(c.kind)){const cfg=regionalConfig[c.kind];s.set({selected:c,tool:'inspect'});window.dispatchEvent(new CustomEvent('city-camera',{detail:{focus:{x:c.x+(cfg.width-1)/2,z:c.z+(cfg.depth-1)/2}}}));setPanel(false);}}}/></section></div>}
  {s.selected&&<div style={{position:'fixed',bottom:24,left:24,padding:14,borderRadius:10,background:'#f4f6edf5',fontSize:12}}>Selected {s.selected.kind} · {s.selected.x}, {s.selected.z}</div>}</>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
