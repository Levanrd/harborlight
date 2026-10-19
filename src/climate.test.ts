import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {calendarSeason,climateAt,decodeClimate,seasons,weatherKinds} from './climate';
import {createCity,decodeCity,tick} from './simulation';
import {WeatherVisuals} from './WeatherVisuals';
import {physicalSurface} from './naturalVisuals';

test('calendar seasons match the displayed city date, including year rollover',()=>{
  assert.equal(calendarSeason(0),'spring');assert.equal(calendarSeason(61),'summer');assert.equal(calendarSeason(153),'autumn');assert.equal(calendarSeason(244),'winter');assert.equal(calendarSeason(275),'winter');assert.equal(calendarSeason(365),'spring');
});
test('automatic forecasts are deterministic, seasonal and stable within a forecast period',()=>{
  const all=new Set<string>();
  for(let day=0;day<1460;day++){
    const a=climateAt(day,21),b=climateAt(day,21);assert.deepEqual(a,b);all.add(a.weather);
    if(a.weather==='snow')assert.equal(a.season,'winter');
    if(day%14!==13&&calendarSeason(day)===calendarSeason(day+1))assert.equal(a.weather,climateAt(day+1,21).weather);
    assert.ok(a.daysToChange>=1&&a.daysToChange<=14);assert.ok(a.fogFar>a.fogNear);
  }
  assert.equal(all.size,6);
});
test('manual previews override the calendar and survive save, import and economy ticks',()=>{
  const base=createCity(false);assert.equal(decodeCity(base).climate,undefined);
  for(const season of seasons)for(const weather of weatherKinds){const city={...base,climate:{season,weather}},loaded=decodeCity(JSON.parse(JSON.stringify(city)));
    assert.deepEqual(loaded.climate,city.climate);assert.deepEqual(tick(loaded).climate,city.climate);
    for(const day of [0,120,250,400]){const state=climateAt(day,21,loaded.climate);assert.equal(state.season,season);assert.equal(state.weather,weather);if(weather==='snow')assert.ok(state.temperature<0);}
  }
  for(const bad of [null,{},'winter',{season:'winter',weather:'hail'},{season:4,weather:'rain'}])assert.throws(()=>decodeClimate(bad));
  assert.throws(()=>decodeCity({...base,climate:{season:'winter',weather:'broken'}}));
});
test('weather particles respect the persisted clock, reduced motion and quality caps',()=>{
  const scene=new THREE.Scene(),visuals=new WeatherVisuals(scene),target=new THREE.Vector3(12,0,16);
  const snow=climateAt(0,21,{season:'winter',weather:'snow'});visuals.update(snow,12,target,false);
  const flakes=scene.children.find(o=>o instanceof THREE.Points) as THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;
  assert.equal(flakes.material.uniforms.clock.value,12);assert.equal(flakes.visible,true);
  visuals.update(snow,12,target,false);assert.equal(flakes.material.uniforms.clock.value,12,'pause does not drift');
  visuals.update(snow,24,target,true);assert.equal(flakes.material.uniforms.clock.value,0);
  for(const [q,count]of [['low',350],['medium',800],['high',1500],['ultra',2000]] as const){visuals.quality(q);assert.equal(flakes.geometry.drawRange.count,count);}
  visuals.update(climateAt(0,21,{season:'summer',weather:'clear'}),24,target,false);assert.equal(flakes.visible,false);assert.equal(visuals.snowCover.value,0);visuals.dispose();assert.equal(scene.children.length,0);
});
test('season surface shader retains physical texture mapping and shared weather uniforms',()=>{
  const visuals=new WeatherVisuals(new THREE.Scene()),material=new THREE.MeshStandardMaterial();physicalSurface(material,2,3);visuals.surface(material,.5);
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <uv_vertex>\n#include <defaultnormal_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>'} as unknown as Parameters<typeof material.onBeforeCompile>[0];
  material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  assert.match(shader.vertexShader,/physicalUv/);assert.match(shader.vertexShader,/climateUp/);assert.match(shader.fragmentShader,/seasonSnow\*0.50/);assert.equal(shader.uniforms.seasonSnow,visuals.snowCover);assert.match(material.customProgramCacheKey(),/physical-surface-2-3-climate-0.5/);visuals.dispose();material.dispose();
});
