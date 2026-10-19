import {createCity,build,key,validLand,adjacentRoad,decodeCity,type Cell,type City} from './simulation';
import {coastalLand} from './coastal';
import {placeStop,addRoute,transitPath} from './transit';
import {emptyProduction,queueProduction,type Material} from './production';
import {emptyWaste} from './waste';

/** The single playable master plan; retired saves are archived by cityStorage. */
export function createMasterplan():City {
  let city=createCity(false,'Harborlight Bay');
  city={...city,money:2000000,day:120,progression:{xp:1000,legacyBuildings:[],legacyMaterials:[]}};
  const put=(x:number,z:number,kind:Cell['kind'],level=1)=>{
    if(!validLand(x,z)||city.cells[key(x,z)])throw Error(`Coastal collision ${x},${z}`);
    city.cells[key(x,z)]={x,z,kind,level,age:120,occupancy:0,...(kind==='road'?{avenue:x===0||z===8}:{})};
  };
  const road=(x:number,z:number)=>{if(validLand(x,z)&&!city.cells[key(x,z)])put(x,z,'road');};
  for(let z=-12;z<=18;z++)for(const x of [-18,-12,-6,0,6,10])road(x,z);
  for(let x=-18;x<=10;x++)for(const z of [-8,-4,2,8,10,14,18])road(x,z);
  for(let z=-18;z<-12;z++)road(-18,z);
  // Rail and airport share the northern approach; housing starts beyond the airport buffer.
  for(let x=-12;x<=0;x++)road(x,-13);
  const facility=(kind:string,x:number,z:number)=>{const r=build(city,kind,[{x,z}]);if(!r.ok)throw Error(`${kind} ${x},${z}: ${r.message}`);city=r.city;};
  facility('airport',-17,-18);facility('railway',-11,-12);facility('seaport',11,12);
  facility('sports',-17,-11);
  facility('waterpark',7,-12);
  for(const x of [-17,-11,-5,1,7])facility('largepark',x,4);
  for(const x of [-17,-11,-5,1])facility('playground',x,-3);
  for(const x of [-13,-7,-1])facility('park',x,-9);
  facility('park',11,-3);
  put(-17,9,'utility');put(-15,9,'maintenance');put(3,9,'maintenance');
  // A distributed collection row serves the city across the greenbelt, away from homes.
  for(const x of [-13,-7,-1,5])put(x,9,'recycling');
  for(const x of [-17,-11,-5,1]){
    for(const z of [-7,1])for(const [dx,kind]of [[0,'school'],[1,'clinic'],[2,'fire']] as const)put(x+dx,z,kind);
    put(x+3,-7,'police');
  }
  put(9,-7,'clinic');put(9,1,'school');put(7,1,'fire');put(7,-7,'police');
  // Industrial/waste campus is beyond a six-lot landscaped separation belt.
  for(const x of [-17,-11,-5,1,7])put(x,17,'recycling');
  put(9,17,'landfill');
  const sites:{x:number;z:number}[]=[];
  for(let z=11;z<=17;z++)for(let x=-17;x<=9;x++)if(!city.cells[key(x,z)]&&adjacentRoad(city,{x,z}))sites.push({x,z});
  for(let i=0;i<39;i++){const p=sites[i];put(p.x,p.z,(['power','water','sewage'] as const)[i%3]);}
  for(let z=-11;z<=1;z++)for(let x=7;x<=12;x++){
    if(city.cells[key(x,z)]||!coastalLand({x,z})||!adjacentRoad(city,{x,z}))continue;
    const variant=z%4===0?'resort':z<-5?'beachhouse':'beachresidential';
    facility(variant,x,z);const c=city.cells[key(x,z)];c.age=120;c.level=variant==='beachhouse'?1:2;c.occupancy=c.level*(c.kind==='residential'?12:16);
  }
  for(let z=-7;z<=17;z++)for(let x=-17;x<=9;x++){
    if(!validLand(x,z)||city.cells[key(x,z)]||!adjacentRoad(city,{x,z})||z>=3&&z<=9)continue;
    // Coast parcels remain open for more leisure development.
    if(x>=7&&z<10)continue;
    const kind=z>=11?'industrial':x>=1?'commercial':'residential',variant=Math.abs(x*31+z*17)%6;
    const level=kind==='residential'?(x<-12?1+variant%2:2+variant%2):kind==='industrial'?2:x>=3&&z>=-3?3:1+variant%2;
    put(x,z,kind,level);const c=city.cells[key(x,z)];c.occupancy=level*(kind==='residential'?12:16);if(kind==='industrial')c.factoryTier=1+variant%3;
  }
  for(const [name,stops]of [
    ['Neighborhood shuttle',['-18,-4','-12,-4','-6,-4','0,-4','6,-4','10,-4']],
    ['Seabreeze line',['10,-8','10,-4','10,2','10,8']],
    ['Works connector',['0,-8','0,-4','0,2','0,8','0,14','0,18']],
    ['Airport and rail',['-18,-18','-18,-13','-12,-13','-6,-13','-6,-8']],
  ] as const){
    for(const k of stops)if(!city.transit?.stops.some(s=>s.key===k))city=placeStop(city,k).city;
    const path=stops.slice(1).reduce<string[]>((p,k)=>[...p,...transitPath(city,p.at(-1)!,k).slice(1)],[stops[0]]);
    const r=addRoute(city,path,name,3);if(r.city===city)throw Error(r.message);city=r.city;
  }
  city={...city,production:emptyProduction(),waste:emptyWaste()};
  city.production!.inventory={wood:8,metal:8,stone:8,planks:8,nails:8,bricks:8};
  const factories=Object.entries(city.cells).filter(([,c])=>c.kind==='industrial');
  for(let i=0;i<6;i++)city=queueProduction(city,factories[i][0],(['wood','metal','stone','planks','nails','bricks'] as Material[])[i],true).city;
  city.production!.queues[factories[0][0]][0].remaining=0;
  city.money=650000;
  return decodeCity(city);
}
