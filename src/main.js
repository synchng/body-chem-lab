// App flow: HOME → CAMERA → CALIBRATION → SELECT → TUTORIAL → EXPERIMENT → CONCEPT → RESULT.
import { Gesture, createTrackers, simLandmarks, clamp } from './gesture.js';
import { MODULES, ATOMS, drawBackground, chime, audioCtx } from './modules.js';
import { HS_LESSONS } from './highschool.js';
import { tutorialLine, conceptLine, quizLine, mistakeLine, resultLine, LINES } from './narration.js';
import { coachSVG, coachCaption } from './coach.js';

// Difficulty tiers. The basic modules are untouched; high-school lessons only appear when that tier is chosen.
const TIERS = {
  basic: { label: '기본 과정 · Basic', desc: '원자 결합 · 분자 만들기 · 물질의 상태', unit: '모듈', list: MODULES },
  hs: { label: '고등 난이도 · High School Chemistry', desc: '몰 · 양적 관계 · 결합 · 산화환원 · 평형 · 반응 속도', unit: '고등', list: HS_LESSONS },
};
let tier = 'basic';
const list = () => TIERS[tier].list;
const tag = M => tier === 'hs' ? `고등 난이도 · ${M.num}` : `모듈 ${M.num}`;

const $ = s => document.querySelector(s);
const stage = $('#stage'), overlay = $('#overlay'), video = $('#video');
const c = stage.getContext('2d'), o = overlay.getContext('2d');
const g = new Gesture();
const HOLD_S = 1.2; // hover-and-hold time to press a button with a hand

let sim = new URLSearchParams(location.search).has('sim');
let trackers = null, tracking = false, screen = 'home', run = null, tutIndex = 0, W = 0, H = 0;
const mouse = { x: 0.5, y: 0.5, down: false };
const completed = new Set();

const ICONS = {
  close: '<path d="M2 12h7M6 8.5 9.5 12 6 15.5M22 12h-7M18 8.5 14.5 12 18 15.5"/>',
  open: '<path d="M9 12H2M5.5 8.5 2 12l3.5 3.5M15 12h7M18.5 8.5 22 12l-3.5 3.5"/>',
  hold: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  grab: '<circle cx="17" cy="7" r="3.5"/><path d="M3.5 20.5 12 12M12 12H8M12 12v4"/>',
  pinch: '<path d="M6 4c4 2 6 5 6 8M18 4c-4 2-6 5-6 8M12 12v9"/><circle cx="12" cy="12" r="2"/>',
  wave: '<path d="M2 12c2.5-5 5-5 7 0s4.5 5 7 0 3.5-4 6-1"/>',
  down: '<path d="M12 3v15M6.5 12.5 12 18l5.5-5.5M6 21.5h12"/>',
  updown: '<path d="M12 3v18M7.5 7.5 12 3l4.5 4.5M7.5 16.5 12 21l4.5-4.5"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

function show(name) {
  screen = name; document.body.dataset.screen = name;
  if (name === 'select') renderCards();
  if (name === 'select' || name === 'result') stopSpeech();
  renderHearts();
}

// ---------- narration (both tiers): saved mp3 in voice/ (deployed site) → else server /api/tts → Typecast voice ----------
// voice/<hash>.mp3 uses the same name as server.js's .tts-cache (sha256 of voice id + text), copied there by `npm run build`.
const VOICE_ID = 'tc_6a98d65b0402016f616a7ac3';
const voiceFile = async text => 'voice/' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${VOICE_ID}\n${text}`)))]
  .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32) + '.mp3';
let voice = null, speakId = 0, warnedNoKey = false;
function stopSpeech() { speakId++; try { voice?.stop(); } catch { /* already ended */ } voice = null; }
async function speak(text) {
  if (!text) return;
  stopSpeech();
  const id = speakId;
  try {
    let r = await fetch(await voiceFile(text.trim())).catch(() => null);
    if (!r?.ok) r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (r.status === 503) { // line not saved yet and no API key: skip it (saved lines still play)
      if (!warnedNoKey) { warnedNoKey = true; console.info('Some narration is missing: set TYPECAST_API_KEY in .env and restart `npm start`.'); }
      return;
    }
    if (!r.ok) return;
    const ctx = audioCtx(), buf = await ctx.decodeAudioData(await r.arrayBuffer());
    if (id !== speakId) return; // a newer line started while this one was loading
    await ctx.resume();
    voice = ctx.createBufferSource(); voice.buffer = buf; voice.connect(ctx.destination); voice.start();
  } catch (e) { console.warn('Narration failed', e); }
}

// ---------- hearts (high-school tier only): a mistake costs one, zero → retry the lesson ----------
const HEARTS = 5;
function renderHearts() {
  const el = $('#hearts'), on = run?.hearts != null && ['experiment', 'concept', 'quiz'].includes(screen);
  el.hidden = !on;
  if (on) {
    el.innerHTML = Array.from({ length: HEARTS }, (_, i) => `<span class="${i < run.hearts ? 'full' : ''}">${i < run.hearts ? '♥' : '♡'}</span>`).join('');
    el.setAttribute('aria-label', `하트 ${run.hearts} / ${HEARTS}`);
  }
}
function loseHeart() {
  run.hearts--;
  renderHearts();
  const el = $('#hearts'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  chime([220, 165], 0.12);
  if (run.hearts <= 0) setTimeout(() => { if (!run) return; show('retry'); speak(LINES.outOfHearts); }, 900);
}

// ---------- camera ----------
function setStatus(s) { $('#perm-status').textContent = s; }
function fail(msg) { setStatus(''); $('#perm-error-msg').textContent = msg; $('#perm-error').hidden = false; }

async function startCamera() {
  $('#perm-error').hidden = true;
  setStatus('카메라 권한을 기다리는 중…');
  if (!navigator.mediaDevices?.getUserMedia) return fail('여기서는 카메라를 쓸 수 없어요. http://localhost 에서 열어 주세요 (npm start).');
  try {
    video.srcObject?.getTracks().forEach(t => t.stop());
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
    await video.play();
  } catch (e) {
    return fail({
      NotAllowedError: '카메라 권한이 거부됐어요. 브라우저 주소창의 카메라 아이콘에서 허용한 뒤 다시 시도해 주세요. (Claude 앱 안의 미리보기 브라우저에서는 카메라가 차단돼요. Chrome이나 Edge에서 http://localhost:5173 을 열어 주세요.)',
      NotFoundError: '카메라를 찾을 수 없어요. 웹캠을 연결하고 다시 시도해 주세요.',
      NotReadableError: '다른 앱이 카메라를 사용 중이에요. 그 앱을 닫고 다시 시도해 주세요.',
    }[e.name] ?? `카메라 오류: ${e.message}`);
  }
  setStatus('동작 인식 모델을 불러오는 중…');
  try { trackers ??= await createTrackers(); } catch (e) {
    console.error('MediaPipe error', e);
    return fail('MediaPipe 인식 모델을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
  }
  tracking = true; calibration();
}
function useSim() { sim = true; tracking = true; calibration(); }

$('#start').onclick = () => { chime([]); if (sim) useSim(); else { show('permission'); startCamera(); } };
$('#perm-retry').onclick = startCamera;
$('#perm-sim').onclick = useSim;
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth; mouse.y = e.clientY / innerHeight; });
addEventListener('pointerdown', () => { mouse.down = true; });
addEventListener('pointerup', () => { mouse.down = false; });

let lastVT = -1;
function track(now) {
  if (!tracking) return;
  if (sim) { const s = simLandmarks(mouse.x, mouse.y, mouse.down); return g.ingest(s.pose, now, 16 / 9, s.hands); }
  if (!trackers || video.readyState < 2 || video.currentTime === lastVT) return;
  lastVT = video.currentTime;
  try {
    const pose = trackers.pose.detectForVideo(video, now), hands = trackers.hands.detectForVideo(video, now);
    g.ingest(pose.landmarks[0] ?? null, now, video.videoWidth / video.videoHeight, hands.landmarks);
  }
  catch (e) { console.error('Tracking error', e); }
}

// ---------- calibration ----------
let calT = 0, calDone = false;
function calibration() {
  calT = 0; calDone = false;
  $('#cal-msg').textContent = sim ? '마우스 시뮬레이션: 마우스를 움직여 양손 검지를 조종하세요.' : '카메라 앞에 양손을 들고 검지를 펴 주세요.';
  show('calibration');
}
function calibrate(dt) {
  const checks = { face: g.face, left: !!g.left, right: !!g.right, body: g.body };
  const ready = Object.values(checks).every(Boolean);
  for (const [k, v] of Object.entries({ ...checks, ready })) $(`#cal-${k}`).classList.toggle('on', v);
  $('#cal-dist').textContent = g.handDist?.toFixed(2) ?? '–';
  $('#cal-center').textContent = g.center ? `${Math.round(g.center.x / g.aspect * 100)}%` : '–';
  if (calDone) return;
  calT = ready ? calT + dt : Math.max(0, calT - dt);
  $('#cal-bar').style.width = `${Math.min(100, calT / 1.5 * 100)}%`;
  if (calT >= 1.5) {
    calDone = true; $('#cal-msg').textContent = '캘리브레이션 완료'; chime([523, 784]);
    setTimeout(() => screen === 'calibration' && show('select'), 1200);
  }
}

// ---------- select / tutorial ----------
function renderCards() {
  $('#tiers').innerHTML = Object.entries(TIERS).map(([k, T]) => `<button class="tier hold${k === tier ? ' on' : ''}" data-tier="${k}">
    <b>${T.label}</b><small>${T.desc}</small></button>`).join('');
  $('#cards').className = `cards${tier === 'hs' ? ' many' : ''}`;
  $('#cards').innerHTML = list().map((M, i) => `<button class="card hold" data-i="${i}">${icon(M.guide[0][0])}
    <span class="eyebrow">${tag(M)}</span><h3>${M.name}</h3><p>${M.desc}</p>
    ${completed.has(`${tier}:${i}`) ? '<span class="done">✓ 완료</span>' : ''}</button>`).join('');
}
$('#tiers').onclick = e => { const b = e.target.closest('.tier'); if (b) { tier = b.dataset.tier; renderCards(); } };
$('#cards').onclick = e => { const b = e.target.closest('.card'); if (b) tutorial(+b.dataset.i); };

function tutorial(i) {
  const M = list()[tutIndex = i];
  $('#tut-num').textContent = `${tag(M)} · 튜토리얼`;
  $('#tut-name').textContent = M.name;
  $('#tut-stage').className = `tut-stage anim-${M.anim}`;
  $('#tut-steps').innerHTML = M.steps.join('<span>→</span>');
  $('#tut-kid').hidden = !M.kid;
  $('#tut-kid').innerHTML = M.kid ? `<b>쉽게 말하면</b> ${M.kid}` : '';
  speak(tutorialLine(M));
  show('tutorial');
}
$('#tut-go').onclick = () => experiment(tutIndex);

// ---------- experiment ----------
function experiment(i) {
  const M = list()[i];
  run = { i, m: M.create(W, H), needs: M.needs, t0: performance.now(), frames: 0, tracked: 0, doneAt: 0, quiz: null,
    hearts: tier === 'hs' ? HEARTS : null, seenMistakes: 0, wrongAt: -1e9, tries: 0 };
  $('#hud-title').textContent = `${tag(M)} · ${M.name}`;
  // High-school lessons: one everyday comparison stays visible at the top of the guide panel.
  $('#guide').innerHTML = (M.kid ? `<p class="kid"><b>쉽게 말하면</b> ${M.kid}</p>` : '') + '<h4>제스처 가이드</h4>' + M.guide.map(([ic, a, b]) =>
    `<div class="g">${icon(ic)}<div><b>${a}</b><small>→ ${b}</small></div></div>`).join('');
  $('#legend').innerHTML = '<h4>범례</h4>' + (M.legend
    ? M.legend.map(([col, label]) => `<div class="item"><span class="dot" style="background:${col}"></span>${label}</div>`).join('')
    : M.elements.length
    ? M.elements.map(el => `<div class="item"><span class="dot" style="background:${ATOMS[el].color};color:${ATOMS[el].text}">${el}</span>${ATOMS[el].name}</div>`).join('')
      + (i === 0 ? '<div class="item"><span class="dot"><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#7dd3fc"/></svg></span>전자</div>' : '')
    : '<div class="item"><span class="dot" style="background:radial-gradient(circle at 35% 30%,#fff,#7cc4ff 50%,#14203a)"></span>물 분자 1개</div>');
  show('experiment');
  speak(M.howto); // how to play, spoken — no reading needed
}
function step(dt, now) {
  const m = run.m;
  m.update(g, dt, W, H);
  if (screen !== 'experiment') return; // keeps animating under the concept card, but stats stop
  run.frames++;
  if (run.needs === 'both' ? g.both : g.left || g.right) run.tracked++;
  if (run.hearts != null && (m.mistakes ?? 0) > run.seenMistakes) {
    run.seenMistakes = m.mistakes; run.wrongAt = now; loseHeart();
    if (run.hearts > 0) speak(mistakeLine(m.status.hint));
  } else if (m.say) speak(m.say);
  m.say = null;
  const wrong = now - run.wrongAt < 2200; // show "try again" feedback for ~2 s after a mistake
  let { gesture = '–', hint = '', good = false } = m.status;
  if (wrong) { gesture = `✗ 틀렸어요! 다시 해 보세요 · 하트 ${run.hearts}개 남음`; good = false; }
  const ge = $('#gesture');
  if (ge.textContent !== gesture) ge.textContent = gesture;
  ge.classList.toggle('good', good);
  ge.classList.toggle('bad', wrong);
  if ($('#hint').textContent !== hint) $('#hint').textContent = hint;
  if (m.done && !run.doneAt) { run.doneAt = now; run.time = (now - run.t0) / 1000; }
  if (run.doneAt && now - run.doneAt > 1800 && run.hearts !== 0) concept(); // ACTION → VISUAL RESULT first, then CONCEPT
}
function exit() { run = null; show('select'); }
$('#exit').onclick = exit;
addEventListener('keydown', e => { if (e.key === 'Escape' && (screen === 'experiment' || screen === 'concept')) exit(); });

// ---------- concept / result ----------
function concept() {
  const d = run.m.done;
  $('#concept-title').textContent = d.title;
  $('#concept-text').innerHTML = d.explain.map(s => `<p>${s}</p>`).join('');
  show('concept');
  speak(conceptLine(d));
}
$('#concept-go').onclick = () => run.m.done.quiz ? quiz() : result();

// ---------- quiz (high-school lessons): one question after the concept ----------
function quiz() {
  const { q, options } = run.m.done.quiz;
  $('#quiz-q').textContent = q;
  $('#quiz-options').innerHTML = options.map((s, i) => `<button class="btn option hold" data-i="${i}">${s}</button>`).join('');
  $('#quiz-feedback').textContent = '';
  $('#quiz-go').hidden = true;
  show('quiz');
  speak(quizLine({ q, options }));
}
$('#quiz-options').onclick = e => {
  const b = e.target.closest('.option');
  if (!b || b.disabled || run.quiz || run.hearts <= 0) return;
  const { answer } = run.m.done.quiz, ok = +b.dataset.i === answer;
  run.tries++;
  if (!ok) { // wrong: lose a heart, rule that option out, answer stays hidden → try again
    b.disabled = true; b.classList.remove('hold'); b.classList.add('wrong');
    $('#quiz-feedback').textContent = `✗ 틀렸어요! 다시 골라 보세요. (하트 ${run.hearts - 1}개 남음)`;
    $('#quiz-feedback').classList.add('bad');
    loseHeart();
    if (run.hearts > 0) speak(LINES.quizWrong);
    return;
  }
  run.quiz = { tries: run.tries };
  document.querySelectorAll('#quiz-options .option').forEach((el, i) => { el.classList.remove('hold'); el.classList.add(i === answer ? 'right' : 'dim'); });
  $('#quiz-feedback').classList.remove('bad');
  $('#quiz-feedback').textContent = run.tries === 1 ? '정답이에요! 한 번에 맞혔어요.' : `정답이에요! (${run.tries}번째 시도)`;
  chime([660, 880], 0.1);
  speak(LINES.quizRight);
  $('#quiz-go').hidden = false;
};
$('#retry-go').onclick = () => experiment(run.i);
$('#retry-menu').onclick = () => show('select');
$('#quiz-go').onclick = () => result();

function result() {
  const { i, m, frames, tracked, time } = run, d = m.done, M = list()[i];
  completed.add(`${tier}:${i}`);
  $('#res-outcome').textContent = `${tag(M)} · ${M.name}`;
  $('#res-quiz-row').hidden = !run.quiz;
  if (run.quiz) $('#res-quiz').textContent = run.quiz.tries === 1 ? '정답 ✓ (한 번에)' : `정답 ✓ (${run.quiz.tries}번째 시도)`;
  $('#res-hearts-row').hidden = run.hearts == null;
  if (run.hearts != null) $('#res-hearts').textContent = `${'♥'.repeat(run.hearts)}${'♡'.repeat(HEARTS - run.hearts)}  ${run.hearts} / ${HEARTS}`;
  $('#res-label').textContent = d.label;
  $('#res-short').textContent = d.outcome;
  $('#res-acc').textContent = `${Math.round(100 * tracked / Math.max(1, frames))}%`;
  $('#res-att').textContent = m.attempts;
  $('#res-time').textContent = `${Math.round(time)}초`;
  $('#res-concept').textContent = d.concept;
  const n = list().length, done = list().filter((_, j) => completed.has(`${tier}:${j}`)).length;
  $('#res-progress').textContent = `${TIERS[tier].unit} ${done} / ${n}`;
  $('#res-next').innerHTML = `${i < n - 1 ? '다음 모듈' : '모듈 목록'} <small>OK 사인</small>`;
  show('result');
  speak(resultLine(i < n - 1));
}
$('#res-replay').onclick = () => experiment(run.i);
$('#res-next').onclick = () => run.i < list().length - 1 ? tutorial(run.i + 1) : show('select');
$('#res-menu').onclick = () => show('select');

// ---------- hand-as-pointer: hover a .hold element and keep still to press it ----------
const hover = { el: null, t: 0, cool: 0 };
function hoverHold(dt) {
  hover.cool -= dt;
  const els = ['left', 'right'].map(k => g.screen[k]).filter(Boolean)
    .map(p => document.elementFromPoint(p.x * W, p.y * H)?.closest('.hold'));
  const el = hover.cool > 0 ? null : els.includes(hover.el) ? hover.el : els.find(Boolean) ?? null;
  if (el !== hover.el) { hover.el?.style.setProperty('--p', 0); hover.el = el; hover.t = 0; }
  if (!el) return;
  hover.t += dt;
  el.style.setProperty('--p', Math.min(1, hover.t / HOLD_S));
  if (hover.t >= HOLD_S) { el.style.setProperty('--p', 0); hover.el = null; hover.cool = 1; el.click(); }
}

// ---------- gesture coach: animated hand for the gesture to make right now ----------
// In an experiment it sits beside the gesture text (lesson cue(), or "raise" if the needed hands are missing);
// on other screens it floats at the bottom centre. The DOM is only touched when the gesture changes.
const SCREEN_CUE = { calibration: 'raise', select: 'hover', tutorial: 'ok', concept: 'ok', result: 'ok', retry: 'ok' };
let shownCue;
function coach() {
  const inHud = screen === 'experiment' && !!run;
  let key = null;
  if (!tracking) key = null;
  else if (inHud) {
    const missing = run.needs === 'both' ? !g.both : !(g.left || g.right);
    key = missing && !run.m.done ? 'raise' : run.m.cue?.() ?? null;
  } else key = screen === 'quiz' ? (run?.quiz ? 'ok' : 'hover') : SCREEN_CUE[screen] ?? null;
  const id = `${inHud}:${key}`;
  if (id === shownCue) return;
  shownCue = id;
  const hud = $('#coach-hud'), float = $('#coach-float');
  hud.hidden = !(inHud && key); float.hidden = !(!inHud && key);
  (inHud ? hud : float).innerHTML = key ? `${coachSVG(key)}<span class="coach-cap">${coachCaption(key)}</span>` : '';
}

// ---------- OK sign = "next": hold it and the screen's forward button is pressed (anywhere on screen) ----------
const OK_S = 0.6; // seconds to hold the sign
const OK_NEXT = { tutorial: '#tut-go', concept: '#concept-go', quiz: '#quiz-go', result: '#res-next', retry: '#retry-go' };
const okSign = { t: 0, el: null, release: false };
function okNext(dt) {
  const el = OK_NEXT[screen] && $(OK_NEXT[screen]), sign = g.ok.left || g.ok.right;
  if (!sign) okSign.release = false; // must let go before the next screen can be skipped too
  if (!el || el.hidden || !sign || okSign.release) {
    if (okSign.el && okSign.el !== hover.el) okSign.el.style.setProperty('--p', 0);
    okSign.el = null; okSign.t = 0; return;
  }
  okSign.el = el; okSign.t += dt;
  el.style.setProperty('--p', Math.min(1, okSign.t / OK_S));
  if (okSign.t >= OK_S) { el.style.setProperty('--p', 0); okSign.el = null; okSign.t = 0; okSign.release = true; chime([784, 1047], 0.06); el.click(); }
}

// ---------- overlay: camera preview + hand cursors ----------
function drawOverlay() {
  const big = screen === 'calibration';
  const pw = big ? Math.min(W * 0.5, 560) : 200, ph = pw * 9 / 16;
  const px = big ? Math.max(16, W * 0.06) : 24, py = big ? (H - ph) / 2 : H - ph - 24;
  if (screen !== 'home') {
    o.save();
    o.beginPath(); o.roundRect(px, py, pw, ph, 12); o.clip();
    o.fillStyle = '#060c17'; o.fillRect(px, py, pw, ph);
    if (!sim && video.readyState >= 2) {
      const vw = pw, vh = pw * video.videoHeight / video.videoWidth;
      o.globalAlpha = 0.8; o.translate(px + pw, py + (ph - vh) / 2); o.scale(-1, 1); o.drawImage(video, 0, 0, vw, vh);
      o.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0); o.globalAlpha = 1;
    } else if (sim) {
      o.fillStyle = '#94a3b8'; o.font = "600 11px Inter, 'Noto Sans KR', system-ui"; o.textAlign = 'center'; o.fillText('마우스 시뮬레이션', px + pw / 2, py + ph / 2);
    }
    const vh = sim ? ph : pw / g.aspect, oy = py + (ph - vh) / 2;
    const dot = (p, col, s = 1) => { o.fillStyle = col; o.beginPath(); o.arc(px + p.x / g.aspect * pw, oy + p.y * vh, (big ? 7 : 4) * s, 0, Math.PI * 2); o.fill(); };
    if (g.center) dot(g.center, '#fbbf24');
    for (const pts of [g.fingers.left, g.fingers.right]) if (pts) pts.forEach((p, i) => i !== 8 && dot(p, 'rgba(226,232,240,.7)', 0.4));
    if (g.left) dot(g.left, '#5eead4');
    if (g.right) dot(g.right, '#5eead4');
    o.restore();
    o.strokeStyle = 'rgba(148,163,184,.3)'; o.lineWidth = 1; o.beginPath(); o.roundRect(px, py, pw, ph, 12); o.stroke();
  }
  for (const [k, lab] of [['left', 'L'], ['right', 'R']]) {
    const p = g.screen[k];
    if (!p) continue;
    const x = p.x * W, y = p.y * H;
    const pinched = g.pinch[k]; // pinch: ring shrinks and fills amber
    o.strokeStyle = pinched ? '#fbbf24' : 'rgba(94,234,212,.9)'; o.lineWidth = 2;
    o.beginPath(); o.arc(x, y, pinched ? 10 : 15, 0, Math.PI * 2); o.stroke();
    if (pinched) { o.fillStyle = 'rgba(251,191,36,.35)'; o.fill(); }
    o.fillStyle = '#5eead4'; o.font = '700 10px Inter, system-ui'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText(g.ok[k] ? 'OK' : lab, x, y); // shows the OK sign was recognised
  }
}

// ---------- single animation loop (started once; screens never start their own) ----------
function resize() {
  if (W === innerWidth && H === innerHeight) return;
  W = innerWidth; H = innerHeight;
  const dpr = devicePixelRatio || 1;
  for (const [cv, cx] of [[stage, c], [overlay, o]]) { cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
}
// 3D lab backdrop loads separately: if WebGL or the CDN fails, the app still runs on the plain background.
let lab = null;
import('./lab.js').then(m => { lab = m.createLab($('#lab')); }).catch(e => console.warn('3D lab unavailable', e));

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  resize(); track(now);
  if (!W || !H) return; // hidden/zero-size window
  c.clearRect(0, 0, W, H);
  const inLab = !!run && (screen === 'experiment' || screen === 'concept' || screen === 'quiz' || screen === 'retry');
  lab?.render(now / 1000, inLab, g.center ? clamp(g.center.x / g.aspect * 2 - 1, -1, 1) : 0);
  if (inLab) { if (dt > 0) step(dt, now); run.m.draw(c, W, H); }
  else drawBackground(c, W, H, now / 1000);
  o.clearRect(0, 0, W, H);
  coach();
  if (!tracking) return;
  drawOverlay();
  if (screen === 'calibration') calibrate(dt);
  if (screen !== 'experiment') { hoverHold(dt); okNext(dt); }
}
requestAnimationFrame(frame);
