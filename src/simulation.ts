import {validateUpgrade,createUpgrade,type UpgradeProject} from './upgradeConstruction';
import {decodeMaintenance,maintenanceUpkeep,type Maintenance} from './maintenance';
import {decodeClimate} from './climate';
import {coastalConfig,coastalLand,isCoastal,type CoastalKind} from './coastal';
import {neighborhoodWellbeing} from './neighborhoods';
import {isRegional,regionalTypes,regionalConfig,regionalFootprint,regionalRoads,regionalPlacementProblem,regionalMetrics,regionalPollution,validateRegional,type RegionalKind,type RegionalTotals} from './regional';
import {key,neighbors,validLand} from './grid';
export {key,neighbors,waterEdge,validLand} from './grid';
import {buildingLock,emptyProgression,decodeProgression,type Progression} from './progression';
import {decodeProduction,hasFactoryWork,upgradeOffer,applyHomeUpgrade,type Production} from './production';
import {recreationMetrics,recreationFootprint,recreationRoadAccess,isRecreation,isFacilityRoot,validateRecreation,recreationConfig,type RecreationKind} from './recreation';
import {crimeDay,crimeSummary,crimeLevel,decodeCrime,type Crime} from './police';
import {decodeWaste,wasteDay,wastePollutionSampler,wasteSummary,isWasteFacility,type Waste} from './waste';
import {decodeTransit,transitUpkeep,type Transit} from './transit';
export type Zone = 'residential' | 'commercial' | 'industrial';
export type Service = 'school' | 'clinic' | 'fire';
export type Resource = 'power' | 'water' | 'sewage';
export type Kind = Zone | Service | Resource | 'maintenance' | 'police' | 'landfill' | 'recycling' | 'utility' | RecreationKind | RegionalKind;
export type Cell = { upgrade?:UpgradeProject; x:number; z:number; kind:Kind|'road'; age:number; level:number; occupancy:number; avenue?:boolean; recreationRoot?:string; regionalRoot?:string; factoryTier?:number; coastal?:CoastalKind };
export type City = { maintenance?:Maintenance; climate?:import('./climate').ClimateSettings; version:1; name:string; money:number; day:number; tax:number; cells:Record<string,Cell>; seed:number; transit?:Transit; waste?:Waste; crime?:Crime; production?:Production; progression?:Progression; regional?:RegionalTotals };
export const resources:Resource[] = ['power','water','sewage'];
export const services:Service[] = ['school','clinic','fire'];
export const isZone = (c:Cell):c is Cell & {kind:Zone} => ['residential','commercial','industrial'].includes(c.kind);
export const price:Record<string,number> = {maintenance:3800,beachhouse:650,beachresidential:1400,resort:3600,waterpark:8500,road:90,avenue:160,residential:20,commercial:30,industrial:25,utility:4200,power:3000,water:2200,sewage:2400,school:3600,clinic:4500,fire:3800,park:500,playground:1800,sports:4200,largepark:6500,police:5200,landfill:4500,recycling:8000,bulldoze:20,...Object.fromEntries(regionalTypes.map(k=>[k,regionalConfig[k].cost]))};
export const upkeep:Record<string,number> = {waterpark:180,utility:110,power:85,water:55,sewage:60,school:100,clinic:140,fire:110,park:12,playground:40,sports:100,largepark:150,police:220,landfill:180,recycling:320,...Object.fromEntries(regionalTypes.map(k=>[k,regionalConfig[k].upkeep]))};
export const zoneColors:Record<Kind,string> = {maintenance:'#daa348',waterpark:'#6bbcc7',residential:'#80be91',commercial:'#79b9dc',industrial:'#e5bf72',utility:'#8dc8c9',power:'#e8cb77',water:'#72b8d1',sewage:'#a1b291',school:'#aa9cca',clinic:'#df9e97',fire:'#db9369',park:'#a9c37a',playground:'#e2b778',sports:'#8cba98',largepark:'#79a881',police:'#91a9cf',landfill:'#b69a72',recycling:'#72b5a1',airport:'#8dbed5',seaport:'#7aa6b8',railway:'#d3ad72'};
export const labels:Record<Kind,string> = {maintenance:'Road maintenance depot',waterpark:'Beach water park',residential:'Homes',commercial:'Shops',industrial:'Industry',utility:'Starter utility hub',power:'Solar station',water:'Water tower',sewage:'Treatment plant',school:'School',clinic:'Clinic',fire:'Fire station',park:'Pocket park',playground:'Playground',sports:'Sports field',largepark:'Large park',police:'Police station',landfill:'Landfill',recycling:'Recycling center',airport:'Regional airport',seaport:'Cargo seaport',railway:'Passenger rail station'};
export const serviceRange:Record<Service,number> = {school:12,clinic:16,fire:18};
const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
const units=(c:Cell,r:Resource)=>c.kind==='industrial'?(r==='power'?2:1.5):1;
const emptyResources=():Record<Resource,number>=>({power:0,water:0,sewage:0});
export const adjacentRoad=(city:City,c:{x:number;z:number})=>neighbors(c.x,c.z).some(([x,z])=>city.cells[key(x,z)]?.kind==='road');

export function roadPath(a:{x:number;z:number},b:{x:number;z:number}) {
  const out=[{...a}];let {x,z}=a;
  while(x!==b.x){x+=Math.sign(b.x-x);out.push({x,z});}
  while(z!==b.z){z+=Math.sign(b.z-z);out.push({x,z});}
  return out;
}

export type Network={id:number;roads:Set<string>;capacity:Record<Resource,number>;used:Record<Resource,number>};
function roadNetworks(city:City) {
  const roadIds=new Map<string,number>(),networks:Network[]=[];
  for(const c of Object.values(city.cells)) {
    const first=key(c.x,c.z);if(c.kind!=='road'||roadIds.has(first))continue;
    const n:Network={id:networks.length,roads:new Set([first]),capacity:emptyResources(),used:emptyResources()};
    const queue=[first];roadIds.set(first,n.id);
    for(let i=0;i<queue.length;i++) {
      const road=city.cells[queue[i]];
      for(const [x,z] of neighbors(road.x,road.z)) {const k=key(x,z);if(city.cells[k]?.kind==='road'&&!roadIds.has(k)){roadIds.set(k,n.id);n.roads.add(k);queue.push(k);}}
    }
    networks.push(n);
  }
  const lotNetwork=new Map<string,number>();
  for(const c of Object.values(city.cells)) {
    if(c.kind==='road'||!isFacilityRoot(c))continue;
    // A facility attaches to one road network. Buildings never bridge separate roads.
    const adjacent=(isRegional(c.kind)?regionalRoads(city,c.kind,c):neighbors(c.x,c.z).map(([x,z])=>key(x,z))).map(k=>roadIds.get(k)).filter((v):v is number=>v!==undefined).sort((a,b)=>a-b);
    if(!adjacent.length)continue;
    const n=networks[adjacent[0]];lotNetwork.set(key(c.x,c.z),n.id);
    for(const r of resources) {if(c.kind==='utility')n.capacity[r]+=500;if(c.kind===r)n.capacity[r]+=r==='power'?900:750;if(isZone(c))n.used[r]+=c.occupancy*units(c,r);if(isRegional(c.kind))n.used[r]+=regionalConfig[c.kind].utilities[r];}
  }
  for(const c of Object.values(city.cells))if(c.regionalRoot){const network=lotNetwork.get(c.regionalRoot);if(network!==undefined)lotNetwork.set(key(c.x,c.z),network);}
  return {networks,roadIds,lotNetwork};
}

export type LotStatus={network:number|undefined;supplied:boolean;pollution:number;landValue:number;coverage:Record<Service,boolean>;growthReason:string};
const metricCache=new WeakMap<City,ReturnType<typeof calculateMetrics>>();
export function metrics(city:City) {let result=metricCache.get(city);if(!result){result=calculateMetrics(city);metricCache.set(city,result);}return result;}
export function connectedRoads(city:City) {return metrics(city).connected;}
function calculateMetrics(city:City) {
  const all=Object.values(city.cells),zones=all.filter(isZone),homes=zones.filter(c=>c.kind==='residential'),roads=all.filter(c=>c.kind==='road');
  const {networks,roadIds,lotNetwork}=roadNetworks(city);
  const connected=new Set<string>();
  for(const n of networks)if(resources.every(r=>n.capacity[r]>0&&n.used[r]<=n.capacity[r]))n.roads.forEach(k=>connected.add(k));
  const covered:Record<Service,Set<string>>={school:new Set(),clinic:new Set(),fire:new Set()};
  for(const facility of all.filter(c=>services.includes(c.kind as Service))) {
    const kind=facility.kind as Service,networkId=lotNetwork.get(key(facility.x,facility.z));
    if(networkId===undefined)continue;
    const n=networks[networkId];if(!resources.every(r=>n.capacity[r]>0&&n.used[r]<=n.capacity[r]))continue;
    const queue=neighbors(facility.x,facility.z).map(([x,z])=>key(x,z)).filter(k=>roadIds.get(k)===networkId);
    const distance=new Map(queue.map(k=>[k,0]));
    for(let i=0;i<queue.length;i++) {const k=queue[i],road=city.cells[k],d=distance.get(k)!;covered[kind].add(k);if(d>=serviceRange[kind])continue;for(const [x,z]of neighbors(road.x,road.z)){const next=key(x,z);if(roadIds.get(next)===networkId&&!distance.has(next)){distance.set(next,d+1);queue.push(next);}}}
  }
  const pollutionSources=all.filter(c=>(c.kind==='industrial'&&c.occupancy>0)||c.kind==='sewage');
  const recreation=recreationMetrics(city);
  const suppliedLots=new Set([...lotNetwork].filter(([,id])=>resources.every(r=>networks[id].capacity[r]>0&&networks[id].used[r]<=networks[id].capacity[r])).map(([k])=>k));
  const regional=regionalMetrics(city,suppliedLots);
  const lots:Record<string,LotStatus>={},wastePollution=wastePollutionSampler(city);
  for(const c of all) {
    const k=key(c.x,c.z),network=c.kind==='road'?roadIds.get(k):lotNetwork.get(k),n=network===undefined?undefined:networks[network];
    const supplied=!!n&&resources.every(r=>n.capacity[r]>0&&n.used[r]<=n.capacity[r]);
    const coverage=Object.fromEntries(services.map(service=>[service,(c.kind==='road'?[k]:neighbors(c.x,c.z).map(([x,z])=>key(x,z))).some(k=>covered[service].has(k))])) as Record<Service,boolean>;
    const green=recreation.lots[k].green;
    const pollution=Math.round(clamp(pollutionSources.reduce((v,p)=>v+Math.max(0,1-Math.hypot(c.x-p.x,c.z-p.z)/6)*(p.kind==='sewage'?12:10+p.occupancy*.35),0)+wastePollution(c)+regionalPollution(regional.facilities,c)-green*.7));
    const landValue=Math.round(clamp(38+(supplied?10:-15)+recreation.lots[k].landValue+services.filter(s=>coverage[s]).length*10-pollution*.6-crimeLevel(city,k)*.12));
    lots[k]={network,supplied,pollution,landValue,coverage,growthReason:''};
  }
  const population=homes.reduce((v,c)=>v+c.occupancy,0),jobs=zones.filter(c=>c.kind!=='residential').reduce((v,c)=>v+c.occupancy,0)+regional.jobs;
  const housing=homes.reduce((v,c)=>v+c.level*12,0),commercial=zones.filter(c=>c.kind==='commercial').reduce((v,c)=>v+c.level*16,0),industry=zones.filter(c=>c.kind==='industrial').reduce((v,c)=>v+c.level*16,0);
  const pollution=Math.round(homes.reduce((v,c)=>v+lots[key(c.x,c.z)].pollution*Math.max(1,c.occupancy),0)/Math.max(1,homes.reduce((v,c)=>v+Math.max(1,c.occupancy),0)));
  const coverage=Object.fromEntries(services.map(s=>[s,population?Math.round(homes.reduce((v,c)=>v+(lots[key(c.x,c.z)].coverage[s]?c.occupancy:0),0)/population*100):0])) as Record<Service,number>;
  const unserved=zones.reduce((v,c)=>v+(lots[key(c.x,c.z)].supplied?0:c.occupancy),0);
  const waste=wasteSummary(city),crime=crimeSummary(city);
  const wellbeing=neighborhoodWellbeing(city,lots,recreation);
  const happiness=clamp(wellbeing.happiness+regional.happinessBonus,15,98);
  const demand={residential:clamp(68+jobs*.12-(housing-population)*.65-(city.tax-10)*5+(happiness-65)*.4),commercial:clamp(30+population*.6-commercial*.6+regional.commercialBonus),industrial:clamp(35+population*.45-industry*.5+regional.industrialBonus)};
  for(const c of zones){const l=lots[key(c.x,c.z)],n=l.network===undefined?undefined:networks[l.network];
    l.growthReason=c.upgrade?`Upgrade under construction · ${c.upgrade.remaining}s of active work remaining`:!l.supplied?'Utilities missing or overloaded':!resources.every(r=>n!.capacity[r]-n!.used[r]>=units(c,r))?'Utility capacity reached':happiness<=30?'Happiness too low':demand[c.kind]<15?'Low demand':c.kind==='residential'&&l.pollution>=70?'Heavy pollution':c.age<3?'Under construction':c.occupancy<c.level*(c.kind==='residential'?12:16)?'Welcoming occupants':c.level===3?'Fully developed':l.landValue<(c.level===1?48:65)?'Needs higher land value':c.level===2&&c.kind==='residential'&&!l.coverage.school?'Needs school coverage':c.kind==='residential'?(upgradeOffer(city,key(c.x,c.z),{supplied:l.supplied,landValue:l.landValue,school:l.coverage.school,happiness}).reasons[0]||'Ready for a material upgrade'):'Growing toward next level';
  }
  const capacity=emptyResources(),usage=emptyResources();for(const n of networks)for(const r of resources){capacity[r]+=n.capacity[r];usage[r]+=n.used[r];}
  const income=Math.round((population*2.8+jobs*3.5)*city.tax/10+regional.income),expenses=Math.round(all.filter(isFacilityRoot).reduce((v,c)=>v+(c.kind==='road'?(c.avenue?2.5:1.5):upkeep[c.kind]||0),0)+transitUpkeep(city.transit)+maintenanceUpkeep(city));
  const alerts:{text:string;tool:Kind}[]=[];
  if(unserved>0)alerts.push({text:`${unserved} residents / jobs lack reliable utilities`,tool:'power'});
  for(const r of resources)if(networks.some(n=>n.used[r]>0&&n.used[r]>=n.capacity[r]*.9))alerts.push({text:`${labels[r]} capacity is near its limit`,tool:r});
  if(population>=30&&coverage.clinic<70)alerts.push({text:'More residents need clinic coverage',tool:'clinic'});
  if(population>=30&&coverage.school<70)alerts.push({text:'School access can unlock better homes',tool:'school'});
  if(population>=30&&coverage.fire<70)alerts.push({text:'Expand fire protection to lower risk',tool:'fire'});
  if(crime.average>=25||crime.highRisk)alerts.unshift({text:'Crime is reducing neighborhood safety',tool:'police'});
  if(waste.overflow)alerts.unshift({text:`Garbage is overflowing at ${waste.overflow} lots`,tool:'recycling'});
  if(population>=30&&recreation.coverage<60)alerts.push({text:'More homes need nearby recreation',tool:'playground'});
  if(pollution>30)alerts.push({text:'Pollution is affecting residential lots',tool:'park'});
  return {wellbeing,regional,recreation,crime,waste,population,jobs,happiness,income,expenses,net:income-expenses,connected,networks,roadIds,lots,resources:{capacity,usage},coverage,pollution,unserved,alerts,demand,
    capacity:Math.min(...resources.map(r=>capacity[r])),consumption:population+jobs,served:Object.values(lots).filter(l=>l.supplied).length,
    roads:roads.length,buildings:all.filter(c=>isFacilityRoot(c)&&c.kind!=='road'&&(!isZone(c)||c.age>=3)).length,
    traffic:Math.min(95,Math.round((population+jobs)/Math.max(1,roads.reduce((n,c)=>n+(c.avenue?1.6:1),0))*3)),
    fireRisk:Math.round(clamp(60-coverage.fire*.45+pollution*.2)),health:Math.round(clamp(70+coverage.clinic*.25-pollution*.4))};
}

export function tick(city:City,mode:'both'|'day'|'development'='both'):City {
  const m=metrics(city),next:City={...city,day:city.day+(mode==='development'?0:1),cells:{...city.cells}};
  const remaining=m.networks.map(n=>Object.fromEntries(resources.map(r=>[r,Math.max(0,n.capacity[r]-n.used[r])])) as Record<Resource,number>);
  // Rotate allocation order each day so the same early lots do not always take capacity first.
  const zones=Object.entries(city.cells).filter(([,c])=>isZone(c)),offset=zones.length?city.day%zones.length:0;
  for(const [k,c] of (mode==='day'?[]:[...zones.slice(offset),...zones.slice(0,offset)])) {
    const l=m.lots[k],budget=l.network===undefined?undefined:remaining[l.network],kind=c.kind as Zone;
    const grow=l.supplied&&!!budget&&resources.every(r=>budget[r]>=units(c,r))&&m.happiness>30&&m.demand[kind]>=15&&!(kind==='residential'&&l.pollution>=70);
    const age=c.age+(grow?1:0);let level=c.level,occupancy=c.occupancy;
    if(!c.upgrade&&kind!=='residential'&&grow&&age>=45&&level===1&&l.landValue>=48)level=2;
    if(!c.upgrade&&kind!=='residential'&&grow&&age>=90&&level===2&&l.landValue>=65)level=3;
    const upgrade=c.upgrade||(level>c.level?createUpgrade('development',c.level+1):undefined);level=c.level;
    if(grow&&age>=3){const add=Math.max(0,Math.min(m.demand[kind]>=50?2:1,level*(kind==='residential'?12:16)-occupancy,...resources.map(r=>Math.floor(budget![r]/units(c,r)))));occupancy+=add;for(const r of resources)budget![r]-=add*units(c,r);}
    else if(!l.supplied||m.happiness<=30||(kind==='residential'&&l.pollution>=70))occupancy=Math.max(0,occupancy-1);
    next.cells[k]={...c,age,level,occupancy,...(upgrade?{upgrade}:{})};
  }
  if(mode==='development')return next;
  next.waste=wasteDay(city,new Set(Object.entries(m.lots).filter(([,lot])=>lot.supplied).map(([k])=>k)));
  next.crime=crimeDay(city,new Set(Object.entries(m.lots).filter(([,lot])=>lot.supplied).map(([k])=>k)));
  if(m.regional.facilities.length||city.regional)next.regional={passengers:Math.min(Number.MAX_SAFE_INTEGER,(city.regional?.passengers||0)+m.regional.passengers),cargo:Math.min(Number.MAX_SAFE_INTEGER,(city.regional?.cargo||0)+m.regional.cargo)};
  next.money+=m.net/30;return next;
}

export function build(city:City,tool:string,points:{x:number;z:number}[]):{city:City;message:string;ok:boolean} {
  const reject=(message:string)=>({city,message,ok:false});
  if(!Object.hasOwn(price,tool))return reject('Choose a construction tool.');
  const locked=buildingLock(city,tool);if(locked)return reject(locked);
  let unique=[...new Map(points.map(p=>[key(p.x,p.z),p])).values()];
  if(isRegional(tool)){
    if(unique.length!==1)return reject('Place one regional facility at a time.');
    const origin=unique[0],problem=regionalPlacementProblem(city,tool,origin);if(problem)return reject(problem);
    if(city.money<price[tool])return reject('Not enough funds for this project.');
    const cells={...city.cells},root=key(origin.x,origin.z);
    for(const p of regionalFootprint(tool,origin))cells[key(p.x,p.z)]={...p,kind:tool,age:0,level:1,occupancy:0,regionalRoot:root};
    return {city:{...city,cells,money:city.money-price[tool]},message:regionalConfig[tool].name+' placed · $'+price[tool].toLocaleString(),ok:true};
  }
  if(isRecreation(tool)){
    if(unique.length!==1)return reject('Place one recreation facility at a time.');
    const origin=unique[0],footprint=recreationFootprint(tool,origin);
    if(tool==='waterpark'&&!coastalLand({x:origin.x+1,z:origin.z}))return reject('Place the water park near the coast.');
    if(footprint.some(p=>!validLand(p.x,p.z)))return reject('The entire recreation area must fit on buildable land.');
    if(footprint.some(p=>city.cells[key(p.x,p.z)]))return reject('The recreation area needs an entirely empty footprint.');
    if(!recreationRoadAccess(city,tool,origin))return reject('Connect any edge of the recreation area to a road.');
    if(city.money<price[tool])return reject('Not enough funds for this project.');
    const cells={...city.cells},root=key(origin.x,origin.z);
    for(const p of footprint)cells[key(p.x,p.z)]={...p,kind:tool,age:0,level:1,occupancy:0,recreationRoot:root};
    return {city:{...city,money:city.money-price[tool],cells},message:recreationConfig[tool].name+' placed · $'+price[tool].toLocaleString(),ok:true};
  }
  if(tool==='bulldoze'){
    const expanded=new Map(unique.map(p=>[key(p.x,p.z),p]));
    for(const p of unique){const cell=city.cells[key(p.x,p.z)];if(cell&&isRecreation(cell.kind)){const root=city.cells[cell.recreationRoot||key(cell.x,cell.z)];if(root)for(const part of recreationFootprint(cell.kind,root))expanded.set(key(part.x,part.z),part);}}
    for(const p of unique){const cell=city.cells[key(p.x,p.z)];if(cell&&isRegional(cell.kind)){const root=city.cells[cell.regionalRoot||''];if(root)for(const part of regionalFootprint(cell.kind,root))expanded.set(key(part.x,part.z),part);}}
    unique=[...expanded.values()];
  }
  if(unique.some(p=>!validLand(p.x,p.z)))return reject('Choose buildable land, away from the shoreline.');
  if(isCoastal(tool)&&unique.some(p=>!coastalLand(p)))return reject('Coastal buildings need buildable land within 42 m of the shoreline.');
  if((tool==='road'||tool==='avenue')&&unique.some(p=>city.cells[key(p.x,p.z)]&&city.cells[key(p.x,p.z)].kind!=='road'))return reject('A building blocks this route. Clear it or choose another path.');
  const eligible=unique.filter(p=>tool==='bulldoze'?!!city.cells[key(p.x,p.z)]:!city.cells[key(p.x,p.z)]);
  if(!eligible.length)return reject('This space is already occupied.');
  if(!['road','avenue','bulldoze'].includes(tool)&&eligible.some(p=>!adjacentRoad(city,p)))return reject('Place lots directly beside a road.');
  if(tool==='bulldoze'&&eligible.some(p=>city.cells[key(p.x,p.z)]?.upgrade))return reject('Finish the active upgrade before demolishing this building.');
  if(tool==='bulldoze'&&eligible.some(p=>hasFactoryWork(city,key(p.x,p.z))))return reject('Collect or cancel this factory’s queued batches before demolition.');
  if(tool==='maintenance'&&Object.values(city.cells).filter(c=>c.kind==='maintenance').length+eligible.length>8)return reject('This city supports up to eight maintenance depots.');
  if(tool==='police'&&Object.values(city.cells).filter(c=>c.kind==='police').length+eligible.length>8)return reject('This town supports up to eight police stations.');
  if(isWasteFacility(tool)&&Object.values(city.cells).filter(c=>isWasteFacility(c.kind)).length+eligible.length>8)return reject('This town supports up to eight waste facilities.');
  if(tool==='bulldoze'&&eligible.some(p=>isWasteFacility(city.cells[key(p.x,p.z)]?.kind||'')&&(city.waste?.stored[key(p.x,p.z)]||0)>0))return reject('Clear stored waste from the Garbage collection desk before demolishing this facility.');
  const charged=tool==='bulldoze'?new Set(eligible.map(p=>city.cells[key(p.x,p.z)]?.regionalRoot||city.cells[key(p.x,p.z)]?.recreationRoot||key(p.x,p.z))).size:eligible.length;
  const cost=charged*price[tool];if(city.money<cost)return reject('Not enough funds for this project.');
  const cells={...city.cells};for(const p of eligible){if(tool==='bulldoze')delete cells[key(p.x,p.z)];else cells[key(p.x,p.z)]={...p,kind:isCoastal(tool)?coastalConfig[tool].zone:tool==='avenue'?'road':tool as Cell['kind'],...(isCoastal(tool)?{coastal:tool}:{}),avenue:tool==='avenue',age:0,level:1,occupancy:0};}
  return {city:{...city,money:city.money-cost,cells},message:tool==='bulldoze'?`Cleared ${eligible.length} lots`:`${eligible.length} ${tool==='road'||tool==='avenue'?'road sections':'lots'} placed · $${cost.toLocaleString()}`,ok:true};
}

export type Construction={before:Record<string,Cell|undefined>;cost:number};
export function constructionChange(before:City,after:City):Construction {
  const changed:Construction['before']={};for(const k of new Set([...Object.keys(before.cells),...Object.keys(after.cells)]))if(before.cells[k]!==after.cells[k])changed[k]=before.cells[k];
  return {before:changed,cost:before.money-after.money};
}
export function undoConstruction(city:City,change:Construction):City {if(Object.keys(change.before).some(k=>city.cells[k]?.upgrade||change.before[k]?.upgrade||hasFactoryWork(city,k)||(city.cells[k]?.factoryTier||1)>(change.before[k]?.factoryTier||1)||city.cells[k]?.kind==='residential'&&city.cells[k].level>(change.before[k]?.level||1)))return city;if(Object.keys(change.before).some(k=>isWasteFacility(city.cells[k]?.kind||'')&&(city.waste?.stored[k]||0)>0))return city;const cells={...city.cells};for(const [k,c]of Object.entries(change.before)){if(c)cells[k]=c;else delete cells[k];}return {...city,cells,money:city.money+change.cost};}

export function decodeCity(value:unknown):City {
  if(!value||typeof value!=='object')throw new Error('Invalid city file.');const c=value as City;
  if(c.version!==1||typeof c.name!=='string'||c.name.length>28||!Number.isFinite(c.money)||!Number.isInteger(c.day)||c.day<0||!Number.isFinite(c.tax)||c.tax<5||c.tax>20||!c.cells||typeof c.cells!=='object'||Array.isArray(c.cells)||Object.keys(c.cells).length>1521)throw new Error('Invalid or unsupported city save.');
  for(const [k,lot]of Object.entries(c.cells)){if(!lot||!validLand(lot.x,lot.z)||k!==key(lot.x,lot.z)||!['road',...Object.keys(zoneColors)].includes(lot.kind)||!Number.isInteger(lot.age)||lot.age<0||!Number.isInteger(lot.level)||lot.level<1||lot.level>3||!Number.isInteger(lot.occupancy)||lot.occupancy<0||lot.occupancy>48)throw new Error('City save contains an invalid lot.');}
  for(const lot of Object.values(c.cells))if(lot.factoryTier!==undefined&&(lot.kind!=='industrial'||!Number.isInteger(lot.factoryTier)||lot.factoryTier<1||lot.factoryTier>3))throw new Error('Invalid factory tier.');
  for(const lot of Object.values(c.cells))if(lot.coastal!==undefined&&(!isCoastal(lot.coastal)||coastalConfig[lot.coastal].zone!==lot.kind||!coastalLand(lot)))throw Error('Invalid coastal building.');
  validateRecreation(c);validateRegional(c);
  const production=decodeProduction(c.production,c);
  for(const lot of Object.values(c.cells))validateUpgrade(lot,{...c,production});
  const crime=decodeCrime(c.crime);if(crime&&Object.values(crime.lots).some(l=>l.lastPatrol!==undefined&&l.lastPatrol>c.day))throw new Error('Patrol date is ahead of the city date.');
  return {version:1,...(c.maintenance!==undefined?{maintenance:decodeMaintenance(c.maintenance)}:{}),...(c.climate!==undefined?{climate:decodeClimate(c.climate)}:{}),...(c.regional!==undefined?{regional:{...c.regional}}:{}),progression:decodeProgression(c.progression,{...c,production}),...(production!==undefined?{production}:{}),...(crime!==undefined?{crime}:{}),name:c.name,money:c.money,day:c.day,tax:c.tax,cells:c.cells,seed:Number.isFinite(c.seed)?c.seed:21,...(c.waste!==undefined?{waste:decodeWaste(c.waste)}:{}),...(c.transit!==undefined?{transit:decodeTransit(c.transit)}:{})};
}

export function homeUpgradeStatus(city:City,k:string){const m=metrics(city),l=m.lots[k];return upgradeOffer(city,k,{supplied:l?.supplied||false,landValue:l?.landValue||0,school:l?.coverage.school||false,happiness:m.happiness});}
export function upgradeHome(city:City,k:string){const m=metrics(city),l=m.lots[k];return applyHomeUpgrade(city,k,{supplied:l?.supplied||false,landValue:l?.landValue||0,school:l?.coverage.school||false,happiness:m.happiness});}

export function createCity(demo=true,name='Harborlight'):City{const city:City={version:1,name,money:60000,day:0,tax:10,cells:{},seed:21,progression:emptyProgression()};if(!demo)return city;
const add=(x:number,z:number,kind:Cell['kind'],age=45)=>city.cells[key(x,z)]={x,z,kind,age,level:age>45?2:1,occupancy:kind==='residential'?12:kind==='commercial'||kind==='industrial'?16:0};
for(let x=-11;x<=8;x++)for(const z of [-8,-2,4,10])add(x,z,'road');for(let z=-8;z<=10;z++)for(const x of [-11,-5,2,8])add(x,z,'road');
for(let x=-10;x<=7;x++)for(const z of [-7,-3,-1,3,5,9])if(!city.cells[key(x,z)]&&(x+z)%4!==0){const kind:Kind=x>3?'industrial':z<0?'residential':'commercial';add(x,z,kind,Math.abs(x*17+z*11)%75+5);}
add(-12,-7,'utility');add(-12,3,'utility');add(9,9,'utility');add(0,5,'park');add(-12,-1,'school');add(-12,5,'clinic');add(9,3,'fire');add(-7,-1,'park');add(-4,-7,'park');city.money=48000;city.day=16;city.progression!.legacyBuildings=['school'];return city;}

export function findRoute(city:City,start:string,end:string):string[]{const previous=new Map<string,string|null>([[start,null]]),q=[start];for(let i=0;i<q.length;i++){if(q[i]===end)break;const c=city.cells[q[i]];if(!c)continue;for(const [x,z]of neighbors(c.x,c.z)){const k=key(x,z);if(city.cells[k]?.kind==='road'&&!previous.has(k)){previous.set(k,q[i]);q.push(k);}}}if(!previous.has(end))return[];const path:string[]=[];for(let cur:string|null=end;cur!==null;cur=previous.get(cur)??null)path.unshift(cur);return path;}
