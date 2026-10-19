import type {Cell,City} from './simulation';
import {awardHomeXP} from './progression';

export type UpgradeProject={kind:'home'|'factory'|'development';target:number;duration:number;remaining:number};
export const upgradeDuration=(kind:UpgradeProject['kind'],target:number)=>kind==='factory'?(target===2?30:45):(target===2?20:35);
export function createUpgrade(kind:UpgradeProject['kind'],target:number):UpgradeProject{const duration=upgradeDuration(kind,target);return {kind,target,duration,remaining:duration};}
export const upgradePhase=(p:UpgradeProject)=>Math.min(2,Math.floor((1-p.remaining/p.duration)*3));
export const upgradePhases=['Site setup','Structural work','Facade & finishing'];
/** Work advances only while the city runs and the site's utilities are supplied.
 * The old capacity remains in use until handover; completion rewards happen once. */
export function constructionSecond(city:City,operational:Set<string>):City{
  let next=city;
  for(const [k,c]of Object.entries(city.cells)){
    const p=c.upgrade;if(!p||!operational.has(k))continue;
    if(next===city)next={...city,cells:{...city.cells}};
    if(p.remaining>1){next.cells[k]={...c,upgrade:{...p,remaining:p.remaining-1}};continue;}
    const {upgrade:_,...completed}=c;
    next.cells[k]={...completed,...(p.kind==='factory'?{factoryTier:p.target}:{level:p.target})};
    if(p.kind==='home'){
      next={...next,production:{...next.production!,upgrades:next.production!.upgrades+1}};
      next=awardHomeXP(next,p.target).city;
    }
  }
  return next;
}
export function validateUpgrade(c:Cell,city:City){
  const p=c.upgrade;if(p===undefined)return;
  if(!p||!['home','factory','development'].includes(p.kind)||![2,3].includes(p.target)||p.duration!==upgradeDuration(p.kind,p.target)||!Number.isInteger(p.remaining)||p.remaining<1||p.remaining>p.duration||c.age<3||
    (p.kind==='home'&&(c.kind!=='residential'||!city.production))||
    (p.kind==='factory'&&c.kind!=='industrial')||
    (p.kind==='development'&&!['commercial','industrial'].includes(c.kind))||
    p.target!==(p.kind==='factory'?(c.factoryTier||1):c.level)+1)throw Error('Invalid building upgrade project.');
}
