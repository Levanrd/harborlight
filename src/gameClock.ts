import {constructionSecond} from './upgradeConstruction';
import {metrics,tick,type City} from './simulation';
import {productionSecond} from './production';

/** Calendar time and active work time deliberately use separate rates. */
export type GameClock={dayProgress:number;daySeconds:120|300;workSeconds:number;developmentSeconds:number};
export const emptyClock=():GameClock=>({dayProgress:10/24,daySeconds:120,workSeconds:0,developmentSeconds:0});
export function decodeClock(value:unknown,legacyTrafficTime=0):GameClock{
  if(value===undefined)return {...emptyClock(),dayProgress:((legacyTrafficTime/10+10)%24)/24};
  const c=value as GameClock;
  if(!c||![120,300].includes(c.daySeconds)||!Number.isFinite(c.dayProgress)||c.dayProgress<0||c.dayProgress>=1||!Number.isFinite(c.workSeconds)||c.workSeconds<0||c.workSeconds>=1||!Number.isFinite(c.developmentSeconds)||c.developmentSeconds<0||c.developmentSeconds>=2)throw Error('Invalid city clock in backup.');
  return {dayProgress:c.dayProgress,daySeconds:c.daySeconds,workSeconds:c.workSeconds,developmentSeconds:c.developmentSeconds};
}
export function clockLabel(c:GameClock){const minutes=Math.floor(c.dayProgress*1440);return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
export function advanceCityClock(city:City,clock:GameClock,seconds:number){
  if(!Number.isFinite(seconds)||seconds<=0)return {city,clock};
  const next={...clock,dayProgress:clock.dayProgress+seconds/clock.daySeconds,workSeconds:clock.workSeconds+seconds,developmentSeconds:clock.developmentSeconds+seconds};
  while(next.developmentSeconds+1e-9>=2){city=tick(city,'development');next.developmentSeconds=Math.max(0,next.developmentSeconds-2);}
  while(next.workSeconds+1e-9>=1){const m=metrics(city),operational=new Set(Object.entries(m.lots).filter(([,l])=>l.supplied).map(([k])=>k)),production=productionSecond(city,operational);if(production!==city.production)city={...city,production};city=constructionSecond(city,operational);next.workSeconds=Math.max(0,next.workSeconds-1);}
  while(next.dayProgress+1e-9>=1){city=tick(city,'day');next.dayProgress=Math.max(0,next.dayProgress-1);}
  return {city,clock:next};
}
