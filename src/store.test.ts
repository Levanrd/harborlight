import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {useGame,saveCity,loadCity,resetCity} from './store';
import {emptyFootTraffic,type FootTraffic} from './pedestrians';
import {archivedCities,writeMasterplan} from './cityStorage';

const initial=useGame.getInitialState();
const originalIndexedDB=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
beforeEach(()=>{
  Object.defineProperty(globalThis,'indexedDB',{value:new IDBFactory(),configurable:true});
  useGame.setState(initial,true);
});
afterEach(()=>{
  useGame.setState(initial,true);
  if(originalIndexedDB)Object.defineProperty(globalThis,'indexedDB',originalIndexedDB);
  else Reflect.deleteProperty(globalThis,'indexedDB');
});
function stalePedestrians():FootTraffic{
  return {...emptyFootTraffic(),nextId:42,seed:17,signature:'old-city',clock:99,visits:12,departures:13,crossings:4,
    agents:[{id:41,home:'retired-home',destination:'retired-shop',path:[{x:5,z:5,crossing:'retired-road'}],
      index:0,progress:.5,x:5,z:5,heading:0,walked:12,pace:1,stage:'walking',returning:false,until:0,waiting:true}]};
}
test('load replaces transient pedestrians while restoring saved city, traffic and clock',async()=>{
  const city={...initial.city,money:123456};
  const traffic={...initial.traffic,time:42,completed:7};
  const clock={...initial.clock,dayProgress:.5};
  useGame.setState({city,traffic,clock});
  await saveCity();
  useGame.setState({city:{...city,money:1},footTraffic:stalePedestrians(),speed:2});
  await loadCity();
  const loaded=useGame.getState();
  assert.deepEqual(loaded.footTraffic,emptyFootTraffic());
  assert.equal(loaded.city.money,123456);
  assert.equal(loaded.traffic.time,42);
  assert.equal(loaded.traffic.completed,7);
  assert.equal(loaded.clock.dayProgress,.5);
  assert.equal(loaded.speed,0);
});
test('reset clears pedestrians and archives the previous city before replacement',async()=>{
  useGame.setState({city:{...initial.city,money:654321},footTraffic:stalePedestrians(),speed:2});
  await resetCity();
  const reset=useGame.getState();
  assert.deepEqual(reset.footTraffic,emptyFootTraffic());
  assert.equal(reset.speed,0);
  assert.equal(reset.city.money,initial.city.money);
  const archives=await archivedCities() as {city:{money:number}}[];
  assert.equal(archives.length,1);
  assert.equal(archives[0].city.money,654321);
});
test('failed load preserves the current city and pedestrian state',async()=>{
  await writeMasterplan({...initial.city,clock:{dayProgress:-1}} as typeof initial.city);
  useGame.setState({footTraffic:stalePedestrians(),speed:2});
  const before=useGame.getState();
  await assert.rejects(loadCity(),/Invalid city clock/);
  assert.strictEqual(useGame.getState(),before);
});
test('failed reset storage write preserves the current city and pedestrian state',async(t)=>{
  useGame.setState({footTraffic:stalePedestrians(),speed:2});
  const before=useGame.getState();
  t.mock.method(indexedDB,'open',()=>{throw new Error('Storage unavailable');});
  await assert.rejects(resetCity(),/Storage unavailable/);
  assert.strictEqual(useGame.getState(),before);
});
