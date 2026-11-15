// Local metres: east = +x, south = +z. Origin retained from the v0.13 preview.
export const ORIGIN = { lat: 56.11246784, lon: 8.12092021 };
export const AREA = { minX: -250, maxX: 170, minZ: -180, maxZ: 180 };
export const HOME_ID = 696149108; // Nearest footprint to the old marker; address unverified.
export const GROUND = 1.2; // Artistic local datum, NOT metres above sea level.
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const random = n => { const r = Math.sin(n * 127.1 + 42.7) * 43758.5453; return r - Math.floor(r); };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function project(p) {
  return { x: (p.lon - ORIGIN.lon) * 111320 * Math.cos(ORIGIN.lat * Math.PI / 180), z: -(p.lat - ORIGIN.lat) * 111320 };
}
export function closestPoint(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return { x: a.x + t * dx, z: a.z + t * dz };
}
export function inside(p, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
  }
  return hit;
}
export function polygonDistance(p, polygon) {
  if (inside(p, polygon)) return 0;
  let d = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const q = closestPoint(p, polygon[i], polygon[(i + 1) % polygon.length]);
    d = Math.min(d, Math.hypot(p.x - q.x, p.z - q.z));
  }
  return d;
}
export function bounds(points, pad = 0) {
  return { minX: Math.min(...points.map(p => p.x)) - pad, maxX: Math.max(...points.map(p => p.x)) + pad,
    minZ: Math.min(...points.map(p => p.z)) - pad, maxZ: Math.max(...points.map(p => p.z)) + pad };
}
export const overlaps = (a, b) => a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
// Minimum-area oriented bounding rectangle. Roof ridge follows its long axis,
// rather than the world axes. This is a model assumption, not surveyed roof data.
export function buildingFrame(points) {
  let best;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < .01) continue;
    const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }, v = { x: -u.z, z: u.x };
    const us = points.map(p => p.x * u.x + p.z * u.z), vs = points.map(p => p.x * v.x + p.z * v.z);
    const loU = Math.min(...us), hiU = Math.max(...us), loV = Math.min(...vs), hiV = Math.max(...vs);
    const area = (hiU - loU) * (hiV - loV);
    if (!best || area < best.area - .001) best = { u, v, loU, hiU, loV, hiV, area };
  }
  let { u, v, loU, hiU, loV, hiV } = best;
  const center = { x: u.x * (loU + hiU) / 2 + v.x * (loV + hiV) / 2, z: u.z * (loU + hiU) / 2 + v.z * (loV + hiV) / 2 };
  let width = hiU - loU, length = hiV - loV;
  if (width > length) { [width, length] = [length, width]; [u, v] = [v, { x: -u.x, z: -u.z }]; }
  return { center, u, v, width, length };
}
export const localPoint = (frame, u, v) => ({ x: frame.center.x + u * frame.u.x + v * frame.v.x, z: frame.center.z + u * frame.u.z + v * frame.v.z });
export const roofHeight = (b, p) => b.height + b.rise * Math.max(0, 1 - Math.abs((p.x - b.frame.center.x) * b.frame.u.x + (p.z - b.frame.center.z) * b.frame.u.z) / (b.frame.width / 2));

export class SpatialGrid {
  constructor(items, size = 16) {
    this.size = size; this.cells = new Map();
    for (const item of items) {
      const b = item.bounds;
      for (let x = Math.floor(b.minX / size); x <= Math.floor(b.maxX / size); x++) for (let z = Math.floor(b.minZ / size); z <= Math.floor(b.maxZ / size); z++) {
        const key = `${x},${z}`;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(item);
      }
    }
  }
  near(x, z, radius = 0) {
    const found = new Set();
    for (let i = Math.floor((x - radius) / this.size); i <= Math.floor((x + radius) / this.size); i++) for (let j = Math.floor((z - radius) / this.size); j <= Math.floor((z + radius) / this.size); j++) {
      for (const item of this.cells.get(`${i},${j}`) || []) found.add(item);
    }
    return [...found];
  }
}
function roadWidth(tags) {
  const tagged = Number(tags.width);
  if (tagged > .5 && tagged < 15) return tagged;
  if (/footway|path|steps|cycleway/.test(tags.highway)) return 1.6;
  if (/track|service/.test(tags.highway)) return tags.service === 'driveway' ? 2.4 : 3;
  return tags.highway === 'residential' ? 4.6 : 5.8;
}
export function makeWorld(json) {
  const buildings = [], roads = [];
  for (const el of json.elements || []) {
    if (!el.geometry?.length) continue;
    const tags = el.tags || {}, points = el.geometry.map(project);
    if (tags.highway) {
      const width = roadWidth(tags);
      roads.push({ id: el.id, points, width, tags, bounds: bounds(points, width / 2) });
    } else if (tags.building && points.length >= 4) {
      if (Math.hypot(points[0].x - points.at(-1).x, points[0].z - points.at(-1).z) < .01) points.pop();
      const frame = buildingFrame(points);
      const height = clamp(Number.parseFloat(tags.height) || (Number(tags['building:levels']) || 1) * 2.8, 2.2, 12);
      buildings.push({ id: el.id, points, tags, frame, bounds: bounds(points), height, rise: Math.min(2.4, frame.width * .31) });
    }
  }
  const visibleBuildings = buildings.filter(b => overlaps(b.bounds, AREA));
  const segments = roads.flatMap(road => road.points.slice(1).map((b, i) => ({ a: road.points[i], b, road, bounds: bounds([road.points[i], b], road.width / 2 + 6) })))
    .filter(s => overlaps(s.bounds, AREA));
  const buildingGrid = new SpatialGrid(visibleBuildings), roadGrid = new SpatialGrid(segments);
  function clearance(x, z) {
    const p = { x, z };
    let house = 100, road = 100;
    for (const b of buildingGrid.near(x, z, 12)) house = Math.min(house, polygonDistance(p, b.points));
    for (const s of roadGrid.near(x, z, 10)) { const q = closestPoint(p, s.a, s.b); road = Math.min(road, Math.hypot(x - q.x, z - q.z) - s.road.width / 2); }
    return { house, road };
  }
  function rawHeight(x, z) {
    const c = clearance(x, z);
    // > grid diagonal (2 * sqrt(2)) keeps every interpolated pad level.
    const freedom = smooth(3.1, 11, Math.min(c.house, c.road));
    // Continuous sculpted terrain, blended to level pads/road corridors.
    const wave = Math.max(0, .7 + .55 * Math.sin(x * .037 + z * .021) + .35 * Math.sin(z * .064 - x * .014));
    const dunes = wave * (.7 + 2.4 * smooth(30, 220, -x));
    return GROUND + freedom * (dunes + .12 * Math.sin(x * .11) * Math.sin(z * .09));
  }
  const terrain = makeTerrain(rawHeight);
  const colliders = visibleBuildings.map(b => ({ points: b.points, bounds: b.bounds, id: b.id }));
  return { buildings, roads, visibleBuildings, segments, buildingGrid, roadGrid, clearance, terrain, colliders };
}
export function makeTerrain(fn) {
  const step = 2, cols = Math.round((AREA.maxX - AREA.minX) / step), rows = Math.round((AREA.maxZ - AREA.minZ) / step);
  const heights = new Float32Array((cols + 1) * (rows + 1));
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) heights[j * (cols + 1) + i] = fn(AREA.minX + i * step, AREA.minZ + j * step);
  // Same two triangles as the rendered grid, not a bilinear approximation.
  function height(x, z) {
    const gx = clamp((x - AREA.minX) / step, 0, cols - .000001), gz = clamp((z - AREA.minZ) / step, 0, rows - .000001);
    const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j, k = j * (cols + 1) + i;
    const a = heights[k], b = heights[k + 1], c = heights[k + cols + 1], d = heights[k + cols + 2];
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  return { heights, cols, rows, step, height };
}
export function blocked(p, radius, grid) {
  return grid.near(p.x, p.z, radius).some(c => polygonDistance(p, c.points) < radius - 1e-7);
}
// Split a polygon by a directed line. Used to cut roofs at the ridge and to
// subtract triangulated footprints from road surfaces without moving OSM nodes.
export function splitPolygon(points, a, b) {
  const side = p => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
  const positive = [], negative = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length], s = side(p), t = side(q);
    if (s >= -1e-9) positive.push(p);
    if (s <= 1e-9) negative.push(p);
    if (s * t < -1e-12) {
      const k = s / (s - t), r = { x: p.x + k * (q.x - p.x), z: p.z + k * (q.z - p.z) };
      positive.push(r); negative.push(r);
    }
  }
  return [positive, negative];
}
export function subtractTriangle(polygon, triangle) {
  let remaining = polygon;
  const outside = [];
  const [a, b, c] = triangle;
  const sign = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  if (Math.abs(sign) < 1e-9) return [polygon];
  for (let i = 0; i < 3 && remaining.length >= 3; i++) {
    const [positive, negative] = splitPolygon(remaining, triangle[i], triangle[(i + 1) % 3]);
    const [keep, cut] = sign > 0 ? [positive, negative] : [negative, positive];
    if (cut.length >= 3) outside.push(cut);
    remaining = keep;
  }
  return outside;
}
export function moveActor(p, dx, dz, radius, grid, terrain) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .12));
  const out = { x: p.x, z: p.z };
  for (let i = 0; i < steps; i++) {
    const x = clamp(out.x + dx / steps, AREA.minX + radius + 3, AREA.maxX - radius - 3);
    const z = clamp(out.z + dz / steps, AREA.minZ + radius + 3, AREA.maxZ - radius - 3);
    if (!blocked({ x, z: out.z }, radius, grid) && Math.abs(terrain.height(x, out.z) - terrain.height(out.x, out.z)) < .16) out.x = x;
    if (!blocked({ x: out.x, z }, radius, grid) && Math.abs(terrain.height(out.x, z) - terrain.height(out.x, out.z)) < .16) out.z = z;
  }
  out.y = terrain.height(out.x, out.z);
  return out;
}
