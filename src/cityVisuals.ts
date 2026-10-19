import * as THREE from 'three';
import {prepareHumanLimb,writeHumanLimb,uploadHumanLimb,disposeHumanLimb} from './humanSkinning';
import type {Cell} from './simulation';
import {buildingVariant,hasFamilyModel} from './buildingFamilies';
import {drawFamilyModel} from './familyModels';
export {buildingVariant} from './buildingFamilies';

export type TextureStyle='stucco'|'brick'|'asphalt'|'paving'|'grass'|'roof'|'water'|'foliage'|'bark';
export function seededRandom(seed:number){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function createSurface(style:TextureStyle,repeat=1){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!,rand=seededRandom(91+style.length);
  ctx.fillStyle=style==='foliage'?'#c2c8b0':style==='bark'?'#b1a794':style==='grass'?'#adbda0':style==='asphalt'?'#8b9296':style==='water'?'#a9c5cd':'#e6e2d9';ctx.fillRect(0,0,256,256);
  for(let i=0;i<6500;i++){const v=Math.floor(rand()*100+90);ctx.fillStyle=`rgba(${v},${v},${v},${style==='grass'?.16:.12})`;ctx.fillRect(rand()*256,rand()*256,1+rand()*2,1+rand()*2);}
  if(style==='foliage'){for(let i=0;i<1700;i++){const shade=100+Math.floor(rand()*125);ctx.fillStyle=`rgba(${shade},${shade+8},${shade-12},.28)`;ctx.beginPath();ctx.ellipse(rand()*256,rand()*256,1+rand()*5,1+rand()*2,rand()*Math.PI,0,Math.PI*2);ctx.fill();}}
  if(style==='bark'){for(let i=0;i<140;i++){ctx.strokeStyle=`rgba(40,35,26,${.08+rand()*.2})`;ctx.lineWidth=.5+rand()*2;const x=rand()*256,y=rand()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*5-2,y+10+rand()*70);ctx.stroke();}}
  if(style==='brick'||style==='roof'){const h=style==='roof'?16:24;ctx.strokeStyle='rgba(65,65,60,.23)';ctx.lineWidth=1.5;for(let y=0;y<=256;y+=h){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();for(let x=-(y/h%2)*32;x<256;x+=64){ctx.strokeRect(x,y,64,h);}}}
  if(style==='paving'){ctx.strokeStyle='rgba(85,88,80,.2)';for(let i=0;i<256;i+=32){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}}
  if(style==='water'){for(let y=0;y<256;y+=8){ctx.strokeStyle=`rgba(255,255,255,${.05+rand()*.15})`;ctx.beginPath();for(let x=0;x<=256;x+=4){const yy=y+Math.sin(x/256*Math.PI*4+y)*2;if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();}}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=4;return t;
}
export function createSky(){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d')!,g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#7cb4e1');g.addColorStop(.48,'#e2eff3');g.addColorStop(.52,'#b4c3ad');g.addColorStop(1,'#536d59');x.fillStyle=g;x.fillRect(0,0,512,256);x.fillStyle='#fff4d2';x.fillRect(80,35,22,22);const t=new THREE.CanvasTexture(c);t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;return t;}

/** A recessed room, curtains, sill and glazing reflections instead of flat blue panes. */
export function createWindowSurface(emission=false){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=192;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=emission?'#06080a':'#29383c';ctx.fillRect(0,0,128,192);
  const room=ctx.createLinearGradient(0,12,0,175);room.addColorStop(0,emission?'#d2b188':'#8d9999');room.addColorStop(.55,emission?'#89745c':'#526769');room.addColorStop(1,emission?'#e2bd87':'#aeb2a5');ctx.fillStyle=room;ctx.fillRect(10,12,108,163);
  ctx.fillStyle=emission?'#241e18':'#354347';ctx.fillRect(21,110,85,36);ctx.fillRect(26,146,5,18);ctx.fillRect(94,146,5,18);
  for(const side of [0,1])for(let i=0;i<6;i++){ctx.fillStyle=emission?`rgb(${110+i*9},${94+i*7},${73+i*5})`:`rgb(${153+i*10},${157+i*9},${151+i*8})`;ctx.fillRect(side?96+i*3:10+i*3,13,3,150);}
  if(!emission){const reflection=ctx.createLinearGradient(0,0,128,192);reflection.addColorStop(0,'rgba(197,222,229,.48)');reflection.addColorStop(.5,'rgba(173,211,223,.06)');reflection.addColorStop(1,'rgba(224,228,205,.16)');ctx.fillStyle=reflection;ctx.fillRect(8,10,112,169);ctx.strokeStyle='rgba(231,242,243,.22)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(20,20);ctx.lineTo(112,112);ctx.stroke();}
  ctx.fillStyle=emission?'#080a0c':'#a8b1ad';ctx.fillRect(61,8,5,174);ctx.fillRect(7,174,114,6);ctx.fillRect(7,8,114,4);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

/** Shared window atlases keep detailed towers cheap to instance. The emission mask
 * lights individual rooms, leaving mullions and unoccupied offices dark. */
export function createFacade(emission=false){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
  const ctx=canvas.getContext('2d')!,random=seededRandom(730);
  ctx.fillStyle=emission?'#000000':'#82929e';ctx.fillRect(0,0,256,512);
  for(let row=0;row<24;row++)for(let col=0;col<16;col++){
    const occupied=random()>.6,shade=145+Math.floor(random()*70),warm=random()>.35,y=row*512/24;
    ctx.fillStyle=emission?(occupied?(warm?'#ffd499':'#9bc9f5'):'#030508'):`rgb(${shade-20},${shade+12},${Math.min(255,shade+37)})`;
    ctx.fillRect(col*16+2,y+2,12,17);
    if(!emission){ctx.fillStyle='rgba(238,250,255,.3)';ctx.fillRect(col*16+2,y+2,1,17);ctx.fillStyle='rgba(16,40,58,.35)';ctx.fillRect(col*16+2,y+17,12,2);}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;return texture;
}

function drawTower(c:Cell,g:THREE.Group,kit:VisualKit){
  const {box:b,material,tree}=kit,x=c.x*8,z=c.z*8,v=buildingVariant(c);
  const ivory='#c8c9bf',stone='#929d9e',glass=['#427795','#527e97','#314d68'][v%3],accent=v%2?'#79d9e5':'#ffe0a0';
  const h=23+v*2+(c.kind==='commercial'?3:0);
  const round=(xx:number,y:number,zz:number,rx:number,height:number,rz:number,color:string)=>{const m=new THREE.Mesh(kit.cylinder,material(color));m.position.set(xx,y+height/2,zz);m.scale.set(rx,height,rz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
  // A landscaped podium, recessed lobby, canopy, benches and rooftop planters.
  b(g,x,.3,z,7.5,.12,7.5,'#d9d6c7');b(g,x,.42,z,6.3,2.5,5.9,ivory);
  b(g,x,.6,z+2.97,4.8,1.9,.06,'#365d72');b(g,x,2.65,z+3.12,5.1,.16,1.1,ivory);
  for(const dx of [-2.1,0,2.1])b(g,x+dx,.6,z+3,.12,1.9,.15,stone);
  for(const dx of [-2.65,2.65]){b(g,x+dx,.43,z+3.35,1.15,.35,.65,'#b9c5cb');b(g,x+dx,.78,z+3.35,.95,.3,.5,'#638854');}
  for(const dz of [-2.4,1.9]){tree(g,x-3.12,z+dz,.65);b(g,x+3.3,.55,z+dz,.35,.35,1.1,'#927b68');}
  if(v===0||v===3){
    // Rounded glass tower and a narrower offset companion volume.
    round(x-.35,2.9,z,2.35,h,2.15,glass);
    round(x+1.65,2.9,z-.8,.85,h-4,1.05,'#314d68');
    for(let y=3;y<h+3;y+=2.15)round(x-.35,y,z,2.41,.12,2.21,stone);
    round(x-.35,h+2.9,z,2.45,.35,2.25,ivory);round(x-.35,h+3.25,z,1.85,.13,1.65,'#638854');
    round(x-.35,h+3.38,z,.9,1.1,.85,stone);round(x-.35,h+4.48,z,.95,.1,.9,accent);
    b(g,x+2.02,3,z+.72,.14,h-4,.14,ivory);
  }else if(v===1||v===4){
    // Masonry piers and progressively smaller crowns create a stepped skyline.
    const wall=v===1?'#d7c49e':'#a7bdc8';
    b(g,x,2.9,z,5.35,h-5,4.8,glass);
    for(const dx of [-2.55,-1.3,0,1.3,2.55])for(const side of [-1,1])b(g,x+dx,2.9,z+side*2.44,.46,h-5,.2,wall);
    for(const dz of [-2.3,-.8,.8,2.3])for(const side of [-1,1])b(g,x+side*2.72,2.9,z+dz,.2,h-5,.42,wall);
    for(let y=3;y<h-2;y+=1.9)b(g,x,y,z,5.7,.18,5.05,wall);
    for(let i=0;i<3;i++){
      const y=h-2.1+i*2.15,w=4.7-i*1.05;b(g,x,y,z,w,2.15,w*.88,'#365d72');b(g,x,y+2,z,w+.18,.16,w*.88+.18,wall);
      // Short crown floors use individual windows, so a full tower atlas is not
      // compressed into each two-metre setback and cannot shimmer at distance.
      for(const side of [-1,1])for(const offset of [-.25,.25]){
        b(g,x+offset*w,y+.45,z+side*(w*.44+.035),.35,1.05,.04,'#578caa');
        b(g,x+side*(w*.5+.035),y+.45,z+offset*w*.88,.04,1.05,.35,'#578caa');
      }
    }
    b(g,x,h+4.4,z,1.7,1.6,1.5,wall);b(g,x,h+6,z,.13,2.8,.13,accent);
  }else if(v===2){
    // Twin offset wings and sky terraces.
    b(g,x-1.15,2.9,z-.45,2.7,h,3.8,glass);b(g,x+1.35,2.9,z+.5,2.1,h-5,3.5,'#427795');
    for(let y=3;y<h+3;y+=2.4){b(g,x-1.15,y,z-.45,2.85,.13,3.95,ivory);if(y<h-2)b(g,x+1.35,y,z+.5,2.25,.13,3.65,ivory);}
    b(g,x-1.15,h+2.9,z-.45,2.9,.3,4,ivory);b(g,x+1.35,h-2.1,z+.5,2.3,.3,3.7,ivory);
    b(g,x+1.35,h-1.8,z+.5,1.9,.12,3.2,'#638854');b(g,x-1.15,h+3.2,z-.8,1.7,1.4,1.8,stone);
    for(const dx of [-2.5,.2])b(g,x+dx,3,z+1.5,.15,h,.15,accent);
  }else{
    // Slim office tower, vertical fins and a small illuminated roof pavilion.
    b(g,x,2.9,z,4.5,h,4.4,glass);
    for(const dx of [-2.3,-1.2,1.2,2.3])for(const side of [-1,1])b(g,x+dx,2.9,z+side*2.25,.14,h+.6,.14,ivory);
    for(let y=3;y<h+3;y+=4.3)b(g,x,y,z,4.75,.18,4.65,stone);
    b(g,x,h+2.9,z,4.8,.35,4.7,stone);b(g,x,h+3.25,z,3.6,1.9,3.4,'#365d72');
    b(g,x,h+5.15,z,3.85,.16,3.65,accent);b(g,x,h+5.3,z,.15,3.2,.15,stone);
  }
  return h+9.1;
}

export type VisualKit={box:(g:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>THREE.Mesh;material:(color:string)=>THREE.MeshStandardMaterial;tree:(g:THREE.Object3D,x:number,z:number,s?:number)=>void;roof:THREE.BufferGeometry;cylinder:THREE.BufferGeometry;};
export function buildingFootprintScale(c:Cell){const v=buildingVariant(c);return {x:[.91,1,.95,.88,1,.94][v],z:[1,.91,.94,1,.96,.9][v]};}
export function drawDetailedZone(c:Cell,g:THREE.Group,kit:VisualKit){
  const before=g.children.length,height=hasFamilyModel(c)?drawFamilyModel(c,g,kit):drawZoneParts(c,g,kit),footprint=buildingFootprintScale(c);
  // Deterministic footprint variation stays within the existing parcel and save format.
  const sx=footprint.x,sz=footprint.z;
  for(const part of g.children.slice(before)){part.position.x=c.x*8+(part.position.x-c.x*8)*sx;part.position.z=c.z*8+(part.position.z-c.z*8)*sz;part.scale.x*=sx;part.scale.z*=sz;}
  return height;
}
function drawZoneParts(c:Cell,g:THREE.Group,kit:VisualKit){
  const {box:b,material,tree}=kit,x=c.x*8,z=c.z*8,v=buildingVariant(c),level=c.level;
  const glass='#477e99',trim='#c7c9c2',dark='#425563';
  const roof=(y:number,w:number,d:number,color:string)=>{const m=new THREE.Mesh(kit.roof,material(color));m.position.set(x,y,z);m.scale.set(w,1.35,d);m.castShadow=true;m.receiveShadow=true;g.add(m);};
  const window=(xx:number,yy:number,zz:number,w=.85,h=1.1,side=false)=>{b(g,xx,yy,zz,side?.07:w+.09,h+.09,side?w+.09:.07,trim);b(g,xx+(side?(xx<x?-.075:.075):0),yy+.08,zz+(side?0:zz<z?- .075:.075),side?.04:w,h,side?w:.04,Math.abs(Math.round(xx+yy*3+zz))%4===0?'#365d72':'#578caa');b(g,xx,yy+.05,zz,side?.24:w+.3,.09,side?w+.3:.24,trim);};
  const entry=(xx:number,zz:number)=>{b(g,xx,.4,zz, .72,1.4,.16,dark);b(g,xx,1.1,zz+.1,.46,.48,.06,glass);b(g,xx,.28,zz+.45,1.7,.16,.9,'#d2cfc0');};
  const tank=(xx:number,yy:number,zz:number,r:number,h:number)=>{const m=new THREE.Mesh(kit.cylinder,material('#c6d1cd'));m.position.set(xx,yy+h/2,zz);m.scale.set(r,h,r);m.castShadow=true;g.add(m);b(g,xx,yy+h,zz,r*1.6,.15,r*1.6,'#f0eee3');};
  // Offices get glass curtain walls; homes retain balconies and masonry even at high density.
  if(level>=3&&c.kind==='commercial')return drawTower(c,g,kit);
  if(c.kind==='residential'){
    b(g,x,.28,z,7.45,.08,7.45,'#90b476');
    b(g,x+2.3,.37,z+1.5,1.4,.04,4.5,'#c5c5b8');b(g,x,.37,z+2.4,1.1,.04,2.4,'#ddd5be');
    for(const dx of [-3.2,3.2])b(g,x+dx,.4,z-1.2,.35,.65,4.7,'#638854');
    if(level===1){
      const walls=['#e6d3b2','#c6d8cc','#dfb6a2','#c4d5df','#e9dfc3','#d9c6b4'][v];
      b(g,x,.4,z-.2,4.6,2.3,4.2,walls);roof(2.7,5.15,4.8,['#b4795d','#697f8e','#927b68'][v%3]);
      b(g,x-1.4,2.7,z-.9,.55,1.3,.65,'#b78770');entry(x+.9,z+1.96);window(x-1.1,1.2,z+1.96,1.15);window(x+2.34,1.2,z-.8,1,1.15,true);window(x-2.34,1.2,z-.8,1,1.15,true);for(const dx of [-1.2,1.2])window(x+dx,1.2,z-2.34,.9,1.1);
      b(g,x-.8,2.65,z+1.2,1.1,.9,.9,walls);b(g,x-.8,3.5,z+1.2,1.35,.17,1.2,'#74848c');window(x-.8,2.8,z+1.69,.55,.55);
      b(g,x+.85,2.0,z+2.45,1.9,.15,1.1,trim);for(const dx of [.1,1.6])b(g,x+dx,.4,z+2.8,.12,1.65,.12,trim);
      tree(g,x-2.75,z+2.4,.8);b(g,x-2.6,.4,z+3.2,.65,.25,.45,'#b5846b');
      return 4.45;
    }
    const floors=level===2?2+v%3:[5,7,9,12,6,10][v],h=floors*2.15;
    const wall=['#dfb6a2','#e6d3b2','#c6d8cc'][v%3];b(g,x,.4,z,4.9,h,4.7,wall);b(g,x,.4,z,5.3,.35,5.1,'#c3bfb4');
    for(let f=0;f<floors;f++){
      const yy=.9+f*2.15;
      for(const dx of [-1.5,0,1.5]){window(x+dx,yy,z+2.39,.8,1.2);window(x+dx,yy,z-2.45,.8,1.2);}
      for(const side of [-1,1])for(const dz of [-1.45,0,1.45])window(x+side*2.5,yy,z+dz,.8,1.2,true);
      b(g,x,.5+(f+1)*2.15,z,5.02,.075,4.82,trim);
      if(f>0){for(const side of level===3?[-1,1]:[1]){b(g,x-1.25,yy-.15,z+side*2.85,2.05,.16,.9,trim);b(g,x-1.25,yy,z+side*3.25,2.05,.63,.07,'#86b4b9');for(const dx of [-2.25,-.25])b(g,x+dx,yy,z+side*2.85,.07,.7,.8,dark);if(f%3===0)b(g,x-1.9,yy+.1,z+side*2.85,.45,.35,.4,'#638854');}}
    }
    entry(x+1,z+2.43);b(g,x,h+.5,z,5.25,.25,5.1,trim);b(g,x,h+.76,z,4.7,.08,4.5,'#7c9b86');
    b(g,x+.8,h+.85,z-.7,2.1,1.65,2,'#d7e1da');b(g,x+.8,h+2.5,z-.7,2.35,.15,2.2,trim);tank(x-1.2,h+.8,z-.9,.55,.8);
    if(level===3){b(g,x-1.25,h+.85,z+1.1,1.3,.2,1.2,'#477e99');b(g,x+1.6,h+2.6,z-.9,.08,2.2,.08,dark);}
    tree(g,x-2.9,z-2.9,.8);return h+5;
  }
  if(c.kind==='commercial'){
    const floors=level===1?1:2+v%2,h=floors*2.6,wall=['#f0dcb7','#d9e2dc','#c6d9dd'][v%3],accent=['#bb6958','#4c9b9c','#7b9270'][v%3];
    b(g,x,.29,z,7.5,.1,7.5,'#d9d6c7');b(g,x,.4,z-.3,5.8,h,4.7,wall);
    for(let f=0;f<floors;f++){for(const dx of [-1.85,0,1.85])window(x+dx,.8+f*2.6,z+2.1,1.4,1.65);for(const dz of [-1.6,.3])window(x+2.96,.8+f*2.6,z+dz,1.3,1.65,true);b(g,x,2.75+f*2.6,z-.3,6,.15,4.9,trim);}
    for(let i=0;i<8;i++)b(g,x-2.6+i*.74,2.55,z+2.65,.74,.2,1.2,i%2?trim:accent);
    b(g,x,2.95,z+2.16,4,.55,.13,accent);for(let i=0;i<5;i++)b(g,x-1.25+i*.6,3.08,z+2.24,.35,.22,.05,trim);
    b(g,x,h+.45,z-.3,6.15,.3,5.1,trim);b(g,x,h+.76,z-.3,5.6,.12,4.55,'#7a8584');b(g,x+1,h+.88,z-.8,1.7,.55,1.4,'#b6c5c5');
    // Pavement displays, cafe tables and freestanding shop sign read differently from gardens.
    b(g,x-2.4,.45,z+3.1,.9,.8,.8,'#b7a389');b(g,x+2.35,.4,z+3.15,.14,1.2,.14,dark);b(g,x+2.35,1.6,z+3.15,1,.7,.15,accent);
    for(const dx of [-.7,.8]){b(g,x+dx,.45,z+3.25,.09,.43,.09,dark);b(g,x+dx,.88,z+3.25,.65,.06,.55,trim);}
    tree(g,x+3.1,z-2.8,.85);return h+1.5;
  }
  // Warehouses have loading doors, segmented roofs, silos and an industrial yard.
  const tier=c.factoryTier||1,h=3.4+(tier-1)*1.15;
  b(g,x,.28,z,7.5,.08,7.5,'#a4aaa5');b(g,x,.4,z-.4,5.8,h,4.6,v%2?'#b78770':'#d6ba80');
  for(const dx of [-1.9,0,1.9]){b(g,x+dx,.5,z+1.95,1.5,2.2,.12,'#607b83');for(let j=0;j<5;j++)b(g,x+dx,.7+j*.36,z+2.04,1.4,.035,.03,'#b5c5c4');b(g,x+dx,.4,z+2.65,1.6,.12,1.2,'#dbcc99');}
  b(g,x,h+.42,z-.4,6.1,.3,4.9,'#425563');for(let i=0;i<9;i++)b(g,x-2.7+i*.68,h+.73,z-.4,.06,.07,4.9,'#b9c5ba');
  for(const dx of [-2.8,2.8]){b(g,x+dx,.5,z+2.15,.2,2.6,.2,'#e5bf72');for(let j=0;j<4;j++)b(g,x+dx,.7+j*.65,z+2.27,.22,.28,.04,dark);}
  for(const dx of [-1.4,1.4]){b(g,x+dx,h+.75,z-.2,1.2,.12,1.8,'#699cab');tank(x+dx,h+.85,z-1.4,.4,.6);}
  tank(x-2.65,.4,z-2.6,.65,3.7);
  if(tier>1){b(g,x,h+.8,z-.7,2.6,1.35,1.7,'#e0d9c5');b(g,x,h+2.15,z-.7,2.8,.15,1.9,tier===3?'#4e839c':'#759b80');}
  b(g,x-2.2,.4,z+3,1.2,.85,.75,'#ba956c');b(g,x-2.2,1.25,z+3,1.3,.1,.8,'#e2c996');return h+5.6;
}

/** Collapse static scenery into material/geometry batches, retaining per-lot picking. */
export function batchScenery(parent:THREE.Group,exclude:Set<THREE.Object3D>=new Set(),growing:Set<string>=new Set()){
  parent.updateMatrixWorld(true);const groups=new Map<string,{mesh:THREE.Mesh;matrix:THREE.Matrix4;lot:string}[]>();const keep:THREE.Object3D[]=[];
  parent.traverse(obj=>{if(!(obj instanceof THREE.Mesh)||obj instanceof THREE.InstancedMesh)return;if(exclude.has(obj)){keep.push(obj);return;}let owner:THREE.Object3D|null=obj;while(owner&&!owner.userData.cell)owner=owner.parent;const id=obj.geometry.uuid+':'+(obj.material as THREE.Material).uuid+':'+obj.castShadow;const list=groups.get(id)||[];list.push({mesh:obj,matrix:obj.matrixWorld.clone(),lot:owner?.userData.cell||''});groups.set(id,list);});
  parent.clear();for(const obj of keep)parent.add(obj);
  for(const entries of groups.values()){const first=entries[0].mesh,inst=new THREE.InstancedMesh(first.geometry,first.material,entries.length);inst.castShadow=first.castShadow;inst.receiveShadow=true;inst.userData.lots=entries.map(e=>e.lot);inst.userData.growth=[];entries.forEach((e,i)=>{inst.setMatrixAt(i,e.matrix);if(growing.has(e.lot))inst.userData.growth.push({index:i,matrix:e.matrix});});inst.computeBoundingSphere();parent.add(inst);}
}
export function animateGrowth(parent:THREE.Group,progress:number){const t=1-Math.pow(1-Math.min(1,progress),3),scale=new THREE.Matrix4().makeScale(1,.12+.88*t,1),m=new THREE.Matrix4();for(const obj of parent.children){if(!(obj instanceof THREE.InstancedMesh)||!obj.userData.growth?.length)continue;for(const entry of obj.userData.growth)obj.setMatrixAt(entry.index,m.multiplyMatrices(scale,entry.matrix));obj.instanceMatrix.needsUpdate=true;if(progress>=1)obj.userData.growth=[];}}
export function disposeBatches(parent:THREE.Group){parent.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});parent.clear();}

/** One reusable instance per vehicle part; only transforms change between frames. */
export class VehicleBatches{
  private batches:{mesh:THREE.InstancedMesh;sources:THREE.Mesh[]}[]=[];
  constructor(private target:THREE.Group){}
  rebuild(sources:THREE.Group){this.dispose();const groups=new Map<string,THREE.Mesh[]>();sources.traverse(o=>{if(o instanceof THREE.Mesh){const k=o.geometry.uuid+':'+(o.material as THREE.Material).uuid,list=groups.get(k)||[];list.push(o);groups.set(k,list);}});for(const list of groups.values()){const mesh=new THREE.InstancedMesh(list[0].geometry,list[0].material,list.length);prepareHumanLimb(mesh);mesh.castShadow=list[0].castShadow;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.target.add(mesh);this.batches.push({mesh,sources:list});}}
  update(sources:THREE.Group){sources.updateMatrixWorld(true);const hidden=new THREE.Matrix4().makeScale(0,0,0);for(const b of this.batches){b.sources.forEach((s,i)=>{b.mesh.setMatrixAt(i,s.visible?s.matrixWorld:hidden);writeHumanLimb(b.mesh,i,s);});b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;uploadHumanLimb(b.mesh);}}
  dispose(){for(const b of this.batches){this.target.remove(b.mesh);disposeHumanLimb(b.mesh);b.mesh.dispose();}this.batches=[];}
}
