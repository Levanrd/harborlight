import {STREET_SCALE} from './worldScale';
import {busStopPlacement} from './busStopPlacement';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {walkingGraph,type FootTraffic,type WalkGraph} from './pedestrians';
import type {City} from './simulation';
import type {TrafficState} from './traffic';
import {PEDESTRIAN_SPACING} from './pedestrianAppearance';
import {RecreationPeople,type LeisurePerson} from './recreationPeople';
import {isHumanLimb,humanLimbMaterial,prepareHumanLimb,writeHumanLimb,uploadHumanLimb,disposeHumanLimb} from './humanSkinning';

/** One fixed instance batch per anatomical geometry, shared by the whole crowd. */
export class PedestrianModels{
  private material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.82});
  private faceMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.72,vertexColors:true});
  private limbMaterial=humanLimbMaterial(this.material);
  private doorMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.4,metalness:.18});
  private palette=new Map<string,THREE.MeshStandardMaterial>();
  private people=new RecreationPeople(color=>{let material=this.palette.get(color);if(!material){material=new THREE.MeshStandardMaterial({color,roughness:.8});this.palette.set(color,material);}return material;});
  private figures=new Map<number,LeisurePerson>();
  private batches=new Map<THREE.BufferGeometry,{mesh:THREE.InstancedMesh;count:number}>();
  private box=new RoundedBoxGeometry(1,1,1,2,.12);
  private doors=new THREE.InstancedMesh(this.box,this.doorMaterial,2000);
  private doorsCount=0;
  private root=new THREE.Matrix4();private local=new THREE.Matrix4();private matrix=new THREE.Matrix4();
  private position=new THREE.Vector3();private scale=new THREE.Vector3();private rotation=new THREE.Quaternion();private color=new THREE.Color();
  private up=new THREE.Vector3(0,1,0);
  private shown=new Map<number,{x:number;z:number;heading:number;walked:number;motion:number}>();
  private cameraPosition=new THREE.Vector3(Infinity,Infinity,Infinity);
  private cells?:City['cells'];private graph?:WalkGraph;private openings=new Map<string,number>();
  private lastFoot?:FootTraffic;private lastTraffic?:TrafficState;private settled=0;private lastReduced=false;
  constructor(private scene:THREE.Scene){
    const geo=this.people.geometry;
    for(const [i,geometry] of geo.geometries.entries()){
      const mesh=new THREE.InstancedMesh(geometry,isHumanLimb(geometry)?this.limbMaterial:geometry===geo.head||geometry===geo.headFar?this.faceMaterial:this.material,geometry===geo.joint?10000:2000);
      prepareHumanLimb(mesh);
      mesh.name=geometry===geo.joint?'pedestrian-faces':geometry===geo.head?'pedestrian-heads':'pedestrian-anatomy-'+i;
      mesh.count=0;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);this.batches.set(geometry,{mesh,count:0});
    }
    this.doors.name='pedestrian-doors';this.doors.count=0;this.doors.castShadow=true;this.doors.frustumCulled=false;this.doors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.doors);
  }
  private part(mesh:THREE.InstancedMesh,x:number,y:number,z:number,w:number,h:number,d:number,color:string){
    const index=this.doorsCount++;this.position.set(x,y,z);this.scale.set(w,h,d);this.local.compose(this.position,this.rotation.identity(),this.scale);this.matrix.multiplyMatrices(this.root,this.local);mesh.setMatrixAt(index,this.matrix);mesh.setColorAt(index,this.color.set(color));
  }
  private person(id:number,x:number,z:number,heading:number,walked:number,motion:number,reducedMotion:boolean){
    let figure=this.figures.get(id);if(!figure){figure=this.people.create(id,'walk',{street:true});this.figures.set(id,figure);}
    figure.root.position.set(x,.43,z);figure.root.rotation.y=heading;
    figure.pose(this.lastFoot?.clock||0,{distance:reducedMotion?0:walked,speed:motion*1.3,motion:reducedMotion?0:motion,still:reducedMotion});
    figure.root.updateMatrixWorld(true);
    const near=this.cameraPosition.distanceToSquared(figure.root.position)<45**2;
    for(const part of figure.parts){
      if(part.userData.faceDetail&&!near)continue;
      const geometry=part.geometry===this.people.geometry.head&&!near?this.people.geometry.headFar:part.geometry;
      const batch=this.batches.get(geometry)!;if(batch.count>=batch.mesh.instanceMatrix.count)throw Error('Pedestrian instance capacity exceeded');
      batch.mesh.setMatrixAt(batch.count,part.matrixWorld);batch.mesh.setColorAt(batch.count,(part.material as THREE.MeshStandardMaterial).color);writeHumanLimb(batch.mesh,batch.count,part);batch.count++;
    }
  }
  update(city:City,foot:FootTraffic,traffic:TrafficState,dt:number,reducedMotion:boolean,camera?:THREE.Camera){
    const cameraMoved=camera?this.cameraPosition.distanceToSquared(camera.position)>.5:false;
    if(camera&&cameraMoved)this.cameraPosition.copy(camera.position);else if(!camera)this.cameraPosition.set(0,2,0);
    const unchanged=!cameraMoved&&this.lastFoot===foot&&this.lastTraffic===traffic&&this.cells===city.cells&&this.lastReduced===reducedMotion;
    this.settled=unchanged?this.settled+dt:0;
    this.lastFoot=foot;this.lastTraffic=traffic;this.lastReduced=reducedMotion;
    // Let interpolation and doors settle after pausing, then retain the buffers.
    // Camera movement does not change any of these world-space transforms.
    if(this.settled>1)return;
    this.doorsCount=0;for(const batch of this.batches.values())batch.count=0;
    if(this.cells!==city.cells){this.cells=city.cells;this.graph=walkingGraph(city);}
    const live=new Set<number>();
    for(const p of foot.agents){if(p.stage==='inside'){const place=city.cells[p.returning?p.home:p.destination];if(place&&['park','playground','sports','largepark'].includes(place.kind))this.person(p.id,p.x,p.z,p.heading+Math.PI,0,0,reducedMotion);continue;}live.add(p.id);let pose=this.shown.get(p.id);if(!pose){pose={x:p.x,z:p.z,heading:p.heading,walked:p.walked,motion:p.waiting?0:1};this.shown.set(p.id,pose);}const blend=1-Math.exp(-dt*20);pose.x+=(p.x-pose.x)*blend;pose.z+=(p.z-pose.z)*blend;pose.walked+=(p.walked-pose.walked)*blend;pose.heading+=Math.atan2(Math.sin(p.heading-pose.heading),Math.cos(p.heading-pose.heading))*blend;pose.motion+=((p.waiting?0:1)-pose.motion)*blend;
      this.person(p.id,pose.x,pose.z,pose.heading,pose.walked,pose.motion,reducedMotion);
    }
    for(const id of this.shown.keys())if(!live.has(id))this.shown.delete(id);
    const perStop=new Map<string,number>();let waiting=0;
    for(const p of traffic.transit.passengers){if(p.vehicle||waiting>=90)continue;const cell=city.cells[p.from],n=perStop.get(p.from)||0;if(!cell||n>=6)continue;perStop.set(p.from,n+1);waiting++;
      const stop=busStopPlacement(city,p.from);if(!stop)continue;const along=(n-2.5)*PEDESTRIAN_SPACING;
      this.person(p.id+10000,stop.x+stop.nz*along,stop.z-stop.nx*along,stop.rotation+Math.PI,0,0,reducedMotion);
    }
    const activeDoors=new Set<string>();for(const p of foot.agents){if(p.stage!=='walking')continue;for(const k of [p.home,p.destination]){const e=this.graph?.entrances.get(k);if(e&&Math.hypot(p.x-e.door.x,p.z-e.door.z)<1.4)activeDoors.add(k);}}
    for(const entry of this.graph?.entrances.values()||[]){
      if(!['residential','commercial','industrial'].includes(entry.kind))continue;
      const active=activeDoors.has(entry.key);
      const before=this.openings.get(entry.key)||0,open=THREE.MathUtils.lerp(before,active?1:0,1-Math.exp(-dt*9));this.openings.set(entry.key,open);
      this.position.set(entry.door.x+entry.normal.x*.055,0,entry.door.z+entry.normal.z*.055);this.rotation.setFromAxisAngle(this.up,Math.atan2(entry.normal.x,entry.normal.z));this.scale.set(1,1,1);this.root.compose(this.position,this.rotation,this.scale);
      const doorH=STREET_SCALE.doorHeight,doorY=.43+doorH/2;
      this.part(this.doors,0,doorY,0,.72,doorH,.025,'#253936');
      for(const side of [-1,1]){this.part(this.doors,side*(.17+open*.35),doorY,.035,.33,doorH-.06,.035,'#66817e');this.part(this.doors,side*(.045+open*.35),.43+.68,.065,.02,.14,.025,'#c5ccc4');}
    }
    const styled=new Set([...foot.agents.map(p=>p.id),...traffic.transit.passengers.map(p=>p.id+10000)]);
    for(const id of this.figures.keys())if(!styled.has(id))this.figures.delete(id);
    this.doors.count=this.doorsCount;this.doors.instanceMatrix.needsUpdate=true;if(this.doors.instanceColor)this.doors.instanceColor.needsUpdate=true;
    for(const {mesh,count} of this.batches.values()){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;uploadHumanLimb(mesh);}
  }
  dispose(){for(const {mesh} of this.batches.values()){this.scene.remove(mesh);disposeHumanLimb(mesh);mesh.dispose();}this.scene.remove(this.doors);this.doors.dispose();this.box.dispose();this.people.dispose();for(const material of this.palette.values())material.dispose();this.material.dispose();this.faceMaterial.dispose();this.limbMaterial.dispose();this.doorMaterial.dispose();this.shown.clear();this.figures.clear();this.openings.clear();}
}
