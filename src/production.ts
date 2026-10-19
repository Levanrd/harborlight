import {createUpgrade} from './upgradeConstruction';
import {materialLock,cityProgress,progressionOf,factoryType} from './progression';
import type {City} from './simulation';

export const materials=['wood','metal','stone','planks','nails','bricks'] as const;
export type Material=typeof materials[number];
export type Inventory=Record<Material,number>;
export type ProductionJob={id:number;material:Material;remaining:number};
export type Production={inventory:Inventory;queues:Record<string,ProductionJob[]>;nextId:number;upgrades:number;timing?:'seconds'};
export type CityResult={city:City;message:string};
export const STORAGE_CAPACITY=80,QUEUE_SLOTS=3;
export const recipes:Record<Material,{name:string;seconds:number;quantity:number;cost:number;sell:number;inputs:Partial<Inventory>;color:string}>={
  wood:{name:'Wood',seconds:4,quantity:2,cost:8,sell:2,inputs:{},color:'#b89368'},
  metal:{name:'Metal',seconds:6,quantity:2,cost:12,sell:3,inputs:{},color:'#8cabb5'},
  stone:{name:'Stone',seconds:6,quantity:2,cost:10,sell:2,inputs:{},color:'#a9ada2'},
  planks:{name:'Planks',seconds:6,quantity:2,cost:20,sell:5,inputs:{wood:2},color:'#caa56b'},
  nails:{name:'Nails',seconds:8,quantity:2,cost:24,sell:6,inputs:{metal:2},color:'#7f9fa9'},
  bricks:{name:'Bricks',seconds:10,quantity:2,cost:28,sell:7,inputs:{stone:2},color:'#c58770'},
};
export const emptyProduction=():Production=>({inventory:{wood:0,metal:0,stone:0,planks:0,nails:0,bricks:0},queues:{},nextId:1,upgrades:0,timing:'seconds'});
export const storageUsed=(p?:Production)=>materials.reduce((n,k)=>n+(p?.inventory[k]||0),0);
export const hasFactoryWork=(city:City,k:string)=>(city.production?.queues[k]?.length||0)>0;
export function factoryStatus(city:City,k:string,operational:boolean){
  const c=city.cells[k];return !c||c.kind!=='industrial'?'Choose an industrial factory.':c.age<3?'Factory is under construction.':!operational?'Factory needs working road-connected utilities.':'';
}
export function queueProblem(city:City,k:string,material:Material,operational:boolean){
  const status=factoryStatus(city,k,operational);if(status)return status;
  if((city.production?.queues[k]?.length||0)>=factoryType(city,k).slots)return 'All factory production slots are occupied.';
  const locked=materialLock(city,material);if(locked)return locked;
  const r=recipes[material];if(!r)return 'Choose a valid material.';
  if(city.money<r.cost)return 'Not enough funds for this batch.';
  const missing=materials.filter(m=>(r.inputs[m]||0)>(city.production?.inventory[m]||0));
  return missing.length?'Requires '+missing.map(m=>`${r.inputs[m]} ${recipes[m].name}`).join(', ')+'.':'';
}
export function queueProduction(city:City,k:string,material:Material,operational:boolean):CityResult{
  const problem=queueProblem(city,k,material,operational);if(problem)return {city,message:problem};
  const p=city.production||emptyProduction(),r=recipes[material],inventory={...p.inventory};
  for(const m of materials)inventory[m]-=r.inputs[m]||0;
  return {city:{...city,money:city.money-r.cost,production:{...p,inventory,nextId:p.nextId+1,queues:{...p.queues,[k]:[...(p.queues[k]||[]),{id:p.nextId,material,remaining:r.seconds}]}}},message:`Started ${r.quantity} ${r.name}. Every occupied slot produces independently.`};
}
export function productionSecond(city:City,operational:Set<string>):Production|undefined{
  const p=city.production;if(!p)return p;
  let next=p;
  for(const [k,jobs]of Object.entries(p.queues)){
    if(!jobs.some(job=>job.remaining>0)||factoryStatus(city,k,operational.has(k)))continue;
    if(next===p)next={...p,queues:{...p.queues}};
    next.queues[k]=jobs.map(job=>job.remaining>0?{...job,remaining:job.remaining-1}:job);
  }
  return next;
}
export function collectProduction(city:City,k:string,id?:number):CityResult{
  const p=city.production,job=p?.queues[k]?.find(j=>id===undefined?j.remaining===0:j.id===id);
  if(!p||!job||job.remaining!==0||city.cells[k]?.kind!=='industrial')return {city,message:'No finished batch to collect.'};
  const r=recipes[job.material];if(storageUsed(p)+r.quantity>STORAGE_CAPACITY)return {city,message:'Storage is full. Use or sell materials before collecting.'};
  const queues={...p.queues};if(p.queues[k].length>1)queues[k]=p.queues[k].filter(j=>j.id!==job.id);else delete queues[k];
  return {city:{...city,production:{...p,queues,inventory:{...p.inventory,[job.material]:p.inventory[job.material]+r.quantity}}},message:`Collected ${r.quantity} ${r.name}.`};
}
export function cancelProduction(city:City,k:string,id:number):CityResult{
  const p=city.production,job=p?.queues[k]?.find(j=>j.id===id);if(!p||!job)return {city,message:'This production job is no longer in the queue.'};
  const r=recipes[job.material],returned=materials.reduce((n,m)=>n+(r.inputs[m]||0),0);
  if(storageUsed(p)+returned>STORAGE_CAPACITY)return {city,message:'Free storage space before refunding this job’s ingredients.'};
  const inventory={...p.inventory};for(const m of materials)inventory[m]+=r.inputs[m]||0;
  const queues={...p.queues},remaining=queues[k].filter(j=>j.id!==id);if(remaining.length)queues[k]=remaining;else delete queues[k];
  return {city:{...city,money:city.money+r.cost,production:{...p,inventory,queues}},message:`Canceled ${r.name}. Batch cost and ingredients refunded.`};
}
export function sellMaterial(city:City,material:Material):CityResult{
  const p=city.production;if(!recipes[material]||!p||p.inventory[material]<1)return {city,message:'No units of this material in storage.'};
  return {city:{...city,money:city.money+recipes[material].sell,production:{...p,inventory:{...p.inventory,[material]:p.inventory[material]-1}}},message:`Sold 1 ${recipes[material].name} for $${recipes[material].sell}.`};
}

export type UpgradeConditions={supplied:boolean;landValue:number;school:boolean;happiness:number};
export const upgradeRecipes:Record<number,{cost:number;materials:Partial<Inventory>}>= {2:{cost:300,materials:{planks:2,nails:2,metal:2}},3:{cost:1200,materials:{planks:4,nails:4,bricks:4}}};
export function upgradeOffer(city:City,k:string,conditions:UpgradeConditions){
  const c=city.cells[k],target=c?.kind==='residential'?c.level+1:0,recipe=upgradeRecipes[target];
  const reasons:string[]=[];
  if(!recipe||c?.kind!=='residential')reasons.push(c?.kind==='residential'?'This home is fully upgraded.':'Select a residential building.');
  else{
    if(target===3&&cityProgress(city).current.level<3)reasons.push('Unlocks at city level 3.');
    if(c.age<3)reasons.push('Finish initial construction.');
    if(c.upgrade)reasons.push('An upgrade is already under construction.');
    if(c.occupancy<c.level*12)reasons.push(`Fill the current ${c.level*12} resident capacity.`);
    if(!conditions.supplied)reasons.push('Restore road-connected utilities.');
    if(conditions.happiness<=30)reasons.push('Raise city happiness above 30%.');
    if(conditions.landValue<(target===2?48:65))reasons.push(`Raise land value to ${target===2?48:65}%.`);
    if(target===3&&!conditions.school)reasons.push('Provide school coverage.');
    if(city.money<recipe.cost)reasons.push(`Needs $${recipe.cost.toLocaleString()}.`);
    if(materials.some(m=>(recipe.materials[m]||0)>(city.production?.inventory[m]||0)))reasons.push('Produce and collect the missing materials.');
  }
  return {target,recipe,reasons,ready:reasons.length===0,capacity:recipe?target*12:c?.level?c.level*12:0};
}
export function applyHomeUpgrade(city:City,k:string,conditions:UpgradeConditions):CityResult{
  const offer=upgradeOffer(city,k,conditions);if(!offer.ready)return {city,message:offer.reasons[0]};
  const p=city.production||emptyProduction(),inventory={...p.inventory};for(const m of materials)inventory[m]-=offer.recipe.materials[m]||0;
  const upgrade=createUpgrade('home',offer.target);
  return {city:{...city,money:city.money-offer.recipe.cost,cells:{...city.cells,[k]:{...city.cells[k],upgrade}},production:{...p,inventory},progression:progressionOf(city)},message:`Home upgrade started · ${upgrade.duration}s of active work. Materials paid; new capacity and XP arrive at completion.`};
}

export function decodeProduction(value:unknown,city:City):Production|undefined{
  if(value===undefined)return undefined;const p=value as Production;
  const integer=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
  if(!p||!p.inventory||typeof p.inventory!=='object'||Array.isArray(p.inventory)||Object.keys(p.inventory).length!==materials.length||!materials.every(m=>integer(p.inventory[m]))||storageUsed(p)>STORAGE_CAPACITY||!integer(p.nextId)||p.nextId<1||!integer(p.upgrades)||!p.queues||typeof p.queues!=='object'||Array.isArray(p.queues)||Object.keys(p.queues).length>1521)throw new Error('Invalid materials or production save.');
  if(p.timing!==undefined&&p.timing!=='seconds')throw Error('Invalid production timing.');
  const factor=p.timing==='seconds'?1:2;
  const ids=new Set<number>(),queues:Production['queues']={};
  for(const [k,jobs]of Object.entries(p.queues)){
    if(city.cells[k]?.kind!=='industrial'||!Array.isArray(jobs)||jobs.length>factoryType(city,k).slots)throw new Error('Invalid factory queue.');
    queues[k]=jobs.map(j=>{
      if(!j||!integer(j.id)||j.id<1||j.id>=p.nextId||ids.has(j.id)||!materials.includes(j.material)||!integer(j.remaining)||j.remaining*factor>recipes[j.material].seconds)throw new Error('Invalid production job.');
      ids.add(j.id);return {id:j.id,material:j.material,remaining:j.remaining*factor};
    });
  }
  return {inventory:{...p.inventory},queues,nextId:p.nextId,upgrades:p.upgrades,timing:'seconds'};
}
export type ProductionAction={type:'factoryUpgrade';factory:string}|{type:'queue';factory:string;material:Material}|{type:'collect';factory:string;id?:number}|{type:'cancel';factory:string;id:number}|{type:'sell';material:Material}|{type:'upgrade';lot:string};
