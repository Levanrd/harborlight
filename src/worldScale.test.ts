import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {METRES_PER_UNIT as M,STREET_SCALE,vehicleDimensions,vehicleGap,signalStopProgress} from './worldScale';
import {VehicleModels} from './vehicleModels';
import {PedestrianModels} from './pedestrianModels';
import {pedestrianAppearance,pedestrianLeg} from './pedestrianAppearance';
import {createCity} from './simulation';
import {emptyFootTraffic} from './pedestrians';
import {emptyTraffic,advanceTraffic,type Vehicle} from './traffic';
import {vehicleRoadPose} from './vehiclePose';

function instanceBounds(scene:THREE.Scene){const bounds=new THREE.Box3(),matrix=new THREE.Matrix4();for(const object of scene.children){if(!(object instanceof THREE.InstancedMesh))continue;object.geometry.computeBoundingBox();for(let i=0;i<object.count;i++){object.getMatrixAt(i,matrix);bounds.union(object.geometry.boundingBox!.clone().applyMatrix4(matrix));}}return bounds;}
test('rendered adults fit real-sized doors, stay grounded, and remain taller than car roofs',()=>{
 const scene=new THREE.Scene(),people=new PedestrianModels(scene),city=createCity(false);city.cells={};
 const fleet=new VehicleModels(),sedan=new THREE.Box3().setFromObject(fleet.create('car',1));
 for(let id=1;id<=100;id++){
  people.update(city,{...emptyFootTraffic(),agents:[{id,home:'none',destination:'none',path:[],index:0,progress:0,x:0,z:0,heading:0,walked:0,pace:1,stage:'walking',returning:false,until:0,waiting:true}]},emptyTraffic(),1,true);
  const bounds=instanceBounds(scene),height=(bounds.max.y-.43)*M;
  assert.ok(height>1.58&&height<2, 'adult stature');
  assert.ok(height<STREET_SCALE.doorHeight*M,'door headroom');
  assert.ok(bounds.min.y>=.425&&bounds.min.y<.45,'feet at pavement');
  assert.ok(height>(sedan.max.y-sedan.min.y)*M,'standing adult taller than sedan');
 }
 people.dispose();fleet.dispose();
});
test('scaled walking stance stays planted at every adult height',()=>{
 for(let id=1;id<=100;id++){const scale=pedestrianAppearance(id).height/M,a=.1*scale,b=.12*scale;
 const first=pedestrianLeg(a/scale,1),next=pedestrianLeg(b/scale,1);
 assert.ok(Math.abs(a+first.stride*scale-b-next.stride*scale)<1e-8);}
});
test('fleet dimensions are metres-based and opposing mirrors clear each other',()=>{
 const models=new VehicleModels();
 for(const kind of ['car','police','ambulance','bus','garbage','firetruck','maintenance'] as const)for(let id=0;id<4;id++){
 const bounds=new THREE.Box3().setFromObject(models.create(kind,id)),size=bounds.getSize(new THREE.Vector3());
 assert.ok(size.x*M>=1.75&&size.x*M<=2.9,kind+' overall width');
 assert.ok(size.y*M>=1.5&&size.y*M<=3.1,kind+' height');
 assert.ok(Math.max(-bounds.min.x,bounds.max.x)<STREET_SCALE.laneOffset-.16,kind+' opposing clearance');
 assert.ok(STREET_SCALE.laneOffset+Math.max(-bounds.min.x,bounds.max.x)<STREET_SCALE.laneEdge,kind+' stays inside travel lane');
 const v={kind,id},front=(8*(1-signalStopProgress(v))-vehicleDimensions(kind,id).length/2)*M;
 assert.ok(front>=3.7*M,'front bumper behind stop line');
 }
 models.dispose();
});
test('actual fleet bounds stay on the paved terminal through a full U turn',()=>{
 const models=new VehicleModels(),city=createCity(false);city.cells={};for(let z=-1;z<=0;z++)city.cells['0,'+z]={x:0,z,kind:'road',age:4,level:1,occupancy:0};
 for(const kind of ['car','police','ambulance','bus','garbage','firetruck','maintenance'] as const){
 const model=models.create(kind,3),bounds=new THREE.Box3().setFromObject(model);
 for(let step=0;step<=100;step++){
 const v:Vehicle={kind,id:3,path:['0,0','0,-1'],index:0,progress:0,waiting:0,stage:'outbound',uTurn:{dx:0,dz:1,progress:step/100}},pose=vehicleRoadPose(city,v)!;
 for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z]){
 const xx=pose.x+x*Math.cos(pose.heading)+z*Math.sin(pose.heading),zz=pose.z-x*Math.sin(pose.heading)+z*Math.cos(pose.heading);
 assert.ok(Math.abs(xx)<3.15,kind+' clears side curbs');assert.ok(zz<3.15,kind+' clears terminal curb');
 }}
 }models.dispose();
});
test('length-aware following preserves bumper clearance across road-cell boundaries',()=>{
 const city=createCity(false);city.cells={};for(let z=0;z<=7;z++)city.cells['0,'+z]={x:0,z,kind:'road',age:4,level:1,occupancy:0};
 const path=Array.from({length:8},(_,i)=>'0,'+i),lead:Vehicle={kind:'car',id:3,path,index:1,progress:.2,waiting:0,stage:'outbound'},rear:Vehicle={...lead,id:7,index:0,progress:.3};
 let state={...emptyTraffic(),nextId:8,vehicles:[lead,rear]};
 for(let i=0;i<150;i++){
 state=advanceTraffic(city,state,.05,{operational:new Set(),health:100,fireRisk:0,autoIncidents:false}).state;
 if(state.vehicles.length===2){const [a,b]=state.vehicles;assert.ok(((a.index+a.progress)-(b.index+b.progress))*8>=vehicleGap(a,b)-.001);}
 }
 assert.ok(state.completed>0,'convoy still finishes');
});
