import type {Cell, City} from './simulation';

export const buildingGroups = {
  homes: {name:'Homes',color:'#258561'}, workplaces:{name:'Shops & offices',color:'#287eb6'},
  industry:{name:'Industry & logistics',color:'#ad7425'}, civic:{name:'Education & care',color:'#8763ab'},
  safety:{name:'Emergency services',color:'#c25158'}, transport:{name:'Transportation',color:'#3974a9'},
  coast:{name:'Beach & leisure',color:'#178a99'}, parks:{name:'Parks & recreation',color:'#54842f'},
  utilities:{name:'Utilities & sanitation',color:'#687581'},
} as const;
export type BuildingGroup=keyof typeof buildingGroups;
export type BuildingFamily={id:string;name:string;group:BuildingGroup;description:string};
// Keep existing lots stable: upgrading changes density, never the location's design seed.
export function buildingVariant(c:Pick<Cell,'x'|'z'>){let hash=Math.imul(c.x+211,73856093)^Math.imul(c.z+307,19349663);hash=Math.imul(hash^(hash>>>16),2246822519);return (hash>>>0)%6;}
const family=(id:string,name:string,group:BuildingGroup,description:string):BuildingFamily=>({id,name,group,description});
const homes=[
  family('masonry','Masonry apartments','homes','Warm masonry, individual windows and sheltered balconies.'),
  family('classic','Classic residences','homes','Cream walls, projecting balconies and a rooftop pavilion.'),
  family('courtyard','Courtyard residences','homes','Two apartment wings frame a planted courtyard and entrance arcade.'),
  family('terraces','Garden terraces','homes','Stepped upper floors, deep terraces and planted roof gardens.'),
  family('pastel','Pastel apartments','homes','A compact residential block with repeated balconies and a green roof.'),
  family('veranda','Veranda residences','homes','Rounded wraparound balconies and a recessed residential lobby.'),
];
const offices=[
  family('rotunda','Rotunda offices','workplaces','A cylindrical glass tower with horizontal floor bands.'),
  family('heritage','Heritage offices','workplaces','Stone piers, a stepped crown and a slender spire.'),
  family('twin','Twin-wing offices','workplaces','Offset glass wings and an elevated roof terrace.'),
  family('spire','Lantern tower','workplaces','Tapered glass floors rising to an illuminated lantern crown.'),
  family('sky-garden','Sky-garden offices','workplaces','Three offset volumes with planted setbacks and shaded terraces.'),
  family('fins','Fin-frame offices','workplaces','Vertical facade fins and a rooftop glass pavilion.'),
];
const facilities:Partial<Record<Cell['kind'],BuildingFamily>>={
  school:family('school','School campus','civic','Classroom wings, a school entrance and an outdoor learning yard.'),
  clinic:family('clinic','Neighborhood clinic','civic','Medical entrance, ambulance access and rooftop equipment.'),
  police:family('police','Police precinct','safety','A civic frontage with patrol-car facilities.'),
  fire:family('fire','Fire & rescue station','safety','Appliance bays and space for responding fire crews.'),
  airport:family('airport','Passenger airport','transport','Runway, terminal, apron and aircraft gates.'),
  seaport:family('seaport','Container port','transport','Quayside cranes, cargo sheds and container handling.'),
  railway:family('railway','Passenger rail terminal','transport','Covered platforms, regional tracks and a station hall.'),
  park:family('park','Pocket garden','parks','Small planted paths and seating within the neighborhood.'),
  playground:family('playground','Playground','parks','Play equipment, safe paths and family seating.'),
  sports:family('sports','Community sports field','parks','Marked playing surfaces and spectator facilities.'),
  largepark:family('largepark','Landscape park','parks','Broad gardens, walking paths, fountains and gathering spaces.'),
  waterpark:family('waterpark','Beach water park','coast','Pools, slides and landscaped leisure grounds.'),
  power:family('power','Solar power station','utilities','Panel arrays and electrical service buildings.'),
  water:family('water','Water supply tower','utilities','An elevated reservoir and pumping infrastructure.'),
  sewage:family('sewage','Water treatment works','utilities','Treatment basins, pipework and service buildings.'),
  utility:family('utility','Utility hub','utilities','Combined local power, water and sewage infrastructure.'),
  landfill:family('landfill','Waste disposal site','utilities','Waste storage and collection-truck facilities.'),
  recycling:family('recycling','Recycling works','utilities','Sorting infrastructure, processing sheds and collection vehicles.'),
  maintenance:family('maintenance','Road maintenance depot','utilities','Workshops and a yard for road service vehicles.'),
};
export function buildingFamily(c:Cell):BuildingFamily|undefined{
  if(c.kind==='road')return undefined;
  if(c.coastal)return c.coastal==='beachhouse'?family('beachhouse','Coastal cottages','coast','Raised homes with verandas, palms and beach-facing decks.'):c.coastal==='resort'?family('resort','Beach resort','coast','Hotel balconies, pool terraces and a leisure frontage.'):family('beachresidential','Seafront residences','coast','Coastal apartments with generous balconies and outdoor living.');
  const v=buildingVariant(c);
  if(c.kind==='residential')return c.level===1?family('cottage','Garden cottages','homes','Pitched roofs, chimneys, porches and private gardens.'):homes[v];
  if(c.kind==='commercial')return c.level>=3?offices[v]:family('high-street','High-street shops','workplaces','Glazed storefronts, striped awnings and pavement displays.');
  if(c.kind==='industrial')return v<2?family('workshop','Manufacturing workshops','industry','Loading bays, rooftop equipment and a compact service yard.'):v%2===0?family('warehouse','Distribution warehouses','industry','Sawtooth roof lights, loading docks and container storage.'):family('processing','Process engineering works','industry','Storage silos, vertical stacks and exposed connecting pipes.');
  return facilities[c.kind];
}
export function hasFamilyModel(c:Cell){const v=buildingVariant(c);return !c.coastal&&((c.kind==='residential'&&c.level>1&&[2,3,5].includes(v))||(c.kind==='commercial'&&c.level>=3&&[3,4].includes(v))||(c.kind==='industrial'&&v>=2));}
export function cityBuildingDirectory(city:City){
  const entries=new Map<string,{family:BuildingFamily;lots:Cell[]}>();
  for(const c of Object.values(city.cells)){
    const k=`${c.x},${c.z}`;
    if((c.regionalRoot&&c.regionalRoot!==k)||(c.recreationRoot&&c.recreationRoot!==k))continue;
    if(['residential','commercial','industrial'].includes(c.kind)&&c.age<3)continue;
    const f=buildingFamily(c);if(!f)continue;
    const entry=entries.get(f.id)||{family:f,lots:[]};entry.lots.push(c);entries.set(f.id,entry);
  }
  for(const e of entries.values())e.lots.sort((a,b)=>b.level-a.level||a.x-b.x||a.z-b.z);
  return [...entries.values()].sort((a,b)=>a.family.name.localeCompare(b.family.name));
}
