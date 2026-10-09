// Procedural sci-fi laboratory backdrop (Three.js), modelled on a white futuristic lab:
// glossy floor, stadium-shaped ceiling light rings, oval workstation with a hologram, glass specimen tubes, wall monitors.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Bloom tuning (HDR, before tone mapping). Lit walls peak around 2; light materials are `glow`× brighter,
// so only they pass `threshold`.
const BLOOM = { strength: 0.6, radius: 0.45, threshold: 3.2, glow: 7 };

const stadium = (w, r) => { // rounded-rectangle outline, centered on the origin
  const s = new THREE.Shape(), h = w / 2 - r;
  s.absarc(h, 0, r, -Math.PI / 2, Math.PI / 2);
  s.absarc(-h, 0, r, Math.PI / 2, Math.PI * 1.5);
  return s;
};
const slab = (w, r, depth, hole = 0) => { // flat stadium (optionally hollow), lying on the floor plane
  const s = stadium(w, r);
  if (hole) s.holes.push(stadium(w - 2 * hole, r - hole));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 32 }).rotateX(-Math.PI / 2);
};

function screenTexture() { // fake data display for the wall monitors
  const c = document.createElement('canvas'); c.width = 512; c.height = 288;
  const x = c.getContext('2d');
  x.fillStyle = '#0a2238'; x.fillRect(0, 0, 512, 288);
  x.strokeStyle = 'rgba(125,211,252,.18)';
  for (let i = 0; i < 512; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 288); x.stroke(); }
  for (let i = 0; i < 288; i += 32) { x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  x.strokeStyle = '#5eead4'; x.lineWidth = 3; x.beginPath();
  for (let i = 0; i <= 512; i += 4) x.lineTo(i, 150 + Math.sin(i / 30) * 50 * Math.cos(i / 140));
  x.stroke();
  x.fillStyle = '#e6edf6'; x.font = '600 28px Inter, sans-serif'; x.fillText('H₂O  ·  CO₂  ·  H₂', 24, 48);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createLab(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // ponytail: capped; the webcam models share this GPU
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe5ec);
  scene.fog = new THREE.Fog(0xdfe5ec, 14, 30);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 60);

  const white = new THREE.MeshStandardMaterial({ color: 0xf1f4f7, roughness: 0.3, metalness: 0.05 });
  const wall = new THREE.MeshStandardMaterial({ color: 0xd8dee6, roughness: 0.5, side: THREE.BackSide });
  const floor = new THREE.MeshStandardMaterial({ color: 0xd3d9e0, roughness: 0.06, metalness: 0.35 });
  const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(BLOOM.glow) });
  const cyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8ff3ff).multiplyScalar(BLOOM.glow) });
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfefff, roughness: 0.05, transparent: true, opacity: 0.22 });
  const liquid = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4fd1e8).multiplyScalar(1.6), transparent: true, opacity: 0.55 });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); return m; };

  // Room shell, floor, ceiling light rings
  add(new THREE.BoxGeometry(18, 5.2, 18), wall, 0, 2.6, 0);
  add(new THREE.PlaneGeometry(18, 18).rotateX(-Math.PI / 2), floor, 0, 0.001, 0);
  add(slab(10, 3.2, 0.12, 0.35), light, 0, 5.0, 0);
  add(slab(6.4, 2.1, 0.12, 0.22), light, 0, 4.9, 0);
  add(slab(11, 3.6, 0.3, 0.3), white, 0, 5.05, 0);

  // Walls: vertical ribs, a light strip and data monitors
  for (let i = -8; i <= 8; i += 2) {
    add(new THREE.BoxGeometry(0.35, 5.2, 0.35), white, i, 2.6, -8.8);
    add(new THREE.BoxGeometry(0.35, 5.2, 0.35), white, -8.8, 2.6, i);
    add(new THREE.BoxGeometry(0.35, 5.2, 0.35), white, 8.8, 2.6, i);
  }
  add(new THREE.BoxGeometry(17.6, 0.06, 0.06), cyan, 0, 3.4, -8.6);
  const screen = new THREE.MeshBasicMaterial({ map: screenTexture() });
  for (const x of [-4.5, 0, 4.5]) add(new THREE.PlaneGeometry(3, 1.7), screen, x, 2.3, -8.55);
  for (const z of [-3, 3]) {
    add(new THREE.PlaneGeometry(2.6, 1.5).rotateY(Math.PI / 2), screen, -8.55, 2.3, z);
    add(new THREE.PlaneGeometry(2.6, 1.5).rotateY(-Math.PI / 2), screen, 8.55, 2.3, z);
  }

  // Oval workstation: hollow console with glowing base, hologram emitter in the middle
  add(slab(6.2, 1.9, 1.0, 0.55), white, 0, 0, 0);
  add(slab(6.5, 2.05, 0.06, 0.12), white, 0, 1.0, 0);
  add(slab(6.3, 1.95, 0.04, 0.06), cyan, 0, 0.02, 0);
  add(slab(6.5, 2.05, 0.03, 0.04), cyan, 0, 1.06, 0);
  add(new THREE.CylinderGeometry(0.7, 0.8, 0.5, 48), white, 0, 0.25, 0);
  add(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 48), cyan, 0, 0.52, 0);
  const beam = add(new THREE.CylinderGeometry(0.9, 0.6, 2.2, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x8ff3ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }), 0, 1.6, 0);
  for (const [x, rot] of [[-2.2, 0.35], [2.2, -0.35]]) { // console monitors on the desk
    add(new THREE.PlaneGeometry(1.1, 0.65), screen, x, 1.45, 1.55).rotation.set(-0.25, rot, 0);
  }

  // Hologram molecule (H₂O, bent 104.5°) spinning above the emitter
  const holo = new THREE.Group(); holo.position.set(0, 2.1, 0); scene.add(holo);
  const atomMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, emissive: c, emissiveIntensity: 0.35, transparent: true, opacity: 0.9 });
  const half = 104.5 / 2 * Math.PI / 180;
  holo.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 16), atomMat(0xe5484d)));
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 16), atomMat(0xeef2f6));
    h.position.set(s * Math.sin(half) * 0.62, -Math.cos(half) * 0.62, 0); holo.add(h);
  }

  // Glass specimen tubes around the workstation
  for (const [x, z] of [[-5.5, -3.5], [5.5, -3.5], [-6.5, 2.5], [6.5, 2.5]]) {
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 40), white, x, 0.15, z);
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 40), white, x, 3.35, z);
    add(new THREE.CylinderGeometry(0.5, 0.5, 2.9, 40, 1, true), glass, x, 1.75, z);
    add(new THREE.CylinderGeometry(0.42, 0.42, 2.1, 40), liquid, x, 1.4, z);
    add(new THREE.TorusGeometry(0.62, 0.03, 8, 40).rotateX(Math.PI / 2), cyan, x, 0.31, z);
  }

  scene.add(new THREE.HemisphereLight(0xffffff, 0xaab6c4, 1.1));
  const key = new THREE.PointLight(0xffffff, 25, 20); key.position.set(0, 4.6, 0); scene.add(key);

  // Camera presets: wide room view for menus, close to the workstation during experiments.
  const WIDE = { pos: new THREE.Vector3(0, 2.6, 10.5), look: new THREE.Vector3(0, 1.5, 0) };
  const BENCH = { pos: new THREE.Vector3(0, 2.5, 5.2), look: new THREE.Vector3(0, 1.6, 0) };
  const pos = WIDE.pos.clone(), look = WIDE.look.clone();
  let w = 0, h = 0;

  const composer = new EffectComposer(renderer); // renders in HDR; OutputPass applies tone mapping at the end
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold));
  composer.addPass(new OutputPass());

  return {
    // focus: true during experiments; lean: -1..1 user's horizontal body offset (parallax)
    render(t, focus, lean = 0) {
      if (w !== innerWidth || h !== innerHeight) {
        w = innerWidth; h = innerHeight;
        renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      const P = focus ? BENCH : WIDE;
      pos.lerp(P.pos, 0.03); look.lerp(P.look, 0.03);
      camera.position.set(pos.x + Math.sin(t * 0.12) * 0.4 + lean * 0.9, pos.y + Math.sin(t * 0.2) * 0.05, pos.z);
      camera.lookAt(look);
      holo.rotation.y = t * 0.6; holo.visible = !focus; beam.material.opacity = focus ? 0.04 : 0.08;
      composer.render();
    },
  };
}
