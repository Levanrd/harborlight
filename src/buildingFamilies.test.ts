import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildingFamily,buildingVariant,cityBuildingDirectory} from './buildingFamilies';
import {createCity,type Cell} from './simulation';

test('architectural identity is deterministic and coastal buildings retain their classification',()=>{
  const c:Cell={x:3,z:5,kind:'residential',level:3,age:50,occupancy:20};
  const f=buildingFamily(c);
  assert.deepEqual(buildingFamily({...c,occupancy:40,age:100}),f);
  assert.equal(buildingFamily({...c,coastal:'beachhouse'})?.group,'coast');
  assert.equal(buildingFamily({...c,kind:'school'})?.group,'civic');
  assert.equal(buildingFamily({...c,kind:'road'}),undefined);
  for(let x=-20;x<20;x++){const low={...c,x,level:2},high={...c,x,level:3};assert.equal(buildingVariant(low),buildingVariant(high));}
});
test('directory counts facilities once, excludes construction and leaves the city unchanged',()=>{
  const city=createCity(false,'Directory test');city.cells={};
  const base:Cell={x:0,z:0,kind:'airport',age:50,level:1,occupancy:0};
  city.cells['0,0']=base;city.cells['1,0']={...base,x:1,regionalRoot:'0,0'};
  city.cells['3,0']={...base,x:3,kind:'largepark',recreationRoot:'3,0'};
  city.cells['4,0']={...base,x:4,kind:'largepark',recreationRoot:'3,0'};
  city.cells['6,0']={...base,x:6,kind:'residential',age:2};
  const before=JSON.stringify(city),entries=cityBuildingDirectory(city);
  assert.equal(entries.length,2);assert.equal(entries.reduce((n,e)=>n+e.lots.length,0),2);
  assert.equal(JSON.stringify(city),before);
});
test('all residential and office variants have distinct named families without changing their role',()=>{
  for(const kind of ['residential','commercial'] as const){
    const names=new Set<string>();
    for(let x=-30;x<=30;x++)names.add(buildingFamily({x,z:0,kind,level:3,age:50,occupancy:0})!.id);
    assert.equal(names.size,6);
  }
});
