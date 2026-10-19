import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCity} from './simulation';
import {busStopPlacement} from './busStopPlacement';

test('shelters stay entirely beyond the curb on straight streets, dead ends and T junctions',()=>{
  for(const avenue of [false,true])for(const arms of [[[0,1]],[[0,-1]],[[1,0]],[[-1,0]],[[0,-1],[0,1]],[[-1,0],[1,0]],[[-1,0],[1,0],[0,-1]]]){
    const city=createCity(false);city.cells={};for(const [x,z]of [[0,0],...arms])city.cells[`${x},${z}`]={x,z,kind:'road',level:1,age:4,occupancy:0,avenue};
    const p=busStopPlacement(city,'0,0')!;assert.ok(p);
    assert.notEqual(city.cells[`${p.nx},${p.nz}`]?.kind,'road');
    const normal=p.x*p.nx+p.z*p.nz;
    assert.ok(normal-p.depth/2>(avenue?3.55:3.15));assert.ok(normal+p.depth/2<4);
  }
});

test('crossroad stops use a connected curb, keep their logical key and avoid another stop',()=>{
  const city=createCity(false);city.cells={};for(const [x,z]of [[0,0],[0,1],[0,-1],[1,0],[-1,0],[0,2]])city.cells[`${x},${z}`]={x,z,kind:'road',level:1,age:4,occupancy:0};
  city.transit={nextId:3,stops:[{key:'0,0',name:'Crossroad'},{key:'0,1',name:'Existing'}],routes:[]};
  const before=JSON.stringify(city),p=busStopPlacement(city,'0,0')!;
  assert.ok(p);assert.notEqual(p.road,'0,0');assert.notEqual(p.road,'0,1');assert.equal(JSON.stringify(city),before);
  assert.equal(busStopPlacement(city,'18,18'),undefined);
});
