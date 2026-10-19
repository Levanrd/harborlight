// Shared map geometry has no simulation dependencies, so placement modules can
// use it without introducing module-initialization cycles in the browser.
export const key=(x:number,z:number)=>`${x},${z}`;
export const neighbors=(x:number,z:number)=>[[x-1,z],[x+1,z],[x,z-1],[x,z+1]];
export const waterEdge=(z:number)=>106+Math.sin(z/43)*15;
export const validLand=(x:number,z:number)=>Number.isInteger(x)&&Number.isInteger(z)&&Math.abs(x)<=19&&Math.abs(z)<=19&&x*8<waterEdge(z*8)-9;
