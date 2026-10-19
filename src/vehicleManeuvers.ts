import type {City} from './simulation';
import type {Vehicle} from './traffic';

/** Keep the arrival lane when a service assigns another trip at the same node. */
export function setVehicleRoute(city:City,v:Vehicle,path:string[]){
  const approach=v.path[v.index-1]||v.approach;
  // Service vehicles circle a connected block instead of reversing across both
  // lanes after every doorstep visit. Bus paths retain their drawn stop order.
  if(v.kind!=='bus'&&approach&&path[1]===approach){
    const start=path[0],at=city.cells[start];
    if(at){
      const neighbors=(k:string)=>{const c=city.cells[k];return [[c.x-1,c.z],[c.x+1,c.z],[c.x,c.z-1],[c.x,c.z+1]].map(([x,z])=>`${x},${z}`).filter(n=>city.cells[n]?.kind==='road');};
      const goal=path.at(-1)!;
      const queue=neighbors(start).filter(k=>k!==approach).map(k=>[start,k]),seen=new Set([start,...queue.map(p=>p[1])]);
      for(let i=0;i<queue.length;i++){
        const loop=queue[i],tail=loop.at(-1)!;
        // Route all the way to the destination. Appending the old suffix can
        // turn back onto this loop and create another reversal mid-block.
        if(tail===goal){path=loop;break;}
        if(loop.length>=1521)continue;
        for(const k of neighbors(tail))if(!seen.has(k)){seen.add(k);queue.push([...loop,k]);}
      }
    }
  }
  v.path=path;v.index=0;v.progress=0;if(approach)v.approach=approach;else delete v.approach;delete v.uTurn;
  prepareUTurn(city,v);
}

export function prepareUTurn(city:City,v:Vehicle){
  if(v.uTurn||v.progress!==0)return;
  const previous=city.cells[v.path[v.index-1]||v.approach||''],at=city.cells[v.path[v.index]],next=city.cells[v.path[v.index+1]];
  if(!previous||!at||!next)return;
  const dx=at.x-previous.x,dz=at.z-previous.z;
  if(Math.abs(dx)+Math.abs(dz)===1&&next.x-at.x===-dx&&next.z-at.z===-dz)v.uTurn={dx,dz,progress:0};
}
