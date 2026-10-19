import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PedestrianModels} from './pedestrianModels';
import {createCity} from './simulation';
import {emptyFootTraffic} from './pedestrians';
import {emptyTraffic} from './traffic';
import {pedestrianAppearance,pedestrianLeg,LEG_LENGTH} from './pedestrianAppearance';
import type {Walker} from './pedestrians';

const walker=(id:number):Walker=>({id,home:'none',destination:'none',path:[],index:0,progress:0,x:0,z:0,heading:0,walked:.28,pace:1,stage:'walking',returning:false,until:0,waiting:false});

test('walking legs retain their lengths, lift clear of the pavement and plant during stance',()=>{
 for(let step=0;step<400;step++)for(const side of [-1,1]){
  const leg=pedestrianLeg(step*.013,side);
  assert.ok(Math.abs(Math.hypot(leg.knee.y-leg.hip.y,leg.knee.z-leg.hip.z)-LEG_LENGTH)<1e-8);
  assert.ok(Math.abs(Math.hypot(leg.knee.y-leg.ankle.y,leg.knee.z-leg.ankle.z)-LEG_LENGTH)<1e-8);
  assert.ok(leg.lift>=0&&leg.lift<=.131);
 }
 const a=pedestrianLeg(.1,1),b=pedestrianLeg(.12,1);
 assert.equal(a.lift,0);assert.equal(b.lift,0);
 assert.ok(Math.abs((.1+a.stride)-(.12+b.stride))<1e-8,'stance foot holds its ground as body advances');
 assert.deepEqual(pedestrianLeg(0,1,0),pedestrianLeg(7,1,0),'stopped/reduced-motion pose is neutral');
});

test('appearance stays deterministic while varying proportions, clothes and hair independently',()=>{
 const looks=Array.from({length:100},(_,i)=>pedestrianAppearance(i));
 assert.deepEqual(looks[24],pedestrianAppearance(24));
 for(const key of ['skin','top','pants','hair','height','build','outfit','hairStyle'] as const)assert.ok(new Set(looks.map(p=>p[key])).size>=3,key);
});

test('a maximum 270-person crowd fits the shared buffers without dropping body parts',()=>{
 const scene=new THREE.Scene(),models=new PedestrianModels(scene),city=createCity();city.cells={};
 const traffic=emptyTraffic(),foot=emptyFootTraffic(),meshes=scene.children as THREE.InstancedMesh[],totals=meshes.map(()=>0);
 for(let id=1;id<=270;id++){models.update(city,{...foot,agents:[walker(id)]},traffic,.1,false);meshes.forEach((m,i)=>totals[i]+=m.count);}
 models.update(city,{...foot,agents:Array.from({length:270},(_,i)=>walker(i+1))},traffic,.1,false);
 assert.ok(meshes.length<=16,'anatomical geometry uses a fixed draw-call budget independent of crowd size');
 meshes.forEach((m,i)=>{assert.equal(m.count,totals[i],m.name);assert.ok(m.count<=m.instanceMatrix.count);for(const n of m.instanceMatrix.array.slice(0,m.count*16))assert.ok(Number.isFinite(n));});
 models.dispose();
});

test('zooming toward a paused crowd restores face detail while reduced motion remains still',()=>{
 const scene=new THREE.Scene(),models=new PedestrianModels(scene),city=createCity();city.cells={};
 const camera=new THREE.PerspectiveCamera(),foot={...emptyFootTraffic(),agents:[walker(1)]},traffic=emptyTraffic();camera.position.set(0,30,140);
 for(let i=0;i<30;i++)models.update(city,foot,traffic,.05,true,camera);
 const faces=scene.getObjectByName('pedestrian-faces') as THREE.InstancedMesh,far=faces.count;
 camera.position.set(0,2,4);models.update(city,foot,traffic,.05,true,camera);assert.ok(faces.count>far);
 const before=Array.from(faces.instanceMatrix.array.slice(0,faces.count*16));
 models.update(city,{...foot,agents:[{...walker(1),walked:100}]},traffic,.05,true,camera);
 assert.deepEqual(Array.from(faces.instanceMatrix.array.slice(0,faces.count*16)),before);
 models.dispose();
});

test('paused pedestrians keep their GPU buffers after settling and update again on state changes',()=>{
 const scene=new THREE.Scene(),models=new PedestrianModels(scene),city=createCity(),foot=emptyFootTraffic(),traffic=emptyTraffic();
 const versions=()=>scene.children.filter(o=>o instanceof THREE.InstancedMesh).map(o=>(o as THREE.InstancedMesh).instanceMatrix.version);
 for(let i=0;i<30;i++)models.update(city,foot,traffic,.05,false);
 const settled=versions();models.update(city,foot,traffic,.05,false);assert.deepEqual(versions(),settled);
 models.update(city,{...foot,clock:1},traffic,.05,false);assert.ok(versions().every((n,i)=>n>settled[i]));
 models.dispose();assert.equal(scene.children.length,0);
});
