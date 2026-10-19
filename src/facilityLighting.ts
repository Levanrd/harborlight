import * as THREE from 'three';
import {isFacilityRoot,isRecreation,recreationConfig} from './recreation';
import {isRegional,regionalConfig} from './regional';
import type {Cell} from './simulation';

export type LocalLight={position:THREE.Vector3;target:THREE.Vector3;color?:string;intensity?:number;distance?:number;angle?:number};
export type FixtureKind='lantern'|'bollard'|'flood'|'pool'|'marker'|'canopy';
export type FacilityLightSite={x:number;y:number;z:number;height:number;kind:FixtureKind;cool:boolean;target:{x:number;y:number;z:number};width:number;depth:number};

/** Positions are authored around each facility's actual footprint. Poles stay
 * off pitches, water, play equipment, train tracks and the airport runway. */
export function facilityLightSites(c:Cell):FacilityLightSite[]{
  if(c.kind==='road'||!isFacilityRoot(c))return [];
  const cfg=isRegional(c.kind)?regionalConfig[c.kind]:isRecreation(c.kind)?recreationConfig[c.kind]:{width:1,depth:1};
  const x=(c.x+(cfg.width-1)/2)*8,z=(c.z+(cfg.depth-1)/2)*8,sites:FacilityLightSite[]=[];
  const add=(dx:number,dz:number,kind:FixtureKind='lantern',height=2.7,cool=false,tx=dx,tz=dz,y=.43,width=4,depth=4,targetY=y+.015)=>sites.push({x:x+dx,y,z:z+dz,height,kind,cool,target:{x:x+tx,y:targetY,z:z+tz},width,depth});
  if(c.kind==='sports'){
    for(const dx of [-10.9,10.9])for(const dz of [-6.3,6.3])add(dx,dz,'flood',5.5,true,dx*.42,dz*.35,.55,12,8.8);
  }else if(c.kind==='waterpark'){
    for(const [dx,dz]of [[-8,-6],[-9,6],[8,-6],[8,6]])add(dx,dz,'lantern',3.2,false,dx,dz,.54,5.5,4);
    for(const dz of [-2.8,2.8])add(-4.6,dz,'pool',.09,true,1,dz*.4,.65,10.8,7.6,.624);
    add(-7,5.9,'pool',.08,true,-7,4,.68,3.5,3.5,.615);
  }else if(c.kind==='largepark'){
    for(const [dx,dz,tx]of [[0,-8,1.8],[4.1,-8,1.8],[0,8,2.3],[4.5,8,2.3]])add(dx,dz,'lantern',2.5,false,tx,dz,.525,4,5);
    add(-3.8,-.1,'lantern',2.5,false,-3.8,-1.7,.525,5,5);add(4.7,.8,'lantern',2.5,false,2.8,.8,.525,5,5);
    for(const [dx,dz,tx,tz]of [[-8,-2.2,-8,-.1],[-8,1.6,-8,-.1],[8,-3.4,8,-1.7],[6.5,.3,6.5,-2]])add(dx,dz,'bollard',.85,false,tx,tz,.525,4,4);
  }else if(c.kind==='playground'){
    for(const [dx,dz]of [[-6,-5.8],[-6,5.8],[6,5.8],[6,-2.5]])add(dx,dz,'lantern',3,false,dx*.65,dz*.65,.54,6,6);
  }else if(c.kind==='park'){
    for(const [dx,dz]of [[-3.1,2],[3.25,1.5]])add(dx,dz,'lantern',2.2,false,dx*.55,0,.43,3.8,4.5);
  }else if(c.kind==='airport'){
    for(const dx of [-19,0,19])add(dx,-3.7,'flood',6,true,dx,0,.55,13,8);
    for(const dx of [-18,-6,6,18])add(dx,-14.4,'lantern',3.4,false,dx,-13,.49,7,4);
    for(let dx=-18;dx<=18;dx+=6)for(const dz of [.15,3.85])add(dx,dz,'marker',.12,true,dx,dz,.55,1.1,1.1);
  }else if(c.kind==='seaport'){
    for(const dx of [-10.4,7.8])for(const dz of [-10.4,10.4])add(dx,dz,'flood',5.8,true,dx*.7,dz*.6,.55,9,9);
  }else if(c.kind==='railway'){
    for(const dx of [-10,-5,0,5,10])add(dx,0,'canopy',0,false,dx,0,3.88,4.8,3.5,1.22);
    for(const dx of [-14,14])add(dx,-6,'lantern',3,false,dx,-5,.49,5,4);
  }else if(c.coastal==='resort'){
    for(const dz of [-3.25,3.25])add(3.45,dz,'bollard',.9,false,2.7,dz,.53,2.5,3);
    add(-3.45,3.15,'lantern',2.4,false,-2.8,3.15,.43,3,3);
    add(2.25,.6,'pool',.06,true,2.7,.6,.64,.86,2.9,.624);
  }else if(c.coastal){
    for(const dz of [-2.8,2.8])add(3.4,dz,'bollard',1,false,2.8,dz,.53,3,3);
    add(-3.4,3.15,'lantern',2.4);
  }else{
    const work=['industrial','maintenance','landfill','recycling','power','water','sewage','utility'].includes(c.kind);
    const edge=c.kind==='landfill'?2.85:3.35,front=c.kind==='landfill'?2.85:3.2;
    for(const dx of [-edge,edge])add(dx,front,work?'flood':'lantern',work?3.7:2.5,work,dx*.8,2.8,.38,3.6,3.4);
    if(work)for(const dx of [-edge,edge])add(dx,-front,'flood',3.7,true,dx*.8,-2.8,.38,3.6,3.4);
  }
  return sites;
}

/** Batched fixture housings and light pools at every site. Real illumination is
 * supplied by the same capped nearby spotlight pool as the street lamps. */
export class FacilityLighting{
  readonly sources:LocalLight[]=[];
  private cylinder=new THREE.CylinderGeometry(1,1,1,12);
  private box=new THREE.BoxGeometry();private sphere=new THREE.SphereGeometry(1,12,8);
  private plane=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  private metal=new THREE.MeshStandardMaterial({color:'#52666c',metalness:.65,roughness:.45});
  private trim=new THREE.MeshStandardMaterial({color:'#87938a',metalness:.45,roughness:.65});
  private warm=new THREE.MeshStandardMaterial({color:'#f4e3bd',emissive:'#ffc778',emissiveIntensity:0,roughness:.35});
  private cool=new THREE.MeshStandardMaterial({color:'#d8eef3',emissive:'#c3e7ff',emissiveIntensity:0,roughness:.3});
  private blue=new THREE.MeshStandardMaterial({color:'#72cbd9',emissive:'#4bc8ed',emissiveIntensity:0,roughness:.25});
  private warmPool:THREE.MeshBasicMaterial;private coolPool:THREE.MeshBasicMaterial;private waterPool:THREE.MeshBasicMaterial;
  private texture:THREE.DataTexture;
  constructor(){
    const pixels=new Uint8Array(128*128*4);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4,r=Math.min(1,Math.hypot(x-63.5,y-63.5)/64);pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(122*(1-r)**1.5);}
    this.texture=new THREE.DataTexture(pixels,128,128);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.magFilter=THREE.LinearFilter;this.texture.needsUpdate=true;
    const pool=(color:string)=>new THREE.MeshBasicMaterial({color,map:this.texture,transparent:true,opacity:0,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,blending:THREE.AdditiveBlending});
    this.warmPool=pool('#ffcf88');this.coolPool=pool('#c1deed');this.waterPool=pool('#36cbe0');
  }
  beginRebuild(){this.sources.length=0;}
  private part(g:THREE.Group,geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,name:string){
    const m=new THREE.Mesh(geo,mat);m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=mat===this.metal||mat===this.trim;m.receiveShadow=true;g.add(m);return m;
  }
  draw(c:Cell,parent:THREE.Group){
    for(const s of facilityLightSites(c)){
      const g=new THREE.Group();g.name='Facility light · '+s.kind;g.position.set(s.x,s.y,s.z);parent.add(g);
      const led=s.kind==='pool'||s.kind==='marker'?this.blue:s.cool?this.cool:this.warm;
      if(s.kind==='pool'){
        g.rotation.y=Math.atan2(-(s.target.z-s.z),s.target.x-s.x);
        this.part(g,this.box,this.trim,0,0,0,.075,.13,.23,'Pool light surround');this.part(g,this.box,led,.043,0,0,.018,.09,.18,'Underwater lamp');
      }else if(s.kind==='marker'){
        this.part(g,this.cylinder,this.trim,0,.035,0,.08,.07,.08,'Taxiway light base');this.part(g,this.sphere,led,0,.12,0,.052,.055,.052,'Blue taxiway lamp');
      }else if(s.kind==='canopy'){
        this.part(g,this.box,this.metal,0,.045,0,.23,.07,3.75,'Platform light housing');this.part(g,this.box,led,0,0,0,.14,.025,3.55,'Platform downlight');
      }else{
        const bollard=s.kind==='bollard',flood=s.kind==='flood';
        this.part(g,this.cylinder,this.trim,0,.065,0,bollard?.13:.18,.13,bollard?.13:.18,'Lamp footing');
        this.part(g,this.cylinder,this.metal,0,s.height/2,0,bollard?.085:.052,s.height,bollard?.085:.052,'Light pole');
        if(flood){
          const head=new THREE.Group();head.position.y=s.height;head.lookAt(new THREE.Vector3(s.target.x-s.x,s.target.y-s.y,s.target.z-s.z));g.add(head);
          for(const side of [-1,1]){this.part(head,this.box,this.metal,side*.24,0,0,.42,.29,.16,'Floodlight housing');this.part(head,this.box,led,side*.24,0,.091,.35,.22,.025,'Floodlight lens');}
        }else{
          this.part(g,this.cylinder,this.metal,0,s.height+.16,0,bollard?.12:.22,.07,bollard?.12:.22,'Downlight cap');
          this.part(g,this.cylinder,led,0,s.height+.055,0,bollard?.105:.16,.13,bollard?.105:.16,'Lantern diffuser');
          if(!bollard)for(const side of [-1,1])this.part(g,this.box,this.metal,side*.16,s.height+.06,0,.02,.19,.02,'Lantern frame');
        }
      }
      const pool=new THREE.Mesh(this.plane,s.kind==='pool'?this.waterPool:s.cool?this.coolPool:this.warmPool);pool.name='Light pool';pool.position.set(s.target.x,s.target.y,s.target.z);pool.scale.set(s.width,1,s.depth);pool.renderOrder=1;pool.userData.lightPool=true;parent.add(pool);
      if(s.kind!=='marker')this.sources.push({position:new THREE.Vector3(s.x,s.y+s.height,s.z),target:new THREE.Vector3(s.target.x,s.target.y,s.target.z),color:s.kind==='pool'?'#52cce2':s.cool?'#d4e9ff':'#ffd59b',intensity:s.kind==='flood'?115:s.kind==='canopy'?28:s.kind==='pool'?9:s.kind==='bollard'?7:26,distance:s.kind==='flood'?24:12,angle:s.kind==='flood'?.68:.92});
    }
  }
  update(night:number){const amount=THREE.MathUtils.clamp(night,0,1);this.warm.emissiveIntensity=amount*3;this.cool.emissiveIntensity=amount*3.5;this.blue.emissiveIntensity=amount*3;this.warmPool.opacity=amount*.42;this.coolPool.opacity=amount*.34;this.waterPool.opacity=amount*.6;}
  dispose(){for(const geo of [this.cylinder,this.box,this.sphere,this.plane])geo.dispose();for(const mat of [this.metal,this.trim,this.warm,this.cool,this.blue,this.warmPool,this.coolPool,this.waterPool])mat.dispose();this.texture.dispose();this.sources.length=0;}
}
