import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlaceVisuals} from './placeVisuals';
import {batchScenery,disposeBatches,type VisualKit} from './cityVisuals';
import type {Cell} from './simulation';

function fixture(){const scene=new THREE.Scene(),box=new THREE.BoxGeometry(),cylinder=new THREE.CylinderGeometry(1,1,1,24),material=new THREE.MeshStandardMaterial();const kit:VisualKit={material:()=>material,tree:()=>{},roof:box,cylinder,box:(g,x,y,z,w,h,d)=>{const m=new THREE.Mesh(box,material);m.position.set(x,y+h/2,z);m.scale.set(w,h,d);g.add(m);return m;}};const places=new PlaceVisuals(scene,kit);return {scene,places,dispose(){places.dispose();box.dispose();cylinder.dispose();material.dispose();}};}
test('detailed public facilities and parks stay within their purchased parcels and preserve picking',()=>{
  const f=fixture();
  for(const kind of ['police','clinic','fire','school','utility','power','water','sewage','recycling','park','playground','sports','largepark'] as const){
    f.places.beginRebuild();const g=new THREE.Group(),c:Cell={x:0,z:0,kind,level:1,age:40,occupancy:20};g.userData.cell='0,0';const before=JSON.stringify(c);
    const park=['park','playground','sports','largepark'].includes(kind);if(park)f.places.park(c,g);else assert.equal(f.places.facility(c,g),true);
    const bounds=new THREE.Box3().setFromObject(g),width=kind==='largepark'||kind==='sports'?3:kind==='playground'?2:1,depth=kind==='largepark'?3:kind==='playground'||kind==='sports'?2:1;
    assert.ok(bounds.min.x>=-4&&bounds.max.x<=width*8-4,`${kind} horizontal clearance ${bounds.min.x},${bounds.max.x}`);
    assert.ok(bounds.min.z>=-4&&bounds.max.z<=depth*8-4,`${kind} depth clearance ${bounds.min.z},${bounds.max.z}`);
    batchScenery(g);assert.ok(g.children.every(o=>o.userData.lots.every((k:string)=>k==='0,0')));assert.equal(JSON.stringify(c),before);disposeBatches(g);
  }f.dispose();
});
test('animated place details batch together, pause at a fixed time, and release replaced instances',()=>{
  const f=fixture(),g=new THREE.Group();f.places.beginRebuild();f.places.park({x:0,z:0,kind:'largepark',level:1,age:40,occupancy:0},g);f.places.endRebuild();f.places.update(1);
  const matrices=()=>{const result:number[]=[];f.scene.traverse(o=>{if(o instanceof THREE.InstancedMesh)result.push(...o.instanceMatrix.array);});return result;};const first=matrices();assert.ok(first.length>0&&first.every(Number.isFinite));f.places.update(1);assert.deepEqual(matrices(),first);f.places.update(2);assert.notDeepEqual(matrices(),first);f.places.update(2,true);const reduced=matrices();f.places.update(3,true);assert.deepEqual(matrices(),reduced);
  f.places.beginRebuild();f.places.endRebuild();assert.equal(matrices().length,0);f.dispose();assert.equal(f.scene.children.length,0);
});

test('coastal architecture and water parks stay inside their purchased parcels',()=>{
  const f=fixture();
  for(const coastal of ['beachhouse','beachresidential','resort','waterpark'] as const){
    f.places.beginRebuild();const g=new THREE.Group(),c:Cell={x:0,z:0,kind:coastal==='waterpark'?'waterpark':coastal==='resort'?'commercial':'residential',coastal:coastal==='waterpark'?undefined:coastal,level:3,age:40,occupancy:24};g.userData.cell='0,0';
    if(coastal==='waterpark')f.places.waterpark(c,g);else f.places.coastal(c,g);
    const bounds=new THREE.Box3().setFromObject(g),w=coastal==='waterpark'?3:1,d=coastal==='waterpark'?2:1;
    assert.ok(bounds.min.x>=-4&&bounds.max.x<=w*8-4,`${coastal}: x ${bounds.min.x}..${bounds.max.x}`);assert.ok(bounds.min.z>=-4&&bounds.max.z<=d*8-4,`${coastal}: z ${bounds.min.z}..${bounds.max.z}`);
    f.places.endRebuild();f.places.update(10);assert.ok(Number.isFinite(bounds.max.y));
  }f.dispose();
});

test('paused place animations do not re-upload unchanged GPU buffers, and rebuilding invalidates the cache',()=>{
  const f=fixture(),cell:Cell={x:0,z:0,kind:'largepark',level:1,age:40,occupancy:0};
  const versions=()=>{const result:number[]=[];f.scene.traverse(o=>{if(o instanceof THREE.InstancedMesh)result.push(o.instanceMatrix.version);});return result;};
  f.places.beginRebuild();f.places.park(cell,new THREE.Group());f.places.endRebuild();f.places.update(7);const before=versions();assert.ok(before.length);
  f.places.update(7);assert.deepEqual(versions(),before);f.places.update(8);assert.ok(versions().every((n,i)=>n>before[i]));
  f.places.beginRebuild();f.places.park(cell,new THREE.Group());f.places.endRebuild();f.places.update(8);assert.ok(versions().every(n=>n>0));f.dispose();
});
