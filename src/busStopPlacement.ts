import type {City} from './simulation';

const directions=[[0,1],[1,0],[0,-1],[-1,0]];
/** A stop's road key stays stable for routes/saves; its furniture needs a real curb. */
export function busStopPlacement(city:City,key:string){
  if(city.cells[key]?.kind!=='road')return undefined;
  const queue=[{key,distance:0}],seen=new Set([key]);
  for(let i=0;i<queue.length;i++){
    const item=queue[i],c=city.cells[item.key];
    const links=directions.map(([x,z])=>city.cells[`${c.x+x},${c.z+z}`]?.kind==='road');
    // At an intersection, use the first free curb on a connected approach.
    // Avoid placing two stops on the same approach's sidewalk.
    if(item.key===key||!city.transit?.stops.some(s=>s.key===item.key)){
      for(let side=0;side<4;side++){
        if(links[side]||(!links[(side+1)%4]&&!links[(side+3)%4]))continue;
        const [nx,nz]=directions[side],offset=c.avenue?3.79:3.61;
        return {road:item.key,x:c.x*8+nx*offset,z:c.z*8+nz*offset,rotation:Math.atan2(nx,nz),nx,nz,depth:c.avenue?.3:.66};
      }
    }
    if(item.distance>=3)continue;
    for(let side=0;side<4;side++)if(links[side]){
      const [dx,dz]=directions[side],next=`${c.x+dx},${c.z+dz}`;
      if(!seen.has(next)){seen.add(next);queue.push({key:next,distance:item.distance+1});}
    }
  }
  return undefined;
}
