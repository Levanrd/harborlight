import {test} from 'node:test';
import assert from 'node:assert/strict';
import {atmosphereAt,boundedCamera,cameraLimits,terrainHeight,terrainTint} from './environment';
import {validLand} from './grid';

test('new landscape keeps every existing buildable parcel flat and finite',()=>{
  for(let x=-19;x<=19;x++)for(let z=-19;z<=19;z++)if(validLand(x,z)){
    for(const dx of [-3.9,0,3.9])for(const dz of [-3.9,0,3.9])assert.equal(terrainHeight(x*8+dx,z*8+dz),0);
  }
  assert.ok(terrainHeight(-300,250)>20);assert.equal(terrainHeight(300,0),-2);
  for(let x=-400;x<=400;x+=20)for(let z=-400;z<=400;z+=20)assert.ok(terrainTint(x,z,terrainHeight(x,z)).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
});
test('lighting repeats on persisted simulation time and manual settings ignore elapsed time',()=>{
  assert.deepEqual(atmosphereAt(20),atmosphereAt(260));
  assert.equal(atmosphereAt(20).night,0);assert.equal(atmosphereAt(140).night,1);
  for(const mode of ['day','dusk','night'] as const)assert.deepEqual(atmosphereAt(0,mode),atmosphereAt(1000,mode));
  assert.ok(atmosphereAt(0,'dusk').twilight>.5);
  for(let t=0;t<240;t+=.25){const a=atmosphereAt(t),b=atmosphereAt(t+.25);assert.ok(Math.abs(a.night-b.night)<.03);}
});
test('camera bounds preserve pan offset and clear high surrounding terrain',()=>{
  const result=boundedCamera({x:500,y:1,z:-600},{x:500,y:0,z:-500});
  assert.deepEqual(result.target,{x:132,y:0,z:-156});assert.equal(result.position.z,-256);
  assert.ok(result.position.y>=terrainHeight(result.position.x,result.position.z)+cameraLimits.groundClearance);
  assert.deepEqual(boundedCamera({x:50,y:100,z:60},{x:0,y:0,z:0}),{position:{x:50,y:100,z:60},target:{x:0,y:0,z:0}});
});

test('airport close inspection is allowed while the camera stays above ground',()=>{
  const target={x:-116,y:0,z:-132};
  const p=boundedCamera({x:-110,y:4,z:-123},target);
  assert.deepEqual(p.position,{x:-110,y:4,z:-123});
  assert.equal(cameraLimits.minDistance,12);
  const low=boundedCamera({x:-116,y:.5,z:-132},target);assert.equal(low.position.y,cameraLimits.groundClearance);
});