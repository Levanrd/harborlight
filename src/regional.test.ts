import {RegionalDetails} from './regionalDetails';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build,metrics,tick,decodeCity,constructionChange,undoConstruction,roadPath,key,type City} from './simulation';
import {unlockedCity} from './testCity';
import {regionalConfig,regionalTypes,regionalFootprint,coastalPort,type RegionalKind} from './regional';
import {createRegionalActor,animateRegionalActor} from './regionalModels';
import * as THREE from 'three';
import {disposeBatches,type VisualKit} from './cityVisuals';

function portSite(){for(let z=-12;z<16;z++)for(let x=6;x<13;x++)if(coastalPort({x,z}))return{x,z};throw Error('No port site');}
function foundation(kind:RegionalKind){
  const origin=kind==='seaport'?portSite():{x:-5,z:1};
  let c:City={...unlockedCity(false),money:200000};
  const road={x:origin.x-1,z:origin.z};c=build(c,'road',roadPath({x:road.x,z:road.z-4},road)).city;
  c=build(c,'utility',[{x:road.x-1,z:road.z-4}]).city;
  for(const [kind,z]of [['residential',road.z-3],['industrial',road.z-2]] as const){const x=road.x-1;c=build(c,kind,[{x,z}]).city;c={...c,cells:{...c.cells,[key(x,z)]:{...c.cells[key(x,z)],occupancy:36,level:3,age:50}}};}
  return {city:c,origin,road};
}
test('regional footprints charge once, use utilities once and report one operational facility',()=>{
  for(const kind of regionalTypes){const {city,origin}=foundation(kind),result=build(city,kind,[origin]),cfg=regionalConfig[kind];assert.ok(result.ok,result.message);const before=metrics(city),after=metrics(result.city);
    assert.equal(city.money-result.city.money,cfg.cost);assert.equal(after.expenses-before.expenses,cfg.upkeep);assert.equal(after.buildings-before.buildings,1);assert.equal(after.regional.facilities.length,1);assert.equal(after.regional.jobs,cfg.jobs);
    for(const r of ['power','water','sewage'] as const)assert.equal(after.resources.usage[r]-before.resources.usage[r],cfg.utilities[r]);
    for(const p of regionalFootprint(kind,origin))assert.equal(after.lots[key(p.x,p.z)].supplied,true);
    assert.ok(after.regional.income>0);assert.ok(after.regional.passengers+after.regional.cargo>0);
  }
});
test('locked facilities, occupied parcels, inland ports, missing roads, funds and map edges reject atomically',()=>{
  for(const kind of regionalTypes){const {city,origin}=foundation(kind);const locked={...city,progression:{xp:0,legacyBuildings:[],legacyMaterials:[]}};
    for(const [c,p]of [[locked,origin],[{...city,money:1},origin],[city,{x:19,z:19}],[city,{x:-14,z:7}]] as const){const r=build(c,kind,[p]);assert.equal(r.ok,false);assert.equal(r.city,c);}
    const built=build(city,kind,[origin]).city;assert.equal(build(built,kind,[origin]).ok,false);assert.equal(build(city,kind,[origin,{x:origin.x+1,z:origin.z}]).ok,false);
  }
  const {city}=foundation('airport');assert.match(build(city,'seaport',[{x:-5,z:1}]).message,/shoreline/);
});
test('road removal and utility overload suspend fees, jobs and benefits while upkeep remains',()=>{
  for(const kind of regionalTypes){const {city,origin,road}=foundation(kind),built=build(city,kind,[origin]).city,cut=build(built,'bulldoze',[road]).city;
    assert.equal(metrics(cut).regional.income,0);assert.equal(metrics(cut).regional.jobs,0);assert.equal(metrics(cut).regional.upkeep,regionalConfig[kind].upkeep);
    assert.equal(metrics(cut).regional.commercialBonus+metrics(cut).regional.industrialBonus+metrics(cut).regional.happinessBonus,0);
    assert.equal(metrics(build(cut,'road',[road]).city).regional.facilities[0].active,true);
    const overloaded={...built,cells:Object.fromEntries(Object.entries(built.cells).filter(([,c])=>c.kind!=='utility'))};assert.equal(metrics(overloaded).regional.income,0);
  }
});
test('regional facilities attach to one perimeter network and cannot bridge unrelated utility networks',()=>{
  let c:City={...unlockedCity(false),money:200000};for(const p of [{x:-1,z:0},{x:4,z:0}])c=build(c,'road',[p]).city;
  c=build(c,'power',[{x:-2,z:0}]).city;c=build(c,'water',[{x:5,z:0}]).city;c=build(c,'sewage',[{x:4,z:-1}]).city;
  c=build(c,'railway',[{x:0,z:0}]).city;assert.equal(metrics(c).regional.facilities[0].active,false);assert.equal(metrics(c).networks.length,2);
});
test('daily fees and throughput settle once, save totals round-trip, and service loss stops throughput',()=>{
  const {city,origin,road}=foundation('airport'),built=build(city,'airport',[origin]).city,m=metrics(built),next=tick(built);
  assert.equal(next.regional?.passengers,m.regional.passengers);assert.equal(next.regional?.cargo,0);assert.ok(Math.abs(next.money-built.money-m.net/30)<1e-7);
  assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(next))),next);
  const cut=build(next,'bulldoze',[road]).city;assert.equal(tick(cut).regional?.passengers,next.regional?.passengers);
});
test('extra stations share a bounded passenger market and pollution is local',()=>{
  const {city,origin}=foundation('railway'),one=build(city,'railway',[origin]).city;
  let two=build(one,'road',roadPath({x:-6,z:1},{x:-6,z:7})).city;two=build(two,'railway',[{x:-5,z:6}]).city;
  assert.equal(metrics(two).regional.facilities.length,2);assert.ok(metrics(two).regional.passengers<=metrics(one).regional.passengers);assert.ok(metrics(two).regional.happinessBonus<=3);
  const a=foundation('airport'),before=metrics(a.city),after=metrics(build(a.city,'airport',[a.origin]).city),near=key(a.road.x-1,a.road.z-2);
  assert.ok(after.lots[near].pollution>before.lots[near].pollution);
});
test('demolishing any member clears one complete facility and both construction and demolition undo restore it',()=>{
  for(const kind of regionalTypes){const {city,origin}=foundation(kind),built=build(city,kind,[origin]).city,points=regionalFootprint(kind,origin),clear=build(built,'bulldoze',[points.at(-1)!,points[1]]).city;
    assert.equal(built.money-clear.money,20);assert.equal(metrics(clear).regional.facilities.length,0);assert.deepEqual(undoConstruction(clear,constructionChange(built,clear)),built);assert.deepEqual(undoConstruction(built,constructionChange(city,built)),city);
    assert.equal(build(built,'road',[points[1]]).ok,false);
  }
});
test('save validation rejects incomplete, forged or misplaced regional footprints and invalid totals',()=>{
  for(const kind of regionalTypes){const {city,origin}=foundation(kind),built=build(city,kind,[origin]).city;assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(built))),built);
    const missing=structuredClone(built);delete missing.cells[key(origin.x+1,origin.z)];assert.throws(()=>decodeCity(missing));
    const forged=structuredClone(built);forged.cells[key(origin.x-1,origin.z)].regionalRoot=key(origin.x,origin.z);assert.throws(()=>decodeCity(forged));
    for(const regional of [{passengers:-1,cargo:0},{passengers:1.5,cargo:0},{passengers:0,cargo:Infinity}])assert.throws(()=>decodeCity({...built,regional}));
  }
  const legacy=unlockedCity();assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(legacy))),legacy);
});
test('decorative regional vehicles freeze when paused or disconnected and move only with service time',()=>{
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();const kit:VisualKit={material:()=>material,tree:()=>{},roof:geometry,cylinder:geometry,box:(g,x,y,z,w,h,d)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y+h/2,z);m.scale.set(w,h,d);g.add(m);return m;}};
  const details=new RegionalDetails(kit);for(const kind of regionalTypes){const actor=createRegionalActor({x:0,z:0,kind,age:0,occupancy:0,level:1},kit,details);animateRegionalActor(actor,0,true);const before=actor.group.position.clone();animateRegionalActor(actor,10,false);assert.equal(actor.time,0);assert.deepEqual(actor.group.position,before);animateRegionalActor(actor,40,true);assert.equal(actor.time,40);assert.notDeepEqual(actor.group.position,before);const moving=actor.group.position.clone();animateRegionalActor(actor,0,true);assert.deepEqual(actor.group.position,moving);disposeBatches(actor.group);}details.dispose();
  geometry.dispose();material.dispose();
});
