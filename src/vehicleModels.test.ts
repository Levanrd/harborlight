import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {VehicleModels,vehicleDimensions} from './vehicleModels';
import {VehicleBatches} from './cityVisuals';

test('detailed fleet stays inside road clearance and supports existing animated lamps',()=>{
  const kit=new VehicleModels();
  for(const kind of ['maintenance','car','police','ambulance','firetruck','garbage','bus'] as const)for(let id=0;id<4;id++){
    const model=kit.create(kind,id,'#328497'),{width,length}=vehicleDimensions(kind,id),bounds=new THREE.Box3().setFromObject(model);
    assert.ok(bounds.min.x>=-width*.65&&bounds.max.x<=width*.65,`${kind} lane clearance`);
    assert.ok(bounds.min.z>=-length*.55&&bounds.max.z<=length*.55,`${kind} longitudinal clearance`);
    assert.ok(Math.abs(bounds.min.y+.2)<.005,`${kind} tire contact patch`);
    assert.equal(model.userData.brakes.length,2);assert.equal(model.userData.indicators.length,2);
    assert.equal(model.userData.wheels.length,kind==='garbage'?6:4);
    if(['police','ambulance','firetruck'].includes(kind))assert.equal(model.userData.lights.length,2);
    model.traverse(o=>{if(o instanceof THREE.Mesh)for(const n of o.geometry.attributes.normal.array)assert.ok(Number.isFinite(n));});
  }kit.dispose();
});

test('curved vehicle geometry is shared and wheel motion survives fleet instancing',()=>{
  const kit=new VehicleModels(),a=kit.create('car',1),b=kit.create('car',5),source=new THREE.Group(),target=new THREE.Group();
  const body=a.getObjectByName('sculpted body') as THREE.Mesh;
  assert.equal(body.geometry,(b.getObjectByName('sculpted body') as THREE.Mesh).geometry);
  assert.ok(body.geometry.attributes.position.count>80,'body has curved cross sections');
  const normals=body.geometry.attributes.normal.array;assert.ok([...normals].some(n=>Math.abs(n)>.1&&Math.abs(n)<.9),'smooth non-axis-aligned normals');
  source.add(a,b);b.position.x=8;const batch=new VehicleBatches(target);batch.rebuild(source);
  a.userData.wheels[0].rotation.x=.8;a.userData.brakes[0].visible=false;batch.update(source);
  const spoke=a.getObjectByName('wheel spoke') as THREE.Mesh;assert.notEqual(spoke.matrixWorld.elements[6],0);
  const brake=a.userData.brakes[0] as THREE.Mesh,brakes=target.children.find(o=>o instanceof THREE.InstancedMesh&&o.geometry===brake.geometry&&o.material===brake.material) as THREE.InstancedMesh;
  const m=new THREE.Matrix4();brakes.getMatrixAt(0,m);assert.equal(m.elements[0],0);
  assert.ok(target.children.length<40,'shared details remain batched');batch.dispose();kit.dispose();
});
