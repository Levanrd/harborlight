import type {City,Cell,Resource} from './simulation';
import {key,neighbors,validLand} from './grid';

export const regionalTypes=['railway','seaport','airport'] as const;
export type RegionalKind=typeof regionalTypes[number];
export type RegionalTotals={passengers:number;cargo:number};
export const regionalConfig={
  railway:{name:'Passenger rail station',width:4,depth:2,cost:12000,upkeep:350,jobs:18,capacity:90,fare:1.5,impact:5,radius:4,level:2,utilities:{power:24,water:18,sewage:18},description:'A regional passenger connection with covered platforms and arriving trains. Supports commercial demand.'},
  seaport:{name:'Cargo seaport',width:3,depth:3,cost:26000,upkeep:650,jobs:32,capacity:90,fare:2.5,impact:18,radius:6,level:4,utilities:{power:65,water:45,sewage:40},description:'Warehouses, container cranes and a cargo berth. Supports industrial demand. Its eastern edge must face the shoreline.'},
  airport:{name:'Regional airport',width:6,depth:4,cost:42000,upkeep:900,jobs:45,capacity:120,fare:3.5,impact:24,radius:8,level:5,utilities:{power:90,water:50,sewage:40},description:'A terminal, control tower and runway with arriving and departing aircraft. Supports commercial demand; keep noise away from homes.'},
} satisfies Record<RegionalKind,{name:string;width:number;depth:number;cost:number;upkeep:number;jobs:number;capacity:number;fare:number;impact:number;radius:number;level:number;utilities:Record<Resource,number>;description:string}>;
export const isRegional=(kind:string):kind is RegionalKind=>regionalTypes.includes(kind as RegionalKind);
export function regionalFootprint(kind:RegionalKind,origin:{x:number;z:number}){
  const {width,depth}=regionalConfig[kind];return Array.from({length:width*depth},(_,i)=>({x:origin.x+i%width,z:origin.z+Math.floor(i/width)}));
}
export function regionalRoads(city:City,kind:RegionalKind,origin:{x:number;z:number}){
  return [...new Set(regionalFootprint(kind,origin).flatMap(p=>neighbors(p.x,p.z).map(([x,z])=>key(x,z))).filter(k=>city.cells[k]?.kind==='road'))];
}
export function coastalPort(origin:{x:number;z:number}){
  const {width,depth}=regionalConfig.seaport;
  // The complete land parcel ends at the last buildable column, facing east.
  return regionalFootprint('seaport',origin).every(p=>validLand(p.x,p.z))&&Array.from({length:depth},(_,i)=>!validLand(origin.x+width,origin.z+i)&&origin.x+width>0&&origin.x+width<19).every(Boolean);
}
export function regionalPlacementProblem(city:City,kind:RegionalKind,origin:{x:number;z:number}){
  if(regionalFootprint(kind,origin).some(p=>!validLand(p.x,p.z)))return 'The entire facility must fit on buildable land.';
  if(regionalFootprint(kind,origin).some(p=>city.cells[key(p.x,p.z)]))return 'This facility needs an entirely empty footprint.';
  if(kind==='seaport'&&!coastalPort(origin))return 'Place the seaport at the shoreline, with its eastern edge facing the water.';
  if(!regionalRoads(city,kind,origin).length)return 'Connect a road to any outside edge of the facility.';
  if(Object.values(city.cells).filter(c=>c.kind===kind&&c.regionalRoot===key(c.x,c.z)).length>=4)return 'This city supports up to four facilities of each regional transport type.';
  return '';
}
export function regionalMetrics(city:City,supplied:ReadonlySet<string>){
  const roots=Object.values(city.cells).filter(c=>isRegional(c.kind)&&c.regionalRoot===key(c.x,c.z));
  const population=Object.values(city.cells).filter(c=>c.kind==='residential').reduce((n,c)=>n+c.occupancy,0);
  const industrialJobs=Object.values(city.cells).filter(c=>c.kind==='industrial').reduce((n,c)=>n+c.occupancy,0);
  const activeCounts=Object.fromEntries(regionalTypes.map(kind=>[kind,roots.filter(c=>c.kind===kind&&supplied.has(key(c.x,c.z))).length]));
  const facilities=roots.map(cell=>{
    const kind=cell.kind as RegionalKind,config=regionalConfig[kind],id=key(cell.x,cell.z),road=regionalRoads(city,kind,cell).length>0,active=road&&supplied.has(id);
    const demand=kind==='seaport'?industrialJobs*.2:population*(kind==='airport'?.08:.12);
    const daily=active?Math.floor(Math.min(config.capacity,demand/Math.max(1,activeCounts[kind]))):0;
    return {key:id,cell,kind,config,active,daily,jobs:active?config.jobs:0,income:daily*config.fare*30,status:!road?'Needs road access':!active?'Utilities missing or overloaded':daily===0?(kind==='seaport'?'Waiting for industry':'Waiting for residents'):'Operating'};
  });
  const passengers=facilities.filter(f=>f.kind!=='seaport').reduce((n,f)=>n+f.daily,0),cargo=facilities.filter(f=>f.kind==='seaport').reduce((n,f)=>n+f.daily,0);
  return {facilities,passengers,cargo,jobs:facilities.reduce((n,f)=>n+f.jobs,0),income:facilities.reduce((n,f)=>n+f.income,0),upkeep:facilities.reduce((n,f)=>n+f.config.upkeep,0),commercialBonus:Math.min(18,passengers*.25),industrialBonus:Math.min(14,cargo*.5),happinessBonus:Math.min(3,facilities.filter(f=>f.kind==='railway').reduce((n,f)=>n+f.daily,0)*.1)};
}
export function regionalPollution(facilities:ReturnType<typeof regionalMetrics>['facilities'],cell:Cell){
  return facilities.reduce((n,f)=>n+(f.active?Math.max(0,1-Math.hypot(cell.x-(f.cell.x+(f.config.width-1)/2),cell.z-(f.cell.z+(f.config.depth-1)/2))/f.config.radius)*f.config.impact:0),0);
}
export function validateRegional(city:City){
  for(const [k,c]of Object.entries(city.cells)){
    if(c.regionalRoot!==undefined&&(!isRegional(c.kind)||typeof c.regionalRoot!=='string'))throw new Error('Invalid regional facility footprint.');
    if(!isRegional(c.kind))continue;
    const root=city.cells[c.regionalRoot||''];
    if(!root||root.kind!==c.kind||root.regionalRoot!==key(root.x,root.z)||!regionalFootprint(c.kind,root).some(p=>key(p.x,p.z)===k))throw new Error('Invalid regional facility footprint.');
    if(k===c.regionalRoot){
      if(c.kind==='seaport'&&!coastalPort(c))throw new Error('Seaport must face the shoreline.');
      for(const p of regionalFootprint(c.kind,c)){const part=city.cells[key(p.x,p.z)];if(!part||part.kind!==c.kind||part.regionalRoot!==k)throw new Error('Incomplete regional facility footprint.');}
    }
  }
  if(city.regional!==undefined){const v=city.regional;if(!v||!Number.isSafeInteger(v.passengers)||v.passengers<0||!Number.isSafeInteger(v.cargo)||v.cargo<0)throw new Error('Invalid regional transport totals.');}
}
