import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {Vehicle} from './traffic';
import {vehicleDimensions} from './worldScale';
export {vehicleDimensions} from './worldScale';

type Section = [z:number,halfWidth:number,bottom:number,top:number];

/** Rounded cross sections lofted along the chassis, with tapered nose and tail. */
function coachwork(sections:Section[],cabin=false){
  const vertices:number[]=[],indices:number[]=[],steps=16;
  for(const [z,width,bottom,top] of sections)for(let j=0;j<=steps;j++){
    const a=j/steps*Math.PI*2,cos=Math.cos(a),sin=Math.sin(a);
    const x=Math.sign(cos)*Math.pow(Math.abs(cos),.45)*width*(cabin&&sin>0?1-.12*sin:1);
    vertices.push(x,(top+bottom)/2+Math.sign(sin)*Math.pow(Math.abs(sin),.45)*(top-bottom)/2,z);
  }
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<steps;j++){
    const a=i*(steps+1)+j,b=a+steps+1;indices.push(a,a+1,b,b,a+1,b+1);
  }
  for(const end of [0,sections.length-1]){
    const [z,,bottom,top]=sections[end],center=vertices.length/3;vertices.push(0,(top+bottom)/2,z);
    for(let j=0;j<steps;j++){const a=end*(steps+1)+j;indices.push(...(end?[center,a,a+1]:[center,a+1,a]));}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}


/** Fleet-wide geometry/material cache: all live vehicles still use instance batches. */
export class VehicleModels{
  private geometries=new Map<string,THREE.BufferGeometry>();
  private materials=new Map<string,THREE.MeshStandardMaterial>();
  private geometry(key:string,make:()=>THREE.BufferGeometry){if(!this.geometries.has(key))this.geometries.set(key,make());return this.geometries.get(key)!;}
  private material(color:string,finish='paint'){
    const key=finish+color;if(!this.materials.has(key)){
      const glass=finish==='glass',metal=finish==='metal',rubber=finish==='rubber',lamp=finish==='lamp'||finish==='headlamp';
      const m=new THREE.MeshStandardMaterial({color,roughness:glass?.16:metal?.32:rubber?.95:.32,metalness:glass?.32:metal?.7:rubber?0:.25,envMapIntensity:glass?1.1:.55});
      if(lamp){m.emissive.set(color);m.emissiveIntensity=finish==='headlamp'?.18:.9;}this.materials.set(key,m);
    }return this.materials.get(key)!;
  }
  private part(g:THREE.Object3D,name:string,geo:THREE.BufferGeometry,x:number,y:number,z:number,w:number,h:number,d:number,color:string,finish='paint'){
    const m=new THREE.Mesh(geo,this.material(color,finish));m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=finish!=='lamp';m.receiveShadow=true;g.add(m);return m;
  }
  private rounded(g:THREE.Object3D,name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string,finish='paint'){
    return this.part(g,name,this.geometry('rounded',()=>new RoundedBoxGeometry(1,1,1,2,.12)),x,y,z,w,h,d,color,finish);
  }
  private strut(g:THREE.Object3D,name:string,a:THREE.Vector3,b:THREE.Vector3,width:number,color:string,finish='paint'){
    const center=a.clone().add(b).multiplyScalar(.5),direction=b.clone().sub(a);
    const m=this.rounded(g,name,center.x,center.y,center.z,width,direction.length(),width,color,finish);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return m;
  }
  create(kind:Vehicle['kind'],id:number,routeColor?:string){
    const g=new THREE.Group(),{width:w,length:l}=vehicleDimensions(kind,id),car=kind==='car'||kind==='police',bus=kind==='bus',fire=kind==='firetruck',waste=kind==='garbage';
    const paint=kind==='maintenance'?'#d99b31':kind==='police'?'#294b68':bus?routeColor||'#388d92':fire?'#ab352c':waste?'#467f5c':kind==='ambulance'?'#e9e8df':['#bbad8c','#c7cdd0','#537987','#943e34'][id%4];
    g.name=kind;g.userData.brakes=[];g.userData.indicators=[];g.userData.wheels=[];g.userData.length=l;
    const wheelRadius=car?.245:.29,wheelY=wheelRadius-.2;
    this.rounded(g,'undercarriage',0,.06,0,w*.84,.15,l*.86,'#222a2b','rubber');
    if(car){
      const hatch=id%4===0,suv=id%4===3,roof=suv?.98:.80;
      const body=this.geometry('body-'+id%4,()=>coachwork([
        [-.5,.39,.07,.35],[-.46,.49,.025,.46],[-.28,.5,.02,.49],[.12,.5,.02,.49],[.36,.48,.04,.43],[.48,.41,.08,.36],[.5,.3,.15,.30],
      ]));
      this.part(g,'sculpted body',body,0,0,0,w,suv?1.12:1,l,paint);
      const glazing=this.geometry('cabin-'+id%4,()=>coachwork([
        [hatch?-.40:-.34,.40,.46,.50],[hatch?-.29:-.20,.43,.46,roof-.05],[-.13,.435,.46,roof],[.06,.43,.46,roof],[.12,.43,.46,roof-.05],[.29,.42,.46,.51],
      ],true));
      this.part(g,'sloped glazing',glazing,0,0,0,w,1,l,'#273e48','glass');
      const roofShell=this.geometry('roof-'+id%4,()=>coachwork([[-.21,.35,roof-.06,roof-.04],[-.15,.385,roof-.035,roof+.008],[.045,.38,roof-.035,roof+.008],[.115,.35,roof-.06,roof-.04]]));
      this.part(g,'curved painted roof',roofShell,0,.04,0,w,1,l,paint);
      // Narrow B-pillars and sill lines separate individual side windows.
      for(const side of [-1,1]){
        this.strut(g,'windscreen pillar',new THREE.Vector3(side*w*.405,.51,l*.28),new THREE.Vector3(side*w*.375,roof-.045,l*.10),.04,paint);
        this.strut(g,'rear quarter pillar',new THREE.Vector3(side*w*.40,.50,l*(hatch?-.395:-.335)),new THREE.Vector3(side*w*.375,roof-.055,l*(hatch?-.285:-.195)),.045,paint);
        this.rounded(g,'window pillar',side*w*.425,(roof+.48)/2,-l*.045,.035,roof-.45,.055,paint);
        this.rounded(g,'window sill',side*w*.46,.48,-l*.03,.025,.035,l*.54,'#9ca4a3','metal');
        this.rounded(g,'door handle',side*w*.495,.40,-l*.08,.025,.035,.14,'#bdc4c2','metal');
        this.rounded(g,'wing mirror',side*w*.52,.58,l*.19,.13,.09,.17,paint);
        if(kind==='police')this.rounded(g,'white patrol door',side*w*.493,.30,-l*.025,.018,.23,l*.27,'#d9ddda');
      }
      this.strut(g,'windscreen wiper',new THREE.Vector3(-w*.29,.53,l*.277),new THREE.Vector3(w*.11,.55,l*.264),.014,'#283338','rubber');
      if(kind==='police')this.lightbar(g,roof+.12);
    }else if(bus){
      this.rounded(g,'rounded bus body',0,.64,0,w,1.25,l,paint);
      this.rounded(g,'panoramic bus glazing',0,1.15,.04,w*.97,.55,l*.97,'#263f49','glass');
      this.rounded(g,'bus roof',0,1.45,0,w*.97,.14,l*.96,'#c6ccca');
      this.rounded(g,'roof ventilation',0,1.55,-.45,w*.58,.13,1.0,'#a9b4b3','metal');
      for(const side of [-1,1])for(let z=-l*.36;z<l*.4;z+=.55)this.rounded(g,'bus window pillar',side*w*.49,1.13,z,.035,.54,.045,paint);
      for(const z of [l*.25,-l*.25])this.rounded(g,'bus door seam',w*.505,.63,z,.018,1.0,.035,'#253437','rubber');
      this.rounded(g,'destination display',0,1.28,l*.493,w*.66,.14,.025,'#242d2b','rubber');
      this.rounded(g,'route display',0,1.29,l*.509,w*.42,.045,.015,'#e6c68a','lamp');
    }else{
      // Independent rounded cab, raked windscreen and purpose-specific rear equipment.
      const cabZ=l*.29,cabLength=l*.36;
      this.rounded(g,'truck cab',0,.42,cabZ,w*.96,.78,cabLength*.96,waste?'#dbded5':paint);
      const cab=this.geometry('truck-glass',()=>coachwork([[-.5,.46,.75,1.20],[.21,.46,.75,1.20],[.5,.43,.75,.91]],true));
      this.part(g,'raked truck windshield',cab,0,0,cabZ,w,1,cabLength,'#2d4650','glass');
      this.rounded(g,'cab roof',0,1.22,cabZ-cabLength*.08,w*.88,.11,cabLength*.76,paint);
      for(const side of [-1,1])this.strut(g,'cab windscreen pillar',new THREE.Vector3(side*w*.425,.92,cabZ+cabLength*.49),new THREE.Vector3(side*w*.41,1.19,cabZ+cabLength*.21),.045,paint);
      for(const side of [-1,1])this.rounded(g,'truck mirror',side*w*.54,.95,cabZ+cabLength*.22,.13,.18,.13,'#525d60','metal');
      if(kind==='maintenance'){
        this.rounded(g,'salt hopper',0,.65,-l*.18,w*.87,.85,l*.53,'#9baba6','metal');
        this.rounded(g,'salt load',0,1.04,-l*.18,w*.73,.12,l*.42,'#e4dfcb');
        this.rounded(g,'snowplow blade',0,.12,l*.47,w*1.08,.42,.18,paint);
        for(const side of [-1,1])this.strut(g,'plow support',new THREE.Vector3(side*.4,.1,l*.3),new THREE.Vector3(side*.5,.05,l*.46),.08,'#4f5d5d','metal');
        g.userData.lights=[this.rounded(g,'amber roof beacon',0,1.35,cabZ,.3,.14,.2,'#ffb532','lamp')];
      }else if(waste){
        this.rounded(g,'curved refuse hopper',0,.86,-l*.18,w,1.45,l*.61,paint);
        this.rounded(g,'rear compactor',0,.72,-l*.47,w*.89,1.08,.28,'#65776a','metal');
        this.rounded(g,'hopper opening',0,.52,-l*.511,w*.67,.46,.045,'#263a2d','rubber');
        for(const side of [-1,1])this.rounded(g,'hydraulic ram',side*w*.35,.93,-l*.50,.08,.78,.09,'#c0c7c0','metal');
        this.rounded(g,'amber beacon',0,1.35,cabZ,.23,.15,.23,'#f4ac36','lamp');
      }else if(fire){
        this.rounded(g,'equipment body',0,.64,-l*.18,w,1.05,l*.59,paint);
        for(const side of [-1,1])for(const z of [-l*.31,-l*.06]){
          this.rounded(g,'equipment shutter',side*w*.504,.67,z,.025,.68,l*.22,'#9fa9a8','metal');
          for(let y=.4;y<.94;y+=.12)this.rounded(g,'shutter groove',side*w*.52,y,z,.012,.018,l*.20,'#6d7b7e','metal');
        }
        for(const side of [-1,1])this.rounded(g,'ladder rail',side*.25,1.28,-l*.18,.055,.08,l*.64,'#bdc3bd','metal');
        for(let z=-l*.46;z<l*.13;z+=.24)this.rounded(g,'ladder rung',0,1.29,z,.52,.045,.045,'#bdc3bd','metal');
        this.lightbar(g,1.35,cabZ);
      }else{
        this.rounded(g,'ambulance patient module',0,.76,-l*.18,w,1.45,l*.62,'#e3e5df');
        for(const side of [-1,1]){
          this.rounded(g,'medical stripe',side*w*.505,.60,-l*.18,.025,.14,l*.57,'#aa413b');
          this.rounded(g,'medical cross vertical',side*w*.52,1.03,-l*.17,.025,.32,.095,'#aa413b');
          this.rounded(g,'medical cross horizontal',side*w*.52,1.03,-l*.17,.026,.095,.32,'#aa413b');
        }
        this.rounded(g,'rear door seam',0,.80,-l*.495,.025,1.15,.025,'#89938f','metal');
        this.lightbar(g,1.57,-l*.05);
      }
    }
    // Circular rubber tires, metal hubs and curved fender lips, shared across the fleet.
    const tire=this.geometry('tire',()=>{const t=new THREE.TorusGeometry(.75,.25,8,20);t.rotateY(Math.PI/2);return t;});
    const hub=this.geometry('hub',()=>{const t=new THREE.CylinderGeometry(.53,.53,.53,16);t.rotateZ(Math.PI/2);return t;});
    const arch=this.geometry('arch',()=>{const t=new THREE.TorusGeometry(1,.065,5,20,Math.PI);t.rotateY(Math.PI/2);return t;});
    const axles=waste?[-l*.32,-l*.12,l*.31]:[-l*.30,l*.30];
    for(const side of [-1,1])for(const z of axles){
      const wheel=new THREE.Group();wheel.position.set(side*w*.47,wheelY,z);g.add(wheel);g.userData.wheels.push(wheel);
      this.part(wheel,'round tire',tire,0,0,0,wheelRadius,wheelRadius,wheelRadius,'#1f2425','rubber');
      this.part(wheel,'alloy hub',hub,side*.012,0,0,wheelRadius,wheelRadius,wheelRadius,'#9ea7aa','metal');
      for(let spoke=0;spoke<3;spoke++){const m=this.rounded(wheel,'wheel spoke',side*wheelRadius*.28,0,0,.018,wheelRadius*.84,.035,'#d3d8d8','metal');m.rotation.x=spoke*Math.PI/3;}
      this.part(g,'arched fender',arch,side*w*.50,wheelY,z,wheelRadius*1.14,wheelRadius*1.14,wheelRadius*1.14,car?paint:'#465050',car?'paint':'rubber');
    }
    this.rounded(g,'front grille',0,.23,l*.501,w*.38,.12,.035,'#263237','rubber');
    this.rounded(g,'front bumper',0,.09,l*.497,w*.81,.08,.08,'#949fa0','metal');
    this.rounded(g,'rear bumper',0,.09,-l*.497,w*.81,.08,.08,'#788587','metal');
    for(const side of [-1,1]){
      this.rounded(g,'headlight',side*w*(car?.24:.32),.31,l*.501,w*(car?.18:.23),.085,.035,'#dbe4da','headlamp');
      this.rounded(g,'tail lamp',side*w*.35,.31,-l*.499,w*.15,.13,.055,'#83332e');
      g.userData.brakes.push(this.rounded(g,'brake lamp',side*w*.35,.31,-l*.51,w*.15,.13,.035,'#ff5041','lamp'));
      g.userData.indicators.push(this.rounded(g,'indicator',side*w*.46,.39,l*.43,.075,.07,.10,'#ffae38','lamp'));
    }
    return g;
  }
  private lightbar(g:THREE.Group,y:number,z=0){
    this.rounded(g,'lightbar mount',0,y-.05,z,.82,.07,.22,'#354449','metal');
    g.userData.lights=[this.rounded(g,'red beacon',-.25,y,z,.34,.12,.20,'#ff493d','lamp'),this.rounded(g,'blue beacon',.25,y,z,.34,.12,.20,'#4ebfff','lamp')];
  }
  dispose(){for(const g of this.geometries.values())g.dispose();for(const m of this.materials.values())m.dispose();this.geometries.clear();this.materials.clear();}
}
