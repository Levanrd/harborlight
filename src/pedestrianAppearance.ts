/** Stable appearance and distance-driven gait; never changes population/save data. */
export const PEDESTRIAN_SPACING=.72;
const skins=['#d5a17e','#b7805d','#805239','#e5ba96','#a46e50','#604333'];
const fabrics=['#346b84','#a85e4c','#d1bb93','#557661','#717d98','#8b647b','#bbb7ad','#3f5365'];
const trousers=['#344553','#515957','#6c6254','#364b66','#79756b'];
const hairs=['#302923','#4d3528','#785339','#aa885b','#b3aea4','#211f21'];
function sample(id:number,salt:number){let n=Math.imul(id+salt,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;}
export function pedestrianAppearance(id:number){
  const n=(salt:number)=>sample(id,salt);
  return {skin:skins[n(1)%skins.length],top:fabrics[n(2)%fabrics.length],pants:trousers[n(3)%trousers.length],hair:hairs[n(4)%hairs.length],
    height:.91+(n(5)%16)/100,build:.88+(n(6)%25)/100,outfit:n(7)%5,hairStyle:n(8)%4,bag:n(9)%6===0,glasses:n(10)%7===0,
    shoes:n(11)%3===0?'#cecac0':'#383333',phase:(n(12)%100)/100};
}
export type LegPose={hip:{y:number;z:number};knee:{y:number;z:number};ankle:{y:number;z:number};lift:number;stride:number};
export const LEG_LENGTH=.425;
/** Stance moves backwards at walking speed; the other foot lifts and swings forward. */
export function pedestrianLeg(walked:number,side:number,motion=1,offset=0):LegPose{
  const phase=((walked/1.1+offset+(side<0?.5:0))%1+1)%1,stance=.58,reach=1.1*stance/2;
  const swing=Math.max(0,(phase-stance)/(1-stance));
  const stride=motion?(phase<stance?reach-1.1*phase:-reach+2*reach*(.5-.5*Math.cos(swing*Math.PI)))*motion:0;
  const lift=Math.sin(swing*Math.PI)*.13*motion;
  const hip={y:.99-.072*motion+Math.cos(phase*Math.PI*4)*.008*motion,z:0},ankle={y:.14+lift,z:stride};
  const dy=ankle.y-hip.y,dz=ankle.z-hip.z,d=Math.hypot(dy,dz),bend=Math.sqrt(Math.max(0,LEG_LENGTH**2-(d/2)**2));
  const knee={y:(hip.y+ankle.y)/2+dz/d*bend,z:(hip.z+ankle.z)/2-dy/d*bend};
  return {hip,knee,ankle,lift,stride};
}
