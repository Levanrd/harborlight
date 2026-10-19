// Disposable browser-QA city. Run with tsx, then import on an isolated local origin.
import {writeFileSync} from 'node:fs';
import {build,createCity,roadPath,metrics,decodeCity} from '../src/simulation';
import {coastalPort} from '../src/regional';
let city=createCity(true,'Regional test harbor');city={...city,money:200000,progression:{xp:1000,legacyBuildings:[],legacyMaterials:[]}};
function place(kind:string,points:{x:number;z:number}[]){const result=build(city,kind,points);if(!result.ok)throw new Error(`${kind}: ${result.message}`);city=result.city;}
place('road',roadPath({x:-11,z:-16},{x:-11,z:-8}));place('airport',[{x:-10,z:-16}]);
place('road',roadPath({x:-5,z:-8},{x:-5,z:-9}));place('road',roadPath({x:-5,z:-9},{x:0,z:-9}));place('railway',[{x:-3,z:-11}]);
let port:{x:number;z:number}|undefined;
for(let z=12;z<=16&&!port;z++)for(let x=8;x<=12&&!port;x++)if(coastalPort({x,z}))port={x,z};
if(!port)throw Error('No shore site');place('road',roadPath({x:8,z:10},{x:port.x-1,z:port.z}));place('seaport',[port]);
decodeCity(city);writeFileSync('tools/regional-fixture.json',JSON.stringify(city,null,2));
console.log(JSON.stringify({port,facilities:metrics(city).regional.facilities.map(f=>({kind:f.kind,key:f.key,status:f.status,daily:f.daily})),money:city.money}));
