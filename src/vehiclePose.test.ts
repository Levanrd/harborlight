import {STREET_SCALE} from './worldScale';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {vehicleRoadPose} from './vehiclePose';
import {createCity,type Cell} from './simulation';
import type {Vehicle,TrafficState} from './traffic';
import {setVehicleRoute} from './vehicleManeuvers';
import {advanceTraffic,emptyTraffic,decodeTraffic} from './traffic';

test('road poses are continuous across all left and right turn orientations',()=>{
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])for(const turn of [-1,1]){
    const points=[[-dx,-dz],[0,0],[-dz*turn,dx*turn]],city=createCity(false);
    city.cells=Object.fromEntries(points.map(([x,z])=>[`${x},${z}`,{x,z,kind:'road',level:1,age:4,occupancy:0} as Cell]));
    const car:Vehicle={id:1,kind:'car',path:points.map(p=>p.join(',')),index:0,progress:1,waiting:0,stage:'outbound'};
    const end=vehicleRoadPose(city,car)!,start=vehicleRoadPose(city,{...car,index:1,progress:0})!;
    assert.ok(Math.hypot(end.x-start.x,end.z-start.z)<.00001);assert.equal(end.heading,start.heading);
    const snapshot=JSON.stringify(city);
    for(let progress=0;progress<=1;progress+=.02){const pose=vehicleRoadPose(city,{...car,progress})!;assert.ok(Number.isFinite(pose.heading));assert.ok(Math.abs(dx?pose.z:pose.x)<3.2);}
    assert.equal(JSON.stringify(city),snapshot);
  }
});
test('straight paths retain their lane and only upcoming corners signal',()=>{
  const city=createCity(false);city.cells={};for(let z=0;z<=2;z++)city.cells[`0,${z}`]={x:0,z,kind:'road',age:3,level:1,occupancy:0};
  const car:Vehicle={id:1,kind:'car',path:['0,0','0,1','0,2'],index:0,progress:.5,waiting:0,stage:'outbound'};
  assert.deepEqual(vehicleRoadPose(city,car),{x:STREET_SCALE.laneOffset,z:4,heading:0,turn:0});
  assert.equal(vehicleRoadPose(city,{...car,path:['missing']}),undefined);
});

test('terminal arrivals and U-turn arcs keep continuous lanes and tangent headings in all directions',()=>{
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const city=createCity(false);city.cells={};for(const [x,z]of [[-dx,-dz],[0,0]])city.cells[`${x},${z}`]={x,z,kind:'road',level:1,age:3,occupancy:0};
    const path=[`${-dx},${-dz}`,'0,0'];
    const v:Vehicle={id:1,kind:'car',path,index:0,progress:1,waiting:0,stage:'outbound'};
    const arrived=vehicleRoadPose(city,v)!;v.index=1;v.progress=0;
    assert.deepEqual(vehicleRoadPose(city,v),arrived);
    setVehicleRoute(city,v,[...path].reverse());const start=vehicleRoadPose(city,v)!;
    assert.equal(start.x,arrived.x);assert.equal(start.z,arrived.z);assert.equal(start.heading,arrived.heading);
    let prev=start;
    for(let i=1;i<=100;i++){
      v.uTurn!.progress=i/100;const p=vehicleRoadPose(city,v)!;
      assert.ok(Math.abs(Math.hypot(p.x,p.z)-STREET_SCALE.laneOffset)<1e-8);
      assert.ok(Math.hypot(p.x-prev.x,p.z-prev.z)<.05);
      assert.ok(Math.abs(Math.atan2(Math.sin(p.heading-prev.heading),Math.cos(p.heading-prev.heading)))<.04);prev=p;
    }
    delete v.uTurn;delete v.approach;const departure=vehicleRoadPose(city,v)!;
    assert.ok(Math.hypot(prev.x-departure.x,prev.z-departure.z)<1e-8);
  }
});

test('bus reversal dwells, yields, turns over time, survives saving and continues without repeating',()=>{
  const city=createCity(false);city.cells={};for(let z=-2;z<=0;z++)city.cells[`0,${z}`]={x:0,z,kind:'road',level:1,age:3,occupancy:0};
  const path=['0,-2','0,-1','0,0'];city.transit={nextId:2,stops:[{key:path[0],name:'A'},{key:path[2],name:'B'}],routes:[{id:1,name:'Test',color:'#ffffff',path,stops:[path[0],path[2]],buses:1,enabled:true}]};
  let s:TrafficState={...emptyTraffic(),nextId:2,vehicles:[{id:1,kind:'bus' as const,route:1,path,index:2,progress:0,waiting:0,stage:'outbound' as const}]};
  const options={operational:new Set<string>(),health:100,fireRisk:0,autoIncidents:false};
  s=advanceTraffic(city,s,.1,options).state;assert.equal(s.vehicles[0].uTurn?.progress,0);
  for(let i=0;i<25;i++)s=advanceTraffic(city,s,.1,{...options,pedestrianRoads:new Set(['0,0'])}).state;
  assert.equal(s.vehicles[0].uTurn?.progress,0);
  s=advanceTraffic(city,s,.1,options).state;assert.ok(s.vehicles[0].uTurn!.progress>0);
  const snapshot=JSON.stringify(s);assert.deepEqual(decodeTraffic(JSON.parse(snapshot)),s);
  assert.equal(advanceTraffic(city,s,0,options).state,s);
  const next=advanceTraffic(city,s,.1,options).state;assert.equal(JSON.stringify(s),snapshot);s=next;
  for(let i=0;i<32;i++)s=advanceTraffic(city,s,.1,options).state;
  assert.equal(s.vehicles[0].uTurn,undefined);assert.ok(s.vehicles[0].progress>0);
  const malformed=JSON.parse(snapshot);malformed.vehicles[0].uTurn.dx=4;assert.throws(()=>decodeTraffic(malformed));
});

test('following traffic yields, while already committed arrivals clear before the bus turns',()=>{
  for(const follower of [{index:1,progress:.1},{index:2,progress:.84}]){
  const city=createCity(false);city.cells={};for(let z=-3;z<=0;z++)city.cells[`0,${z}`]={x:0,z,kind:'road',level:1,age:3,occupancy:0};
  const path=['0,-3','0,-2','0,-1','0,0'];city.transit={nextId:2,stops:[{key:path[0],name:'A'},{key:path[3],name:'B'}],routes:[{id:1,name:'Test',color:'#ffffff',path,stops:[path[0],path[3]],buses:1,enabled:true}]};
  let s:TrafficState={...emptyTraffic(),nextId:3,vehicles:[{id:1,kind:'bus',route:1,path,index:3,progress:0,waiting:0,stage:'outbound'},{id:2,kind:'car',path,...follower,waiting:0,stage:'outbound'}]};
  const options={operational:new Set<string>(),health:100,fireRisk:0,autoIncidents:false};let turning=0;
  for(let i=0;i<120;i++){
    s=advanceTraffic(city,s,.1,options).state;
    const bus=s.vehicles.find(v=>v.id===1)!,car=s.vehicles.find(v=>v.id===2);
    if(bus.uTurn&&bus.uTurn.progress>0&&bus.uTurn.progress<1){turning++;if(car){const p=vehicleRoadPose(city,car)!;assert.ok(Math.hypot(p.x,p.z)>4.6);}}
  }
  assert.ok(turning>15);assert.ok(s.completed>=1,'following car completes its trip');
  }
});

test('committed opposing through traffic clears a waiting reversal without a circular lane lock',()=>{
  const city=createCity(false);city.cells={};for(let z=-2;z<=1;z++)city.cells[`0,${z}`]={x:0,z,kind:'road',level:1,age:3,occupancy:0};
  const path=['0,-2','0,-1','0,0'];city.transit={nextId:2,stops:[{key:path[0],name:'A'},{key:path[2],name:'B'}],routes:[{id:1,name:'Test',color:'#ffffff',path,stops:[path[0],path[2]],buses:1,enabled:true}]};
  let s:TrafficState={...emptyTraffic(),nextId:3,vehicles:[{id:1,kind:'bus',route:1,path,index:2,progress:0,waiting:0,stage:'outbound'},{id:2,kind:'car',path:['0,1','0,0','0,-1','0,-2'],index:0,progress:.7,waiting:0,stage:'outbound'}]};
  const options={operational:new Set<string>(),health:100,fireRisk:0,autoIncidents:false};let turned=false;
  for(let i=0;i<120;i++){s=advanceTraffic(city,s,.1,options).state;turned||=s.vehicles.some(v=>v.id===1&&!!v.uTurn&&v.uTurn.progress>0);}
  assert.equal(s.completed,1);assert.ok(turned,'the bus must resume once the opposing car clears');
});

test('service vehicles use a connected block to change direction without altering their destination',()=>{
  const city=createCity(false);city.cells={};for(const [x,z]of [[-2,0],[-1,0],[0,0],[0,1],[-1,1]])city.cells[`${x},${z}`]={x,z,kind:'road',level:1,age:3,occupancy:0};
  const v:Vehicle={id:1,kind:'police',path:['-1,0','0,0'],index:1,progress:0,waiting:0,stage:'outbound'};
  setVehicleRoute(city,v,['0,0','-1,0','-2,0']);
  assert.deepEqual(v.path,['0,0','0,1','-1,1','-1,0','-2,0']);assert.equal(v.uTurn,undefined);
});

test('a service detour does not double back where it rejoins the old route',()=>{
  const city=createCity(false);city.cells={};
  for(let x=-2;x<=0;x++)for(let z=0;z<=1;z++)city.cells[`${x},${z}`]={x,z,kind:'road',level:1,age:3,occupancy:0};
  const v:Vehicle={id:1,kind:'police',path:['-1,0','0,0'],index:1,progress:0,waiting:0,stage:'outbound'};
  setVehicleRoute(city,v,['0,0','-1,0','-1,1','-2,1']);
  assert.equal(v.path[0],'0,0');assert.equal(v.path.at(-1),'-2,1');assert.notEqual(v.path[1],'-1,0');
  assert.equal(new Set(v.path).size,v.path.length,'detour must not revisit its own route');
  for(let i=2;i<v.path.length;i++)assert.notEqual(v.path[i],v.path[i-2],'no mid-route reversal');
});

test('buses queue outside terminal turns and recover a stacked legacy save',()=>{
  for(const stacked of [false,true]){
    const city=createCity(false);city.cells={};for(let z=-5;z<=0;z++)city.cells[`0,${z}`]={x:0,z,kind:'road',level:1,age:3,occupancy:0};
    const path=Array.from({length:6},(_,i)=>`0,${i-5}`);
    city.transit={nextId:2,stops:[{key:path[0],name:'A'},{key:path[5],name:'B'}],routes:[{id:1,name:'Queue',color:'#ffffff',path,stops:[path[0],path[5]],buses:2,enabled:true}]};
    let s:TrafficState={...emptyTraffic(),nextId:3,vehicles:[
      {id:1,kind:'bus',route:1,path,index:5,progress:0,waiting:0,stage:'outbound'},
      {id:2,kind:'bus',route:1,path,index:stacked?5:4,progress:stacked?0:.1,waiting:0,stage:'outbound'},
    ]};
    const options={operational:new Set<string>(),health:100,fireRisk:0,autoIncidents:false};
    const departed=new Set<number>();
    for(let i=0;i<600;i++){
      s=advanceTraffic(city,s,.1,options).state;
      for(const v of s.vehicles)if(v.path[0]==='0,0'&&v.index>1)departed.add(v.id);
      const turning=s.vehicles.filter(v=>v.path[v.index]==='0,0'&&v.uTurn&&v.uTurn.progress>0&&v.uTurn.progress<1);
      assert.ok(turning.length<=1,'one bus at a time in the turning space');
      if(!stacked&&turning.length){const other=s.vehicles.find(v=>v.id!==turning[0].id)!;const pose=vehicleRoadPose(city,other)!;assert.ok(Math.hypot(pose.x,pose.z)>4.6,'follower stays outside the turn');}
    }
    assert.equal(departed.size,2,'both buses must leave the terminal');
    assert.ok(s.vehicles.every(v=>v.waiting<15));
  }
});
