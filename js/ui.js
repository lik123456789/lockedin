// js/ui.js - depends: utils.js, storage.js, session.js

let currentSubject = null;
let tagEditMode = false;
let trackerEditMode = false;
let detailSessionId = null;
let selectedRating = 0;

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  const tb = $('tab-bar');
  const fab = $('fab-add-manual');
  if(['screen-home','screen-insights','screen-logs'].includes(id)){
    tb.classList.add('visible');
    fab.classList.add('visible');
    $('tab-home').classList.toggle('active', id === 'screen-home');
    $('tab-insights').classList.toggle('active', id === 'screen-insights');
    $('tab-logs').classList.toggle('active', id === 'screen-logs');
  } else {
    tb.classList.remove('visible');
    fab.classList.remove('visible');
  }
}

function computeStats(){
  const totalSeconds = sessions.reduce((a,s)=>a+s.durationSec,0);
  const totalSessions = sessions.length;
  const avg = totalSessions ? totalSeconds/totalSessions : 0;
  const longest = sessions.reduce((m,s)=>Math.max(m,s.durationSec),0);

  const daySet = new Set(sessions.map(s=>dayKey(s.startedAt)));
  let streak = 0;
  let cursor = startOfDay(new Date());
  while(daySet.has(dayKey(cursor))){
    streak++;
    cursor.setDate(cursor.getDate()-1);
  }

  const week = [];
  for(let i=6;i>=0;i--){
    const d = startOfDay(new Date());
    d.setDate(d.getDate()-i);
    const key = dayKey(d);
    const mins = sessions.filter(s=>dayKey(s.startedAt)===key)
                          .reduce((a,s)=>a+s.durationSec,0)/60;
    week.push({date:d, minutes:mins, studied: mins>0});
  }
  const sessionsThisWeek = week.reduce((a,d)=> a + sessions.filter(s=>dayKey(s.startedAt)===dayKey(d.date)).length, 0);

  return {totalSeconds, totalSessions, avg, longest, streak, week, sessionsThisWeek};
}

function renderDial(stats){
  const stops = [];
  const segAngle = 360/7;
  const gap = 4;
  stats.week.forEach((d, i) => {
    let color = "rgba(237,234,226,0.08)";
    const isToday = (i === 6);
    if (d.minutes > 0) {
      color = isToday ? "#C9A05C" : "#E4C07E";
    }
    const start = i*segAngle + gap/2;
    const end = (i+1)*segAngle - gap/2;
    stops.push(color + " " + start + "deg " + end + "deg");
  });
  $('dial-ring').style.background = "conic-gradient(" + stops.join(", ") + ")";

  const ticksEl = $('dial-ticks');
  ticksEl.innerHTML = "";
  const labels = stats.week.map(d => "SMTWTFS"[d.date.getDay()]);

  const dialEl = ticksEl.closest('.dial') || ticksEl.parentElement;
  const dialRect = dialEl.getBoundingClientRect();
  const dialW = dialRect.width || 236;
  const dialH = dialRect.height || 236;
  const cx = dialW / 2;
  const cy = dialH / 2;
  const R = cx * 0.847;
  const TICK_HALF = 9;

  stats.week.forEach((d,i)=>{
    const angleDeg = i*segAngle + segAngle/2 - 90;
    const rad = angleDeg * Math.PI/180;
    const x = cx + R*Math.cos(rad) - TICK_HALF;
    const y = cy + R*Math.sin(rad) - TICK_HALF;
    const tick = document.createElement('div');
    const isToday = (i === 6);
    tick.className = "dial-tick" + (d.studied ? " studied" : "") + (isToday ? " today" : "");
    tick.style.left = x + "px";
    tick.style.top = y + "px";
    tick.textContent = labels[i];
    ticksEl.appendChild(tick);
  });

  $('dial-count').textContent = stats.sessionsThisWeek;
}

function renderHome(){
  const stats = computeStats();
  $('home-date').textContent = new Date().toLocaleDateString(undefined, {weekday:'long', month:'short', day:'numeric'});
  $('streak-pill').textContent = "🔥 " + stats.streak + " day" + (stats.streak===1?"":"s") + " streak";
  $('stat-total').textContent = fmtShort(stats.totalSeconds);
  $('stat-sessions').textContent = stats.totalSessions;
  $('stat-avg').textContent = fmtShort(stats.avg);
  $('stat-longest').textContent = fmtShort(stats.longest);
  renderDial(stats);
}

function renderChips(){
  const row = $('chip-row');
  row.innerHTML = "";
  subjects.forEach(sub => {
    const chip = document.createElement('div');
    chip.className = "chip" + (sub === currentSubject && !tagEditMode ? " selected" : "");
    if(tagEditMode){
      chip.innerHTML = `<span>${escapeHtml(sub)}</span><span class="chip-x">✕</span>`;
      chip.onclick = () => {
        if(confirm('Delete tag "' + sub + '"?')){
          subjects = subjects.filter(x => x !== sub);
          if(currentSubject === sub) currentSubject = subjects[0] || null;
          saveSubjects();
          renderChips();
        }
      };
    } else {
      chip.textContent = sub;
      chip.onclick = () => { currentSubject = sub; renderChips(); };
    }
    row.appendChild(chip);
  });
  if(!tagEditMode){
    const addChip = document.createElement('div');
    addChip.className = "chip add-chip";
    addChip.textContent = "+ New tag";
    addChip.onclick = () => {
      const name = prompt("Name this tag:", "");
      if(name && name.trim()){
        const trimmed = name.trim();
        if(!subjects.includes(trimmed)) subjects.push(trimmed);
        currentSubject = trimmed;
        saveSubjects();
        renderChips();
      }
    };
    row.appendChild(addChip);
  }
}

function renderTrackerChips(){
  const row = $('tracker-chip-row');
  row.innerHTML = "";
  trackers.forEach(t => {
    const chip = document.createElement('div');
    const isSelected = selectedTrackerIds.includes(t.id);
    chip.className = "chip tracker-chip" + (isSelected && !trackerEditMode ? " selected" : "");
    if(trackerEditMode){
      chip.innerHTML = `<span>${escapeHtml(t.name)}</span><span class="chip-x">✕</span>`;
      chip.onclick = () => {
        if(confirm('Delete tracker "' + t.name + '"?')){
          trackers = trackers.filter(x => x.id !== t.id);
          selectedTrackerIds = selectedTrackerIds.filter(id => id !== t.id);
          saveTrackers();
          renderTrackerChips();
        }
      };
    } else {
      chip.textContent = t.name;
      chip.onclick = () => {
        if(isSelected){
          selectedTrackerIds = selectedTrackerIds.filter(id => id !== t.id);
        } else {
          selectedTrackerIds.push(t.id);
        }
        renderTrackerChips();
      };
    }
    row.appendChild(chip);
  });
  if(!trackerEditMode){
    const addChip = document.createElement('div');
    addChip.className = "chip add-chip";
    addChip.textContent = "+ New tracker";
    addChip.onclick = () => {
      const name = prompt("Track what? (e.g. Flashcards reviewed)", "");
      if(name && name.trim()){
        const unit = prompt("Unit name (e.g. flashcard):", name.trim().toLowerCase().replace(/s$/,'')) || "item";
        const id = "t_" + Date.now();
        trackers.push({id, name: name.trim(), unit: unit.trim() || "item"});
        selectedTrackerIds.push(id);
        saveTrackers();
        renderTrackerChips();
      }
    };
    row.appendChild(addChip);
  }
}

function setupUIEvents(){
  $('tab-home').onclick = () => { showScreen('screen-home'); renderHome(); };
  $('tab-insights').onclick = () => { showScreen('screen-insights'); renderInsights(); };
  $('tab-logs').onclick = () => { showScreen('screen-logs'); renderLogs(); };

  $('tag-edit-toggle').onclick = () => {
    tagEditMode = !tagEditMode;
    $('tag-edit-toggle').textContent = tagEditMode ? "done" : "edit";
    renderChips();
  };

  $('tracker-edit-toggle').onclick = () => {
    trackerEditMode = !trackerEditMode;
    $('tracker-edit-toggle').textContent = trackerEditMode ? "done" : "edit";
    renderTrackerChips();
  };

  $('btn-goto-setup').onclick = () => {
    currentIntention = "";
    $('intention').value = "";
    $('btn-start-session').disabled = true;
    if(!currentSubject) currentSubject = subjects[0];
    selectedTrackerIds = [];
    tagEditMode = false; $('tag-edit-toggle').textContent = "edit";
    trackerEditMode = false; $('tracker-edit-toggle').textContent = "edit";
    renderChips();
    renderTrackerChips();
    showScreen('screen-setup');
    setTimeout(()=> $('intention').focus(), 300);
  };

  $('btn-back-home').onclick = () => showScreen('screen-home');

  $('intention').addEventListener('input', (e) => {
    currentIntention = e.target.value.trim();
    $('btn-start-session').disabled = currentIntention.length === 0;
  });

  $('btn-start-session').onclick = async () => {
    $('session-intention-display').textContent = "\u201C" + currentIntention + "\u201D";
    activeTrackers = trackers.filter(t => selectedTrackerIds.includes(t.id))
                              .map(t => ({id:t.id, name:t.name, unit:t.unit, count:0, events:[], segments:[], segmentStart:null}));
    draftEntries = [];
    currentActiveTrackerId = activeTrackers.length ? activeTrackers[0].id : null;
    renderTrackerToggles();
    showScreen('screen-session');
    resetTimerState();
    startTimer();
    await startCamera();
    if(currentActiveTrackerId) openSegment(currentActiveTrackerId);
  };

  $('btn-detail-back').onclick = () => showScreen('screen-home');
}

setupUIEvents();
