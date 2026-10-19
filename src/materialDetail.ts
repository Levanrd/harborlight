import * as THREE from 'three';
import {seededRandom,type TextureStyle} from './cityVisuals';

/** Original, tiled material maps: mortar, stone joints, aggregate and grain. */
export function materialDetail(style:TextureStyle){
  const size=512,c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d')!,r=seededRandom(105+style.length);
  x.fillStyle='#bcbcb8';x.fillRect(0,0,size,size);
  if(style==='brick'){
    x.fillStyle='#797b75';x.fillRect(0,0,size,size);
    for(let row=0;row<16;row++)for(let col=-1;col<9;col++){
      const xx=col*64+(row%2?32:0),yy=row*32,v=153+r()*52;x.fillStyle=`rgb(${v},${v-8},${v-12})`;x.fillRect(xx+2,yy+2,60,28);
      x.fillStyle='#d3d0c5';x.fillRect(xx+2,yy+2,60,1);x.fillStyle='#8a8880';x.fillRect(xx+3,yy+28,59,2);
    }
  }else if(style==='paving'){
    x.fillStyle='#7d817b';x.fillRect(0,0,size,size);
    for(let row=0;row<8;row++)for(let col=-1;col<5;col++){const v=166+r()*30;x.fillStyle=`rgb(${v},${v+2},${v-3})`;x.fillRect(col*128+(row%2?64:0)+2,row*64+2,124,60);}
  }else if(style==='roof'){
    for(let row=0;row<16;row++)for(let col=-1;col<9;col++){const xx=col*64+(row%2?32:0),yy=row*32;const g=x.createLinearGradient(0,yy,0,yy+32);g.addColorStop(0,'#d2d2c9');g.addColorStop(.7,'#a1a39f');g.addColorStop(1,'#727774');x.fillStyle=g;x.fillRect(xx,yy,63,31);}
  }else if(style==='asphalt'){
    x.fillStyle='#939798';x.fillRect(0,0,size,size);
    // Broad, low-contrast weathering underneath fine stone aggregate.
    for(let i=0;i<32;i++){const xx=r()*size,yy=r()*size,radius=20+r()*85,shade=x.createRadialGradient(xx,yy,0,xx,yy,radius);shade.addColorStop(0,i%2?'rgba(55,59,60,.1)':'rgba(182,178,165,.12)');shade.addColorStop(1,'rgba(100,100,100,0)');x.fillStyle=shade;x.fillRect(0,0,size,size);}
    for(let i=0;i<6;i++){x.strokeStyle='rgba(48,52,52,.3)';x.lineWidth=.45+r()*.6;let xx=r()*size,yy=r()*size;x.beginPath();x.moveTo(xx,yy);for(let j=0;j<7;j++){xx+=r()*19-9;yy+=r()*18;x.lineTo(xx,yy);}x.stroke();}
    for(let i=0;i<800;i++){const v=120+r()*70;x.fillStyle=`rgba(${v},${v},${v-5},.25)`;x.beginPath();x.ellipse(r()*size,r()*size,.6+r()*.8,.4+r()*.7,r()*3,0,Math.PI*2);x.fill();}
  }
  for(let i=0;i<33000;i++){const v=Math.floor(75+r()*145);x.fillStyle=`rgba(${v},${v},${v},${style==='asphalt'?.28:.12})`;x.fillRect(r()*size,r()*size,.4+r()*1.5,.4+r()*1.5);}
  const color=new THREE.CanvasTexture(c);color.colorSpace=THREE.SRGBColorSpace;color.wrapS=color.wrapT=THREE.RepeatWrapping;color.anisotropy=8;
  const data=x.getImageData(0,0,size,size).data,rough=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4);
  for(let i=0;i<size*size;i++){const v=data[i*4],q=style==='asphalt'?220:style==='roof'?185:205;rough.set([q+Math.round((v-160)*.2),q,q,255],i*4);height.set([v,v,v,255],i*4);}
  const roughness=new THREE.DataTexture(rough,size,size),bump=new THREE.DataTexture(height,size,size);
  for(const t of [roughness,bump]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;}
  return {color,roughness,bump};
}
