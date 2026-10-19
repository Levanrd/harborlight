import {useLayoutEffect} from 'react';
/** Measure HUD edges so zoom, wrapped text and new inspector content cannot overlap controls. */
export function useHudLayout(ready:boolean,layoutKey:string){
  useLayoutEffect(()=>{
    if(!ready)return;const root=document.querySelector<HTMLElement>('.city-app');if(!root)return;
    let frame=0;
    const rect=(selector:string)=>{const e=root.querySelector<HTMLElement>(selector);return e&&e.getClientRects().length?e.getBoundingClientRect():null;};
    const measure=()=>{
      frame=0;const h=window.innerHeight,top=(rect('.topbar')?.bottom||100)+16,toolbar=rect('.toolbar-area'),left=rect('.bottom-left'),right=rect('.bottom-right');
      const put=(name:string,value:number)=>root.style.setProperty(name,Math.round(value)+'px');
      put('--hud-top',top);put('--inspector-bottom',h-(toolbar?.top||h-100)+12);
      put('--overview-bottom',h-Math.min(left?.top||h-110,toolbar?.top||h-110)+12);
      const rightTop=window.innerWidth<1100?h-(h-(toolbar?.top||h-100)+12)-(right?.height||120):right?.top||h-120;
      const graphicsBottom=h-rightTop+10;put('--graphics-bottom',graphicsBottom);
      const lightingBottom=graphicsBottom+(rect('.graphics-control')?.height||32)+8;put('--lighting-bottom',lightingBottom);
      const climateBottom=lightingBottom+(rect('.lighting-control')?.height||36)+8;put('--climate-bottom',climateBottom);
      put('--advisor-bottom',climateBottom+(rect('.climate-control')?.height||38)+12);
      put('--inspector-left',(rect('.left-panel')?.right||12)+12);
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
    const observer=new ResizeObserver(schedule);
    for(const selector of ['.topbar','.toolbar-area','.bottom-left','.bottom-right','.graphics-control','.lighting-control','.climate-control','.left-panel']){const el=root.querySelector(selector);if(el)observer.observe(el);}
    window.addEventListener('resize',schedule);measure();
    return()=>{observer.disconnect();window.removeEventListener('resize',schedule);cancelAnimationFrame(frame);};
  },[ready,layoutKey]);
}
