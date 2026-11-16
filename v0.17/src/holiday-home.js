import * as T from '../vendor/three.module.js';
import { GROUND, localPoint, bounds } from './world.js';

// Original geometry inspired by the Esmark exterior photograph 467658.
// Openings, scale and placement are approximations, not surveyed architecture.
export function holidayMaterials(mats) {
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
 c.fillStyle='#667077';c.fillRect(0,0,256,256);
 for(let y=0;y<256;y+=16){c.fillStyle=y%32?'#626c73':'#707980';c.fillRect(0,y,256,14);c.fillStyle='#20282d';c.fillRect(0,y+14,256,2);}
 for(let i=0;i<1600;i++){const x=(Math.sin(i*17.1)*.5+.5)*256,y=(Math.sin(i*7.9)*.5+.5)*256;c.fillStyle=i%2?'#ffffff08':'#0000000a';c.fillRect(x,y,5,.5);}
 const map=new T.CanvasTexture(canvas);map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;
 return {...mats,wood:new T.MeshStandardMaterial({color:0x67717a,map,roughness:.92,side:T.DoubleSide}),trim:new T.MeshStandardMaterial({color:0x353d43,roughness:.72})};
}
export function refineHolidayHome(b,root,oldShell,cap,detail,mats,Batch) {
 const f=b.frame,w=f.width/2,l=f.length/2,trim=new Batch(),glass=new Batch(),paving=new Batch(),white=new Batch(),metal=new Batch();
 const matGlass=new T.MeshStandardMaterial({color:0x54757d,roughness:.12,metalness:.05,transparent:true,opacity:.55,depthWrite:false});
 const walls=[];
 const wallOpenings=[];
 for(let i=0;i<b.points.length;i++){
  const a=b.points[i],d=b.points[(i+1)%b.points.length],dx=d.x-a.x,dz=d.z-a.z,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
  const au=(a.x-f.center.x)*f.u.x+(a.z-f.center.z)*f.u.z,av=(a.x-f.center.x)*f.v.x+(a.z-f.center.z)*f.v.z;
  const du=(d.x-f.center.x)*f.u.x+(d.z-f.center.z)*f.u.z,dv=(d.x-f.center.x)*f.v.x+(d.z-f.center.z)*f.v.z;
  const front=Math.abs((au+du)/2-w)<.2,gable=Math.abs((av+dv)/2-l)<.2;
  const openings=front?[...[-l+1.2,-l+2.65,-l+4.1].map(v=>({center:v,width:1.35,height:2.08,base:.19})),{center:l-2.1,width:.95,height:2.15,base:.04}]:gable?[{center:.3,width:2.4,height:2.08,base:.19}]:[];
  const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(len,0);shape.lineTo(len,b.height);
  if(gable||Math.abs((av+dv)/2+l)<.2)shape.lineTo(len/2,b.height+b.rise);
  shape.lineTo(0,b.height);shape.closePath();
  for(const opening of openings){
   const center=front?(opening.center-av)/(dv-av)*len:(opening.center-au)/(du-au)*len;
   const half=opening.width/2;if(center-half<.15||center+half>len-.15)continue;
   const hole=new T.Path();hole.moveTo(center-half,opening.base);hole.lineTo(center-half,opening.base+opening.height);hole.lineTo(center+half,opening.base+opening.height);hole.lineTo(center+half,opening.base);hole.closePath();shape.holes.push(hole);
   const u=front?w:opening.center,v=front?opening.center:l,pt=localPoint(f,u,v),normal=front?f.u:f.v,rotation=-Math.atan2(uz,ux),px=pt.x-f.center.x,pz=pt.z-f.center.z;
   const y=opening.base+opening.height/2;
   glass.box(px-normal.x*.07,y,pz-normal.z*.07,opening.width,opening.height,.025,rotation);
   for(const side of[-1,1]){trim.box(px+ux*side*half,y,pz+uz*side*half,.065,opening.height+.09,.14,rotation);trim.box(px,y+side*opening.height/2,pz,opening.width+.08,.065,.14,rotation);}
   if(opening.width>1.1)trim.box(px,y,pz,.05,opening.height,.12,rotation);
   // Neutral interior backing and narrow curtains make the real recess visible.
   white.box(px-normal.x*.22+ux*opening.width*.39,y,pz-normal.z*.22+uz*opening.width*.39,opening.width*.15,opening.height,.025,rotation);
   wallOpenings.push({front,gable,center,width:opening.width});
  }
  const g=new T.ShapeGeometry(shape),positions=g.attributes.position,uv=g.attributes.uv;
  for(let j=0;j<positions.count;j++){const along=positions.getX(j),height=positions.getY(j);positions.setXYZ(j,a.x-f.center.x+ux*along,height,a.z-f.center.z+uz*along);uv.setXY(j,along/1.1,height/3);}
  g.computeVertexNormals();const mesh=new T.Mesh(g,mats.wood);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);walls.push(mesh);
 }
 root.remove(oldShell);oldShell.geometry.dispose();
 // A low-key interior, not a reconstruction of the rental's room plan.
 const roomMat=new T.MeshStandardMaterial({color:0x514f49,roughness:.95,side:T.DoubleSide});
 const floor=new T.Mesh(new T.PlaneGeometry(f.width-.2,f.length-.2),roomMat);floor.rotation.x=-Math.PI/2;floor.rotation.z=-Math.atan2(f.u.z,f.u.x);floor.position.y=.1;root.add(floor);
 const back=new T.Mesh(new T.BoxGeometry(f.width-.3,b.height-.2,.08),roomMat);back.position.y=b.height/2;back.position.x=-f.v.x*(l-.2);back.position.z=-f.v.z*(l-.2);back.rotation.y=Math.atan2(f.v.x,f.v.z);root.add(back);
 // Gutters, downpipe and a modest roof overhang follow the footprint axes.
 const cp=cap.geometry.attributes.position;
 for(let i=0;i<cp.count;i++){const x=cp.getX(i),z=cp.getZ(i),u=x*f.u.x+z*f.u.z,v=x*f.v.x+z*f.v.z;cp.setX(i,x+Math.sign(u)*f.u.x*.16+Math.sign(v)*f.v.x*.16);cp.setZ(i,z+Math.sign(u)*f.u.z*.16+Math.sign(v)*f.v.z*.16);}cp.needsUpdate=true;cap.geometry.computeVertexNormals();
 const tube=(points,r,batch)=>{const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));batch.add(new T.TubeGeometry(curve,Math.max(1,points.length*2),r,7,false));};
 for(const side of[-1,1]){const a=localPoint(f,side*(w+.16),-l-.14),z=localPoint(f,side*(w+.16),l+.14);tube([[a.x-f.center.x,b.height-.08,a.z-f.center.z],[z.x-f.center.x,b.height-.08,z.z-f.center.z]],.045,metal);tube([[z.x-f.center.x,b.height-.08,z.z-f.center.z],[z.x-f.center.x,.1,z.z-f.center.z]],.035,metal);}
 // Satellite dish visible high on the gable in the source photo.
 const dish=new T.Mesh(new T.SphereGeometry(.24,20,12,0,Math.PI*2,0,Math.PI/2),new T.MeshStandardMaterial({color:0x858f94,roughness:.55,side:T.DoubleSide}));const dp=localPoint(f,.2,l+.13);dish.position.set(dp.x-f.center.x,b.height+b.rise*.6,dp.z-f.center.z);dish.rotation.x=Math.PI/2;root.add(dish);
 // Approximate terrace paving: all additions remain inside this small facade strip.
 const terraceCenter=localPoint(f,w+1.25,0),angle=Math.atan2(f.u.x,f.u.z);
 paving.box(terraceCenter.x-f.center.x,-.025,terraceCenter.z-f.center.z,f.length+.8,.09,2.4,-Math.atan2(f.v.z,f.v.x));
 for(let i=0;i<8;i++){const p=localPoint(f,w+.05,-l+.35+i*(f.length-.7)/7);metal.box(p.x-f.center.x,b.height*.83,p.z-f.center.z,.025,.025,.025);}
 // White bench, table and four chairs. Geometry belongs to the LOD detail group.
 const furnishings=new T.Group();furnishings.rotation.y=angle; // local x = long facade, local z = outward
 furnishings.position.set(terraceCenter.x-f.center.x,0,terraceCenter.z-f.center.z);
 const add=(geom,mat,x,y,z,rx=0)=>{const m=new T.Mesh(geom,mat);m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=m.receiveShadow=true;furnishings.add(m);return m;};
 const seatMat=new T.MeshStandardMaterial({color:0xe6e5d9,roughness:.8}),chairMat=new T.MeshStandardMaterial({color:0x343c3e,roughness:.65,side:T.DoubleSide});
 for(let j=0;j<5;j++)add(new T.BoxGeometry(1.5,.055,.075),seatMat,-.5,.46,-.78+j*.09);
 for(const y of[.59,.92])add(new T.BoxGeometry(1.5,.045,.045),seatMat,-.5,y,-.81);
 for(const x of[-1.22,-.5,.22])add(new T.BoxGeometry(.035,.4,.045),seatMat,x,.74,-.81);
 for(const x of[-.86,-.14])for(const sign of[-1,1]){const m=add(new T.BoxGeometry(.035,.72,.035),seatMat,x,.75,-.81);m.rotation.z=sign*1.1;}
 for(const x of[-1.1,.1])for(const z of[-.77,-.43])add(new T.CylinderGeometry(.025,.025,.43,8),seatMat,x,.22,z);
 add(new T.CylinderGeometry(.48,.48,.05,28),chairMat,2.5,.75,.15);add(new T.CylinderGeometry(.06,.1,.72,10),chairMat,2.5,.36,.15);
 for(let i=0;i<4;i++){const a=i*Math.PI/2,x=2.5+Math.cos(a)*.8,z=.15+Math.sin(a)*.8;add(new T.BoxGeometry(.4,.06,.4),chairMat,x,.43,z);const back=add(new T.CylinderGeometry(.24,.22,.32,20,1,true,-Math.PI/2,Math.PI),chairMat,x,.65,z);back.rotation.y=a;for(const dx of[-.15,.15])for(const dz of[-.15,.15])add(new T.CylinderGeometry(.015,.015,.4,6),chairMat,x+dx,.2,z+dz);}
 // Merge the many small rails and chair legs into two material draw calls.
 const furnitureBatches=new Map();for(const child of [...furnishings.children]){child.updateMatrix();if(!furnitureBatches.has(child.material))furnitureBatches.set(child.material,new Batch());furnitureBatches.get(child.material).add(child.geometry,child.matrix);furnishings.remove(child);}
 for(const [material,batch]of furnitureBatches){const mesh=batch.mesh(material);mesh.castShadow=mesh.receiveShadow=true;furnishings.add(mesh);}
 detail.add(furnishings);
 for(const [batch,material]of[[trim,mats.trim],[glass,matGlass],[paving,new T.MeshStandardMaterial({color:0xb6ad96,roughness:.95})],[white,seatMat],[metal,mats.trim]]){const mesh=batch.mesh(material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);if(batch===glass)root.userData.cameraOccluders=[mesh];}
 root.userData.reference='Esmark i6582, photo 467658; arrangement approximated';root.userData.openings=wallOpenings;
 // A facade wall mesh continues to participate in camera occlusion checks.
 const merged=new Batch();for(const wall of walls){root.remove(wall);merged.add(wall.geometry);}const shell=merged.mesh(mats.wood);shell.castShadow=shell.receiveShadow=true;root.add(shell);
 root.updateMatrixWorld(true);root.userData.obstacles=[];
 for(const [x,z,ww,dd,id]of[[-.5,-.6,1.6,.6,'bench'],[2.5,.15,2.4,2.4,'table-and-chairs']]){const points=[[-ww/2,-dd/2],[ww/2,-dd/2],[ww/2,dd/2],[-ww/2,dd/2]].map(([dx,dz])=>{const p=furnishings.localToWorld(new T.Vector3(x+dx,0,z+dz));return {x:p.x,z:p.z};});root.userData.obstacles.push({id,points,bounds:bounds(points)});}
 return shell;
}
