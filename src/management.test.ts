import {constructionSecond} from './upgradeConstruction';
import {unlockedCity as createCity} from './testCity';
import {emptyProduction} from './production';
import {upgradeHome} from './simulation';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build,metrics,tick,roadPath,decodeCity,constructionChange,undoConstruction,type City,type Kind} from './simulation';

function place(c:City,kind:Kind,x:number,z:number){const r=build(c,kind,[{x,z}]);assert.equal(r.ok,true,r.message);return r.city;}
function street(){return build(createCity(false),'road',roadPath({x:-10,z:0},{x:10,z:0})).city;}
function developed(c:City,x:number,z:number,occupancy=12){const k=`${x},${z}`;return {...c,cells:{...c.cells,[k]:{...c.cells[k],age:50,occupancy}}};}

test('separate facilities are all required; isolated spare capacity cannot serve another network',()=>{
  let c=street();c=place(c,'power',-5,1);c=place(c,'water',-4,1);c=place(c,'residential',0,1);
  assert.equal(metrics(c).lots['0,1'].supplied,false);
  c=place(c,'sewage',-3,1);assert.equal(metrics(c).lots['0,1'].supplied,true);
  c=build(c,'road',roadPath({x:-10,z:5},{x:10,z:5})).city;c=place(c,'utility',-5,6);
  c=build(c,'bulldoze',[{x:-3,z:1}]).city;
  assert.equal(metrics(c).resources.capacity.sewage,500);
  assert.equal(metrics(c).lots['0,1'].supplied,false);
});

test('industrial loads can exhaust power while water and sewage still have room',()=>{
  let c=street();c=place(c,'utility',-10,1);
  for(let x=-9;x<3;x++){c=place(c,'industrial',x,1);c=developed(c,x,1,24);}
  const m=metrics(c);assert.equal(m.resources.usage.power,576);assert.equal(m.resources.usage.water,432);
  assert.equal(m.lots['0,1'].supplied,false);c=place(c,'power',3,1);assert.equal(metrics(c).lots['0,1'].supplied,true);
});

test('school reach follows road distance, and removal of a road interrupts coverage',()=>{
  let c=street();c=place(c,'utility',-10,1);c=place(c,'school',-9,1);c=place(c,'residential',-3,1);c=place(c,'residential',8,1);
  assert.equal(metrics(c).lots['-3,1'].coverage.school,true);assert.equal(metrics(c).lots['8,1'].coverage.school,false);
  c=build(c,'bulldoze',[{x:-5,z:0}]).city;assert.equal(metrics(c).lots['-3,1'].coverage.school,false);
});

test('industry lowers nearby land value; parks reduce pollution; clinics improve health',()=>{
  let c=street();c=place(c,'utility',-10,1);c=place(c,'residential',0,1);c=developed(c,0,1);
  const clean=metrics(c);c=place(c,'industrial',1,1);c=developed(c,1,1,32);
  const dirty=metrics(c);assert.ok(dirty.pollution>clean.pollution);assert.ok(dirty.lots['0,1'].landValue<clean.lots['0,1'].landValue);
  c=place(c,'park',0,-1);const green=metrics(c);assert.ok(green.pollution<dirty.pollution);
  c=place(c,'clinic',-1,1);assert.ok(metrics(c).health>green.health);assert.equal(metrics(c).coverage.clinic,100);
});

test('low commercial demand stops construction and resident growth brings it back',()=>{
  let c=street();c=place(c,'utility',-10,1);
  for(let x=-9;x<1;x++)c=place(c,'commercial',x,1);
  assert.equal(metrics(c).demand.commercial,0);let next=tick(c);assert.equal(next.cells['0,1'].age,0);
  for(let x=1;x<9;x++){c=place(c,'residential',x,1);c=developed(c,x,1,24);}
  assert.ok(metrics(c).demand.commercial>=15);next=tick(c);assert.equal(next.cells['0,1'].age,1);
});

test('level 3 homes require schools and enough land value',()=>{
  let c=street();c=place(c,'utility',-10,1);c=place(c,'residential',0,1);c=developed(c,0,1,24);
  c={...c,cells:{...c.cells,'0,1':{...c.cells['0,1'],age:100,level:2}}};
  c=place(c,'clinic',-1,1);c=place(c,'fire',1,1);c=place(c,'park',0,-1);
  c={...c,production:{...emptyProduction(),inventory:{wood:0,metal:0,stone:0,planks:4,nails:4,bricks:4}}};
  assert.equal(upgradeHome(c,'0,1').city,c);c=place(c,'school',-2,1);assert.equal(tick(c).cells['0,1'].level,2);c=upgradeHome(c,'0,1').city;assert.equal(c.cells['0,1'].level,2);for(let i=0;i<35;i++)c=constructionSecond(c,new Set(['0,1']));assert.equal(c.cells['0,1'].level,3);
});

test('construction undo preserves elapsed days, tax edits, revenue, and unrelated development',()=>{
  let c=street();c=place(c,'utility',-10,1);c=place(c,'residential',0,1);const built=place(c,'park',1,1),change=constructionChange(c,built);
  let later=built;for(let i=0;i<10;i++)later=tick(later);later={...later,tax:12};
  const undone=undoConstruction(later,change);assert.equal(undone.day,later.day);assert.equal(undone.tax,12);assert.equal(undone.money,later.money+500);assert.deepEqual(undone.cells['0,1'],later.cells['0,1']);assert.equal(undone.cells['1,1'],undefined);
});

test('old saves and new facilities round-trip; malformed imports are rejected',()=>{
  const old=place(street(),'utility',0,1);assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(old))),old);
  const current=place(old,'clinic',1,1);assert.deepEqual(decodeCity(JSON.parse(JSON.stringify(current))),current);
  assert.throws(()=>decodeCity({...old,tax:100}));assert.throws(()=>decodeCity({...old,cells:{'0,1':{...old.cells['0,1'],occupancy:NaN}}}));
  assert.throws(()=>decodeCity({...old,cells:{bad:old.cells['0,1']}}));
});
