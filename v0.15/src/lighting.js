import * as T from '../vendor/three.module.js';

// Small, locally generated lighting environment. No HDRI downloads or photos.
export function coastalEnvironment(renderer, scene, background = true) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d'), sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#6896b4'); sky.addColorStop(.32, '#b4ced8'); sky.addColorStop(.49, '#dce4df'); sky.addColorStop(.54, '#d0d4c3'); sky.addColorStop(1, '#7e876b');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1024, 512);
  // Long soft cloud bands are visual atmosphere, not a weather simulation.
  for (let i = 0; i < 24; i++) {
    const x = (i * 137 + 83) % 1024, y = 55 + (i * 29) % 130;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 86);
    glow.addColorStop(0, '#fff8e31a'); glow.addColorStop(1, '#ffffff00'); ctx.fillStyle = glow;
    ctx.save(); ctx.translate(x, y); ctx.scale(2.3, .33); ctx.translate(-x, -y); ctx.fillRect(x - 86, y - 86, 172, 172); ctx.restore();
  }
  const texture = new T.CanvasTexture(canvas); texture.mapping = T.EquirectangularReflectionMapping; texture.colorSpace = T.SRGBColorSpace;
  const generator = new T.PMREMGenerator(renderer); const environment = generator.fromEquirectangular(texture); generator.dispose();
  scene.environment = environment.texture;
  if (background) scene.background = texture;
  else texture.dispose();
  return environment;
}

let shadowTexture;
export function contactShadow(width = .65, depth = .45) {
  if (!shadowTexture) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
    gradient.addColorStop(0, '#18201968'); gradient.addColorStop(.5, '#18201922'); gradient.addColorStop(1, '#18201900');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); shadowTexture = new T.CanvasTexture(canvas);
  }
  const mesh = new T.Mesh(new T.PlaneGeometry(width, depth), new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = .012; mesh.name = 'Ground contact'; return mesh;
}
