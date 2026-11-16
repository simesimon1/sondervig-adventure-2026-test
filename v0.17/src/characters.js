import * as T from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { person } from './scenery.js';
import { contactShadow } from './lighting.js';

export const CHARACTER_INFO = {
  simon: { name: 'Simon', height: 1.88, outfit: 'Braune Jacke · gelbes Trikot · Jeans' },
  swantje: { name: 'Swantje', height: 1.87, outfit: 'Cremefarbene Fleecejacke · weite Hose' },
  ida: { name: 'Ida', height: 1.05, outfit: 'Rosa Hoodie · dunkle Leggings · Pferdeschwanz' },
};
const loader = new GLTFLoader();
export async function loadCharacter(id, mats) {
  const info = CHARACTER_INFO[id];
  if (!info) throw new Error(`Unbekannte Figur: ${id}`);
  const root = new T.Group(); root.name = info.name; root.userData.character = id; root.add(contactShadow(info.height * .34, info.height * .25));
  try {
    const asset = await loader.loadAsync(new URL(`../assets/characters/${id}.glb`, import.meta.url).href);
    root.add(asset.scene);
    const mixer = new T.AnimationMixer(asset.scene);
    const actions = Object.fromEntries(asset.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
    if (!actions.Idle || !actions.Walk) throw new Error('Stand- oder Geh-Animation fehlt');
    for (const a of Object.values(actions)) a.play();
    let blend = 0;
    const skinned = [], footSamples = [];
    asset.scene.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true; node.receiveShadow = true;
      // Conservative bounds for all poses: avoid limbs disappearing mid-stride.
      if (node.isSkinnedMesh) {
        node.boundingSphere = new T.Sphere(new T.Vector3(0, info.height * .5, 0), info.height * .85);
        skinned.push(node);
        const positions = node.geometry.attributes.position, indices = [];
        for (let i = 0; i < positions.count; i++) if (positions.getY(i) < info.height * .025) indices.push(i);
        const step = Math.max(1, Math.floor(indices.length / 32));
        for (let i = 0; i < indices.length; i += step) footSamples.push({ node, index: indices[i] });
      }
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) { material.envMapIntensity = .65; if (material.normalMap) material.normalScale.multiplyScalar(.35); if (material.map) material.map.anisotropy = 4; }
    });
    root.userData.update = (dt, movement = 0, speedRatio = 1) => {
      blend = T.MathUtils.damp(blend, T.MathUtils.clamp(movement, 0, 1), 10, dt);
      actions.Idle.setEffectiveWeight(1 - blend);
      actions.Walk.setEffectiveWeight(blend).setEffectiveTimeScale(1.65 * T.MathUtils.clamp(speedRatio, 1, 2.5));
      asset.scene.position.y = 0; mixer.update(dt); root.updateMatrixWorld(true);
      for (const node of skinned) node.skeleton.update();
      // Keep the sampled sole contour in contact with the actor's ground plane.
      // This is local animation grounding, not a terrain-aware leg IK system.
      let floor = Infinity;
      for (const sample of footSamples) {
        const point = new T.Vector3().fromBufferAttribute(sample.node.geometry.attributes.position, sample.index);
        sample.node.applyBoneTransform(sample.index, point); point.applyMatrix4(sample.node.matrixWorld);
        floor = Math.min(floor, point.y - root.position.y);
      }
      if (Number.isFinite(floor)) asset.scene.position.y = -floor;
      root.userData.footCorrection = Number.isFinite(floor) ? -floor : 0;
    };
    root.userData.update(.01, 0);
    root.userData.model = 'glb'; root.userData.mixer = mixer; root.userData.actions = actions;
    root.userData.clipNames = asset.animations.map(c => c.name);
    root.userData.dispose = () => {
      mixer.stopAllAction(); mixer.uncacheRoot(asset.scene);
      asset.scene.traverse(o => { if (!o.isMesh) return; o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const value of Object.values(m)) if (value?.isTexture) value.dispose(); m.dispose();
        }
      });
    };
  } catch (error) {
    if (!mats) throw error;
    console.warn(`Figurenmodell ${info.name} nicht verfügbar; Ersatzfigur aktiv.`, error);
    const fallback = person(mats, { height: info.height, shirt: id === 'ida' ? 0xab6b7d : id === 'swantje' ? 0xc5bba3 : 0xd4af29, longHair: id !== 'simon' });
    root.add(fallback); let time = 0;
    root.userData.update = (dt, movement = 0) => { time += dt * movement; fallback.userData.animate(time, movement); };
    root.userData.model = 'fallback';
  }
  return root;
}
