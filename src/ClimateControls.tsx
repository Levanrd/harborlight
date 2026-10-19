import {useState} from 'react';
import {CloudSun,X} from 'lucide-react';
import {useGame} from './store';
import {climateAt,weatherEffects,defaultClimate,seasons,weatherKinds,seasonNames,weatherNames,type ClimateSettings} from './climate';

export function ClimateControls(){
  const clock=useGame(s=>s.clock),city=useGame(s=>s.city),set=useGame(s=>s.set),[open,setOpen]=useState(false),settings=city.climate||defaultClimate(),current=climateAt(city.day,city.seed,settings),effects=weatherEffects(current.weather);
  function change(part:Partial<ClimateSettings>){const state=useGame.getState();set({city:{...state.city,climate:{...(state.city.climate||defaultClimate()),...part}}});}
  return <><button className="climate-control" aria-label="Seasons and weather" aria-expanded={open} onClick={()=>setOpen(!open)}><CloudSun size={15}/><span>{seasonNames[current.season]} · {weatherNames[current.weather]}</span><b>{current.temperature}°C</b></button>{open&&<section className="climate-panel" role="dialog" aria-label="Seasons and weather controls">
    <div className="guide-top"><span className="eyebrow">SEASONS & WEATHER</span><button className="icon-button" aria-label="Close weather controls" onClick={()=>setOpen(false)}><X size={16}/></button></div>
    <h3>A changing city.</h3><p>Follow the calendar, or choose the atmosphere you want to explore.</p>
    <label>Season<select aria-label="Season" value={settings.season} onChange={e=>change({season:e.target.value as ClimateSettings['season']})}><option value="auto">Automatic · city calendar</option>{seasons.map(s=><option key={s} value={s}>{seasonNames[s]}</option>)}</select></label>
    <label>Weather<select aria-label="Weather" value={settings.weather} onChange={e=>change({weather:e.target.value as ClimateSettings['weather']})}><option value="auto">Automatic · seasonal forecast</option>{weatherKinds.map(w=><option key={w} value={w}>{weatherNames[w]}</option>)}</select></label>
    <label>Calendar pace<select aria-label="Calendar pace" value={clock.daySeconds} onChange={e=>set({clock:{...useGame.getState().clock,daySeconds:Number(e.target.value) as 120|300}})}><option value="120">Relaxed · 2 minutes / day</option><option value="300">Leisurely · 5 minutes / day</option></select></label>
    <p className="climate-summary" role="status">{seasonNames[current.season]} · {weatherNames[current.weather]} · {current.temperature}°C{settings.weather==='auto'?` · next forecast in ${current.daysToChange} city days`:''}</p>
    <p className="fine">Weather speed limit: {Math.round(effects.roadSpeed*100)}% · outdoor activity target: {Math.round(effects.outdoor*100)}% of clear weather. Ambulances, fire trucks, buses, patrols and garbage trucks share the road slowdown. Poor weather increases following distances and indoor stays. Accumulated snow and damage add further delays; use Road maintenance to send crews.</p>
    <p className="fine">Day length is measured at 1×. Materials still take 4–10 active seconds; construction stays quick. Pause freezes both clocks. Calendar pace and progress are saved. Automatic forecasts last up to 14 city days; seasons follow the calendar.</p>
  </section>}</>;
}
