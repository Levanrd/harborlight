import {createUpgrade} from './upgradeConstruction';
import type {City} from './simulation';

export type Progression={xp:number;legacyBuildings:string[];legacyMaterials:string[]};
export const milestones=[
  {level:1,xp:0,name:'New beginnings',reward:0,unlocks:['Homes, shops & basic factories','Wood, metal, planks & nails','Utility hubs, clinics, fire stations & landfills','Pocket parks & public transport']},
  {level:2,xp:100,name:'A growing neighborhood',reward:750,unlocks:['Schools, playgrounds & passenger rail','Beach houses','Stone','Workshop factories · 4 parallel slots']},
  {level:3,xp:300,name:'A connected town',reward:1500,unlocks:['Police stations & sports fields','Coastal apartments','Bricks','Level 3 residential upgrades']},
  {level:4,xp:600,name:'An industrious city',reward:2500,unlocks:['Solar stations, water towers & treatment plants','Recycling centers & cargo seaports','Beach resorts & water parks','Advanced factories · 5 parallel slots']},
  {level:5,xp:1000,name:'A place to thrive',reward:5000,unlocks:['Large parks & regional airports']},
] as const;
export const buildingLevels:Record<string,number>={beachhouse:2,beachresidential:3,resort:4,waterpark:4,railway:2,seaport:4,airport:5,school:2,playground:2,police:3,sports:3,power:4,water:4,sewage:4,recycling:4,largepark:5};
export const materialLevels:Record<string,number>={stone:2,bricks:3};
export const emptyProgression=():Progression=>({xp:0,legacyBuildings:[],legacyMaterials:[]});
export function progressionOf(city:City):Progression{
  if(city.progression)return city.progression;
  // Import old towns once without removing their established facilities or goods.
  const used=new Set<string>();
  for(const k of Object.keys(materialLevels))if(city.production?.inventory[k as 'stone'|'bricks'])used.add(k);
  for(const jobs of Object.values(city.production?.queues||{}))for(const job of jobs)if(materialLevels[job.material])used.add(job.material);
  if(used.has('bricks'))used.add('stone');
  return {xp:Math.min(1000000000,(city.production?.upgrades||0)*100),legacyBuildings:[...new Set(Object.values(city.cells).map(c=>c.kind).filter(k=>buildingLevels[k]))],legacyMaterials:[...used]};
}
export function cityProgress(city:City){const p=progressionOf(city);const current=[...milestones].reverse().find(m=>p.xp>=m.xp)!;const next=milestones.find(m=>m.level===current.level+1);return {...p,current,next,remaining:next?next.xp-p.xp:0,fraction:next?(p.xp-current.xp)/(next.xp-current.xp):1};}
export function buildingLock(city:City,kind:string){const p=cityProgress(city),level=buildingLevels[kind]||1;return p.current.level<level&&!p.legacyBuildings.includes(kind)?`Unlocks at city level ${level}.`:'';}
export function materialLock(city:City,material:string){const p=cityProgress(city),level=materialLevels[material]||1;return p.current.level<level&&!p.legacyMaterials.includes(material)?`Unlocks at city level ${level}.`:'';}
export const homeXP=(target:number)=>target===2?100:200;
export function awardHomeXP(city:City,target:number){
  const before=cityProgress(city),xp=Math.min(1000000000,before.xp+homeXP(target));
  const reached=milestones.filter(m=>m.xp>before.xp&&m.xp<=xp),bonus=reached.reduce((n,m)=>n+m.reward,0);
  const cityNext:City={...city,money:city.money+bonus,progression:{...progressionOf(city),xp}};
  return {city:cityNext,message:`+${homeXP(target)} city XP.${reached.length?` City level ${reached.at(-1)!.level} reached! +$${bonus.toLocaleString()} milestone reward.`:''}`};
}
export const factoryTypes=[{tier:1,name:'Basic factory',level:1,slots:3,cost:0},{tier:2,name:'Workshop factory',level:2,slots:4,cost:900},{tier:3,name:'Advanced factory',level:4,slots:5,cost:2400}] as const;
export const factoryType=(city:City,k:string)=>factoryTypes[(city.cells[k]?.factoryTier||1)-1]||factoryTypes[0];
export function factoryUpgradeProblem(city:City,k:string){const c=city.cells[k],next=factoryTypes[c?.factoryTier||1];if(c?.kind!=='industrial')return 'Choose an industrial factory.';if(c.upgrade)return 'An upgrade is already under construction.';if(!next)return 'Factory is fully upgraded.';if(cityProgress(city).current.level<next.level)return `Unlocks at city level ${next.level}.`;if(c.age<3)return 'Finish initial construction.';if(city.money<next.cost)return 'Not enough funds for this factory upgrade.';return '';}
export function upgradeFactory(city:City,k:string){const problem=factoryUpgradeProblem(city,k);if(problem)return {city,message:problem};const next=factoryTypes[city.cells[k].factoryTier||1];return {city:{...city,money:city.money-next.cost,cells:{...city.cells,[k]:{...city.cells[k],upgrade:createUpgrade('factory',next.tier)}}},message:`${next.name} construction started · ${createUpgrade('factory',next.tier).duration}s of active work. The extra production slot opens at completion.`};}
export function decodeProgression(value:unknown,city:City):Progression{
  if(value===undefined)return progressionOf({...city,progression:undefined});
  const p=value as Progression;
  const validList=(v:unknown,allowed:Record<string,number>)=>Array.isArray(v)&&v.length<=Object.keys(allowed).length&&v.every(k=>typeof k==='string'&&Object.hasOwn(allowed,k))&&new Set(v).size===v.length;
  if(!p||!Number.isSafeInteger(p.xp)||p.xp<0||p.xp>1000000000||!validList(p.legacyBuildings,buildingLevels)||!validList(p.legacyMaterials,materialLevels))throw new Error('Invalid city progression save.');
  return {xp:p.xp,legacyBuildings:[...p.legacyBuildings],legacyMaterials:[...p.legacyMaterials]};
}
