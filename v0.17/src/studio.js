import * as T from '../vendor/three.module.js';
import { loadCharacter, CHARACTER_INFO } from './characters.js';
import { coastalEnvironment } from './lighting.js';
const $ = s => document.querySelector(s), scene = new T.Scene();
scene.background = new T.Color(0x32433f); scene.fog = new T.Fog(0x32433f, 8, 26);
const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; $('#stage').append(renderer.domElement);
const camera = new T.PerspectiveCamera(36, innerWidth / innerHeight, .03, 60);
coastalEnvironment(renderer, scene, false);
scene.add(new T.HemisphereLight(0xe7f0f3, 0x777057, 1.25));
const sun = new T.DirectionalLight(0xffe4c0, 2.8); sun.position.set(-3, 5, 4); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.normalBias = .012; scene.add(sun);
const rim = new T.DirectionalLight(0xa4c5db, 1.2); rim.position.set(3, 3, -3); scene.add(rim);
const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ color: 0x586554, roughness: .95 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.003; floor.receiveShadow = true; scene.add(floor);
const ring = new T.Mesh(new T.RingGeometry(.69, .70, 80), new T.MeshBasicMaterial({ color: 0xa59e7a, transparent: true, opacity: .32 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .003; scene.add(ring);
const loaded = new Map(); let avatar, current = 'simon', yaw = .35, pitch = .08, distance = 4.3, focus = .94, walking = false, turning = false, last = performance.now(), request = 0;
let fingers = new Map(), pinch = 0;
function view(face = false) {
  const h = CHARACTER_INFO[current].height; focus = face ? h * .89 : h * .51; distance = face ? h * .59 : h * (innerWidth < 760 ? 2.65 : 2.22); pitch = face ? 0 : .07;
}
async function select(id) {
  const token = ++request; current = id; $('#status').textContent = 'Figurenmodell wird geladen …';
  try {
    if (!loaded.has(id)) loaded.set(id, await loadCharacter(id));
    if (token !== request) return;
    if (avatar) scene.remove(avatar); avatar = loaded.get(id); scene.add(avatar); view();
    const info = CHARACTER_INFO[id]; $('#name').textContent = info.name; $('#outfit').textContent = info.outfit; $('#height').textContent = `${info.height.toFixed(2).replace('.', ',')} m`;
    $('#status').textContent = 'GLB-Modell · Skelettanimation · Entwurf nach Charakterkarte';
    for (const b of document.querySelectorAll('[data-character]')) b.setAttribute('aria-pressed', String(b.dataset.character === id));
    if (new URLSearchParams(location.search).has('test')) window.__studio = { scene, camera, renderer, loaded, get avatar() { return avatar; }, state: () => ({ current, walking, turning, yaw, distance, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }) };
  } catch (e) { console.error(e); $('#status').textContent = 'Das Figurenmodell konnte nicht geladen werden. Bitte erneut versuchen.'; }
}
for (const button of document.querySelectorAll('[data-character]')) button.onclick = () => select(button.dataset.character);
$('#full').onclick = () => view(); $('#face').onclick = () => view(true);
$('#walk').onclick = () => { walking = !walking; $('#walk').setAttribute('aria-pressed', String(walking)); };
$('#turn').onclick = () => { turning = !turning; $('#turn').setAttribute('aria-pressed', String(turning)); };
const canvas = renderer.domElement;
const baseline = () => { const [a, b] = [...fingers.values()]; pinch = fingers.size === 2 ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return; e.preventDefault(); canvas.setPointerCapture(e.pointerId); fingers.set(e.pointerId, { x: e.clientX, y: e.clientY }); baseline(); });
canvas.addEventListener('pointermove', e => { if (!fingers.has(e.pointerId)) return; const old = fingers.get(e.pointerId); fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fingers.size === 1) { yaw -= (e.clientX - old.x) * .009; pitch = T.MathUtils.clamp(pitch + (e.clientY - old.y) * .003, -.25, .55); }
  else if (fingers.size === 2) { const [a, b] = [...fingers.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0) distance = T.MathUtils.clamp(distance * pinch / Math.max(10, d), .45, 7); pinch = d; }
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, e => { fingers.delete(e.pointerId); baseline(); });
canvas.addEventListener('wheel', e => { e.preventDefault(); distance = T.MathUtils.clamp(distance * Math.exp(e.deltaY * .001), .45, 7); }, { passive: false });
addEventListener('blur', () => { fingers.clear(); pinch = 0; last = performance.now(); });
function frame(now) { requestAnimationFrame(frame); const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now;
  if (turning) yaw += dt * .3; if (avatar) avatar.userData.update(dt, walking ? 1 : 0);
  camera.position.set(Math.sin(yaw) * Math.cos(pitch) * distance, focus + Math.sin(pitch) * distance, Math.cos(yaw) * Math.cos(pitch) * distance); camera.lookAt(0, focus, 0); renderer.render(scene, camera);
}
requestAnimationFrame(frame); select('simon');
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
