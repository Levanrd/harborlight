import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCity,type City} from './simulation';
import {advanceTraffic,emptyTraffic,type Vehicle} from './traffic';
import {advancePedestrians,emptyFootTraffic,walkingGraph,walkingRoute,pedestrianRoadBlocks,crossingSafe,buildingEntrance} from './pedestrians';
import {PedestrianModels} from './pedestrianModels';

function neighborhood(){const c=createCity(false);c.cells={};for(let n=-4;n<=4;n++){c.cells[`${n},0`]={x:n,z:0,kind:'road',age:20,level:1,occupancy:0};c.cells[`0,${n}`]={x:0,z:n,kind:'road',age:20,level:1,occupancy:0};}for(const [x,z,kind]of [[1,1,'residential'],[-1,1,'commercial'],[1,-1,'industrial'],[-1,-1,'park']] as const)c.cells[`${x},${z}`]={x,z,kind,age:20,level:1,occupancy:kind==='park'?0:120};return c;}
test('walkers follow connected sidewalk corners, painted crossings and real frontages',()=>{
  const c=neighborhood(),g=walkingGraph(c),path=walkingRoute(g,'1,1','-1,1'),entry=buildingEntrance(c,c.cells['1,1'])!;
  assert.ok(path.length>6);assert.ok(path.some(p=>p.crossing==='0,0'));assert.ok(Math.hypot(path[0].x-entry.door.x,path[0].z-entry.door.z)<.2);
  for(let i=1;i<path.length;i++)if(path[i].crossing){assert.ok(Math.abs(Math.abs(path[i].x)-2.9)<.001||Math.abs(Math.abs(path[i].z)-2.9)<.001);assert.equal(path[i].approach,'0,1');}
  const disconnected=neighborhood();delete disconnected.cells['0,0'];assert.deepEqual(walkingRoute(walkingGraph(disconnected),'1,1','-1,1'),[]);
});
test('pedestrians depart, arrive, stay inside, return and respect pause without changing the city',()=>{
  const c=neighborhood(),before=JSON.stringify(c);let foot=emptyFootTraffic(),traffic=emptyTraffic(),sawInside=false,sawReturn=false;
  for(let i=0;i<2400;i++){traffic.time=i*.1;foot=advancePedestrians(c,foot,traffic,.1);sawInside||=foot.agents.some(p=>p.stage==='inside');sawReturn||=foot.agents.some(p=>p.returning);assert.ok(foot.agents.length<=180);}
  assert.ok(foot.departures>5);assert.ok(foot.visits>5);assert.ok(foot.crossings>0);assert.ok(sawInside&&sawReturn);assert.equal(advancePedestrians(c,foot,traffic,0),foot);assert.equal(JSON.stringify(c),before);
});
test('pedestrians wait for clearance and nearby cars; occupied crossings stop vehicles',()=>{
  const c=neighborhood(),a={x:-3.72,z:2.9},b={x:3.72,z:2.9,crossing:'0,0',approach:'0,1'},traffic=emptyTraffic();
  traffic.time=2;assert.equal(crossingSafe(c,traffic,a,b),false);traffic.time=6.2;assert.equal(crossingSafe(c,traffic,a,b),true);traffic.time=20.2;assert.equal(crossingSafe(c,traffic,a,b),false,'next vehicle cycle stays clear for traffic');traffic.time=34.2;assert.equal(crossingSafe(c,traffic,a,b),true);traffic.time=6.2;
  const car:Vehicle={id:1,kind:'car',path:['0,1','0,0','0,-1'],index:0,progress:.5,waiting:0,stage:'outbound'};traffic.vehicles=[car];assert.equal(crossingSafe(c,traffic,a,b),false);
  let foot=emptyFootTraffic();foot.agents=[{id:1,home:'1,1',destination:'-1,1',path:[a,b],index:0,progress:.3,x:-1,z:2.9,heading:Math.PI/2,walked:2,pace:1.3,stage:'walking',returning:false,until:0,waiting:false}];
  const blocks=pedestrianRoadBlocks(foot);assert.ok(blocks.has('0,0')&&blocks.has('0,1'));
  traffic.time=8;car.progress=.1;const stopped=advanceTraffic(c,traffic,.2,{health:100,fireRisk:0,operational:new Set(),autoIncidents:false,pedestrianRoads:blocks});assert.equal(stopped.state.vehicles.find(v=>v.id===1)!.progress,.1);
  const released=advanceTraffic(c,traffic,.2,{health:100,fireRisk:0,operational:new Set(),autoIncidents:false});assert.ok(released.state.vehicles.find(v=>v.id===1)!.progress>.1);
});
test('road demolition invalidates walking routes and removes stale crossing reservations',()=>{
  const c=neighborhood();let foot=advancePedestrians(c,emptyFootTraffic(),emptyTraffic(),.1);assert.ok(foot.agents.length);
  const removed:City={...c,cells:Object.fromEntries(Object.entries(c.cells).filter(([,v])=>v.kind!=='road'))};foot=advancePedestrians(removed,foot,emptyTraffic(),.1);assert.equal(foot.agents.length,0);assert.equal(pedestrianRoadBlocks(foot).size,0);
});
test('pedestrian and entrance rendering uses bounded instance buffers and releases resources',()=>{
  const c=neighborhood(),scene=new THREE.Scene(),models=new PedestrianModels(scene);let foot=emptyFootTraffic(),traffic=emptyTraffic();for(let i=0;i<100;i++){traffic.time=i*.1;foot=advancePedestrians(c,foot,traffic,.1);}models.update(c,foot,traffic,.016,false);
  assert.ok(scene.children.length<=16,'crowd and doors use a bounded number of anatomical batches');assert.ok(scene.children.some(o=>o instanceof THREE.InstancedMesh&&o.count>0));
  for(const o of scene.children){const mesh=o as THREE.InstancedMesh;assert.ok(mesh.count<=mesh.instanceMatrix.count);for(const n of mesh.instanceMatrix.array)assert.ok(Number.isFinite(n));}
  // The first residential doorway opens for a nearby actor, then closes again.
  const entry=walkingGraph(c).entrances.get('1,1')!,p=foot.agents[0];p.home='1,1';p.stage='walking';p.x=entry.outside.x;p.z=entry.outside.z;
  models.update(c,foot,traffic,1,false);const door=scene.getObjectByName('pedestrian-doors') as THREE.InstancedMesh,opened=new THREE.Matrix4(),closed=new THREE.Matrix4();door.getMatrixAt(1,opened);
  models.update(c,{...foot,agents:[]},traffic,1,false);door.getMatrixAt(1,closed);assert.ok(new THREE.Vector3().setFromMatrixPosition(opened).distanceTo(new THREE.Vector3().setFromMatrixPosition(closed))>.32);
  models.dispose();assert.equal(scene.children.length,0);
});

test('a crossing wave clears before newcomers can extend the road closure',()=>{
 const city=neighborhood(),traffic={...emptyTraffic(),time:6.2},a={x:-3.72,z:2.9},b={x:3.72,z:2.9,crossing:'0,0',approach:'0,1'};
 const agent={id:1,home:'1,1',destination:'-1,1',path:[a,b],index:0,progress:.5,x:0,z:2.9,heading:Math.PI/2,walked:3.72,pace:1.3,stage:'walking' as const,returning:false,until:0,waiting:false};
 const foot={...emptyFootTraffic(),signature:walkingGraph(city).signature,nextId:3,agents:[agent,{...agent,id:2,progress:0,x:a.x,walked:0}]};
 const next=advancePedestrians(city,foot,traffic,.1);
 assert.ok(next.agents[0].progress>.5,'existing walkers continue');
 assert.equal(next.agents[1].progress,0,'newcomer waits even during the next all-red interval');
 assert.equal(next.agents[1].waiting,true);
 const empty={...foot,agents:[foot.agents[1]]};
 assert.ok(advancePedestrians(city,empty,traffic,.1).agents[0].progress>0,'admission resumes when the previous wave clears');
});
