import {test} from 'node:test';
import assert from 'node:assert/strict';
import {streetLampSites,signalSites} from './streetFurniture';
import type {Cell} from './simulation';

test('lamp and signal posts stay in their sidewalk parcels for every road connection',()=>{
  for(const avenue of [false,true])for(const x of [-6,0,6])for(let mask=0;mask<16;mask++){
    const c:Cell={x,z:0,kind:'road',level:1,age:3,occupancy:0,avenue},links=[1,2,4,8].map(n=>!!(mask&n)),edge=avenue?3.55:3.15;
    const signals=signalSites(c,links);
    assert.equal(signals.length,links.filter(Boolean).length>=3?links.filter(Boolean).length:0);
    for(const p of [...signals,...streetLampSites(c,links)]){
      const px=Math.abs(p.x-x*8),pz=Math.abs(p.z);
      assert.ok(px+.15<=4&&pz+.15<=4,'post footing must not overlap adjacent lots');
      assert.ok(px-.15>=edge||pz-.15>=edge,'post footing must be outside vehicle lanes');
    }
    for(const s of signals){assert.ok(links[s.dx<0?0:s.dx>0?1:s.dz<0?2:3]);}
  }
});
