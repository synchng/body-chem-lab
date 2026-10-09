// Gesture pipeline: RAW LANDMARK → NORMALIZE → DEAD ZONE → SMOOTHING → GESTURE DETECTION.
// Hand Landmarker gives the index fingertips (the pointers); Pose gives face and shoulders for calibration and normalization.

// Tuning knobs: adjust these for real cameras, rooms and lighting.
export const CFG = {
  EMA: 0.45,        // landmark smoothing (0..1, higher = snappier but more jitter)
  DEAD_ZONE: 0.006, // ignore movement smaller than this (frame-height units)
  VIS: 0.55,        // min landmark visibility to count as detected
  REACH: 0.12,      // frame margin mapped off-screen so screen edges are reachable
  SPEED_EMA: 0.2,   // smoothing for speed signals
  PINCH_ON: 0.35,   // thumb–index tip gap / hand size below this = pinch starts
  PINCH_OFF: 0.55,  // …and above this = pinch ends (hysteresis stops flicker)
  OK_EXTEND: 1.1,   // OK sign: middle/ring/little tip must be this much farther from the wrist than its middle joint
};

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const I = { NOSE: 0, LS: 11, RS: 12, LW: 15, RW: 16 };
const TIP = 8, THUMB = 4; // hand landmarks: index fingertip, thumb tip

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function smoothPoint(prev, raw, a = CFG.EMA, dz = CFG.DEAD_ZONE) {
  if (!prev) return { x: raw.x, y: raw.y };
  if (dist(prev, raw) < dz) return prev;
  return { x: lerp(prev.x, raw.x, a), y: lerp(prev.y, raw.y, a) };
}

export async function createTrackers() {
  const { FilesetResolver, PoseLandmarker, HandLandmarker } = await import(`${MP}/vision_bundle.mjs`);
  const files = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
  const make = (Task, modelAssetPath, opts) => {
    const at = delegate => Task.createFromOptions(files, { baseOptions: { modelAssetPath, delegate }, runningMode: 'VIDEO', ...opts });
    return at('GPU').catch(() => at('CPU'));
  };
  const [pose, hands] = await Promise.all([make(PoseLandmarker, POSE_MODEL, { numPoses: 1 }), make(HandLandmarker, HAND_MODEL, { numHands: 2 })]);
  return { pose, hands };
}

// All distances/speeds are in shoulder widths, so they don't depend on how far the user stands.
export class Gesture {
  constructor() { this.reset(); }
  reset() {
    this.face = false; this.body = false;
    this.left = null; this.right = null;         // smoothed index fingertips, aspect-corrected frame coords
    this.fingers = { left: null, right: null };  // 21 hand points per side, for the preview
    this.pinch = { left: false, right: false };  // thumb tip touching index tip
    this.ok = { left: false, right: false };     // OK sign: pinch + middle, ring, little finger straight
    this.screen = { left: null, right: null };   // 0..1 screen coords (mirrored)
    this.shoulderW = 0; this.center = null;
    this.handDist = null;  // palm distance / shoulder width
    this.sepSpeed = 0;     // d(handDist)/dt, > 0 while pulling apart
    this.wristDist = null; // wrist-to-wrist distance (Pose): still known when blur loses the fingers
    this.speed = 0;        // mean palm speed, shoulder widths / s
    this.handsLow = false;
    this._t = 0;
  }
  get both() { return !!(this.left && this.right); }

  // lm: 33 pose landmarks or null; hands: array of 21-point hand landmark arrays. All normalized, unmirrored.
  ingest(lm, now, aspect = 4 / 3, hands = []) {
    const dt = this._t ? Math.min(0.1, (now - this._t) / 1000) : 0;
    this._t = now; this.aspect = aspect;
    const ok = i => !!lm && (lm[i].visibility ?? 1) > CFG.VIS && lm[i].x > 0 && lm[i].x < 1 && lm[i].y > 0 && lm[i].y < 1;
    const P = (...ids) => ({
      x: (1 - ids.reduce((s, i) => s + lm[i].x, 0) / ids.length) * aspect, // mirror: user's left = screen left
      y: ids.reduce((s, i) => s + lm[i].y, 0) / ids.length,
    });

    this.face = ok(I.NOSE);
    this.body = ok(I.LS) && ok(I.RS);
    if (this.body) {
      const sw = dist(P(I.LS), P(I.RS));
      this.shoulderW = this.shoulderW ? lerp(this.shoulderW, sw, 0.1) : sw;
      this.center = P(I.LS, I.RS);
    }
    const sw = this.shoulderW || 0.3; // fallback until shoulders have been seen

    // Assign each hand to the nearest pose wrist (the model's handedness label flips with mirroring).
    // No wrists visible → screen side decides. Two hands → the more-left one is the left hand.
    const side = w => {
      const dL = ok(I.LW) ? dist(w, P(I.LW)) : 9, dR = ok(I.RW) ? dist(w, P(I.RW)) : 9;
      return dL === dR ? w.x - aspect / 2 : dL - dR;
    };
    const hs = hands.map(h => h.map(p => ({ x: (1 - p.x) * aspect, y: p.y })))
      .map(h => ({ h, s: side(h[0]) })).sort((a, b) => a.s - b.s);
    this.fingers = hs.length >= 2 ? { left: hs[0].h, right: hs[1].h }
      : hs.length === 1 ? { left: hs[0].s < 0 ? hs[0].h : null, right: hs[0].s < 0 ? null : hs[0].h } : { left: null, right: null };

    const prev = { left: this.left, right: this.right };
    this.left = this.fingers.left ? smoothPoint(this.left, this.fingers.left[TIP]) : null;
    this.right = this.fingers.right ? smoothPoint(this.right, this.fingers.right[TIP]) : null;
    for (const k of ['left', 'right']) {
      const f = this.fingers[k];
      if (!f) { this.pinch[k] = this.ok[k] = false; continue; }
      const gap = dist(f[THUMB], f[TIP]) / (dist(f[0], f[9]) || 1); // hand size = wrist → middle knuckle
      this.pinch[k] = gap < (this.pinch[k] ? CFG.PINCH_OFF : CFG.PINCH_ON);
      const straight = (tip, pip) => dist(f[tip], f[0]) > dist(f[pip], f[0]) * CFG.OK_EXTEND;
      this.ok[k] = this.pinch[k] && straight(12, 10) && straight(16, 14) && straight(20, 18);
    }

    const v = ['left', 'right'].filter(k => dt && this[k] && prev[k]).map(k => dist(this[k], prev[k]) / sw / dt);
    this.speed = lerp(this.speed, v.length ? (v[0] + (v[1] ?? v[0])) / 2 : 0, CFG.SPEED_EMA);

    const hd = this.both ? dist(this.left, this.right) / sw : null;
    this.sepSpeed = hd != null && this.handDist != null && dt ? lerp(this.sepSpeed, (hd - this.handDist) / dt, CFG.SPEED_EMA) : 0;
    this.handDist = hd;
    const wd = ok(I.LW) && ok(I.RW) ? dist(P(I.LW), P(I.RW)) / sw : null;
    this.wristDist = wd;
    this.handsLow = this.both && !!this.center && Math.min(this.left.y, this.right.y) > this.center.y + 0.8 * sw;

    const m = CFG.REACH;
    for (const k of ['left', 'right']) {
      this.screen[k] = this[k] && { x: clamp((this[k].x / aspect - m) / (1 - 2 * m)), y: clamp((this[k].y - m) / (1 - 2 * m)) };
    }
  }
}

// Mouse fallback (?sim or camera denied): right fingertip = mouse, left fingertip mirrored across the center,
// mouse button held = pinch.
export function simLandmarks(sx, sy, pinch = false) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  const m = CFG.REACH, fx = sx * (1 - 2 * m) + m, fy = sy * (1 - 2 * m) + m;
  lm[I.NOSE] = { x: 0.5, y: 0.25, visibility: 1 };
  lm[I.LS] = { x: 0.6, y: 0.45, visibility: 1 }; // raw (unmirrored): user's left is on image right
  lm[I.RS] = { x: 0.4, y: 0.45, visibility: 1 };
  lm[I.RW] = { x: 1 - fx, y: fy + 0.1, visibility: 1 };
  lm[I.LW] = { x: fx, y: fy + 0.1, visibility: 1 };
  const hand = x => Array.from({ length: 21 }, (_, i) =>
    i === TIP ? { x, y: fy } : i === THUMB ? { x: pinch ? x : x + 0.04, y: pinch ? fy : fy + 0.03 } : { x, y: i === 9 ? fy + 0.05 : fy + 0.1 });
  return { pose: lm, hands: [hand(1 - fx), hand(fx)] };
}
