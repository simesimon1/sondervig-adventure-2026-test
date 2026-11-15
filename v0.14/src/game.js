import * as T from '../vendor/three.module.js';
import { AREA, GROUND, HOME_ID, clamp, inside, makeWorld, SpatialGrid, blocked, moveActor, localPoint, bounds } from './world.js';
import { materials, terrainMesh, roadMeshes, buildingModel, vegetation, person, carModel } from './scenery.js';

const $ = s => document.querySelector(s), scene = new T.Scene();
scene.background = new T.Color(0xbacfd1); scene.fog = new T.Fog(0xbacfd1, 105, 340);
const camera = new T.PerspectiveCamera(53, innerWidth / innerHeight, .1, 700);
let renderer;
try { renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('#status').textContent = 'WebGL konnte nicht starten. Bitte einen Browser mit 3D-Unterstützung verwenden.'; throw e; }
renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
renderer.shadowMap.type = T.PCFSoftShadowMap; $('#game').append(renderer.domElement);
scene.add(new T.HemisphereLight(0xf0f5ed, 0x899078, 2.1));
const sun = new T.DirectionalLight(0xffedce, 2.5); sun.position.set(-45, 70, 35); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -52, right: 52, top: 52, bottom: -52, near: 1, far: 180 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -.0005; sun.shadow.normalBias = .035; scene.add(sun, sun.target);
const mats = materials(), keys = new Set(), pointers = new Map(), joystick = { x: 0, z: 0, id: null };
let world, collisionGrid, player, home, car, family, grass = [], buildingObjects = [], interactables = [], collectibles = [], collected = 0, ready = false;
let yaw = -1.0, pitch = .58, dist = 27, target = new T.Vector3(), oldCenter = null, oldDist = 0, qualityMode = 'auto';
let messageUntil = 0, frameTime = 0, last = performance.now(), lastLod = 0, motionTime = 0;
const touchDevice = matchMedia('(pointer: coarse)').matches;
function quality(mode = qualityMode) {
  qualityMode = mode; const low = mode === 'low' || (mode === 'auto' && touchDevice);
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.15 : 1.6)); renderer.shadowMap.enabled = !low;
  $('#quality').textContent = `Grafik: ${mode === 'auto' ? 'Automatisch' : low ? 'Sparsam' : 'Hoch'}`;
  $('#quality').setAttribute('aria-label', `${$('#quality').textContent}. Antippen zum Wechseln.`);
  return low;
}
quality();
function say(text, ms = 4500) { $('#message').textContent = text; messageUntil = performance.now() + ms; }
function safePoint(wanted, radius = .38, roadClearance = -Infinity) {
  for (let i = 0; i < 300; i++) {
    const r = i === 0 ? 0 : 1 + Math.sqrt(i) * .5, a = i * 2.4, p = { x: wanted.x + Math.cos(a) * r, z: wanted.z + Math.sin(a) * r };
    if (!blocked(p, radius, collisionGrid) && world.clearance(p.x, p.z).road > roadClearance && p.x > AREA.minX + 4 && p.x < AREA.maxX - 4 && p.z > AREA.minZ + 4 && p.z < AREA.maxZ - 4) return p;
  }
  throw Error('Kein freier Startpunkt gefunden.');
}
function resetCamera() { if (!player) return; yaw = -1.0; pitch = .55; dist = 16; target.copy(player.position).y += 1.0; }
$('#reset').onclick = resetCamera;
$('#survey').onclick = () => { if (!home) return; target.set(home.frame.center.x, GROUND, home.frame.center.z); dist = 185; pitch = 1.13; };
$('#plus').onclick = () => dist = Math.max(4, dist * .78);
$('#minus').onclick = () => dist = Math.min(250, dist * 1.28);
$('#quality').onclick = () => quality(qualityMode === 'auto' ? 'low' : qualityMode === 'low' ? 'high' : 'auto');
$('#help').onclick = () => { clearInput(); $('#guide').showModal(); $('#help').setAttribute('aria-expanded', 'true'); };
$('#closeGuide').onclick = () => $('#guide').close();
$('#guide').addEventListener('close', () => { last = performance.now(); $('#help').setAttribute('aria-expanded', 'false'); });

function action() {
  if (!ready || $('#guide').open) return;
  const p = player.position;
  const near = interactables.filter(i => !i.done && Math.hypot(i.x - p.x, i.z - p.z) < i.range).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (near) near.act(); else say('Am Haus, Auto oder bei Swantje kannst du interagieren. Muscheln: näher herangehen und E / Aktion drücken.');
}
$('#action').onclick = action;
function clearInput() {
  keys.clear(); pointers.clear(); oldCenter = null; oldDist = 0; joystick.id = null; joystick.x = joystick.z = 0; $('#stick').style.transform = '';
}
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if ($('#guide').open) return;
  if (['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright',' '].includes(k)) { e.preventDefault(); keys.add(k); }
  if (k === 'e' && !e.repeat) action();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { clearInput(); last = performance.now(); });
const stick = $('#joystick');
function moveStick(e) {
  const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dz = e.clientY - (r.top + r.height / 2), length = Math.hypot(dx, dz), max = r.width * .32, factor = Math.min(1, max / (length || 1));
  joystick.x = length < 6 ? 0 : dx * factor / max; joystick.z = length < 6 ? 0 : dz * factor / max;
  $('#stick').style.transform = `translate(${dx * factor}px, ${dz * factor}px)`;
}
stick.addEventListener('pointerdown', e => { if (joystick.id !== null) return; e.preventDefault(); joystick.id = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === joystick.id) { e.preventDefault(); moveStick(e); } });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(type, e => {
  if (e.pointerId === joystick.id) { joystick.id = null; joystick.x = joystick.z = 0; $('#stick').style.transform = ''; }
});
// Orbit gesture semantics retained from the v0.13 preview. UI pointers never
// enter this map, allowing a joystick thumb and a camera thumb simultaneously.
const canvas = renderer.domElement;
function gestureBaseline() {
  oldCenter = null; oldDist = 0;
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; oldCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; oldDist = Math.hypot(a.x - b.x, a.y - b.y); }
}
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault(); canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); gestureBaseline();
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  e.preventDefault(); const old = pointers.get(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) { yaw -= (e.clientX - old.x) * .007; pitch += (e.clientY - old.y) * .006; }
  else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, dd = Math.hypot(a.x - b.x, a.y - b.y);
    if (oldDist > 0) dist *= oldDist / Math.max(10, dd);
    if (oldCenter) { const dx = cx - oldCenter.x, dy = cy - oldCenter.y, scale = dist * .0015;
      target.x -= Math.cos(yaw) * dx * scale + Math.sin(yaw) * dy * scale; target.z += Math.sin(yaw) * dx * scale - Math.cos(yaw) * dy * scale; }
    oldDist = dd; oldCenter = { x: cx, y: cy };
  }
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, e => { pointers.delete(e.pointerId); gestureBaseline(); });
canvas.addEventListener('wheel', e => { e.preventDefault(); dist = clamp(dist * Math.exp(e.deltaY * .001), 4, 250); }, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());

async function load() {
  try {
    const response = await fetch('./data/sondervig-osm.json'); if (!response.ok) throw Error(`Karte: HTTP ${response.status}`);
    world = makeWorld(await response.json()); home = world.buildings.find(b => b.id === HOME_ID);
    if (!home) throw Error('Startgebäude fehlt im OSM-Snapshot.');
    scene.add(terrainMesh(world, mats)); scene.add(...roadMeshes(world, mats));
    for (const b of world.visibleBuildings) { const model = buildingModel(b, mats); scene.add(model.root); buildingObjects.push({ ...model, b }); }
    grass = vegetation(world, scene); collisionGrid = new SpatialGrid(world.colliders);
    const carPoint = safePoint(localPoint(home.frame, 13, 6), 2.5, 2.5);
    car = carModel(mats); car.position.set(carPoint.x, world.terrain.height(carPoint.x, carPoint.z), carPoint.z); car.rotation.y = Math.atan2(home.frame.v.x, home.frame.v.z); scene.add(car);
    const carPoints = [[-1.04, -2.2], [1.04, -2.2], [1.04, 2.2], [-1.04, 2.2]].map(([x, z]) => ({ x: carPoint.x + x * Math.cos(car.rotation.y) + z * Math.sin(car.rotation.y), z: carPoint.z - x * Math.sin(car.rotation.y) + z * Math.cos(car.rotation.y) }));
    world.colliders.push({ points: carPoints, bounds: bounds(carPoints), id: 'parked-car' }); collisionGrid = new SpatialGrid(world.colliders);
    const familyPoint = safePoint(localPoint(home.frame, 8, -5), .7);
    family = person(mats, { height: 1.87, shirt: 0xa7766d, longHair: true }); family.position.set(familyPoint.x, world.terrain.height(familyPoint.x, familyPoint.z), familyPoint.z); family.rotation.y = .4; scene.add(family);
    const circle = Array.from({ length: 12 }, (_, i) => ({ x: familyPoint.x + Math.cos(i * Math.PI / 6) * .3, z: familyPoint.z + Math.sin(i * Math.PI / 6) * .3 }));
    world.colliders.push({ points: circle, bounds: bounds(circle), id: 'swantje' }); collisionGrid = new SpatialGrid(world.colliders);
    const spawn = safePoint(localPoint(home.frame, 8, 0));
    player = person(mats); player.position.set(spawn.x, world.terrain.height(spawn.x, spawn.z), spawn.z); scene.add(player);
    target.copy(player.position).y += 1.0;
    interactables.push({ x: home.frame.center.x, z: home.frame.center.z, range: 11, act: () => say('Unser Ausgangspunkt: das vorläufige Ferienhausmodell am bisherigen Startmarker. Fassade, Dach und Höhen sind angenähert.', 6500) },
      { x: familyPoint.x, z: familyPoint.z, range: 2.5, act: () => say('Swantje: „Komm, wir gehen ein Stück durch die Nachbarschaft. Findest du die sechs Muscheln?“') },
      { x: carPoint.x, z: carPoint.z, range: 3.8, act: () => say('Das Auto bleibt in Phase 1 geparkt. Die Ausflüge folgen später; im bisherigen Spiel sind sie weiter erreichbar.') });
    const shellMat = new T.MeshStandardMaterial({ color: 0xf4e4cb, roughness: .65 });
    for (let i = 0; i < 6; i++) {
      const p = safePoint(localPoint(home.frame, 10 + i * 2.5, -12 + Math.sin(i * 1.8) * 7), .9);
      const object = new T.Mesh(new T.SphereGeometry(.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), shellMat); object.scale.set(1, .38, .85); object.position.set(p.x, world.terrain.height(p.x, p.z) + .03, p.z); object.castShadow = true; scene.add(object);
      const item = { x: p.x, z: p.z, range: 1.6, object, done: false, act: () => { item.done = true; object.visible = false; collected++; $('#shells').textContent = `🐚 ${collected} / 6`; say(collected === 6 ? 'Alle sechs Muscheln gefunden! Zeit für einen Spaziergang durch die Dünen.' : `Muschel gefunden · ${collected} von 6`); } };
      collectibles.push(item); interactables.push(item);
    }
    $('#status').textContent = `${world.roads.length} Wege · ${world.buildings.length} Gebäude im Datensatz · Detailbereich um den Startpunkt`;
    ready = true;
    if (new URLSearchParams(location.search).has('test')) {
      // Deliberate opt-in for reproducible browser checks; absent in normal play.
      window.__game = { world, player, family, car, home, get grid() { return collisionGrid; }, collectibles, interactables,
        state: () => ({ yaw, pitch, dist, target: target.toArray(), player: player.position.toArray(), pointers: pointers.size, joystick: { ...joystick }, collected, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frameTime, shadows: renderer.shadowMap.enabled }),
        teleport: (x, z) => { const p = safePoint({ x, z }); player.position.set(p.x, world.terrain.height(p.x, p.z), p.z); resetCamera(); }, resetCamera, renderer, scene, camera };
    }
  } catch (e) {
    console.error(e); $('#status').textContent = `Laden fehlgeschlagen: ${e.message}`; say('Bitte die Seite über HTTP öffnen und erneut laden. Das bisherige Spiel ist unter index.html erreichbar.', 60000);
  }
}
load();
const ray = new T.Raycaster(), desired = new T.Vector3(), delta = new T.Vector3();
function frame(now) {
  requestAnimationFrame(frame); const elapsed = Math.max(0, now - last), dt = Math.min(elapsed / 1000, .05); last = now; frameTime = frameTime * .95 + elapsed * .05;
  if (!ready) return;
  if (!$('#guide').open) {
    let dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')) + joystick.x;
    let dz = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')) + joystick.z;
    const len = Math.max(1, Math.hypot(dx, dz)); dx /= len; dz /= len;
    const mx = dx * Math.cos(yaw) + dz * Math.sin(yaw), mz = -dx * Math.sin(yaw) + dz * Math.cos(yaw), before = player.position.clone();
    const next = moveActor({ x: before.x, z: before.z }, mx * 3.2 * dt, mz * 3.2 * dt, .32, collisionGrid, world.terrain);
    player.position.set(next.x, next.y, next.z); delta.subVectors(player.position, before); target.add(delta);
    const moved = Math.hypot(delta.x, delta.z), amount = clamp(moved / (3.2 * dt || 1), 0, 1); motionTime += dt * amount;
    if (moved > .001) { const angle = Math.atan2(mx, mz); player.rotation.y += Math.atan2(Math.sin(angle - player.rotation.y), Math.cos(angle - player.rotation.y)) * Math.min(1, dt * 12); }
    player.userData.animate(motionTime, amount);
  }
  pitch = clamp(pitch, .2, 1.42); dist = clamp(dist, 4, 250); target.x = clamp(target.x, AREA.minX + 2, AREA.maxX - 2); target.z = clamp(target.z, AREA.minZ + 2, AREA.maxZ - 2);
  target.y = world.terrain.height(target.x, target.z) + 1;
  desired.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  // Avoid walls/roofs between the camera and its focus. Only nearby buildings
  // cast shadows; distant detail and vegetation have their own distance limits.
  if (dist < 70) {
    const direction = desired.clone().sub(target), length = direction.length(); ray.set(target, direction.normalize()); ray.far = length;
    const hit = ray.intersectObjects(buildingObjects.filter(o => !inside(target, o.b.points)).flatMap(b => [b.shell, b.cap]), false)[0];
    if (hit && hit.distance > .7) desired.copy(target).addScaledVector(direction, Math.max(.65, hit.distance - .3));
  }
  desired.y = Math.max(desired.y, world.terrain.height(desired.x, desired.z) + .65); camera.position.copy(desired); camera.lookAt(target);
  if (now - lastLod > 200) {
    lastLod = now; const low = qualityMode === 'low' || (qualityMode === 'auto' && touchDevice), range = low ? 65 : 100;
    for (const g of grass) g.visible = g.userData.center.distanceTo(player.position) < range && dist < 120;
    for (const o of buildingObjects) { const near = Math.hypot(o.b.frame.center.x - player.position.x, o.b.frame.center.z - player.position.z) < 58; o.shell.castShadow = o.cap.castShadow = near; }
    sun.position.set(player.position.x - 45, player.position.y + 70, player.position.z + 35); sun.target.position.copy(player.position);
    if (now > messageUntil && !$('#guide').open) {
      const p = player.position, near = interactables.filter(i => !i.done && Math.hypot(i.x - p.x, i.z - p.z) < i.range).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      $('#message').textContent = near ? (near.object ? '🐚 Muschel entdeckt · E / Aktion zum Aufheben' : 'E / Aktion zum Interagieren') : 'WASD oder Joystick · Kamera mit Maus / Finger drehen';
    }
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { clearInput(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
