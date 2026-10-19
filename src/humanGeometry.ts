import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {humanHeadData} from './assets/humanHeadData';

type Ring=[number,number,number,number]; // height, half-width, front and back depth
const gauss=(x:number,mean:number,width:number)=>Math.exp(-(((x-mean)/width)**2));

/** Smooth elliptical cross sections, authored in metres. Unlike scaled spheres,
 * these retain a jaw, ribcage, waist, muscle bellies and narrow joints. */
function loft(rings:Ring[],segments=20){
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
  rings.forEach(([y,width,front,back],row)=>{
    for(let i=0;i<=segments;i++){
      const angle=i/segments*Math.PI*2,s=Math.sin(angle),c=Math.cos(angle),x=s*width;
      const z=c*(c>=0?front:back);
      vertices.push(x,y,z);
      uvs.push(i/segments,row/(rings.length-1));
      if(row&&i){const a=(row-1)*(segments+1)+i-1,b=row*(segments+1)+i-1;indices.push(a,a+1,b,b,a+1,b+1);}
    }
  });
  // Closed ends prevent visible holes at sleeves, wrists and trouser hems.
  for(const top of [false,true]){const row=top?rings.length-1:0,center=vertices.length/3;vertices.push(0,rings[row][0],0);uvs.push(.5,top?1:0);for(let i=0;i<segments;i++){const a=row*(segments+1)+i;indices.push(center,top?a:a+1,top?a+1:a);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  const normals=geometry.getAttribute('normal'),seam=new THREE.Vector3();
  for(let row=0;row<rings.length;row++){
    const a=row*(segments+1),b=a+segments;
    seam.set(normals.getX(a)+normals.getX(b),normals.getY(a)+normals.getY(b),normals.getZ(a)+normals.getZ(b)).normalize();
    normals.setXYZ(a,seam.x,seam.y,seam.z);normals.setXYZ(b,seam.x,seam.y,seam.z);
  }
  return geometry;
}

function scannedHead(data:{position:number[];index:number[]}){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.position,3));
  const opened:number[]=[];for(let i=0;i<data.index.length;i+=3){let x=0,y=0,z=0;for(let j=0;j<3;j++){const k=data.index[i+j]*3;x+=data.position[k]/3;y+=data.position[k+1]/3;z+=data.position[k+2]/3;}const eye=z>.065&&(((Math.abs(x)-.0365)/.013)**2+((y+.0015)/.006)**2<1);if(!eye)opened.push(data.index[i],data.index[i+1],data.index[i+2]);}
  geometry.setIndex(opened);geometry.computeVertexNormals();
  const p=geometry.getAttribute('position'),colors=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),front=THREE.MathUtils.smoothstep(z,.02,.07),lip=gauss(x,0,.025)*gauss(y,-.079,.008)*front;colors.push(1-lip*.05,1-lip*.16,1-lip*.13);}
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geometry;
}

function mirrorHand(hand:THREE.BufferGeometry){
  const mirrored=hand.clone().scale(-1,1,1),indices=mirrored.getIndex()!;
  for(let i=0;i<indices.count;i+=3){const a=indices.getX(i);indices.setX(i,indices.getX(i+1));indices.setX(i+1,a);}
  mirrored.computeVertexNormals();return mirrored;
}

export class HumanGeometry{
  readonly joint=new THREE.SphereGeometry(1,12,8);
  readonly head=scannedHead(humanHeadData);
  readonly headFar=scannedHead(humanHeadData.far);
  readonly hair:THREE.BufferGeometry;
  readonly torso=loft([[0,.153,.104,.095],[.12,.151,.103,.094],[.28,.153,.107,.098],[.48,.174,.119,.108],[.66,.194,.125,.112],[.80,.215,.112,.108],[.87,.213,.099,.098],[.94,.178,.077,.076],[.97,.13,.062,.060],[1,.053,.052,.049]],24);
  readonly pelvis=loft([[-.5,.138,.091,.096],[-.3,.158,.107,.112],[0,.166,.106,.112],[.35,.155,.096,.103],[.5,.15,.092,.096]],20);
  // Continuous skin from shoulder to wrist and hip to ankle. Extra rings across
  // the joint distribute deformation instead of exposing a ball and two caps.
  readonly arm=loft([[-.25,.024,.024,.024],[-.22,.025,.026,.025],[-.15,.034,.035,.033],[-.09,.040,.041,.038],[-.045,.035,.035,.034],[-.02,.032,.033,.032],[0,.032,.033,.033],[.02,.034,.035,.034],[.045,.038,.039,.038],[.10,.047,.048,.045],[.18,.054,.054,.052],[.25,.055,.054,.053],[.28,.047,.047,.046],[.298,.030,.030,.029],[.31,.004,.004,.004]],20);
  readonly leg=loft([[-.472,.023,.023,.025],[-.445,.025,.025,.027],[-.425,.026,.026,.028],[-.36,.029,.028,.032],[-.27,.040,.035,.049],[-.18,.048,.040,.055],[-.09,.043,.040,.048],[-.045,.039,.039,.041],[-.02,.039,.040,.041],[0,.040,.042,.042],[.02,.042,.043,.043],[.045,.045,.046,.046],[.12,.058,.059,.061],[.25,.075,.076,.077],[.36,.077,.077,.078],[.425,.068,.069,.071]],20);
  readonly hand:THREE.BufferGeometry;
  readonly leftHand:THREE.BufferGeometry;
  readonly relaxedHand:THREE.BufferGeometry;
  readonly leftRelaxedHand:THREE.BufferGeometry;
  readonly shoe=loft([[0,.048,.16,.073],[.009,.050,.162,.074],[.020,.049,.158,.073],[.035,.047,.15,.068],[.052,.043,.129,.061],[.072,.036,.086,.051],[.09,.030,.037,.041],[.105,.026,.025,.032]],20);
  readonly geometries:THREE.BufferGeometry[];
  constructor(){
    this.arm.userData.humanLimb=true;this.leg.userData.humanLimb=true;
    // Fit the scalp directly to the scan, with a receding hairline and small
    // strand-scale variation instead of a detached hemispherical cap.
    const p=this.head.getAttribute('position'),indices=this.head.getIndex()!,hairIndices:number[]=[],hairPositions:number[]=[];
    const onScalp=(i:number)=>p.getY(i)>(p.getZ(i)>.02?.052:p.getZ(i)<-.04?-.025:.005);
    for(let i=0;i<indices.count;i+=3){const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);if(onScalp(a)&&onScalp(b)&&onScalp(c))hairIndices.push(a,b,c);}
    for(let i=0;i<p.count;i++){const variation=Math.sin(i*8.7)*.0003;hairPositions.push(p.getX(i)*1.015,p.getY(i)+.001+variation,p.getZ(i)*1.015);}
    this.hair=new THREE.BufferGeometry();this.hair.setAttribute('position',new THREE.Float32BufferAttribute(hairPositions,3));this.hair.setIndex(hairIndices);this.hair.computeVertexNormals();
    const palm=loft([[-.092,.029,.013,.013],[-.071,.036,.014,.014],[-.025,.033,.014,.014],[0,.023,.012,.012]],12),pieces=[palm];
    for(let i=0;i<4;i++){const length=[.060,.077,.071,.053][i],finger=loft([[-length,.003,.004,.004],[-length+.007,.006,.006,.006],[-.012,.007,.007,.007],[0,.008,.007,.007]],10);finger.translate((i-1.5)*.017,-.082,0);pieces.push(finger);}
    const thumb=loft([[-.054,.004,.005,.005],[-.042,.008,.008,.008],[-.008,.010,.009,.009],[0,.009,.009,.009]],10);thumb.rotateZ(-.65);thumb.translate(-.03,-.031,.004);pieces.push(thumb);
    this.hand=mergeGeometries(pieces)!;pieces.forEach(p=>p.dispose());
    this.leftHand=mirrorHand(this.hand);
    this.relaxedHand=this.hand.clone();const fingers=this.relaxedHand.getAttribute('position');
    for(let i=0;i<fingers.count;i++){
      const y=fingers.getY(i),distance=Math.max(0,-y-.079),angle=distance/.077*1.9;
      if(distance>0)fingers.setXYZ(i,fingers.getX(i)*.94,-.079-Math.sin(angle)*.077/1.9,fingers.getZ(i)+(1-Math.cos(angle))*.077/1.9);
    }
    this.relaxedHand.computeVertexNormals();this.leftRelaxedHand=mirrorHand(this.relaxedHand);
    this.geometries=[this.joint,this.head,this.headFar,this.hair,this.torso,this.pelvis,this.arm,this.leg,this.hand,this.leftHand,this.relaxedHand,this.leftRelaxedHand,this.shoe];
  }
  dispose(){for(const geometry of this.geometries)geometry.dispose();}
}
