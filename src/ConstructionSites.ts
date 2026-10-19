import * as THREE from 'three';
import {VehicleBatches,type VisualKit} from './cityVisuals';
import {upgradePhase} from './upgradeConstruction';
import type {Cell,City} from './simulation';

/** Static scaffolding joins city batches; moving workers and hoists share one
 * instanced layer. All equipment fits inside the lot, leaving streets clear. */
export class ConstructionSites{
  private source=new THREE.Group();private rendered=new THREE.Group();private batch=new VehicleBatches(this.rendered);
  private sphere=new THREE.SphereGeometry(1,12,8);
  private actors:{key:string;worker:THREE.Group;arm:THREE.Group;lift:THREE.Group;cable:THREE.Mesh;height:number;clock:number}[]=[];
  constructor(scene:THREE.Scene,private kit:VisualKit){scene.add(this.rendered);}
  begin(){this.source.clear();this.actors=[];}
  draw(c:Cell,g:THREE.Group,height:number){
    const p=c.upgrade;if(!p)return;const phase=upgradePhase(p),x=c.x*8,z=c.z*8,b=this.kit.box;
    const top=Math.max(5,height+.6),frameHeight=phase===0?Math.min(6,top):top;
    // Open frontage keeps the entrance and sidewalk accessible.
    for(const side of [-1,1])for(const off of [-2.5,2.5]){
      b(g,x+off,.4,z+side*3.6,1.5,.65,.12,'#e4b95f');
      for(const stripe of [-.45,0,.45])b(g,x+off+stripe,.44,z+side*3.67,.18,.52,.025,'#425563');
    }
    for(const dx of [-3.45,3.45])for(const dz of [-3.45,0,3.45])b(g,x+dx,.4,z+dz,.065,frameHeight,.065,'#929d9e');
    for(let y=2.6;y<frameHeight;y+=2.4){
      for(const side of [-1,1]){
        b(g,x+side*3.4,y,z,.35,.12,6.95,'#927b68');b(g,x,y,z+side*3.4,6.95,.12,.35,'#927b68');
        b(g,x+side*3.54,y+.85,z,.05,.05,7.1,'#929d9e');b(g,x,y+.85,z+side*3.54,7.1,.05,.05,'#929d9e');
      }
    }
    if(phase>=1){
      // Rising structural cage, followed by strips of protective facade sheeting.
      for(const dx of [-2.8,2.8])for(const dz of [-2.8,2.8])b(g,x+dx,.4,z+dz,.16,top,.16,'#b6c5c5');
      for(let y=5;y<top;y+=3){b(g,x,y,z,5.8,.12,.14,'#b6c5c5');b(g,x,y,z,.14,.12,5.8,'#b6c5c5');}
      if(phase===2)for(const side of [-1,1])for(const dx of [-2.35,2.35])b(g,x+dx,2.8,z+side*3.49,1.5,Math.max(1,top-3),.025,'#4c9b9c');
    }
    // A compact mast lift instead of a crane boom extending into neighboring lots.
    b(g,x-3.1,.4,z-2.8,.28,top+1.5,.28,'#e4b95f');b(g,x-2.1,top+1.9,z-2.8,2.3,.18,.22,'#e4b95f');
    for(let y=.6;y<top+1.5;y+=.6)b(g,x-3.1,y,z-2.62,.33,.06,.035,'#425563');
    for(let i=0;i<3;i++)b(g,x+2.9,.42+i*.2,z-3,.7,.16,.6,'#b89368');
    const lift=new THREE.Group();lift.position.set(x-1.3,1,z-2.8);b(lift,0,0,0,.7,.12,.6,'#e4b95f');b(lift,0,.12,0,.4,.4,.4,'#b78770');this.source.add(lift);
    const worker=new THREE.Group();worker.position.set(x-3.05,.4,z+1.8);worker.rotation.y=Math.PI/2;
    const part=(dx:number,y:number,dz:number,sx:number,sy:number,sz:number,color:string)=>{const m=new THREE.Mesh(this.sphere,this.kit.material(color));m.position.set(dx,y,dz);m.scale.set(sx,sy,sz);m.castShadow=true;worker.add(m);return m;};
    part(0,.96,0,.19,.32,.12,'#dc8c39');part(0,1.42,0,.13,.17,.12,'#c59b7d');part(0,1.55,0,.17,.09,.16,'#e4b95f');
    for(const side of [-1,1]){part(side*.1,.4,0,.08,.32,.08,'#425563');part(side*.1,.075,.045,.085,.075,.16,'#31404a');b(worker,side*.09,.76,.12,.055,.4,.025,'#fff0b0');}
    const arm=new THREE.Group();arm.position.set(.21,1.16,0);b(arm,0,-.45,0,.11,.48,.12,'#dc8c39');b(arm,0,-.51,.015,.12,.1,.12,'#c59b7d');worker.add(arm);part(-.22,.98,0,.07,.25,.08,'#dc8c39');this.source.add(worker);
    const cable=b(this.source,x-1.3,1.5,z-2.8,.025,top+.4,.025,'#425563');
    this.actors.push({key:`${c.x},${c.z}`,worker,arm,lift,cable,height:top,clock:p.duration-p.remaining});
  }
  end(){this.batch.rebuild(this.source);this.batch.update(this.source);}
  update(city:City,dt:number,lots:Record<string,{supplied:boolean}>,reducedMotion:boolean){
    if(dt<=0)return;
    for(const a of this.actors){const p=city.cells[a.key]?.upgrade;if(!p)continue;
      if(!reducedMotion&&lots[a.key]?.supplied)a.clock+=dt;
      a.arm.rotation.x=reducedMotion?0:-.35+Math.sin(a.clock*4)*.45;
      a.lift.position.y=1+(Math.sin(a.clock*.55-Math.PI/2)+1)*.5*(a.height-1);
      const bottom=a.lift.position.y+.5,length=a.height+1.9-bottom;a.cable.scale.y=length;a.cable.position.y=bottom+length/2;
    }
    if(this.actors.length)this.batch.update(this.source);
  }
  dispose(){this.batch.dispose();this.source.clear();this.rendered.removeFromParent();this.sphere.dispose();}
}
