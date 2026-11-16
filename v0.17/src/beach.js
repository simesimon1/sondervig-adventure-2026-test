import * as T from '../vendor/three.module.js';
import { shoreX } from './coast.js';
export function beachScene(scene) {
 const positions=[],indices=[];for(let j=0;j<=40;j++){const z=-800+j*40,x=shoreX(z);positions.push(x-1400,.03,z,x,.03,z);if(j<40){const i=j*2;indices.push(i,i+2,i+1,i+1,i+2,i+3);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
 const time={value:0},m=new T.MeshStandardMaterial({color:0x4d8e9b,roughness:.35,metalness:.15,side:T.DoubleSide});
 m.onBeforeCompile=s=>{s.uniforms.seaTime=time;s.vertexShader='uniform float seaTime; varying vec2 coastUV;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n coastUV=position.xz; transformed.y+=sin(position.x*.1+seaTime)*.06+sin(position.z*.08+seaTime*.7)*.035;');s.fragmentShader='uniform float seaTime; varying vec2 coastUV;\n'+s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n normal=normalize(normal+vec3(sin(coastUV.x*.8+coastUV.y*.3+seaTime)*.07,cos(coastUV.y*.7-seaTime*.8)*.06,0.));').replace('#include <color_fragment>','#include <color_fragment>\n float ripple=sin(coastUV.x*.34+sin(coastUV.y*.17)+seaTime*.8)*sin(coastUV.y*.41-seaTime*.6); diffuseColor.rgb*=.9+.12*ripple;');};
 const sea=new T.Mesh(g,m);scene.add(sea);
 // Foam is decorative wave detail along the generalized OSM line.
 const fp=[],fi=[];for(let j=0;j<=360;j++){const z=-180+j,x=shoreX(z)+1.2+Math.sin(z*.3)*.5,w=.3+.25*Math.sin(z*.17);fp.push(x-w,.13,z,x+w,.13,z);if(j<360){const i=j*2;fi.push(i,i+2,i+1,i+1,i+2,i+3);}}
 const fg=new T.BufferGeometry();fg.setAttribute('position',new T.Float32BufferAttribute(fp,3));fg.setIndex(fi);const foam=new T.Mesh(fg,new T.MeshBasicMaterial({color:0xe5f0df,transparent:true,opacity:.55,depthWrite:false,side:T.DoubleSide}));scene.add(foam);
 return t=>{time.value=t;foam.position.x=Math.sin(t*.55)*.7;};
}
