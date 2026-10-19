import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createShowcaseCity} from './showcase';
import {sceneSignature} from './sceneSignature';

test('live waste collection does not rebuild static city geometry, but overlays and construction refresh',()=>{
  const city=createShowcaseCity(),changed=structuredClone(city),home=Object.values(changed.cells).find(c=>c.kind==='residential')!,k=`${home.x},${home.z}`;
  changed.waste!.lots[k]=30;
  for(const facility of Object.values(changed.cells).filter(c=>c.kind==='landfill'))changed.waste!.stored[`${facility.x},${facility.z}`]=1200;
  assert.equal(sceneSignature({city,overlay:'none'}),sceneSignature({city:changed,overlay:'none'}));
  assert.notEqual(sceneSignature({city,overlay:'garbage'}),sceneSignature({city:changed,overlay:'garbage'}));
  home.level=home.level===1?2:1;
  assert.notEqual(sceneSignature({city,overlay:'none'}),sceneSignature({city:changed,overlay:'none'}));
});

test('later production slots refresh ready crates without rebuilding for every timer tick',()=>{
  const city=createShowcaseCity(),k=Object.keys(city.cells).find(k=>city.cells[k].kind==='industrial')!;
  city.production={inventory:{wood:0,metal:0,stone:0,planks:0,nails:0,bricks:0},nextId:3,upgrades:0,timing:'seconds',queues:{[k]:[{id:1,material:'bricks',remaining:8},{id:2,material:'wood',remaining:2}]}};
  const changed=structuredClone(city);changed.production!.queues[k][1].remaining=1;
  assert.equal(sceneSignature({city,overlay:'production'}),sceneSignature({city:changed,overlay:'production'}));
  changed.production!.queues[k][1].remaining=0;
  for(const overlay of ['none','production'])assert.notEqual(sceneSignature({city,overlay}),sceneSignature({city:changed,overlay}));
});
