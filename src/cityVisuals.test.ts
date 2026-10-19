import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchScenery,disposeBatches,VehicleBatches,animateGrowth,drawDetailedZone,type VisualKit} from './cityVisuals';
import type {Cell} from './simulation';

test('all zone designs stay inside their lot and report enough height for selection overlays',()=>{
  const box=new THREE.BoxGeometry(),cylinder=new THREE.CylinderGeometry(1,1,1,24),material=new THREE.MeshStandardMaterial();
  const kit:VisualKit={material:()=>material,tree:()=>{},roof:box,cylinder,box:(g,x,y,z,w,h,d)=>{const m=new THREE.Mesh(box,material);m.position.set(x,y+h/2,z);m.scale.set(w,h,d);g.add(m);return m;}};
  for(const kind of ['residential','commercial','industrial'] as const)for(const level of [1,2,3])for(let x=-6;x<6;x++){
    const cell:Cell={x,z:0,kind,level,factoryTier:kind==='industrial'?level:undefined,age:40,occupancy:12},before=JSON.stringify(cell),g=new THREE.Group();g.userData.cell=`${x},0`;
    const height=drawDetailedZone(cell,g,kit),bounds=new THREE.Box3().setFromObject(g);
    assert.ok(bounds.min.x>=x*8-4&&bounds.max.x<=x*8+4,`${kind} ${x}: horizontal footprint`);
    assert.ok(bounds.min.z>=-4&&bounds.max.z<=4,`${kind} ${x}: depth footprint`);
    assert.ok(height>=bounds.max.y,`${kind} ${x}: overlay must clear roof/spire`);
    batchScenery(g);g.updateMatrixWorld(true);
    const hits=new THREE.Raycaster(new THREE.Vector3(x*8,60,0),new THREE.Vector3(0,-1,0)).intersectObject(g,true);
    assert.ok(hits.length);assert.equal(hits[0].object.userData.lots[hits[0].instanceId!],`${x},0`);
    assert.equal(JSON.stringify(cell),before);disposeBatches(g);
  }
  box.dispose();cylinder.dispose();material.dispose();
});

test('static batching retains world transforms and the exact lot hit by raycasting',()=>{
  const scene=new THREE.Group(),geo=new THREE.BoxGeometry(),mat=new THREE.MeshStandardMaterial();
  for(const [x,k]of [[-8,'-1,0'],[8,'1,0']] as const){const lot=new THREE.Group();lot.position.x=x;lot.userData.cell=k;const part=new THREE.Mesh(geo,mat);part.position.y=2;part.scale.set(3,4,3);part.castShadow=true;lot.add(part);scene.add(lot);}
  batchScenery(scene);assert.equal(scene.children.length,1);const inst=scene.children[0] as THREE.InstancedMesh;assert.equal(inst.count,2);scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(8,20,0),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(scene,true)[0];assert.ok(hit);assert.equal(hit.object.userData.lots[hit.instanceId!],'1,0');
  assert.equal(inst.castShadow,true);disposeBatches(scene);assert.equal(scene.children.length,0);geo.dispose();mat.dispose();
});
test('dynamic signal lamps remain individually addressable after batching',()=>{
  const scene=new THREE.Group(),lot=new THREE.Group(),geo=new THREE.BoxGeometry(),mat=new THREE.MeshStandardMaterial();lot.userData.cell='0,0';const road=new THREE.Mesh(geo,mat),lamp=new THREE.Mesh(geo,mat);lamp.position.set(2,4,2);lot.add(road,lamp);scene.add(lot);batchScenery(scene,new Set([lamp]));assert.equal(lamp.parent,scene);assert.equal(lamp.position.y,4);lamp.visible=false;assert.equal(scene.children.includes(lamp),true);disposeBatches(scene);geo.dispose();mat.dispose();
});
test('vehicle batches follow source transforms, hide flashing lamps and release replaced instances',()=>{
  const target=new THREE.Group(),sources=new THREE.Group(),car=new THREE.Group(),geo=new THREE.BoxGeometry(),mat=new THREE.MeshStandardMaterial();const body=new THREE.Mesh(geo,mat),lamp=new THREE.Mesh(geo,mat);lamp.position.y=2;car.add(body,lamp);sources.add(car);const batch=new VehicleBatches(target);batch.rebuild(sources);car.position.set(10,1,20);lamp.visible=false;batch.update(sources);const inst=target.children[0] as THREE.InstancedMesh,m=new THREE.Matrix4();inst.getMatrixAt(0,m);assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(m).toArray(),[10,1,20]);inst.getMatrixAt(1,m);assert.equal(m.elements[0],0);
  lamp.visible=true;batch.update(sources);inst.getMatrixAt(1,m);assert.equal(m.elements[13],3);sources.clear();batch.rebuild(sources);assert.equal(target.children.length,0);batch.dispose();geo.dispose();mat.dispose();
});
test('construction growth finishes at the exact original transform and keeps other lots unchanged',()=>{
  const scene=new THREE.Group(),geo=new THREE.BoxGeometry(),mat=new THREE.MeshStandardMaterial();for(const [k,x]of [['new',0],['old',8]] as const){const lot=new THREE.Group();lot.userData.cell=k;const building=new THREE.Mesh(geo,mat);building.position.set(x,5,0);building.scale.set(4,10,4);lot.add(building);scene.add(lot);}batchScenery(scene,new Set(),new Set(['new']));const inst=scene.children[0] as THREE.InstancedMesh,m=new THREE.Matrix4();animateGrowth(scene,0);inst.getMatrixAt(0,m);assert.ok(m.elements[5]<2);inst.getMatrixAt(1,m);assert.equal(m.elements[5],10);animateGrowth(scene,1);inst.getMatrixAt(0,m);assert.equal(m.elements[5],10);assert.equal(m.elements[13],5);assert.equal(inst.userData.growth.length,0);disposeBatches(scene);geo.dispose();mat.dispose();
});
