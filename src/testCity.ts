import {createCity} from './simulation';

// Service-system tests exercise the complete catalog independently of progression.
// Progression tests use createCity directly and verify the actual unlock sequence.
export function unlockedCity(demo=true,name='Harborlight'){
  const city=createCity(demo,name);
  return {...city,progression:{...city.progression!,xp:1000}};
}
