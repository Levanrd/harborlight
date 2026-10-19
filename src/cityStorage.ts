import {MASTERPLAN_SLOT,legacySlots} from './citySession';
import {createMasterplan} from './masterplan';
import type {City} from './simulation';
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
  const r=indexedDB.open('harborlight-city',2);
  r.onupgradeneeded=()=>{for(const name of ['saves','archives'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};
  r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);
  r.onblocked=()=>reject(Error('Close other Harborlight tabs, then reload to finish updating storage.'));
});}
/** Archive and remove retired active saves atomically; keep exactly one playable city. */
export async function loadMasterplan():Promise<City>{
  const db=await open();try{return await new Promise<City>((resolve,reject)=>{
    const tx=db.transaction(['saves','archives'],'readwrite'),saves=tx.objectStore('saves'),archives=tx.objectStore('archives');let city:City;
    const r=saves.get(MASTERPLAN_SLOT);r.onsuccess=()=>{
      city=r.result||createMasterplan();
      for(const slot of legacySlots){const old=saves.get(slot);old.onsuccess=()=>{if(old.result!==undefined){archives.put({city:old.result,slot,archivedAt:new Date().toISOString()},'retired-'+slot);saves.delete(slot);}};}
      if(!r.result)saves.put(city,MASTERPLAN_SLOT);
    };
    tx.oncomplete=()=>resolve(city);tx.onabort=()=>reject(tx.error||Error('City migration failed.'));
  });}finally{db.close();}
}
export async function writeMasterplan(city:City,archivePrevious=false){const db=await open();try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(['saves','archives'],'readwrite'),saves=tx.objectStore('saves');
  if(archivePrevious){const r=saves.get(MASTERPLAN_SLOT);r.onsuccess=()=>{if(r.result)tx.objectStore('archives').put({city:r.result,slot:MASTERPLAN_SLOT,archivedAt:new Date().toISOString()},'before-reset-'+Date.now());saves.put(city,MASTERPLAN_SLOT);};}else saves.put(city,MASTERPLAN_SLOT);
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error('Could not save city.'));
});}finally{db.close();}}
export async function archivedCities(){const db=await open();try{return await new Promise<unknown[]>((resolve,reject)=>{const r=db.transaction('archives').objectStore('archives').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function storageSummary(){const db=await open();try{return await new Promise<{active:number;archived:number}>((resolve,reject)=>{const tx=db.transaction(['saves','archives']),a=tx.objectStore('saves').count(),b=tx.objectStore('archives').count();tx.oncomplete=()=>resolve({active:a.result,archived:b.result});tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
