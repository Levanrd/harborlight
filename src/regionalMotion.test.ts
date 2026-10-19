import {test} from 'node:test';
import assert from 'node:assert/strict';
import {airportPose,seaportPose,regionalCycleSeconds} from './regionalMotion';
import {waterEdge} from './grid';

test('regional trips have longer travel, dwell and away periods',()=>{
  assert.equal(regionalCycleSeconds.airport,300);assert.equal(regionalCycleSeconds.seaport,360);
  assert.equal(airportPose(20).phase,'Holding for departure');assert.equal(airportPose(80).visible,false);assert.equal(airportPose(175).visible,false);assert.equal(airportPose(200).phase,'Final approach');assert.equal(airportPose(270).phase,'Taxiing back');
  assert.equal(seaportPose(100,104).phase,'Loading cargo');assert.equal(seaportPose(170,104).phase,'Loading cargo');assert.equal(seaportPose(300,104).visible,false);
  assert.deepEqual(airportPose(305),airportPose(5));
});
test('aircraft position and heading remain continuous through touchdown and taxi turns',()=>{
  for(const t of [30,230,250,260,282,292,300]){
    const a=airportPose(t-.0001),b=airportPose(t+.0001);
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.01,`Position at ${t}`);
    assert.ok(Math.abs(Math.atan2(Math.sin(a.yaw-b.yaw),Math.cos(a.yaw-b.yaw)))<.001,`Heading at ${t}`);
  }
  for(let t=250;t<292;t+=.1){const p=airportPose(t);assert.ok(p.x>=-19.51&&p.x<=19.51);assert.ok(p.z>=2&&p.z<=9);assert.equal(p.y,.58);assert.ok(p.gear);}
  assert.equal(airportPose(50).gear,false);assert.equal(airportPose(225).gear,true);
});
test('ships ease into the berth, pause parallel to the quay, and remain seaward',()=>{
  for(const berthZ of [-120,0,104]){
    for(const t of [80,180]){const a=seaportPose(t-.001,berthZ),b=seaportPose(t+.001,berthZ);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.001);}
    for(let t=0;t<260;t+=.5){const p=seaportPose(t,berthZ);assert.ok(p.x-waterEdge(p.z)>5,'Keep the hull away from shore');assert.ok(Number.isFinite(p.yaw));}
    const docked=seaportPose(120,berthZ);assert.equal(docked.z,berthZ);assert.ok(Math.abs(docked.yaw)<.00001);
  }
});
