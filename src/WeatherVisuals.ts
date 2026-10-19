import * as THREE from 'three';
import type {ClimateState} from './climate';
import type {Quality} from './environment';

/** Shared uniforms let batched buildings and terrain respond without rebuilding meshes. */
export class WeatherVisuals {
  readonly snowCover={value:0};readonly wetness={value:0};
  private time={value:0};private wind={value:0};private center={value:new THREE.Vector3()};
  private rainAlpha={value:0};private snowAlpha={value:0};
  private rain:THREE.LineSegments;private flakes:THREE.Points;
  private settingsKey='';
  private colors=new Map<THREE.MeshStandardMaterial,THREE.Color>();
  constructor(private scene:THREE.Scene){
    const rainPos:number[]=[],tips:number[]=[],snowPos:number[]=[];let seed=761;
    const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<2000;i++){const x=rand(),y=rand(),z=rand();rainPos.push(x,y,z,x,y,z);tips.push(0,1);snowPos.push(rand(),rand(),rand());}
    const uniforms={clock:this.time,wind:this.wind,center:this.center};
    const vertex=`uniform float clock; uniform float wind; uniform vec3 center;
      varying float depthFade;
      vec3 precipitation(float fall){vec3 p=position; p.y=mod(p.y*155.-clock*fall,155.)+2.; p.x=mod(p.x*360.+clock*wind*5.,360.)-180.;p.z=p.z*360.-180.;return p+vec3(center.x,0.,center.z);}`;
    const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.Float32BufferAttribute(rainPos,3));rainGeo.setAttribute('tip',new THREE.Float32BufferAttribute(tips,1));
    const rainMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{...uniforms,opacity:this.rainAlpha},vertexShader:vertex+`attribute float tip;void main(){vec3 p=precipitation(42.);p+=vec3(-wind*.8,-2.2,0.)*tip;vec4 view=modelViewMatrix*vec4(p,1.);depthFade=1.-smoothstep(120.,500.,-view.z);gl_Position=projectionMatrix*view;}`,fragmentShader:`uniform float opacity;varying float depthFade;void main(){gl_FragColor=vec4(.67,.79,.88,opacity*depthFade);}`});
    this.rain=new THREE.LineSegments(rainGeo,rainMat);this.rain.frustumCulled=false;this.scene.add(this.rain);
    const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.Float32BufferAttribute(snowPos,3));
    const snowMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{...uniforms,opacity:this.snowAlpha},vertexShader:vertex+`void main(){vec3 p=precipitation(6.);p.x+=sin(clock*.6+position.y*50.)*2.;p.z+=cos(clock*.4+position.x*50.)*1.5;vec4 view=modelViewMatrix*vec4(p,1.);depthFade=1.-smoothstep(100.,500.,-view.z);gl_PointSize=clamp(650./max(20.,-view.z),1.5,7.);gl_Position=projectionMatrix*view;}`,fragmentShader:`uniform float opacity;varying float depthFade;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.92,.96,1.,opacity*depthFade*(1.-smoothstep(.22,.5,d)));}`});
    this.flakes=new THREE.Points(snowGeo,snowMat);this.flakes.frustumCulled=false;this.scene.add(this.flakes);
  }
  surface(material:THREE.MeshStandardMaterial,snowStrength=1){
    const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
    material.onBeforeCompile=(shader,renderer)=>{
      previous.call(material,shader,renderer);shader.uniforms.seasonSnow=this.snowCover;shader.uniforms.rainWetness=this.wetness;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float climateUp;').replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nclimateUp = inverseTransformDirection(normalize(transformedNormal), viewMatrix).y;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying float climateUp;uniform float seasonSnow;uniform float rainWetness;`).replace('#include <color_fragment>',`#include <color_fragment>\nfloat cover=smoothstep(.45,.9,climateUp)*seasonSnow*${snowStrength.toFixed(2)};diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.83,.89,.94),cover);diffuseColor.rgb*=1.-rainWetness*.13;`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,max(.25,roughnessFactor*.55),rainWetness);');
    };
    material.customProgramCacheKey=()=>key+'-climate-'+snowStrength;
  }
  quality(q:Quality){const count={low:350,medium:800,high:1500,ultra:2000}[q];this.rain.geometry.setDrawRange(0,count*2);this.flakes.geometry.setDrawRange(0,count);}
  update(state:ClimateState,seconds:number,target:THREE.Vector3,reducedMotion:boolean){
    // Time is persisted simulation time. Pausing freezes every particle in place.
    this.time.value=reducedMotion?0:seconds;this.center.value.copy(target);this.wind.value=state.wind;
    this.rainAlpha.value=state.rain*(reducedMotion?.16:.42);this.snowAlpha.value=state.snow*(reducedMotion?.35:.85);
    this.rain.visible=state.rain>0;this.flakes.visible=state.snow>0;
    this.snowCover.value=state.snowCover;this.wetness.value=state.wetness;
  }
  tint(materials:Iterable<THREE.MeshStandardMaterial>,terrain:THREE.MeshStandardMaterial,leaves:THREE.MeshStandardMaterial,state:ClimateState){
    const key=state.season+state.weather; // New materials can appear after construction.
    const foliage=new Set(['#43825d','#6a9b62','#517d48','#32694d','#51835a','#4e8859','#85ad64','#ce81a1','#efb5c4']);
    for(const m of materials){const color=m.userData.foliageColor as string|undefined;if(!color||!foliage.has(color)||m.userData.climateSeason===state.season)continue;m.userData.climateSeason=state.season;if(!this.colors.has(m))this.colors.set(m,m.color.clone());
      m.color.copy(this.colors.get(m)!);if(state.season==='autumn')m.color.lerp(new THREE.Color(color==='#6a9b62'||color==='#85ad64'?'#b5a24f':'#aa693d'),.88);else if(state.season==='winter')m.color.lerp(new THREE.Color('#889689'),.72);else if(state.season==='spring')m.color.lerp(new THREE.Color('#8eab67'),.24);
    }
    if(this.settingsKey===key)return;this.settingsKey=key;
    terrain.color.set(state.season==='autumn'?'#c2b18d':state.season==='winter'?'#ced5cf':state.season==='spring'?'#e0efd5':'#ffffff');
    leaves.color.set(state.season==='autumn'?'#bd884e':state.season==='winter'?'#aab9b0':state.season==='spring'?'#91b574':'#72935a');
  }
  dispose(){for(const o of [this.rain,this.flakes]){o.geometry.dispose();(o.material as THREE.Material).dispose();this.scene.remove(o);}this.colors.clear();}
}
