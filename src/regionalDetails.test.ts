import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RegionalDetails} from './regionalDetails';
import {animateRegionalActor,createRegionalActor,drawRegional} from './regionalModels';
import {batchScenery,disposeBatches,type VisualKit} from './cityVisuals';
import {waterEdge,type Cell} from './simulation';

function fixture(){
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();
  const kit:VisualKit={material:()=>material,tree:()=>{},roof:geometry,cylinder:geometry,box:(g,x,y,z,w,h,d)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y+h/2,z);m.scale.set(w,h,d);g.add(m);return m;}};
  const detail=new RegionalDetails(kit);return {kit,detail,dispose(){detail.dispose();geometry.dispose();material.dispose();}};
}
test('airport stays on its parcel, port stays in its coastal corridor, and picking survives batching',()=>{
  const f=fixture();
  for(const kind of ['airport','seaport'] as const){
    const c:Cell={x:0,z:0,kind,age:0,occupancy:0,level:1},before=JSON.stringify(c),g=new THREE.Group();g.userData.cell='0,0';drawRegional(c,g,f.kit,f.detail);
    const bounds=new THREE.Box3().setFromObject(g);
    assert.ok(bounds.min.x>=-4&&bounds.min.z>=-4);
    assert.ok(bounds.max.z<=(kind==='airport'?28:20));
    assert.ok(bounds.max.x<=(kind==='airport'?44:waterEdge(8)+17));
    g.updateMatrixWorld(true);g.traverse(o=>{assert.ok(o.matrixWorld.determinant()>0,'Static instances must not have reflected transforms');});
    batchScenery(g);assert.ok(g.children.every(o=>o.userData.lots.every((k:string)=>k==='0,0')));assert.equal(JSON.stringify(c),before);disposeBatches(g);
  }f.dispose();
});
test('regional actors retain runway contact, retract gear in flight, and clear the quay through the service cycle',()=>{
  const f=fixture();
  const plane=createRegionalActor({x:0,z:0,kind:'airport',age:0,occupancy:0,level:1},f.kit,f.detail);
  animateRegionalActor(plane,0,true);const gear=plane.group.getObjectByName('Landing gear')!;
  assert.ok(gear.visible);plane.group.updateMatrixWorld(true);const ground=new THREE.Box3().setFromObject(gear);assert.ok(ground.min.y>=.55&&ground.min.y<.62,`Undercarriage height ${ground.min.y}`);
  plane.time=50;animateRegionalActor(plane,0,true);assert.equal(gear.visible,false);assert.ok(plane.group.position.y>4);
  const pose=plane.group.position.clone(),rotation=plane.group.rotation.clone(),t=plane.time;animateRegionalActor(plane,10,false);assert.equal(plane.time,t);assert.deepEqual(plane.group.position,pose);assert.ok(plane.group.rotation.equals(rotation));
  plane.time=229.99;animateRegionalActor(plane,0,true);assert.equal(gear.visible,true);assert.ok(Math.abs(plane.group.rotation.z)<.001);
  const ship=createRegionalActor({x:0,z:0,kind:'seaport',age:0,occupancy:0,level:1},f.kit,f.detail);
  assert.ok(ship.group.children.length<40,'Repeated ship details should be instanced');
  for(let time=70;time<190;time+=.5){ship.time=time;animateRegionalActor(ship,0,true);const box=new THREE.Box3().setFromObject(ship.group);assert.ok(box.min.x>waterEdge(8)+7.7,'Ship must clear the quay and fenders');assert.ok(Number.isFinite(box.min.y));}
  disposeBatches(plane.group);disposeBatches(ship.group);f.dispose();
});
