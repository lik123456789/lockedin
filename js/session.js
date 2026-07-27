// js/session.js - depends: utils.js, storage.js

let sessionStart = null;
let elapsedBeforePause = 0;
let timerInterval = null;
let paused = false;
let mediaStream = null;
let pendingDuration = 0;
let activeTrackers = [];
let currentActiveTrackerId = null;
let draftEntries = [];
let sessionActive = false;
let sessionState = 'inactive';
let pickupPending = false;
let pickupCount = 0;
let currentSessionOrientation = 'vertical';
let currentSessionPhotoUrl = null;
let currentSessionId = null;

let currentIntention = "";
let selectedTrackerIds = [];

document.addEventListener('visibilitychange', () => {
  if(!sessionActive) return;
  if(document.hidden){
    pickupPending = true;
  } else if(pickupPending){
    pickupCount++;
    pickupPending = false;
  }
});

function findActiveTracker(id){
  return activeTrackers.find(t => t.id === id) || null;
}

function openSegment(trackerId){
  const t = findActiveTracker(trackerId);
  if(!t) return;
  t.segmentStart = currentElapsedSec();
}

function closeSegment(trackerId){
  const t = findActiveTracker(trackerId);
  if(!t || t.segmentStart == null) return;
  const end = currentElapsedSec();
  const duration = Math.max(0, end - t.segmentStart);
  t.segments.push({start: t.segmentStart, end, duration});
  t.segmentStart = null;
}

function trackerActiveSeconds(t){
  if(t.activeSecOverride != null) return t.activeSecOverride;
  let sum = t.segments.reduce((a,seg)=>a+seg.duration,0);
  if(t.segmentStart != null){
    sum += Math.max(0, currentElapsedSec() - t.segmentStart);
  }
  return sum;
}

function switchActiveTracker(trackerId){
  if(trackerId === currentActiveTrackerId) return;
  if(currentActiveTrackerId) closeSegment(currentActiveTrackerId);
  currentActiveTrackerId = trackerId;
  openSegment(trackerId);
  renderTrackerToggles();
}

function renderTrackerToggles(){
  const row = $('tracker-toggle-row');
  row.innerHTML = "";
  if(activeTrackers.length === 0){
    $('tap-count-hint').textContent = "";
    $('tap-hint').style.display = "none";
    return;
  }
  $('tap-hint').style.display = "block";
  $('tap-hint').textContent = "Tap anywhere to count · use − to undo";
  activeTrackers.forEach(t => {
    const wrap = document.createElement('div');
    wrap.className = "tracker-toggle-wrap";

    const dec = document.createElement('button');
    dec.className = "tg-dec";
    dec.textContent = "−";
    dec.onclick = (e) => {
      e.stopPropagation();
      if(t.count > 0){
        t.count--;
        t.events.pop();
        const idx = draftEntries.map(d => d.trackerId).lastIndexOf(t.id);
        if(idx > -1) draftEntries.splice(idx, 1);
        renderTrackerToggles();
      }
    };

    const el = document.createElement('div');
    el.className = "tracker-toggle" + (t.id === currentActiveTrackerId ? " active" : "");
    el.innerHTML = `<span class="tg-name">${escapeHtml(t.name)}</span><span class="tg-count">${t.count}</span>`;
    el.onclick = (e) => { e.stopPropagation(); switchActiveTracker(t.id); };

    wrap.appendChild(dec);
    wrap.appendChild(el);
    row.appendChild(wrap);
  });
  updateTapHint();
}

function updateTapHint(){
  const t = findActiveTracker(currentActiveTrackerId);
  const hint = $('tap-count-hint');
  if(!t){
    hint.innerHTML = "<b>Select a tracker</b> to label what you count on screen.";
    return;
  }
  hint.innerHTML = "Tapping the screen logs a count for <b>" + escapeHtml(t.name) + "</b> — you'll review and edit everything at the end.";
}

async function startCamera(){
  $('cam-off-msg').style.display = "none";
  $('cam-video').style.display = "block";
  try{
    mediaStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"user" }, audio:false });
    $('cam-video').srcObject = mediaStream;
  }catch(e){
    $('cam-off-msg').style.display = "flex";
    $('cam-video').style.display = "none";
  }
}

function stopCamera(){
  if(mediaStream){
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  $('cam-video').srcObject = null;
  sessionState = 'inactive';
  document.body.classList.remove('session-active');
  document.documentElement.style.background = '';
  handleOrientationLogic();
}

function resetTimerState(){
  sessionStart = Date.now();
  elapsedBeforePause = 0;
  paused = false;
  pickupCount = 0;
  pickupPending = false;
  sessionActive = true;
  sessionState = 'active';
  document.body.classList.add('session-active');
  document.documentElement.style.background = '#000';
  // read chosen orientation from setup radios (default vertical)
  const sel = document.querySelector('input[name="session-orientation"]:checked');
  currentSessionOrientation = sel ? sel.value : 'vertical';
  // prepare session id for photo upload linking
  currentSessionId = Date.now().toString();
  currentSessionPhotoUrl = null;
  handleOrientationLogic();
  $('btn-pause').textContent = "Pause";
  $('timer-sub').textContent = "Studying";
  $('rec-dot').classList.remove('paused');
}

// Capture current video frame to blob and upload (if possible)
async function capturePhoto(){
  const video = $('cam-video');
  if(!video || video.readyState < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if(!blob){ resolve(null); return; }
      // try upload to Firebase Storage if available and user signed in
      if(typeof uploadSessionPhoto === 'function' && typeof fbUser !== 'undefined' && fbUser){
        const url = await uploadSessionPhoto(currentSessionId, blob);
        currentSessionPhotoUrl = url || null;
        resolve(currentSessionPhotoUrl || URL.createObjectURL(blob));
      } else {
        // fallback: use object URL (local-only)
        const url = URL.createObjectURL(blob);
        currentSessionPhotoUrl = url;
        resolve(url);
      }
    }, 'image/jpeg', 0.86);
  });
}

function currentElapsedSec(){
  if(paused) return elapsedBeforePause/1000;
  return (elapsedBeforePause + (Date.now() - sessionStart))/1000;
}

function startTimer(){
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay(){
  $('timer-display').textContent = fmtHMS(currentElapsedSec());
}

function setupSessionUI(){
  $('btn-pause').onclick = () => {
    if(!paused){
      paused = true;
      elapsedBeforePause += Date.now() - sessionStart;
      $('btn-pause').textContent = "Resume";
      $('timer-sub').textContent = "Paused";
      $('rec-dot').classList.add('paused');
      if(mediaStream) mediaStream.getVideoTracks().forEach(t => t.enabled = false);
    } else {
      paused = false;
      sessionStart = Date.now();
      $('btn-pause').textContent = "Pause";
      $('timer-sub').textContent = "Studying";
      $('rec-dot').classList.remove('paused');
      if(mediaStream) mediaStream.getVideoTracks().forEach(t => t.enabled = true);
    }
  };

  $('btn-end').onclick = () => {
    clearInterval(timerInterval);
    stopCamera();
    sessionActive = false;
    if(currentActiveTrackerId) closeSegment(currentActiveTrackerId);
    pendingDuration = Math.floor(currentElapsedSec());
    if(pendingDuration < 5){
      showScreen('screen-home');
      return;
    }
    showSummary();
  };

  $('cam-fullscreen').addEventListener('click', (e) => {
    if(!sessionActive || paused) return;
    const ignoreSelectors = '.pusher, .tracker-toggle, .tg-dec, .tg-inc, .modal-sheet';
    if(e.target.closest(ignoreSelectors)) return;
    const t = findActiveTracker(currentActiveTrackerId);
    if(!t) return;
    const elapsedSec = Math.floor(currentElapsedSec());
    t.count++;
    t.events.push(elapsedSec);
    draftEntries.push({
      id: Date.now() + "_" + Math.random().toString(36).slice(2,7),
      trackerId: t.id,
      text: "#" + t.count,
      elapsedSec
    });
    renderTrackerToggles();
    burstConfetti($('tracker-toggle-row').querySelector('.tracker-toggle.active') || $('timer-display'));
  });
}

setupSessionUI();

function handleOrientationLogic() {
  const isLandscape = window.innerWidth > window.innerHeight;
  // Don't block orientation — only set orientation classes for styling/advisory
  // (orientation overlay is intentionally not used per user preference)
  document.body.classList.remove('mode-portrait-guard');
  const guardEl = $('orientation-guard');
  if (guardEl) guardEl.classList.remove('visible');

  // If session isn't active, clear orientation classes and exit
  if (sessionState !== 'active') {
    document.body.classList.remove('mode-landscape', 'mode-portrait');
    return;
  }

  // While session is active, set explicit orientation classes
  if (isLandscape) {
    document.body.classList.add('mode-landscape');
    document.body.classList.remove('mode-portrait');
  } else {
    document.body.classList.add('mode-portrait');
    document.body.classList.remove('mode-landscape');
  }
}

window.addEventListener('resize', () => {
  handleOrientationLogic();
});

window.addEventListener('orientationchange', () => {
  handleOrientationLogic();
});

if (screen.orientation) {
  screen.orientation.addEventListener('change', () => {
    handleOrientationLogic();
  });
}

handleOrientationLogic();

