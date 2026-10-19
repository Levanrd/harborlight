import {METRES_PER_UNIT,STREET_SCALE} from './worldScale';
import {busStopPlacement} from './busStopPlacement';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {walkingGraph,type FootTraffic,type WalkGraph} from './pedestrians';
import type {City} from './simulation';
import type {TrafficState} from './traffic';
import {pedestrianAppearance,pedestrianLeg,PEDESTRIAN_SPACING} from './pedestrianAppearance';

/** Five shared instance buffers for the entire crowd, including opening doors. */
export class PedestrianModels{
  private sphere=new THREE.SphereGeometry(1,16,10);
  private capsule=new THREE.CapsuleGeometry(.5,1,4,12).scale(1,.5,1);
  private torso=new THREE.LatheGeometry([new THREE.Vector2(0,-.5),new THREE.Vector2(.39,-.5),new THREE.Vector2(.42,-.44),new THREE.Vector2(.36,-.12),new THREE.Vector2(.46,.22),new THREE.Vector2(.5,.35),new THREE.Vector2(.4,.45),new THREE.Vector2(.21,.5),new THREE.Vector2(0,.5)],20);
  private box=new RoundedBoxGeometry(1,1,1,2,.12);
  private material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.85});
  private cloth=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.98});
  private doorMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.4,metalness:.18});
  private heads=new THREE.InstancedMesh(this.sphere,this.material,10000);
  private limbs=new THREE.InstancedMesh(this.capsule,this.cloth,6000);
  private bodies=new THREE.InstancedMesh(this.torso,this.cloth,1200);
  private details=new THREE.InstancedMesh(this.box,this.material,7000);
  private doors=new THREE.InstancedMesh(this.box,this.doorMaterial,2000);
  private root=new THREE.Matrix4();private local=new THREE.Matrix4();private matrix=new THREE.Matrix4();
  private position=new THREE.Vector3();private scale=new THREE.Vector3();private rotation=new THREE.Quaternion();private color=new THREE.Color();
  private up=new THREE.Vector3(0,1,0);private direction=new THREE.Vector3();
  private headsCount=0;private limbsCount=0;private doorsCount=0;private bodiesCount=0;private detailsCount=0;
  private shown=new Map<number,{x:number;z:number;heading:number;walked:number;motion:number}>();
  private cameraPosition=new THREE.Vector3(Infinity,Infinity,Infinity);
  private styles=new Map<number,ReturnType<typeof pedestrianAppearance>>();
  private cells?:City['cells'];private graph?:WalkGraph;private openings=new Map<string,number>();
  private lastFoot?:FootTraffic;private lastTraffic?:TrafficState;private settled=0;private lastReduced=false;
  constructor(private scene:THREE.Scene){for(const [name,mesh] of [['faces',this.heads],['limbs',this.limbs],['clothing',this.bodies],['details',this.details],['doors',this.doors]] as const){mesh.name='pedestrian-'+name;mesh.count=0;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);}}
  private part(mesh:THREE.InstancedMesh,x:number,y:number,z:number,w:number,h:number,d:number,color:string,quaternion?:THREE.Quaternion){
    const index=mesh===this.heads?this.headsCount:mesh===this.limbs?this.limbsCount:mesh===this.bodies?this.bodiesCount:mesh===this.details?this.detailsCount:this.doorsCount;if(index>=mesh.instanceMatrix.count)return;
    if(mesh===this.heads)this.headsCount++;else if(mesh===this.limbs)this.limbsCount++;else if(mesh===this.bodies)this.bodiesCount++;else if(mesh===this.details)this.detailsCount++;else this.doorsCount++;
    this.position.set(x,y,z);this.scale.set(w,h,d);this.local.compose(this.position,quaternion||this.rotation.identity(),this.scale);this.matrix.multiplyMatrices(this.root,this.local);
    mesh.setMatrixAt(index,this.matrix);mesh.setColorAt(index,this.color.set(color));
  }
  private bone(ax:number,ay:number,az:number,bx:number,by:number,bz:number,width:number,color:string){
    this.direction.set(bx-ax,by-ay,bz-az);const length=this.direction.length();this.rotation.setFromUnitVectors(this.up,this.direction.normalize());
    this.part(this.limbs,(ax+bx)/2,(ay+by)/2,(az+bz)/2,width,length+width*.7,width,color,this.rotation);
  }
  private person(id:number,x:number,z:number,heading:number,walked:number,motion:number,reducedMotion:boolean){
    let style=this.styles.get(id);if(!style){style=pedestrianAppearance(id);this.styles.set(id,style);}
    const {skin,top,pants,hair,height,build,outfit,hairStyle,bag,glasses,phase,shoes}=style;
    const distance=(this.cameraPosition.x-x)**2+(this.cameraPosition.y-1)**2+(this.cameraPosition.z-z)**2;
    const near=distance<45**2,mid=distance<90**2;
    motion=reducedMotion?0:motion;
    walked*=METRES_PER_UNIT/height;
    const personScale=height/METRES_PER_UNIT;
    const bob=.018+.072*(1-motion)+Math.cos((walked/1.1+phase)*Math.PI*4)*.008*motion;
    this.position.set(x,.43,z);this.rotation.setFromAxisAngle(this.up,heading);this.scale.set(personScale*build,personScale,personScale);this.root.compose(this.position,this.rotation,this.scale);
    // A shoulder/chest/waist profile gives fabric an anatomical silhouette.
    this.part(this.bodies,0,1.185+bob,0,.43,.44,.28,top);
    this.part(this.heads,0,.9+bob,0,.167,.13,.119,pants);
    this.part(this.limbs,0,1.437+bob,0,.105,.145,.10,skin);
    this.part(this.heads,0,1.59+bob,.008,.112,.146,.108,skin);
    this.part(this.heads,0,1.675+bob,-.02,.113,.075,.106,hair);
    if(hairStyle===1||hairStyle===3)this.part(this.heads,0,1.57+bob,-.069,.118,.133,.07,hair);
    if(hairStyle===2)this.part(this.heads,-.035,1.715+bob,.018,.092,.052,.103,hair);
    if(hairStyle===3)this.part(this.heads,0,1.53+bob,-.142,.06,.095,.07,hair);
    for(const side of [-1,1]){
      const leg=pedestrianLeg(walked,side,motion,phase),hip=side*.093;
      this.bone(hip,leg.hip.y,0,hip,leg.knee.y,leg.knee.z,.175,pants);
      this.bone(hip,leg.knee.y,leg.knee.z,hip,leg.ankle.y,leg.ankle.z,.135,pants);
      this.part(this.heads,hip,leg.knee.y,leg.knee.z,.069,.07,.069,pants);
      this.part(this.heads,hip,.076+leg.lift,leg.stride+.048,.073,.062,.138,shoes);
      if(mid)this.part(this.heads,hip,.035+leg.lift,leg.stride+.052,.074,.023,.137,'#aaa89f');
      const arm=-leg.stride*.62,shoulder=side*.185,elbow=side*.23,hand=side*.23;
      this.part(this.heads,shoulder,1.33+bob,0,.066,.074,.066,top);
      const sleeve=outfit===1||outfit===3;
      this.bone(shoulder,1.34+bob,0,elbow,1.10+bob,arm*.45,.125,sleeve?skin:top);
      if(sleeve)this.bone(shoulder,1.34+bob,0,side*.21,1.23+bob,arm*.2,.132,top);
      this.bone(elbow,1.1+bob,arm*.45,hand,.91+bob,arm+.045,.10,sleeve?skin:top);
      this.part(this.heads,elbow,1.1+bob,arm*.45,.049,.052,.049,sleeve?skin:top);
      this.part(this.heads,hand,.87+bob,arm+.05,.044,.071,.032,skin);
      if(near){
        this.part(this.heads,side*.113,1.58+bob,0,.022,.035,.018,skin);
        this.part(this.heads,side*.039,1.613+bob,.105,.014,.006,.005,'#d5cabb');
        this.part(this.heads,side*.039,1.612+bob,.11,.005,.006,.003,'#302d2b');
        this.part(this.details,side*.04,1.637+bob,.105,.036,.008,.008,hair);
        this.part(this.heads,hand-side*.029,.88+bob,arm+.073,.021,.038,.02,skin);
        if(glasses)this.part(this.details,side*.04,1.614+bob,.119,.061,.035,.012,'#374653');
      }
    }
    if(near){
      this.part(this.heads,0,1.58+bob,.114,.017,.026,.022,skin);
      this.part(this.details,0,1.538+bob,.106,.032,.004,.004,'#885b4b');
      if(glasses)this.part(this.details,0,1.614+bob,.121,.035,.006,.008,'#374653');
    }
    if(mid){
      // Collar, seams, belt and pockets read as garments rather than colored sticks.
      this.part(this.details,0,.978+bob,.005,.31,.027,.23,'#50483f');
      this.part(this.details,0,.978+bob,.126,.038,.027,.014,'#b9b4a4');
      if(outfit!==1){
        for(const side of [-1,1]){this.part(this.details,side*.057,1.374+bob,.067,.075,.045,.074,top);this.part(this.details,side*.105,1.115+bob,.126,.075,.085,.015,top);}
        this.part(this.details,0,1.18+bob,.137,.012,.36,.008,'#c7c3b8');
        if(near)for(let i=0;i<3;i++)this.part(this.heads,.018,1.32+bob-i*.08,.144,.009,.009,.004,'#d8d0ba');
      }else this.part(this.heads,0,1.393+bob,.01,.075,.022,.071,'#d5d2c7');
    }
    if(outfit===4)this.part(this.bodies,0,1.01+bob,-.008,.43,.4,.29,top);
    if(outfit===3)this.part(this.bodies,0,.84+bob,0,.41,.37,.30,top);
    if(bag&&mid){
      this.part(this.details,0,1.19+bob,-.177,.27,.30,.13,'#947451');
      this.part(this.details,0,1.12+bob,-.25,.21,.13,.042,'#795d42');
      for(const side of [-1,1])this.part(this.details,side*.13,1.21+bob,.119,.025,.31,.018,'#795d42');
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
    this.headsCount=this.limbsCount=this.doorsCount=this.bodiesCount=this.detailsCount=0;
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
    for(const id of this.styles.keys())if(!styled.has(id))this.styles.delete(id);
    for(const [mesh,count] of [[this.heads,this.headsCount],[this.limbs,this.limbsCount],[this.doors,this.doorsCount],[this.bodies,this.bodiesCount],[this.details,this.detailsCount]] as const){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  }
  dispose(){for(const mesh of [this.heads,this.limbs,this.doors,this.bodies,this.details]){this.scene.remove(mesh);mesh.dispose();}for(const geometry of [this.sphere,this.capsule,this.box,this.torso])geometry.dispose();this.material.dispose();this.cloth.dispose();this.doorMaterial.dispose();this.shown.clear();this.styles.clear();this.openings.clear();}
}
