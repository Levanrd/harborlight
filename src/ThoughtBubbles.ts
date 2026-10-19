import {Vector3,type Camera} from 'three';
import {metrics,type City} from './simulation';
import type {FootTraffic} from './pedestrians';

/** Screen-space thoughts track real residents; the underlying issue list is never persisted. */
export class ThoughtBubbles {
  private layer=document.createElement('div');
  private buttons:HTMLButtonElement[]=[];
  private point=new Vector3();
  constructor(host:HTMLElement,focus:(key:string,text:string)=>void){
    this.layer.className='resident-thoughts';this.layer.setAttribute('aria-label','Resident concerns');host.append(this.layer);
    for(let i=0;i<6;i++){const b=document.createElement('button');b.className='resident-thought';b.hidden=true;b.addEventListener('pointerdown',e=>e.stopPropagation());b.addEventListener('click',e=>{e.stopPropagation();focus(b.dataset.lot!,b.title);});this.layer.append(b);this.buttons.push(b);}
  }
  update(city:City,people:FootTraffic,camera:Camera,width:number,height:number,enabled:boolean){
    for(const b of this.buttons)b.hidden=true;if(!enabled)return;
    const wellbeing=metrics(city).wellbeing,walkers=new Map(people.agents.filter(p=>p.stage==='walking').map(p=>[p.home,p]));
    const candidates=Object.entries(wellbeing.lots).filter(([,l])=>l.issues.length).sort((a,b)=>b[1].issues[0].severity-a[1].issues[0].severity);
    const occupied:{x:number;y:number}[]=[];
    for(const [key,lot]of candidates){
      const c=city.cells[key],p=walkers.get(key);this.point.set(p?p.x:c.x*8,p?3.1:c.coastal?8:5+c.level*3,p?p.z:c.z*8).project(camera);
      if(this.point.z<0||this.point.z>1)continue;
      const x=(this.point.x*.5+.5)*width,y=(-this.point.y*.5+.5)*height;
      if(x<180||x>width-180||y<150||y>height-175||occupied.some(o=>Math.abs(o.x-x)<155&&Math.abs(o.y-y)<64))continue;
      const b=this.buttons[occupied.length],issue=lot.issues[0];b.hidden=false;b.textContent=issue.title;b.title=`${issue.text} ${issue.fix}`;b.dataset.lot=key;b.setAttribute('aria-label',`${issue.title} at home ${key}. ${issue.fix}`);b.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-100%)`;occupied.push({x,y});if(occupied.length===this.buttons.length)break;
    }
  }
  dispose(){this.layer.remove();}
}
