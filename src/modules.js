// Chemistry data, drawing helpers and the three learning modules.
// Each module: update(g, dt, W, H) sets this.status {gesture, hint, good}, and this.done once finished; draw(c, W, H).
import { clamp, dist, lerp } from './gesture.js';

// CPK-inspired colors, tuned for contrast on navy. Symbols are always drawn, so color is never the only cue.
export const ATOMS = {
  H: { name: '수소', bonds: 1, hi: '#ffffff', color: '#dfe6ee', lo: '#8e9bab', text: '#172033' },
  O: { name: '산소', bonds: 2, hi: '#ff9d9d', color: '#e5484d', lo: '#8f1d24', text: '#ffffff' },
  C: { name: '탄소', bonds: 4, hi: '#aab3c0', color: '#5f6b7a', lo: '#262d36', text: '#ffffff' },
};
const E_COLOR = '#7dd3fc';

// ---------- helpers ----------
export const follow = (dt, rate = 0.2) => 1 - Math.pow(1 - rate, dt * 60); // frame-rate independent lerp factor
export const moveTo = (p, t, k) => { p.x = lerp(p.x, t.x, k); p.y = lerp(p.y, t.y, k); };
export const toPx = (p, W, H) => p && { x: p.x * W, y: p.y * H };
export const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);

let audio;
export const audioCtx = () => (audio ??= new AudioContext()); // shared: unlocked by the START click, reused for narration
export function chime(freqs, len = 0.12) {
  try {
    audioCtx();
    freqs.forEach((f, i) => {
      const o = audio.createOscillator(), gn = audio.createGain(), t = audio.currentTime + i * len;
      o.type = 'sine'; o.frequency.value = f;
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + len * 2.5);
      o.connect(gn).connect(audio.destination); o.start(t); o.stop(t + len * 3);
    });
  } catch { /* sound is optional */ }
}

export function burst(list, x, y, color, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 140;
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.3, color });
  }
}
export function stepSparks(list, dt) {
  for (const p of list) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life <= 0) list.splice(i, 1);
}
export function drawSparks(c, list) {
  for (const p of list) {
    c.globalAlpha = clamp(p.life); c.fillStyle = p.color;
    c.beginPath(); c.arc(p.x, p.y, 2.2, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}

export function drawAtom(c, x, y, r, el, alpha = 1, ring = null) {
  const A = ATOMS[el];
  c.save(); c.globalAlpha = alpha;
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = r * 0.5; c.shadowOffsetY = r * 0.15;
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
  g.addColorStop(0, A.hi); g.addColorStop(0.45, A.color); g.addColorStop(1, A.lo);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.shadowColor = 'transparent';
  if (ring) { c.strokeStyle = ring; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r + 6, 0, Math.PI * 2); c.stroke(); }
  c.fillStyle = A.text; c.font = `600 ${Math.round(r * 0.85)}px Inter, 'Noto Sans KR', system-ui, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(el, x, y + r * 0.04);
  c.restore();
}

export function drawBond(c, a, b, order, w, alpha = 1) {
  const d = dist(a, b) || 1, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
  c.save(); c.globalAlpha = alpha; c.strokeStyle = '#cbd5e1'; c.lineWidth = w; c.lineCap = 'round';
  for (let i = 0; i < order; i++) {
    const o = (i - (order - 1) / 2) * w * 2.2;
    c.beginPath(); c.moveTo(a.x + nx * o, a.y + ny * o); c.lineTo(b.x + nx * o, b.y + ny * o); c.stroke();
  }
  c.restore();
}

export function ring(c, x, y, r, p, color = '#5eead4') {
  c.save(); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 4;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = color; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(p)); c.stroke();
  c.restore();
}

export function text(c, s, x, y, size, color = '#e6edf6', weight = 500, align = 'center') {
  c.fillStyle = color; c.font = `${weight} ${size}px Inter, 'Noto Sans KR', system-ui, sans-serif`;
  c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y);
}

// Pseudo-3D: rotate a planar molecule around the vertical axis, depth-sorted with perspective scaling.
export function drawMolecule(c, cx, cy, atoms, bonds, rot, r, alpha = 1) {
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const P = atoms.map(a => {
    const z = a.x * sin, s = 1 + z / (r * 14);
    return { el: a.el, x: cx + a.x * cos * s, y: cy + a.y * s, z, s };
  });
  for (const [i, j, o] of bonds) drawBond(c, P[i], P[j], o, r * 0.14, alpha);
  for (const p of [...P].sort((a, b) => a.z - b.z)) drawAtom(c, p.x, p.y, r * p.s, p.el, alpha);
  return P;
}

// Chemistry-correct geometry (planar coords in units of bond length).
const SHAPES = {
  H2: { atoms: [{ el: 'H', x: -0.5, y: 0 }, { el: 'H', x: 0.5, y: 0 }], bonds: [[0, 1, 1]] },
  H2O: { atoms: [{ el: 'O', x: 0, y: 0 }, { el: 'H', x: -0.79, y: 0.61 }, { el: 'H', x: 0.79, y: 0.61 }], bonds: [[0, 1, 1], [0, 2, 1]] },
  CO2: { atoms: [{ el: 'C', x: 0, y: 0 }, { el: 'O', x: -1, y: 0 }, { el: 'O', x: 1, y: 0 }], bonds: [[0, 1, 2], [0, 2, 2]] },
};

let floaters;
export function drawBackground(c, W, H, t) {
  floaters ??= Array.from({ length: 9 }, (_, i) => ({
    shape: SHAPES[['H2O', 'CO2', 'H2'][i % 3]], x: Math.random(), y: Math.random(),
    vx: (Math.random() - 0.5) * 0.01, vy: (Math.random() - 0.5) * 0.008, rot: Math.random() * 6, spin: 0.2 + Math.random() * 0.3, s: 0.6 + Math.random() * 0.6,
  }));
  const r = Math.min(W, H) * 0.028;
  for (const f of floaters) {
    const x = ((f.x + f.vx * t) % 1 + 1) % 1, y = ((f.y + f.vy * t) % 1 + 1) % 1, L = r * 2.6 * f.s;
    drawMolecule(c, x * W, y * H, f.shape.atoms.map(a => ({ el: a.el, x: a.x * L, y: a.y * L })), f.shape.bonds, f.rot + t * f.spin, r * f.s, 0.22);
  }
}

// ---------- MODULE 01 · ATOM BOND ----------
// Tuning knobs: READY = hand distance in shoulder widths; HOLD = s to bond;
// CHARGE = s of pinching to fill the bond-energy gauge and break it; DECAY = gauge drain per s when not pinching.
const BOND = { READY: 0.55, HOLD: 1.0, CHARGE: 1.5, DECAY: 0.5 };

class BondModule {
  constructor(W, H) {
    this.r = Math.min(W, H) * 0.07;
    this.a = { x: W * 0.3, y: H * 0.5 }; this.b = { x: W * 0.7, y: H * 0.5 };
    this.phase = 'free'; this.hold = 0; this.energy = 0; this.pt = 0; this.t = 0; this.ang = 0;
    this.attempts = 0; this.ready = false; this.sparks = []; this.done = null; this.status = {};
  }
  update(g, dt, W, H) {
    this.t += dt; this.pt += dt; stepSparks(this.sparks, dt);
    const k = follow(dt), r = this.r, L = toPx(g.screen.left, W, H), R = toPx(g.screen.right, W, H);

    if (this.phase === 'free') {
      moveTo(this.a, L ?? { x: W * 0.3, y: H * 0.5 }, k);
      moveTo(this.b, R ?? { x: W * 0.7, y: H * 0.5 }, k);
      const d = dist(this.a, this.b), min = r * 2.05; // spheres never pass through each other
      if (d > 0 && d < min) {
        const push = (min - d) / 2, ux = (this.b.x - this.a.x) / d, uy = (this.b.y - this.a.y) / d;
        this.a.x -= ux * push; this.a.y -= uy * push; this.b.x += ux * push; this.b.y += uy * push;
      }
      const ready = g.both && g.handDist < BOND.READY;
      if (ready && !this.ready) this.attempts++;
      this.ready = ready;
      this.hold = ready ? this.hold + dt : Math.max(0, this.hold - dt * 2);
      this.status = !g.both ? { gesture: '손 찾는 중', hint: '카메라 앞에 양손을 들고 검지를 펴 주세요.' }
        : ready ? { gesture: '결합 준비 · BOND READY', hint: '검지 끝을 모은 채로 유지하세요…', good: true }
        : { gesture: g.handDist < 1.2 ? '손이 가까워지는 중' : '손이 떨어져 있음', hint: '두 검지 끝을 더 가까이 모아 보세요.' };
      if (this.hold >= BOND.HOLD) {
        this.phase = 'bonded'; this.pt = 0; this.say = '수소 분자가 만들어졌어요! 이제 엄지와 집게손가락으로 집고 있으면 에너지가 쌓여서 결합이 끊어져요.';
        burst(this.sparks, (this.a.x + this.b.x) / 2, (this.a.y + this.b.y) / 2, E_COLOR);
        chime([523, 659, 784]);
      }
    } else if (this.phase === 'bonded') {
      const mid = L && R ? { x: (L.x + R.x) / 2, y: (L.y + R.y) / 2 } : { x: (this.a.x + this.b.x) / 2, y: (this.a.y + this.b.y) / 2 };
      if (L && R) this.ang = Math.atan2(R.y - L.y, R.x - L.x);
      const stretch = r * clamp(((g.handDist ?? g.wristDist ?? 0) - 0.6) * 0.25, 0, 0.45); // slow pull: bond stretches, holds
      const vib = r * 0.2 * Math.sin(this.pt * 38) * Math.exp(-this.pt * 2.5); // formation vibration
      const half = (r * 2.3 + stretch + vib) / 2, cx = Math.cos(this.ang) * half, cy = Math.sin(this.ang) * half;
      moveTo(this.a, { x: mid.x - cx, y: mid.y - cy }, k);
      moveTo(this.b, { x: mid.x + cx, y: mid.y + cy }, k);

      // Breaking: hold a pinch (either hand) to pour energy in; letting go drains it, so a brief pinch never breaks it.
      const armed = this.pt > 1.5, pinching = armed && (g.pinch.left || g.pinch.right);
      if (armed) this.energy = clamp(this.energy + (pinching ? 1 / BOND.CHARGE : -BOND.DECAY) * dt);
      this.status = !armed ? { gesture: '결합 형성', hint: '두 원자가 전자쌍을 공유하고 있어요.', good: true }
        : pinching ? { gesture: '에너지 투입', hint: '계속 집고 있어요! 게이지가 가득 차면 결합이 끊어져요.', good: true }
        : { gesture: '분자 유지 중', hint: '엄지와 검지로 집고 있으면 에너지가 쌓여 결합이 끊어져요.' };
      if (this.energy >= 1) {
        this.phase = 'broken'; this.pt = 0; this.say = '결합이 끊어졌어요! 결합을 끊으려면 에너지가 필요해요.';
        this.va = { x: -Math.cos(this.ang) * 260, y: -Math.sin(this.ang) * 260 };
        burst(this.sparks, (this.a.x + this.b.x) / 2, (this.a.y + this.b.y) / 2, '#fbbf24', 18);
        chime([392, 294], 0.1);
      }
    } else {
      const f = Math.exp(-dt * 3);
      this.va.x *= f; this.va.y *= f;
      this.a.x += this.va.x * dt; this.a.y += this.va.y * dt; this.b.x -= this.va.x * dt; this.b.y -= this.va.y * dt;
      this.status = { gesture: '결합 끊어짐', hint: '화학 결합을 끊으려면 에너지가 필요해요.', good: true };
      if (this.pt > 1.4 && !this.done) this.done = {
        title: 'H₂를 만들었어요.', outcome: 'H₂ · 수소 분자', label: '생성한 분자', concept: '공유 결합 (Covalent Bond)',
        explain: ['두 수소 원자가 전자쌍을 공유해 공유 결합을 이뤄요.',
          '이 결합을 끊는 데 에너지가 필요했어요. H–H 결합은 약 436 kJ/mol이에요.'],
      };
    }
  }
  cue() { return this.phase === 'free' ? 'close' : this.phase === 'bonded' && this.pt > 1.5 ? 'pinchHold' : null; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    const { a, b, r, phase } = this, t = this.t;
    text(c, phase === 'free' ? 'H  +  H' : 'H  +  H   →   H₂', W / 2, H * 0.12, 30, '#e6edf6', 600);

    if (phase === 'free') {
      c.save(); c.setLineDash([6, 8]); c.lineWidth = this.ready ? 4 : 1.5;
      c.strokeStyle = this.ready ? 'rgba(94,234,212,.9)' : 'rgba(148,163,184,.35)';
      if (this.ready) { c.shadowColor = '#5eead4'; c.shadowBlur = 16; }
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore();
      if (this.hold > 0) ring(c, (a.x + b.x) / 2, (a.y + b.y) / 2 - r * 1.6, 16, this.hold / BOND.HOLD);
      if (this.ready) text(c, '결합 준비', (a.x + b.x) / 2, (a.y + b.y) / 2 - r * 2.4, 16, '#5eead4', 600);
    } else if (phase === 'bonded') {
      drawBond(c, a, b, 1, r * 0.16);
    }
    drawAtom(c, a.x, a.y, r, 'H');
    drawAtom(c, b.x, b.y, r, 'H');

    // Electrons: one per H atom; shared as a pair between the nuclei once bonded.
    c.fillStyle = E_COLOR;
    const dots = phase === 'bonded'
      ? [-1, 1].map(s => {
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, n = { x: -Math.sin(this.ang), y: Math.cos(this.ang) };
        const o = s * r * 0.35 + Math.sin(t * 5 + s) * r * 0.08;
        return { x: m.x + n.x * o, y: m.y + n.y * o };
      })
      : [[a, 0], [b, Math.PI]].map(([p, ph]) => ({ x: p.x + Math.cos(t * 2 + ph) * r * 1.35, y: p.y + Math.sin(t * 2 + ph) * r * 1.35 }));
    for (const d of dots) { c.beginPath(); c.arc(d.x, d.y, Math.max(3, r * 0.1), 0, Math.PI * 2); c.fill(); }

    if (phase !== 'free') {
      text(c, '분자 생성', W / 2, H * 0.2, 14, '#5eead4', 600);
      text(c, 'H₂  ·  수소 분자', W / 2, H * 0.25, 22, '#e6edf6', 500);
      // Bond energy gauge
      const x = 80, y0 = H * 0.32, h = H * 0.36, w = 14;
      text(c, '결합 에너지', x + w / 2, y0 - 22, 11, '#94a3b8', 600);
      c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x, y0, w, h);
      const e = phase === 'broken' ? 1 : this.energy;
      c.fillStyle = e > 0.75 ? '#fbbf24' : '#5eead4'; c.fillRect(x, y0 + h * (1 - e), w, h * e);
      c.fillStyle = '#e6edf6'; c.fillRect(x - 6, y0, w + 12, 2);
      text(c, '436 kJ/mol · 끊어짐', x + w + 12, y0, 11, '#94a3b8', 500, 'left');
    }
    drawSparks(c, this.sparks);
  }
}

// ---------- MODULE 02 · MOLECULE BUILDER ----------
const BUILD = { GRAB: 1.25, SNAP: 1.4 }; // radii in atom radii
const TARGETS = [
  { formula: 'H₂O', name: '물', center: 'O', side: 'H', order: 1, angle: 104.5, centerBonds: 2, geometry: '굽은형', shape: SHAPES.H2O,
    pool: ['O', 'H', 'H', 'C'], why: '산소의 비공유 전자쌍 2개가 H 원자를 아래로 밀어내요.' },
  { formula: 'CO₂', name: '이산화 탄소', center: 'C', side: 'O', order: 2, angle: 180, centerBonds: 4, geometry: '직선형', shape: SHAPES.CO2,
    pool: ['C', 'O', 'O', 'H'], why: '탄소에는 비공유 전자쌍이 없어서 두 이중 결합이 최대한 멀리 떨어져요.' },
];

class BuilderModule {
  constructor(W, H) { this.i = 0; this.attempts = 0; this.sparks = []; this.done = null; this.status = {}; this.t = 0; this.setup(W, H); }
  setup(W, H) {
    this.target = TARGETS[this.i];
    this.r = Math.min(W, H) * 0.055;
    this.slots = [{ role: 'center', side: 0 }, { role: 'side', side: -1 }, { role: 'side', side: 1 }].map(s => ({ ...s, atom: null }));
    this.atoms = shuffle(this.target.pool).map((el, j) => ({ el, j, ...this.homePos(j, W, H), slot: null, heldBy: null, snap: null }));
    this.held = { left: null, right: null };
    this.phase = 'build'; this.pt = 0; this.rot = 0; this.msg = null;
  }
  homePos(j, W, H) { return { x: W * (0.2 + 0.52 * j / 3), y: H * 0.24 + Math.sin(this.t * 1.5 + j) * 6 }; }
  slotPos(s, W, H) {
    const c = { x: W * 0.5, y: H * 0.56 }, half = (this.target.angle / 2) * Math.PI / 180, L = this.r * 2.8;
    return s.role === 'center' ? c : { x: c.x + s.side * Math.sin(half) * L, y: c.y + Math.cos(half) * L };
  }
  update(g, dt, W, H) {
    this.t += dt; this.pt += dt; stepSparks(this.sparks, dt);
    const T = this.target;
    if (this.phase === 'done3d') {
      this.rot = Math.sin(this.pt * 1.1) * 1.4; // swing ±80° so the shape reads in 3D and returns face-on
      this.status = { gesture: '분자 완성', hint: `${T.formula}는 ${T.geometry}이에요. ${T.why}`, good: true };
      if (this.pt > 6) {
        if (this.i < TARGETS.length - 1) { this.i++; this.setup(W, H); this.say = `이번엔 ${this.target.name} 분자를 만들어 봐요.`; }
        else if (!this.done) this.done = {
          title: 'H₂O와 CO₂를 만들었어요.', outcome: 'H₂O (굽은형) · CO₂ (직선형)', label: '만든 분자', concept: '분자 구조 (Molecular Geometry)',
          explain: ['H₂O는 굽은형(104.5°)이에요. 산소의 비공유 전자쌍 2개가 수소를 한쪽으로 밀어요.',
            'CO₂는 직선형(180°)이에요. 탄소의 두 이중 결합이 서로 반대 방향을 향해요.'],
        };
      }
      return;
    }
    const k = follow(dt, 0.25);
    for (const a of this.atoms) {
      a.cool = Math.max(0, (a.cool ?? 0) - dt);
      if (a.slot) moveTo(a, this.slotPos(a.slot, W, H), k);
      else if (!a.heldBy) moveTo(a, this.homePos(a.j, W, H), k * 0.4);
    }
    let label = null;
    for (const a of this.atoms) a.hover = false;
    for (const hand of ['left', 'right']) {
      const p = toPx(g.screen[hand], W, H), pinch = g.pinch[hand];
      let a = this.held[hand];
      if (a && (!p || !pinch)) { // pinch released (or hand lost): place if over a guide circle, else float home
        this.held[hand] = null; a.heldBy = null;
        if (p && a.snap) this.place(a, a.snap, W, H);
        a.snap = null; a = null;
      }
      if (!p) continue;
      if (!a) {
        const near = this.atoms.filter(x => !x.heldBy && !x.slot && !x.cool && dist(x, p) < this.r * BUILD.GRAB).sort((m, n) => dist(m, p) - dist(n, p))[0];
        if (near && pinch) { near.heldBy = hand; this.held[hand] = a = near; }
        else if (near) { near.hover = true; label ??= `엄지와 검지로 집기 · ${ATOMS[near.el].name}`; }
      }
      if (!a) continue;
      moveTo(a, p, k);
      a.snap = this.slots.filter(s => !s.atom && dist(this.slotPos(s, W, H), a) < this.r * BUILD.SNAP)[0] ?? null;
      label = a.snap ? '손가락을 떼면 배치' : `원자 잡음 · ${ATOMS[a.el].name}`;
    }
    this.status = {
      gesture: label ?? (g.left || g.right ? '빈 손' : '손 찾는 중'),
      hint: this.msg ?? `${T.formula}를 만들어 보세요. 엄지와 검지로 원자를 집고, 가이드 원 위에서 놓으세요.`,
      good: !!label && !this.msg,
    };
  }
  place(a, s, W, H) {
    const T = this.target, want = s.role === 'center' ? T.center : T.side, name = ATOMS[a.el].name;
    this.attempts++;
    if (a.el === want) {
      s.atom = a; a.slot = s; this.msg = null;
      const p = this.slotPos(s, W, H); burst(this.sparks, p.x, p.y, E_COLOR, 8); chime([660, 880], 0.07);
      if (this.slots.every(x => x.atom)) { this.phase = 'done3d'; this.pt = 0; chime([523, 659, 784, 1047]); this.say = `${T.name} 분자 완성! ${T.geometry} 모양이에요. ${T.why}`; }
      return;
    }
    // Hint, don't reveal: the atom floats back and the learner re-thinks.
    this.msg = a.el !== T.center && a.el !== T.side ? `화학식을 확인하세요. ${T.formula}에는 ${name}가 없어요.`
      : s.role === 'center' ? `결합 수를 확인하세요. ${name}는 결합을 ${ATOMS[a.el].bonds}개 만들어요. 가운데 원자는 ${T.centerBonds}개가 필요해요.`
      : '다른 배치를 시도해 보세요.';
    a.cool = 1.5; // drifts home before it can be picked up again
    chime([220], 0.08);
    this.say = this.msg;
  }
  cue() { if (this.phase === 'done3d') return null; const a = this.held.left || this.held.right; return a ? (a.snap ? 'release' : 'move') : 'pinch'; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    const T = this.target, r = this.r;
    text(c, `${T.formula} 만들기`, W / 2, H * 0.1, 30, '#e6edf6', 600);
    text(c, `${T.name}  ·  분자 ${this.i + 1} / ${TARGETS.length}`, W / 2, H * 0.1 + 30, 14, '#94a3b8');

    if (this.phase === 'done3d') {
      const L = r * 2.8, P = drawMolecule(c, W / 2, H * 0.5, T.shape.atoms.map(a => ({ el: a.el, x: a.x * L, y: a.y * L })), T.shape.bonds.map(([i, j]) => [i, j, T.order]), this.rot, r * 1.1);
      if (T.angle < 180 && Math.cos(this.rot) > 0.9) { // bond-angle arc when seen face-on
        const [o, h1, h2] = P, a1 = Math.atan2(h1.y - o.y, h1.x - o.x), a2 = Math.atan2(h2.y - o.y, h2.x - o.x);
        c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.beginPath(); c.arc(o.x, o.y, r * 1.7, a2, a1); c.stroke();
      }
      text(c, '분자 생성', W / 2, H * 0.74, 14, '#5eead4', 600);
      text(c, `${T.formula}  ·  ${T.geometry}  ·  ${T.angle}°`, W / 2, H * 0.79, 24, '#e6edf6', 600);
      drawSparks(c, this.sparks);
      return;
    }
    for (const s of this.slots) {
      if (s.atom) continue;
      const p = this.slotPos(s, W, H), active = this.atoms.find(a => a.snap === s);
      c.save(); c.setLineDash([5, 7]); c.lineWidth = active ? 3 : 1.5;
      c.strokeStyle = active ? '#5eead4' : 'rgba(148,163,184,.45)';
      if (active) { c.shadowColor = '#5eead4'; c.shadowBlur = 14; }
      c.beginPath(); c.arc(p.x, p.y, r * 1.05, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    const center = this.slots[0].atom;
    if (center) for (const s of this.slots.slice(1)) if (s.atom) drawBond(c, center, s.atom, T.order, r * 0.14);
    for (const a of this.atoms) drawAtom(c, a.x, a.y, r, a.el, 1, a.heldBy ? '#5eead4' : a.hover ? 'rgba(226,232,240,.55)' : null);
    drawSparks(c, this.sparks);
  }
}

// ---------- MODULE 03 · MATTER MOTION ----------
// Water at 1 atm: melts at 0 °C, boils at 100 °C. Speeds in shoulder widths / s.
const MATTER = { HEAT_MIN: 0.5, MED: 1.6, HEAT_RATE: 30, COOL_RATE: 25, COOL_HOLD: 0.8, GAS_DONE: 4 };
const STATE_KO = { SOLID: '고체', LIQUID: '액체', GAS: '기체' };
const STATE_SAY = {
  'SOLID>LIQUID': '얼음이 녹아서 물이 됐어요! 알갱이들이 자유롭게 움직여요.',
  'LIQUID>GAS': '물이 끓어서 수증기가 됐어요! 알갱이들이 멀리 퍼져요. 두 팔을 크게 벌려 상자를 넓혀 봐요.',
  'GAS>LIQUID': '수증기가 식어서 다시 물이 됐어요.',
  'LIQUID>SOLID': '물이 얼어서 다시 얼음이 됐어요.',
};
const stateOf = T => T < 0 ? 'SOLID' : T < 100 ? 'LIQUID' : 'GAS';

class MatterModule {
  constructor(W, H) {
    this.T = -20; this.t = 0; this.coolT = 0; this.gasT = 0; this.expand = 1; this.coll = 0;
    this.seen = new Set(['SOLID']); this.attempts = 1; this.done = null; this.status = {};
    this.pr = Math.max(6, Math.min(W, H) * 0.012);
    const box = this.box(W, H);
    this.ps = Array.from({ length: 42 }, (_, i) => ({ i, ...this.home(i, box), vx: 0, vy: 0, ph: Math.random() * 6 }));
  }
  box(W, H) {
    const w = Math.min(Math.min(W * 0.4, 520) * this.expand, W * 0.5), h = Math.min(H * 0.5, 380);
    return { x: W / 2 - w / 2, y: H * 0.3, w, h };
  }
  home(i, b) { // 7×6 lattice resting on the container floor
    const s = this.pr * 2.3, col = i % 7, row = Math.floor(i / 7);
    return { x: b.x + b.w / 2 + (col - 3) * s, y: b.y + b.h - this.pr - 2 - row * s };
  }
  update(g, dt, W, H) {
    this.t += dt;
    const s = g.speed, heating = g.both && s > MATTER.HEAT_MIN;
    this.coolT = g.handsLow && s < 0.4 ? this.coolT + dt : 0;
    const cooling = this.coolT > MATTER.COOL_HOLD;
    if (heating) this.T += (s - MATTER.HEAT_MIN) * MATTER.HEAT_RATE * dt;
    if (cooling) this.T -= MATTER.COOL_RATE * dt;
    this.T = clamp(this.T, -40, 160);
    const state = stateOf(this.T); this.seen.add(state);
    if (this.prev && state !== this.prev) this.say = STATE_SAY[this.prev + '>' + state];
    this.prev = state;

    const wantExpand = state === 'GAS' && g.handDist > 1.8 ? clamp(1 + (g.handDist - 1.8) * 0.4, 1, 1.5) : 1;
    this.expand = lerp(this.expand, wantExpand, follow(dt, 0.05));
    this.stepParticles(dt, state, this.box(W, H));

    if (state === 'GAS' && this.seen.size === 3) this.gasT += dt;
    if (this.gasT > MATTER.GAS_DONE && !this.done) this.done = {
      title: '얼음을 수증기로 바꿨어요.', outcome: '고체 → 액체 → 기체', label: '관찰한 상태', concept: '온도와 입자 운동',
      explain: ['온도는 입자의 평균 운동 에너지를 나타내요. 몸의 움직임이 에너지를 더해 입자가 더 빨라졌어요.',
        '고체: 제자리에서 진동. 액체: 가깝지만 자유롭게 이동. 기체: 빠르게 퍼져 용기를 가득 채워요.'],
    };
    const level = s < MATTER.HEAT_MIN ? '낮음' : s < MATTER.MED ? '중간' : '높음';
    this.status = !g.both && !cooling ? { gesture: '손 찾는 중', hint: '카메라 앞에 양손을 들어 주세요.' }
      : cooling ? { gesture: '냉각 중', hint: '에너지가 빠져나가 입자가 느려져요.', good: true }
      : heating ? { gesture: `가열 중 · 에너지 ${level}`, hint: '빠른 움직임 → 더 많은 에너지 → 더 빠른 입자', good: true }
      : this.expand > 1.05 ? { gesture: '팽창 중', hint: '기체는 주어진 공간을 가득 채우도록 퍼져요.', good: true }
      : { gesture: '에너지 낮음', hint: this.seen.has('GAS') ? '팔을 크게 벌려 기체를 팽창시키거나, 손을 내리고 멈춰 냉각해 보세요.' : '양손을 빠르게 흔들어 물을 가열해 보세요.' };
  }
  stepParticles(dt, state, b) {
    const r = this.pr, scale = r / 9;
    const vt = (state === 'LIQUID' ? 60 + this.T * 1.2 : 240 + (this.T - 100) * 3) * scale;
    for (const p of this.ps) {
      if (state === 'SOLID') { // vibrate around a lattice site; amplitude grows with T
        const h = this.home(p.i, b), amp = r * (0.08 + 0.35 * clamp((this.T + 40) / 40));
        const tx = h.x + Math.sin(this.t * 23 + p.ph) * amp, ty = h.y + Math.cos(this.t * 29 + p.ph * 2) * amp;
        const nx = lerp(p.x, tx, follow(dt, 0.15)), ny = lerp(p.y, ty, follow(dt, 0.15));
        p.vx = (nx - p.x) / dt; p.vy = (ny - p.y) / dt; p.x = nx; p.y = ny;
        continue;
      }
      if (state === 'LIQUID') p.vy += 700 * scale * dt;
      const kick = vt * (state === 'GAS' ? 0.03 : 0.12); // random thermal jostling
      p.vx += (Math.random() - 0.5) * kick; p.vy += (Math.random() - 0.5) * kick;
      const sp = Math.hypot(p.vx, p.vy) || 1, f = lerp(1, vt / sp, 0.1); // thermostat
      p.vx *= f; p.vy *= f;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const e = state === 'GAS' ? 1 : 0.5;
      if (p.x < b.x + r) { p.x = b.x + r; p.vx = Math.abs(p.vx) * e; }
      if (p.x > b.x + b.w - r) { p.x = b.x + b.w - r; p.vx = -Math.abs(p.vx) * e; }
      if (p.y < b.y + r) { p.y = b.y + r; p.vy = Math.abs(p.vy) * e; }
      if (p.y > b.y + b.h - r) { p.y = b.y + b.h - r; p.vy = -Math.abs(p.vy) * e; }
    }
    let hits = 0; // ponytail: O(n²) pair scan, fine for 42 particles; grid if n grows
    for (let i = 0; i < this.ps.length; i++) for (let j = i + 1; j < this.ps.length; j++) {
      const a = this.ps[i], c = this.ps[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
      if (d === 0) continue;
      if (d < 2 * r) {
        hits++;
        if (state === 'SOLID') continue;
        const nx = dx / d, ny = dy / d, o = (2 * r - d) / 2;
        a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o;
        const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (rel < 0) { a.vx += rel * nx; a.vy += rel * ny; c.vx -= rel * nx; c.vy -= rel * ny; }
      } else if (state === 'LIQUID' && d < 3.2 * r) { // weak cohesion keeps the liquid together
        const pull = 40 * dt / d; a.vx += dx * pull; a.vy += dy * pull; c.vx -= dx * pull; c.vy -= dy * pull;
      }
    }
    this.coll = lerp(this.coll, state === 'SOLID' ? 0 : hits / dt, 0.05);
  }
  cue() { return this.seen.has('GAS') ? 'open' : 'shake'; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    const b = this.box(W, H), state = stateOf(this.T), r = this.pr;
    text(c, '물 (H₂O)  ·  1 atm', W / 2, H * 0.1, 26, '#e6edf6', 600);
    ['SOLID', 'LIQUID', 'GAS'].forEach((s, i) => {
      const x = W / 2 + (i - 1) * 150, y = H * 0.1 + 44, on = s === state;
      c.fillStyle = on ? 'rgba(94,234,212,.16)' : 'rgba(255,255,255,.04)';
      c.beginPath(); c.roundRect(x - 65, y - 16, 130, 32, 16); c.fill();
      text(c, (this.seen.has(s) && !on ? '✓ ' : '') + `${STATE_KO[s]} · ${s}`, x, y, 13, on ? '#5eead4' : '#94a3b8', 600);
    });
    c.save(); c.strokeStyle = 'rgba(203,213,225,.5)'; c.lineWidth = 2; c.fillStyle = 'rgba(148,163,184,.05)';
    c.beginPath(); c.roundRect(b.x, b.y, b.w, b.h, 10); c.fill(); c.stroke(); c.restore();
    const warm = clamp((this.T + 20) / 160);
    const col = `rgb(${Math.round(lerp(125, 251, warm))},${Math.round(lerp(196, 146, warm))},${Math.round(lerp(255, 60, warm))})`;
    for (const p of this.ps) {
      const g = c.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 1, p.x, p.y, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(20,30,50,.9)');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
    }
    text(c, `충돌 / 초  ${Math.round(this.coll)}`, b.x, b.y + b.h + 22, 12, '#94a3b8', 500, 'left');
    if (this.expand > 1.02) text(c, `부피 × ${this.expand.toFixed(2)}`, b.x + b.w, b.y + b.h + 22, 12, '#5eead4', 600, 'right');

    // Thermometer: −40 … 160 °C with melting / boiling marks.
    const tx = b.x - 50, ty = b.y, th = b.h, yOf = T => ty + th * (1 - (T + 40) / 200);
    c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.roundRect(tx - 7, ty, 14, th, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.roundRect(tx - 7, yOf(this.T), 14, ty + th - yOf(this.T), 7); c.fill();
    for (const [T, s] of [[0, '0 °C 녹는점'], [100, '100 °C 끓는점']]) {
      c.fillStyle = '#cbd5e1'; c.fillRect(tx - 12, yOf(T), 24, 1.5);
      text(c, s, tx - 18, yOf(T), 11, '#94a3b8', 500, 'right');
    }
    text(c, `${Math.round(this.T)} °C`, tx, ty - 20, 18, '#e6edf6', 600);
  }
}

export const MODULES = [
  {
    num: '01', name: 'ATOM BOND', desc: '두 수소 원자를 모아 H₂를 만들고, 다시 떼어 보세요.', needs: 'both',
    elements: ['H'], anim: 'together', steps: ['검지 끝 모으기', '원자 결합'],
    guide: [['close', '검지 끝 모으기', '결합'], ['hold', '멈춰서 유지', '확인'], ['pinch', '엄지·검지로 집고 유지', '결합 끊기']],
    howto: '원자 결합 실험이에요. 두 손의 집게손가락이 수소 원자를 하나씩 잡고 있어요. 두 손가락 끝을 가까이 모아서 붙인 채로 잠깐 기다리면 수소 분자가 만들어져요. 그다음 엄지와 집게손가락을 붙여서 집은 채로 기다려요. 에너지 게이지가 가득 차면 결합이 끊어져요.',
    create: (W, H) => new BondModule(W, H),
  },
  {
    num: '02', name: 'MOLECULE BUILDER', desc: '원자를 잡아 배치해 H₂O와 CO₂를 만들어 보세요.', needs: 'one',
    elements: ['H', 'O', 'C'], anim: 'grab', steps: ['엄지·검지로 집기', '가이드 원 위에서 놓기'],
    guide: [['pinch', '엄지·검지로 집기', '잡기 · 이동'], ['open', '손가락 떼기', '배치']],
    howto: '분자 만들기 실험이에요. 위에 떠 있는 원자에 집게손가락을 가져가서, 엄지와 집게손가락으로 집어요. 집은 채로 가운데 점선 동그라미로 옮긴 다음 손가락을 벌려 놓아요. 가운데 자리에는 어떤 원자가 와야 할지 생각해 봐요. 먼저 물 분자를 만들어 봐요.',
    create: (W, H) => new BuilderModule(W, H),
  },
  {
    num: '03', name: 'MATTER MOTION', desc: '손을 흔들어 얼음이 수증기가 될 때까지 가열해 보세요.', needs: 'both',
    elements: [], anim: 'shake', steps: ['양손 빠르게 흔들기', '입자 가열'],
    guide: [['wave', '빠르게 움직이기', '가열'], ['down', '손 내리고 멈추기', '냉각'], ['open', '팔 벌리기 (기체)', '팽창']],
    howto: '물질의 상태 실험이에요. 지금 상자 안은 얼음이에요. 두 손을 빠르게 흔들면 온도가 올라가서 얼음이 녹고, 계속 흔들면 물이 끓어서 수증기가 돼요. 두 손을 아래로 내리고 가만히 있으면 식어요.',
    create: (W, H) => new MatterModule(W, H),
  },
];
