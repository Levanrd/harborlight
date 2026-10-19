import {coastalLand} from './coastal';
import type {City,Cell} from './simulation';

export const recreationTypes=['park','playground','sports','largepark','waterpark'] as const;
export type RecreationKind=typeof recreationTypes[number];
export const recreationConfig={
  waterpark:{name:'Beach water park',width:3,depth:2,radius:8,happiness:11,landValue:18,green:2,cost:8500,upkeep:180,description:'A coastal recreation pool with water slides, shade sails and seating. Place near the shoreline.'},
  park:{name:'Pocket park',width:1,depth:1,radius:5,happiness:4,landValue:12,green:12,cost:500,upkeep:12,description:'A small garden with shade trees, paths, and benches.'},
  playground:{name:'Playground',width:2,depth:2,radius:5,happiness:7,landValue:10,green:3,cost:1800,upkeep:40,description:'Swings, a slide, and a colorful play area for the neighborhood.'},
  sports:{name:'Sports field',width:3,depth:2,radius:7,happiness:10,landValue:14,green:5,cost:4200,upkeep:100,description:'A community football field with goals and spectator seating.'},
  largepark:{name:'Large park',width:3,depth:3,radius:9,happiness:12,landValue:20,green:18,cost:6500,upkeep:150,description:'A landscaped public garden with walking paths, a fountain, and picnic areas.'},
} satisfies Record<RecreationKind,{name:string;width:number;depth:number;radius:number;happiness:number;landValue:number;green:number;cost:number;upkeep:number;description:string}>;
export const isRecreation=(kind:string):kind is RecreationKind=>recreationTypes.includes(kind as RecreationKind);
const key=(x:number,z:number)=>`${x},${z}`;
export const isFacilityRoot=(c:Cell)=>(!c.recreationRoot||c.recreationRoot===key(c.x,c.z))&&(!c.regionalRoot||c.regionalRoot===key(c.x,c.z));
export function recreationFootprint(kind:RecreationKind,origin:{x:number;z:number}){
  const {width,depth}=recreationConfig[kind];
  return Array.from({length:width*depth},(_,i)=>({x:origin.x+i%width,z:origin.z+Math.floor(i/width)}));
}
export function recreationRoadAccess(city:City,kind:RecreationKind,origin:{x:number;z:number}){
  return recreationFootprint(kind,origin).some(p=>[[p.x-1,p.z],[p.x+1,p.z],[p.x,p.z-1],[p.x,p.z+1]].some(([x,z])=>city.cells[key(x,z)]?.kind==='road'));
}
export function recreationMetrics(city:City){
  const homes=Object.values(city.cells).filter(c=>c.kind==='residential'&&c.occupancy>0);
  const facilities=Object.entries(city.cells).filter(([,c])=>isRecreation(c.kind)&&isFacilityRoot(c)).map(([k,c])=>{
    const kind=c.kind as RecreationKind,config=recreationConfig[kind],x=c.x+(config.width-1)/2,z=c.z+(config.depth-1)/2;
    const active=recreationRoadAccess(city,kind,c);
    return {key:k,cell:c,kind,config,x,z,active,residents:active?homes.filter(h=>Math.hypot(h.x-x,h.z-z)<config.radius).reduce((n,h)=>n+h.occupancy,0):0};
  });
  const lots:Record<string,{happiness:number;landValue:number;green:number;score:number}>={};
  for(const [k,c]of Object.entries(city.cells)){
    let happiness=0,landValue=0,green=0;
    for(const f of facilities){if(!f.active)continue;const weight=Math.max(0,1-Math.hypot(c.x-f.x,c.z-f.z)/f.config.radius);happiness+=weight*f.config.happiness;landValue+=weight*f.config.landValue;green+=weight*f.config.green;}
    lots[k]={happiness:Math.min(12,happiness),landValue:Math.min(30,landValue),green:Math.min(30,green),score:Math.min(100,happiness/12*100)};
  }
  const population=homes.reduce((n,h)=>n+h.occupancy,0);
  return {facilities,lots,coverage:population?homes.reduce((n,h)=>n+(lots[key(h.x,h.z)].happiness>0?h.occupancy:0),0)/population*100:0,
    happinessBonus:homes.reduce((n,h)=>n+lots[key(h.x,h.z)].happiness*h.occupancy,0)/Math.max(1,population),upkeep:facilities.reduce((n,f)=>n+f.config.upkeep,0)};
}

export function validateRecreation(city:City){
  for(const [k,c]of Object.entries(city.cells)){
    if(c.recreationRoot!==undefined&&(!isRecreation(c.kind)||typeof c.recreationRoot!=='string'))throw new Error('Invalid recreation footprint.');
    if(!isRecreation(c.kind))continue;
    if(c.kind==='park'&&c.recreationRoot===undefined)continue; // Original single-lot parks remain compatible.
    const root=city.cells[c.recreationRoot||''];
    if(!root||root.kind!==c.kind||root.recreationRoot!==key(root.x,root.z)||!recreationFootprint(c.kind,root).some(p=>key(p.x,p.z)===k))throw new Error('Invalid recreation footprint.');
    if(c.kind==='waterpark'&&isFacilityRoot(c)&&!coastalLand({x:c.x+1,z:c.z}))throw Error('Water park must be near the coast.');
    if(isFacilityRoot(c))for(const p of recreationFootprint(c.kind,c)){const member=city.cells[key(p.x,p.z)];if(!member||member.kind!==c.kind||member.recreationRoot!==k)throw new Error('Incomplete recreation footprint.');}
  }
}
