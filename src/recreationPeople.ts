import * as THREE from 'three';
import {pedestrianAppearance,pedestrianLeg,joggingLeg} from './pedestrianAppearance';
import {METRES_PER_UNIT} from './worldScale';
import {HumanGeometry} from './humanGeometry';
import {humanLimbMaterial,type LimbSkin} from './humanSkinning';

export type LeisureActivity='walk'|'run'|'swim'|'wade'|'sit'|'swing'|'stand';
type Point=[number,number,number];
export type SoccerPose={kick:number;touch:number;receive:number;look:number;celebrate:boolean};
export type HumanTravel={distance:number;speed:number;motion?:number;still?:boolean;soccer?:SoccerPose};
export type LeisurePerson={root:THREE.Group;parts:THREE.Mesh[];pose:(seconds:number,travel?:HumanTravel)=>void};
export type HumanOptions={child?:boolean;shirt?:string;ground?:number;street?:boolean};

function articulate(start:Point,end:Point,pole:Point,upper:number,lower:number){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),direction=b.clone().sub(a);
  const distance=Math.max(.001,Math.min(upper+lower-.0001,direction.length()));direction.normalize();b.copy(a).addScaledVector(direction,distance);
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance),bend=Math.sqrt(Math.max(0,upper*upper-along*along));
  const normal=new THREE.Vector3(...pole).sub(a);normal.addScaledVector(direction,-normal.dot(direction));
  if(normal.lengthSq()<.000001)normal.set(0,0,1).addScaledVector(direction,-direction.z);
  normal.normalize();return {joint:a.clone().addScaledVector(direction,along).addScaledVector(normal,bend).toArray() as Point,end:b.toArray() as Point};
}

/** A shared anatomical rig for street pedestrians and leisure visitors. Skin,
 * clothes and hair use the same geometry in both instance renderers. */
export class RecreationPeople{
  readonly geometry=new HumanGeometry();
  private faceMaterials=new Map<THREE.Material,THREE.Material>();
  private limbMaterials=new Map<THREE.Material,THREE.Material>();
  private up=new THREE.Vector3(0,1,0);
  constructor(private material:(color:string)=>THREE.Material){}
  create(id:number,activity:LeisureActivity,options:HumanOptions={}):LeisurePerson{
    const style=pedestrianAppearance(id),swim=activity==='swim',swimwear=swim||activity==='wade',sport=activity==='run',shapes=this.geometry;
    const root=new THREE.Group(),body=new THREE.Group(),upper=new THREE.Group(),parts:THREE.Mesh[]=[];
    root.name='leisure-person-'+activity;root.add(body);body.add(upper);
    const scale=style.height/METRES_PER_UNIT*(options.child?.68:1);root.scale.set(scale*style.build,scale,scale);
    const top=swimwear?(id%2?style.skin:style.top):options.shirt||style.top;
    const shorts=swimwear||sport||options.child,lower=swimwear?style.top:sport?'#293744':style.pants;
    const longSleeves=options.street&&[0,2,4].includes(style.outfit),skin=style.skin;
    const mesh=(parent:THREE.Object3D,geo:THREE.BufferGeometry,p:Point,s:Point,color:string,name='',detail=false)=>{
      let material=this.material(color);
      if(geo===shapes.head){let face=this.faceMaterials.get(material);if(!face){face=material.clone();if(face instanceof THREE.MeshStandardMaterial)face.vertexColors=true;this.faceMaterials.set(material,face);}material=face;}
      if(geo.userData.humanLimb){let limb=this.limbMaterials.get(material);if(!limb){limb=humanLimbMaterial(material);this.limbMaterials.set(material,limb);}material=limb;}
      const m=new THREE.Mesh(geo,material);m.position.set(...p);m.scale.set(...s);m.name=name;m.userData.faceDetail=detail;m.castShadow=true;m.receiveShadow=true;parent.add(m);parts.push(m);return m;
    };
    const ellipse=(parent:THREE.Object3D,p:Point,s:Point,color:string,name='',detail=false)=>mesh(parent,shapes.joint,p,s,color,name,detail);
    const limb=(geo:THREE.BufferGeometry,color:string,cloth:string,hem:number,sock=0,name:string)=>{
      const m=mesh(body,geo,[0,0,0],[1,1,1],color,name),direction=new THREE.Vector3(),inverse=new THREE.Quaternion();
      const skin:LimbSkin={bend:new THREE.Quaternion(),skin:new THREE.Color(color),cloth:new THREE.Color(cloth),hem,sock};m.userData.limbSkin=skin;
      return {mesh:m,pose:(start:Point,joint:Point,end:Point)=>{
        m.position.set(...joint);direction.set(start[0]-joint[0],start[1]-joint[1],start[2]-joint[2]).normalize();
        m.quaternion.setFromUnitVectors(this.up,direction);inverse.copy(m.quaternion).invert();
        direction.set(end[0]-joint[0],end[1]-joint[1],end[2]-joint[2]).normalize().applyQuaternion(inverse);
        skin.bend.setFromUnitVectors(new THREE.Vector3(0,-1,0),direction);
        m.userData.joints={start:[...start],joint:[...joint],end:[...end]};
      }};
    };
    mesh(upper,shapes.torso,[0,.002,0],[1,.465,1],top,'ribcage');
    const pelvis=mesh(body,shapes.pelvis,[0,.958,0],[1,.19,1],lower,'pelvis');
    ellipse(upper,[0,.501,-.006],[.048,.069,.047],skin,'neck');
    const head=new THREE.Group();head.position.set(0,.645,.006);upper.add(head);
    if(options.child)head.scale.setScalar(1.12);
    mesh(head,shapes.head,[0,0,0],[1,1,1],skin,'head');
    const hair=mesh(head,shapes.hair,[0,.002,-.001],[1,1,1],swim?'#586978':style.hair,'hair');
    if(!swim&&style.hairStyle===2)hair.scale.set(1.01,1.04,1.01);
    if(!swim&&style.hairStyle===3)ellipse(head,[0,-.025,-.088],[.036,.049,.027],style.hair,'tied-hair');
    const blinks:THREE.Mesh[]=[];
    for(const side of [-1,1]){
      ellipse(head,[side*.0365,-.0015,.073],[.0105,.003,.006],'#726e66','eye',true);
      ellipse(head,[side*.0365,-.0015,.0798],[.0023,.0023,.001],'#493e33','iris',true);
      const blink=ellipse(head,[side*.0365,-.0015,.083],[.014,0,.002],skin,'blinking-lid',true);blinks.push(blink);
      if(swim)ellipse(head,[side*.0365,-.0015,.084],[.017,.010,.005],'#526a71','goggles',true);
      else if(style.glasses)ellipse(head,[side*.0365,-.0015,.084],[.017,.011,.0025],'#5d635e','glasses',true);
    }
    const arms=[-1,1].map(side=>{
      const arm=limb(shapes.arm,skin,top,swimwear?1:longSleeves?-1:.165,0,'arm');
      const handShape=swim||activity==='swing'?(side<0?shapes.leftHand:shapes.hand):(side<0?shapes.leftRelaxedHand:shapes.relaxedHand);
      const hand=mesh(body,handShape,[0,0,0],[1,1,1],skin,'hand');
      return {side,arm,hand};
    });
    const legs=[-1,1].map(side=>{
      const leg=limb(shapes.leg,skin,lower,shorts?.19:-1,sport?1:0,'leg');
      const foot=mesh(body,shapes.shoe,[0,0,0],[1,swimwear?.7:1,1],swimwear?skin:sport?'#363b38':style.shoes,'foot');
      return {side,leg,foot};
    });
    if(options.street&&style.bag)ellipse(upper,[0,.23,-.147],[.114,.15,.056],'#766951','backpack');
    const wristDirection=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
    const pose=(seconds:number,travel?:HumanTravel)=>{
      const seated=activity==='sit'||activity==='swing',walking=activity==='walk'||sport;
      const t=travel?.still?0:seconds,phase=style.phase;
      const walked=travel?travel.distance/root.scale.y:t*(sport?1.7:.82);
      const motion=walking?(travel?.motion??(travel?Math.min(1,travel.speed/.75):1)):0;
      const soccer=travel?.soccer,kickPhase=soccer?.kick||0,kickBlend=kickPhase>0?Math.sin(kickPhase*Math.PI):0;
      const gait=sport?joggingLeg:pedestrianLeg,leg=gait(walked,1,motion,phase),offset=seated?-.45:leg.hip.y-.99-kickBlend*.045;
      const cycle=(walked/(sport?1.35:1.1)+phase)*Math.PI*2,breath=travel?.still?0:Math.sin(t*1.7+phase*6)*.0015;
      upper.position.set(walking?Math.sin(cycle)*.006*motion:0,1+offset+breath,0);
      upper.rotation.set(sport?.085*motion:0,walking?Math.sin(cycle)*(sport?.065:.026)*motion:0,walking?Math.sin(cycle)*(sport?.018:.009)*motion:0);
      body.rotation.x=swim?Math.PI/2:0;body.position.set(0,0,swim?-.65:0);
      head.rotation.set(swim?-.08:-upper.rotation.x*.7,seated?Math.sin(t*.23+phase*5)*.065:-upper.rotation.y*.7,-upper.rotation.z*.7);
      if(soccer){head.rotation.y+=soccer.look;upper.rotation.y-=kickBlend*.13;upper.rotation.x-=kickBlend*.09;upper.position.y-=soccer.receive*.018;}
      const blink=Math.max(0,1-Math.abs(((t+phase*7)%4.7)-4.48)/.10);for(const lid of blinks)lid.scale.y=.006*blink;
      pelvis.position.y=.958+offset;pelvis.rotation.y=-upper.rotation.y*.6;
      for(const l of legs){
        const side=l.side,h=side*.087,step=gait(walked,side,motion,phase),kick=Math.sin(t*4+side*Math.PI/2)*.045;
        const hip:Point=[h,seated?.54:swim?.94:step.hip.y-kickBlend*.045,0];
        let knee:Point=seated?[h,.49,.42]:swim?[h,.52,kick+.07]:[h,step.knee.y,step.knee.z];
        const seatedAnkle=activity==='sit'&&options.ground!==undefined?.14+(options.ground-root.position.y)/root.scale.y:.065;
        let ankle:Point=seated?[h,seatedAnkle,.42]:swim?[h,.10,-kick]:[h,step.ankle.y,step.ankle.z];
        if(soccer&&kickPhase>0){
          let z=0,y=.14;
          if(kickPhase<.25){const u=kickPhase/.25;z=-.31*Math.sin(u*Math.PI/2);y+=u*.10;}
          else if(kickPhase<.43){const u=(kickPhase-.25)/.18;z=-.31+.61*u;y=.24-.10*u;}
          else if(kickPhase<.70){const u=(kickPhase-.43)/.27;z=.30+.12*Math.sin(u*Math.PI/2);y=.14+.19*u;}
          else{const u=(kickPhase-.70)/.30;z=.42*(1-u);y=.33-.19*u;}
          ankle=side>0?[h,y,z]:[h,.14,-.045];
        }else if(soccer&&side>0&&soccer.touch>0){
          const tap=Math.max(0,1-soccer.touch/.24);ankle[1]+=.025*tap;ankle[2]=ankle[2]*(1-tap)+.24*tap;
        }
        const solved=articulate(hip,ankle,knee,.425,.425);knee=solved.joint;ankle=solved.end;
        l.leg.pose(hip,knee,ankle);
        const pitch=swim?-.15:kickPhase>0?0:walking&&step.lift>.003?Math.min(.48,step.lift*(sport?2.5:2)):0;
        // Raise the sole as it rolls through swing, keeping the toe above ground.
        l.foot.position.set(h,ankle[1]-.14+Math.sin(pitch)*.16,ankle[2]);l.foot.rotation.x=pitch;
      }
      for(const a of arms){
        const side=a.side,swing=-gait(walked,side,motion,phase).stride*.58;
        const shoulder=new THREE.Vector3(side*.18,.429,0).applyEuler(upper.rotation).add(upper.position).toArray() as Point;
        let elbow:Point=[side*.224,1.155+offset,-.02+swing*.35],hand:Point=[side*.21,.925+offset,.035+swing];
        if(sport){
          // Humerus swings about the shoulder; elbow stays flexed near 90°.
          const angle=-Math.cos(cycle+(side<0?Math.PI:0))*.48*motion;
          elbow=[shoulder[0]+side*.026,shoulder[1]-.29*Math.cos(angle),shoulder[2]+.29*Math.sin(angle)];
          hand=[elbow[0]-side*.014,elbow[1]+.25*Math.sin(angle+.12),elbow[2]+.25*Math.cos(angle+.12)];
          if(soccer){
            hand[0]+=side*(kickBlend*.16+soccer.receive*.06);elbow[0]+=side*kickBlend*.09;
            if(soccer.celebrate){elbow=[side*.27,1.60,.04];hand=[side*.28,1.91,0];}
          }
        }
        if(seated){elbow=[side*.22,.76,.12];hand=[side*.20,.64,.34];}
        if(activity==='swing'){elbow=[side*.27,.90,.06];hand=[side*.35,1.10,0];}
        if(swim){const stroke=t*2.2+(side<0?Math.PI:0);elbow=[side*.43,1.46,-.17];hand=[side*.25,1.429+Math.cos(stroke)*.51,-.04-Math.sin(stroke)*.25];}
        const solved=articulate(shoulder,hand,elbow,.29,.25);elbow=solved.joint;hand=solved.end;
        a.arm.pose(shoulder,elbow,hand);a.hand.position.set(...hand);
        wristDirection.set(hand[0]-elbow[0],hand[1]-elbow[1],hand[2]-elbow[2]).normalize();a.hand.quaternion.setFromUnitVectors(down,wristDirection);
        if(!swim&&activity!=='swing')a.hand.rotateY(-side*Math.PI/2);
      }
    };
    pose(0);return {root,parts,pose};
  }
  dispose(){this.geometry.dispose();for(const material of [...this.faceMaterials.values(),...this.limbMaterials.values()])material.dispose();this.faceMaterials.clear();this.limbMaterials.clear();}
}

/** Arc length drives foot placement along elliptical jogging paths. */
export function ellipseTravel(rx:number,rz:number){
  const count=256,arc=[0];let previous=new THREE.Vector2(0,rz);
  for(let i=1;i<=count;i++){const a=i/count*Math.PI*2,p=new THREE.Vector2(Math.sin(a)*rx,Math.cos(a)*rz);arc.push(arc[i-1]+p.distanceTo(previous));previous=p;}
  return (angle:number)=>{const turns=Math.floor(angle/(Math.PI*2)),phase=angle/(Math.PI*2)-turns,index=phase*count,lo=Math.floor(index);return turns*arc[count]+THREE.MathUtils.lerp(arc[lo],arc[Math.min(count,lo+1)],index-lo);};
}
