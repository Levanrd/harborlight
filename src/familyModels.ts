import * as THREE from 'three';
import type {Cell} from './simulation';
import type {VisualKit} from './cityVisuals';
import {buildingVariant} from './buildingFamilies';

/** Parcel-sized architectural families. Shared kit geometry keeps scenery batched.
 * All entrances retain the pedestrian system's existing front-door coordinates. */
export function drawFamilyModel(c:Cell,g:THREE.Group,kit:VisualKit){
  const x=c.x*8,z=c.z*8,v=buildingVariant(c),b=kit.box;
  const stone='#c8c9bf',dark='#425563',green='#638854',glass='#427795';
  const box=(dx:number,y:number,dz:number,w:number,h:number,d:number,color:string)=>b(g,x+dx,y,z+dz,w,h,d,color);
  const round=(dx:number,y:number,dz:number,r:number,h:number,depth:number,color:string)=>{const m=new THREE.Mesh(kit.cylinder,kit.material(color));m.position.set(x+dx,y+h/2,z+dz);m.scale.set(r,h,depth);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
  const roof=(dx:number,y:number,dz:number,w:number,h:number,d:number)=>{const m=new THREE.Mesh(kit.roof,kit.material('#74848c'));m.position.set(x+dx,y,z+dz);m.scale.set(w,h,d);m.castShadow=true;g.add(m);};
  const garden=(dx:number,y:number,dz:number,w:number,d:number)=>{box(dx,y,dz,w,.28,d,stone);box(dx,y+.28,dz,w-.14,.22,d-.14,green);};
  const lobby=(dx:number,dz:number)=>{box(dx,.42,dz, .72,1.4,.12,'#365d72');box(dx,2.32,dz+.25,1.7,.13,.8,stone);box(dx,.32,dz+.35,1.65,.09,.9,stone);};
  const facade=(dx:number,y:number,dz:number,w:number,floors:number,d:number,color:string)=>{
    const h=floors*2.15;box(dx,y,dz,w,h,d,color);
    for(let f=0;f<floors;f++){
      const yy=y+.5+f*2.15;
      for(const side of [-1,1]){
        for(let a=-w/2+.55;a<w/2-.2;a+=1.25)box(dx+a,yy,dz+side*(d/2+.025),.65,1.22,.06,'#578caa');
        for(let a=-d/2+.55;a<d/2-.2;a+=1.25)box(dx+side*(w/2+.025),yy,dz+a,.06,1.22,.65,'#578caa');
      }
      box(dx,y+(f+1)*2.15-.08,dz,w+.12,.12,d+.12,stone);
    }
    box(dx,y+h,dz,w+.18,.18,d+.18,stone);return y+h+.18;
  };
  box(0,.29,0,7.45,.09,7.45,c.kind==='residential'?'#90b476':'#d9d6c7');
  if(c.kind==='residential'){
    const floors=c.level===2?3:8;
    // The ground-floor lobby connects both wings and keeps the door accessible.
    facade(0,.4,0,4.9,1,4.7,'#e6d3b2');lobby(1,2.43);
    box(1,.38,3.1,1.4,.035,1.3,stone);
    if(v===2){
      const h=facade(-1.45,2.55,-.3,1.8,floors,4.1,'#dfb6a2');
      facade(1.45,2.55,-.75,1.8,floors-1,3.2,'#e6d3b2');
      facade(0,2.55,-1.85,1.1,Math.max(1,floors-2),1,'#c6d8cc');
      garden(0,2.58,.45,1.05,2.5);garden(-1.45,h,-.3,1.65,3.6);
      for(const dx of [-2.4,2.4])box(dx,.45,2.82,.14,2.2,.14,stone);
      return h+.6;
    }
    if(v===3){
      let top=2.55;
      for(let i=0;i<3;i++){
        const depth=4.7-i*1.1,cz=-i*.55;
        top=facade(0,top,cz,4.9-i*.35,c.level===2?1:3,depth,i%2?'#c6d8cc':'#e6d3b2');
        garden(-1.15,top,cz+depth/2-.32,1.35,.5);garden(1.15,top,cz+depth/2-.32,1.35,.5);
        // Railings follow the terrace edge rather than the old box-shaped facade.
        box(0,top+.18,cz+depth/2+.02,4.85-i*.35,.62,.05,'#86b4b9');
      }
      box(0,top,-1.15,1.6,.8,1.5,dark);return top+1;
    }
    const h=2.55+floors*2.15;
    round(0,2.55,-.25,2.1,floors*2.15,1.85,'#527e97');
    for(let f=0;f<=floors;f++){
      const y=2.55+f*2.15;round(0,y,-.25,2.65,.15,2.35,stone);
      if(f<floors)for(let i=0;i<20;i++){const a=i*Math.PI/10;box(Math.cos(a)*2.6,y+.15,-.25+Math.sin(a)*2.3,.035,.72,.035,dark);}
    }
    for(const dx of [-.8,.8])garden(dx,h+.15,.6,1.15,.6);
    round(0,h+.15,-.6,1.25,1.2,1,dark);return h+1.5;
  }
  if(c.kind==='commercial'){
    box(0,.4,0,6.3,2.5,5.9,stone);lobby(0,2.97);
    for(const dx of [-2.4,2.4])garden(dx,.4,3.25,1,.6);
    if(v===3){
      // Receding elliptical floors produce a curved, tapered skyline.
      for(let f=0;f<14;f++){
        const r=2.65-f*.085,y=2.9+f*2.05;
        round(0,y,0,r,2.05,r*.86,glass);round(0,y+1.92,0,r+.06,.13,r*.86+.06,stone);
      }
      round(0,31.6,0,1.1,1.5,.95,'#365d72');round(0,33.1,0,1.2,.2,1.05,'#79d9e5');
      box(0,33.3,0,.1,2.8,.1,stone);return 36.2;
    }
    for(let i=0;i<3;i++){
      const y=2.9+i*8.6,w=5.6-i*.95,d=4.8-i*.85,dx=-i*.38,dz=-i*.32;
      box(dx,y,dz,w,8.6,d,glass);
      for(let f=1;f<=4;f++)box(dx,y+f*2.15-.1,dz,w+.14,.15,d+.14,stone);
      for(const a of [-.36,0,.36])box(dx+a*w,y,dz+d/2+.08,.13,8.6,.14,stone);
      garden(dx,y+8.6,dz+d/2-.45,w-.25,.65);
    }
    box(-.76,29.2,-.64,2.5,1.4,1.8,dark);return 30.8;
  }
  const h=3.4+((c.factoryTier||1)-1)*1.15;
  if(v%2===0){
    box(0,.4,-.4,5.8,h,4.6,'#a7bdc8');
    for(const dx of [-1.9,0,1.9]){
      roof(dx,h+.4,-.4,1.92,1.1,4.7);
      box(dx+.72,h+.5,-.4,.06,.65,4.55,'#578caa');
      box(dx,.5,1.95,1.5,2.2,.1,dark);
      for(let j=0;j<6;j++)box(dx,.65+j*.3,2.02,1.4,.035,.035,stone);
      box(dx,.4,2.5,1.6,.15,1,'#929d9e');
    }
    box(-2.4,.45,3.18,1.6,.85,.7,'#b78770');
    for(let i=0;i<8;i++)box(-3.08+i*.19,.5,3.55,.04,.7,.035,stone);
    return h+1.6;
  }
  facade(1.55,.4,.1,2.5,2,3.5,'#b78770');
  box(0,.4,1.65,1.3,2.3,.6,'#b78770');lobby(0,1.98);
  for(const dz of [-1.65,.1]){
    round(-1.6,.4,dz,.9,h+2,.9,'#b6c5c5');round(-1.6,h+2.4,dz,.95,.2,.95,stone);
    for(let j=0;j<4;j++)round(-1.6,1+j*(h+1)/4,dz,.92,.07,.92,dark);
    box(-.5,1.7,dz,1.4,.18,.18,stone);
  }
  round(.35,.4,-2.25,.35,h+4,.35,'#b78770');round(.35,h+3.75,-2.25,.38,.22,.38,stone);
  for(const dx of [-2,2])box(dx,.4,3.25,1.7,.12,.7,dark);return Math.max(h+4.5,5.2);
}
