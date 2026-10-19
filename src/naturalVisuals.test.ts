import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanopy,woodlandDensity} from './naturalVisuals';

test('organic foliage stays inside its clearance envelope with finite smooth normals',()=>{
  for(const pine of [false,true]){
    const geometry=createCanopy(pine);geometry.computeBoundingBox();
    const bounds=geometry.boundingBox!;
    for(const axis of ['x','y','z'] as const){assert.ok(bounds.min[axis]>=-1.000001);assert.ok(bounds.max[axis]<=1.000001);}
    for(const v of geometry.attributes.normal.array)assert.ok(Number.isFinite(v));
    assert.ok(geometry.attributes.position.count<500,'retain an economical shared canopy');
    const same=createCanopy(pine);assert.deepEqual(geometry.attributes.position.array,same.attributes.position.array);geometry.dispose();same.dispose();
  }
});
test('woodland density creates deterministic glades and dense patches',()=>{
  let min=1,max=0;for(let x=-350;x<100;x+=10)for(let z=-350;z<350;z+=10){const density=woodlandDensity(x,z);assert.ok(density>=0&&density<=1);min=Math.min(min,density);max=Math.max(max,density);}
  assert.ok(min<.08);assert.ok(max>.7);
});
