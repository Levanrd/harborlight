import {waterEdge} from './grid';

export const regionalCycleSeconds={airport:300,seaport:360,railway:28} as const;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const cycle=(time:number,length:number)=>((time%length)+length)%length;
export type RegionalPose={x:number;y:number;z:number;yaw:number;pitch:number;roll:number;visible:boolean;gear:boolean;phase:string};

/** Local airport coordinates: runway z=9, taxiway z=2. Angles face the +X nose. */
export function airportPose(time:number):RegionalPose{
  const t=cycle(time,regionalCycleSeconds.airport);
  const pose:RegionalPose={x:-16,y:.58,z:9,yaw:0,pitch:0,roll:0,visible:true,gear:true,phase:'Holding for departure'};
  if(t<30)return pose;
  if(t<60){
    const q=(t-30)/30,lift=clamp((q-.24)/.76);
    return {...pose,x:-16+330*q*q,y:.58+120*Math.pow(lift,1.5),pitch:.13*clamp(lift*5),gear:lift<.12,phase:lift>0?'Climbing out':'Takeoff roll'};
  }
  if(t<180)return {...pose,x:314,y:120.58,visible:false,gear:false,phase:'Away on regional flight'};
  if(t<230){
    const q=(t-180)/50,e=q+(1-160/304)*q*(1-q),height=100*(1-q)*(1-q);
    return {...pose,x:-320+304*e,y:.58+height,pitch:-.1*(1-q),gear:height<18,phase:height>.1?'Final approach':'Touchdown'};
  }
  if(t<250){const q=(t-230)/20;return {...pose,x:-16+32*(2*q-q*q),phase:'Landing rollout'};}
  if(t<260){
    const a=(t-250)/10*Math.PI;
    return {...pose,x:16+3.5*Math.sin(a),z:5.5+3.5*Math.cos(a),yaw:a,phase:'Leaving runway'};
  }
  if(t<282)return {...pose,x:16-32*(t-260)/22,z:2,yaw:Math.PI,phase:'Taxiing back'};
  if(t<292){
    const a=(t-282)/10*Math.PI;
    return {...pose,x:-16-3.5*Math.sin(a),z:5.5-3.5*Math.cos(a),yaw:Math.PI+a,phase:'Lining up'};
  }
  return pose;
}

/** Ships follow the coastline out to open water before the hidden regional leg. */
export function seaportPose(time:number,berthZ:number):RegionalPose{
  const t=cycle(time,regionalCycleSeconds.seaport);
  const travel=t<80?-180*Math.pow(1-t/80,2):t<180?0:t<260?180*Math.pow((t-180)/80,2):180;
  const z=berthZ+travel;
  const coast=(zz:number)=>{const base=waterEdge(berthZ),delta=waterEdge(zz)-base,q=clamp((Math.abs(zz-berthZ)-16)/24),blend=q*q*(3-2*q);return base+13.5+blend*(delta+Math.sqrt(delta*delta+.04))/2;};
  const yaw=Math.atan2(coast(z+.1)-coast(z-.1),.2);
  return {x:coast(z),y:.12+Math.sin(time*.6)*.025,z,yaw,pitch:0,roll:Math.sin(time*.45)*.006,visible:t<260,gear:false,phase:t<80?'Approaching berth':t<180?'Loading cargo':t<260?'Departing harbor':'Away on regional voyage'};
}
