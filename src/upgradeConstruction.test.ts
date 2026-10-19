import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCity,decodeCity,build,tick,undoConstruction,type City} from './simulation';
import {applyHomeUpgrade,emptyProduction,queueProduction} from './production';
import {upgradeFactory,factoryType} from './progression';
import {constructionSecond,createUpgrade,upgradePhase} from './upgradeConstruction';
import {advanceCityClock,emptyClock} from './gameClock';
import {sceneSignature} from './sceneSignature';
import {ConstructionSites} from './ConstructionSites';
import type {VisualKit} from './cityVisuals';
const conditions={supplied:true,landValue:90,school:true,happiness:90};
function fixture(){const c=createCity(false);c.progression!.xp=1000;c.production={...emptyProduction(),inventory:{wood:8,metal:8,stone:8,planks:8,nails:8,bricks:8}};
  for(let x=-2;x<=2;x++)c.cells[`${x},0`]={x,z:0,kind:'road',level:1,age:50,occupancy:0};
  c.cells['-2,1']={x:-2,z:1,kind:'utility',level:1,age:50,occupancy:0};
  c.cells['0,1']={x:0,z:1,kind:'residential',level:1,age:50,occupancy:12};
  c.cells['2,1']={x:2,z:1,kind:'industrial',level:1,age:10,occupancy:16};return c;}
const work=(c:City,n:number)=>{for(let i=0;i<n;i++)c=constructionSecond(c,new Set(Object.keys(c.cells)));return c;};
test('home construction charges once, retains old capacity and awards XP only at handover',()=>{
  const original=fixture(),pending=applyHomeUpgrade(original,'0,1',conditions).city;
  assert.equal(pending.money,original.money-300);assert.equal(pending.production!.inventory.planks,6);
  assert.equal(pending.cells['0,1'].level,1);assert.equal(pending.progression!.xp,1000);
  assert.equal(applyHomeUpgrade(pending,'0,1',conditions).city,pending);
  const almost=work(pending,19);assert.equal(almost.cells['0,1'].level,1);
  const complete=work(almost,1);assert.equal(complete.cells['0,1'].level,2);assert.equal(complete.cells['0,1'].occupancy,12);assert.equal(complete.progression!.xp,1100);assert.equal(complete.production!.upgrades,1);assert.equal(complete.cells['0,1'].upgrade,undefined);
  assert.equal(work(complete,100),complete);
});
test('construction resumes saved progress, rejects malformed timers and protects prepaid projects',()=>{
  const c=work(applyHomeUpgrade(fixture(),'0,1',conditions).city,7),saved=decodeCity(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(saved,c);assert.equal(constructionSecond(c,new Set()),c);
  assert.equal(build(c,'bulldoze',[{x:0,z:1}]).city,c);
  assert.equal(undoConstruction(c,{before:{'0,1':undefined},cost:20}),c);
  assert.equal(work(saved,13).cells['0,1'].level,2);
  for(const patch of [{remaining:0},{remaining:2.5},{remaining:99},{duration:1},{target:3},{kind:'factory'}])assert.throws(()=>decodeCity({...c,cells:{...c.cells,'0,1':{...c.cells['0,1'],upgrade:{...c.cells['0,1'].upgrade,...patch}}}}));
});
test('factory expansion retains batches and current slots until the timed handover',()=>{
  const queued=queueProduction(fixture(),'2,1','wood',true).city,pending=upgradeFactory(queued,'2,1').city;
  assert.deepEqual(pending.production,queued.production);assert.equal(factoryType(pending,'2,1').slots,3);
  assert.equal(upgradeFactory(pending,'2,1').city,pending);
  const complete=work(pending,30);assert.equal(factoryType(complete,'2,1').slots,4);assert.deepEqual(complete.production,queued.production);
});
test('calendar pace never changes project duration; pause freezes construction and factory goods stay fast',()=>{
  for(const daySeconds of [120,300] as const){let city=applyHomeUpgrade(fixture(),'0,1',conditions).city;city=queueProduction(city,'2,1','wood',true).city;let clock={...emptyClock(),daySeconds};
    assert.equal(advanceCityClock(city,clock,0).city,city);
    for(let i=0;i<40;i++)({city,clock}=advanceCityClock(city,clock,.1));assert.equal(city.production!.queues['2,1'][0].remaining,0);assert.equal(city.cells['0,1'].upgrade!.remaining,16);
    for(let i=0;i<160;i++)({city,clock}=advanceCityClock(city,clock,.1));assert.equal(city.cells['0,1'].level,2);assert.equal(city.cells['0,1'].upgrade,undefined);
  }
});
test('automatic development uses a project and only phase changes rebuild scenery',()=>{
  let c=fixture();c.cells['2,1']={...c.cells['2,1'],kind:'commercial',age:90};c=tick(c,'development');assert.ok(c.cells['2,1'].upgrade);assert.equal(c.cells['2,1'].level,1);
  const first=sceneSignature({city:c,overlay:'none'}),second=sceneSignature({city:work(c,1),overlay:'none'});assert.equal(first,second);
  const middle=work(c,8);assert.equal(upgradePhase(middle.cells['2,1'].upgrade!),1);assert.notEqual(first,sceneSignature({city:middle,overlay:'none'}));
});
test('scaffolds and hoists fit within the lot in every construction stage and release batches',()=>{
  const scene=new THREE.Scene(),geo=new THREE.BoxGeometry(),cylinder=new THREE.CylinderGeometry(1,1,1,12),mat=new THREE.MeshStandardMaterial();
  const kit:VisualKit={material:()=>mat,tree:()=>{},roof:geo,cylinder,box:(g,x,y,z,w,h,d)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y+h/2,z);m.scale.set(w,h,d);g.add(m);return m;}};
  const sites=new ConstructionSites(scene,kit),c=fixture().cells['0,1'];
  for(const remaining of [20,10,3]){const g=new THREE.Group(),cell={...c,upgrade:{...createUpgrade('home',2),remaining}};sites.begin();sites.draw(cell,g,24);sites.end();scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);assert.ok(bounds.min.x>=-4&&bounds.max.x<=4);assert.ok(bounds.min.z>=4&&bounds.max.z<=12);assert.ok(scene.children.length>0);}
  sites.begin();sites.end();sites.dispose();assert.equal(scene.children.length,0);geo.dispose();cylinder.dispose();mat.dispose();
});
