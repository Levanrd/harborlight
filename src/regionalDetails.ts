import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {VisualKit} from './cityVisuals';

/** Shared, smoothly shaded transport geometry. Owned by the World, not by each lot. */
export class RegionalDetails {
  private geometries:THREE.BufferGeometry[]=[];
  private materials=new Map<string,THREE.MeshStandardMaterial>();
  private keep<T extends THREE.BufferGeometry>(g:T){this.geometries.push(g);return g;}
  readonly round=this.keep(new RoundedBoxGeometry(1,1,1,3,.08));
  readonly sphere=this.keep(new THREE.SphereGeometry(1,20,12));
  readonly cylinder=this.keep(new THREE.CylinderGeometry(1,1,1,20));
  readonly ring=this.keep(new THREE.TorusGeometry(1,.11,8,24));
  readonly fuselage=this.keep(new THREE.LatheGeometry([
    [-4.3,0],[-4,.1],[-3.3,.27],[-2.6,.42],[-1.5,.48],[1.8,.48],[2.8,.43],[3.5,.28],[4,.08],[4.1,0],
  ].map(([length,r])=>new THREE.Vector2(r,length)),24).rotateZ(-Math.PI/2));
  readonly wing=this.foil([[-1.6,0],[1.2,0],[-1.25,3.65],[-2.05,3.8]],.09);
  readonly tailplane=this.foil([[-3.9,0],[-2.5,0],[-3.5,1.7],[-4.1,1.8]],.07);
  readonly fin=this.foil([[-3.9,0],[-2.4,0],[-3.45,1.75],[-4,1.85]],.1);
  readonly hull=this.loftHull();
  readonly deck=this.deckShape();
  readonly roof=this.keep(new THREE.CylinderGeometry(1,1,1,32,1,false,0,Math.PI).rotateZ(Math.PI/2));
  constructor(private kit:VisualKit){}
  private foil(points:number[][],depth:number){
    const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:2,steps:1});
    g.translate(0,0,-depth/2);return this.keep(g);
  }
  private loftHull(){
    // Frames taper toward a raked bow; the underside narrows to the keel.
    const stations=[[-8,1.55],[-7,2.3],[-4,2.65],[3.8,2.65],[6.3,2.25],[8,1],[8.9,0.08]];
    const positions:number[]=[],indices:number[]=[];
    for(const [z,w] of stations)for(const [sx,y] of [[-.65,-.65],[-1,.1],[-1,1.35],[1,1.35],[1,.1],[.65,-.65]])positions.push(sx*w,y,z);
    for(let i=0;i<stations.length-1;i++)for(let j=0;j<6;j++){const a=i*6+j,b=i*6+(j+1)%6,c=b+6,d=a+6;indices.push(a,b,d,b,c,d);}
    for(let j=1;j<5;j++){indices.push(0,j+1,j);const o=(stations.length-1)*6;indices.push(o,o+j,o+j+1);}
    for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return this.keep(g);
  }
  private deckShape(){
    const s=new THREE.Shape();s.moveTo(-1.55,-8);s.lineTo(-2.3,-7);s.lineTo(-2.65,-4);s.lineTo(-2.65,3.8);s.quadraticCurveTo(-2.4,7,0,8.95);s.quadraticCurveTo(2.4,7,2.65,3.8);s.lineTo(2.65,-4);s.lineTo(2.3,-7);s.lineTo(1.55,-8);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:.14,bevelEnabled:true,bevelSize:.07,bevelThickness:.04,bevelSegments:2});g.rotateX(Math.PI/2);return this.keep(g);
  }
  private material(color:string,metal=false){
    const id=color+metal;if(!this.materials.has(id))this.materials.set(id,new THREE.MeshStandardMaterial({color,roughness:metal?.38:.62,metalness:metal?.5:.06,envMapIntensity:.8}));return this.materials.get(id)!;
  }
  part(g:THREE.Object3D,geo:THREE.BufferGeometry,x:number,y:number,z:number,w:number,h:number,d:number,color:string,metal=false){
    const m=new THREE.Mesh(geo,this.material(color,metal));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=Math.max(w,h,d)>.2;m.receiveShadow=true;g.add(m);return m;
  }
  box(g:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string){return this.part(g,this.round,x,y+h/2,z,w,h,d,color);}
  rod(g:THREE.Object3D,a:number[],b:number[],r:number,color:string){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),mid=start.clone().add(end).multiplyScalar(.5),m=this.part(g,this.cylinder,mid.x,mid.y,mid.z,r,delta.length(),r,color,true);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
  container(g:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string){
    this.box(g,x,y,z,w,h,d,color);
    // Corrugated sides, corner posts, door bars and identification plates.
    for(const side of [-1,1]){for(let k=-d/2+.25;k<d/2;k+=.45)this.box(g,x+side*(w/2+.016),y+.12,z+k,.055,h-.24,.055,color);for(const dx of [-w/2+.09,w/2-.09])this.box(g,x+dx,y+.04,z+side*(d/2+.02),.09,h-.08,.06,'#b4b9b6');for(const dx of [-w*.22,w*.22])this.box(g,x+dx,y+.18,z+side*(d/2+.045),.035,h-.36,.04,'#ced0c7');}
    this.box(g,x+w/2+.06,y+h*.65,z-d*.25,.025,.24,.65,'#dfdfd3');
  }
  aircraft(g:THREE.Group,scale=1){
    const p=new THREE.Group();g.add(p);p.scale.setScalar(scale);p.name='Regional jet';
    this.part(p,this.fuselage,0,1,0,1,1,1,'#eceee9',true);
    for(const side of [-1,1]){
      const w=this.part(p,this.wing,0,.88,0,1,1,1,'#b8c3c7',true);w.rotation.x=side*Math.PI/2;
      const tail=this.part(p,this.tailplane,0,1.12,0,1,1,1,'#638b9a',true);tail.rotation.x=side*Math.PI/2;
      this.rod(p,[-1.93,1.02,side*3.65],[-2.04,1.65,side*3.8],.065,'#527a8d');
      const engine=this.part(p,this.cylinder,-.2,.55,side*1.55,.31,1.35,.31,'#d9dedc',true);engine.rotation.z=Math.PI/2;
      const intake=this.part(p,this.cylinder,.49,.55,side*1.55,.25,.035,.25,'#283841');intake.rotation.z=Math.PI/2;
      const lip=this.part(p,this.ring,.52,.55,side*1.55,.27,.27,.27,'#b8c3c7',true);lip.rotation.y=Math.PI/2;
      this.part(p,this.sphere,.54,.55,side*1.55,.09,.09,.09,'#778a94',true);
      for(let i=0;i<11;i++)this.part(p,this.sphere,-2.3+i*.42,1.12,side*.465,.1,.125,.025,'#243e4a',true);
      this.box(p,-.3,.88,side*.474,5.5,.055,.02,'#528f9d');
      this.box(p,2.35,.72,side*.39,.34,.58,.025,'#d0d7d3');
      const cockpit=this.part(p,this.sphere,3.12,1.19,side*.21,.42,.17,.16,'#243e4a',true);cockpit.rotation.z=-.2;
      const light=this.kit.box(p,-2,1.03,side*3.72,.12,.08,.12,side===1?'#ff6046':'#79d9e5');light.name='Navigation light';
    }
    this.part(p,this.fin,0,1.15,0,1,1,1,'#527a8d',true);
    // Undercarriage, tires and silver hubs are a separate group for retraction.
    const gear=new THREE.Group();gear.name='Landing gear';p.add(gear);
    for(const [x,z] of [[2.45,0],[-.8,-.65],[-.8,.65]]){this.rod(gear,[x,.7,z],[x,.19,z],.055,'#aeb8b8');for(const side of [-1,1]){const wheel=this.part(gear,this.cylinder,x,.18,z+side*.09,.18,.12,.18,'#253039');wheel.rotation.x=Math.PI/2;}}
  }
  ship(g:THREE.Group){
    g.name='Coastal container ship';
    this.part(g,this.hull,0,0,0,1,1,1,'#294757',true);
    this.part(g,this.deck,0,1.39,0,1,1,1,'#b4b8aa');
    // Bridge and accommodation aft, with stepped decks and wraparound glazing.
    this.box(g,0,1.42,-5.3,3.7,2.7,3.2,'#e1e1d5');
    this.box(g,0,4.12,-5.05,4.2,1.15,2.5,'#e6e6da');
    for(const side of [-1,1]){this.box(g,side*2.12,4.42,-5.05,.05,.5,2.2,'#324e5d');for(let z=-6.1;z<-4;z+=.45)this.box(g,side*2.16,4.4,z,.06,.58,.04,'#aab8ba');}
    this.box(g,0,4.42,-3.78,3.9,.5,.04,'#324e5d');for(let x=-1.8;x<=1.8;x+=.6)this.box(g,x,4.4,-3.74,.05,.6,.07,'#d9dfd9');
    this.box(g,0,5.27,-5.05,4.4,.18,2.7,'#d6d9cf');
    for(let row=0;row<2;row++)for(const side of [-1,1])for(const z of [-6.25,-5.5,-4.75])this.box(g,side*1.87,2+row*.85,z,.04,.3,.28,'#324e5d');
    this.box(g,-.8,5.45,-5.7,1.1,1.2,.9,'#b25e47');this.box(g,-.8,6.65,-5.7,1.15,.18,.95,'#293a43');
    this.rod(g,[.8,5.4,-4.8],[.8,7.5,-4.8],.06,'#c1c8c4');this.rod(g,[-.1,7.1,-4.8],[1.7,7.1,-4.8],.045,'#c1c8c4');
    for(const zz of [-1.7,2.05])for(const xx of [-1.2,1.2])for(let layer=0;layer<2;layer++)this.container(g,xx,1.5+layer*1.32,zz,2.15,1.28,3.5,['#8e5543','#577f83','#b09b6a'][Math.abs(Math.round(xx+zz+layer))%3]);
    for(const side of [-1,1]){this.part(g,this.sphere,side*2,2.2,-6.5,.32,.35,1,'#ce7445');for(let z=-7;z<6.1;z+=1.1)this.rod(g,[side*2.45,1.45,z],[side*2.45,2.02,z],.025,'#c6d0cc');this.rod(g,[side*2.45,2.02,-7],[side*2.45,2.02,5.7],.025,'#c6d0cc');for(const z of [-6,6])this.part(g,this.cylinder,side*1.3,1.62,z,.18,.25,.18,'#5b6d70');}
    this.rod(g,[0,1.5,7.5],[0,2.8,7.5],.05,'#c6d0cc');
  }
  airport(g:THREE.Group,x:number,z:number){
    const b=this.kit.box;
    b(g,x,.3,z,47,.18,31,'#aebdb6');
    b(g,x,.5,z+9,44,.05,8,'#647078');
    // Runway edge lines, threshold bars, touchdown blocks and rubber deposits.
    for(const side of [-1,1]){b(g,x,.565,z+9+side*3.65,43,.014,.1,'#f0eee3');for(let dx=-21;dx<=21;dx+=3){b(g,x+dx,.56,z+9+side*3.85,.1,.1,.1,'#fff0b0');}}
    for(let dx=-16;dx<=16;dx+=4)b(g,x+dx,.568,z+9,1.8,.014,.13,'#f0eee3');
    for(const end of [-1,1]){for(const dz of [-2.7,-1.9,-1.1,1.1,1.9,2.7])b(g,x+end*19.6,.57,z+9+dz,2.1,.015,.38,'#f0eee3');for(const dz of [-2,2])b(g,x+end*12,.57,z+9+dz,2,.015,.65,'#f0eee3');for(const dz of [-.6,.6])for(let i=0;i<5;i++)b(g,x+end*(8+i*.45),.57,z+9+dz,4-i*.3,.012,.055,'#343f43');}
    // Parallel taxiway and turnoffs are separated from the runway by a grass strip.
    b(g,x,.5,z+2,43,.04,3.1,'#647078');b(g,x,.555,z+2,42,.012,.09,'#d9b46d');
    for(const dx of [-20,20]){b(g,x+dx,.51,z+5.5,3,.04,7,'#647078');b(g,x+dx,.565,z+5,.1,.013,6,'#d9b46d');for(const dz of [4,4.35])b(g,x+dx,.58,z+dz,2.7,.012,.07,'#d9b46d');}
    b(g,x-4,.51,z-2.1,31,.04,5.1,'#b9c5cb');
    for(const dx of [-11,0,9]){b(g,x+dx,.57,z-2,.09,.012,3.8,'#d9b46d');b(g,x+dx,.57,z-3,3,.012,.09,'#d9b46d');}
    // Multi-bay glazed terminal with a shallow barrel roof, ribs and entrance arcade.
    b(g,x-4,.5,z-9,25,3.5,6.5,'#d9d6c7');
    b(g,x-4,.8,z-5.72,24,2.8,.08,'#578caa');
    b(g,x-4,.8,z-12.28,24,2.8,.08,'#578caa');
    for(let dx=-15;dx<=7;dx+=1.4)for(const side of [-1,1])b(g,x+dx,.6,z-9+side*3.32,.09,3.6,.13,'#b9c5cb');
    this.part(g,this.roof,x-4,4.05,z-9,26,1.4,3.7,'#b7c2c2',true);
    for(let dx=-16;dx<=8;dx+=2){const rib=this.part(g,this.ring,x+dx,4.06,z-9,3.7,1.4,3.7,'#cad2cf',true);rib.rotation.y=Math.PI/2;rib.scale.set(3.7,1.4,.55);}
    for(const dx of [-10,1]){b(g,x+dx,.75,z-4.5,1.25,1.45,2.4,'#b9c5cb');b(g,x+dx,1.15,z-4.5,1.3,.75,2.1,'#578caa');b(g,x+dx,2.2,z-4.5,1.6,.16,2.8,'#d9d6c7');}
    b(g,x-4,3.4,z-13.2,23,.16,1.5,'#d9d6c7');for(let dx=-14;dx<=6;dx+=4)b(g,x+dx,.5,z-13.5,.13,2.9,.13,'#929d9e');
    // Tapered tower shaft, polygonal cab, radio aerial and perimeter service lane.
    const shaft=this.part(g,this.cylinder,x+16,4.4,z-9,1.15,7.8,1.15,'#b9c5cb');shaft.scale.x=.95;
    this.part(g,this.cylinder,x+16,8.45,z-9,2.05,.4,2.05,'#d6dad2');
    this.part(g,this.cylinder,x+16,9.25,z-9,1.85,1.3,1.85,'#324e5d',true);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;this.rod(g,[x+16+Math.cos(a)*1.87,8.6,z-9+Math.sin(a)*1.87],[x+16+Math.cos(a)*1.87,9.9,z-9+Math.sin(a)*1.87],.045,'#c6ceca');}
    this.part(g,this.cylinder,x+16,10,z-9,2.15,.2,2.15,'#d6dad2');this.rod(g,[x+16,10.1,z-9],[x+16,12,z-9],.045,'#b9c5cb');b(g,x+16,12,z-9,.13,.15,.13,'#ff6046');
    for(let dx=-21;dx<22;dx+=2.5){b(g,x+dx,.55,z-14.6,.05,1,.05,'#929d9e');this.rod(g,[x+dx,1.5,z-14.6],[x+Math.min(22,dx+2.5),1.5,z-14.6],.025,'#929d9e');}
    // Keep parked wings outside the returning aircraft's taxi corridor.
    b(g,x-20,.56,z-8,5.8,.012,7.3,'#b9c5cb');
    const parked=new THREE.Group();parked.position.set(x-20,.65,z-8);g.add(parked);this.aircraft(parked,.68);
    this.box(g,x+8,.55,z-2.8,1.7,.65,.9,'#dedbc9');this.box(g,x+8.4,1.2,z-2.8,.65,.5,.8,'#7b9199');
    for(const dx of [7.5,8.5])for(const dz of [-3.3,-2.3])this.part(g,this.sphere,x+dx,.72,z+dz,.2,.2,.12,'#253039');
  }
  seaport(g:THREE.Group,x:number,z:number,dock:number){
    const b=this.kit.box,start=x-11.5,span=dock-start;
    b(g,(start+dock)/2,.25,z,span,.65,23,'#b9c5cb');b(g,dock,.15,z,.65,1.1,23,'#929d9e');
    // Concrete joints, crane rails and marked cargo lanes.
    for(let dx=start+3;dx<dock;dx+=4)b(g,dx,.91,z,.025,.01,22,'#8d9998');
    for(const dz of [-10.5,0,10.5])b(g,(start+dock)/2,.92,z+dz,span-.5,.012,.03,'#8d9998');
    for(const dx of [dock-6,dock-1.8])b(g,dx,.94,z,.12,.06,22,'#425563');
    for(let dz=-10;dz<=10;dz+=2){b(g,dock-.6,.95,z+dz,.45,.015,.9,'#d9b46d');this.box(g,dock+.43,.22,z+dz,.42,.7,.65,'#293a43');}
    for(const dz of [-10,-3,4,10]){this.part(g,this.cylinder,dock-.8,1.1,z+dz,.15,.35,.15,'#425563');this.rod(g,[dock-1.1,1.3,z+dz],[dock-.5,1.3,z+dz],.09,'#425563');}
    // Ribbed warehouse with loading shutters, glazing and sawtooth skylights.
    b(g,x-4,.9,z-5,12,4.1,8.5,'#b6bdb3');b(g,x-4,5,z-5,12.5,.2,9,'#7e9796');
    for(let dx=-9.5;dx<2;dx+=.55)b(g,x+dx,1,z-.72,.055,3.9,.07,'#929d9e');
    for(const dx of [-8,-4,0]){b(g,x+dx,1,z-.64,2.5,2.7,.13,'#425563');for(let y=1.2;y<3.5;y+=.33)b(g,x+dx,y,z-.55,2.4,.04,.04,'#929d9e');b(g,x+dx,.92,z+.1,2.8,.14,1.3,'#d9d6c7');}
    for(const dx of [-8,-4,0]){b(g,x+dx,5.2,z-5,2.4,.55,6,'#d6dad2');const pane=b(g,x+dx,5.75,z-5,2.4,.08,5.5,'#578caa');pane.rotation.z=.16;}
    for(let i=0;i<3;i++)for(let row=0;row<2;row++)this.container(g,x-7+i*3.5,.92+row*1.55,z+6,3,1.5,6.5,['#577f83','#a46548','#89906b'][i]);
    // Two rail-mounted ship-to-shore gantries with trussed booms and cable stays.
    for(const dz of [-7,7]){
      const zz=z+dz;
      for(const dx of [dock-6,dock-1.8])for(const side of [-1,1]){this.box(g,dx,.98,zz+side*1.1,1.1,.55,.9,'#425563');this.rod(g,[dx,1.45,zz+side*1.1],[dx+.4,9.8,zz+side*.8],.18,'#c6a461');}
      for(const side of [-1,1]){
        this.rod(g,[dock-6,2,zz+side],[dock-1.4,8.8,zz+side*.8],.1,'#c6a461');
        for(const y of [9.8,11.1])this.rod(g,[dock-9,y,zz+side*.8],[dock+9,y,zz+side*.8],.12,'#d5b16a');
        for(let dx=-9;dx<9;dx+=2)this.rod(g,[dock+dx,9.8,zz+side*.8],[dock+dx+2,11.1,zz+side*.8],.06,'#c6a461');
        this.rod(g,[dock-3,11,zz+side*.8],[dock-3,15,zz+side*.8],.14,'#c6a461');
        this.rod(g,[dock-3,15,zz+side*.8],[dock+8,11.1,zz+side*.8],.038,'#425563');
        this.rod(g,[dock-3,15,zz+side*.8],[dock-9,11.1,zz+side*.8],.038,'#425563');
        for(const dx of [dock+5.2,dock+6.8])this.rod(g,[dx,10,zz+side*.55],[dx,5.25,zz+side*.55],.035,'#425563');
      }
      for(let dx=-9;dx<=9;dx+=2)this.rod(g,[dock+dx,10.9,zz-.8],[dock+dx,10.9,zz+.8],.065,'#c6a461');
      this.box(g,dock+6,5,zz,2.6,.25,1.5,'#d5b16a');this.box(g,dock+.6,8.4,zz+1.15,1.5,1.5,1.3,'#d6dad2');this.box(g,dock+.6,8.9,zz+1.82,1.3,.7,.03,'#324e5d');
      for(let y=1.5;y<9;y+=.45)this.rod(g,[dock-5.7,y,zz-1.15],[dock-5.1,y,zz-1.15],.035,'#425563');
    }
  }
  dispose(){for(const g of this.geometries)g.dispose();for(const m of this.materials.values())m.dispose();this.materials.clear();}
}
