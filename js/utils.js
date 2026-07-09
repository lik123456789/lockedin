// js/utils.js - No dependencies

const DEFAULT_SUBJECTS = ["DifEq", "LinAlg","MVC","E&M"];
const DEFAULT_TRACKERS = [
  {id:"problems", name:"Problems solved", unit:"problem"},
  {id:"pages", name:"Pages read", unit:"page"},
  {id:"chapters", name:"Chapters finished", unit:"chapter"}
];
const COLORS = ["#C9A05C","#E4C07E","#B8483D","#7FA687","#EDEAE2"];

const $ = (id) => document.getElementById(id);

function fmtHMS(totalSec){
  totalSec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(totalSec/3600);
  const m = Math.floor((totalSec%3600)/60);
  const s = totalSec%60;
  return h + ":" + String(m).padStart(2,'0') + ":" + String(s).padStart(2,'0');
}

function fmtMS(totalSec){
  totalSec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(totalSec/60);
  const s = totalSec%60;
  return m + ":" + String(s).padStart(2,'0');
}

function fmtShort(totalSec){
  const h = totalSec/3600;
  if(h >= 1) return h.toFixed(1).replace(/\.0$/,'') + "h";
  return Math.round(totalSec/60) + "m";
}

function dayKey(d){
  const dt = new Date(d);
  return dt.getFullYear()+"-"+(dt.getMonth()+1)+"-"+dt.getDate();
}

function startOfDay(d){
  const dt = new Date(d);
  dt.setHours(0,0,0,0);
  return dt;
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function burstConfetti(originEl){
  const rect = originEl.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  for(let i=0;i<18;i++){
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.background = COLORS[Math.floor(Math.random()*COLORS.length)];
    piece.style.left = cx + 'px';
    piece.style.top = cy + 'px';
    document.body.appendChild(piece);
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random()*90;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 40;
    const rot = (Math.random()*720 - 360);
    const dur = 650 + Math.random()*400;
    piece.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy + 160}px) rotate(${rot}deg)`, opacity: 0 }
    ], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)' });
    setTimeout(()=> piece.remove(), dur + 50);
  }
}

function sparklineSvg(events, durationSec){
  const w = 260, h = 46;
  if(!events || events.length === 0){
    return `<svg width="100%" height="${h}" style="display:block;"></svg>`;
  }
  const maxT = Math.max(durationSec, 1);
  const maxC = events.length;
  const pts = events.map((sec, i) => {
    const x = (sec / maxT) * (w-6) + 3;
    const y = h - ((i+1) / maxC) * (h-6) - 3;
    return x.toFixed(1) + "," + y.toFixed(1);
  });
  let path = "M3," + (h-3);
  if(pts.length > 0) {
    path += " L" + pts.join(" L");
    const lastY = h - (events.length / maxC) * (h-6) - 3;
    path += ` L${w-3},${lastY.toFixed(1)}`;
  } else {
    path += ` L${w-3},${h-3}`;
  }
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display:block; margin: 0 auto;">
    <path d="${path}" fill="none" stroke="#7FA687" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
