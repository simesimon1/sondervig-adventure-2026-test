import * as T from '../vendor/three.module.js';
import { shoreX } from './coast.js';
import { AREA, GROUND, HOME_ID, random, clamp, bounds, overlaps, localPoint, roofHeight, splitPolygon, subtractTriangle } from './world.js';

function texture(kind) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = { ground: '#dedbd0', wood: '#766759', roof: '#4d504d', road: '#777873', path: '#c8bc9b' }[kind]; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6500; i++) {
    c.fillStyle = i % 2 ? '#fff4da' : '#252e22'; c.globalAlpha = .03 + random(i + 4) * .09;
    c.fillRect(random(i) * 256, random(i + 19) * 256, kind === 'wood' ? .6 : 1.3, kind === 'wood' ? 5 + random(i + 6) * 25 : 1.3);
  }
  c.globalAlpha = .35;
  if (kind === 'wood') { c.fillStyle = '#222a24'; for (let x = 0; x < 256; x += 32) c.fillRect(x, 0, 2, 256); }
  if (kind === 'roof') { c.fillStyle = '#171f1e'; for (let x = 0; x < 256; x += 32) c.fillRect(x, 0, 2, 256); for (let y = 0; y < 256; y += 64) c.fillRect(0, y, 256, 1); }
  const tex = new T.CanvasTexture(cv); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
function surfaceRelief(kind) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = '#888'; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 3200; i++) { const v = Math.round(100 + random(i + 37) * 55); c.fillStyle = `rgb(${v},${v},${v})`;
    c.fillRect(random(i) * 128, random(i + 3) * 128, kind === 'wood' ? .5 : 1, kind === 'wood' ? 5 + random(i + 11) * 14 : 1);
  }
  if (kind === 'wood' || kind === 'roof') { c.fillStyle = '#333'; for (let x = 0; x < 128; x += 16) c.fillRect(x, 0, kind === 'wood' ? 1 : 2, 128); }
  const texture = new T.CanvasTexture(cv); texture.wrapS = texture.wrapT = T.RepeatWrapping; return texture;
}
export function materials() {
  const standard = (color, rest = {}) => new T.MeshStandardMaterial({ color, roughness: .9, ...rest });
  const result = { ground: standard(0xffffff, { map: texture('ground'), vertexColors: true }), wood: standard(0xd6ccbb, { map: texture('wood'), side: T.DoubleSide }),
    roof: standard(0xc0c5bf, { map: texture('roof'), side: T.DoubleSide }), trim: standard(0xe2dfce), glass: standard(0x739ba1, { roughness: .22, metalness: .35 }),
    dark: standard(0x333b39), concrete: standard(0x8d8b7e), road: standard(0xffffff, { map: texture('road') }), path: standard(0xffffff, { map: texture('path') }),
    skin: standard(0xd6ad8b), hair: standard(0x594238), shirt: standard(0x536f82), pants: standard(0x3c4a53), shoes: standard(0x45423c), car: standard(0x456a74, { roughness: .36, metalness: .3 }) };
  for (const [key, kind, depth] of [['ground','sand',.045], ['wood','wood',.018], ['roof','roof',.012], ['path','sand',.025]]) {
    result[key].bumpMap = surfaceRelief(kind); result[key].bumpScale = depth; result[key].envMapIntensity = .35;
  }
  return result;
}
export class Batch {
  constructor() { this.position = []; this.normal = []; this.uv = []; }
  add(geometry, matrix = new T.Matrix4()) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); g.applyMatrix4(matrix);
    this.position.push(...g.attributes.position.array); this.normal.push(...g.attributes.normal.array);
    this.uv.push(...(g.attributes.uv?.array || new Float32Array(g.attributes.position.count * 2)));
    g.dispose(); geometry.dispose(); return this;
  }
  box(x, y, z, w, h, d, rotation = 0) {
    const matrix = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), rotation), new T.Vector3(1, 1, 1));
    return this.add(new T.BoxGeometry(w, h, d), matrix);
  }
  mesh(material) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.position, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.normal, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2)); g.computeBoundingSphere();
    return new T.Mesh(g, material);
  }
}
function triangle(buffer, a, b, c, uvScale = 1) {
  for (const p of [a, b, c]) { buffer.position.push(p.x, p.y, p.z); buffer.uv.push(p.x * uvScale, p.z * uvScale); }
}
function surface(buffer, material) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(buffer.position, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(buffer.uv, 2)); g.computeVertexNormals(); return new T.Mesh(g, material);
}
export function terrainMesh(world, mats) {
  const { cols, rows, step, heights } = world.terrain, pos = [], colors = [], uv = [], idx = [];
  const sand = new T.Color(0xdfd3b5), green = new T.Color(0x9ba78c);
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const x = AREA.minX + i * step, z = AREA.minZ + j * step, y = heights[j * (cols + 1) + i]; pos.push(x, y, z); uv.push(x / 7, z / 7);
    const color = sand.clone().lerp(green, clamp((x-shoreX(z)<65?0:.65) - (y - GROUND) * .18 + .18 * Math.sin(x * .08 + z * .07), .04, .85)); colors.push(color.r, color.g, color.b);
    if (i < cols && j < rows) { const a = j * (cols + 1) + i; idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const mesh = new T.Mesh(g, mats.ground); mesh.receiveShadow = true; return mesh;
}
function triangulate(points) { return T.ShapeUtils.triangulateShape(points.map(p => new T.Vector2(p.x, p.z)), []).map(t => t.map(i => points[i])); }
export function roadMeshes(world, mats) {
  const buffers = { road: { position: [], uv: [] }, path: { position: [], uv: [] } };
  for (const b of world.visibleBuildings) b.triangles = triangulate(b.points);
  let clipped = 0;
  function emit(points, key) {
    if (!overlaps(bounds(points), AREA)) return;
    let polygons = [points];
    const bb = bounds(points), center = { x: (bb.minX + bb.maxX) / 2, z: (bb.minZ + bb.maxZ) / 2 };
    for (const b of world.buildingGrid.near(center.x, center.z, Math.max(bb.maxX - bb.minX, bb.maxZ - bb.minZ))) {
      if (!overlaps(bb, b.bounds)) continue;
      const before = polygons;
      for (const cut of b.triangles) polygons = polygons.flatMap(p => subtractTriangle(p, cut));
      if (polygons.length !== before.length || polygons.some((p, i) => p !== before[i])) clipped++;
    }
    // Clip the bounded phase area, so no floating road tails leave the terrain.
    for (const [a, b] of [[{ x: AREA.minX, z: AREA.minZ }, { x: AREA.maxX, z: AREA.minZ }], [{ x: AREA.maxX, z: AREA.minZ }, { x: AREA.maxX, z: AREA.maxZ }], [{ x: AREA.maxX, z: AREA.maxZ }, { x: AREA.minX, z: AREA.maxZ }], [{ x: AREA.minX, z: AREA.maxZ }, { x: AREA.minX, z: AREA.minZ }]]) polygons = polygons.map(p => splitPolygon(p, a, b)[0]).filter(p => p.length >= 3);
    for (const p of polygons) for (let i = 1; i < p.length - 1; i++) {
      const verts = [p[0], p[i], p[i + 1]].map(v => ({ ...v, y: world.terrain.height(v.x, v.z) + .045 }));
      // Upward winding for the x/z coordinate convention.
      const sign = (verts[1].x - verts[0].x) * (verts[2].z - verts[0].z) - (verts[1].z - verts[0].z) * (verts[2].x - verts[0].x);
      triangle(buffers[key], verts[0], verts[sign > 0 ? 2 : 1], verts[sign > 0 ? 1 : 2], .4);
    }
  }
  const joins = new Map();
  for (const s of world.segments) {
    const { a, b, road } = s, dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < .01) continue;
    const key = /asphalt|paved/.test(road.tags.surface || '') || /primary|secondary|tertiary/.test(road.tags.highway) ? 'road' : 'path';
    const n = { x: -dz / len, z: dx / len }, half = road.width / 2, steps = Math.ceil(len / 1.5), bands = Math.ceil(road.width / 1.5);
    for (let i = 0; i < steps; i++) for (let j = 0; j < bands; j++) {
      const p = (t, u) => ({ x: a.x + dx * t + n.x * u, z: a.z + dz * t + n.z * u });
      const l = -half + road.width * j / bands, r = -half + road.width * (j + 1) / bands;
      const p0 = p(i / steps, l), p1 = p((i + 1) / steps, l), p2 = p((i + 1) / steps, r), p3 = p(i / steps, r);
      emit([p0, p1, p2], key); emit([p0, p2, p3], key);
    }
    for (const p of [a, b]) {
      const id = `${p.x.toFixed(4)},${p.z.toFixed(4)}`;
      if (!joins.has(id) || joins.get(id).radius < half) joins.set(id, { p, radius: half, key });
    }
  }
  for (const { p, radius, key } of joins.values()) for (let i = 0; i < 16; i++) {
    const q = a => ({ x: p.x + Math.cos(a) * radius, z: p.z + Math.sin(a) * radius });
    emit([p, q(i * Math.PI / 8), q((i + 1) * Math.PI / 8)], key);
  }
  world.roadGeometry = buffers; world.clippedRoadPieces = clipped;
  return Object.entries(buffers).map(([key, b]) => { const mesh = surface(b, mats[key]); mesh.receiveShadow = true; return mesh; });
}

export function buildingModel(b, mats) {
  const root = new T.Group(), f = b.frame, walls = { position: [], uv: [] }, roof = { position: [], uv: [] };
  root.position.set(f.center.x, GROUND, f.center.z);
  const relative = (p, y) => ({ x: p.x - f.center.x, y, z: p.z - f.center.z });
  const top = p => roofHeight(b, p);
  const ridgeA = localPoint(f, 0, -f.length), ridgeB = localPoint(f, 0, f.length);
  for (const t of triangulate(b.points)) for (const poly of splitPolygon(t, ridgeA, ridgeB)) for (let i = 1; i < poly.length - 1; i++) {
    const verts = [poly[0], poly[i + 1], poly[i]].map(p => relative(p, top(p)));
    triangle(roof, ...verts, .55);
  }
  for (let i = 0; i < b.points.length; i++) {
    const a = b.points[i], c = b.points[(i + 1) % b.points.length];
    const l = Math.hypot(c.x - a.x, c.z - a.z), edge = [a];
    // Gable wall must include the ridge where an edge crosses it.
    const ua = (a.x - f.center.x) * f.u.x + (a.z - f.center.z) * f.u.z, uc = (c.x - f.center.x) * f.u.x + (c.z - f.center.z) * f.u.z;
    if (ua * uc < 0) { const k = ua / (ua - uc); edge.push({ x: a.x + k * (c.x - a.x), z: a.z + k * (c.z - a.z) }); }
    edge.push(c);
    for (let k = 1; k < edge.length; k++) {
      const p = edge[k - 1], q = edge[k];
      const vs = [relative(p, 0), relative(q, 0), relative(q, top(q)), relative(p, top(p))];
      const start = walls.uv.length;
      triangle(walls, vs[0], vs[1], vs[2]); triangle(walls, vs[0], vs[2], vs[3]);
      const u0 = Math.hypot(p.x - a.x, p.z - a.z), u1 = Math.hypot(q.x - a.x, q.z - a.z);
      walls.uv.splice(start, 12, u0 / 1.1, 0, u1 / 1.1, 0, u1 / 1.1, top(q) / 3, u0 / 1.1, 0, u1 / 1.1, top(q) / 3, u0 / 1.1, top(p) / 3);
    }
  }
  const shell = surface(walls, mats.wood), cap = surface(roof, mats.roof); shell.castShadow = cap.castShadow = true; shell.receiveShadow = true;
  root.add(shell, cap);
  const detail = new T.Group(), trim = new Batch(), glass = new Batch(), dark = new Batch(), foundation = new Batch();
  // Details follow each actual wall, including concave OSM footprints.
  for (let i = 0; i < b.points.length; i++) {
    const a = b.points[i], c = b.points[(i + 1) % b.points.length], dx = c.x - a.x, dz = c.z - a.z, len = Math.hypot(dx, dz), rot = -Math.atan2(dz, dx);
    if (len < 1) continue;
    let nx = dz / len, nz = -dx / len;
    // Determine outward face independently of OSM polygon winding.
    const signedArea = b.points.reduce((s, p, j) => s + p.x * b.points[(j + 1) % b.points.length].z - b.points[(j + 1) % b.points.length].x * p.z, 0);
    if (signedArea < 0) { nx *= -1; nz *= -1; }
    const point = (t, offset = .035) => ({ x: a.x - f.center.x + dx * t + nx * offset, z: a.z - f.center.z + dz * t + nz * offset });
    const mid = point(.5, 0); foundation.box(mid.x, .12, mid.z, len, .24, .12, rot);
    const topMid = point(.5, .025); trim.box(topMid.x, b.height - .06, topMid.z, len, .11, .12, rot);
    for (const t of [.025, .975]) { const p = point(t); trim.box(p.x, b.height / 2, p.z, .09, b.height, .09, rot); }
    if (len < 3) continue;
    const count = Math.max(1, Math.floor(len / 3.2));
    for (let j = 0; j < count; j++) {
      const t = (j + .5) / count, p = point(t, .07), door = b.id === HOME_ID && i === 3 && j === 1;
      const w = door ? .94 : Math.min(1.45, len / count - .9), h = door ? 2.08 : 1.15, y = door ? 1.04 : 1.65;
      glass.box(p.x, y, p.z, w, h, .055, rot);
      for (const side of [-1, 1]) {
        trim.box(p.x + dx / len * side * (w / 2 + .04), y, p.z + dz / len * side * (w / 2 + .04), .075, h + .16, .10, rot);
        trim.box(p.x, y + side * (h / 2 + .04), p.z, w + .16, .075, .10, rot);
      }
      if (!door) { trim.box(p.x, y, p.z, .055, h, .11, rot); trim.box(p.x, y, p.z, w, .055, .11, rot); }
      else dark.box(p.x + dx / len * .32 + nx * .08, 1, p.z + dz / len * .32 + nz * .08, .05, .19, .05, rot);
    }
  }
  // Fascia boards meet exactly on the sloping gable edges.
  for (let i = 0; i < b.points.length; i++) {
    const a = b.points[i], c = b.points[(i + 1) % b.points.length], pieces = [a];
    const ua = (a.x - f.center.x) * f.u.x + (a.z - f.center.z) * f.u.z, uc = (c.x - f.center.x) * f.u.x + (c.z - f.center.z) * f.u.z;
    if (ua * uc < 0) { const k = ua / (ua - uc); pieces.push({ x: a.x + k * (c.x - a.x), z: a.z + k * (c.z - a.z) }); }
    pieces.push(c);
    for (let j = 1; j < pieces.length; j++) {
      const p = relative(pieces[j - 1], top(pieces[j - 1])), q = relative(pieces[j], top(pieces[j])), v = new T.Vector3(q.x - p.x, q.y - p.y, q.z - p.z), middle = new T.Vector3(p.x, p.y, p.z).addScaledVector(v, .5);
      const matrix = new T.Matrix4().compose(middle, new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()), new T.Vector3(1, 1, 1));
      trim.add(new T.BoxGeometry(.13, v.length(), .13), matrix);
    }
  }
  for (const [batch, mat] of [[foundation, mats.concrete], [trim, mats.trim], [glass, mats.glass], [dark, mats.dark]]) if (batch.position.length) detail.add(batch.mesh(mat));
  const lod = new T.LOD(); lod.addLevel(detail, 0); lod.addLevel(new T.Group(), b.id === HOME_ID ? 95 : 48); root.add(lod);
  return { root, shell, cap, lod };
}

export function vegetation(world, scene) {
  // Curved blades with a narrow tip. Shared geometry and instancing keep
  // draw calls bounded; the same grass clearance remains in force.
  const p = [], idx = [];
  for (let j = 0; j < 6; j++) {
    const a = j * Math.PI / 3 + .21, dx = Math.cos(a), dz = Math.sin(a), k = p.length / 3;
    const h = .62 + random(j + 11) * .56;
    for (let i = 0; i <= 3; i++) {
      const t = i / 3, width = .025 * (1 - t) + .001, bend = t * t * .20;
      p.push(dx * bend - dz * width, t * h, dz * bend + dx * width, dx * bend + dz * width, t * h, dz * bend - dx * width);
      if (i < 3) { const n = k + i * 2; idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
  }
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geometry.setIndex(idx); geometry.computeVertexNormals();
  const mat = new T.MeshLambertMaterial({ color: 0xb0b487, side: T.DoubleSide });
  const wind = { value: 0 }; mat.userData.wind = wind;
  mat.onBeforeCompile = shader => {
    shader.uniforms.coastalTime = wind;
    shader.vertexShader = 'uniform float coastalTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(coastalTime * 1.4 + instanceMatrix[3].x * .2 + instanceMatrix[3].z * .15) * position.y * position.y * .045;');
  };
  const tiles = new Map(), matrix = new T.Matrix4(), quat = new T.Quaternion(), count = 14000;
  for (let i = 0; i < count; i++) {
    const x = AREA.minX + random(i * 3 + 4) * (AREA.maxX - AREA.minX), z = AREA.minZ + random(i * 5 + 99) * (AREA.maxZ - AREA.minZ), c = world.clearance(x, z);
    if (x < shoreX(z)+65 || c.road < 1 || c.house < 1.8) continue;
    const id = `${Math.floor(x / 32)},${Math.floor(z / 32)}`;
    if (!tiles.has(id)) tiles.set(id, []); tiles.get(id).push({ x, z, i });
  }
  const meshes = [];
  for (const points of tiles.values()) {
    const m = new T.InstancedMesh(geometry, mat, points.length);
    points.forEach(({ x, z, i }, j) => {
      const s = .34 + random(i + 47) * .65; quat.setFromAxisAngle(new T.Vector3(0, 1, 0), random(i + 11) * Math.PI * 2);
      matrix.compose(new T.Vector3(x, world.terrain.height(x, z) - .025, z), quat, new T.Vector3(s, s, s)); m.setMatrixAt(j, matrix);
      m.setColorAt(j, new T.Color().setHSL(.16 + random(i) * .04, .18 + random(i + 3) * .15, .36 + random(i + 8) * .18));
    });
    m.computeBoundingSphere(); m.userData.center = m.boundingSphere.center.clone(); scene.add(m); meshes.push(m);
  }
  return meshes;
}
export function person(mats, { height = 1.88, shirt = null, longHair = false } = {}) {
  const root = new T.Group(), body = new T.Group(); root.add(body); body.scale.setScalar(height / 1.88);
  const top = shirt ? mats.shirt.clone() : mats.shirt; if (shirt) top.color.setHex(shirt);
  const sphere = (parent, x, y, z, sx, sy, sz, material) => {
    const m = new T.Mesh(new T.SphereGeometry(1, 12, 8), material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); m.castShadow = true; return m;
  };
  const limb = (parent, y, h, r, material) => { const m = new T.Mesh(new T.CapsuleGeometry(r, h - r * 2, 3, 8), material); m.position.y = y; parent.add(m); m.castShadow = true; return m; };
  const torso = new T.Mesh(new T.LatheGeometry([new T.Vector2(.14, .83), new T.Vector2(.18, .96), new T.Vector2(.205, 1.28), new T.Vector2(.22, 1.4), new T.Vector2(.12, 1.46)], 12), top); torso.scale.z = .68; body.add(torso); torso.castShadow = true;
  limb(body, 1.49, .15, .065, mats.skin); sphere(body, 0, 1.69, .008, .115, .16, .115, mats.skin);
  sphere(body, 0, 1.795, -.014, .118, .085, .115, mats.hair);
  if (longHair) sphere(body, 0, 1.64, -.08, .13, .23, .07, mats.hair);
  else sphere(body, 0, 1.595, .073, .086, .04, .045, mats.hair);
  sphere(body, 0, 1.68, .117, .028, .035, .026, mats.skin);
  for (const side of [-1, 1]) sphere(body, side * .045, 1.72, .108, .011, .009, .007, mats.dark);
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group(); leg.position.set(side * .105, .88, 0); body.add(leg);
    limb(leg, -.25, .48, .075, mats.pants); limb(leg, -.64, .39, .057, mats.pants); sphere(leg, 0, -.815, .05, .07, .065, .14, mats.shoes); legs.push(leg);
    const arm = new T.Group(); arm.position.set(side * .235, 1.38, 0); body.add(arm); arm.rotation.z = side * .08;
    limb(arm, -.14, .29, .058, top); limb(arm, -.39, .25, .042, mats.skin); sphere(arm, 0, -.53, .015, .045, .064, .035, mats.skin); arms.push(arm);
  }
  root.userData.animate = (time, amount) => { legs.forEach((p, i) => p.rotation.x = Math.sin(time * 8 + i * Math.PI) * .55 * amount); arms.forEach((p, i) => p.rotation.x = -Math.sin(time * 8 + i * Math.PI) * .42 * amount); body.position.y = Math.abs(Math.sin(time * 8)) * .025 * amount; };
  return root;
}
export function carModel(mats) {
  const group = new T.Group(), body = new Batch(), dark = new Batch(), glass = new Batch(), trim = new Batch();
  body.box(0, .65, 0, 1.8, .7, 4.1).box(0, 1.1, -.1, 1.64, .6, 2.1);
  glass.box(0, 1.24, -.1, 1.66, .48, 1.98); body.box(0, 1.51, -.1, 1.7, .09, 2.12);
  for (const x of [-.86, .86]) { body.box(x, 1.2, -.1, .065, .6, .13); for (const z of [-1.3, 1.25]) {
    const mat = new T.Matrix4().compose(new T.Vector3(x, .35, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI / 2), new T.Vector3(1, 1, 1));
    dark.add(new T.CylinderGeometry(.34, .34, .22, 16), mat); trim.add(new T.CylinderGeometry(.19, .19, .235, 12), mat);
  } }
  for (const x of [-.62, .62]) trim.box(x, .77, 2.06, .36, .18, .03);
  for (const [batch, material] of [[body, mats.car], [dark, mats.dark], [glass, mats.glass], [trim, mats.trim]]) { const m = batch.mesh(material); m.castShadow = true; group.add(m); }
  return group;
}
