// Gesture coach: an animated hand that shows the gesture to make *right now*.
// Pure markup (inline SVG); the motion lives in style.css (.coach-*). Lessons return a key from cue().

// One hand in a 60×80 box, drawn as outline line art (single stroke, round ends, wrist open at the bottom).
// Right hand; mirror with scale(-1,1) for the left. Fingers are outlined capsules [baseX, baseY, tipX, tipY, width],
// listed back to front; each is filled with the panel colour so a front finger hides the lines behind it.
const PALM = 'M17 78 L16 54 Q15 42 24 40 L42 40 Q50 42 49 54 L47 66 Q46 72 45 78';
const POSES = {
  open: [[44, 46, 51, 22, 9], [38, 42, 40, 11, 9], [30, 41, 30, 7, 9], [22, 42, 18, 11, 9], [18, 60, 4, 42, 10]],
  point: [[44, 48, 45, 40, 9], [37, 45, 38, 37, 9], [30, 44, 31, 36, 9], [22, 44, 20, 6, 9], [19, 62, 31, 52, 10]],
  pinch: [[44, 48, 45, 40, 9], [37, 45, 38, 37, 9], [30, 44, 31, 36, 9], [23, 44, 10, 27, 9], [18, 62, 8, 35, 10]],
  ok: [[44, 46, 51, 22, 9], [38, 42, 40, 11, 9], [30, 41, 30, 7, 9], [23, 44, 10, 27, 9], [18, 62, 8, 35, 10]],
};
const f1 = n => +n.toFixed(1);
function finger([bx, by, tx, ty, w]) { // open-bottomed capsule: up one side, round over the tip, back down
  const L = Math.hypot(tx - bx, ty - by), nx = -(ty - by) / L * w / 2, ny = (tx - bx) / L * w / 2;
  return `<path d="M${f1(bx + nx)} ${f1(by + ny)} L${f1(tx + nx)} ${f1(ty + ny)} A${w / 2} ${w / 2} 0 0 0 ${f1(tx - nx)} ${f1(ty - ny)} L${f1(bx - nx)} ${f1(by - ny)}"/>`;
}
function hand(pose) {
  const tip = pose === 'pinch' || pose === 'ok' ? '<circle class="tip" cx="9" cy="31" r="6"/>' : '';
  return `<g class="hand hand-${pose}"><path d="${PALM}"/>${POSES[pose].map(finger).join('')}${tip}</g>`;
}
const at = (x, y, inner, cls = '', mirror = false) =>
  `<g transform="translate(${x} ${y})"><g class="${cls}">${mirror ? `<g transform="translate(60 0) scale(-1 1)">${inner}</g>` : inner}</g></g>`;
const swap = (a, b) => `<g class="pose-a">${hand(a)}</g><g class="pose-b">${hand(b)}</g>`; // crossfade between two poses

// key → [caption, svg body in a 160×90 view]
const COACH = {
  raise: ['양손을 들어 카메라에 보여 주세요', at(18, 8, hand('open'), 'mv-rise', true) + at(82, 8, hand('open'), 'mv-rise')],
  close: ['두 검지 끝을 모아요', at(6, 8, hand('point'), 'mv-in-l', true) + at(94, 8, hand('point'), 'mv-in-r') + '<line class="guide" x1="40" y1="16" x2="120" y2="16"/>'],
  open: ['두 손을 크게 벌려요', at(46, 8, hand('open'), 'mv-out-l', true) + at(54, 8, hand('open'), 'mv-out-r')],
  spread: ['두 손 사이를 벌렸다 모았다 해요', at(14, 8, hand('open'), 'mv-spread-l', true) + at(86, 8, hand('open'), 'mv-spread-r')],
  pinch: ['엄지와 검지로 집어요', at(50, 6, swap('open', 'pinch'), 'mv-none pose-swap')],
  pinchHold: ['집은 채로 기다려요', at(50, 6, hand('pinch')) + '<circle class="ring" pathLength="100" cx="60" cy="38" r="18"/>'],
  release: ['손가락을 벌려 놓아요', at(50, 6, swap('pinch', 'open'), 'pose-swap')],
  move: ['집은 채로 옮겨요', at(20, 6, hand('pinch'), 'mv-carry') + '<circle class="target" cx="132" cy="38" r="12"/>'],
  shake: ['두 손을 빠르게 흔들어요', at(18, 8, hand('open'), 'mv-shake', true) + at(82, 8, hand('open'), 'mv-shake mv-delay')],
  down: ['손을 내리고 멈춰요', at(18, 2, hand('open'), 'mv-down', true) + at(82, 2, hand('open'), 'mv-down')],
  updown: ['손을 위아래로 움직여요', at(50, 6, hand('point'), 'mv-updown') + '<line class="guide" x1="128" y1="6" x2="128" y2="84"/>'],
  updown2: ['두 손 높이를 따로 움직여요', at(18, 6, hand('point'), 'mv-updown', true) + at(82, 6, hand('point'), 'mv-updown mv-delay')],
  ok: ['OK 사인으로 다음', at(50, 6, hand('ok'), 'mv-pulse') + '<circle class="ring" pathLength="100" cx="60" cy="40" r="30"/>'],
  hover: ['손을 올리고 잠깐 유지', '<rect class="btn-shape" x="88" y="52" width="60" height="22" rx="11"/><rect class="btn-fill" x="88" y="52" width="60" height="22" rx="11"/>' + at(20, 2, hand('point'), 'mv-hover')],
};
export const COACH_KEYS = Object.keys(COACH);
export const coachCaption = key => COACH[key]?.[0] ?? '';
export const coachSVG = key => COACH[key]
  ? `<svg class="coach-svg" viewBox="0 0 160 90" aria-hidden="true">${COACH[key][1]}</svg>` : '';
