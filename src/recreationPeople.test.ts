import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RecreationPeople,ellipseTravel,type LeisureActivity} from './recreationPeople';
import {pedestrianAppearance} from './pedestrianAppearance';
import {METRES_PER_UNIT} from './worldScale';
import {PlaceVisuals} from './placeVisuals';
import type {VisualKit} from './cityVisuals';
import {VehicleBatches} from './cityVisuals';
import {isHumanLimb,type LimbSkin} from './humanSkinning';
import {joggingLeg} from './pedestrianAppearance';

test('leisure adults and children use the city human scale and keep their feet grounded',()=>{
  const material=new THREE.MeshStandardMaterial(),kit=new RecreationPeople(()=>material);
  for(let id=0;id<40;id++){
    const adult=kit.create(id,'stand'),child=kit.create(id,'stand',{child:true});
    const bounds=new THREE.Box3().setFromObject(adult.root),small=new THREE.Box3().setFromObject(child.root);
    assert.ok(bounds.max.y*METRES_PER_UNIT>1.58&&bounds.max.y*METRES_PER_UNIT<1.94);
    assert.ok(Math.abs(bounds.min.y)<.001,'bare ground contact');
    assert.ok(small.max.y*METRES_PER_UNIT>1.05&&small.max.y*METRES_PER_UNIT<1.35);
    assert.ok(small.max.y<bounds.max.y*.72,'child stature');
  }
  kit.dispose();material.dispose();
});

test('articulated activity poses keep the same complete body and finite transforms through a cycle',()=>{
  const material=new THREE.MeshStandardMaterial(),kit=new RecreationPeople(()=>material);
  for(const activity of ['walk','run','swim','wade','sit','swing'] as LeisureActivity[]){
    const figure=kit.create(13,activity,{child:activity==='swing'}),parts:THREE.Mesh[]=[];
    figure.root.traverse(o=>{if(o instanceof THREE.Mesh)parts.push(o);});
    for(const name of ['arm','leg'])assert.equal(parts.filter(p=>p.name===name).length,2,'paired continuous '+name);
    for(let step=0;step<100;step++){
      figure.pose(step*.07);figure.root.updateMatrixWorld(true);
      for(const p of parts)assert.ok(p.matrixWorld.elements.every(Number.isFinite));
      for(const p of parts.filter(p=>isHumanLimb(p.geometry))){
        const {start,joint,end}=p.userData.joints,upper=p.name==='arm'?.29:.425,lower=p.name==='arm'?.25:.425;
        assert.ok(Math.abs(new THREE.Vector3(...start).distanceTo(new THREE.Vector3(...joint))-upper)<1e-7);
        assert.ok(Math.abs(new THREE.Vector3(...end).distanceTo(new THREE.Vector3(...joint))-lower)<1e-7);
        const skin=p.userData.limbSkin as LimbSkin;
        assert.ok(Math.abs(skin.bend.length()-1)<1e-7,'normalized joint skinning');
        const wrist=new THREE.Vector3(0,-lower,0).applyQuaternion(skin.bend).applyQuaternion(p.quaternion).add(p.position);
        assert.ok(wrist.distanceTo(new THREE.Vector3(...end))<1e-7,'skin end meets the hand or ankle');
      }
      if(activity==='run')for(const [index,hand]of parts.filter(p=>p.name==='hand').entries()){
        const palm=new THREE.Vector3(0,0,1).applyQuaternion(hand.quaternion);
        assert.ok(palm.x*(index===0?1:-1)>.7,'relaxed running palms face inward');
      }
      // Buffer bounds describe the undeformed limb. Ground contact is measured
      // from soles; horizontal posture uses the head, trunk and extremities.
      const bounds=new THREE.Box3();for(const p of parts)if(!isHumanLimb(p.geometry))bounds.union(new THREE.Box3().setFromObject(p));
      if(activity==='run'||activity==='walk')assert.ok(bounds.min.y>=-.025&&bounds.min.y<.07,'walking ground contact');
      if(activity==='swim')assert.ok(bounds.max.y-bounds.min.y<.6,'horizontal swimmer, not an upright floating torso');
    }
    figure.pose(3);figure.root.updateMatrixWorld(true);const before=parts.map(p=>p.matrixWorld.clone());
    figure.pose(3);figure.root.updateMatrixWorld(true);parts.forEach((p,i)=>assert.deepEqual(p.matrixWorld.elements,before[i].elements));
  }
  kit.dispose();material.dispose();
});

test('continuous limb batches retain independent bends, clothing and matching shadow skinning',()=>{
  const material=new THREE.MeshStandardMaterial(),people=new RecreationPeople(()=>material),sources=new THREE.Group(),scene=new THREE.Group();
  const a=people.create(1,'run',{shirt:'#b04d3f'}),b=people.create(2,'run',{shirt:'#357993'});sources.add(a.root,b.root);
  a.pose(.2);b.pose(.7);const batches=new VehicleBatches(scene);batches.rebuild(sources);batches.update(sources);
  for(const mesh of scene.children.filter(o=>o instanceof THREE.InstancedMesh&&isHumanLimb(o.geometry)) as THREE.InstancedMesh[]){
    assert.equal(mesh.count,4);assert.ok(mesh.customDepthMaterial,'shadows deform with the visible limb');
    const bend=mesh.geometry.getAttribute('humanBend');assert.equal(bend.count,4);
    for(let i=0;i<4;i++)assert.ok(Math.abs(Math.hypot(bend.getX(i),bend.getY(i),bend.getZ(i),bend.getW(i))-1)<1e-6);
    assert.notDeepEqual(Array.from(bend.array.slice(0,4)),Array.from(bend.array.slice(4,8)),'limbs have independent poses');
    assert.ok(mesh.instanceColor);
  }
  const limbs=scene.children.filter(o=>o instanceof THREE.InstancedMesh&&isHumanLimb(o.geometry)) as THREE.InstancedMesh[];
  assert.equal(limbs.length,2,'two limb draws, independent of person count');
  const arms=limbs.find(m=>m.geometry.getAttribute('position').getY(0)===-.25)!;
  const cloth=arms.geometry.getAttribute('humanCloth');assert.notDeepEqual(Array.from(cloth.array.slice(0,3)),Array.from(cloth.array.slice(8,11)));
  const snapshots=limbs.map(m=>Array.from(m.geometry.getAttribute('humanBend').array));batches.update(sources);
  limbs.forEach((m,i)=>assert.deepEqual(Array.from(m.geometry.getAttribute('humanBend').array),snapshots[i],'paused poses stay unchanged'));
  batches.dispose();assert.equal(scene.children.length,0);people.dispose();material.dispose();
});

test('jogging has planted stance, heel recovery and continuous distance-driven stride',()=>{
  let recovery=0;
  for(let i=0;i<500;i++)for(const side of [-1,1]){
    const leg=joggingLeg(i*.01,side);recovery=Math.max(recovery,leg.lift);
    assert.ok(Math.abs(Math.hypot(leg.knee.y-leg.hip.y,leg.knee.z)-.425)<1e-7);
    assert.ok(Math.abs(Math.hypot(leg.ankle.y-leg.knee.y,leg.ankle.z-leg.knee.z)-.425)<1e-7);
    const next=joggingLeg(i*.01+.00001,side);assert.ok(Math.abs(next.stride-leg.stride)<.00005,'no step discontinuity');
    if(leg.lift===0&&next.lift===0)assert.ok(Math.abs(.00001+next.stride-leg.stride)<1e-8,'stance foot stays planted');
  }
  assert.ok(recovery>.16,'heel recovery is distinct from a walking shuffle');
  assert.deepEqual(joggingLeg(0,1,0),joggingLeg(12,1,0),'stopped jog settles into neutral stance');
});

test('adult heads have natural stature ratios and a detailed facial surface within the crowd budget',()=>{
  const material=new THREE.MeshStandardMaterial(),kit=new RecreationPeople(()=>material),head=kit.geometry.head;
  head.computeBoundingBox();const height=head.boundingBox!.max.y-head.boundingBox!.min.y;
  assert.ok(1.76/height>6.7&&1.76/height<8,'anatomical head plus upper neck relative to stature');
  assert.ok(head.getIndex()!.count/3>5000,'close facial contours');
  assert.ok(kit.geometry.headFar.getIndex()!.count<head.getIndex()!.count*.4,'distant crowd geometry is lighter');
  const normal=head.getAttribute('normal');for(const n of normal.array)assert.ok(Number.isFinite(n));
  kit.dispose();material.dispose();
});

test('distance-driven gait plants a stance foot while the body advances and stays deterministic',()=>{
  const material=new THREE.MeshStandardMaterial(),kit=new RecreationPeople(()=>material),id=7,figure=kit.create(id,'walk'),point=new THREE.Vector3();
  const phase=pedestrianAppearance(id).phase,scale=figure.root.scale.y,start=((.1-phase+1)%1)*1.1*scale;
  const foot=figure.parts.filter(p=>p.name==='foot')[1];
  const planted=(distance:number)=>{figure.root.position.z=distance;figure.pose(0,{distance,speed:1.3,motion:1,still:true});figure.root.updateMatrixWorld(true);return foot.getWorldPosition(point).z;};
  assert.ok(Math.abs(planted(start)-planted(start+.008))<1e-7,'stance sole does not slide');
  const arc=ellipseTravel(1.25,.65),theta=1.37,delta=.0001;
  assert.ok(Math.abs((arc(theta+delta)-arc(theta))/delta-Math.hypot(1.25*Math.cos(theta),.65*Math.sin(theta)))<.03,'path speed agrees with stride distance');
  assert.ok(arc(2*Math.PI)>arc(0)&&arc(-.1)<arc(0),'loop distance stays continuous');
  kit.dispose();material.dispose();
});

test('full recreation crowds remain inside purchased parcels over animated cycles',()=>{
  const scene=new THREE.Scene(),box=new THREE.BoxGeometry(),cylinder=new THREE.CylinderGeometry(1,1,1,16),material=new THREE.MeshStandardMaterial();
  const kit:VisualKit={material:()=>material,tree:()=>{},roof:box,cylinder,box:(g,x,y,z,w,h,d)=>{const m=new THREE.Mesh(box,material);m.position.set(x,y+h/2,z);m.scale.set(w,h,d);g.add(m);return m;}};
  const places=new PlaceVisuals(scene,kit),matrix=new THREE.Matrix4();
  for(const kind of ['sports','playground','waterpark','largepark','park'] as const){
    places.beginRebuild();places[kind==='waterpark'?'waterpark':'park']({x:0,z:0,kind,age:40,level:1,occupancy:0},new THREE.Group());places.endRebuild();
    const w=['sports','waterpark','largepark'].includes(kind)?3:kind==='playground'?2:1,d=kind==='largepark'?3:kind==='playground'||kind==='sports'||kind==='waterpark'?2:1;
    for(let t=0;t<=100;t+=.5){
      places.update(t);const bounds=new THREE.Box3();
      scene.traverse(o=>{if(o instanceof THREE.InstancedMesh){o.geometry.computeBoundingBox();for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);bounds.union(o.geometry.boundingBox!.clone().applyMatrix4(matrix));}}});
      assert.ok(bounds.min.x>=-4&&bounds.max.x<=w*8-4,kind+' people x clearance');
      assert.ok(bounds.min.z>=-4&&bounds.max.z<=d*8-4,kind+' people z clearance');
    }
  }
  places.dispose();box.dispose();cylinder.dispose();material.dispose();assert.equal(scene.children.length,0);
});

test('seated visitors meet raised paths without burying shoes or stretching limbs',()=>{
  const material=new THREE.MeshStandardMaterial(),kit=new RecreationPeople(()=>material);
  for(const ground of [.43,.525,.56])for(let id=0;id<20;id++){
    const figure=kit.create(id,'sit',{ground});figure.root.position.y=ground+.28-.36*figure.root.scale.y;figure.pose(1);
    figure.root.updateMatrixWorld(true);figure.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='foot'){
      const bounds=new THREE.Box3().setFromObject(o);assert.ok(Math.abs(bounds.min.y-ground)<.001,'shoe soles meet the actual surface');
    }});
  }
  kit.dispose();material.dispose();
});

test('soccer kicks swing the striking foot through the ball while the other sole stays planted',()=>{
  const material=new THREE.MeshStandardMaterial(),kit=new RecreationPeople(()=>material);
  for(let id=0;id<10;id++){
    const player=kit.create(id,'run'),feet=player.parts.filter(p=>p.name==='foot');
    const soccer={kick:.30/.72,touch:0,receive:0,look:.3,celebrate:false};
    player.pose(2,{distance:0,speed:0,motion:0,soccer});player.root.updateMatrixWorld(true);
    const planted=new THREE.Box3().setFromObject(feet[0]);assert.ok(Math.abs(planted.min.y)<.001,'supporting foot is grounded');
    const toe=feet[1].localToWorld(new THREE.Vector3(0,.025,.16));
    const ball=new THREE.Vector3(.055,.073,.29);
    assert.ok(toe.distanceTo(ball)<.09,'striking boot reaches the ball at release');
    const joint=player.parts.find(p=>p.name==='leg'&&p.userData.joints.start[0]>0)!;
    assert.ok(joint.userData.joints.end[2]>.20,'striking leg extends forward');
    player.pose(2,{distance:0,speed:0,motion:0,soccer:{...soccer,kick:.15}});
    assert.ok(joint.userData.joints.end[2]<-.1,'backswing precedes contact');
  }
  kit.dispose();material.dispose();
});
