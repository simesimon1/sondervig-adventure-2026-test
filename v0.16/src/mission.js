export function restoreMission(value) {
 if(!value || value.version!==16)return {version:16,stage:'talk',shells:[],position:null};
 const shells=[...new Set(Array.isArray(value.shells)?value.shells.filter(n=>Number.isInteger(n)&&n>=0&&n<3):[])];
 const stage=['talk','walk','collect','return','done'].includes(value.stage)?value.stage:'talk';
 return {version:16,stage:stage==='return'||stage==='done'?(shells.length===3?stage:'collect'):stage,shells,position:value.position&&Number.isFinite(value.position.x)&&Number.isFinite(value.position.z)?value.position:null};
}
export function advance(m,event,id) {
 const n={...m,shells:[...m.shells]};
 if(event==='talk'&&n.stage==='talk')n.stage='walk';
 if(event==='beach'&&n.stage==='walk')n.stage='collect';
 if(event==='shell'&&n.stage==='collect'&&Number.isInteger(id)&&id>=0&&id<3&&!n.shells.includes(id)){n.shells.push(id);if(n.shells.length===3)n.stage='return';}
 if(event==='home'&&n.stage==='return')n.stage='done';return n;
}
export const objective=m=>({talk:'Sprich mit Swantje · E / Aktion',walk:'Folge Harbo Stages Vej zum Strand',collect:`Sammle Muscheln am Strand · ${m.shells.length}/3`,return:'Kehre zum Ferienhaus zurück · E / Aktion',done:'Strandspaziergang abgeschlossen ✓'})[m.stage];
