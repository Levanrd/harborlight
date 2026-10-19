import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {VehicleBatches,buildingVariant,type VisualKit} from './cityVisuals';
import {createCanopy} from './naturalVisuals';
import type {Cell} from './simulation';
import {RecreationPeople,type LeisureActivity,type HumanOptions} from './recreationPeople';
import {SoccerMatch} from './soccerMatch';

/** Shared architectural and landscape parts. All static detail is instance-batched. */
export class PlaceVisuals{
  private rounded=new RoundedBoxGeometry(1,1,1,3,.065);
  private sphere=new THREE.SphereGeometry(1,16,10);
  private cylinder=new THREE.CylinderGeometry(1,1,1,32);
  private ring=new THREE.TorusGeometry(1,.07,8,40);
  private crown=createCanopy(false,8);
  private flower=new THREE.SphereGeometry(1,8,5);
  private canopy=new THREE.ConeGeometry(1,.45,32);
  private barrel=new THREE.CylinderGeometry(1,1,1,32,1,true,0,Math.PI).rotateZ(Math.PI/2);
  private slide=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,2.65,0),new THREE.Vector3(.15,2.6,.7),new THREE.Vector3(.3,1.1,1.8),new THREE.Vector3(.3,.65,2.8)]),24,.38,12,false);
  private jet=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.2,1.25,0),new THREE.Vector3(.65,1.6,0),new THREE.Vector3(1,0,0)]),20,.025,5,false);
  private sources=new THREE.Group();
  private rendered=new THREE.Group();
  private batch=new VehicleBatches(this.rendered);
  private motions:((time:number)=>void)[]=[];
  private lastTime:number|undefined;
  private matches:{match:SoccerMatch;x:number;z:number}[]=[];
  private people:RecreationPeople;
  private poolWater=new THREE.MeshPhysicalMaterial({color:'#72afbb',roughness:.24,metalness:.03,transparent:true,opacity:.7,depthWrite:false});
  constructor(private scene:THREE.Scene,private kit:VisualKit){this.people=new RecreationPeople(kit.material);scene.add(this.rendered);}
  private neighbor(id:number,activity:LeisureActivity,x:number,y:number,z:number,heading=0,options:HumanOptions={}){
    const person=this.people.create(id,activity,options);person.root.position.set(x,y,z);person.root.rotation.y=heading;this.sources.add(person.root);this.motions.push(t=>person.pose(t));return person;
  }
  private pool(g:THREE.Group,x:number,z:number,w:number,d:number,surface=.83){
    this.round(g,x,.55,z,w,.07,d,'#b3d1cf');
    for(const side of [-1,1]){this.round(g,x+side*(w/2+.1),.55,z,.2,surface-.53,d+.4,'#c8c9bf');this.round(g,x,.55,z+side*(d/2+.1),w,surface-.53,.2,'#c8c9bf');}
    const water=this.round(g,x,surface-.025,z,w,.025,d,'#6f9698');water.material=this.poolWater;water.castShadow=false;
  }
  private part(g:THREE.Object3D,geo:THREE.BufferGeometry,x:number,y:number,z:number,w:number,h:number,d:number,color:string){const m=new THREE.Mesh(geo,this.kit.material(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=Math.max(w,h,d)>.35;m.receiveShadow=true;g.add(m);return m;}
  private round(g:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string){return this.part(g,this.rounded,x,y+h/2,z,w,h,d,color);}
  private drum(g:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,color:string){return this.part(g,this.cylinder,x,y+h/2,z,r,h,r,color);}
  private hoop(g:THREE.Object3D,x:number,y:number,z:number,r:number,color:string){const m=this.part(g,this.ring,x,y,z,r,r,r,color);m.rotation.x=Math.PI/2;return m;}
  private rod(g:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,color:string){const delta=b.clone().sub(a),m=this.part(g,this.cylinder,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,r,delta.length(),r,color);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
  private shrub(g:THREE.Object3D,x:number,z:number,s=.45){this.part(g,this.crown,x,.45+s*.55,z,s,s*.65,s*.82,'#517d48');if(s>.3)this.part(g,this.crown,x+s*.4,.5+s*.6,z-.1,s*.6,s*.55,s*.6,'#6a9b62');}
  private bed(g:THREE.Object3D,x:number,z:number,r:number,formal=true){if(formal){this.drum(g,x,.4,z,r,.15,'#806e51');this.hoop(g,x,.58,z,r,'#929d9e');}else this.part(g,this.crown,x,.44,z,r,.06,r*.75,'#806e51');const count=r<.7?3:7;for(let i=0;i<count;i++){const a=i*2.4,rr=Math.sqrt((i+.5)/count)*r*.8;this.shrub(g,x+Math.sin(a)*rr,z+Math.cos(a)*rr,.22);for(let j=0;j<2;j++)this.part(g,this.flower,x+Math.sin(a)*rr+j*.07,.85,z+Math.cos(a)*rr,.08,.06,.08,i%2?'#c58c8d':'#dfb56d');}}
  private bench(g:THREE.Object3D,x:number,z:number,angle=0,ground=.43){const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=angle;group.scale.set(.68,.78,.68);group.position.y=.4*(1-.78)+ground-.43;g.add(group);for(let i=0;i<4;i++){this.round(group,0,.72,-.24+i*.16,1.9,.07,.12,'#927b68');this.round(group,0,.94+i*.14,-.34,1.9,.09,.065,'#927b68');}for(const side of [-1,1]){this.rod(group,new THREE.Vector3(side*.7,.4,-.25),new THREE.Vector3(side*.7,.75,.24),.045,'#425563');this.rod(group,new THREE.Vector3(side*.7,.4,.25),new THREE.Vector3(side*.7,1.4,-.34),.045,'#425563');}}
  private path(g:THREE.Object3D,points:THREE.Vector3[],width:number){const curve=new THREE.CatmullRomCurve3(points);let a=curve.getPoint(0);for(let i=1;i<=26;i++){const b=curve.getPoint(i/26),part=this.kit.box(g,(a.x+b.x)/2,.47,(a.z+b.z)/2,width,.055,a.distanceTo(b)+.12,'#c9c0ab');part.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);this.drum(g,b.x,.47,b.z,width/2,.055,'#c9c0ab');a=b;}}
  private fountain(g:THREE.Object3D,x:number,z:number,r:number){
    this.drum(g,x,.45,z,r,.35,'#929d9e');this.drum(g,x,.79,z,r*.88,.055,'#6f9698');this.hoop(g,x,.82,z,r,'#c8c9bf');this.drum(g,x,.82,z,.24,.65,'#c8c9bf');this.hoop(g,x,1.42,z,.42,'#c8c9bf');
    if(this.motions.length>=96)return;const jets=new THREE.Group();jets.position.set(x,1.25,z);this.sources.add(jets);
    for(let i=0;i<6;i++){const j=this.part(jets,this.jet,0,0,0,r*.72,.65,r*.72,'#b3d1cf');j.rotation.y=i*Math.PI/3;j.castShadow=false;}
    this.motions.push(t=>{jets.scale.y=.93+Math.sin(t*2.3)*.07;});
    const drops=new THREE.Group();drops.position.set(x,0,z);this.sources.add(drops);for(let i=0;i<12;i++)this.part(drops,this.sphere,0,1,0,.045,.065,.045,'#b3d1cf').castShadow=false;
    this.motions.push(t=>drops.children.forEach((m,i)=>{const q=(t*.7+i/12)%1,a=i*Math.PI/3;m.position.set(Math.cos(a)*q*r*.72,1.25+Math.sin(q*Math.PI)*1.03-q*.4,Math.sin(a)*q*r*.72);}));
  }
  private fan(x:number,y:number,z:number){if(this.motions.length>=96)return;const g=new THREE.Group();g.position.set(x,y,z);this.sources.add(g);for(let i=0;i<4;i++){const blade=this.round(g,0,0,.23,.18,.045,.55,'#425563');blade.rotation.y=i*Math.PI/2;blade.position.set(Math.sin(i*Math.PI/2)*.23,0,Math.cos(i*Math.PI/2)*.23);}this.motions.push(t=>g.rotation.y=t*2.3);}
  beginRebuild(){this.sources.clear();this.motions=[];this.matches=[];this.batch.dispose();this.lastTime=undefined;}
  get dynamicCount(){return this.sources.children.length;}
  personView(activity:LeisureActivity,index=0){
    const figures:THREE.Object3D[]=[];this.sources.traverse(o=>{if(o.name==='leisure-person-'+activity)figures.push(o);});
    const figure=figures[index%figures.length];if(!figure)return;
    figure.updateWorldMatrix(true,false);
    return figure.localToWorld(new THREE.Vector3(0,1.05,0));
  }
  soccerView(){const entry=this.matches[0];if(!entry)return;const {match,x,z}=entry;return {ball:new THREE.Vector3(x+match.ball.x,.56+match.ball.y,z+match.ball.z),score:[...match.score],event:match.event,owner:match.ball.owner,actions:match.players.map(p=>p.action)};}
  orientDynamics(first:number,x:number,z:number,angle:number){for(const g of this.sources.children.slice(first)){const dx=g.position.x-x,dz=g.position.z-z;g.position.x=x+dx*Math.cos(angle)+dz*Math.sin(angle);g.position.z=z-dx*Math.sin(angle)+dz*Math.cos(angle);}}
  endRebuild(){this.batch.rebuild(this.sources);}
  update(time:number,reducedMotion=false){const clock=reducedMotion?0:time;if(clock===this.lastTime)return;this.lastTime=clock;for(const motion of this.motions)motion(clock);this.batch.update(this.sources);}
  dispose(){this.batch.dispose();this.scene.remove(this.rendered);for(const geo of [this.rounded,this.sphere,this.cylinder,this.ring,this.crown,this.canopy,this.jet,this.barrel,this.slide,this.flower])geo.dispose();this.people.dispose();this.poolWater.dispose();this.sources.clear();this.motions=[];}

  private palm(g:THREE.Object3D,x:number,z:number){
    this.rod(g,new THREE.Vector3(x,.4,z),new THREE.Vector3(x+.2,3.9,z),.12,'#927b68');
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7,leaf=this.part(g,this.sphere,x+.2+Math.sin(a)*.4,3.85,z+Math.cos(a)*.4,.25,.12,.8,'#517d48');leaf.rotation.y=a;leaf.rotation.x=.22;}
  }
  private parasol(g:THREE.Object3D,x:number,z:number){this.drum(g,x,.5,z,.035,1.8,'#927b68');this.part(g,this.canopy,x,2.35,z,1,.55,1,'#d9d6c7');for(const dx of [-.55,.55]){this.round(g,x+dx,.5,z+.8,.45,.18,1.5,'#c9c0ab');const back=this.round(g,x+dx,.65,z+.25,.45,.5,.12,'#c9c0ab');back.rotation.x=-.35;}}
  coastal(c:Cell,g:THREE.Group){
    const x=c.x*8,z=c.z*8,b=this.kit.box,house=c.coastal==='beachhouse',resort=c.coastal==='resort';
    b(g,x,.33,z,7.6,.12,7.6,'#c9c0ab');
    if(house){
      this.round(g,x-.65,1,z,4.3,2.5,4.7,'#d9d6c7');
      for(const dx of [-2.4,.9])for(const dz of [-2.1,2.1])this.drum(g,x+dx,.4,z+dz,.1,1.1,'#927b68');
      const roof=this.part(g,this.kit.roof,x-.65,3.5,z,4.8,1.3,5.2,'#697f8e');roof.rotation.y=0;
      b(g,x+2,1,z,2.3,.12,5.2,'#927b68');for(const dz of [-2.4,2.4]){this.drum(g,x+2.9,1,z+dz,.06,2.5,'#d9d6c7');b(g,x+2,1.8,z+dz,2.2,.08,.08,'#d9d6c7');}
      b(g,x+2,3.4,z,2.5,.12,5.4,'#d9d6c7');
      for(const dz of [-1.25,1.25])b(g,x+1.52,1.55,z+dz,.05,1.3,1.1,'#578caa');
      for(let i=0;i<3;i++)b(g,x+2.6+i*.3,.4+i*.18,z+2.7,.35,.18,1.1,'#927b68');
      this.palm(g,x-2.3,z+2.3);this.bench(g,x+2,z,Math.PI/2);
    }else{
      const floors=resort?2:Math.min(3,c.level+1),height=floors*2.1;
      this.round(g,x-1,.5,z,4.3,height,5.8,'#d9d6c7');
      for(let f=0;f<floors;f++){
        for(const dz of [-1.8,0,1.8]){b(g,x+1.18,.95+f*2.1,z+dz,.06,1.45,1.35,'#578caa');b(g,x-3.18,.95+f*2.1,z+dz,.06,1.45,1.2,'#578caa');}
        b(g,x+1.7,.65+f*2.1,z,1.2,.16,6.1,'#c8c9bf');
        for(const dz of [-2.8,0,2.8])this.drum(g,x+2.22,.8+f*2.1,z+dz,.035,.8,'#425563');
        b(g,x+2.22,1.55+f*2.1,z,.045,.06,5.7,'#425563');
      }
      b(g,x-1,height+.5,z,4.6,.16,6.1,'#c8c9bf');this.bed(g,x-2.8,z+3.1,.4);
      if(resort){this.pool(g,x+2.7,z+.6,1.02,3.15,.7);this.parasol(g,x+2.4,z-2.5);const guest=this.neighbor(c.x*53+c.z*97+4100,'sit',x+2.95,0,z-1.7,0,{ground:.53});guest.root.position.y=.68-.36*guest.root.scale.y;}
      else {this.bench(g,x+2.8,z,Math.PI/2);this.bed(g,x+2.9,z-2.6,.5);}
      this.palm(g,x-2.3,z-2.3);
    }
  }
  waterpark(c:Cell,g:THREE.Group){
    const x=c.x*8+8,z=c.z*8+4,b=this.kit.box;
    this.round(g,x,.35,z,23.5,.18,15.5,'#c9c0ab');
    this.pool(g,x+1,z,11.5,8.5);
    this.drum(g,x-7,.55,z+4,2.2,.06,'#b3d1cf');this.hoop(g,x-7,.79,z+4,2.08,'#c8c9bf');const shallow=this.drum(g,x-7,.79,z+4,1.95,.02,'#6f9698');shallow.material=this.poolWater;shallow.castShadow=false;
    for(const side of [-1,1])this.neighbor(c.x*53+c.z*97+2200+side,'wade',x-7+side*.55,.61,z+4,side*.6,{child:true});
    for(const dz of [-5,0,5])this.parasol(g,x+9,z+dz);
    for(const dx of [-9,-7])for(const dz of [-5,-3])this.drum(g,x+dx,.5,z+dz,.09,4,'#425563');
    b(g,x-8,4.5,z-4,2.5,.18,2.5,'#927b68');
    this.part(g,this.slide,x-7.6,.5,z-3.5,1.8,1.55,1.8,'#658d9e');
    for(let i=0;i<10;i++)b(g,x-9,.6+i*.38,z-5.6+i*.22,1,.1,.28,'#c8c9bf');
    for(const dx of [-10,10])for(const dz of [-6.5,6.5])this.palm(g,x+dx,z+dz);
    this.bench(g,x,z+6);this.bench(g,x+4,z+6);this.fountain(g,x-3,z-6,1);
    for(let i=0;i<4;i++){
      const swimmer=this.neighbor(c.x*53+c.z*97+2000+i,'swim',0,.85,0);
      // Separate elongated lap loops leave room for the whole body at the ends.
      this.motions.push(t=>{const a=t*.27+i*1.3;swimmer.root.position.set(x-2.7+i*2.4+Math.cos(a)*.35,.85,z+Math.sin(a)*2.7);swimmer.root.rotation.y=Math.atan2(-Math.sin(a)*.35,Math.cos(a)*2.7);});
    }
    const guest=this.neighbor(c.x*53+c.z*97+2100,'sit',x+9.55,0,z+.8,0,{ground:.53});guest.root.position.y=.68-.36*guest.root.scale.y;
  }

  park(c:Cell,g:THREE.Group){
    const large=c.kind==='largepark',sports=c.kind==='sports',play=c.kind==='playground',x=c.x*8+(large||sports?8:play?4:0),z=c.z*8+(large?8:play||sports?4:0),size=large?22:play?14:7;
    const b=this.kit.box;
    if(sports){
      // Keep the marked pitch; replace the toy-like surroundings with nets and seating.
      for(const side of [-1,1]){for(let dz=-1.6;dz<=1.6;dz+=.32)this.rod(g,new THREE.Vector3(x+side*10.7,.55,z+dz),new THREE.Vector3(x+side*11.5,2.45,z+dz),.012,'#d9d6c7');for(let y=.65;y<2.5;y+=.3)this.rod(g,new THREE.Vector3(x+side*11.5,y,z-1.6),new THREE.Vector3(x+side*11.5,y,z+1.6),.012,'#d9d6c7');}
      for(const dx of [-5,0,5])this.bench(g,x+dx,z+6.7,Math.PI,.56);
      const players=Array.from({length:6},(_,i)=>this.neighbor(c.x*53+c.z*97+1000+i,'run',0,.56,0,0,{shirt:i<3?'#b04d3f':'#357993'}));
      const match=new SoccerMatch();this.matches.push({match,x,z});
      const ball=new THREE.Group();this.sources.add(ball);this.part(ball,this.sphere,0,0,0,.073,.073,.073,'#ede7d9');for(let i=0;i<6;i++){const a=i*Math.PI/3;this.part(ball,this.sphere,Math.sin(a)*.059,.037,Math.cos(a)*.059,.021,.013,.021,'#384440');}
      this.motions.push(t=>{
        match.update(t);players.forEach((person,i)=>{const p=match.players[i];person.root.position.set(x+p.x,.56,z+p.z);person.root.rotation.y=p.heading;
          person.pose(t,{distance:p.walked,speed:Math.hypot(p.vx,p.vz)*1.5,soccer:{kick:p.kick,touch:p.touch,receive:p.receive,look:p.look,celebrate:p.action==='celebrate'}});
        });
        ball.position.set(x+match.ball.x,.56+match.ball.y,z+match.ball.z);ball.rotation.set(match.ball.roll,0,-match.ball.roll*.7);
      });
      for(const [i,dx]of [-5,5].entries()){const spectator=this.neighbor(c.x*53+c.z*97+1100+i,'sit',x+dx,0,z+6.7,Math.PI,{ground:.56});spectator.root.position.y=.84-.36*spectator.root.scale.y;}
      return;
    }
    b(g,x,.33,z,size,.10,size,'#90b476');
    if(play){
      this.drum(g,x-1,.46,z-1,4.2,.06,'#bd9870');this.drum(g,x-1,.53,z-1,3.8,.035,'#c9c0ab');
      for(const side of [-1,1]){this.rod(g,new THREE.Vector3(x+side*2.8,.5,z-2),new THREE.Vector3(x+side*2.8,2.4,z-1),.06,'#425563');this.rod(g,new THREE.Vector3(x+side*2.8,.5,z),new THREE.Vector3(x+side*2.8,2.4,z-1),.06,'#425563');}
      this.rod(g,new THREE.Vector3(x-2.9,2.4,z-1),new THREE.Vector3(x+2.9,2.4,z-1),.065,'#425563');
      for(const side of [-1,1]){
        const swing=new THREE.Group();swing.position.set(x+side*1.25,2.3,z-1);
        const rider=this.people.create(c.x*53+c.z*97+3000+side,'swing',{child:true});
        const grip=.35*rider.root.scale.x;for(const dx of [-grip,grip])this.rod(swing,new THREE.Vector3(dx,0,0),new THREE.Vector3(dx,-1.65,0),.009,'#929d9e');
        this.round(swing,0,-1.65,0,.52,.06,.3,'#927b68');rider.root.position.y=-1.59-.36*rider.root.scale.y;swing.add(rider.root);this.sources.add(swing);
        this.motions.push(t=>{swing.rotation.x=Math.sin(t*1.8+side)*.22;rider.pose(t);});
      }
      for(const dx of [3.5,4.5])for(const dz of [-2.7,-1.7])this.drum(g,x+dx,.4,z+dz,.065,2.25,'#927b68');this.round(g,x+4,2.6,z-2.2,1.45,.12,1.45,'#927b68');this.part(g,this.canopy,x+4,3.9,z-2.2,1,.9,1,'#a65f4b');for(const dx of [3.5,4.5])this.drum(g,x+dx,2.7,z-2.7,.045,1.1,'#927b68');this.part(g,this.slide,x+4,0,z-1.8,1,1,1,'#929d9e');for(let i=0;i<6;i++)b(g,x+3.5,.5+i*.35,z-2.5,.85,.06,.14,'#927b68');
      this.path(g,[new THREE.Vector3(x-6,.49,z+5),new THREE.Vector3(x,.49,z+4),new THREE.Vector3(x+5,.49,z+5)],1.2);this.bench(g,x-3,z+5.4,Math.PI,.525);this.bench(g,x+3,z+5.4,Math.PI,.525);this.bed(g,x+5,z-4,1.05);this.kit.tree(g,x-5,z-4,1.35);this.kit.tree(g,x+5,z+2,1.1);
      const parent=this.neighbor(c.x*53+c.z*97+3100,'sit',x-3,0,z+5.4,Math.PI,{ground:.525});parent.root.position.y=.805-.36*parent.root.scale.y;return;
    }
    const r=large?2.1:1.05;
    this.path(g,[new THREE.Vector3(x-size/2,.48,z+1),new THREE.Vector3(x-2,.48,z-2),new THREE.Vector3(x+2,.48,z-2.5),new THREE.Vector3(x+size/2,.48,z-1)],large?1.5:.9);
    this.path(g,[new THREE.Vector3(x+1,.48,z-size/2),new THREE.Vector3(x+3,.48,z-1),new THREE.Vector3(x+2,.48,z+size/2)],large?1.5:.85);
    this.fountain(g,x-(large?1:1.2),z+(large?1:.2),r);
    const locations=large?[[-7,-7],[6,-6],[-8,5],[7,7],[-3,8],[8,1]]:[[-2.3,-2.3],[2.5,2.4]];
    for(const [dx,dz]of locations){this.kit.tree(g,x+dx,z+dz,large?1.4+Math.abs(dx)%3*.15:.65);this.bed(g,x+dx,z+dz,large?1.2:.45,false);}
    if(large)for(let i=0;i<18;i++){const a=i*2.4,dx=-6+Math.sin(a)*(1+i%3*.5),dz=6+Math.cos(a)*(1+i%4*.35);this.shrub(g,x+dx,z+dz,.25+(i%3)*.1);}
    this.bench(g,x+(large?3:0),z+(large?4:2.4),0,large?.525:.43);if(large){this.bench(g,x-5,z+2,Math.PI/2);this.bench(g,x+4,z-4,Math.PI);}
    const sitter=this.neighbor(c.x*53+c.z*97+4000,'sit',x+(large?3:0),0,z+(large?4:2.4),0,{ground:large?.525:.43});sitter.root.position.y=(large?.805:.71)-.36*sitter.root.scale.y;
    if(large){
      const walker=this.neighbor(c.x*53+c.z*97+4001,'walk',0,.525,0),route=new THREE.CatmullRomCurve3([new THREE.Vector3(x-size/2,.525,z+1),new THREE.Vector3(x-2,.525,z-2),new THREE.Vector3(x+2,.525,z-2.5),new THREE.Vector3(x+size/2,.525,z-1)]);
      const length=route.getLength();
      this.motions.push(t=>{const cycle=t*.065,u=(1-Math.cos(cycle))/2,point=route.getPointAt(u),tangent=route.getTangentAt(u),half=Math.floor(cycle/Math.PI),distance=(half+(half%2?1-u:u))*length,speed=Math.abs(Math.sin(cycle))*.0325*length;walker.root.position.copy(point);walker.root.rotation.y=Math.atan2(tangent.x,tangent.z)+(1+Math.tanh(-Math.sin(cycle)/.08))*Math.PI/2;walker.pose(t,{distance,speed:speed*1.5});});
    }
  }

  architecture(c:Cell,g:THREE.Group,height:number){
    const x=c.x*8,z=c.z*8,v=buildingVariant(c),b=this.kit.box;
    if(c.kind==='residential'){
      // Downpipes, recessed doors, garden planting and actual balcony railings.
      for(const side of [-1,1])this.drum(g,x+side*2.25,.45,z-2.05,.035,Math.min(height-1,9),'#929d9e');
      for(const dx of [-2.5,2.7])this.bed(g,x+dx,z+2.65,.4);
      if(c.level>1){const floors=c.level===2?2+v%3:[5,7,9,12,6,10][v];for(let f=1;f<floors;f++){const yy=.9+f*2.15;for(let j=0;j<7;j++)b(g,x-2.15+j*.29,yy,z+3.26,.025,.68,.025,'#425563');this.rod(g,new THREE.Vector3(x-2.2,yy+.7,z+3.26),new THREE.Vector3(x-.3,yy+.7,z+3.26),.028,'#425563');}}
    }else if(c.kind==='commercial'&&c.level<3){
      for(const dx of [-.8,.8]){this.drum(g,x+dx,.45,z+3.2,.035,.43,'#425563');this.drum(g,x+dx,.88,z+3.2,.35,.045,'#927b68');for(const side of [-1,1]){this.drum(g,x+dx+side*.5,.4,z+3.2,.025,.27,'#425563');this.drum(g,x+dx+side*.5,.67,z+3.2,.15,.045,'#927b68');}}
      if(v%2===0){this.drum(g,x-.8,.45,z+3.1,.025,2.3,'#425563');this.part(g,this.canopy,x-.8,2.8,z+3.1,.73,.8,.73,'#c9c0ab');}
    }else if(c.kind==='industrial'){
      this.drum(g,x+2.35,3.8+(c.factoryTier||1)*1.15,z-1.8,.39,3.6,'#b28b73');for(let i=0;i<4;i++)this.hoop(g,x+2.35,4.3+(c.factoryTier||1)*1.15+i*.85,z-1.8,.41,'#c8c9bf');
      this.fan(x-1.4,4.5+(c.factoryTier||1)*1.15,z-.2);
      for(const dx of [-2.6,-1.9])this.drum(g,x+dx,.4,z+3,.24,.7,'#929d9e');
    }
  }

  regional(c:Cell,g:THREE.Group){
    const x=c.x*8,z=c.z*8;
    if(c.kind==='airport'){this.part(g,this.barrel,x+17,4.81,z+4,24,1.65,4.5,'#c8c9bf');for(const dx of [7,17,27]){this.drum(g,x+dx,5.2,z+2,.5,.6,'#929d9e');this.fan(x+dx,5.8,z+2);}}
    if(c.kind==='railway'){this.part(g,this.barrel,x+12,4.52,z+4,30,1.25,2.25,'#929d9e');for(const dx of [3,13,23])this.bench(g,x+dx,z+4);}
    if(c.kind==='seaport'){this.part(g,this.barrel,x+4,5.61,z+3,12.5,1.1,4.75,'#929d9e');for(const dx of [4,10,16])this.drum(g,x+dx,.5,z+13,.22,.6,'#425563');}
  }

  facility(c:Cell,g:THREE.Group){
    if(!['police','clinic','fire','school','utility','power','water','sewage','recycling'].includes(c.kind))return false;
    const x=c.x*8,z=c.z*8,b=this.kit.box;
    if(c.kind==='water'){
      for(const dx of [-1.2,1.2])for(const dz of [-1.2,1.2])this.drum(g,x+dx,.4,z+dz,.12,5.4,'#929d9e');
      this.drum(g,x,5.5,z,2.05,2.9,'#a7bdc8');this.part(g,this.sphere,x,8.35,z,2.05,.65,2.05,'#c8c9bf');for(const y of [5.5,7.9])this.hoop(g,x,y,z,2.1,'#929d9e');this.drum(g,x,.4,z,.17,5.2,'#929d9e');for(let i=0;i<15;i++)b(g,x+1.8,.65+i*.5,z+1.25,.55,.04,.08,'#425563');return true;
    }
    if(c.kind==='sewage'){
      for(const dx of [-1.7,1.7]){this.drum(g,x+dx,.4,z,1.45,.9,'#929d9e');this.drum(g,x+dx,1.3,z,1.3,.05,'#6f9698');this.hoop(g,x+dx,1.35,z,1.45,'#c8c9bf');b(g,x+dx,1.4,z,.15,.08,2.8,'#425563');}this.round(g,x,.4,z-2.7,4.5,1.9,1.25,'#c8c9bf');return true;
    }
    const fire=c.kind==='fire',industrial=['utility','power','recycling'].includes(c.kind),accent=fire?'#a65f4b':c.kind==='police'?'#4a6383':c.kind==='school'?'#b28b73':industrial?'#517d48':'#929d9e';
    this.round(g,x,.4,z-.5,5.5,3.2,4.5,c.kind==='school'?'#b28b73':'#c8c9bf');b(g,x,3.6,z-.5,5.7,.17,4.7,accent);
    for(const side of [-1,1])for(const zz of [-1.8,-.3,1.2]){b(g,x+side*2.78,1.1,z+zz,.06,1.45,1,'#578caa');b(g,x+side*2.82,1.03,z+zz,.15,.08,1.12,'#929d9e');}
    if(fire||c.kind==='recycling'){for(const dx of [-1.35,1.35]){b(g,x+dx,.5,z+1.78,2.1,2.35,.09,accent);for(let i=0;i<9;i++)b(g,x+dx,.65+i*.24,z+1.84,2.04,.035,.03,'#929d9e');b(g,x+dx,2,z+1.86,1.7,.45,.04,'#578caa');this.drum(g,x+dx+1.15,.4,z+2.25,.065,.7,'#dfb56d');}}
    else{
      b(g,x,.45,z+1.8,2.5,2.3,.08,'#578caa');for(const dx of [-1.2,0,1.2])b(g,x+dx,.45,z+1.86,.055,2.3,.08,'#425563');
      this.round(g,x,2.8,z+2.35,3.6,.12,1.6,'#c8c9bf');for(const side of [-1,1])this.drum(g,x+side*1.6,.4,z+2.95,.055,2.4,'#929d9e');
    }
    if(c.kind==='clinic'){this.drum(g,x,.45,z+2,1.05,2.65,'#578caa');this.part(g,this.sphere,x,3.1,z+2,1.17,.45,1.17,'#c8c9bf');for(const dx of [-.7,.7])this.drum(g,x+dx,.45,z+2.7,.035,2.5,'#929d9e');b(g,x,3.9,z+1.76,1,.25,.07,'#a65f4b');b(g,x,3.55,z+1.77,.25,1,.07,'#a65f4b');this.round(g,x-1,3.8,z-1,2,1.5,1.7,'#c8c9bf');}
    if(c.kind==='school'){this.round(g,x-1,3.8,z-.6,2.8,1.8,2.6,'#b28b73');this.part(g,this.kit.roof,x-1,5.6,z-.6,3.15,1.1,2.85,'#697f8e');this.drum(g,x+2.9,.4,z+2.7,.035,4.4,'#929d9e');this.bed(g,x-2.7,z+2.8,.45);}
    if(fire){this.round(g,x+1.8,3.8,z-1.6,1.25,2.7,1.35,'#b28b73');for(let i=0;i<3;i++)b(g,x+1.8,4.2+i*.7,z-.91,.65,.35,.03,'#578caa');}
    if(industrial){for(let i=-1;i<=1;i++){const panel=b(g,x+i*1.55,3.95,z-.5,1.4,.08,2.9,'#477e99');panel.rotation.x=-.16;for(let j=0;j<4;j++)b(g,x+i*1.55,4.15,z-1.6+j*.65,1.4,.018,.025,'#929d9e');}}
    else{this.drum(g,x+1.6,3.85,z-1.5,.62,.4,'#929d9e');this.hoop(g,x+1.6,4.25,z-1.5,.58,'#425563');this.fan(x+1.6,4.27,z-1.5);}
    for(const dx of [-2.8,2.8])this.shrub(g,x+dx,z+2.7,.4);return true;
  }
}
