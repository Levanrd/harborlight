import {constructionSecond} from './upgradeConstruction';
import {unlockedCity as createCity} from './testCity';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build,roadPath,metrics,tick,decodeCity,upgradeHome,homeUpgradeStatus,constructionChange,undoConstruction,type City} from './simulation';
import {emptyProduction,queueProduction,productionSecond,collectProduction,cancelProduction,sellMaterial,storageUsed,recipes} from './production';

function town():City{
  let c=build(createCity(false),'road',roadPath({x:-10,z:0},{x:9,z:0})).city;
  for(const [kind,x,z]of [['utility',0,1],['industrial',8,1],['residential',-5,1]] as const)c=build(c,kind,[{x,z}]).city;
  c.cells['8,1']={...c.cells['8,1'],age:20,occupancy:16};c.cells['-5,1']={...c.cells['-5,1'],age:20,occupancy:12};return c;
}
const work=(c:City,n:number)=>{for(let i=0;i<n;i++){c=tick(c,'development');const operational=new Set(Object.entries(metrics(c).lots).filter(([,l])=>l.supplied).map(([k])=>k));for(let j=0;j<2;j++)c={...c,production:productionSecond(c,operational)};}return c;};
const finish=(c:City)=>{for(let i=0;i<45;i++)c=constructionSecond(c,new Set(Object.keys(c.cells)));return c;};
const stocked=(c=town()):City=>({...c,production:{...emptyProduction(),inventory:{wood:4,metal:6,stone:4,planks:6,nails:6,bricks:4}}});

test('raw production charges once, progresses with active seconds, and waits for manual collection',()=>{
  const c=town(),queued=queueProduction(c,'8,1','wood',true).city;
  assert.equal(c.money-queued.money,8);assert.equal(queued.production!.queues['8,1'][0].remaining,4);assert.equal(c.production,undefined);
  const ready=work(queued,2);assert.equal(ready.production!.queues['8,1'][0].remaining,0);assert.equal(storageUsed(ready.production),0);
  const held=work(ready,8);assert.equal(held.production!.queues['8,1'][0].remaining,0);
  const collected=collectProduction(held,'8,1').city;assert.equal(collected.production!.inventory.wood,2);assert.equal(collected.production!.queues['8,1'],undefined);
  assert.equal(collectProduction(collected,'8,1').city,collected);
});
test('all five advanced factory slots run together and ready batches never block work',()=>{
  let c=stocked();c.cells['8,1']={...c.cells['8,1'],factoryTier:3};
  for(const material of ['planks','planks','nails','nails','nails'] as const)c=queueProduction(c,'8,1',material,true).city;
  assert.equal(c.production!.queues['8,1'].length,5);
  assert.equal(queueProduction(c,'8,1','wood',true).city,c);
  c=work(c,3);assert.deepEqual(c.production!.queues['8,1'].map(j=>j.remaining),[0,0,2,2,2]);
  const saved=decodeCity(JSON.parse(JSON.stringify(c)));assert.deepEqual(saved,c);
  c=work(saved,1);assert.deepEqual(c.production!.queues['8,1'].map(j=>j.remaining),[0,0,0,0,0]);
  assert.equal(productionSecond(c,new Set(['8,1'])),c.production);
  assert.equal(c.production!.inventory.nails,6,'goods still require collection');
});
test('a later slot can finish and be collected independently, without resetting or duplicating jobs',()=>{
  let c=stocked();for(const material of ['bricks','wood','metal'] as const)c=queueProduction(c,'8,1',material,true).city;
  c=work(c,2);const jobs=c.production!.queues['8,1'];assert.deepEqual(jobs.map(j=>j.remaining),[6,0,2]);
  assert.equal(collectProduction(c,'8,1',jobs[0].id).city,c,'unfinished explicit job cannot be collected');
  assert.equal(collectProduction(c,'8,1',999).city,c,'stale ID never collects a different job');
  const next=collectProduction(c,'8,1',jobs[1].id).city;
  assert.equal(next.production!.inventory.wood,c.production!.inventory.wood+2);
  assert.deepEqual(next.production!.queues['8,1'],[jobs[0],jobs[2]]);
  assert.equal(collectProduction(next,'8,1',jobs[1].id).city,next,'repeat click is harmless');
  assert.deepEqual(collectProduction(c,'8,1').city,next,'default collection finds first ready batch');
  c=queueProduction(next,'8,1','stone',true).city;c=work(c,1);
  assert.deepEqual(c.production!.queues['8,1'].map(j=>j.remaining),[4,0,4]);
  const canceled=cancelProduction(c,'8,1',jobs[0].id).city;
  assert.deepEqual(canceled.production!.queues['8,1'],c.production!.queues['8,1'].slice(1));
  assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(c))),c,'partially worked later slots survive reload');
});
test('utility outages freeze every slot and full storage does not stop other batches',()=>{
  let c=stocked();for(const material of ['wood','metal','bricks'] as const)c=queueProduction(c,'8,1',material,true).city;
  c=work(c,1);assert.deepEqual(c.production!.queues['8,1'].map(j=>j.remaining),[2,4,8]);
  const broken=build(c,'bulldoze',[{x:7,z:0}]).city,paused=work(broken,5);
  assert.deepEqual(paused.production!.queues,broken.production!.queues);
  c=work(build(paused,'road',[{x:7,z:0}]).city,1);
  c={...c,production:{...c.production!,inventory:{...emptyProduction().inventory,metal:80}}};
  const id=c.production!.queues['8,1'][0].id;assert.equal(collectProduction(c,'8,1',id).city,c);
  c=work(c,1);assert.deepEqual(c.production!.queues['8,1'].map(j=>j.remaining),[0,0,4]);
  c=sellMaterial(sellMaterial(c,'metal').city,'metal').city;
  const second=c.production!.queues['8,1'][1].id;
  const collected=collectProduction(c,'8,1',second).city;
  assert.equal(storageUsed(collected.production),80);assert.deepEqual(collected.production!.queues['8,1'].map(j=>j.remaining),[0,4]);
});
test('crafting requires ingredients and money, consumes them once, and refunds safely on cancellation',()=>{
  const empty=town();assert.equal(queueProduction(empty,'8,1','planks',true).city,empty);
  const c=stocked(),job=queueProduction(c,'8,1','planks',true).city;
  assert.equal(job.production!.inventory.wood,c.production!.inventory.wood-2);assert.equal(c.money-job.money,20);
  const restored=cancelProduction(job,'8,1',job.production!.queues['8,1'][0].id).city;
  assert.equal(restored.money,c.money);assert.deepEqual(restored.production!.inventory,c.production!.inventory);
  assert.equal(cancelProduction(restored,'8,1',1).city,restored);
  const poor={...c,money:0};assert.equal(queueProduction(poor,'8,1','wood',true).city,poor);
});
test('road and utility failures pause factories, and restoring access resumes exactly where they stopped',()=>{
  const queued=queueProduction(town(),'8,1','metal',true).city,progress=work(queued,1);
  const broken=build(progress,'bulldoze',[{x:7,z:0}]).city,paused=work(broken,5);
  assert.equal(paused.production!.queues['8,1'][0].remaining,4);
  assert.equal(queueProduction(paused,'8,1','wood',!!metrics(paused).lots['8,1'].supplied).city,paused);
  const restored=build(paused,'road',[{x:7,z:0}]).city;assert.equal(work(restored,2).production!.queues['8,1'][0].remaining,0);
  assert.equal(productionSecond(progress,new Set()),progress.production);
});
test('full storage retains finished goods, selling frees space, and cancellation cannot overflow refunds',()=>{
  let c=queueProduction(town(),'8,1','wood',true).city;c=work(c,2);
  c={...c,production:{...c.production!,inventory:{...emptyProduction().inventory,metal:80}}};
  assert.equal(collectProduction(c,'8,1').city,c);c=sellMaterial(c,'metal').city;c=sellMaterial(c,'metal').city;
  const collected=collectProduction(c,'8,1').city;assert.equal(storageUsed(collected.production),80);assert.equal(collected.production!.inventory.wood,2);
  let crafted=queueProduction(stocked(),'8,1','planks',true).city;crafted={...crafted,production:{...crafted.production!,inventory:{...emptyProduction().inventory,metal:80}}};
  assert.equal(cancelProduction(crafted,'8,1',crafted.production!.queues['8,1'][0].id).city,crafted);
});
test('factory demolition and construction undo cannot discard queued or completed batches',()=>{
  const before=build(town(),'bulldoze',[{x:8,z:1}]).city,built=build(before,'industrial',[{x:8,z:1}]).city;
  const mature=work(built,5),queued=queueProduction(mature,'8,1','wood',true).city;
  assert.ok(queued.production);assert.equal(build(queued,'bulldoze',[{x:8,z:1}]).ok,false);assert.equal(undoConstruction(queued,constructionChange(before,built)),queued);
  const ready=work(queued,2);assert.equal(build(ready,'bulldoze',[{x:8,z:1}]).ok,false);
  const cleared=collectProduction(ready,'8,1').city;assert.equal(build(cleared,'bulldoze',[{x:8,z:1}]).ok,true);
});
test('homes require materials and explicit upgrades; paid upgrades increase capacity without adding instant residents',()=>{
  const c=town();assert.equal(work(c,60).cells['-5,1'].level,1);assert.equal(upgradeHome(c,'-5,1').city,c);
  const ready=stocked(),before=ready.cells['-5,1'],pending=upgradeHome(ready,'-5,1').city;
  assert.equal(pending.cells['-5,1'].level,1);assert.equal(pending.production!.upgrades,0);assert.equal(upgradeHome(pending,'-5,1').city,pending);const result=finish(pending);
  assert.equal(result.cells['-5,1'].level,2);assert.equal(result.cells['-5,1'].occupancy,before.occupancy);assert.equal(ready.money-result.money,300);
  assert.equal(result.production!.inventory.planks,4);assert.equal(result.production!.inventory.nails,4);assert.equal(result.production!.inventory.metal,4);assert.equal(result.production!.upgrades,1);
  assert.equal(upgradeHome(result,'-5,1').city,result);assert.ok(work(result,3).cells['-5,1'].occupancy>12);
});
test('level 3 requires occupancy, services, land value and supplies, and existing levels never regress',()=>{
  let c=stocked();c.cells['-5,1']={...c.cells['-5,1'],level:2,occupancy:24,age:100};
  assert.ok(homeUpgradeStatus(c,'-5,1').reasons.some(r=>r.includes('school')));
  for(const [kind,x,z]of [['school',-6,1],['clinic',-4,1],['fire',-3,1],['park',-5,-1]] as const)c=build(c,kind,[{x,z}]).city;
  assert.equal(homeUpgradeStatus(c,'-5,1').ready,true);const result=finish(upgradeHome(c,'-5,1').city);assert.equal(result.cells['-5,1'].level,3);assert.equal(result.production!.inventory.bricks,0);
  assert.equal(upgradeHome(result,'-5,1').city,result);assert.equal(work(result,5).cells['-5,1'].level,3);
  const emptyHome={...c,cells:{...c.cells,'-5,1':{...c.cells['-5,1'],occupancy:20}}};assert.equal(upgradeHome(emptyHome,'-5,1').city,emptyHome);
});
test('production saves retain progress, storage and counters; malformed jobs and over-capacity inventories reject',()=>{
  const c=work(queueProduction(stocked(),'8,1','bricks',true).city,2);assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(c))),c);assert.equal(decodeCity(createCity()).production,undefined);
  const p=c.production!,job=p.queues['8,1'][0];
  for(const remaining of [-1,1.5,99])assert.throws(()=>decodeCity({...c,production:{...p,queues:{'8,1':[{...job,remaining}]}}}));
  assert.throws(()=>decodeCity({...c,production:{...p,inventory:{...p.inventory,wood:81}}}));
  assert.throws(()=>decodeCity({...c,production:{...p,queues:{'-5,1':[job]}}}));
  assert.throws(()=>decodeCity({...c,production:{...p,queues:{'8,1':[job,job]}}}));
  assert.throws(()=>decodeCity({...c,production:{...p,nextId:p.nextId+1,queues:{'8,1':[job,{id:p.nextId,material:'wood',remaining:recipes.wood.seconds+1}]}}}));
});
