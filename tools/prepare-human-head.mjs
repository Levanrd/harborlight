// Build-time only. Source: Lee Perry-Smith / Infinite-Realities, CC BY 3.0.
// See src/assets/human-head-license.txt and public/asset-credits.html.
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SimplifyModifier} from 'three/addons/modifiers/SimplifyModifier.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
const sourcePath='.npm-cache/human-source/head.glb';
if(!fs.existsSync(sourcePath)){fs.mkdirSync('.npm-cache/human-source',{recursive:true});const response=await fetch('https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb');if(!response.ok)throw Error('Could not fetch the attributed source head');fs.writeFileSync(sourcePath,new Uint8Array(await response.arrayBuffer()));}
const bytes=fs.readFileSync(sourcePath);
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const source=gltf.scene.getObjectByName('LeePerrySmith').geometry;
const p=source.getAttribute('position'),index=source.getIndex(),positions=[];
for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(ids.some(id=>p.getY(id)<-1.15))continue;for(const id of ids)positions.push(p.getX(id)*.05,p.getY(id)*.05-.08362734,p.getZ(id)*.04);}
const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
const merged=mergeVertices(raw);merged.computeVertexNormals();
const pack=count=>{const reduced=new SimplifyModifier().modify(merged,Math.max(0,merged.getAttribute('position').count-count));reduced.computeVertexNormals();return {position:Array.from(reduced.getAttribute('position').array,n=>Math.round(n*1e6)/1e6),index:Array.from(reduced.getIndex().array)};};
const data={...pack(3500),far:pack(950)};
fs.writeFileSync('src/assets/humanHeadData.ts','// Adapted and decimated Lee Perry-Smith / Infinite-Realities head scan. CC BY 3.0.\n// Source and changes: public/asset-credits.html\nexport const humanHeadData='+JSON.stringify(data)+';\n');
console.log(JSON.stringify({vertices:data.position.length/3,triangles:data.index.length/3,bytes:fs.statSync('src/assets/humanHeadData.ts').size}));
