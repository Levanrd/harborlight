import {createShowcaseCity} from '../src/showcase';
import {metrics} from '../src/simulation';
import {writeFileSync} from 'node:fs';
const c=createShowcaseCity(),m=metrics(c);
writeFileSync('tools/metropolis-fixture.json',JSON.stringify(c,null,2));
console.log(JSON.stringify({lots:Object.keys(c.cells).length,kinds:Object.values(c.cells).reduce((a,c)=>(a[c.kind]=(a[c.kind]||0)+1,a),{} as Record<string,number>),population:m.population,jobs:m.jobs,resources:m.resources,coverage:m.coverage,happiness:m.happiness,net:m.net,alerts:m.alerts,regional:m.regional.facilities.map(f=>({kind:f.kind,status:f.status,daily:f.daily})),routes:c.transit?.routes.length},null,2));
