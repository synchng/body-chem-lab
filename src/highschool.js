// 고등 난이도 · High School Chemistry — 10 gesture lessons.
// Same contract as MODULES: update(g, dt, W, H) sets this.status and, when finished, this.done
// ({ title, outcome, label, concept, explain, quiz: { q, options, answer } }); draw(c, W, H).
// Flow: gesture → visible change → short concept (concept screen) → one quiz question (quiz screen).
import { clamp, dist, lerp } from './gesture.js';
import { drawAtom, drawBond, ring, text, chime, burst, stepSparks, drawSparks, follow, moveTo, toPx } from './modules.js';

const INK = '#e6edf6', MUTED = '#94a3b8', ACCENT = '#5eead4', WARN = '#fbbf24';
const NO_HAND = { gesture: '손을 찾고 있어요', hint: '카메라에 손을 보여 주세요. 집게손가락(검지)을 쭉 펴요!' };
const NO_HANDS = { gesture: '손을 찾고 있어요', hint: '두 손을 카메라에 보여 주세요. 집게손가락을 쭉 펴요!' };
const hand = g => g.screen.right ?? g.screen.left;                 // either fingertip, 0..1 screen coords
const height = p => clamp((1 - p.y - 0.15) / 0.7);                // fingertip height → 0 (low) .. 1 (high)
const TAU = Math.PI * 2;

function ball(c, x, y, r, label, color, ink = '#0b1424', alpha = 1) {
  c.save(); c.globalAlpha = alpha;
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, color); g.addColorStop(1, '#1e293b');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  if (label) text(c, label, x, y + r * 0.04, Math.round(r * (label.length > 2 ? 0.55 : 0.8)), ink, 700);
  c.restore();
}
function panel(c, x, y, w, h) {
  c.fillStyle = 'rgba(16,29,51,.72)'; c.strokeStyle = 'rgba(148,163,184,.18)'; c.lineWidth = 1;
  c.beginPath(); c.roundRect(x, y, w, h, 14); c.fill(); c.stroke();
}
function vbar(c, x, y, w, h, frac, color, mark = null) {
  c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.roundRect(x, y, w, h, w / 2); c.fill();
  c.fillStyle = color; c.beginPath(); c.roundRect(x, y + h * (1 - clamp(frac)), w, h * clamp(frac), w / 2); c.fill();
  if (mark != null) { c.fillStyle = WARN; c.fillRect(x - 8, y + h * (1 - mark) - 1, w + 16, 3); }
}
const dot = (c, x, y, r, color) => { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const meter = (v, n = 5) => { const k = Math.round(clamp(v) * n); return '●'.repeat(k) + '○'.repeat(n - k); }; // amounts as dots, not numbers

class Lesson {
  constructor() { this.t = 0; this.hold = 0; this.attempts = 1; this.mistakes = 0; this.done = null; this.status = {}; this.sparks = []; }
  // Hold a condition for `sec` seconds to confirm. A hold that breaks after a real try counts as an attempt.
  holdFor(cond, dt, sec = 1.2) {
    if (!cond && this.hold > 0.3) this.attempts++;
    this.hold = cond ? this.hold + dt : 0;
    return this.hold >= sec;
  }
  finish(done) { if (!this.done) { this.done = done; chime([523, 659, 784]); } }
  sayOnce(key, line) { (this.said ??= new Set()).has(key) || (this.said.add(key), this.say = line); } // main.js speaks and clears this.say
  holdRing(c, x, y, sec = 1.2) { if (this.hold > 0) ring(c, x, y, 18, this.hold / sec); }
}

// ---------- 01 몰과 아보가드로 수 ----------
class MoleLesson extends Lesson {
  constructor() { super(); this.n = 0.5; this.target = 1.5; }
  get nr() { return Math.round(this.n * 10) / 10; }
  update(g, dt) {
    this.t += dt;
    const p = hand(g);
    if (p) this.n = lerp(this.n, height(p) * 3, follow(dt, 0.2));
    const hit = Math.abs(this.nr - this.target) < 0.05;
    if (this.holdFor(!!p && hit, dt)) this.finish({
      title: '물 알갱이를 딱 맞게 모았어요!', outcome: '노란 선까지 물 알갱이 모으기', label: '맞춘 양', concept: '몰과 아보가드로 수',
      explain: ['몰은 아주 작은 알갱이를 셀 때 쓰는 "큰 묶음" 이름이에요. 연필을 "한 다스"로 묶어 세는 것과 같아요.', '묶음이 늘어나면 알갱이 수도, 무게도 똑같이 늘어나요.'],
      quiz: { q: '몰은 무엇일까요?', options: ['아주 작은 알갱이를 세는 큰 묶음 이름', '물의 색깔', '온도를 재는 도구', '무게를 재는 저울'], answer: 0 },
    });
    this.status = !p ? NO_HAND : hit ? { gesture: '딱 맞아요!', hint: '좋아요! 손을 그대로 멈춰 주세요…', good: true }
      : { gesture: `물 알갱이 ${meter(this.nr / 3)}`, hint: '손을 올리면 물 알갱이가 늘고, 내리면 줄어요. 노란 선에 맞춰 봐요!' };
  }
  cue() { return this.done ? null : 'updown'; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    const n = this.nr;
    text(c, '물 알갱이 모으기', W / 2, H * 0.1, 28, INK, 600);
    text(c, '병의 물이 노란 선에 닿게 해요', W / 2, H * 0.1 + 32, 15, WARN, 600);
    // particle grid: more hand height → more water particles
    const gx = W * 0.2, gy = H * 0.3, s = Math.min(W, H) * 0.045;
    panel(c, gx - s, gy - s, s * 8, s * 7);
    for (let i = 0; i < 30; i++) {
      const x = gx + (i % 6) * s + s / 2, y = gy + Math.floor(i / 6) * s + s / 2;
      if (i < Math.round(n * 10)) drawAtom(c, x, y, s * 0.36, 'O'); else dot(c, x, y, 2, 'rgba(148,163,184,.3)');
    }
    text(c, '● 물 알갱이 묶음', gx + s * 3, gy + s * 5.6, 12, MUTED);
    // jar that fills with the amount, yellow target line
    const jx = W * 0.56, jy = H * 0.26, jw = Math.min(W * 0.14, 170), jh = H * 0.42;
    c.fillStyle = 'rgba(94,200,255,.45)'; c.fillRect(jx, jy + jh * (1 - n / 3), jw, jh * n / 3);
    c.strokeStyle = 'rgba(203,213,225,.75)'; c.lineWidth = 2; c.beginPath(); c.roundRect(jx, jy, jw, jh, 12); c.stroke();
    c.fillStyle = WARN; c.fillRect(jx - 10, jy + jh * (1 - this.target / 3) - 2, jw + 20, 4);
    this.holdRing(c, jx + jw / 2, jy - 26);
  }
}

// ---------- 02 화학 반응식과 양적 관계: 2H₂ + O₂ → 2H₂O ----------
class StoichLesson extends Lesson {
  constructor() { super(); this.h = 2; this.o = 2; this.tried = new Set(); }
  update(g, dt) {
    this.t += dt;
    const L = g.screen.left, R = g.screen.right;
    if (L) this.h = Math.round(height(L) * 4);
    if (R) this.o = Math.round(height(R) * 4);
    const { h, o } = this, x = Math.min(h / 2, o), exact = h > 0 && o > 0 && h === 2 * o;
    if (h && o) this.tried.add(`${h}:${o}`);
    this.attempts = Math.max(1, this.tried.size);
    if (this.holdFor(!!(L && R) && exact, dt)) this.finish({
      title: '재료를 하나도 남기지 않았어요!', outcome: '수소와 산소가 남김없이 물이 됐어요', label: '맞춘 비율', concept: '화학 반응식과 양적 관계',
      explain: ['요리 레시피처럼 재료를 섞는 비율이 정해져 있어요. 수소 둘과 산소 하나가 만나면 물 둘이 돼요 (몰수비).', '재료 하나가 모자라면 다른 재료는 남아요. 모자란 재료(한계 반응물)가 물을 얼마나 만들지 정해요.'],
      quiz: { q: '수소가 산소보다 훨씬 많으면 어떻게 될까요?', options: ['수소가 남아요', '산소가 남아요', '아무것도 남지 않아요'], answer: 0 },
    });
    const left = h - 2 * x;
    this.status = !(L && R) ? NO_HANDS
      : exact ? { gesture: '남는 재료 없음!', hint: '딱 맞아요! 손을 그대로 멈춰 주세요…', good: true }
      : { gesture: '재료를 맞추는 중', hint: !h || !o ? '왼손을 올리면 수소, 오른손을 올리면 산소가 늘어요.'
        : left > 0 ? '산소가 모자라요! 수소가 남았어요. 산소를 늘리거나 수소를 줄여 봐요.' : '수소가 모자라요! 산소가 남았어요. 수소를 늘리거나 산소를 줄여 봐요.' };
  }
  cue() { return this.done ? null : 'updown2'; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    const { h, o } = this, x = Math.min(h / 2, o), r = Math.min(W, H) * 0.022;
    text(c, '수소  +  산소  →  물', W / 2, H * 0.1, 30, INK, 600);
    text(c, '남는 재료가 없게 맞춰 봐요', W / 2, H * 0.1 + 32, 14, MUTED);
    const col = (cx, label, items) => {
      text(c, label, cx, H * 0.26, 15, INK, 600);
      items.forEach((draw, i) => draw(cx, H * 0.33 + i * r * 3.2));
    };
    const H2 = (dim) => (cx, y) => { drawAtom(c, cx - r * 0.7, y, r, 'H', dim ? 0.35 : 1); drawAtom(c, cx + r * 0.7, y, r, 'H', dim ? 0.35 : 1); };
    const O2 = (dim) => (cx, y) => { drawAtom(c, cx - r * 0.75, y, r * 1.1, 'O', dim ? 0.35 : 1); drawAtom(c, cx + r * 0.75, y, r * 1.1, 'O', dim ? 0.35 : 1); };
    const H2O = (cx, y) => { drawAtom(c, cx - r * 0.9, y + r * 0.6, r * 0.8, 'H'); drawAtom(c, cx + r * 0.9, y + r * 0.6, r * 0.8, 'H'); drawAtom(c, cx, y, r * 1.1, 'O'); };
    col(W * 0.2, '수소', Array.from({ length: h }, () => H2(false)));
    col(W * 0.36, '산소', Array.from({ length: o }, () => O2(false)));
    text(c, '→', W * 0.48, H * 0.4, 40, ACCENT, 600);
    col(W * 0.6, '물', Array.from({ length: 2 * x }, () => H2O));
    col(W * 0.74, '남은 재료', [...Array.from({ length: h - 2 * x }, () => H2(true)), ...Array.from({ length: o - x }, () => O2(true))]);
    this.holdRing(c, W / 2, H * 0.78);
  }
}

// ---------- 03 몰농도, 희석과 혼합 ----------
class MolarityLesson extends Lesson {
  constructor() { super(); this.V = 0.25; this.target = 1.0; this.pts = Array.from({ length: 25 }, () => [Math.random(), Math.random()]); }
  get M() { return 0.5 / this.V; }
  update(g, dt) {
    this.t += dt;
    if (g.both) this.V = lerp(this.V, clamp(0.25 + (g.handDist - 0.3) * 0.5, 0.25, 1), follow(dt, 0.15));
    const Vr = Math.round(this.V * 20) / 20, hit = Math.abs(0.5 / Vr - this.target) < 0.01;
    if (this.holdFor(g.both && hit, dt)) this.finish({
      title: '딱 알맞은 진하기를 만들었어요!', outcome: '노란 선까지 물을 채웠어요', label: '맞춘 진하기', concept: '몰농도, 희석과 혼합',
      explain: ['주스에 물을 더 부으면 맛이 연해지죠? 녹아 있는 알갱이(용질) 수는 그대로인데 물만 많아져서 연해진 거예요 (희석).',
        '진하기(몰농도)는 물속에 알갱이가 얼마나 빽빽한지예요. 두 용액을 섞으면 알갱이도 물도 모두 합쳐져요.'],
      quiz: { q: '주스에 물을 더 부으면 어떻게 될까요?', options: ['연해져요', '진해져요', '그대로예요'], answer: 0 },
    });
    this.status = !g.both ? NO_HANDS : hit ? { gesture: '딱 맞아요!', hint: '딱 맞아요! 손을 그대로 멈춰 주세요…', good: true }
      : { gesture: `물 양 ${meter(this.V)}`, hint: '두 손을 벌리면 물이 늘어나서 연해지고, 모으면 진해져요. 노란 선까지 채워 봐요!' };
  }
  cue() { return this.done ? null : 'spread'; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    const Vr = Math.round(this.V * 20) / 20, M = 0.5 / Vr;
    text(c, '소금물 연하게 만들기', W / 2, H * 0.1, 28, INK, 600);
    text(c, '물을 노란 선까지 채워요', W / 2, H * 0.1 + 32, 15, WARN, 600);
    const bw = Math.min(W * 0.2, 240), bh = H * 0.48, bx = W * 0.38 - bw / 2, by = H * 0.24, lh = bh * this.V;
    c.fillStyle = `rgba(94,200,255,${0.12 + 0.28 * clamp(M / 2)})`; c.fillRect(bx, by + bh - lh, bw, lh);
    for (const [fx, fy] of this.pts) { dot(c, bx + 8 + fx * (bw - 16), by + bh - 6 - fy * (lh - 12), 4, '#e2e8f0'); }
    c.strokeStyle = 'rgba(203,213,225,.7)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(bx, by - 10); c.lineTo(bx, by + bh); c.lineTo(bx + bw, by + bh); c.lineTo(bx + bw, by - 10); c.stroke();
    c.fillStyle = WARN; c.fillRect(bx - 10, by + bh * 0.5 - 2, bw + 20, 4); // target: half-full
    text(c, '● 소금 알갱이 (개수는 그대로!)', bx + bw / 2, by + bh + 22, 12, MUTED);
    // colour key: the bluer the water, the stronger (more concentrated)
    const kx = W * 0.58, ky = H * 0.32;
    panel(c, kx - 20, ky - 30, Math.min(W * 0.2, 250), H * 0.26);
    text(c, '색이 진할수록 진한 소금물', kx, ky, 14, INK, 600, 'left');
    [0.25, 0.5, 1].forEach((f, i) => { c.fillStyle = `rgba(94,200,255,${0.12 + 0.28 * f})`; c.beginPath(); c.roundRect(kx + i * 60, ky + 24, 48, 48, 8); c.fill(); });
    text(c, '연해요', kx + 24, ky + 90, 12, MUTED); text(c, '진해요', kx + 144, ky + 90, 12, MUTED);
    c.strokeStyle = WARN; c.lineWidth = 2; c.beginPath(); c.roundRect(kx + 60, ky + 24, 48, 48, 8); c.stroke(); // target shade
    this.holdRing(c, bx + bw / 2, by - 30);
  }
}

// ---------- 04 주기율표와 원소의 주기적 성질 ----------
// Atomic radius (pm; metallic for metals, covalent for nonmetals; noble gases omitted) and 1st ionization energy (kJ/mol).
const ELEMENTS = [
  ['Li', '리튬', 152, 520], ['Be', '베릴륨', 112, 899], ['B', '붕소', 85, 801], ['C', '탄소', 77, 1086],
  ['N', '질소', 75, 1402], ['O', '산소', 73, 1314], ['F', '플루오린', 72, 1681], ['Ne', '네온', null, 2081],
  ['Na', '나트륨', 186, 496], ['Mg', '마그네슘', 160, 738], ['Al', '알루미늄', 143, 578], ['Si', '규소', 118, 787],
  ['P', '인', 110, 1012], ['S', '황', 103, 1000], ['Cl', '염소', 99, 1251], ['Ar', '아르곤', null, 1521],
];
class PeriodicLesson extends Lesson {
  constructor() { super(); this.was = { left: false, right: false }; this.hover = null; this.msg = null; }
  cell(i, W, H) { const cw = Math.min(W * 0.085, 100); return { x: W / 2 + (i % 8 - 3.5) * cw, y: H * (i < 8 ? 0.36 : 0.58), cw }; }
  update(g, dt, W, H) {
    this.t += dt; this.hover = null;
    for (const k of ['left', 'right']) {
      const p = toPx(g.screen[k], W, H);
      if (!p) { this.was[k] = false; continue; }
      const i = ELEMENTS.findIndex((_, j) => { const q = this.cell(j, W, H); return Math.abs(p.x - q.x) < q.cw / 2 && Math.abs(p.y - q.y) < H * 0.1; });
      if (i >= 0) this.hover = i;
      if (i >= 0 && g.pinch[k] && !this.was[k]) { // pinch = choose
        if (ELEMENTS[i][0] === 'Na') this.finish({
          title: '가장 큰 원자 Na를 찾았어요!', outcome: 'Na · 가장 큰 원자', label: '찾은 원소', concept: '주기율표와 주기적 성질',
          explain: ['오른쪽으로 갈수록 가운데(원자핵)가 전자를 더 세게 당겨서 원자가 작아지고, 전자를 떼기도 어려워져요 (이온화 에너지↑).',
            '아래 줄로 갈수록 양파처럼 전자 껍질이 한 겹씩 늘어서 원자가 커지고, 바깥 전자를 떼기 쉬워져요.'],
          quiz: { q: '아랫줄 원자가 윗줄 원자보다 큰 까닭은?', options: ['전자 껍질이 한 겹 더 있어서', '색이 달라서', '더 뜨거워서'], answer: 0 },
        });
        else { this.attempts++; this.mistakes++; chime([220], 0.08); this.msg = ELEMENTS[i][2] == null ? '맨 오른쪽 원소는 크기를 비교하지 않아요. 다른 원소를 골라 봐요.'
          : i < 8 ? '윗줄과 아랫줄을 비교해 봐요. 아랫줄 원자는 껍질이 하나 더 있어요!' : '같은 줄에서 동그라미가 가장 큰 쪽은 왼쪽일까요, 오른쪽일까요?'; }
      }
      this.was[k] = g.pinch[k];
    }
    const e = this.hover != null && ELEMENTS[this.hover];
    this.status = !hand(g) ? NO_HAND
      : e ? { gesture: `${e[0]} ${e[1]} · 크기 ${e[2] ? meter(e[2] / 186) : '비교 안 해요'} · 전자 떼기 어려움 ${meter(e[3] / 2100)}`, hint: this.msg ?? '동그라미가 가장 큰 원소를 엄지와 검지로 콕 집어 봐요.', good: !this.msg }
      : { gesture: '원소 위로 검지를 움직여 봐요', hint: this.msg ?? '동그라미가 클수록 큰 원자, 노란 막대가 길수록 전자를 떼기 어려워요.' };
  }
  cue() { return this.done ? null : 'pinch'; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    text(c, '원소 표 (주기율표)', W / 2, H * 0.1, 28, INK, 600);
    text(c, '가장 큰 원자를 찾아 집어요', W / 2, H * 0.1 + 32, 15, WARN, 600);
    ELEMENTS.forEach(([sym, , r, ie], i) => {
      const { x, y, cw } = this.cell(i, W, H), on = this.hover === i;
      c.fillStyle = on ? 'rgba(94,234,212,.14)' : 'rgba(16,29,51,.6)'; c.strokeStyle = on ? ACCENT : 'rgba(148,163,184,.2)';
      c.beginPath(); c.roundRect(x - cw / 2 + 3, y - H * 0.1, cw - 6, H * 0.2, 10); c.fill(); c.stroke();
      if (r) ball(c, x, y - H * 0.02, Math.max(6, (r / 186) * cw * 0.34), sym, '#93c5fd');
      else { c.strokeStyle = MUTED; c.setLineDash([3, 3]); c.beginPath(); c.arc(x, y - H * 0.02, cw * 0.14, 0, TAU); c.stroke(); c.setLineDash([]); text(c, sym, x, y - H * 0.02, 13, INK, 700); }
      c.fillStyle = WARN; c.fillRect(x - cw * 0.3, y + H * 0.075, cw * 0.6 * (ie / 2100), 5);
    });
    text(c, '동그라미가 클수록 큰 원자   ▬ 노란 막대가 길수록 전자를 떼기 어려워요', W / 2, H * 0.72, 13, MUTED);
  }
}

// ---------- 05 이온결합 / 공유결합 / 금속결합 ----------
const BOND_STAGES = [
  { a: 'Na', b: 'Cl', ca: '#a78bfa', cb: '#4ade80', ea: 1, eb: 7, name: '이온 결합', note: 'Na가 전자를 Cl에게 줬어요! (+)와 (−)가 된 둘이 서로 끌어당겨요.' },
  { a: 'Cl', b: 'Cl', ca: '#4ade80', cb: '#4ade80', ea: 7, eb: 7, name: '공유 결합', note: '두 Cl이 전자 한 쌍을 사이좋게 같이 써요 → Cl₂' },
  { a: 'Na', b: 'Na', ca: '#a78bfa', cb: '#a78bfa', ea: 1, eb: 1, name: '금속 결합', note: '전자들이 모두의 것이 되어 바다처럼 자유롭게 돌아다녀요' },
];
class BondTypesLesson extends Lesson {
  constructor(W, H) { super(); this.i = 0; this.phase = 'free'; this.pt = 0; this.a = { x: W * 0.3, y: H * 0.5 }; this.b = { x: W * 0.7, y: H * 0.5 }; this.sea = Array.from({ length: 24 }, () => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0 })); }
  update(g, dt, W, H) {
    this.t += dt; this.pt += dt; stepSparks(this.sparks, dt);
    const S = BOND_STAGES[this.i], r = Math.min(W, H) * 0.07;
    if (this.phase === 'free') {
      const k = follow(dt), L = toPx(g.screen.left, W, H), R = toPx(g.screen.right, W, H);
      moveTo(this.a, L ?? { x: W * 0.3, y: H * 0.5 }, k); moveTo(this.b, R ?? { x: W * 0.7, y: H * 0.5 }, k);
      const { a, b } = this, d = dist(a, b), min = r * 2.1; // spheres never pass through each other
      if (d > 0 && d < min) { const s = (min - d) / 2 / d, ux = (b.x - a.x) * s, uy = (b.y - a.y) * s; a.x -= ux; a.y -= uy; b.x += ux; b.y += uy; }
      const ready = g.both && g.handDist < 0.55;
      if (this.holdFor(ready, dt, 1.0)) { this.phase = 'bonded'; this.pt = 0; this.sayOnce(`b${this.i}`, S.note); burst(this.sparks, (this.a.x + this.b.x) / 2, (this.a.y + this.b.y) / 2, '#7dd3fc'); chime([523, 659, 784]); }
      this.status = !g.both ? NO_HANDS : ready ? { gesture: '붙을 준비!', hint: '손가락 끝을 붙인 채로 멈춰 주세요…', good: true }
        : { gesture: `${S.a} + ${S.b} 다가가는 중`, hint: `두 집게손가락 끝을 가까이 모아 ${S.a}와 ${S.b}를 붙여 봐요.` };
    } else {
      for (const e of this.sea) { e.vx += (Math.random() - 0.5) * 0.08; e.vy += (Math.random() - 0.5) * 0.08; e.vx *= 0.95; e.vy *= 0.95; e.x = (e.x + e.vx * dt + 1) % 1; e.y = (e.y + e.vy * dt + 1) % 1; }
      this.status = { gesture: S.name, hint: S.note, good: true };
      if (this.pt > 3.5) {
        if (this.i < 2) { this.i++; this.phase = 'free'; this.pt = 0; this.hold = 0; const N = BOND_STAGES[this.i]; this.sayOnce(`s${this.i}`, `이번엔 ${N.name}이에요. ${N.a}와 ${N.b}를 붙여 봐요.`); }
        else this.finish({
          title: '세 가지 결합을 모두 만들었어요!', outcome: 'NaCl · Cl₂ · Na(금속)', label: '만든 결합', concept: '이온·공유·금속 결합',
          explain: ['이온 결합은 전자를 "주고받기": 준 쪽은 (+), 받은 쪽은 (−)가 되어 자석처럼 끌어당겨요.',
            '공유 결합은 전자를 "같이 쓰기", 금속 결합은 전자가 "모두의 것"이 되어 돌아다녀요. 그래서 금속은 전기가 잘 통해요.'],
          quiz: { q: '전자가 자유롭게 돌아다녀서, 고체일 때도 전기가 잘 통하는 결합은?', options: ['이온 결합', '공유 결합', '금속 결합'], answer: 2 },
        });
      }
    }
  }
  valence(c, x, y, r, n, offset = 0) { for (let j = 0; j < n; j++) { const a = offset + j * TAU / 8 + (j % 2) * 0.18; dot(c, x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, 3.5, '#7dd3fc'); } }
  cue() { return this.phase === 'free' ? 'close' : null; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    const S = BOND_STAGES[this.i], r = Math.min(W, H) * 0.07, { a, b } = this;
    text(c, `${'●'.repeat(this.i + 1)}${'○'.repeat(2 - this.i)}  ${S.name}`, W / 2, H * 0.1, 28, INK, 600);
    text(c, `${S.a} + ${S.b}`, W / 2, H * 0.1 + 32, 16, MUTED, 600);
    if (this.phase === 'free') {
      if (this.hold > 0) { c.strokeStyle = 'rgba(94,234,212,.8)'; c.setLineDash([6, 8]); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]); }
      ball(c, a.x, a.y, r, S.a, S.ca); ball(c, b.x, b.y, r, S.b, S.cb);
      this.valence(c, a.x, a.y, r, S.ea, this.t); this.valence(c, b.x, b.y, r, S.eb, -this.t * 0.5);
      this.holdRing(c, (a.x + b.x) / 2, (a.y + b.y) / 2 - r * 1.7, 1.0);
    } else if (this.i === 0) { // ionic: electron hops Na → Cl
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, p = clamp(this.pt / 1.2);
      ball(c, m.x - r * 1.1, m.y, r * 0.8, p < 1 ? 'Na' : 'Na⁺', S.ca); ball(c, m.x + r * 1.15, m.y, r * 1.1, p < 1 ? 'Cl' : 'Cl⁻', S.cb);
      this.valence(c, m.x + r * 1.15, m.y, r * 1.1, 7 + (p >= 1));
      if (p < 1) dot(c, lerp(m.x - r * 2, m.x + r * 0.2, p), m.y - r * 1.2 * Math.sin(p * Math.PI), 5, WARN);
      if (p >= 1) text(c, '+  ⟷  −', m.x, m.y + r * 1.9, 18, WARN, 700);
    } else if (this.i === 1) { // covalent: shared pair
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      drawBond(c, { x: m.x - r * 1.2, y: m.y }, { x: m.x + r * 1.2, y: m.y }, 1, r * 0.14);
      ball(c, m.x - r * 1.2, m.y, r, 'Cl', S.ca); ball(c, m.x + r * 1.2, m.y, r, 'Cl', S.cb);
      dot(c, m.x, m.y - 7, 5, WARN); dot(c, m.x, m.y + 7, 5, WARN);
      text(c, '공유 전자쌍', m.x, m.y - r * 1.5, 13, WARN, 600);
    } else { // metallic: cation lattice + electron sea
      const x0 = W * 0.3, y0 = H * 0.3, w = W * 0.4, h = H * 0.38;
      for (let j = 0; j < 12; j++) ball(c, x0 + (j % 4 + 0.5) * w / 4, y0 + (Math.floor(j / 4) + 0.5) * h / 3, r * 0.5, 'Na⁺', S.ca);
      for (const e of this.sea) dot(c, x0 + e.x * w, y0 + e.y * h, 4, '#7dd3fc');
      text(c, '● 자유 전자', W / 2, y0 + h + 22, 13, '#7dd3fc', 600);
    }
    drawSparks(c, this.sparks);
  }
}

// ---------- 06 극성·무극성, 루이스 구조 ----------
class PolarityLesson extends Lesson {
  constructor() { super(); this.E = 0; this.w = Array.from({ length: 5 }, () => Math.random() * TAU); this.co2 = Array.from({ length: 5 }, () => Math.random() * TAU); }
  update(g, dt) {
    this.t += dt;
    this.E = lerp(this.E, g.both ? clamp((1.8 - g.handDist) / 1.3) : 0, follow(dt, 0.15));
    // Polar H₂O turns its O (δ−) toward the + plate on the left: target angle 0 (H side points right). CO₂ has no net dipole.
    this.w = this.w.map(a => { let d = Math.atan2(Math.sin(-a), Math.cos(-a)); return a + d * this.E * 3 * dt + (Math.random() - 0.5) * (1 - this.E) * 4 * dt; });
    this.co2 = this.co2.map(a => a + (Math.random() - 0.5) * 4 * dt + 0.3 * dt);
    if (this.E > 0.75) this.sayOnce('strong', '전기가 세졌어요! 물 분자와 이산화 탄소를 비교하면서 그대로 기다려요.');
    if (this.holdFor(g.both && this.E > 0.75, dt, 1.5)) this.finish({
      title: '물 분자만 줄을 섰어요!', outcome: 'H₂O 극성 · CO₂ 무극성', label: '관찰 결과', concept: '극성·무극성, 루이스 구조',
      explain: ['물(H₂O)은 부메랑처럼 굽어 있어서 한쪽은 살짝 (−), 다른 쪽은 살짝 (+)예요 (극성). 그래서 전기 쪽으로 방향을 돌려요.',
        'CO₂는 일자 모양이라 양쪽이 똑같이 당겨서 힘이 없어져요 (무극성). 그래서 방향을 돌리지 않아요.'],
      quiz: { q: '전기 쪽으로 방향을 돌린 분자는 누구였나요?', options: ['물 (H₂O)', '이산화 탄소 (CO₂)', '둘 다 안 돌았어요'], answer: 0 },
    });
    this.status = !g.both ? NO_HANDS : this.E > 0.75 ? { gesture: `전기 세기 ${meter(this.E)}`, hint: '물 분자는 줄을 서는데, CO₂는 어떤가요? 손을 그대로 멈춰 봐요…', good: true }
      : { gesture: `전기 세기 ${meter(this.E)}`, hint: '두 손을 가까이 모을수록 전기가 세져요. 분자들이 어떻게 움직이는지 봐요!' };
  }
  lewis(c, x, y, s) { // H₂O and CO₂ Lewis structures with lone pairs
    const pair = (px, py, ang) => { const nx = Math.cos(ang + Math.PI / 2) * 4, ny = Math.sin(ang + Math.PI / 2) * 4; dot(c, px + nx, py + ny, 2.5, WARN); dot(c, px - nx, py - ny, 2.5, WARN); };
    // H₂O (bent)
    text(c, 'O', x, y, s, INK, 700); text(c, 'H', x - s * 1.3, y + s * 1.1, s, INK, 700); text(c, 'H', x + s * 1.3, y + s * 1.1, s, INK, 700);
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(x - s * 0.4, y + s * 0.35); c.lineTo(x - s * 0.95, y + s * 0.8); c.moveTo(x + s * 0.4, y + s * 0.35); c.lineTo(x + s * 0.95, y + s * 0.8); c.stroke();
    pair(x - s * 0.45, y - s * 0.7, -0.6); pair(x + s * 0.45, y - s * 0.7, 0.6);
    text(c, 'H₂O · 굽은형 · 극성', x, y + s * 2.3, 13, ACCENT, 600);
    // CO₂ (linear)
    const X = x + s * 7;
    text(c, 'O', X - s * 1.6, y + s * 0.4, s, INK, 700); text(c, 'C', X, y + s * 0.4, s, INK, 700); text(c, 'O', X + s * 1.6, y + s * 0.4, s, INK, 700);
    for (const sgn of [-1, 1]) for (const o of [-3, 3]) { c.beginPath(); c.moveTo(X + sgn * s * 0.45, y + s * 0.4 + o); c.lineTo(X + sgn * s * 1.15, y + s * 0.4 + o); c.stroke(); }
    for (const sgn of [-1, 1]) { pair(X + sgn * s * 1.6, y - s * 0.3, 0); pair(X + sgn * s * 1.6, y + s * 1.1, 0); }
    text(c, 'CO₂ · 직선형 · 무극성', X, y + s * 2.3, 13, MUTED, 600);
  }
  cue() { return this.done ? null : 'close'; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    text(c, '전기 속의 물 분자와 이산화 탄소', W / 2, H * 0.08, 28, INK, 600);
    this.lewis(c, W * 0.36, H * 0.17, 20);
    const x0 = W * 0.3, x1 = W * 0.7, y0 = H * 0.4, y1 = H * 0.74, r = Math.min(W, H) * 0.02;
    c.fillStyle = `rgba(248,113,113,${0.3 + this.E * 0.6})`; c.fillRect(x0 - 16, y0, 8, y1 - y0); text(c, '+', x0 - 12, y0 - 14, 20, '#f87171', 700);
    c.fillStyle = `rgba(96,165,250,${0.3 + this.E * 0.6})`; c.fillRect(x1 + 8, y0, 8, y1 - y0); text(c, '−', x1 + 12, y0 - 14, 20, '#60a5fa', 700);
    const half = 104.5 / 2 * Math.PI / 180;
    this.w.forEach((a, i) => {
      const x = x0 + (i + 0.5) * (x1 - x0) / 5, y = y0 + (y1 - y0) * 0.28;
      c.save(); c.translate(x, y); c.rotate(a);
      for (const s of [-1, 1]) drawAtom(c, Math.cos(half) * r * 1.6, s * Math.sin(half) * r * 1.6, r * 0.65, 'H');
      drawAtom(c, 0, 0, r, 'O'); c.restore();
    });
    this.co2.forEach((a, i) => {
      const x = x0 + (i + 0.5) * (x1 - x0) / 5, y = y0 + (y1 - y0) * 0.75;
      c.save(); c.translate(x, y); c.rotate(a);
      drawAtom(c, -r * 1.7, 0, r * 0.85, 'O'); drawAtom(c, r * 1.7, 0, r * 0.85, 'O'); drawAtom(c, 0, 0, r * 0.9, 'C'); c.restore();
    });
    text(c, 'H₂O', x0 - 40, y0 + (y1 - y0) * 0.28, 13, MUTED, 600); text(c, 'CO₂', x0 - 40, y0 + (y1 - y0) * 0.75, 13, MUTED, 600);
    this.holdRing(c, W / 2, y1 + 26, 1.5);
  }
}

// ---------- 07 산화·환원과 전자 이동: Zn + Cu²⁺ → Zn²⁺ + Cu ----------
class RedoxLesson extends Lesson {
  constructor(W, H) { super(); this.moved = 0; this.held = null; this.e = [0, 1].map(i => ({ i, x: 0, y: 0, home: true })); }
  update(g, dt, W, H) {
    this.t += dt; stepSparks(this.sparks, dt);
    const r = Math.min(W, H) * 0.08, zn = { x: W * 0.33, y: H * 0.48 }, cu = { x: W * 0.67, y: H * 0.48 };
    this.e.forEach(e => { if (e.home && e !== this.held) { const a = this.t * 1.5 + e.i * Math.PI; e.x = zn.x + Math.cos(a) * r * 1.5; e.y = zn.y + Math.sin(a) * r * 1.5; } });
    const k = ['right', 'left'].find(s => g.screen[s]), p = k && toPx(g.screen[k], W, H), pinch = k && g.pinch[k];
    if (this.held && (!p || !pinch)) { // release: onto Cu²⁺ → transferred
      if (p && dist(p, cu) < r * 1.6) { this.held.home = false; this.moved++; if (this.moved === 1) this.sayOnce('one', '잘했어요! 전자를 하나 더 옮겨 봐요.'); burst(this.sparks, cu.x, cu.y, '#fbbf24', 10); chime([660, 880], 0.07); }
      else if (p) { this.attempts++; this.mistakes++; } // dropped on the wrong spot (not a lost hand)
      this.held = null;
    }
    if (!this.held && p && pinch) this.held = this.e.find(e => e.home && dist(e, p) < r * 0.7) ?? null;
    if (this.held && p) moveTo(this.held, p, follow(dt, 0.35));
    if (this.moved === 2) this.finish({
      title: '전자를 모두 옮겼어요!', outcome: 'Zn은 전자를 잃고(산화) · Cu²⁺는 전자를 얻었어요(환원)', label: '이동한 전자', concept: '산화·환원과 전자 이동',
      explain: ['전자를 "잃으면" 산화, "받으면" 환원이에요. 공을 던지는 친구와 받는 친구처럼 두 가지는 항상 같이 일어나요.',
        'Zn은 전자를 줘서 산화됐고, Cu²⁺는 전자를 받아 환원됐어요. 남의 전자를 빼앗아 산화시키는 쪽(Cu²⁺)을 산화제라고 해요.'],
      quiz: { q: '전자를 받은 친구(환원된 쪽)는 누구일까요?', options: ['회색 Zn', '주황색 Cu²⁺'], answer: 1 },
    });
    this.status = !p ? NO_HAND : this.held ? { gesture: '전자를 옮기는 중', hint: '주황색 Cu²⁺ 위에서 손가락을 벌려 놓아 줘요.', good: true }
      : { gesture: `전자 옮기기 ${'●'.repeat(this.moved)}${'○'.repeat(2 - this.moved)}`, hint: 'Zn 주위를 도는 노란 전자를 엄지와 검지로 집어서, 주황색 Cu²⁺에게 가져다줘요.' };
  }
  cue() { return this.done ? null : this.held ? 'move' : 'pinch'; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    const r = Math.min(W, H) * 0.08, zn = { x: W * 0.33, y: H * 0.48 }, cu = { x: W * 0.67, y: H * 0.48 }, done = this.moved === 2;
    text(c, '전자 옮기기 놀이', W / 2, H * 0.1, 28, INK, 600);
    ball(c, zn.x, zn.y, r, done ? 'Zn²⁺' : 'Zn', '#cbd5e1'); ball(c, cu.x, cu.y, r, done ? 'Cu' : 'Cu²⁺', '#fb923c');
    text(c, '주는 친구', zn.x, zn.y + r * 2.1, 15, MUTED, 600);
    text(c, '받는 친구', cu.x, cu.y + r * 2.1, 15, MUTED, 600);
    if (this.moved) { text(c, '전자를 잃음 → 산화', zn.x, zn.y - r * 2, 14, '#f87171', 600); text(c, '전자를 얻음 → 환원', cu.x, cu.y - r * 2, 14, '#60a5fa', 600); }
    for (const e of this.e) if (e.home) { dot(c, e.x, e.y, 9, WARN); text(c, 'e⁻', e.x, e.y - 16, 12, WARN, 700); }
    for (let j = 0; j < this.moved; j++) dot(c, cu.x + (j ? 1 : -1) * r * 0.6, cu.y + r * 1.2, 7, WARN);
    c.strokeStyle = 'rgba(251,191,36,.35)'; c.setLineDash([6, 8]); c.beginPath(); c.arc(cu.x, cu.y, r * 1.6, 0, TAU); c.stroke(); c.setLineDash([]);
    drawSparks(c, this.sparks);
  }
}

// ---------- 08 중화 반응과 중화 적정 ----------
const ACID = { M: 0.1, mL: 20 }, BASE_M = 0.1; // HCl 0.1 M 20 mL titrated with NaOH 0.1 M → equivalence at 20 mL
export function titrationPH(vB) {
  const nH = ACID.M * ACID.mL / 1000, nOH = BASE_M * vB / 1000, V = (ACID.mL + vB) / 1000, d = (nH - nOH) / V;
  if (Math.abs(d) < 1e-7) return 7;
  return d > 0 ? -Math.log10(d) : 14 + Math.log10(-d);
}
class TitrationLesson extends Lesson {
  constructor(W, H) { super(); this.stage = 'ions'; this.vB = 0; this.pt = 0; this.idle = 0; this.a = { x: W * 0.3, y: H * 0.5 }; this.b = { x: W * 0.7, y: H * 0.5 }; this.drops = []; }
  update(g, dt, W, H) {
    this.t += dt; this.pt += dt; stepSparks(this.sparks, dt);
    if (this.stage === 'ions') {
      const k = follow(dt), L = toPx(g.screen.left, W, H), R = toPx(g.screen.right, W, H);
      moveTo(this.a, L ?? { x: W * 0.3, y: H * 0.5 }, k); moveTo(this.b, R ?? { x: W * 0.7, y: H * 0.5 }, k);
      if (this.holdFor(g.both && g.handDist < 0.55, dt, 0.8)) { this.sayOnce('water', '신 것과 쓴 것이 만나서 순한 물이 됐어요!'); this.stage = 'water'; this.pt = 0; burst(this.sparks, (this.a.x + this.b.x) / 2, this.a.y, '#7dd3fc'); chime([523, 784]); }
      this.status = !g.both ? NO_HANDS : { gesture: '신 것 + 쓴 것', hint: '두 집게손가락 끝을 모아서 H⁺(신 것)와 OH⁻(쓴 것)를 만나게 해 봐요.', good: this.hold > 0 };
      return;
    }
    if (this.stage === 'water') { this.status = { gesture: '신 것 + 쓴 것 → 물!', hint: '신 것(H⁺)과 쓴 것(OH⁻)이 만나서 순한 물이 됐어요! 이걸 중화라고 해요.', good: true }; if (this.pt > 2.5) { this.stage = 'titrate'; this.sayOnce('drip', '이제 엄지와 집게손가락을 붙이고 있으면 쓴 물이 한 방울씩 떨어져요. 분홍색이 되면 손가락을 벌려요.'); } return; }
    const pinch = g.pinch.left || g.pinch.right;
    if (pinch) { this.vB = Math.min(40, this.vB + 2 * dt); if (Math.random() < 0.3) this.drops.push({ y: 0 }); }
    for (const d of this.drops) d.y += dt * 1.8; this.drops = this.drops.filter(d => d.y < 1);
    const pH = titrationPH(this.vB), pink = pH >= 8.2;
    this.idle = pinch ? 0 : this.idle + dt;
    if (pink) this.sayOnce('pink', '분홍색이 됐어요! 손가락을 벌리고 잠깐 기다려요.');
    if (pink && this.idle > 1) this.finish({
      title: '딱 맞게 섞는 지점을 찾았어요!', outcome: '분홍색이 되는 순간에 멈췄어요', label: '멈춘 곳', concept: '중화 반응과 중화 적정',
      explain: ['신 것(산)의 H⁺와 쓴 것(염기)의 OH⁻가 하나씩 짝지어 물이 돼요 (중화). 둘이 딱 같아지는 순간을 중화점이라고 해요.',
        '중화점을 지나는 순간 분홍색으로 변하는 물감(페놀프탈레인)이 "지금이야!" 하고 알려 줘요.'],
      quiz: { q: '물감이 분홍색으로 변하는 때는 언제일까요?', options: ['신 것이 모두 없어진 바로 그때', '첫 방울을 넣었을 때', '색은 절대 안 변해요'], answer: 0 },
    });
    this.status = !hand(g) ? NO_HAND : pinch ? { gesture: '똑똑 떨어지는 중', hint: '색 막대의 화살표를 보세요. 분홍색이 되면 손가락을 벌려 멈춰요!', good: true }
      : pink ? { gesture: '분홍색으로 변했어요!', hint: '손가락을 벌린 채로 잠깐 기다려요…', good: true }
      : { gesture: '쓴 것을 넣을 준비', hint: '엄지와 검지로 집고 있으면 쓴 것(염기)이 한 방울씩 떨어져요. 분홍색이 되면 멈춰요!' };
  }
  cue() { return this.done ? null : this.stage === 'ions' ? 'close' : this.stage === 'water' ? null : titrationPH(this.vB) >= 8.2 ? 'release' : 'pinchHold'; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    const r = Math.min(W, H) * 0.06;
    if (this.stage !== 'titrate') {
      text(c, '신 것 (H⁺)  +  쓴 것 (OH⁻)  →  물', W / 2, H * 0.12, 30, INK, 600);
      if (this.stage === 'ions') { ball(c, this.a.x, this.a.y, r, 'H⁺', '#f87171'); ball(c, this.b.x, this.b.y, r * 1.2, 'OH⁻', '#60a5fa'); this.holdRing(c, (this.a.x + this.b.x) / 2, this.a.y - r * 1.8, 0.8); }
      else { const m = { x: (this.a.x + this.b.x) / 2, y: (this.a.y + this.b.y) / 2 }; drawAtom(c, m.x, m.y, r, 'O'); drawAtom(c, m.x - r * 1.1, m.y + r * 0.8, r * 0.65, 'H'); drawAtom(c, m.x + r * 1.1, m.y + r * 0.8, r * 0.65, 'H'); text(c, '물', m.x, m.y + r * 2.2, 18, ACCENT, 700); }
      drawSparks(c, this.sparks); return;
    }
    const pH = titrationPH(this.vB), pink = clamp((pH - 8.2) / 2);
    text(c, '신 것에 쓴 것을 한 방울씩', W / 2, H * 0.08, 26, INK, 600);
    text(c, '분홍색으로 변하면 멈춰요', W / 2, H * 0.08 + 30, 14, WARN, 600);
    // burette
    const bx = W * 0.3, top = H * 0.16, bh = H * 0.3;
    c.strokeStyle = 'rgba(203,213,225,.7)'; c.lineWidth = 2; c.strokeRect(bx - 10, top, 20, bh);
    c.fillStyle = 'rgba(96,165,250,.35)'; c.fillRect(bx - 9, top + bh * (this.vB / 50), 18, bh * (1 - this.vB / 50));
    for (const d of this.drops) dot(c, bx, top + bh + 10 + d.y * H * 0.12, 3, '#60a5fa');
    // flask
    const fy = H * 0.62, fw = W * 0.09;
    c.fillStyle = pink > 0 ? `rgba(236,72,153,${0.25 + pink * 0.55})` : 'rgba(226,232,240,.18)';
    c.beginPath(); c.moveTo(bx - 12, fy - H * 0.12); c.lineTo(bx + 12, fy - H * 0.12); c.lineTo(bx + fw, fy + H * 0.1); c.lineTo(bx - fw, fy + H * 0.1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(203,213,225,.7)'; c.stroke();
    // sour ↔ bitter colour strip with a moving arrow (pH shown as colour, not a number)
    const px = W * 0.46, py = H * 0.36, pw = Math.min(W * 0.3, 380), ph = 28;
    panel(c, px - 24, py - 60, pw + 48, ph + 130);
    const grad = c.createLinearGradient(px, 0, px + pw, 0);
    ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'].forEach((col, i, a) => grad.addColorStop(i / (a.length - 1), col));
    c.fillStyle = grad; c.beginPath(); c.roundRect(px, py, pw, ph, 14); c.fill();
    const mx = px + pw * clamp(pH / 14);
    c.fillStyle = INK; c.beginPath(); c.moveTo(mx, py - 4); c.lineTo(mx - 10, py - 22); c.lineTo(mx + 10, py - 22); c.closePath(); c.fill();
    text(c, '신 맛', px, py + ph + 24, 14, '#f87171', 600, 'left'); text(c, '순해요', px + pw / 2, py + ph + 24, 14, '#4ade80', 600);
    text(c, '쓴 맛', px + pw, py + ph + 24, 14, '#a78bfa', 600, 'right');
    text(c, pink > 0 ? '분홍색! 이제 멈춰요' : '아직 신 쪽이에요', px + pw / 2, py + ph + 58, 15, pink > 0 ? '#f472b6' : MUTED, 700);
  }
}

// ---------- 09 화학 평형과 르 샤틀리에 원리: N₂O₄ ⇌ 2NO₂ ----------
// Fixed N atoms: a + b/2 = 10 (a = N₂O₄, b = NO₂). Kc = (b/V)² / (a/V) → b² + (K·V/2)·b − 10·K·V = 0.
const EQ_K = 10.7, UNITS = 20;
export const eqNO2 = V => { const kv = EQ_K * V; return (-(kv / 2) + Math.sqrt((kv / 2) ** 2 + 40 * kv)) / 2; };
class EquilibriumLesson extends Lesson {
  constructor() { super(); this.V = 1; this.b = eqNO2(1); this.seen = { comp: false, exp: false }; this.p = Array.from({ length: UNITS }, () => ({ x: Math.random(), y: Math.random(), vx: Math.random() - 0.5, vy: Math.random() - 0.5 })); }
  update(g, dt) {
    this.t += dt;
    if (g.both) this.V = lerp(this.V, clamp(0.5 + (g.handDist - 0.4), 0.5, 2), follow(dt, 0.12));
    const beq = eqNO2(this.V);
    this.b += (beq - this.b) * Math.min(1, dt * 0.9); // shifts toward the new equilibrium over ~1 s
    const settled = Math.abs(this.b - beq) < 0.25;
    if (settled && this.V < 0.7 && !this.seen.comp) { this.seen.comp = true; if (!this.seen.exp) this.sayOnce('comp', '잘했어요! 흰색 짝꿍이 늘었죠? 이번엔 두 손을 크게 벌려 상자를 넓혀요.'); }
    if (settled && this.V > 1.6 && !this.seen.exp) { this.seen.exp = true; if (!this.seen.comp) this.sayOnce('exp', '잘했어요! 갈색 알갱이가 늘었죠? 이번엔 두 손을 모아 상자를 꾹 눌러요.'); }
    for (const q of this.p) { q.x += q.vx * dt * 0.4; q.y += q.vy * dt * 0.4; if (q.x < 0 || q.x > 1) q.vx *= -1; if (q.y < 0 || q.y > 1) q.vy *= -1; q.x = clamp(q.x); q.y = clamp(q.y); }
    if (this.seen.comp && this.seen.exp) this.finish({
      title: '상자를 누르고 늘려 봤어요!', outcome: '압축 → N₂O₄ 쪽 · 팽창 → NO₂ 쪽', label: '관찰한 이동', concept: '화학 평형과 르 샤틀리에 원리',
      explain: ['누가 밀면 반대로 버티는 것처럼, 평형은 바뀐 것을 되돌리려는 쪽으로 움직여요 (르 샤틀리에 원리).',
        '좁은 방에 사람이 꽉 차면 둘씩 짝을 지어 자리를 줄이죠? 상자를 누르면 NO₂ 둘이 짝(N₂O₄)을 짓고, 넓히면 다시 흩어져요.'],
      quiz: { q: '상자를 꾹 누르면 알갱이들은 어떻게 될까요?', options: ['짝을 지어서 수가 줄어요', '흩어져서 수가 늘어요', '그대로예요'], answer: 0 },
    });
    const Q = (this.b / this.V) ** 2 / ((10 - this.b / 2) / this.V);
    const dir = settled ? '멈춤 (평형)' : Q > EQ_K ? '짝짓는 중 → N₂O₄ 늘어남' : '흩어지는 중 → NO₂ 늘어남';
    this.status = !g.both ? NO_HANDS : { gesture: dir, good: !settled,
      hint: `${this.seen.comp ? '✓' : '○'} 두 손을 모아 상자 누르기   ${this.seen.exp ? '✓' : '○'} 두 손을 벌려 상자 넓히기 · 주황색 알갱이 수를 봐요!` };
  }
  cue() { const { comp, exp } = this.seen; return comp && exp ? null : comp ? 'open' : 'close'; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    text(c, '갈색 알갱이  ⇄  흰색 짝꿍', W / 2, H * 0.1, 28, INK, 600);
    const bw = Math.min(W * 0.2, 260) * this.V, bh = H * 0.42, bx = W * 0.4 - bw / 2, by = H * 0.24, r = Math.min(W, H) * 0.013;
    const b = 2 * Math.round(this.b / 2); // NO₂ drawn in pairs so N atoms are conserved
    c.fillStyle = `rgba(194,65,12,${0.08 + 0.3 * clamp(this.b / this.V / 16)})`; c.fillRect(bx, by, bw, bh);
    c.strokeStyle = 'rgba(203,213,225,.7)'; c.lineWidth = 2; c.strokeRect(bx, by, bw, bh);
    for (let i = 0; i < UNITS; i++) {
      const q = this.p[i], x = bx + r * 2 + q.x * (bw - r * 4), y = by + r * 2 + q.y * (bh - r * 4);
      if (i < b) ball(c, x, y, r, '', '#c2410c');
      else if ((i - b) % 2 === 0) { ball(c, x - r * 0.8, y, r, '', '#e2e8f0'); ball(c, x + r * 0.8, y, r, '', '#e2e8f0'); }
    }
    // amounts as bars, not numbers
    const rx = W * 0.56, a = 10 - this.b / 2, bw2 = Math.min(W * 0.18, 220);
    panel(c, rx - 20, H * 0.26, bw2 + 40, H * 0.3);
    const hbar = (y, label, frac, col) => {
      text(c, label, rx, y, 14, INK, 600, 'left');
      c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.roundRect(rx, y + 14, bw2, 14, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.roundRect(rx, y + 14, bw2 * clamp(frac), 14, 7); c.fill();
    };
    hbar(H * 0.31, '갈색 알갱이', this.b / UNITS, '#c2410c');
    hbar(H * 0.39, '흰색 짝꿍', a / (UNITS / 2), '#e2e8f0');
    hbar(H * 0.47, '상자 크기', (this.V - 0.5) / 1.5, ACCENT);
    text(c, '● 갈색 알갱이 (NO₂)   ●● 흰색 짝꿍 (N₂O₄)', bx + bw / 2, by + bh + 22, 12, MUTED);
  }
}

// ---------- 10 반응 속도와 온도·농도·촉매 ----------
// Arrhenius: k ∝ exp(−Ea / RT). Rate = k[A]. Relative to 300 K, no catalyst, [A] = 0.2 M.
const R_GAS = 8.314, EA = 60000, EA_CAT = 40000;
export const relRate = (T, conc, cat) => Math.exp(-(cat ? EA_CAT : EA) / (R_GAS * T) + EA / (R_GAS * 300)) * conc / 0.2;
class RateLesson extends Lesson {
  constructor() { super(); this.T = 300; this.conc = 0.2; this.cat = false; this.was = false; this.seen = { T: false, c: false, cat: false }; this.ps = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() * TAU, prod: 0 })); }
  update(g, dt) {
    this.t += dt;
    if (g.speed > 0.5) this.T = Math.min(400, this.T + (g.speed - 0.5) * 40 * dt); else this.T = Math.max(300, this.T - 4 * dt);
    if (g.both) this.conc = lerp(this.conc, clamp(0.2 + (g.handDist - 0.5) * 0.5, 0.2, 1), follow(dt, 0.15));
    const pinch = g.pinch.left || g.pinch.right;
    if (pinch && !this.was) { this.cat = !this.cat; chime([this.cat ? 880 : 440], 0.06); }
    this.was = pinch;
    if (this.T > 350 && !this.seen.T) { this.seen.T = true; this.sayOnce('T', '뜨거워졌어요! 알갱이가 더 빨리 달려요.'); }
    if (this.conc > 0.8 && !this.seen.c) { this.seen.c = true; this.sayOnce('c', '알갱이가 많아졌어요! 더 자주 부딪혀요.'); }
    if (this.cat && !this.seen.cat) { this.seen.cat = true; this.sayOnce('cat', '촉매를 켰어요! 넘어야 할 언덕이 낮아졌어요.'); }
    const rate = relRate(this.T, this.conc, this.cat), n = Math.round(8 + this.conc * 32), sp = Math.sqrt(this.T / 300);
    this.ps.forEach((p, i) => {
      p.a += (Math.random() - 0.5) * 2 * dt; p.x = (p.x + Math.cos(p.a) * 0.15 * sp * dt + 1) % 1; p.y = (p.y + Math.sin(p.a) * 0.15 * sp * dt + 1) % 1;
      if (i < n && !p.prod && Math.random() < Math.min(0.5, 0.02 * Math.log10(1 + rate) * dt * 30)) p.prod = 1.2; // visual only: brighter flashes when faster
      p.prod = Math.max(0, p.prod - dt);
    });
    if (this.seen.T && this.seen.c && this.seen.cat) this.finish({
      title: '반응을 빠르게 하는 방법을 모두 찾았어요!', outcome: '뜨겁게 · 알갱이 많이 · 촉매 → 더 빨리!', label: '확인한 요인', concept: '반응 속도와 온도·농도·촉매',
      explain: ['알갱이끼리 힘차게 부딪혀야 반응해요. 뜨거우면 더 빨리 달려서 세게 부딪히고, 많으면 더 자주 부딪혀요.',
        '촉매는 넘어야 할 언덕(활성화 에너지)을 낮춰 주는 지름길이에요. 출발점과 도착점(반응열)은 그대로예요.'],
      quiz: { q: '촉매가 하는 일은 무엇일까요?', options: ['반응열을 줄인다', '넘어야 할 언덕(활성화 에너지)을 낮춘다', '평형 상수를 바꾼다', '생성물의 양을 늘린다'], answer: 1 },
    });
    const s = this.seen;
    this.status = !hand(g) ? NO_HAND : { gesture: `온도 ${meter((this.T - 300) / 100)} · 알갱이 ${meter((this.conc - 0.2) / 0.8)} · 촉매 ${this.cat ? '켜짐' : '꺼짐'}`, good: g.speed > 0.5,
      hint: `${s.T ? '✓' : '○'} 손을 빠르게 흔들어 뜨겁게   ${s.c ? '✓' : '○'} 두 손을 벌려 알갱이 많이   ${s.cat ? '✓' : '○'} 엄지·검지로 집어 촉매 켜기` };
  }
  cue() { const s = this.seen; return this.done ? null : !s.T ? 'shake' : !s.c ? 'open' : !s.cat ? 'pinch' : null; } // gesture coach: what to do now (src/coach.js key)
  draw(c, W, H) {
    const rate = relRate(this.T, this.conc, this.cat), n = Math.round(8 + this.conc * 32), r = Math.min(W, H) * 0.011;
    text(c, '알갱이가 부딪혀 반응해요', W / 2, H * 0.1, 28, INK, 600);
    const bx = W * 0.2, by = H * 0.24, bw = W * 0.3, bh = H * 0.42;
    c.strokeStyle = 'rgba(203,213,225,.6)'; c.lineWidth = 2; c.strokeRect(bx, by, bw, bh);
    this.ps.slice(0, n).forEach(p => dot(c, bx + p.x * bw, by + p.y * bh, r, p.prod ? WARN : '#60a5fa'));
    text(c, '● 반응 전   ● 방금 반응했어요', bx + bw / 2, by + bh + 20, 12, MUTED);
    // rate bar (log scale)
    vbar(c, bx + bw + 30, by, 16, bh, Math.log10(rate) / 4, ACCENT);
    text(c, '빠르기', bx + bw + 38, by - 16, 13, INK, 600);
    // energy diagram with activation-energy hump
    const ex = W * 0.56, ey = H * 0.26, ew = Math.min(W * 0.2, 260), eh = H * 0.36;
    panel(c, ex - 20, ey - 20, ew + 40, eh + 60);
    const base = ey + eh * 0.55, prod = ey + eh * 0.8, hump = (Ea) => base - eh * 0.5 * (Ea / EA);
    const curve = (Ea, color, dash) => { c.strokeStyle = color; c.lineWidth = 2.5; c.setLineDash(dash); c.beginPath(); c.moveTo(ex, base); c.lineTo(ex + ew * 0.2, base); c.bezierCurveTo(ex + ew * 0.4, hump(Ea), ex + ew * 0.55, hump(Ea), ex + ew * 0.75, prod); c.lineTo(ex + ew, prod); c.stroke(); c.setLineDash([]); };
    curve(EA, this.cat ? 'rgba(148,163,184,.5)' : ACCENT, []);
    if (this.cat) curve(EA_CAT, WARN, [6, 5]);
    text(c, this.cat ? '낮아진 언덕' : '넘어야 할 언덕', ex + ew * 0.5, hump(this.cat ? EA_CAT : EA) - 26, 13, this.cat ? WARN : ACCENT, 600);
    text(c, '출발', ex + ew * 0.1, base - 14, 12, MUTED); text(c, '도착', ex + ew * 0.88, prod - 14, 12, MUTED);
    text(c, `온도 ${meter((this.T - 300) / 100, 3)}`, ex, ey + eh + 20, 13, '#f87171', 600, 'left');
    text(c, `알갱이 ${meter((this.conc - 0.2) / 0.8, 3)}`, ex + ew / 2, ey + eh + 20, 13, '#60a5fa', 600);
    text(c, `촉매 ${this.cat ? '켜짐' : '꺼짐'}`, ex + ew, ey + eh + 20, 13, this.cat ? WARN : MUTED, 600, 'right');
  }
}

const L = (num, name, desc, anim, steps, guide, legend, Cls, needs = 'both') => ({ num, name, desc, anim, steps, guide, legend, needs, elements: [], create: (W, H) => new Cls(W, H) });
const KID = [
  '몰은 "묶음 이름"이에요. 연필 여러 자루를 "한 다스"로 묶어 부르듯, 아주아주 많은 작은 알갱이를 "한 몰"로 묶어 불러요.',
  '빵 레시피처럼 재료 비율이 정해져 있어요. 수소 둘과 산소 하나가 만나면 물 둘! 재료가 모자라면 나머지는 남아요.',
  '주스에 물을 더 부으면 연해지죠? 녹아 있는 알갱이 수는 같은데 물이 많아져서 연해지는 거예요.',
  '원자는 양파처럼 껍질이 있어요. 아랫줄일수록 껍질이 많아서 크고, 오른쪽일수록 가운데가 세게 당겨서 작아요.',
  '전자를 주고받으면 이온 결합, 같이 쓰면 공유 결합, 모두 함께 쓰면 금속 결합이에요.',
  '물 분자는 한쪽은 (+), 한쪽은 (−)인 작은 막대 같아서 전기가 오면 방향을 돌려요. CO₂는 양쪽이 똑같아서 안 돌아요.',
  '공을 던진 친구와 받은 친구처럼! 전자를 잃으면 산화, 받으면 환원이에요.',
  '신 것(산)과 쓴 것(염기)을 딱 맞게 섞으면 순한 물이 돼요. 딱 맞는 순간 색이 바뀌어 알려 줘요.',
  '좁은 방에 사람이 꽉 차면 둘씩 짝을 지어 자리를 줄이죠? 상자를 누르면 알갱이도 짝을 지어요.',
  '알갱이끼리 부딪혀야 반응해요. 뜨거우면 빨리 달리고, 많으면 자주 부딪히고, 촉매는 언덕을 낮춰 줘요.',
];
const HOWTO = [
  '물 알갱이 모으기예요. 손을 카메라에 보여 주세요. 손을 위로 올리면 물 알갱이가 늘어나고, 아래로 내리면 줄어들어요. 오른쪽 병의 물이 노란 선에 닿으면, 손을 멈추고 잠깐 기다려요.',
  '수소와 산소로 물을 만들어요. 왼손을 올리면 수소가, 오른손을 올리면 산소가 늘어나요. 남는 재료가 하나도 없게 두 손 높이를 맞춘 다음, 그대로 멈춰 주세요. 수소가 산소보다 더 많이 필요해요.',
  '소금물을 연하게 만들어요. 두 손을 카메라에 보여 주세요. 두 손 사이를 벌리면 물이 늘어나서 연해지고, 모으면 진해져요. 물이 노란 선까지 차면 손을 멈추고 기다려요.',
  '원소 표에서 가장 큰 원자를 찾아요. 집게손가락으로 원소 위를 가리켜 보세요. 동그라미가 가장 큰 원소를 찾으면, 엄지와 집게손가락을 꼭 붙여서 집어요. 틀리면 하트가 하나 줄어요.',
  '세 가지 결합을 만들어요. 두 손의 집게손가락이 원자를 하나씩 잡고 있어요. 두 손가락 끝을 천천히 모아서, 붙인 채로 잠깐 기다리면 결합이 생겨요. 모두 세 번 해 봐요.',
  '전기 속에서 분자가 어떻게 움직이는지 봐요. 두 손은 전기를 만드는 판이에요. 두 손을 가까이 모을수록 전기가 세져요. 두 손을 모은 채로 기다리면서, 물 분자와 이산화 탄소가 어떻게 다른지 살펴봐요.',
  '전자를 옮겨요. 회색 아연 주위를 도는 노란 공이 전자예요. 엄지와 집게손가락으로 전자를 집은 채로 주황색 구리 위로 옮긴 다음, 손가락을 벌려 놓아 줘요. 두 번 옮기면 성공이에요. 다른 곳에 놓으면 하트가 하나 줄어요.',
  '먼저 두 집게손가락 끝을 모아서 빨간 공과 파란 공을 만나게 해요. 그다음에는 엄지와 집게손가락을 붙이고 있는 동안 쓴 물이 한 방울씩 떨어져요. 플라스크가 분홍색으로 변하면 바로 손가락을 벌리고 기다려요.',
  '상자를 누르고 늘려요. 두 손을 모으면 상자가 작아지고, 벌리면 커져요. 먼저 두 손을 모아 상자를 꾹 누르고 잠깐 기다려요. 그다음 두 손을 크게 벌려 상자를 넓히고 기다려요. 갈색 알갱이가 어떻게 변하는지 봐요.',
  '반응을 빠르게 만드는 세 가지를 해 봐요. 첫째, 손을 빠르게 흔들어서 뜨겁게 만들어요. 둘째, 두 손을 크게 벌려 알갱이를 많이 넣어요. 셋째, 엄지와 집게손가락을 붙였다 떼서 촉매를 켜요.',
];
export const HS_LESSONS = [
  L('01', '몰과 아보가드로 수', '손을 위아래로 움직여 몰수를 조절해요.', 'updown', ['손 위아래로 움직이기', '몰수 조절'],
    [['updown', '손 높이', '몰수 조절'], ['hold', '목표에서 유지', '확인']], [['#e5484d', '물 알갱이 묶음']], MoleLesson, 'one'),
  L('02', '화학 반응식과 양적 관계', '양손 높이로 H₂와 O₂의 몰수를 맞춰요.', 'updown', ['양손 높이 조절', '몰수비 맞추기'],
    [['updown', '왼손 높이', 'H₂ 몰수'], ['updown', '오른손 높이', 'O₂ 몰수'], ['hold', '맞으면 유지', '확인']], [['#dfe6ee', 'H'], ['#e5484d', 'O']], StoichLesson),
  L('03', '몰농도, 희석과 혼합', '양손 간격으로 용액 부피를 바꿔 농도를 봐요.', 'together', ['양손 간격 조절', '부피 → 몰농도 변화'],
    [['open', '양손 벌리기', '부피↑ (희석)'], ['close', '양손 모으기', '부피↓'], ['hold', '노란 선에서 멈추기', '확인']], [['#e2e8f0', '소금 알갱이']], MolarityLesson),
  L('04', '주기율표와 주기적 성질', '원소 위를 가리키고 가장 큰 원자를 집어요.', 'grab', ['원소 가리키기', '엄지·검지로 집기'],
    [['grab', '원소 가리키기', '성질 보기'], ['pinch', '엄지·검지로 집기', '선택']], [['#93c5fd', '원 크기 = 반지름'], ['#fbbf24', '막대 = 이온화 에너지']], PeriodicLesson, 'one'),
  L('05', '이온·공유·금속 결합', '원자를 손으로 가까이해 세 가지 결합을 만들어요.', 'together', ['검지 끝 모으기', '결합 형성'],
    [['close', '검지 끝 모으기', '결합'], ['hold', '멈춰서 유지', '확인']], [['#a78bfa', 'Na'], ['#4ade80', 'Cl'], ['#7dd3fc', '전자']], BondTypesLesson),
  L('06', '극성·무극성, 루이스 구조', '두 손을 전극판처럼 써서 분자의 정렬을 봐요.', 'together', ['양손 모으기', '전기장 세기↑'],
    [['close', '양손 모으기', '전기장↑'], ['open', '양손 벌리기', '전기장↓']], [['#e5484d', 'O'], ['#dfe6ee', 'H'], ['#5f6b7a', 'C']], PolarityLesson),
  L('07', '산화·환원과 전자 이동', '전자를 집어 Zn에서 Cu²⁺로 옮겨요.', 'grab', ['전자 집기', 'Cu²⁺로 옮기기'],
    [['pinch', '전자 집기', '잡기'], ['open', 'Cu²⁺ 위에서 떼기', '전자 이동']], [['#fbbf24', '전자 e⁻'], ['#cbd5e1', 'Zn'], ['#fb923c', 'Cu']], RedoxLesson, 'one'),
  L('08', '중화 반응과 중화 적정', 'H⁺와 OH⁻를 합치고, 집는 동안 NaOH를 떨어뜨려요.', 'together', ['H⁺ + OH⁻ 합치기', '집어서 적정'],
    [['close', '검지 끝 모으기', 'H⁺ + OH⁻'], ['pinch', '집고 있기', 'NaOH 적가'], ['open', '손가락 떼기', '멈춤']], [['#f87171', 'H⁺'], ['#60a5fa', 'OH⁻ / NaOH'], ['#ec4899', '페놀프탈레인 붉은색']], TitrationLesson),
  L('09', '화학 평형과 르 샤틀리에 원리', '양손으로 용기를 압축·팽창해 평형 이동을 봐요.', 'together', ['양손으로 압축·팽창', '평형 이동 관찰'],
    [['close', '양손 모으기', '압축 (압력↑)'], ['open', '양손 벌리기', '팽창 (압력↓)']], [['#c2410c', 'NO₂'], ['#e2e8f0', 'N₂O₄']], EquilibriumLesson),
  L('10', '반응 속도와 온도·농도·촉매', '흔들어 온도를, 간격으로 농도를, 집어서 촉매를 바꿔요.', 'shake', ['손 흔들기', '반응 속도↑'],
    [['wave', '빠르게 흔들기', '온도↑'], ['open', '양손 벌리기', '농도↑'], ['pinch', '집기', '촉매 ON/OFF']], [['#60a5fa', '반응물 A'], ['#fbbf24', '생성물 B']], RateLesson, 'one'),
];
HS_LESSONS.forEach((M, i) => { M.kid = KID[i]; M.howto = HOWTO[i]; });
