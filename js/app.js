// js/app.js - Main entry point, depends on all other modules

function openManualModal(){
  $('manual-intention').value = "";

  const subSel = $('manual-subject');
  subSel.innerHTML = "";
  subjects.forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub; opt.textContent = sub;
    subSel.appendChild(opt);
  });
  if(currentSubject) subSel.value = currentSubject;

  $('manual-rating').value = "0";

  const now = new Date();
  $('manual-date').value = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,'0') + "-" + String(now.getDate()).padStart(2,'0');
  $('manual-time').value = String(now.getHours()).padStart(2,'0') + ":" + String(now.getMinutes()).padStart(2,'0');
  $('manual-hours').value = "";
  $('manual-minutes').value = "";

  const list = $('manual-tracker-list');
  list.innerHTML = "";
  trackers.forEach(t => {
    const row = document.createElement('div');
    row.className = "manual-tracker-row";
    row.innerHTML = `
      <span class="mt-name">${escapeHtml(t.name)}</span>
      <input type="number" min="0" step="1" inputmode="numeric" placeholder="0" id="mt-${t.id}" />
    `;
    list.appendChild(row);
  });

  $('manual-modal-backdrop').classList.add('visible');
}

function closeManualModal(){
  $('manual-modal-backdrop').classList.remove('visible');
}

function setupManualModal(){
  $('fab-add-manual').onclick = openManualModal;
  $('btn-manual-cancel').onclick = closeManualModal;
  
  $('manual-modal-backdrop').addEventListener('click', (e) => {
    if(e.target === $('manual-modal-backdrop')) closeManualModal();
  });

  $('btn-manual-save').onclick = () => {
    const intention = $('manual-intention').value.trim();
    if(!intention){ alert("Add an intention for this session."); return; }

    const hrs = parseFloat($('manual-hours').value) || 0;
    const mins = parseFloat($('manual-minutes').value) || 0;
    const durationSec = Math.round((hrs*3600) + (mins*60));
    if(durationSec <= 0){ alert("Enter how long you studied (hours and/or minutes)."); return; }

    const dateVal = $('manual-date').value;
    const timeVal = $('manual-time').value || "12:00";
    if(!dateVal){ alert("Pick a date."); return; }
    const startedAt = new Date(dateVal + "T" + timeVal + ":00");

    const manualTrackers = trackers.map(t => {
      const el = $('mt-' + t.id);
      const count = el ? (parseInt(el.value, 10) || 0) : 0;
      return { id: t.id, name: t.name, unit: t.unit, count, events: [], activeSec: durationSec };
    }).filter(t => t.count > 0);

    sessions.push({
      id: Date.now(),
      startedAt: startedAt.toISOString(),
      subject: $('manual-subject').value || subjects[0] || "Untagged",
      intention,
      durationSec,
      rating: parseInt($('manual-rating').value, 10) || null,
      pickups: 0,
      manual: true,
      trackers: manualTrackers
    });
    saveSessions();
    closeManualModal();
    renderHome();
    if(document.getElementById('screen-insights').classList.contains('active')) renderInsights();
  };
}

// Boot the app
(function init(){
  setupManualModal();
  initAuth();
})();
