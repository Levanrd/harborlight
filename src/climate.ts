export const seasons=['spring','summer','autumn','winter'] as const;
export const weatherKinds=['clear','cloudy','rain','storm','fog','snow'] as const;
export type Season=typeof seasons[number];
export type WeatherKind=typeof weatherKinds[number];
export type ClimateSettings={season:'auto'|Season;weather:'auto'|WeatherKind};
export const defaultClimate=():ClimateSettings=>({season:'auto',weather:'auto'});
export const seasonNames:Record<Season,string>={spring:'Spring',summer:'Summer',autumn:'Autumn',winter:'Winter'};
export const weatherNames:Record<WeatherKind,string>={clear:'Clear skies',cloudy:'Overcast',rain:'Rain',storm:'Thunderstorm',fog:'Fog',snow:'Snow'};
export function decodeClimate(value:unknown):ClimateSettings{
  if(value===undefined)return defaultClimate();
  const c=value as ClimateSettings;
  if(!c||!['auto',...seasons].includes(c.season)||!['auto',...weatherKinds].includes(c.weather))throw Error('Invalid season or weather in city backup.');
  return {season:c.season,weather:c.weather};
}
export function calendarSeason(day:number):Season{
  const month=new Date(Date.UTC(2026,3,1+Math.floor(day))).getUTCMonth();
  return month<2||month===11?'winter':month<5?'spring':month<8?'summer':'autumn';
}
const forecasts:Record<Season,WeatherKind[]>={spring:['clear','rain','cloudy','clear','fog','rain','storm','clear'],summer:['clear','clear','cloudy','clear','storm','rain','clear','clear'],autumn:['cloudy','rain','fog','clear','rain','cloudy','storm','clear'],winter:['snow','cloudy','clear','snow','fog','snow','cloudy','clear']};
export function climateAt(day:number,seed=21,settings:ClimateSettings=defaultClimate()){
  const season=settings.season==='auto'?calendarSeason(day):settings.season;
  const period=Math.floor(day/14),hash=(Math.imul(period+17,1103515245)^Math.imul(seed,2654435761))>>>0;
  const weather=settings.weather==='auto'?forecasts[season][hash%8]:settings.weather;
  const cloud={clear:0,cloudy:.65,rain:.8,storm:1,fog:.7,snow:.7}[weather];
  const rain=weather==='storm'?1:weather==='rain'?.65:0,snow=weather==='snow'?1:0;
  return {season,weather,cloud,rain,snow,wetness:rain,wind:weather==='storm'?1:weather==='rain'?.5:.18,
    snowCover:snow?.88:season==='winter'?.3:0,
    fogNear:weather==='fog'?25:weather==='storm'?90:weather==='snow'?110:420,
    fogFar:weather==='fog'?600:weather==='storm'?650:weather==='snow'?650:weather==='rain'?800:1000,
    temperature:weather==='snow'?-3:({spring:16,summer:28,autumn:13,winter:1}[season])-(weather==='rain'||weather==='storm'?4:weather==='fog'?2:0),
    daysToChange:14-((Math.floor(day)%14+14)%14)};
}
export type ClimateState=ReturnType<typeof climateAt>;

/** Gameplay multipliers, shared by road traffic, service fleets and walking trips. */
export function weatherEffects(weather:WeatherKind){
  return {
    clear:{roadSpeed:1,gap:1,outdoor:1,walking:1,indoorStay:1},
    cloudy:{roadSpeed:1,gap:1,outdoor:.9,walking:1,indoorStay:1},
    rain:{roadSpeed:.8,gap:1.18,outdoor:.55,walking:.95,indoorStay:1.7},
    storm:{roadSpeed:.6,gap:1.4,outdoor:.2,walking:.85,indoorStay:2.5},
    fog:{roadSpeed:.7,gap:1.3,outdoor:.65,walking:.9,indoorStay:1.4},
    snow:{roadSpeed:.65,gap:1.35,outdoor:.35,walking:.75,indoorStay:2},
  }[weather];
}
