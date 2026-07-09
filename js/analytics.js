// js/analytics.js - depends: utils.js, storage.js, session.js

function renderDraftReview(){
  const slot = $('draft-review-slot');
  slot.innerHTML = "";
  if(draftEntries.length === 0) return;

  const heading = document.createElement('div');
  heading.className = "field-label";
  heading.style.textAlign = "left";
  heading.style.justifyContent = "flex-start";
  heading.style.marginBottom = "10px";
  heading.textContent = "Review your taps — edit or delete before saving";
  slot.appendChild(heading);

  activeTrackers.forEach(t => {
    const entries = draftEntries.filter(d => d.trackerId === t.id);
    if(entries.length === 0) return;
    const activeSec = trackerActiveSeconds(t);
    const rate = entries.length ? (activeSec/60/entries.length).toFixed(1) : "—";
    const card = document.createElement('div');
    card.className = "draft-review-card";
    card.innerHTML = `
      <div class="draft-review-head">
        <span class="name">${escapeHtml(t.name)}</span>
        <span class="rate">${fmtMS(activeSec)} active · ${rate} min/${escapeHtml(t.unit)}</span>
      </div>
      <div class="draft-entry-list" id="draft-list-${t.id}"></div>
    `;
    slot.appendChild(card);
    const list = card.querySelector('.draft-entry-list');
    entries.forEach(entry => {
      const row = document.createElement('div');
      row.className = "draft-entry-row";
      row.innerHTML = `
        <span class="de-time">${fmtMS(entry.elapsedSec)}</span>
        <input type="text" value="${escapeHtml(entry.text)}" data-id="${entry.id}" />
        <div class="de-del" data-id="${entry.id}">✕</div>
      `;
      row.querySelector('input').addEventListener('input', (e) => {
        const d = draftEntries.find(x => x.id === entry.id);
        if(d) d.text = e.target.value;
      });
      row.querySelector('.de-del').onclick = () => {
        const idx = draftEntries.findIndex(x => x.id === entry.id);
        if(idx > -1) draftEntries.splice(idx,1);
        const tr = findActiveTracker(t.id);
        if(tr) tr.count = Math.max(0, tr.count - 1);
        renderDraftReview();
        renderTrackerSummarySlot();
      };
      list.appendChild(row);
    });
  });
}

function renderTrackerSummarySlot(){
  const trackerSlot = $('tracker-summary-slot');
  trackerSlot.innerHTML = "";
  if(pickupCount > 0){
    const pu = document.createElement('div');
    pu.className = "summary-sub";
    pu.style.marginTop = "-8px";
    pu.textContent = "📵 " + pickupCount + " phone pickup" + (pickupCount===1?"":"s") + " mid-session";
    trackerSlot.appendChild(pu);
  }
  activeTrackers.forEach(t => {
    const activeSec = trackerActiveSeconds(t);
    const rate = t.count>0 ? (activeSec/60/t.count).toFixed(1) : "—";
    const card = document.createElement('div');
    card.className = "tracker-summary-card";
    card.innerHTML = `
      <div class="tracker-summary-head">
        <span class="name">${escapeHtml(t.name)}</span>
        <span class="rate">${fmtMS(activeSec)} active · ${rate} min/${escapeHtml(t.unit)}</span>
      </div>
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:6px;">
        <button class="tg-dec ts-dec" style="width:32px; height:32px; font-size:20px;">−</button>
        <div class="tracker-summary-count" style="min-width:32px; text-align:center;">${t.count}</div>
        <button class="tg-inc ts-inc" style="width:32px; height:32px; font-size:20px;">+</button>
      </div>
      ${sparklineSvg(t.events, pendingDuration)}
    `;
    card.querySelector('.ts-dec').onclick = () => {
      if(t.count > 0){ t.count--; }
      renderTrackerSummarySlot();
    };
    card.querySelector('.ts-inc').onclick = () => {
      t.count++;
      renderTrackerSummarySlot();
    };
    trackerSlot.appendChild(card);
  });
}

function showSummary(){
  $('summary-intention').textContent = "\u201C" + currentIntention + "\u201D";
  $('summary-time').textContent = fmtHMS(pendingDuration);
  selectedRating = 0;
  renderRatingRow();

  const stats = computeStats();
  const prSlot = $('pr-banner-slot');
  prSlot.innerHTML = "";
  if(stats.totalSessions === 0 || pendingDuration > stats.longest){
    const banner = document.createElement('div');
    banner.className = "pr-banner";
    banner.textContent = "🏆 New longest session";
    prSlot.appendChild(banner);
  }

  renderDraftReview();
  renderTrackerSummarySlot();
  showScreen('screen-summary');
}

function renderRatingRow(){
  const row = $('rating-row');
  row.innerHTML = "";
  for(let i=1;i<=5;i++){
    const dot = document.createElement('div');
    dot.className = "rating-dot" + (i<=selectedRating ? " active" : "");
    dot.textContent = i;
    dot.onclick = () => { selectedRating = i; renderRatingRow(); };
    row.appendChild(dot);
  }
}

function setupSummaryUI(){
  $('btn-save').onclick = () => {
    sessions.push({
      id: Date.now(),
      startedAt: new Date(Date.now() - pendingDuration*1000).toISOString(),
      subject: currentSubject,
      intention: currentIntention,
      durationSec: pendingDuration,
      rating: selectedRating || null,
      pickups: pickupCount,
      trackers: activeTrackers.filter(t => t.count > 0).map(t => ({
        id: t.id, name: t.name, unit: t.unit, count: t.count, events: t.events,
        activeSec: Math.round(trackerActiveSeconds(t)),
        segments: t.segments,
        notes: draftEntries.filter(d => d.trackerId === t.id).map(d => ({text: d.text, elapsedSec: d.elapsedSec}))
      }))
    });
    saveSessions();
    renderHome();
    showScreen('screen-home');
  };
}

function openDetail(id){
  const s = sessions.find(x => x.id === id);
  if(!s) return;
  detailSessionId = id;
  const d = new Date(s.startedAt);
  const dateStr = d.toLocaleDateString(undefined,{weekday:'long', month:'short', day:'numeric'});
  const timeStr = d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});

  $('detail-meta').textContent = (s.subject || "") + " · " + dateStr + " · " + timeStr + (s.manual ? " · logged manually" : "");
  $('detail-intention').textContent = "\u201C" + (s.intention || "Study session") + "\u201D";
  $('detail-time').textContent = fmtHMS(s.durationSec);

  const grid = $('detail-stat-grid');
  grid.innerHTML = "";
  const statPairs = [
    ["Duration", fmtShort(s.durationSec)],
    ["Rating", s.rating ? "★".repeat(s.rating) : "—"],
    ["Pickups", s.pickups || 0]
  ];
  statPairs.forEach(([k,v]) => {
    const card = document.createElement('div');
    card.className = "stat-card";
    card.innerHTML = `<div class="v">${v}</div><div class="k">${k}</div>`;
    grid.appendChild(card);
  });

  const slot = $('detail-tracker-slot');
  slot.innerHTML = "";
  if(!s.trackers || s.trackers.length === 0){
    const empty = document.createElement('div');
    empty.className = "empty-state";
    empty.textContent = "No tracking data logged for this session.";
    slot.appendChild(empty);
  } else {
    s.trackers.forEach(t => {
      const activeSec = t.activeSec != null ? t.activeSec : s.durationSec;
      const rate = t.count>0 ? (activeSec/60/t.count).toFixed(1) : "—";
      const notesHtml = (t.notes && t.notes.length)
        ? '<div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">' +
            t.notes.map(n => `<div style="font-size:12.5px; color:var(--text-dim);"><span style="font-family:ui-monospace,monospace; color:var(--text-faint); margin-right:8px;">${fmtMS(n.elapsedSec)}</span>${escapeHtml(n.text)}</div>`).join("") +
          '</div>'
        : "";
      const card = document.createElement('div');
      card.className = "tracker-summary-card";
      card.innerHTML = `
        <div class="tracker-summary-head">
          <span class="name">${escapeHtml(t.name)}</span>
          <span class="rate">${fmtMS(activeSec)} active · ${rate} min/${escapeHtml(t.unit)}</span>
        </div>
        <div class="tracker-summary-count">${t.count}</div>
        ${sparklineSvg(t.events, s.durationSec)}
        ${notesHtml}
      `;
      slot.appendChild(card);
    });
  }
  showScreen('screen-detail');
}

function renderHeatmap(){
  const scroll = $('heatmap-scroll');
  scroll.innerHTML = "";
  const totalDays = 371;
  const today = startOfDay(new Date());
  let start = new Date(today);
  start.setDate(start.getDate() - (totalDays - 1));
  start.setDate(start.getDate() - start.getDay());

  const dayMinutes = {};
  sessions.forEach(s => {
    const k = dayKey(s.startedAt);
    dayMinutes[k] = (dayMinutes[k] || 0) + s.durationSec/60;
  });

  let cursor = new Date(start);
  while(cursor <= today){
    const col = document.createElement('div');
    col.className = 'heatmap-col';
    for(let d=0; d<7; d++){
      const cell = document.createElement('div');
      if(cursor <= today){
        const mins = dayMinutes[dayKey(cursor)] || 0;
        let lvl = 0;
        if(mins > 0 && mins < 20) lvl = 1;
        else if(mins >= 20 && mins < 60) lvl = 2;
        else if(mins >= 60) lvl = 3;
        cell.className = 'heatmap-cell l' + lvl;
        cell.title = cursor.toLocaleDateString(undefined,{month:'short',day:'numeric'}) + ': ' + Math.round(mins) + 'm';
      } else {
        cell.className = 'heatmap-cell';
        cell.style.visibility = 'hidden';
      }
      col.appendChild(cell);
      cursor.setDate(cursor.getDate() + 1);
    }
    scroll.appendChild(col);
  }
  scroll.parentElement.scrollLeft = scroll.scrollWidth;
}

function minutesThisWeekForSubject(subj){
  const start = startOfDay(new Date());
  start.setDate(start.getDate() - 6);
  return sessions.filter(s => s.subject === subj && new Date(s.startedAt) >= start)
                 .reduce((a,s) => a + s.durationSec, 0) / 60;
}

function renderGoals(){
  const feed = $('goals-feed');
  feed.innerHTML = "";
  const tags = Object.keys(goals);
  if(tags.length === 0){
    const empty = document.createElement('div');
    empty.className = "empty-state";
    empty.innerHTML = "No weekly goals yet.<br/>Tap "+ String.fromCharCode(34) + "+ add goal" + String.fromCharCode(34) +" to set one for a tag.";
    feed.appendChild(empty);
    return;
  }
  tags.forEach(tag => {
    const targetHrs = goals[tag];
    const mins = minutesThisWeekForSubject(tag);
    const pct = Math.max(0, Math.min(100, (mins/60) / targetHrs * 100));
    const card = document.createElement('div');
    card.className = "goal-card";
    card.innerHTML = `
      <div class="goal-head">
        <span class="name">${escapeHtml(tag)}</span>
        <span class="amt">${(mins/60).toFixed(1)}h / ${targetHrs}h</span>
      </div>
      <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%;"></div></div>
      <div class="goal-del">remove goal</div>
    `;
    card.querySelector('.goal-del').onclick = () => {
      delete goals[tag];
      saveGoals();
      renderGoals();
    };
    feed.appendChild(card);
  });
}

function computePRs(){
  const byTag = {};
  sessions.forEach(s => {
    const tag = s.subject || "Untagged";
    if(!byTag[tag]) byTag[tag] = { longest: 0, trackerBest: {} };
    if(s.durationSec > byTag[tag].longest) byTag[tag].longest = s.durationSec;
    (s.trackers || []).forEach(t => {
      if(t.count > 0){
        const activeSec = t.activeSec != null ? t.activeSec : s.durationSec;
        const rate = (activeSec/60) / t.count;
        const existing = byTag[tag].trackerBest[t.name];
        if(!existing || rate < existing.rate){
          byTag[tag].trackerBest[t.name] = { rate, unit: t.unit };
        }
      }
    });
  });
  return byTag;
}

function renderPRs(){
  const feed = $('pr-feed');
  feed.innerHTML = "";
  const byTag = computePRs();
  const tagNames = Object.keys(byTag);
  if(tagNames.length === 0){
    const empty = document.createElement('div');
    empty.className = "empty-state";
    empty.innerHTML = "No records yet.<br/>Finish a session to start setting PRs.";
    feed.appendChild(empty);
    return;
  }
  tagNames.sort((a,b) => byTag[b].longest - byTag[a].longest).forEach(tag => {
    const rec = byTag[tag];
    const trackerRows = Object.keys(rec.trackerBest).map(name => {
      const b = rec.trackerBest[name];
      return `<div class="pr-row"><span class="k">Best pace · ${escapeHtml(name)}</span><span class="v">${b.rate.toFixed(1)} min/${escapeHtml(b.unit)}</span></div>`;
    }).join("");
    const card = document.createElement('div');
    card.className = "pr-card";
    card.innerHTML = `
      <div class="tag">${escapeHtml(tag)}</div>
      <div class="pr-row"><span class="k">Longest session</span><span class="v">${fmtShort(rec.longest)}</span></div>
      ${trackerRows}
    `;
    feed.appendChild(card);
  });
}

function renderLogs(){
  const tagSel = $('log-filter-tag');
  const prevTag = tagSel.value;
  tagSel.innerHTML = '<option value="">All tags</option>';
  [...new Set(sessions.map(s => s.subject).filter(Boolean))].sort().forEach(tag => {
    const o = document.createElement('option');
    o.value = tag; o.textContent = tag;
    tagSel.appendChild(o);
  });
  if(prevTag) tagSel.value = prevTag;

  const sortVal = $('log-sort').value;
  const filterTag = tagSel.value;

  let list = [...sessions];
  if(filterTag) list = list.filter(s => s.subject === filterTag);
  if(sortVal === 'date-desc') list.sort((a,b) => new Date(b.startedAt) - new Date(a.startedAt));
  else if(sortVal === 'date-asc') list.sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt));
  else if(sortVal === 'dur-desc') list.sort((a,b) => b.durationSec - a.durationSec);
  else if(sortVal === 'dur-asc') list.sort((a,b) => a.durationSec - b.durationSec);
  else if(sortVal === 'rating-desc') list.sort((a,b) => (b.rating||0) - (a.rating||0));

  const feed = $('logs-feed');
  feed.innerHTML = "";
  if(list.length === 0){
    feed.innerHTML = '<div class="empty-state">No sessions match.</div>';
    return;
  }
  list.forEach(s => {
    const card = document.createElement('div');
    card.className = "session-card";
    const d = new Date(s.startedAt);
    const timeStr = d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
    const dateStr = d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
    const tagTxt = (s.subject||"").slice(0,3).toUpperCase();
    let trackerTagsHtml = "";
    if(s.trackers && s.trackers.length){
      trackerTagsHtml = '<div class="tracker-tags">' + s.trackers.map(t => {
        const activeSec = t.activeSec != null ? t.activeSec : s.durationSec;
        const rate = t.count>0 ? (activeSec/60/t.count).toFixed(1) + " min/" + t.unit : "";
        return `<span class="tracker-tag">${escapeHtml(t.name)}: ${t.count}${rate ? " · " + rate : ""}</span>`;
      }).join("") + '</div>';
    }
    card.innerHTML = `
      <div class="session-card-top">
        <div class="session-badge">${tagTxt}</div>
        <div class="session-info">
          <div class="intention">${escapeHtml(s.intention || "Study session")}</div>
          <div class="meta">${dateStr} · ${timeStr}${s.rating ? " · " + "★".repeat(s.rating) : ""}</div>
        </div>
        ${s.manual ? '<span class="session-manual-tag">manual</span>' : ''}
        <div class="session-dur">${fmtShort(s.durationSec)}</div>
        <div class="session-del" data-id="${s.id}">✕</div>
      </div>
      ${trackerTagsHtml}
    `;
    card.querySelector('.session-del').onclick = (e) => {
      e.stopPropagation();
      if(confirm("Delete this session?")){
        sessions = sessions.filter(x => x.id !== s.id);
        saveSessions();
        renderLogs();
        renderHome();
      }
    };
    card.onclick = () => openDetail(s.id);
    feed.appendChild(card);
  });
}

function renderInsights(){
  renderHeatmap();
  renderGoals();
  renderPRs();
}

document.addEventListener('change', (e) => {
  if(e.target.id === 'log-filter-tag' || e.target.id === 'log-sort') renderLogs();
});

$('btn-add-goal').onclick = () => {
  if(subjects.length === 0){ alert('Add a tag first.'); return; }
  const tag = prompt('Set a weekly goal for which tag?\n(' + subjects.join(', ') + ')', subjects[0]);
  if(!tag) return;
  const trimmed = tag.trim();
  if(!subjects.includes(trimmed)){ alert("That's not one of your tags."); return; }
  const hrsStr = prompt('Weekly goal in hours for "' + trimmed + '":', '5');
  const hrs = parseFloat(hrsStr);
  if(!hrs || hrs <= 0) return;
  goals[trimmed] = hrs;
  saveGoals();
  renderGoals();
};

setupSummaryUI();
