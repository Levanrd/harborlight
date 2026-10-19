import type {WebGLRenderer,Scene,PerspectiveCamera} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import type {Quality} from './environment';

class HalfResolutionAO extends SSAOPass {
  setSize(w:number,h:number){super.setSize(Math.max(1,Math.floor(w*.5)),Math.max(1,Math.floor(h*.5)));}
}
/** Contact shading is computed at half resolution, retaining sharp native-resolution color. */
export class RenderPipeline {
  private composer:EffectComposer;
  private ao:HalfResolutionAO;
  private color:RenderPass;
  private output=new OutputPass();
  private enabled=true;
  constructor(private renderer:WebGLRenderer,private scene:Scene,private camera:PerspectiveCamera){
    this.composer=new EffectComposer(renderer);this.color=new RenderPass(scene,camera);
    this.ao=new HalfResolutionAO(scene,camera,1,1,16);this.ao.kernelRadius=2.2;this.ao.minDistance=.0002;this.ao.maxDistance=.018;
    this.composer.addPass(this.color);this.composer.addPass(this.ao);this.composer.addPass(this.output);
  }
  quality(value:Quality){this.enabled=value==='high'||value==='ultra';this.ao.kernelRadius=value==='ultra'?2.8:2.2;}
  resize(w:number,h:number){this.composer.setPixelRatio(this.renderer.getPixelRatio());this.composer.setSize(w,h);}
  render(){if(this.enabled)this.composer.render();else this.renderer.render(this.scene,this.camera);}
  dispose(){this.ao.dispose();this.output.dispose();this.color.dispose();this.composer.dispose();}
}
