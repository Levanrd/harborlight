import * as THREE from 'three';

/** Two-bone limb skinning, shared by instanced street and recreation crowds.
 * The mesh is authored about the elbow/knee with the upper bone along +Y.
 * A narrow blend band keeps a continuous surface across the bending joint. */
export type LimbSkin={bend:THREE.Quaternion;skin:THREE.Color;cloth:THREE.Color;hem:number;sock:number};
export const isHumanLimb=(geometry:THREE.BufferGeometry)=>geometry.userData.humanLimb===true;
const declarations=`
attribute vec4 humanBend;
attribute vec4 humanCloth;
attribute float humanSock;
vec3 humanRotate(vec3 p, vec4 q) { return p + 2.0 * cross(q.xyz, cross(q.xyz,p) + q.w*p); }
vec4 humanRotation(float y) {
  float w=1.0-smoothstep(-0.045,0.045,y);
  vec4 q=humanBend.w<0.0?-humanBend:humanBend;
  return normalize(mix(vec4(0.0,0.0,0.0,1.0),q,w));
}
`;
function configure(material:THREE.Material,color:boolean){
  material.onBeforeCompile=shader=>{
    shader.vertexShader=declarations+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=humanRotate(objectNormal,humanRotation(position.y));');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed=humanRotate(position,humanRotation(position.y));');
    if(color)shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',`#include <color_vertex>
      #if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)
        float cloth=smoothstep(humanCloth.w-0.002,humanCloth.w+0.002,position.y);
        vColor.rgb=mix(vColor.rgb,humanCloth.rgb,cloth);
        vColor.rgb=mix(vColor.rgb,vec3(0.70,0.72,0.67),humanSock*(1.0-smoothstep(-0.13,-0.125,position.y)));
      #endif
    `);
  };
  material.customProgramCacheKey=()=>color?'human-limb-color-v1':'human-limb-shadow-v1';
  return material;
}
export function humanLimbMaterial(source:THREE.Material){const material=source.clone();if(material instanceof THREE.MeshStandardMaterial)material.color.set('#ffffff');return configure(material,true);}
export const humanLimbDepth=()=>configure(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),false);

/** Instance attributes belong to the batch, never to the shared source mesh. */
export function prepareHumanLimb(mesh:THREE.InstancedMesh){
  if(!isHumanLimb(mesh.geometry))return;
  mesh.geometry=mesh.geometry.clone();
  for(const [name,size]of [['humanBend',4],['humanCloth',4],['humanSock',1]] as const){
    const attribute=new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count*size),size);
    attribute.setUsage(THREE.DynamicDrawUsage);mesh.geometry.setAttribute(name,attribute);
  }
  mesh.customDepthMaterial=humanLimbDepth();
  mesh.setColorAt(0,new THREE.Color('#ffffff'));
}
export function writeHumanLimb(mesh:THREE.InstancedMesh,index:number,source:THREE.Mesh){
  const skin=source.userData.limbSkin as LimbSkin|undefined;if(!skin)return;
  mesh.setColorAt(index,skin.skin);
  const bend=mesh.geometry.getAttribute('humanBend') as THREE.InstancedBufferAttribute;
  const cloth=mesh.geometry.getAttribute('humanCloth') as THREE.InstancedBufferAttribute;
  const sock=mesh.geometry.getAttribute('humanSock') as THREE.InstancedBufferAttribute;
  bend.setXYZW(index,skin.bend.x,skin.bend.y,skin.bend.z,skin.bend.w);
  cloth.setXYZW(index,skin.cloth.r,skin.cloth.g,skin.cloth.b,skin.hem);sock.setX(index,skin.sock);
}
export function uploadHumanLimb(mesh:THREE.InstancedMesh){
  if(!isHumanLimb(mesh.geometry))return;
  for(const name of ['humanBend','humanCloth','humanSock'])mesh.geometry.getAttribute(name).needsUpdate=true;
}
export function disposeHumanLimb(mesh:THREE.InstancedMesh){
  if(!isHumanLimb(mesh.geometry))return;
  mesh.geometry.dispose();mesh.customDepthMaterial?.dispose();
}
