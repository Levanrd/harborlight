import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {UrbanDetails} from './urbanDetails';
import {createMasterplan} from './masterplan';
import {build,metrics,type Cell} from './simulation';
import type {VisualKit} from './cityVisuals';

function fixture(){const box=new THREE.BoxGeometry(),cylinder=new THREE.CylinderGeometry(1,1,1,16),mat=new THREE.MeshStandardMaterial();const kit:VisualKit={material:()=>mat,tree:()=>{},cylinder,roof:box,box:(g,x,y,z,w,h,d)=>{const m=new THREE.Mesh(box,mat);m.position.set(x,y+h/2,z);m.scale.set(w,h,d);g.add(m);return m;}};const detail=new UrbanDetails(kit);return {detail,dispose(){detail.dispose();box.dispose();cylinder.dispose();mat.dispose();}};}
test('architectural and civic detail respects lot clearance',()=>{
  const f=fixture();for(const kind of ['residential','commercial','industrial','clinic','school','police','fire','utility','power','recycling'] as const)for(const level of [1,2,3]){
    const c:Cell={x:0,z:0,kind,level,age:120,occupancy:12,factoryTier:kind==='industrial'?level:undefined},g=new THREE.Group();f.detail.architecture(c,g);f.detail.facility(c,g);if(!g.children.length)continue;const b=new THREE.Box3().setFromObject(g);assert.ok(b.min.x>=-4&&b.max.x<=4,kind+' width');assert.ok(b.min.z>=-4&&b.max.z<=4,kind+' depth');assert.ok(Number.isFinite(b.max.y));
  }f.dispose();
});
test('decorative infill never occupies an existing lot and yields when construction claims a parcel',()=>{
  const f=fixture(),city=createMasterplan(),g=new THREE.Group(),before=JSON.stringify(city);f.detail.infill(city,g);
  const parcels=g.children.filter(o=>o.userData.cell);assert.ok(parcels.length>50);assert.ok(parcels.every(o=>!city.cells[o.userData.cell]));assert.equal(JSON.stringify(city),before);
  const target=parcels.find(o=>{const [x,z]=o.userData.cell.split(',').map(Number);return build(city,'park',[{x,z}]).ok;})!;assert.ok(target);
  const [x,z]=target.userData.cell.split(',').map(Number),next=build(city,'park',[{x,z}]).city,nextGroup=new THREE.Group();f.detail.infill(next,nextGroup);assert.ok(!nextGroup.children.some(o=>o.userData.cell===target.userData.cell));f.dispose();
});
test('master plan includes every implemented facility and begins without resident complaints',()=>{
  const c=createMasterplan(),kinds=new Set(Object.values(c.cells).map(c=>c.kind)),m=metrics(c);
  for(const kind of ['airport','seaport','railway','park','playground','sports','largepark','waterpark','school','clinic','fire','police','utility','power','water','sewage','landfill','recycling'] as const)assert.ok(kinds.has(kind),kind);
  assert.equal(m.wellbeing.complaints,0);assert.equal(c.transit!.routes.length,4);assert.ok(m.regional.facilities.every(f=>f.active));
});
