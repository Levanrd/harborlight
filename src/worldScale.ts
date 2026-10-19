/** Physical rendering convention. Grid coordinates and saved cities stay unchanged.
 * One 8-unit parcel is 12 metres; all dimensions here are world units. */
export const METRES_PER_UNIT = 1.5;
export const metres = (value:number) => value / METRES_PER_UNIT;
export const STREET_SCALE = { laneOffset: metres(1.8), laneEdge: metres(3.6), doorHeight: metres(2.1), doorWidth: metres(.95), seatHeight: metres(.45) } as const;
export type VehicleKind='car'|'police'|'bus'|'garbage'|'firetruck'|'maintenance'|'ambulance';
export function vehicleDimensions(kind:VehicleKind,id:number){
  const width=kind==='car'?1.8:kind==='police'?1.85:kind==='ambulance'?2.15:2.4;
  // Compact city buses and rigid municipal trucks fit this city's small blocks.
  const length=kind==='car'?[3.8,4.4,4.1,4.8][id%4]:kind==='police'?4.6:kind==='bus'?6.6:kind==='garbage'?6:kind==='ambulance'?5.4:5.7;
  return {width:metres(width),length:metres(length)};
}
export const vehicleGap=(a:{kind:VehicleKind;id:number},b:{kind:VehicleKind;id:number})=>(vehicleDimensions(a.kind,a.id).length+vehicleDimensions(b.kind,b.id).length)/2+metres(1.2);
export const crossingClearance=(v:{kind:VehicleKind;id:number})=>vehicleDimensions(v.kind,v.id).length/2+metres(1.25);

/** Front bumper remains behind the painted stop bar, not the vehicle centre. */
export const signalStopProgress=(v:{kind:VehicleKind;id:number})=>1-(3.7+vehicleDimensions(v.kind,v.id).length/2+.1)/8;
