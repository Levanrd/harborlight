import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {drawStreetDetails} from './streetVisuals';
import type {VisualKit} from './cityVisuals';

test('street details fit the road parcel for all 16 connections and both widths',()=>{
  const geo=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();
  const kit:VisualKit={material:()=>material,tree:()=>{},roof:geo,cylinder:geo,box:(g,x,y,z,w,h,d)=>{const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y+h/2,z);mesh.scale.set(w,h,d);g.add(mesh);return mesh;}};
  for(const avenue of [false,true])for(let mask=0;mask<16;mask++){
    const group=new THREE.Group();drawStreetDetails({x:0,z:0,kind:'road',age:3,level:1,occupancy:0,avenue},[1,2,4,8].map(bit=>!!(mask&bit)),group,kit);
    const bounds=new THREE.Box3().setFromObject(group);assert.ok(bounds.min.x>=-4.01&&bounds.max.x<=4.01);assert.ok(bounds.min.z>=-4.01&&bounds.max.z<=4.01);
    assert.ok(bounds.min.y>=.25-1e-6);
  }
  geo.dispose();material.dispose();
});
