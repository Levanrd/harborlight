import * as THREE from 'three';
import {buildingVariant,type VisualKit} from './cityVisuals';
import {waterEdge,validLand,type City,type Cell} from './simulation';
import {VehicleModels} from './vehicleModels';

/** Shared, batchable details. Empty parcels are re-evaluated after construction. */
export class UrbanDetails {
  private cylinder=new THREE.CylinderGeometry(1,1,1,16);
  private ring=new THREE.TorusGeometry(1,.035,6,24);
  private sphere=new THREE.SphereGeometry(1,12,8);
  private vehicles=new VehicleModels();
  constructor(private kit:VisualKit){}
  private pipe(g:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,color='#929d9e'){const m=new THREE.Mesh(this.cylinder,this.kit.material(color));m.position.set(x,y+h/2,z);m.scale.set(r,h,r);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
  private crown(g:THREE.Object3D,x:number,y:number,z:number,r:number,color='#517d48'){const m=new THREE.Mesh(this.sphere,this.kit.material(color));m.position.set(x,y,z);m.scale.set(r,r*.6,r*.8);m.castShadow=true;g.add(m);}
  private seat(g:THREE.Object3D,x:number,z:number){const b=this.kit.box;for(let i=0;i<4;i++)b(g,x,.68,z+i*.09,1.2,.045,.065,'#927b68');for(const dx of [-.55,.55])b(g,x+dx,.35,z+.18,.05,.32,.3,'#425563');}
  private fence(g:THREE.Object3D,x:number,z:number,w:number){const b=this.kit.box;for(let i=-w/2;i<=w/2;i+=.4)b(g,x+i,.35,z,.035,1.15,.035,'#929d9e');for(const y of [.6,1.45])b(g,x,y,z,w,.04,.05,'#929d9e');}
  architecture(c:Cell,g:THREE.Group){
    const b=this.kit.box,x=c.x*8,z=c.z*8,v=buildingVariant(c);
    if(c.kind==='residential'){
      if(c.level===1){
        for(const side of [-1,1])for(let i=0;i<5;i++)b(g,x+side*2.38,1.15+i*.23,z-.8,.06,.035,.9,'#c8c9bf');
        b(g,x+2.85,.4,z+3.15,.08,.9,.08,'#425563');b(g,x+2.85,1.3,z+3.15,.42,.25,.28,'#697f8e');
        for(const side of [-1,1]){b(g,x+side*2.4,2.65,z-.2,.1,.11,4.6,'#929d9e');this.pipe(g,x+side*2.4,.4,z-2.35,.035,2.3);}
      }else{
        const floors=c.level===2?2+v%3:[5,7,9,12,6,10][v];
        for(let f=1;f<floors;f++){
          const yy=.9+f*2.15;
          if(f%2===v%2){b(g,x-1.4,yy,z+2.8,.5,.38,.4,'#927b68');this.crown(g,x-1.4,yy+.55,z+2.8,.28);}
          // Small external condenser and grille; no giant flat slabs on the facade.
          if(f%3===1){b(g,x+2.68,yy,z-1.45,.38,.48,.7,'#c8c9bf');for(let i=0;i<5;i++)b(g,x+2.88,yy+.06+i*.075,z-1.45,.02,.025,.57,'#697f8e');}
        }
        const y=floors*2.15+.85;for(const side of [-1,1])b(g,x+side*2.35,y,z,.08,.5,4.6,'#c8c9bf');b(g,x,y,z+2.25,4.7,.5,.08,'#c8c9bf');
        for(let i=0;i<6;i++)b(g,x+.8,y+.1+i*.15,z-1.72,1.65,.04,.03,'#929d9e');
      }
    }else if(c.kind==='commercial'&&c.level<3){
      for(const dx of [-1.9,0,1.9]){b(g,x+dx,1.7,z+2.2,.055,.8,.05,'#425563');this.pipe(g,x+dx,.4,z+2.9,.035,.45,'#425563');}
      for(let i=0;i<3;i++){b(g,x-2.2+i*.29,.6,z+3.1,.19,.45,.3,['#c58c8d','#dfb56d','#517d48'][i]);}
    }else if(c.kind==='industrial'){
      const h=3.4+((c.factoryTier||1)-1)*1.15;
      for(const dx of [-2.9,2.9]){this.pipe(g,x+dx,.45,z-1.9,.045,h+.7);for(let i=0;i<10;i++)b(g,x+dx,.7+i*h/10,z-1.93,.35,.035,.07,'#929d9e');}
      for(let i=0;i<4;i++)b(g,x-2.2,.48+i*.16,z+3,1.2,.07,.8,'#927b68');
      this.fence(g,x,z-3.5,6.8);
      for(const dx of [-1.4,1.4]){const rim=new THREE.Mesh(this.ring,this.kit.material('#425563'));rim.rotation.x=Math.PI/2;rim.scale.setScalar(.4);rim.position.set(x+dx,h+1.5,z-1.4);g.add(rim);}
    }
  }
  facility(c:Cell,g:THREE.Group){
    const x=c.x*8,z=c.z*8,b=this.kit.box;
    if(!['police','clinic','school','fire','utility','power','recycling'].includes(c.kind))return;
    // Rooftop air handling, duct joints and small service stair with safety rail.
    const y=3.82;
    b(g,x+1.4,y,z-.8,1,.55,1.05,'#929d9e');
    for(let i=0;i<6;i++)b(g,x+1.4,y+.08+i*.07,z-.25,.88,.025,.025,'#425563');
    this.pipe(g,x+1.4,y+.56,z-.8,.31,.1,'#425563');
    for(const dx of [-.9,-.55])this.pipe(g,x+dx,.45,z-2.82,.025,3.4);
    for(let i=0;i<11;i++)b(g,x-.73,.6+i*.29,z-2.85,.42,.025,.045,'#929d9e');
    for(const side of [-1,1]){b(g,x+side*2.68,y,z-.5,.08,.3,4.5,'#c8c9bf');this.pipe(g,x+side*2.7,.4,z-2.65,.035,3.3);}
    // Accessible frontage: tactile threshold, slim handrails and low planting.
    b(g,x,.31,z+3.1,1.5,.07,1.3,'#d9d6c7');
    if(c.kind==='clinic'||c.kind==='school')for(const dx of [-1.1,1.1]){for(const dz of [2.6,3.6])this.pipe(g,x+dx,.4,z+dz,.025,.7,'#425563');b(g,x+dx,1.1,z+3.1,.035,.035,1,'#425563');}
    this.pipe(g,x-2.5,.4,z+2.9,.28,.6,'#929d9e');this.crown(g,x-2.5,1.15,z+2.9,.45);
  }
  infill(city:City,g:THREE.Group){
    const b=this.kit.box;
    for(let z=-7;z<=17;z++)for(let x=-17;x<=9;x++){
      if(city.cells[`${x},${z}`]||!validLand(x,z))continue;
      // Only decorate blocks actually surrounded by development, not untouched map land.
      const nearby=Object.values(city.cells).filter(c=>c.kind!=='road'&&Math.abs(c.x-x)<=1&&Math.abs(c.z-z)<=1);if(!nearby.length)continue;
      const parcel=new THREE.Group();parcel.userData.cell=`${x},${z}`;g.add(parcel);const xx=x*8,zz=z*8,v=Math.abs(x*11+z*17)%5;
      if(z>=11){
        b(parcel,xx,.08,zz,7.9,.09,7.9,'#677170');
        for(const dx of [-2.6,0,2.6]){b(parcel,xx+dx,.19,zz, .055,.015,5.8,'#e7e5d7');if(v<3&&dx!==0){const car=this.vehicles.create('car',Math.abs(Math.round(x*31+z*13+dx*10)));car.position.set(xx+dx*.62,.45,zz-.8);parcel.add(car);}}
        if(v===3)for(let i=0;i<3;i++){b(parcel,xx-2+i*2,.3,zz-1.5,1.7,1.2,3,'#929d9e');for(let j=0;j<10;j++)b(parcel,xx-2+i*2,.35+j*.11,zz+.02,1.6,.025,.035,'#697f8e');}
        this.fence(parcel,xx,zz-3.65,7.3);
      }else{
        b(parcel,xx,.07,zz,7.95,.06,7.95,'#90b476');b(parcel,xx,.15,zz,1.2,.055,8,'#d9d6c7');b(parcel,xx,.15,zz,8,.055,1.2,'#d9d6c7');
        for(const dx of [-2.3,2.3])for(const dz of [-2.3,2.3]){if(v===1&&dx>0){b(parcel,xx+dx,.2,zz+dz,1.5,.25,1.5,'#927b68');for(let j=0;j<3;j++)this.crown(parcel,xx+dx-.45+j*.45,.65,zz+dz,.25);}else this.kit.tree(parcel,xx+dx,zz+dz,.7+(v%3)*.18);}
        if(v%2===0)this.seat(parcel,xx+2,zz+.9);
        this.pipe(parcel,xx-.8,.25,zz-1,.045,2.2,'#425563');this.crown(parcel,xx-.8,2.5,zz-1,.13,'#fff0b0');
      }
    }
    // The promenade hugs the actual shoreline; it ends before the working cargo port.
    for(let z=-99;z<=31;z+=4){
      const a=waterEdge(z-2)-4.2,c=waterEdge(z+2)-4.2,length=Math.hypot(c-a,4),segment=new THREE.Group();
      segment.position.set((a+c)/2,0,z);segment.rotation.y=Math.atan2(c-a,4);g.add(segment);
      b(segment,0,.06,0,2.1,.14,length+.08,'#927b68');for(let i=0;i<8;i++)b(segment,0,.205,-length/2+(i+.5)*length/8,2.1,.012,.025,'#697f8e');
      this.pipe(segment,1,.2,-length/2,.035,.9,'#c8c9bf');b(segment,1,1.1,0,.04,.04,length+.08,'#c8c9bf');
      if(z%12===-3||z%12===9){this.seat(segment,-1.8,0);this.kit.tree(segment,-3.2,1.5,.7);}
    }
  }
  dispose(){this.cylinder.dispose();this.ring.dispose();this.sphere.dispose();this.vehicles.dispose();}
}
