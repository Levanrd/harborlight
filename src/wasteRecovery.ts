import {build,metrics,resources,labels,neighbors,key,validLand,type City,type Resource} from './simulation';
import {isWasteFacility} from './waste';

/** Plan on a copy. Never replace buildings, roads or the player's saved city. */
export function planWasteUtilities(city:City){
  const initial=metrics(city),facilities=Object.keys(city.cells).filter(k=>isWasteFacility(city.cells[k].kind));
  const unavailable=facilities.filter(k=>!initial.lots[k]?.supplied);
  const blocked=unavailable.filter(k=>initial.lots[k]?.network===undefined);
  const networks=[...new Set(unavailable.map(k=>initial.lots[k]?.network).filter((id):id is number=>id!==undefined))];
  const additions:{kind:Resource;x:number;z:number}[]=[];
  let planned={...city,money:1e9},cost=0,problem='';
  const homes=Object.values(city.cells).filter(c=>c.kind==='residential');
  for(const id of networks)for(const resource of resources){
    const original=initial.networks[id];
    if(original.capacity[resource]>0&&original.capacity[resource]>=original.used[resource])continue;
    // Leave modest headroom so growth does not immediately shut collection down again.
    const required=Math.max(1,Math.ceil(original.used[resource]*1.1));
    while(metrics(planned).networks[id].capacity[resource]<required){
      if(additions.length>=48){problem='This network needs a larger utility expansion. Add utilities through City management.';break;}
      const candidates=new Map<string,{x:number;z:number}>();
      for(const road of original.roads){const c=planned.cells[road];for(const [x,z]of neighbors(c.x,c.z)){
        const k=key(x,z);if(!validLand(x,z)||planned.cells[k])continue;
        const adjacent=neighbors(x,z).map(([a,b])=>initial.roadIds.get(key(a,b))).filter((n):n is number=>n!==undefined);
        if(Math.min(...adjacent)!==id)continue;
        candidates.set(k,{x,z});
      }}
      const distance=(p:{x:number;z:number})=>Math.min(30,...homes.map(h=>Math.hypot(h.x-p.x,h.z-p.z)));
      const sites=[...candidates.values()].sort((a,b)=>distance(b)-distance(a)||b.z-a.z||a.x-b.x);
      if(!sites.length){problem=`No vacant roadside site for ${labels[resource].toLowerCase()} on network ${id+1}.`;break;}
      const site=sites[0],result=build(planned,resource,[site]);
      if(!result.ok){problem=result.message;break;}
      cost+=planned.money-result.city.money;planned=result.city;additions.push({kind:resource,...site});
    }
    if(problem)break;
  }
  if(blocked.length)problem=`${blocked.length} waste facilities have no road access. Reconnect their roads first.`;
  if(cost>city.money)problem=`Missing utilities cost $${cost.toLocaleString()}; the treasury needs $${Math.ceil(cost-city.money).toLocaleString()} more.`;
  return {additions,cost,unavailable,problem,city:problem||!additions.length?city:{...planned,money:city.money-cost}};
}

export function restoreWasteUtilities(city:City){
  const plan=planWasteUtilities(city);
  return {city:plan.city,message:plan.problem||(plan.additions.length?`${plan.additions.length} utility facilities built on vacant lots · $${plan.cost.toLocaleString()}. Resume time for collection trucks to clear the bins.`:'All garbage facilities already have power, water and sewage. Check storage and truck traffic below.')};
}
