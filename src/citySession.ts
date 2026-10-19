/** Every bookmark opens the one active test city. */
export const MASTERPLAN_SLOT='masterplan-v1';
export const legacySlots=['current','showcase-v1','coastal-v1'] as const;
export function citySaveSlot(_search:string){return MASTERPLAN_SLOT;}
