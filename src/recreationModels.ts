import type * as THREE from 'three';
import type {Cell} from './simulation';
type Box=(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>THREE.Mesh;
type Tree=(parent:THREE.Object3D,x:number,z:number,s?:number)=>void;

export function drawRecreation(c:Cell,g:THREE.Group,mesh:Box,tree:Tree){
  const x=c.x*8,z=c.z*8;
  const bench=(bx:number,bz:number)=>{mesh(g,bx,.5,bz,2.3,.25,.65,'#b68b61');mesh(g,bx,.8,bz-.25,2.3,.65,.15,'#b68b61');for(const dx of [-.8,.8])mesh(g,bx+dx,.25,bz,.15,.5,.5,'#566957');};
  if(c.kind==='playground'){
    mesh(g,x+4,.3,z+4,14.8,.15,14.8,'#d2ba88');mesh(g,x+4,.46,z+4,11.5,.08,10,'#dca96e');
    // Swings: two seats suspended from a blue frame.
    for(const dx of [0,7])mesh(g,x+dx,.55,z+1,.3,3.7,.35,'#548f9b');
    mesh(g,x+3.5,4.2,z+1,7.4,.3,.35,'#548f9b');
    for(const dx of [2,5]){for(const offset of [-.55,.55])mesh(g,x+dx+offset,1.1,z+1,.06,3.1,.06,'#526363');mesh(g,x+dx,1,z+1,1.4,.2,.6,'#cd7559');}
    // Raised play tower, ladder, and sloped slide.
    for(const dx of [0,2])for(const dz of [0,2])mesh(g,x+dx,.55,z+6+dz,.23,3,.23,'#a4764d');
    mesh(g,x+1,3.2,z+7,2.7,.25,2.7,'#e0bc67');mesh(g,x+1,4.8,z+7,3.1,.3,3.1,'#cf765e');
    for(const dx of [0,2])mesh(g,x+dx,3.4,z+7,.15,1.4,.15,'#a4764d');
    const slide=mesh(g,x+3.7,1.6,z+7,4,.18,1.3,'#6aadb7');slide.rotation.z=-Math.PI/5;
    for(let i=0;i<5;i++)mesh(g,x-.4,.6+i*.5,z+7,1,.12,.2,'#e3c37b');
    bench(x+8,z+9);tree(g,x+9.5,z-1.5,1.5);tree(g,x-1.7,z+10,1.4);
    mesh(g,x+4,.48,z+10.7,14.5,.12,1,'#e5d6b7');
  }else if(c.kind==='sports'){
    const cx=x+8,cz=z+4;
    mesh(g,cx,.3,cz,23.2,.15,15.2,'#6c9c6e');
    for(let i=0;i<6;i++)mesh(g,cx-9+i*3.6,.46,cz,3.6,.04,10.7,i%2?'#79aa78':'#70a271');
    for(const dz of [-5.4,5.4])mesh(g,cx,.52,cz+dz,21.5,.04,.12,'#f0eed7');
    for(const dx of [-10.7,0,10.7])mesh(g,cx+dx,.52,cz,.12,.04,10.9,'#f0eed7');
    for(let i=0;i<24;i++){const angle=i*Math.PI/12,line=mesh(g,cx+Math.cos(angle)*2.1,.52,cz+Math.sin(angle)*2.1,.57,.04,.12,'#f0eed7');line.rotation.y=-angle-Math.PI/2;}
    for(const dx of [-10.7,10.7]){
      for(const dz of [-1.6,1.6])mesh(g,cx+dx,.55,cz+dz,.15,2,.15,'#f0eed7');mesh(g,cx+dx,2.55,cz,.15,.15,3.4,'#f0eed7');
      for(const dz of [-2.8,2.8])mesh(g,cx+dx-Math.sign(dx)*1.8,.53,cz+dz,3.5,.04,.1,'#f0eed7');mesh(g,cx+dx-Math.sign(dx)*3.5,.53,cz,.1,.04,5.7,'#f0eed7');
    }

    for(const dx of [-11.4,11.4]){mesh(g,cx+dx,.4,cz-6.7,.15,5,.15,'#697e76');mesh(g,cx+dx,5.4,cz-6.7,1,.35,.45,'#f1ead1');}
  }else if(c.kind==='largepark'){
    const cx=x+8,cz=z+8;
    mesh(g,cx,.3,cz,23.3,.15,23.3,'#99b57c');
    mesh(g,cx,.47,cz,2.2,.1,23,'#ddd2b2');mesh(g,cx,.47,cz,23,.1,2.2,'#ddd2b2');
    for(const d of [-8,8]){mesh(g,cx+d,.47,cz,1.3,.1,17,'#ddd2b2');mesh(g,cx,.47,cz+d,17,.1,1.3,'#ddd2b2');}
    mesh(g,cx,.6,cz,5.5,.6,5.5,'#bac5b5');mesh(g,cx,1.21,cz,4.8,.08,4.8,'#75b5bd');mesh(g,cx,1.3,cz,1.1,1.6,1.1,'#d8dfcd');mesh(g,cx,2.9,cz,2.1,.25,2.1,'#b9d6cf');
    for(const [dx,dz]of [[-5,-5],[5,-5],[-5,5],[5,5],[-10,-10],[10,-10],[-10,10],[10,10]])tree(g,cx+dx,cz+dz,2);
    for(const dz of [-4,4]){bench(cx-2.5,cz+dz);bench(cx+2.5,cz+dz);}
    for(const dx of [-5,5]){mesh(g,cx+dx,.5,cz+9.7,2,.8,1.2,'#b39168');for(const dz of [9,10.4])mesh(g,cx+dx,.5,cz+dz,2.5,.25,.4,'#b39168');}
    for(const dx of [-5,5])for(let i=0;i<5;i++)mesh(g,cx+dx-1+i*.5,.5,cz-9.7,.3,.35,.6,i%2?'#dfb56d':'#c58c8d');
  }
}
