import * as THREE from 'three';
import {landNoise} from './environment';

/** Smooth, lobed crowns: shared geometry, never one mesh allocation per leaf. */
export function createCanopy(pine=false,segments=16){
  const geometry=pine
    ?new THREE.LatheGeometry([new THREE.Vector2(0,-1),new THREE.Vector2(.5,-.92),new THREE.Vector2(.86,-.7),new THREE.Vector2(.56,-.46),new THREE.Vector2(.75,-.36),new THREE.Vector2(.4,-.08),new THREE.Vector2(.6,.02),new THREE.Vector2(.3,.3),new THREE.Vector2(.43,.4),new THREE.Vector2(.12,.74),new THREE.Vector2(0,1)],16)
    :new THREE.SphereGeometry(1,segments,Math.max(5,Math.round(segments*.75)));
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const angle=Math.atan2(z,x),lobes=1+.13*Math.sin(angle*5+y*4)+.07*Math.cos(angle*9-y*5);
    const taper=1-.08*y;
    positions.setXYZ(i,x*lobes*taper,y+(pine?0:.065*Math.sin(x*4+z*3)),z*lobes*taper);
  }
  // Normalize the envelope so existing roadside clearance remains conservative.
  geometry.center();geometry.computeBoundingBox();const size=geometry.boundingBox!.getSize(new THREE.Vector3());
  geometry.scale(2/size.x,2/size.y,2/size.z);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

export function woodlandDensity(x:number,z:number){
  const wave=landNoise(x*.022,z*.022);
  return .04+.85*Math.pow(Math.max(0,Math.min(1,(wave-.16)/.7)),2);
}

/** Leaf sprays break the smooth crown silhouette without thousands of leaf meshes. */
export function createLeafSpray(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;
  let seed=913;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<850;i++){
    const angle=random()*Math.PI*2,r=Math.sqrt(random())*108,x=128+Math.cos(angle)*r,y=128+Math.sin(angle)*r*.95;
    // An irregular outer edge, leaf veins, and spaces between small leaf clusters.
    if(r>82+17*Math.sin(angle*5)+9*Math.cos(angle*9))continue;
    const shade=100+Math.floor(random()*120);ctx.fillStyle=`rgb(${shade},${shade},${Math.round(shade*.88)})`;
    ctx.beginPath();ctx.ellipse(x,y,3+random()*5,1.5+random()*2,angle,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(55,64,36,.28)';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x-2*Math.cos(angle),y-2*Math.sin(angle));ctx.lineTo(x+3*Math.cos(angle),y+3*Math.sin(angle));ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

/** Keep masonry joints and paving grain at a physical scale after instancing. */
export function physicalSurface(material:THREE.MeshStandardMaterial,tileWidth:number,tileHeight:number){
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      mat4 surfaceMatrix = modelMatrix;
      #ifdef USE_INSTANCING
        surfaceMatrix = modelMatrix * instanceMatrix;
      #endif
      vec3 sizeMeters = vec3(length(surfaceMatrix[0].xyz), length(surfaceMatrix[1].xyz), length(surfaceMatrix[2].xyz));
      vec3 face = abs(normal);
      vec2 physicalUv = face.y > .7 ? vec2(sizeMeters.x, sizeMeters.z) : face.x > .7 ? vec2(sizeMeters.z, sizeMeters.y) : vec2(sizeMeters.x, sizeMeters.y);
      physicalUv /= vec2(${tileWidth.toFixed(3)}, ${tileHeight.toFixed(3)});
      #ifdef USE_MAP
        vMapUv *= physicalUv;
      #endif
      #ifdef USE_BUMPMAP
        vBumpMapUv *= physicalUv;
      #endif
      #ifdef USE_ROUGHNESSMAP
        vRoughnessMapUv *= physicalUv;
      #endif
    `);
  };
  material.customProgramCacheKey=()=>`physical-surface-${tileWidth}-${tileHeight}`;
}
