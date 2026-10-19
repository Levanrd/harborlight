import {waterEdge,validLand} from './grid';
export const coastalTypes=['beachhouse','beachresidential','resort'] as const;
export type CoastalKind=typeof coastalTypes[number];
export const coastalConfig={
  beachhouse:{name:'Beach house',zone:'residential',cost:650,description:'A raised coastal cottage with a veranda, garden and beach-facing deck.'},
  beachresidential:{name:'Coastal apartments',zone:'residential',cost:1400,description:'Terraced waterfront homes with balconies and shared outdoor space.'},
  resort:{name:'Beach resort',zone:'commercial',cost:3600,description:'A small seaside hotel with a courtyard pool, loungers and shaded terraces. Creates jobs.'},
} as const;
export const isCoastal=(kind:string):kind is CoastalKind=>coastalTypes.includes(kind as CoastalKind);
export const coastalLand=(p:{x:number;z:number})=>validLand(p.x,p.z)&&waterEdge(p.z*8)-p.x*8<=42;
