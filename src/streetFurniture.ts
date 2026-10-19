import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {Cell} from './simulation';
import type {Quality} from './environment';
import {signalAspect} from './traffic';

const directions=[[-1,0],[1,0],[0,-1],[0,1]] as const;
/** Posts stay on the sidewalk; only overhead arms extend over the carriageway. */
export function streetLampSites(c:Cell,links:boolean[]){
  const count=links.filter(Boolean).length;
  if(count>=3||!count||Math.abs(c.x+c.z)%3!==0)return [];
  const ew=links[0]&&links[1],ns=links[2]&&links[3];
  if(!ew&&!ns)return [];
  const side=(Math.floor((c.x+c.z)/3)%2===0?1:-1),edge=c.avenue?3.78:3.58;
  return (c.avenue?[side,-side]:[side]).map(s=>({x:c.x*8+(ns?s*edge:0),z:c.z*8+(ew?s*edge:0),dx:ns?-s:0,dz:ew?-s:0}));
}
export function signalSites(c:Cell,links:boolean[]){
  if(links.filter(Boolean).length<3)return [];
  return directions.flatMap(([dx,dz],i)=>links[i]?[{x:c.x*8+(dx-dz)*3.72,z:c.z*8+(dz+dx)*3.72,dx,dz,axis:(dx?'ew':'ns') as 'ew'|'ns'}]:[]);
}

/** Shared geometry + one instanced lens batch. Four nearby real lights at High. */
export class StreetFurniture {
  private cylinder=new THREE.CylinderGeometry(.68,1,1,12);
  private roundBox=new RoundedBoxGeometry(1,1,1,2,.075);
  private sphere=new THREE.SphereGeometry(1,12,8);
  private visor=new THREE.CylinderGeometry(1,1,1,16,1,true,0,Math.PI*1.5);
  private arm=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,5.75,0),new THREE.Vector3(0,6.05,.07),new THREE.Vector3(0,6.28,.35),new THREE.Vector3(0,6.34,.8),new THREE.Vector3(0,6.34,1.2)]),12,.055,8,false);
  private plane=new THREE.PlaneGeometry(1,1);
  private metal=new THREE.MeshStandardMaterial({color:'#74818a',roughness:.46,metalness:.65});
  private base=new THREE.MeshStandardMaterial({color:'#93948c',roughness:.9});
  private dark=new THREE.MeshStandardMaterial({color:'#20282a',roughness:.65,metalness:.2});
  private border=new THREE.MeshStandardMaterial({color:'#c9b781',roughness:.7});
  private lens=new THREE.MeshStandardMaterial({color:'#172021',roughness:.22,metalness:.25});
  private led=new THREE.MeshStandardMaterial({color:'#e8e8df',emissive:'#ffe3b3',emissiveIntensity:0,roughness:.3});
  private litMat=new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false});
  private poolMat:THREE.MeshBasicMaterial;
  private poolTexture:THREE.CanvasTexture;
  private signals:{key:string;axis:'ew'|'ns';matrix:THREE.Matrix4}[]=[];
  private lights:{position:THREE.Vector3;target:THREE.Vector3}[]=[];
  private spots:THREE.SpotLight[]=[];
  private lit:THREE.InstancedMesh;
  private lastPhase='';private lightLimit=4;private lightTick=0;
  private dummy=new THREE.Object3D();private matrix=new THREE.Matrix4();private tint=new THREE.Color();
  constructor(private scene:THREE.Scene){
    this.plane.rotateX(-Math.PI/2);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(64,64,2,64,64,64);
    gradient.addColorStop(0,'rgba(255,234,202,.32)');gradient.addColorStop(.35,'rgba(255,234,202,.16)');gradient.addColorStop(.72,'rgba(255,234,202,.04)');gradient.addColorStop(1,'rgba(255,234,202,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    this.poolTexture=new THREE.CanvasTexture(canvas);this.poolTexture.colorSpace=THREE.SRGBColorSpace;
    this.poolMat=new THREE.MeshBasicMaterial({map:this.poolTexture,transparent:true,opacity:0,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});
    this.lit=new THREE.InstancedMesh(this.sphere,this.litMat,6144);this.lit.count=0;this.lit.frustumCulled=false;this.lit.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.lit);
    for(let i=0;i<6;i++){const light=new THREE.SpotLight('#ffe7c1',0,16,Math.PI*.29,.9,2);light.castShadow=false;scene.add(light,light.target);this.spots.push(light);}
  }
  private part(g:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
  }
  private pole(g:THREE.Group,height:number){
    this.part(g,this.roundBox,this.base,0,.12,0,.3,.24,.3);
    this.part(g,this.cylinder,this.metal,0,height/2,0,.095,height,.095);
    this.part(g,this.roundBox,this.metal,0,.28,0,.23,.08,.23);
    this.part(g,this.roundBox,this.dark,0,1.05,.079,.07,.32,.022);
    for(const dx of [-.09,.09])for(const dz of [-.09,.09])this.part(g,this.cylinder,this.dark,dx,.33,dz,.018,.035,.018);
  }
  private luminaire(g:THREE.Group,poolParent:THREE.Group){
    const arm=new THREE.Mesh(this.arm,this.metal);arm.castShadow=true;g.add(arm);
    this.part(g,this.roundBox,this.metal,0,6.31,1.28,.35,.17,.82);
    this.part(g,this.roundBox,this.dark,0,6.24,1.28,.3,.035,.7);
    this.part(g,this.roundBox,this.led,0,6.21,1.28,.25,.022,.62);
    // Small heat-sink grooves give the housing a recognizable manufactured profile.
    for(let i=-2;i<=2;i++)this.part(g,this.roundBox,this.dark,i*.045,6.405,1.18,.015,.025,.4);
    g.updateMatrixWorld(true);
    const position=g.localToWorld(new THREE.Vector3(0,6.16,1.28)),target=g.localToWorld(new THREE.Vector3(0,0,2.5));
    this.lights.push({position,target});
    const pool=new THREE.Mesh(this.plane,this.poolMat);pool.position.copy(target);pool.position.y=.287;pool.scale.set(6.4,1,10);g.getWorldQuaternion(pool.quaternion);poolParent.add(pool);
  }
  beginRebuild(){this.signals=[];this.lights=[];this.lastPhase='';this.lightTick=0;}
  draw(c:Cell,links:boolean[],parent:THREE.Group){
    for(const site of streetLampSites(c,links)){
      const g=new THREE.Group();g.position.set(site.x,.45,site.z);g.rotation.y=Math.atan2(site.dx,site.dz);parent.add(g);this.pole(g,5.8);this.luminaire(g,parent);
    }
    for(const [i,site]of signalSites(c,links).entries()){
      const g=new THREE.Group();g.position.set(site.x,.45,site.z);g.rotation.y=Math.atan2(site.dx,site.dz);parent.add(g);
      this.pole(g,i%2===0?5.8:2.75);
      // Black backboard with a narrow reflective border; three distinct round lenses.
      this.part(g,this.roundBox,this.border,0,2.1,.08,.34,.89,.08);
      this.part(g,this.roundBox,this.dark,0,2.1,.14,.30,.82,.18);
      for(const dy of [-.24,0,.24]){
        this.part(g,this.sphere,this.lens,0,2.1+dy,.245,.09,.09,.03);
        const hood=this.part(g,this.visor,this.dark,0,2.1+dy,.30,.11,.16,.11);hood.rotation.x=Math.PI/2;hood.rotation.z=Math.PI*.25;
      }
      // Pole clamps and controller box sit outside the driving lanes.
      for(const y of [1.8,2.4])this.part(g,this.roundBox,this.metal,0,y,-.04,.19,.06,.25);
      this.part(g,this.roundBox,this.dark,0,1.2,-.15,.23,.36,.15);
      g.updateMatrixWorld(true);this.signals.push({key:`${c.x},${c.z}`,axis:site.axis,matrix:g.matrixWorld.clone()});
      if(i%2===0){const head=new THREE.Group();head.rotation.y=Math.PI*.75;g.add(head);this.luminaire(head,parent);}
    }
  }
  quality(q:Quality){this.lightLimit={low:0,medium:2,high:4,ultra:6}[q];this.lightTick=0;}
  update(time:number,night:number,camera:THREE.Camera){
    this.led.emissiveIntensity=night*2.3;this.poolMat.opacity=night*.6;
    const phase=String(Math.floor(time*10));
    if(phase!==this.lastPhase){this.lastPhase=phase;this.lit.count=this.signals.length;
      this.signals.forEach((signal,i)=>{const aspect=signalAspect(time,signal.key,signal.axis),dy=aspect==='red'?.24:aspect==='amber'?0:-.24;
        this.dummy.position.set(0,2.1+dy,.254);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(.08,.08,.032);this.dummy.updateMatrix();this.matrix.multiplyMatrices(signal.matrix,this.dummy.matrix);this.lit.setMatrixAt(i,this.matrix);this.lit.setColorAt(i,this.tint.set(aspect==='red'?'#ff3825':aspect==='amber'?'#ffb521':'#46ed98'));
      });this.lit.instanceMatrix.needsUpdate=true;if(this.lit.instanceColor)this.lit.instanceColor.needsUpdate=true;
    }
    if(this.lightTick++%20===0){
      const nearest=[...this.lights].sort((a,b)=>camera.position.distanceToSquared(a.position)-camera.position.distanceToSquared(b.position));
      this.spots.forEach((spot,i)=>{const source=nearest[i];spot.userData.active=!!source&&i<this.lightLimit;if(source){spot.position.copy(source.position);spot.target.position.copy(source.target);}});
    }
    for(const spot of this.spots)spot.intensity=spot.userData.active?night*38:0;
  }
  dispose(){
    this.scene.remove(this.lit);this.lit.dispose();
    for(const spot of this.spots){this.scene.remove(spot,spot.target);spot.dispose();}
    for(const geometry of [this.cylinder,this.roundBox,this.sphere,this.visor,this.arm,this.plane])geometry.dispose();
    for(const material of [this.metal,this.base,this.dark,this.border,this.lens,this.led,this.litMat,this.poolMat])material.dispose();this.poolTexture.dispose();
  }
}
