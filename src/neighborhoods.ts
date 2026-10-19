import {roadSeverity} from './maintenance';
import type {City,LotStatus} from './simulation';
import type {recreationMetrics} from './recreation';
import {crimeLevel} from './police';
import {OVERFLOW} from './waste';
export type Concern={id:string;title:string;text:string;fix:string;severity:number};
export type WellbeingLot={happiness:number;issues:Concern[];district:string};
const clamp=(v:number)=>Math.max(15,Math.min(98,v));
export function districtFor(c:{x:number;z:number;coastal?:string}){return c.coastal||c.x>=7&&c.z<=2?'Seabreeze coast':c.z>=10?'South harbor works':c.z>=3?'Greenbelt':c.x>=0?'Civic center':c.x>=-6?'Garden quarter':'West neighborhoods';}
/** Derived from current conditions: fixing a problem removes it on the next update. */
export function neighborhoodWellbeing(city:City,lots:Record<string,LotStatus>,recreation:ReturnType<typeof recreationMetrics>){
  const result:Record<string,WellbeingLot>={},districts=new Map<string,{name:string;population:number;happiness:number;pollution:number;issues:number}>();
  for(const [key,c]of Object.entries(city.cells)){
    if(c.kind!=='residential'||c.occupancy<=0)continue;
    const lot=lots[key],green=recreation.lots[key]?.happiness||0,garbage=city.waste?.lots[key]||0,crime=crimeLevel(city,key),issues:Concern[]=[];
    const add=(id:string,title:string,text:string,fix:string,severity:number)=>issues.push({id,title,text,fix,severity});
    const access=[[c.x-1,c.z],[c.x+1,c.z],[c.x,c.z-1],[c.x,c.z+1]].map(([x,z])=>`${x},${z}`).filter(k=>city.cells[k]?.kind==='road'),roadProblem=access.length?Math.min(...access.map(k=>roadSeverity(city,k))):0;
    if(roadProblem>=55)add('roads','Our street needs care','Snow or damaged roads are delaying our journeys.','Connect a supplied maintenance depot and fund its crews. Check road-condition priorities.',roadProblem);
    if(!lot.supplied)add('utilities','No utilities','Our home needs reliable power, water and sewage.','Connect the road network and increase any overloaded utility capacity.',100);
    if(lot.pollution>=30)add('pollution','Dirty air','Pollution is making this neighborhood unpleasant.','Separate homes from industry, treatment plants, waste sites and busy regional facilities. Collect nearby garbage.',lot.pollution);
    if(garbage>=OVERFLOW)add('garbage','Bins overflowing','Our rubbish has not been collected.','Check road access, truck availability and storage at an operating waste facility.',75);
    if(crime>=25)add('safety','We feel unsafe','Crime is rising around our home.','Connect an operational police station and let patrol cars reach this neighborhood.',crime+20);
    if(!lot.coverage.clinic)add('health','Need healthcare','A clinic is too far away or is not operating.','Provide a supplied clinic within reach along connected roads.',60);
    if(!lot.coverage.school)add('school','Need a school','Children need access to a nearby school.','Place a supplied school closer to the neighborhood road network.',45);
    if(!lot.coverage.fire)add('fire','Fire protection','We are outside working fire coverage.','Connect a supplied fire station within road-network range.',55);
    if(green<1)add('parks','Somewhere to play','We would like a park or recreation area nearby.','Build a road-accessible park, playground, sports field or coastal water park.',30);
    const happiness=Math.round(clamp(70+(lot.supplied?6:-25)+(lot.coverage.clinic?6:-7)+(lot.coverage.school?5:-5)+(lot.coverage.fire?4:-5)+green-Math.max(0,roadProblem-30)*.2-lot.pollution*.4-Math.min(1,garbage/OVERFLOW)*18-crime*.2-(city.tax-10)*3));
    const district=districtFor(c);result[key]={happiness,issues:issues.sort((a,b)=>b.severity-a.severity),district};
    const d=districts.get(district)||{name:district,population:0,happiness:0,pollution:0,issues:0};d.population+=c.occupancy;d.happiness+=happiness*c.occupancy;d.pollution+=lot.pollution*c.occupancy;d.issues+=issues.length>0?1:0;districts.set(district,d);
  }
  const population=[...districts.values()].reduce((n,d)=>n+d.population,0),happiness=[...districts.values()].reduce((n,d)=>n+d.happiness,0)/Math.max(1,population);
  return {lots:result,happiness:population?happiness:65,districts:[...districts.values()].map(d=>({...d,happiness:Math.round(d.happiness/d.population),pollution:Math.round(d.pollution/d.population)})),complaints:Object.values(result).filter(l=>l.issues.length).length};
}
