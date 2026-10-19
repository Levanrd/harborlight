import {waterEdge} from './grid';
export type LightingMode='auto'|'day'|'dusk'|'night';
export type Quality='low'|'medium'|'high'|'ultra';
export const graphicsPresets={low:{pixelRatio:1,shadow:0},medium:{pixelRatio:1.25,shadow:1024},high:{pixelRatio:1.75,shadow:3072},ultra:{pixelRatio:2,shadow:4096}} as const;
export const cameraLimits={minDistance:2,maxDistance:490,groundClearance:1.5} as const;
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
/** Continuous value noise avoids visible repeated stripes across the landscape. */
export function landNoise(x:number,z:number){
  const ix=Math.floor(x),iz=Math.floor(z),tx=smooth(0,1,x-ix),tz=smooth(0,1,z-iz);
  const value=(a:number,b:number)=>{let h=Math.imul(a+113,374761393)^Math.imul(b+197,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
  const a=value(ix,iz)*(1-tx)+value(ix+1,iz)*tx,b=value(ix,iz+1)*(1-tx)+value(ix+1,iz+1)*tx;
  return a*(1-tz)+b*tz;
}
/** Keep every buildable parcel level; shape the surrounding landscape only. */
export function terrainHeight(x:number,z:number){
  if(x>waterEdge(z))return -2;
  const rim=Math.max(0,Math.abs(z)-158,-x-158),rise=smooth(0,140,rim);
  return rise*(26+38*(.5+.5*Math.sin(x*.024+z*.009))+25*(.5+.5*Math.cos(z*.031-x*.012)))+Math.max(0,rim-90)*.12;
}
export function terrainTint(x:number,z:number,height:number){
  const patch=(landNoise(x*.035,z*.035)*.7+landNoise(x*.09,z*.09)*.3-.5)*2;
  const rock=smooth(38,82,height),beach=1-smooth(2,14,waterEdge(z)-x);
  const grass=[.29+patch*.065,.385+patch*.07,.225+patch*.045];
  return grass.map((v,i)=>v*(1-rock)+[.46,.45,.40][i]*rock).map((v,i)=>v*(1-beach)+[.66,.62,.46][i]*beach);
}
/** One visual day is four minutes of the persisted traffic clock. Pausing freezes it. */
export function atmosphereAt(seconds:number,mode:LightingMode='auto'){
  const hour=mode==='day'?12:mode==='dusk'?17.4:mode==='night'?0:((seconds/10+10)%24+24)%24;
  const elevation=Math.sin((hour-6)/24*Math.PI*2),day=smooth(-.16,.32,elevation),night=1-day;
  const dusk=(1-Math.abs(elevation)/.4);return {hour,night,twilight:Math.max(0,dusk)*(hour>12?1:.55),sunX:Math.cos((hour-6)/24*Math.PI*2)*150,sunY:Math.max(18,elevation*180),sunZ:70};
}
export function boundedCamera(position:{x:number;y:number;z:number},target:{x:number;y:number;z:number}){
  const x=Math.max(-156,Math.min(132,target.x)),z=Math.max(-156,Math.min(156,target.z));
  const px=position.x+x-target.x,pz=position.z+z-target.z;
  return {target:{x,y:Math.max(0,target.y),z},position:{x:px,y:Math.max(position.y,terrainHeight(px,pz)+cameraLimits.groundClearance,cameraLimits.groundClearance),z:pz}};
}

type CameraPoint={x:number;y:number;z:number};
/** Recenter on an actual surface so close zoom inspects the clicked part of a
 * large facility instead of continuing toward its distant footprint center. */
export function inspectionCamera(position:CameraPoint,target:CameraPoint,point:CameraPoint){
  let dx=position.x-target.x,dy=position.y-target.y,dz=position.z-target.z;
  let length=Math.hypot(dx,dy,dz);if(length<.001){dx=1;dy=1;dz=1;length=Math.sqrt(3);}
  const distance=Math.max(cameraLimits.minDistance,Math.min(12,length*.45));
  return boundedCamera({x:point.x+dx/length*distance,y:point.y+dy/length*distance,z:point.z+dz/length*distance},point);
}
