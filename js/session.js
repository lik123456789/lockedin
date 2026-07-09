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
let pickupPending = false;
let pickupCount = 0;

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
  if(!t){ hint.textContent = ""; return; }
  hint.innerHTML = "Tapping the screen logs a rough note to <b>" + escapeHtml(t.name) + "</b> — you'll review and edit everything at the end.";
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
}

function resetTimerState(){
  sessionStart = Date.now();
  elapsedBeforePause = 0;
  paused = false;
  pickupCount = 0;
  pickupPending = false;
  sessionActive = true;
  $('btn-pause').textContent = "Pause";
  $('timer-sub').textContent = "Studying";
  $('rec-dot').classList.remove('paused');
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
      text: t.name + " #" + t.count,
      elapsedSec
    });
    renderTrackerToggles();
    burstConfetti($('tracker-toggle-row').querySelector('.tracker-toggle.active') || $('timer-display'));
  });
}

setupSessionUI();
