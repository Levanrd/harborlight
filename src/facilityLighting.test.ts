import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {facilityLightSites,FacilityLighting} from './facilityLighting';
import {labels,type Cell,type Kind} from './simulation';
import {isRecreation,recreationConfig} from './recreation';
import {isRegional,regionalConfig} from './regional';
import {batchScenery,disposeBatches} from './cityVisuals';

const cell=(kind:Kind):Cell=>({x:2,z:-3,kind,age:10,level:3,occupancy:20});

test('every building and recreation type has dedicated lighting, only once per footprint',()=>{
  for(const kind of Object.keys(labels) as Kind[]){
    const c=cell(kind),sites=facilityLightSites(c);assert.ok(sites.length>=2,kind);
    assert.deepEqual(sites,facilityLightSites(c),'deterministic fixture plan');
    assert.equal(facilityLightSites({...c,recreationRoot:'0,0'}).length,0,'no duplicate footprint lamps');
    for(const s of sites)assert.ok([s.x,s.y,s.z,s.height,s.target.x,s.target.y,s.target.z,s.width,s.depth].every(Number.isFinite));
  }
  for(const coastal of ['resort','beachhouse','beachresidential'] as const)assert.ok(facilityLightSites({...cell('commercial'),coastal}).length>=3);
  assert.deepEqual(facilityLightSites({...cell('park'),kind:'road'}),[]);
});

test('fixtures fit purchased parcels and poles clear pitches, pools and airport movement areas',()=>{
  const lights=new FacilityLighting();
  for(const kind of Object.keys(labels) as Kind[]){
    const c=cell(kind),g=new THREE.Group();lights.beginRebuild();lights.draw(c,g);g.updateMatrixWorld(true);
    const cfg=isRegional(kind)?regionalConfig[kind]:isRecreation(kind)?recreationConfig[kind]:{width:1,depth:1};
    const bounds=new THREE.Box3();g.traverse(o=>{if(o instanceof THREE.Mesh&&!o.userData.lightPool)bounds.union(new THREE.Box3().setFromObject(o));});
    assert.ok(bounds.min.x>=c.x*8-4&&bounds.max.x<=c.x*8+(cfg.width-1)*8+4,kind+' x bounds');
    assert.ok(bounds.min.z>=c.z*8-4&&bounds.max.z<=c.z*8+(cfg.depth-1)*8+4,kind+' z bounds');
  }
  for(const s of facilityLightSites({...cell('sports'),x:0,z:0}))assert.ok(Math.abs(s.x-8)>10.7&&Math.abs(s.z-4)>5.4,'soccer towers sit outside touchlines');
  for(const s of facilityLightSites({...cell('waterpark'),x:0,z:0}).filter(s=>s.kind==='lantern')){
    assert.ok(Math.abs(s.x-9)>5.9||Math.abs(s.z-4)>4.5,'deck posts stay outside the lap pool');
    assert.ok(Math.hypot(s.x-1,s.z-8)>2.4,'deck posts clear the shallow pool rim');
  }
  for(const s of facilityLightSites({...cell('airport'),x:0,z:0}).filter(s=>s.kind!=='marker'))assert.ok(s.z-12<5,'tall airport fixtures stay clear of runway');
  lights.dispose();
});

test('night fixtures and pools fade out by day, batch at a fixed cost, and reset their light sources',()=>{
  const lights=new FacilityLighting(),g=new THREE.Group();lights.draw(cell('sports'),g);assert.equal(lights.sources.length,4);
  lights.update(1);const bulb=g.getObjectByName('Floodlight lens') as THREE.Mesh,material=bulb.material as THREE.MeshStandardMaterial;
  assert.ok(material.emissiveIntensity>3);
  const pool=g.getObjectByName('Light pool') as THREE.Mesh;assert.ok((pool.material as THREE.MeshBasicMaterial).opacity>0);
  lights.update(0);assert.equal(material.emissiveIntensity,0);assert.equal((pool.material as THREE.MeshBasicMaterial).opacity,0);
  batchScenery(g);const one=g.children.length;disposeBatches(g);lights.beginRebuild();assert.equal(lights.sources.length,0);
  for(let x=0;x<20;x++)lights.draw({...cell('sports'),x:x*4},g);batchScenery(g);
  assert.equal(g.children.length,one,'fixture draw calls do not grow with facility count');
  assert.equal(lights.sources.length,80);disposeBatches(g);lights.dispose();
});
