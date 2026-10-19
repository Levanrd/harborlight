import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceCityClock,emptyClock,decodeClock,clockLabel,type GameClock} from './gameClock';
import {createCity,build,roadPath,tick,decodeCity,type City} from './simulation';
import {queueProduction,recipes} from './production';

function factory(){
  let c=build(createCity(false),'road',roadPath({x:-2,z:0},{x:3,z:0})).city;
  c=build(c,'utility',[{x:0,z:1}]).city;c=build(c,'industrial',[{x:2,z:1}]).city;
  c.cells['2,1']={...c.cells['2,1'],age:10,occupancy:16};
  return queueProduction(c,'2,1','wood',true).city;
}
function run(city:City,clock:GameClock,seconds:number){for(let i=0;i<seconds*10;i++)({city,clock}=advanceCityClock(city,clock,.1));return {city,clock};}
test('2-minute and 5-minute calendars leave factory completion and construction equally fast',()=>{
  for(const daySeconds of [120,300] as const){
    const city=factory(),clock={...emptyClock(),daySeconds,dayProgress:0};
    const before=run(city,clock,3);assert.equal(before.city.production!.queues['2,1'][0].remaining,1);
    const after=run(before.city,before.clock,1);assert.equal(after.city.production!.queues['2,1'][0].remaining,0);assert.equal(after.city.day,city.day);
    const construction={...city,cells:{...city.cells,'2,1':{...city.cells['2,1'],age:0,occupancy:0}}};
    assert.equal(run(construction,clock,6).city.cells['2,1'].age,3);
  }
});
test('calendar boundaries settle economy once, pause freezes both clocks, and pace switches retain time of day',()=>{
  const city=createCity(false),clock={...emptyClock(),dayProgress:0};
  const first=run(city,clock,119);assert.equal(first.city.day,city.day);
  const second=run(first.city,first.clock,1);assert.equal(second.city.day,city.day+1);assert.ok(second.clock.dayProgress<1e-8);
  assert.equal(advanceCityClock(second.city,second.clock,0).clock,second.clock);
  assert.equal(advanceCityClock(second.city,second.clock,0).city,second.city);
  const switched={...clock,dayProgress:.5,daySeconds:300 as const};assert.equal(clockLabel(switched),'12:00');
  const later=run(city,switched,30);assert.ok(Math.abs(later.clock.dayProgress-.6)<1e-8);
  assert.equal(tick(factory(),'day').production!.queues['2,1'][0].remaining,recipes.wood.seconds,'calendar ticks never manufacture goods');
});
test('fractional clock persistence resumes without losing work, while old production saves migrate once',()=>{
  const city=factory(),a=run(city,emptyClock(),1.3),saved=decodeClock(JSON.parse(JSON.stringify(a.clock)));
  assert.deepEqual(saved,a.clock);const b=run(decodeCity(JSON.parse(JSON.stringify(a.city))),saved,2.7);assert.equal(b.city.production!.queues['2,1'][0].remaining,0);
  const old={...city,production:{...city.production!,timing:undefined,queues:{'2,1':[{id:1,material:'wood',remaining:1}]}}};
  const migrated=decodeCity(old);assert.equal(migrated.production!.queues['2,1'][0].remaining,2);assert.deepEqual(decodeCity(migrated),migrated);
  for(const value of [null,{}, {...saved,daySeconds:2},{...saved,dayProgress:1},{...saved,workSeconds:-1}])assert.throws(()=>decodeClock(value));
});
