/* ═══════════════════════════════════════
   STATE
═══════════════════════════════════════ */
const state = {
  sc: { total: 25*60, remaining: 25*60, interval: null, running: false, paused: false },
  an: { total: 25*60, remaining: 25*60, interval: null, running: false, paused: false },
  di: { total: 25*60, remaining: 25*60, interval: null, running: false, paused: false },
};

const MAX_SECS = 9*3600 + 59*60 + 59;

let currentPage = 'home';
let breakInterval = null;
let breakRemaining = 0;
let breakSourceTimer = null;

/* ═══════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════ */
function navigate(target) {
  const current = document.querySelector('.page.active');
  if (current) {
    current.classList.add('exit');
    setTimeout(() => current.classList.remove('active', 'exit'), 600);
  }
  setTimeout(() => {
    document.getElementById(target).classList.add('active');
    currentPage = target;
    // Refresh displays in case state changed while away
    if (target === 'sandclock-page') {
      updateSCDisplay(state.sc.remaining);
      updateHourglass(state.sc.remaining, state.sc.total);
    } else if (target === 'analog-page') {
      updateANDisplay(state.an.remaining);
      setClockHands(state.an.remaining, state.an.total);
    } else if (target === 'digital-page') {
      updateDIDisplay(state.di.remaining);
    }
  }, 200);
}

/* ═══════════════════════════════════════
   FORMAT
═══════════════════════════════════════ */
function fmt(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function fmtParts(secs) {
  return {
    h: String(Math.floor(secs / 3600)).padStart(2,'0'),
    m: String(Math.floor((secs % 3600) / 60)).padStart(2,'0'),
    s: String(secs % 60).padStart(2,'0')
  };
}

/* ═══════════════════════════════════════
   DISPLAY UPDATES
═══════════════════════════════════════ */
function updateSCDisplay(secs) {
  const p = fmtParts(secs);
  const h = parseInt(p.h);
  if (h > 0) {
    document.getElementById('sc-display').innerHTML = `${p.h}<span>:</span>${p.m}<span>:</span>${p.s}`;
  } else {
    document.getElementById('sc-display').innerHTML = `${p.m}<span>:</span>${p.s}`;
  }
}
function updateANDisplay(secs) {
  const p = fmtParts(secs);
  const h = parseInt(p.h);
  if (h > 0) {
    document.getElementById('an-display').innerHTML = `${p.h}<span>:</span>${p.m}<span>:</span>${p.s}`;
  } else {
    document.getElementById('an-display').innerHTML = `${p.m}<span>:</span>${p.s}`;
  }
}
function updateDIDisplay(secs) {
  const p = fmtParts(secs);
  document.getElementById('di-hr').textContent = p.h;
  document.getElementById('di-min').textContent = p.m;
  document.getElementById('di-sec').textContent = p.s;
}
function setStatus(id, text, cls) {
  const el = document.getElementById(id+'-status');
  el.textContent = text;
  el.className = 'status-text ' + (cls||'');
}

/* ═══════════════════════════════════════
   SANDCLOCK VISUAL
═══════════════════════════════════════ */
let hgRotation = 0, hgLastFlip = 0;
/*
  Hourglass geometry (viewBox 0 0 120 180):
    Top chamber  : y = 12..88,  left wall: x = 20 + (y-12)/76*45,  right = 100 - (y-12)/76*45
    Bottom chamber: y = 92..168, left wall: x = 65 - (y-92)/76*45,  right =  55 + (y-92)/76*45
  Sand is described as a polygon path — no clipPath, no overflow possible.
*/
function wallTop(y) {
  const t = (y - 12) / 76;
  return { l: 20 + t * 45, r: 100 - t * 45 };
}
function wallBot(y) {
  const t = (y - 92) / 76;
  return { l: 65 - t * 45, r: 55 + t * 45 };
}

function updateHourglass(remaining, total) {
  const ratio = total > 0 ? remaining / total : 0;

  // ── TOP SAND (shrinks as sand falls) ──
  // sand level y goes from 12 (full) to 88 (empty = at neck)
  const topY = 12 + (1 - ratio) * 76;
  const topEl = document.getElementById('hg-sand-top');
  if (ratio > 0.001) {
    const tw = wallTop(topY);
    // Trapezoid from topY down to neck (y=88, x=55..65)
    topEl.setAttribute('d',
      `M${tw.l.toFixed(2)} ${topY.toFixed(2)} ` +
      `L${tw.r.toFixed(2)} ${topY.toFixed(2)} ` +
      `L65 88 L55 88 Z`);
  } else {
    topEl.setAttribute('d', '');
  }

  // ── BOTTOM SAND (grows as sand accumulates) ──
  // sand top-surface y goes from 168 (empty) to 92 (full, at neck)
  const botY = 168 - (1 - ratio) * 76;
  const botEl = document.getElementById('hg-sand-bottom');
  if (ratio < 0.999) {
    const bw = wallBot(botY);
    // Trapezoid from neck (y=92, x=55..65) down to botY
    botEl.setAttribute('d',
      `M55 92 L65 92 ` +
      `L${bw.r.toFixed(2)} ${botY.toFixed(2)} ` +
      `L${bw.l.toFixed(2)} ${botY.toFixed(2)} Z`);
  } else {
    // Fully filled — complete bottom triangle
    botEl.setAttribute('d', 'M55 92 L65 92 L100 168 L20 168 Z');
  }

  const isRunning = state.sc.running;
  document.getElementById('hg-stream').style.opacity =
    isRunning && ratio > 0.001 ? '0.9' : '0';
}

let hgAnimFrame = null;
function animateHourglass() {
  if (hgAnimFrame) cancelAnimationFrame(hgAnimFrame);
  const svg = document.getElementById('hg-svg');
  let startTime = null;
  const duration = 600;
  const startRot = hgRotation;
  const targetRot = hgRotation + 180;

  function step(t) {
    if (!startTime) startTime = t;
    const p = Math.min((t - startTime) / duration, 1);
    const eased = p < 0.5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2;
    svg.style.transform = `rotate(${startRot + eased * 180}deg)`;
    if (p < 1) hgAnimFrame = requestAnimationFrame(step);
    else hgRotation = targetRot;
  }
  requestAnimationFrame(step);
}

/* ═══════════════════════════════════════
   ANALOG CLOCK VISUAL
═══════════════════════════════════════ */
// Build tick marks — called once on load and again on theme toggle
(function buildTicks() {
  const svg = document.getElementById('clock-ticks-svg');
  const isLight = document.body.classList.contains('light');
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * 2 * Math.PI - Math.PI/2;
    const isMaj = i % 5 === 0;
    const r1 = isMaj ? 118 : 122, r2 = 128;
    const x1 = 130 + r1 * Math.cos(angle), y1 = 130 + r1 * Math.sin(angle);
    const x2 = 130 + r2 * Math.cos(angle), y2 = 130 + r2 * Math.sin(angle);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',x1); line.setAttribute('y1',y1);
    line.setAttribute('x2',x2); line.setAttribute('y2',y2);
    line.setAttribute('stroke', isMaj ? (isLight ? '#1c1916' : '#f0ece4') : (isLight ? '#c8bfaf' : '#2a2a2a'));
    line.setAttribute('stroke-width', isMaj ? '2' : '1');
    svg.appendChild(line);
  }
})();

function setClockHands(secs, total) {
  const elapsed = total - secs;
  const minDeg = (secs / 3600) * 360;  // countdown: remaining minutes
  const hrDeg  = (secs / (12*3600)) * 360;
  const secDeg = (secs % 60) / 60 * 360;

  document.getElementById('minute-hand').style.transform = `rotate(${360 - minDeg % 360}deg)`;
  document.getElementById('hour-hand').style.transform   = `rotate(${360 - hrDeg % 360}deg)`;
  if (state.an.running) {
    document.getElementById('second-hand-el').style.transition = 'transform 0.2s cubic-bezier(0.4,2.4,0.6,0.8)';
    document.getElementById('second-hand-el').style.transform = `rotate(${360 - secDeg}deg)`;
  }

  // Progress ring
  const circ = 879.6;
  const ratio = total > 0 ? secs / total : 0;
  document.getElementById('analog-progress-circle').style.strokeDashoffset = circ * (1 - ratio);
}

// Drag to set time
(function setupAnalogDrag() {
  const clock = document.getElementById('analog-clock');
  const minHand = document.getElementById('minute-hand');
  let dragging = false;

  function getAngle(e) {
    const rect = clock.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI + 90;
  }

  function onDrag(e) {
    if (!dragging || state.an.running) return;
    e.preventDefault();
    let angle = getAngle(e);
    if (angle < 0) angle += 360;
    const minutes = Math.round(angle / 360 * 60);
    const secs = Math.min(Math.max(minutes * 60, 60), 90*60);
    state.an.total = secs; state.an.remaining = secs;
    setClockHands(secs, secs);
    updateANDisplay(secs);
  }

  minHand.addEventListener('mousedown', () => { if (!state.an.running) { dragging = true; minHand.style.cursor='grabbing'; } });
  minHand.addEventListener('touchstart', () => { if (!state.an.running) dragging = true; }, { passive: true });
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('touchmove', onDrag, { passive: false });
  document.addEventListener('mouseup', () => { dragging = false; minHand.style.cursor='grab'; });
  document.addEventListener('touchend', () => { dragging = false; });
})();

/* ═══════════════════════════════════════
   TIMER LOGIC
═══════════════════════════════════════ */
function updatePageTitle(id, secs) {
  if (secs > 0 && state[id].running && !state[id].paused) {
    document.title = fmt(secs) + ' — TEMPUS';
  } else {
    document.title = 'TEMPUS — Focus Timer';
  }
}

/* ── SCREEN WAKE LOCK ── */
let wakeLock = null;
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (err) {}
  }
}
function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}
document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    requestWakeLock();
  }
});

function startTimer(id) {
  const s = state[id];
  if (s.running && !s.paused) return;
  if (s.remaining <= 0) { resetTimer(id); return; }

  // Request notification permission on first interaction
  if (window.Notification && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  
  // Keep screen awake
  requestWakeLock();

  s.running = true; s.paused = false;
  if (id === 'di') {
    document.getElementById('di-colon').classList.add('blink');
    document.getElementById('di-hr').classList.add('running');
    document.getElementById('di-min').classList.add('running');
    document.getElementById('di-sec').classList.add('running');
  }
  setStatus(id, 'Running', 'running');

  clearInterval(s.interval);
  s.interval = setInterval(() => {
    s.remaining--;
    updateDisplay(id, s.remaining);
    updatePageTitle(id, s.remaining);
    playTick();

    if (id === 'an') setClockHands(s.remaining, s.total);
    if (id === 'sc') updateHourglass(s.remaining, s.total);

    if (s.remaining <= 0) {
      clearInterval(s.interval);
      s.running = false;
      if (window._onCompleteExtended) window._onCompleteExtended(id);
      else onComplete(id);
    }
  }, 1000);
}

function pauseTimer(id) {
  const s = state[id];
  if (!s.running || s.paused) return;
  
  releaseWakeLock();
  
  clearInterval(s.interval); s.paused = true;
  if (id === 'di') document.getElementById('di-colon').classList.remove('blink');
  setStatus(id, 'Paused', 'paused');
  document.title = 'TEMPUS — Paused';
}

function stopTimer(id) {
  const s = state[id];
  
  releaseWakeLock();
  
  clearInterval(s.interval); s.running = false; s.paused = false;
  s.remaining = s.total;
  updateDisplay(id, s.remaining);
  if (id === 'an') setClockHands(s.remaining, s.total);
  if (id === 'sc') updateHourglass(s.remaining, s.total);
  if (id === 'di') {
    document.getElementById('di-colon').classList.remove('blink');
    document.getElementById('di-hr').classList.remove('running','editing');
    document.getElementById('di-min').classList.remove('running','editing');
    document.getElementById('di-sec').classList.remove('running','editing');
  }
  setStatus(id, 'Stopped', '');
  document.title = 'TEMPUS — Focus Timer';
}

function resetTimer(id) {
  stopTimer(id);
  setStatus(id, 'Ready', '');
}

function updateDisplay(id, secs) {
  if (id === 'sc') updateSCDisplay(secs);
  else if (id === 'an') updateANDisplay(secs);
  else if (id === 'di') updateDIDisplay(secs);
}

function sendDesktopNotification(title, body) {
  if (window.Notification && Notification.permission === 'granted') {
    new Notification(title, { body: body, icon: 'icon-192.png' });
  }
}

function onComplete(id) {
  document.title = 'TEMPUS — Session Complete ✓';
  setTimeout(() => { document.title = 'TEMPUS — Focus Timer'; }, 8000);
  const titles = { sc:'Sand Clock', an:'Analog Timer', di:'Digital Timer' };
  
  showNotify(`${titles[id]} — Session complete ✓`);
  sendDesktopNotification('TEMPUS', `${titles[id]} — Session complete ✓`);
  playDoneSound();
  releaseWakeLock();
  
  setStatus(id, 'Done! ✓', 'done');
  // Flash visual
  if (id === 'sc') document.querySelector('.hourglass-wrap')?.classList.add('done-animate');
  if (id === 'di') document.getElementById('di-display')?.classList.add('done-animate');
  if (id === 'an') document.getElementById('analog-clock')?.classList.add('done-animate');
  setTimeout(() => {
    document.querySelector('.done-animate')?.classList.remove('done-animate');
  }, 3000);
  // Gracefully fade ambient instead of cutting it (will auto-resume on next start)
  if (ambientGain) {
    try { ambientGain.gain.setTargetAtTime(0, getAudioCtx().currentTime, 1.5); } catch(e) {}
  }
}

/* ═══════════════════════════════════════
   ADJUST TIME
═══════════════════════════════════════ */
function adjustSC(delta) {
  if (state.sc.running) return;
  state.sc.total = Math.max(60, Math.min(MAX_SECS, state.sc.total + delta));
  state.sc.remaining = state.sc.total;
  updateSCDisplay(state.sc.remaining);
  updateHourglass(state.sc.remaining, state.sc.total);
}
function adjustAN(delta) {
  if (state.an.running) return;
  state.an.total = Math.max(60, Math.min(MAX_SECS, state.an.total + delta));
  state.an.remaining = state.an.total;
  updateANDisplay(state.an.remaining);
  setClockHands(state.an.remaining, state.an.total);
}
function adjustDigit(part, delta) {
  if (state.di.running) return;
  const secs = state.di.total;
  let h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
  if (part === 'hr')  h = Math.max(0, Math.min(9, h + delta));
  else if (part === 'min') m = Math.max(0, Math.min(59, m + delta));
  else s = Math.max(0, Math.min(59, s + delta));
  const total = h*3600 + m*60 + s;
  state.di.total = Math.max(1, total);
  state.di.remaining = state.di.total;
  updateDIDisplay(state.di.remaining);
}

/* ═══════════════════════════════════════
   PROMPT SET TIME
═══════════════════════════════════════ */
function promptSetTime(id) {
  if (state[id].running) return;
  const input = prompt('Set timer (hh:mm:ss or mm:ss or minutes):', fmt(state[id].total));
  if (!input) return;
  let secs = 0;
  const parts = input.trim().split(':');
  if (parts.length === 3) secs = parseInt(parts[0]||0)*3600 + parseInt(parts[1]||0)*60 + parseInt(parts[2]||0);
  else if (parts.length === 2) secs = parseInt(parts[0]||0)*60 + parseInt(parts[1]||0);
  else secs = parseInt(input)*60;
  secs = Math.max(1, Math.min(MAX_SECS, secs || 1500));
  state[id].total = secs; state[id].remaining = secs;
  updateDisplay(id, secs);
  if (id === 'sc') updateHourglass(secs, secs);
}

function focusDigit(part) {
  if (state.di.running) return;
  document.querySelectorAll('.seven-seg').forEach(e => e.classList.remove('editing'));
  const el = document.getElementById('di-' + part);
  if(el) { el.classList.add('editing'); el.focus(); }
}

function digitKey(e, part) {
  if (state.di.running) return;
  const el = e.currentTarget;
  
  if (e.key >= '0' && e.key <= '9') {
    e.preventDefault();
    let currentStr = el.textContent.padStart(2, '0');
    let newStr = currentStr[1] + e.key;
    let val = parseInt(newStr, 10);
    
    if (part === 'hr') val = Math.min(99, val);
    else val = Math.min(59, val);
    
    const secs = state.di.total;
    let h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
    if (part === 'hr') h = val;
    if (part === 'min') m = val;
    if (part === 'sec') s = val;
    
    const total = Math.max(1, h*3600 + m*60 + s);
    state.di.total = total; 
    state.di.remaining = total;
    updateDIDisplay(total);
    
    el.style.transform = 'scale(1.05)';
    setTimeout(() => { el.style.transform = ''; }, 100);
    focusDigit(part);

  } else if (e.key === 'ArrowUp') {
    e.preventDefault(); adjustDigit(part, 1);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault(); adjustDigit(part, -1);
  } else if (e.key === 'Escape' || e.key === 'Enter') {
    el.classList.remove('editing');
    el.blur();
  }
}

/* ═══════════════════════════════════════
   VIRTUAL NUMPAD (mobile)
═══════════════════════════════════════ */
let _numpadPart = null;      // 'hr' | 'min' | 'sec'
let _numpadStr  = '';        // accumulated digit string (up to 2 chars)

function openNumpad(part) {
  if (state.di.running) return;
  _numpadPart = part;

  // Populate header label
  const labels = { hr: 'Hours', min: 'Minutes', sec: 'Seconds' };
  document.getElementById('numpad-field-label').textContent = labels[part];

  // Seed preview with current value
  const secs = state.di.total;
  let h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
  const cur = part === 'hr' ? h : part === 'min' ? m : s;
  _numpadStr = String(cur).padStart(2, '0');
  document.getElementById('numpad-preview').textContent = _numpadStr;

  // Highlight the seg
  focusDigit(part);

  // Open overlay
  document.getElementById('numpad-overlay').classList.add('open');
  playClickSound();
}

function closeNumpad() {
  document.getElementById('numpad-overlay').classList.remove('open');
  document.querySelectorAll('.seven-seg').forEach(e => e.classList.remove('editing'));
  _numpadPart = null;
  _numpadStr  = '';
}

function numpadOverlayClick(e) {
  // Close only if clicking the dim backdrop (not the modal itself)
  if (e.target === document.getElementById('numpad-overlay')) {
    numpadDone(); // commit before closing
  }
}

function _numpadApply() {
  if (!_numpadPart) return;
  let val = parseInt(_numpadStr || '0', 10);
  if (_numpadPart === 'hr') val = Math.min(99, val);
  else val = Math.min(59, val);

  const secs = state.di.total;
  let h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
  if (_numpadPart === 'hr') h = val;
  if (_numpadPart === 'min') m = val;
  if (_numpadPart === 'sec') s = val;

  const total = Math.max(1, h*3600 + m*60 + s);
  state.di.total = total;
  state.di.remaining = total;
  updateDIDisplay(total);
}

function numpadPress(digit) {
  if (!_numpadPart) return;
  // Shift left and append new digit (scroll-in style, max 2 chars)
  if (_numpadStr.length >= 2) _numpadStr = _numpadStr[1] + digit;
  else _numpadStr += digit;
  // Clamp preview
  let val = parseInt(_numpadStr, 10);
  if (_numpadPart !== 'hr') val = Math.min(59, val);
  _numpadStr = String(val).padStart(2, '0');

  const preview = document.getElementById('numpad-preview');
  preview.textContent = _numpadStr;
  // Micro-pop animation
  preview.classList.remove('pop');
  void preview.offsetWidth; // reflow
  preview.classList.add('pop');
  setTimeout(() => preview.classList.remove('pop'), 120);

  _numpadApply();
  playClickSound();
}

function numpadBackspace() {
  if (!_numpadPart) return;
  _numpadStr = _numpadStr.slice(0, -1) || '0';
  _numpadStr = _numpadStr.padStart(2, '0');
  document.getElementById('numpad-preview').textContent = _numpadStr;
  _numpadApply();
  playClickSound();
}

function numpadDone() {
  _numpadApply();
  closeNumpad();
  playClickSound();
}

// Allow physical keyboard to still type into the focused seven-seg even while numpad is open
document.addEventListener('keydown', e => {
  if (!_numpadPart) return;
  if (e.key >= '0' && e.key <= '9') { e.preventDefault(); numpadPress(e.key); }
  else if (e.key === 'Backspace')    { e.preventDefault(); numpadBackspace(); }
  else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); numpadDone(); }
  else if (e.key === 'Escape')       { closeNumpad(); }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.digit-group')) {
    document.querySelectorAll('.seven-seg').forEach(el => el.classList.remove('editing'));
  }
});

/* ═══════════════════════════════════════
   TICK SOUND
═══════════════════════════════════════ */
let tickEnabled = false;
let audioCtx = null;
let masterVolume = 0.5;

function setVolume(val) {
  masterVolume = parseFloat(val);
  // Sync all sliders
  document.querySelectorAll('.master-volume').forEach(el => el.value = val);
  // Update running ambient sound in real time
  if (ambientGain) {
    try { ambientGain.gain.setTargetAtTime(masterVolume, getAudioCtx().currentTime, 0.1); } catch(e) {}
  }
}

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTick() {
  if (!tickEnabled || currentSound !== 'tick') return;
  try {
    const ctx = getAudioCtx();
    // Clock tick: sharp transient noise burst
    const bufSize = ctx.sampleRate * 0.04; // 40ms
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      // Exponential decay of white noise = tick click
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.08));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.35 * masterVolume;
    // High-pass to make it crisp
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1200;
    src.connect(hp); hp.connect(gain); gain.connect(ctx.destination);
    src.start();
  } catch(e) {}
}

function toggleTick(btn) {
  tickEnabled = !tickEnabled;
  btn.textContent = tickEnabled ? '🔔 Tick: On' : '🔔 Tick: Off';
  btn.classList.toggle('active', tickEnabled);
  // Resume audio context on user gesture
  if (tickEnabled && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  if (tickEnabled) playTick(); // preview click
}

/* ── UI CLICK SOUND ── */
function playClickSound() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.06 * masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
  } catch(e) {}
}
// Play on every button / card click
document.addEventListener('click', e => {
  if (e.target.closest('button, .home-card')) playClickSound();
}, { passive: true });

function playDoneSound() {
  // Simple beep via Web Audio API
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 200, 400].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay/1000);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay/1000 + 0.4);
      osc.start(ctx.currentTime + delay/1000);
      osc.stop(ctx.currentTime + delay/1000 + 0.4);
    });
  } catch(e) {}
}

/* ═══════════════════════════════════════
   BREAK
═══════════════════════════════════════ */
function openBreak(id) {
  breakSourceTimer = id;
  if (state[id].running) pauseTimer(id);
  setBreak(5, document.querySelector('.preset-btn'));
  document.getElementById('break-modal').classList.add('open');
}
function closeBreak() {
  clearInterval(breakInterval);
  document.getElementById('break-modal').classList.remove('open');
}
function setBreak(mins, btn) {
  clearInterval(breakInterval);
  breakRemaining = mins * 60;
  document.getElementById('break-display').textContent = fmt(breakRemaining);
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Update display
  document.getElementById('break-display').textContent = fmt(breakRemaining);
}
function startBreak() {
  clearInterval(breakInterval);
  breakInterval = setInterval(() => {
    breakRemaining--;
    document.getElementById('break-display').textContent = fmt(breakRemaining);
    if (breakRemaining <= 0) {
      clearInterval(breakInterval);
      document.getElementById('break-display').textContent = '00:00';
      showNotify('Break over — Back to focus');
      playDoneSound();
      setTimeout(closeBreak, 1500);
    }
  }, 1000);
}

/* ═══════════════════════════════════════
   NOTIFY
═══════════════════════════════════════ */
function showNotify(msg) {
  const n = document.getElementById('notify');
  n.textContent = msg; n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 3500);
}

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
updateSCDisplay(state.sc.remaining);
updateHourglass(state.sc.remaining, state.sc.total);
updateANDisplay(state.an.remaining);
setClockHands(state.an.remaining, state.an.total);
updateDIDisplay(state.di.remaining);

// Keyboard shortcuts handled below in extended block

/* ═══════════════════════════════════════
   INLINE TIME INPUT
═══════════════════════════════════════ */
function showInlineInput(id) {
  if (state[id].running) return;
  const display = document.getElementById(id + '-display');
  const input = document.getElementById(id + '-inline');
  input.value = fmt(state[id].total);
  display.style.display = 'none';
  input.classList.add('visible');
  input.focus();
  input.select();
}

function hideInlineInput(id) {
  const display = document.getElementById(id + '-display');
  const input = document.getElementById(id + '-inline');
  display.style.display = '';
  input.classList.remove('visible');
}

function applyInlineInput(id) {
  const input = document.getElementById(id + '-inline');
  const val = input.value.trim();
  if (val) {
    let secs = 0;
    const parts = val.split(':');
    if (parts.length === 3) secs = parseInt(parts[0]||0)*3600 + parseInt(parts[1]||0)*60 + parseInt(parts[2]||0);
    else if (parts.length === 2) secs = parseInt(parts[0]||0)*60 + parseInt(parts[1]||0);
    else secs = parseInt(val)*60;
    secs = Math.max(1, Math.min(MAX_SECS, secs || 1500));
    state[id].total = secs; state[id].remaining = secs;
    updateDisplay(id, secs);
    if (id === 'sc') updateHourglass(secs, secs);
  }
  hideInlineInput(id);
}

function inlineKey(e, id) {
  if (e.key === 'Enter') applyInlineInput(id);
  if (e.key === 'Escape') hideInlineInput(id);
}

/* ═══════════════════════════════════════
   BREAK SLIDER + MANUAL INPUT
═══════════════════════════════════════ */
function onBreakSlider(val) {
  val = parseInt(val);
  breakRemaining = val * 60;
  document.getElementById('break-display').textContent = fmt(breakRemaining);
  document.getElementById('break-manual').value = '';
  // update slider gradient
  const pct = ((val - 1) / 59 * 100).toFixed(1);
  document.getElementById('break-slider').style.setProperty('--pct', pct + '%');
  // deselect presets
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  clearInterval(breakInterval);
}

function onBreakManual(val) {
  val = val.trim();
  if (!val) return;
  let secs = 0;
  const parts = val.split(':');
  if (parts.length === 2) secs = parseInt(parts[0]||0)*60 + parseInt(parts[1]||0);
  else secs = parseInt(val)*60;
  secs = Math.max(60, Math.min(3600, secs || 300));
  breakRemaining = secs;
  document.getElementById('break-display').textContent = fmt(breakRemaining);
  // sync slider
  const mins = Math.round(secs/60);
  document.getElementById('break-slider').value = Math.min(60, mins);
  const pct = ((Math.min(60, mins) - 1) / 59 * 100).toFixed(1);
  document.getElementById('break-slider').style.setProperty('--pct', pct + '%');
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  clearInterval(breakInterval);
}

/* ═══════════════════════════════════════
   DEEP WORK MODE
═══════════════════════════════════════ */
let dwTimer = null;
let dwCursorTimeout = null;

function enterDeepWork(id) {
  const overlay = document.getElementById('deep-work-overlay');
  const labels = { sc: 'Sand Clock', an: 'Analog Timer', di: 'Digital Timer' };
  document.getElementById('dw-label').textContent = 'Deep Work — ' + labels[id];
  overlay._timerId = id;
  overlay.classList.add('active');

  // request fullscreen
  try {
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
  } catch(e) {}

  // start timer if not already running
  if (!state[id].running) startTimer(id);
  updateDWDisplay();
  dwTimer = setInterval(updateDWDisplay, 500);

  // hide cursor after 3s idle
  setupDWCursor();
}

function updateDWDisplay() {
  const overlay = document.getElementById('deep-work-overlay');
  const id = overlay._timerId;
  if (!id) return;
  const secs = state[id].remaining;
  const total = state[id].total;
  document.getElementById('dw-time').textContent = fmt(secs);
  const pct = total > 0 ? ((total - secs) / total * 100).toFixed(1) : 0;
  document.getElementById('dw-progress').style.width = pct + '%';
  document.querySelector('.dw-btn').textContent = state[id].paused ? '▶ Resume' : '⏸ Pause';
}

function dwToggle() {
  const id = document.getElementById('deep-work-overlay')._timerId;
  if (!id) return;
  state[id].running && !state[id].paused ? pauseTimer(id) : startTimer(id);
  setTimeout(updateDWDisplay, 50);
}

function exitDeepWork() {
  clearInterval(dwTimer); dwTimer = null;
  document.getElementById('deep-work-overlay').classList.remove('active');
  document.getElementById('deep-work-overlay')._timerId = null;
  try {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch(e) {}
}

function setupDWCursor() {
  const overlay = document.getElementById('deep-work-overlay');
  clearTimeout(dwCursorTimeout);
  overlay.classList.add('cursor-visible');
  dwCursorTimeout = setTimeout(() => overlay.classList.remove('cursor-visible'), 3000);
  overlay.onmousemove = overlay.ontouchstart = () => {
    clearTimeout(dwCursorTimeout);
    overlay.classList.add('cursor-visible');
    dwCursorTimeout = setTimeout(() => overlay.classList.remove('cursor-visible'), 3000);
  };
}

/* ═══════════════════════════════════════
   SESSION HISTORY (localStorage)
═══════════════════════════════════════ */
const SESSION_KEY = 'tempus_sessions';
let currentLabel = { sc:'Focus', an:'Focus', di:'Focus' };

function getSessions() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '[]'); } catch(e) { return []; }
}
function saveSessions(arr) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(arr.slice(-100))); } catch(e) {}
}
function recordSession(id, secsCompleted) {
  const sessions = getSessions();
  const taskInput = document.getElementById(`task-input-${id}`);
  let taskText = taskInput ? taskInput.value.trim() : '';

  sessions.push({
    label: currentLabel[id],
    task: taskText || '',
    timer: { sc:'Sand Clock', an:'Analog', di:'Digital' }[id],
    secs: secsCompleted,
    ts: Date.now()
  });
  saveSessions(sessions);
}

function fmtDur(secs) {
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm ' + (secs%60) + 's';
}

function openStats() {
  const sessions = getSessions();
  const now = Date.now();
  const dayMs = 86400000, weekMs = 7*dayMs;
  const today = sessions.filter(s => now - s.ts < dayMs);
  const week  = sessions.filter(s => now - s.ts < weekMs);
  const todayTotal = today.reduce((a,s) => a + s.secs, 0);
  const weekTotal  = week.reduce((a,s)  => a + s.secs, 0);
  const longest = sessions.length ? Math.max(...sessions.map(s=>s.secs)) : 0;

  document.getElementById('stat-today').textContent = fmtDur(todayTotal);
  document.getElementById('stat-week').textContent  = fmtDur(weekTotal);
  document.getElementById('stat-sessions').textContent = sessions.length;
  document.getElementById('stat-longest').textContent  = longest ? fmtDur(longest) : '—';

  const hist = document.getElementById('stats-history');
  if (!sessions.length) {
    hist.innerHTML = '<div class="history-row"><span style="color:var(--white-dim);font-size:0.44rem;letter-spacing:0.1em">No sessions yet</span></div>';
  } else {
    hist.innerHTML = [...sessions].reverse().slice(0,20).map(s => {
      const d = new Date(s.ts);
      const time = d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      const date = d.toLocaleDateString([], {month:'short',day:'numeric'});
      const titleLine = s.task ? `<br><span style="color:var(--white);font-size:0.5rem;text-transform:none;letter-spacing:0">${s.task}</span>` : '';
      return `<div class="history-row">
        <span class="history-label">${s.label} · ${s.timer}${titleLine}</span>
        <span class="history-meta">${fmtDur(s.secs)} &nbsp; ${date} ${time}</span>
      </div>`;
    }).join('');
  }
  document.getElementById('stats-overlay').classList.add('open');
}
function closeStats() { document.getElementById('stats-overlay').classList.remove('open'); }
function clearStats() { localStorage.removeItem(SESSION_KEY); openStats(); }

/* ═══════════════════════════════════════
   SESSION LABELS
═══════════════════════════════════════ */
function setLabel(id, label, btn) {
  currentLabel[id] = label;
  btn.closest('.label-row').querySelectorAll('.label-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ═══════════════════════════════════════
   AMBIENT SOUND ENGINE (Web Audio)
   KEY FIX: use a generation counter so the delayed cleanup
   in stopAmbient never kills a newly-started node.
═══════════════════════════════════════ */
let currentSound = 'tick';
let ambientNode = null;
let ambientGain = null;
let ambientGen  = 0; // incremented each time we stop, so old timeouts self-cancel

function setSound(type, btn) {
  currentSound = type;
  // Sync all sound rows across all three pages
  document.querySelectorAll('.sound-chip').forEach(b => {
    const t = b.textContent.trim().toLowerCase();
    const match =
      (type === 'tick'  && t.includes('tick'))  ||
      (type === 'rain'  && t.includes('rain'))   ||
      (type === 'brown' && t.includes('brown'))  ||
      (type === 'cafe'  && (t.includes('café') || t.includes('cafe'))) ||
      (type === 'river' && t.includes('river'))  ||
      (type === 'gamma' && t.includes('gamma'))  ||
      (type === 'piano' && t.includes('piano'))  ||
      (type === 'flute' && t.includes('flute'))  ||
      (type === 'off'   && t.includes('off'));
    b.classList.toggle('active', match);
  });
  stopAmbient();
  tickEnabled = (type === 'tick');
  if (type !== 'tick' && type !== 'off') {
    // Resume AudioContext first (requires user gesture, which click provides),
    // then start after a tick so stopAmbient's fade has begun
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    setTimeout(() => startAmbient(type), 80);
  }
}

function stopAmbient() {
  ambientGen++; // invalidate any pending timeout from previous stop
  const myGen = ambientGen;
  const nodeToStop = ambientNode;
  const gainToStop = ambientGain;
  ambientNode = null;
  ambientGain = null;
  if (gainToStop) {
    try {
      gainToStop.gain.setTargetAtTime(0, getAudioCtx().currentTime, 0.3);
    } catch(e) {}
  }
  setTimeout(() => {
    if (ambientGen !== myGen) return; // a new sound started — don't touch anything
    if (nodeToStop) { try { nodeToStop.stop(); } catch(e) {} }
  }, 500);
}

function startAmbient(type) {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    // 12-second buffer — long enough to feel seamless when looping
    const sr = ctx.sampleRate;
    const bufLen = Math.floor(sr * 12);
    const buf = ctx.createBuffer(2, bufLen, sr);

    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);

      if (type === 'brown') {
        // Paul Kellett's brown noise (pink noise variant, warmer)
        let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
        for (let i = 0; i < bufLen; i++) {
          const w = Math.random()*2-1;
          b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
          b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
          b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
          d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
          b6 = w*0.115926;
        }

      } else if (type === 'rain') {
        let b0=0, b1=0;
        for (let i = 0; i < bufLen; i++) {
          const w = Math.random()*2-1;
          b0 = 0.97*b0+w*0.18; b1 = 0.95*b1+w*0.1;
          const drop = Math.random()>0.998 ? (Math.random()-0.5)*0.55 : 0;
          d[i] = b0*0.45 + b1*0.3 + drop;
        }

      } else if (type === 'river') {
        let b0=0, b1=0;
        for (let i = 0; i < bufLen; i++) {
          const w = Math.random()*2-1;
          // Calm river trickle (filter out harsh deep rumble from brown noise)
          b0 = 0.96*b0 + w*0.03; 
          b1 = 0.85*b1 + w*0.05; 
          // Gentle ripples instead of rushing waves
          const surge = 1 + 0.15 * Math.sin(2 * Math.PI * (i/sr) * 0.2); 
          d[i] = (b0*0.5 + b1*0.7) * surge * 0.25;
        }

      } else if (type === 'cafe') {
        let b0=0, b1=0;
        for (let i = 0; i < bufLen; i++) {
          const w = Math.random()*2-1;
          b0 = 0.98*b0+w*0.06; b1 = 0.92*b1+w*0.04;
          const clink = Math.random()>0.9995 ? (Math.random()-0.5)*0.3*Math.exp(-((i%sr)/900)) : 0;
          d[i] = b0*0.38 + b1*0.22 + clink;
        }

      } else if (type === 'gamma') {
        // True binaural beat: L=200Hz, R=240Hz → 40Hz perceived beat
        const freq = ch === 0 ? 200 : 240;
        for (let i = 0; i < bufLen; i++) {
          const t2 = i / sr;
          // Smooth ends for seamless looping
          const edge = Math.min(1, Math.min(t2*3, (bufLen/sr - t2)*3));
          d[i] = Math.sin(2*Math.PI*freq*t2) * 0.2 * edge;
        }

      } else if (type === 'piano') {
        // Continuous, reverberant ambient piano drone
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C Maj Penatonic expanded
        d.fill(0);
        // We drop ~30 sustained overlapping notes across the 12 second buffer
        for (let n = 0; n < 30; n++) {
          const freq = notes[Math.floor(Math.random() * notes.length)] * (Math.random() > 0.8 ? 0.5 : 1); // sometimes drop an octave
          const start = Math.floor(Math.random() * bufLen);
          const durS = 4.0 + Math.random() * 4.0; // long 4-8 sec decay
          const maxJ = Math.floor(durS * sr);
          for (let j = 0; j < maxJ; j++) {
            let idx = (start + j) % bufLen; // wrap tightly so it loops seamlessly
            const t2 = j / sr;
            // Soft attack, very long tail
            const env = (1 - Math.exp(-t2 * 10)) * Math.exp(-t2 * 0.8);
            // Rich harmonics
            let val = Math.sin(2*Math.PI*freq*t2)*0.6 + Math.sin(2*Math.PI*freq*2*t2)*0.2 + Math.sin(2*Math.PI*freq*3*t2)*0.05;
            d[idx] += val * env * 0.08; 
          }
        }

      } else if (type === 'flute') {
        // Soothing Chinese flute (Dizi/Xiao style)
        const notes = [261.63, 293.66, 329.63, 392.00, 440.00]; // Pentatonic scale
        d.fill(0);
        // Play fewer, softer notes
        for (let n = 0; n < 15; n++) {
          const freq = notes[Math.floor(Math.random() * notes.length)] * (Math.random() > 0.5 ? 2 : 1);
          const start = Math.floor(Math.random() * bufLen);
          const durS = 2.0 + Math.random() * 3.0; // 2-5s swells
          const maxJ = Math.floor(durS * sr);
          
          const doBend = Math.random() > 0.6; // sometimes bend pitch up (portamento)
          const breathPhase = Math.random() * 100;
          
          for (let j = 0; j < maxJ; j++) {
            let idx = (start + j) % bufLen;
            const t2 = j / sr;
            // Soft envelope, airy
            const fadePoint = Math.min(1.0, durS * 0.3);
            const env = t2 < fadePoint ? (t2/fadePoint) : Math.max(0, 1 - (t2-fadePoint)/(durS-fadePoint));
            
            // Pitch bend and soft vibrato
            const bend = (doBend && t2 < 0.3) ? (1 - 0.05*Math.exp(-t2*15)) : 1;
            const vib = 1 + 0.001 * Math.sin(2*Math.PI*4.0*t2);
            
            const breath = (Math.random()*2-1) * 0.15 * Math.sin(2*Math.PI*(breathPhase+t2)*2.0);
            let val = Math.sin(2*Math.PI*freq*bend*vib*t2)*0.6 + Math.sin(2*Math.PI*freq*2*bend*vib*t2)*0.1 + breath;
            
            d[idx] += val * env * 0.08;
          }
        }
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true; // MUST be true — plays forever until stopAmbient()

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    const volMap = { brown:0.55, rain:0.72, cafe:0.60, gamma:0.45, piano:0.78, flute:0.78 };
    gainNode.gain.linearRampToValueAtTime(volMap[type]||0.6, ctx.currentTime+1.0);

    const filter = ctx.createBiquadFilter();
    if (type === 'rain') {
      filter.type='bandpass'; filter.frequency.value=3200; filter.Q.value=0.6;
    } else if (type === 'brown' || type === 'cafe') {
      filter.type='lowpass'; filter.frequency.value=1400; filter.Q.value=0.7;
    } else {
      filter.type='highshelf'; filter.frequency.value=8000; filter.gain.value=-3;
    }

    src.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    src.start(0);

    // Store refs AFTER start so stopAmbient's timeout can't interfere
    ambientNode = src;
    ambientGain = gainNode;

  } catch(e) { console.warn('Ambient audio error:', e); }
}

/* ═══════════════════════════════════════
   POMODORO AUTO-CYCLE
═══════════════════════════════════════ */
const POMO = { work: 25*60, shortBreak: 5*60, longBreak: 15*60, rounds: 4 };
let pomoState = { sc: false, an: false, di: false };
let pomoRound = { sc: 0, an: 0, di: 0 };

function togglePomo(id, btn) {
  pomoState[id] = !pomoState[id];
  btn.classList.toggle('active', pomoState[id]);
  if (pomoState[id]) {
    pomoRound[id] = 0;
    state[id].total = POMO.work; state[id].remaining = POMO.work;
    updateDisplay(id, POMO.work);
    if (id === 'sc') updateHourglass(POMO.work, POMO.work);
    renderPomoDots(id);
    showNotify('Pomodoro: 25 min focus · then 5 min break');
  } else {
    renderPomoDots(id);
  }
}

function renderPomoDots(id) {
  const wrap = document.getElementById(id + '-pomo-dots');
  if (!pomoState[id]) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = Array.from({length: POMO.rounds}, (_,i) => {
    const cls = i < pomoRound[id] ? 'done' : i === pomoRound[id] ? 'current' : '';
    return `<div class="pomo-dot ${cls}"></div>`;
  }).join('');
}

function onPomoComplete(id) {
  if (!pomoState[id]) return;
  const round = pomoRound[id];
  const isLongBreak = (round + 1) % POMO.rounds === 0;
  const breakMins = isLongBreak ? 15 : 5;
  pomoRound[id] = (round + 1) % POMO.rounds;
  renderPomoDots(id);
  showNotify(`Round ${round+1} done! Starting ${breakMins} min break…`);
  // auto-open AND auto-start break modal
  breakSourceTimer = id;
  setBreak(breakMins, null);
  document.getElementById('break-modal').classList.add('open');
  // auto-start after a short delay so the user sees the modal open
  setTimeout(() => startBreak(), 800);
}

/* ═══════════════════════════════════════
   THEME TOGGLE
═══════════════════════════════════════ */
function rebuildClockTicks() {
  const svg = document.getElementById('clock-ticks-svg');
  svg.innerHTML = '';
  const isLight = document.body.classList.contains('light');
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * 2 * Math.PI - Math.PI/2;
    const isMaj = i % 5 === 0;
    const r1 = isMaj ? 118 : 122, r2 = 128;
    const x1 = 130 + r1 * Math.cos(angle), y1 = 130 + r1 * Math.sin(angle);
    const x2 = 130 + r2 * Math.cos(angle), y2 = 130 + r2 * Math.sin(angle);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',x1); line.setAttribute('y1',y1);
    line.setAttribute('x2',x2); line.setAttribute('y2',y2);
    line.setAttribute('stroke', isMaj ? (isLight ? '#1c1916' : '#f0ece4') : (isLight ? '#c8bfaf' : '#2a2a2a'));
    line.setAttribute('stroke-width', isMaj ? '2' : '1');
    svg.appendChild(line);
  }
}

function toggleTheme() {
  document.body.classList.toggle('light');
  document.documentElement.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  document.querySelector('.theme-toggle').textContent = isLight ? '◐ Dark' : '◐ Light';
  try { localStorage.setItem('tempus_theme', isLight ? 'light' : 'dark'); } catch(e) {}
  rebuildClockTicks();
}
// restore saved theme
try {
  if (localStorage.getItem('tempus_theme') === 'light') {
    document.body.classList.add('light');
    document.documentElement.classList.add('light');
    document.querySelector('.theme-toggle').textContent = '◐ Dark';
    rebuildClockTicks();
  }
} catch(e) {}

/* ═══════════════════════════════════════
   SHARE SESSION (Canvas)
═══════════════════════════════════════ */
function shareSession(id) {
  // Show elapsed time if running/done, otherwise show planned total
  const elapsed = state[id].total - state[id].remaining;
  const secs = elapsed > 10 ? elapsed : state[id].total;
  const label = currentLabel[id];
  const timerName = { sc:'Sand Clock', an:'Analog', di:'Digital' }[id];
  const canvas = document.getElementById('share-canvas');
  const ctx2 = canvas.getContext('2d');

  // Background
  ctx2.fillStyle = '#080808';
  ctx2.fillRect(0, 0, 800, 400);

  // Gold border
  ctx2.strokeStyle = '#7a6440';
  ctx2.lineWidth = 1;
  ctx2.strokeRect(20, 20, 760, 360);

  // Title
  ctx2.fillStyle = '#c8a96e';
  ctx2.font = '300 48px Georgia, serif';
  ctx2.textAlign = 'center';
  ctx2.fillText('TEMPUS', 400, 100);

  // Label
  ctx2.fillStyle = '#888880';
  ctx2.font = '14px monospace';
  ctx2.fillText(label.toUpperCase() + '  ·  ' + timerName.toUpperCase(), 400, 140);

  // Time
  ctx2.fillStyle = '#f0ece4';
  ctx2.font = '72px monospace';
  ctx2.fillText(fmtDur(secs || state[id].total), 400, 240);

  // Footer
  ctx2.fillStyle = '#7a6440';
  ctx2.font = '11px monospace';
  ctx2.fillText('tempus-focustimer.vercel.app', 400, 370);

  canvas.toBlob(blob => {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'tempus.png', { type: 'image/png' })] })) {
      navigator.share({ files: [new File([blob], 'tempus.png', { type: 'image/png' })], title: 'TEMPUS Session' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tempus-session.png';
      a.click();
    }
  });
}

/* ═══════════════════════════════════════
   KEYBOARD SHORTCUTS (extended)
═══════════════════════════════════════ */
let kbdHintTimer = null;
function showKbdHint() {
  const h = document.getElementById('kbd-hint');
  h.classList.add('show');
  clearTimeout(kbdHintTimer);
  kbdHintTimer = setTimeout(() => h.classList.remove('show'), 3000);
}

document.addEventListener('keydown', e => {
  if (document.getElementById('stats-overlay').classList.contains('open')) {
    if (e.key === 'Escape') closeStats(); return;
  }
  if (document.getElementById('deep-work-overlay').classList.contains('active')) return;
  if (document.getElementById('break-modal').classList.contains('open')) return;
  // Don't intercept when user is typing in an input
  if (e.target.tagName === 'INPUT') return;

  const p = currentPage;
  if (p === 'home') {
    if (e.key === '?') showKbdHint();
    return;
  }
  const id = p === 'sandclock-page' ? 'sc' : p === 'analog-page' ? 'an' : 'di';
  showKbdHint();
  if (e.code === 'Space') { e.preventDefault(); state[id].running && !state[id].paused ? pauseTimer(id) : startTimer(id); }
  if (e.code === 'KeyR') { e.preventDefault(); resetTimer(id); }
  if (e.code === 'KeyD') { e.preventDefault(); enterDeepWork(id); }
  if (e.code === 'KeyB') { e.preventDefault(); openBreak(id); }
  if (e.code === 'Escape') navigate('home');
});

/* ═══════════════════════════════════════
   PATCH onComplete for stats + pomo
═══════════════════════════════════════ */
// onComplete is already defined above; we extend it here by wrapping startTimer's callback
// We hook into the setInterval inside startTimer by patching the completion branch directly.
// Simpler: override via a post-complete hook called from the extended onComplete below.
// Replace original onComplete with extended version:
const _onCompleteBase = onComplete;
window._onCompleteExtended = function(id) {
  _onCompleteBase(id);
  recordSession(id, state[id].total);
  onPomoComplete(id);
  if (pomoState[id]) {
    setTimeout(() => {
      state[id].total = POMO.work; state[id].remaining = POMO.work;
      updateDisplay(id, POMO.work);
      if (id === 'sc') updateHourglass(POMO.work, POMO.work);
      setStatus(id, 'Ready for next round', '');
    }, 2000);
  }
};

/* ═══════════════════════════════════════
   INIT POMO DOTS
═══════════════════════════════════════ */
['sc','an','di'].forEach(id => renderPomoDots(id));

