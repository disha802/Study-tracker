(function(){
"use strict";

// Data keys are namespaced per profile (see profiles.js). Theme and mode are
// device preferences, so they stay shared.
var K = (window.Profiles && window.Profiles.key) || function(s){ return "constellation." + s; };

var STORAGE_KEY  = K("data.v1");
var ACTIVITY_KEY = K("activity.v1");
var VISIT_KEY    = K("lastVisit.v1");
var SEL_KEY      = K("selection.v2");
var SEED_KEY     = K("seed.ia1.v1");
var THEME_KEY    = "constellation.theme.v1";
var MODE_KEY     = "constellation.mode.v1";

var SUBJECTS = [
  { key:"genai",  name:"Generative AI",   code:"GEN-AI" },
  { key:"cloud",  name:"Cloud Computing", code:"CLOUD"  },
  { key:"ethics", name:"AI Ethics",       code:"EAIDS"  }
];

var STATUS = ["todo","progress","done"];
var STATUS_LABEL = { todo:"Not started", progress:"In progress", done:"Done" };

var THEORY_LABELS = ["M1","M2","M3","M4","M5","IA-1"];
var LAB_LABELS    = ["E1","E2","E3","E4","E5","E6","E7","E8","CA1","CA2"];

var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
var fine   = matchMedia('(hover:hover) and (pointer:fine)').matches;

/* ============================================================ data */
function makeItems(labels){
  return labels.map(function(l){ return { label:l, status:"todo", note:"", score:"" }; });
}

function defaultData(){
  var d = { theory:{}, labs:{}, project:{} };
  SUBJECTS.forEach(function(s){
    d.theory[s.key] = { items: makeItems(THEORY_LABELS) };
    d.labs[s.key]   = { items: makeItems(LAB_LABELS) };
  });
  d.project.partA = { title:"Codebase", status:"todo", tasks:[] };
  d.project.partB = { title:"Research Paper", status:"todo", tasks:[] };
  return d;
}

// keep saved items (matched by label), append new ones, restore canonical order
function reconcile(row, labels){
  var byLabel = {};
  (row.items || []).forEach(function(it){ byLabel[it.label] = it; });
  row.items = labels.map(function(l){
    var it = byLabel[l] || { label:l, status:"todo", note:"" };
    if(typeof it.score !== "string") it.score = "";
    if(STATUS.indexOf(it.status) === -1) it.status = "todo";
    return it;
  });
  return row;
}

function load(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultData();
    var parsed = JSON.parse(raw), def = defaultData();
    parsed.theory = parsed.theory || {};
    parsed.labs   = parsed.labs   || {};
    SUBJECTS.forEach(function(s){
      parsed.theory[s.key] = reconcile(parsed.theory[s.key] || def.theory[s.key], THEORY_LABELS);
      parsed.labs[s.key]   = reconcile(parsed.labs[s.key]   || def.labs[s.key],   LAB_LABELS);
    });
    if(!parsed.project) parsed.project = def.project;
    if(!parsed.project.partA) parsed.project.partA = def.project.partA;
    if(!parsed.project.partB) parsed.project.partB = def.project.partB;
    return parsed;
  }catch(e){
    console.warn("Could not parse saved data, starting fresh.", e);
    return defaultData();
  }
}

var data = load();

// one-time: record the E-AIDS IA-1 result.
// This is Amigo's actual mark, so it must never be pre-filled into another profile.
(function seedIA1(){
  try{
    if(window.Profiles && window.Profiles.activeId() !== "amigo") return;
    if(localStorage.getItem(SEED_KEY)) return;
    data.theory.ethics.items.some(function(it){
      if(it.label !== "IA-1") return false;
      it.status = "done"; it.score = "19/20"; return true;
    });
    localStorage.setItem(SEED_KEY, "1");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }catch(e){}
})();

function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  markActivity();
  flashSaved();
  notifyChanged();
}

// sync.js listens on this; absent when sync is not loaded
function notifyChanged(){
  if(window.__constellationChanged) window.__constellationChanged();
}

function flashSaved(){
  var el = document.getElementById("savedFlash");
  if(!el) return;
  el.classList.add("show");
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(function(){ el.classList.remove("show"); }, 1500);
}

function nextStatus(s){ return STATUS[(STATUS.indexOf(s)+1) % STATUS.length]; }
function esc(v){ var d = document.createElement("div"); d.textContent = v == null ? "" : v; return d.innerHTML; }
function subjectByKey(k){ return SUBJECTS.filter(function(s){ return s.key === k; })[0]; }

/* ============================================================ selection */
function loadSel(){
  try{
    var s = JSON.parse(localStorage.getItem(SEL_KEY));
    if(s && s.kind === "item" && data[s.domain] && data[s.domain][s.subject] && data[s.domain][s.subject].items[s.idx]) return s;
    if(s && s.kind === "project" && data.project[s.part]) return s;
  }catch(e){}
  return null;
}
var sel = loadSel();

function setSel(next){
  sel = next;
  if(sel) localStorage.setItem(SEL_KEY, JSON.stringify(sel));
  else localStorage.removeItem(SEL_KEY);
}
function sameSel(a,b){
  if(!a || !b || a.kind !== b.kind) return false;
  if(a.kind === "item") return a.domain===b.domain && a.subject===b.subject && a.idx===b.idx;
  return a.part === b.part;
}

/* ============================================================ activity */
function fmt(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function todayStr(){ return fmt(new Date()); }

function loadActivity(){
  try{ return JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || {}; }catch(e){ return {}; }
}
function markActivity(){
  var act = loadActivity(), t = todayStr();
  act[t] = (act[t] || 0) + 1;
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(act));
}
function computeStreak(act){
  var n = 0, d = new Date();
  if(!act[todayStr()]) d.setDate(d.getDate()-1);
  while(act[fmt(d)]){ n++; d.setDate(d.getDate()-1); }
  return n;
}
function weeklyCounts(){
  var act = loadActivity(), today = new Date(), out = [];
  for(var w = 11; w >= 0; w--){
    var sum = 0;
    for(var i = 0; i < 7; i++){
      var dt = new Date(today); dt.setDate(dt.getDate() - (w*7 + i));
      sum += act[fmt(dt)] || 0;
    }
    out.push(sum);
  }
  return out;
}

function renderSpark(){
  var vals = weeklyCounts(), max = Math.max.apply(null, vals.concat([1]));
  var W = 100, H = 34;
  var pts = vals.map(function(v,i){
    return [ (i/(vals.length-1))*W, H - (v/max)*(H-4) - 2 ];
  });
  var line = pts.map(function(p,i){ return (i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1); }).join(" ");
  var area = line + " L"+W+" "+H+" L0 "+H+" Z";
  var dots = pts.map(function(p){ return '<circle class="dot" cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="1"/>'; }).join("");
  document.getElementById("spark").innerHTML =
    '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">' +
      '<path class="area" d="'+area+'"/><path class="line" d="'+line+'"/>'+dots+'</svg>';
}

function renderHeatmap(){
  var act = loadActivity(), box = document.getElementById("activityHeatmap");
  box.innerHTML = "";
  var today = new Date(), frag = document.createDocumentFragment();
  for(var i = 83; i >= 0; i--){
    var d = new Date(today); d.setDate(d.getDate()-i);
    var key = fmt(d), c = act[key] || 0;
    var cell = document.createElement("div");
    cell.className = "heat-cell" + (key === todayStr() ? " today" : "");
    cell.dataset.level = c === 0 ? 0 : c < 3 ? 1 : c < 7 ? 2 : 3;
    cell.title = key + " — " + c + " update" + (c === 1 ? "" : "s");
    frag.appendChild(cell);
  }
  box.appendChild(frag);
  var streak = computeStreak(act);
  document.getElementById("streakCount").textContent = streak;
  document.getElementById("factStreak").textContent = streak + " day streak";
}

/* ============================================================ progress */
function pct(a,b){ return b === 0 ? 0 : Math.round(a/b*100); }
function weightOf(s){ return s === "done" ? 1 : s === "progress" ? .5 : 0; }

function rowStats(items){
  var done = 0, w = 0;
  items.forEach(function(i){ if(i.status === "done") done++; w += weightOf(i.status); });
  return { done:done, total:items.length, weighted:w, pct:pct(w, items.length) };
}
function domainStats(domain){
  var done = 0, total = 0, w = 0;
  SUBJECTS.forEach(function(s){
    var st = rowStats(data[domain][s.key].items);
    done += st.done; total += st.total; w += st.weighted;
  });
  return { done:done, total:total, pct:pct(w,total) };
}
function projectPartPct(p){
  if(p.tasks && p.tasks.length) return pct(p.tasks.filter(function(t){ return t.done; }).length, p.tasks.length);
  return Math.round(weightOf(p.status)*100);
}
function projectStats(){
  var a = projectPartPct(data.project.partA), b = projectPartPct(data.project.partB);
  var done = (data.project.partA.status === "done"?1:0) + (data.project.partB.status === "done"?1:0);
  return { pct: Math.round((a+b)/2), done:done, total:2 };
}
function overallStats(){
  var t = domainStats("theory"), l = domainStats("labs"), p = projectStats();
  return { overall: Math.round((t.pct + l.pct + p.pct)/3), done: t.done+l.done+p.done, total: t.total+l.total+p.total };
}
function statusCounts(){
  var c = { todo:0, progress:0, done:0 };
  ["theory","labs"].forEach(function(d){
    SUBJECTS.forEach(function(s){ data[d][s.key].items.forEach(function(i){ c[i.status]++; }); });
  });
  ["partA","partB"].forEach(function(k){ c[data.project[k].status]++; });
  return c;
}

/* ============================================================ index tile */
var lastOverall = -1, indexAnimated = false;

function renderIndex(){
  var c = statusCounts(), total = c.todo + c.progress + c.done || 1;
  var st = overallStats();

  document.querySelector(".meter .m-c").style.width = c.done/total*100 + "%";
  document.querySelector(".meter .m-i").style.width = c.progress/total*100 + "%";
  document.querySelector(".meter .m-u").style.width = c.todo/total*100 + "%";
  document.querySelectorAll("[data-n]").forEach(function(n){ n.textContent = c[n.dataset.n]; });
  document.getElementById("idxSub").textContent = "of " + total + " items complete";

  document.getElementById("doneCount").textContent = st.done;
  document.getElementById("totalCount").textContent = st.total;
  document.getElementById("factItems").textContent = st.total + " items";

  var target = pct(c.done, total), el = document.getElementById("pct");
  if(reduce || indexAnimated){ el.textContent = target + "%"; }
  else{
    indexAnimated = true;
    var t0 = null;
    (function step(ts){
      if(t0 === null) t0 = ts;
      var k = Math.min(1,(ts-t0)/1100), e = 1 - Math.pow(1-k,3);
      el.textContent = Math.round(target*e) + "%";
      if(k < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  if(st.overall === 100 && lastOverall !== -1 && lastOverall < 100) showToast("Everything is done — all " + st.total + " items complete.");
  lastOverall = st.overall;
}

/* ============================================================ summary tiles */
function ringSvg(p){
  var r = 30, c = 2*Math.PI*r;
  return '<div class="ring-wrap"><svg viewBox="0 0 74 74">' +
    '<circle class="ring-track" cx="37" cy="37" r="'+r+'"/>' +
    '<circle class="ring-fill" cx="37" cy="37" r="'+r+'" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+(c-(p/100)*c).toFixed(1)+'"/>' +
    '</svg><b>'+p+'</b></div>';
}

function summaryTile(el, label, title, stats, legend){
  el.innerHTML =
    '<span class="t-label">'+label+'</span>' +
    '<h2 class="t-title">'+title+'</h2>' +
    '<div class="sum-body">' + ringSvg(stats.pct) +
      '<div class="sum-figs"><span class="n">'+stats.done+'<span style="font-size:.5em;color:var(--faint)">/'+stats.total+'</span></span>' +
      '<span class="l">complete</span></div>' +
    '</div>' +
    '<div class="legend">'+legend+'</div>';
}

function renderSummaries(){
  summaryTile(document.getElementById("tileTheory"), "Theory", "Modules &amp; IA", domainStats("theory"),
    SUBJECTS.map(function(s){
      var st = rowStats(data.theory[s.key].items);
      return '<span>'+esc(s.code)+' <b>'+st.done+'/'+st.total+'</b></span>';
    }).join(""));

  summaryTile(document.getElementById("tileLabs"), "Labs", "Experiments &amp; CA", domainStats("labs"),
    SUBJECTS.map(function(s){
      var st = rowStats(data.labs[s.key].items);
      return '<span>'+esc(s.code)+' <b>'+st.done+'/'+st.total+'</b></span>';
    }).join(""));

  summaryTile(document.getElementById("tileProject"), "Major project", "Part A &amp; B", projectStats(),
    ["partA","partB"].map(function(k){
      var p = data.project[k], n = (p.tasks||[]).length, d = (p.tasks||[]).filter(function(t){ return t.done; }).length;
      return '<span>PART '+(k==="partA"?"A":"B")+' <b>'+(n ? d+"/"+n : STATUS_LABEL[p.status])+'</b></span>';
    }).join(""));
}

/* ============================================================ spotlight */
function firstUnfinished(){
  var rows = navRows();
  for(var r = 0; r < rows.length; r++)
    for(var c = 0; c < rows[r].length; c++){
      var ref = rows[r][c];
      var s = ref.kind === "item" ? data[ref.domain][ref.subject].items[ref.idx].status : data.project[ref.part].status;
      if(s !== "done") return ref;
    }
  return null;
}

function renderSpotlight(){
  var el = document.getElementById("spotlight");
  var ref = sel || firstUnfinished();
  var cog = '<button class="cog" id="themeBtn" aria-label="Switch colour theme">' +
      '<svg class="icon-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v3M12 18.4v3M21.4 12h-3M5.6 12h-3M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1M18.6 18.6l-2.1-2.1M7.5 7.5 5.4 5.4"/></svg>' +
      '<svg class="icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>' +
    '</button>';

  if(!ref){
    el.innerHTML = '<span class="t-label">Status</span><h2>All done</h2>' +
      '<div class="role">Nothing left this semester</div>' + cog;
    return;
  }

  var isItem = ref.kind === "item";
  var obj = isItem ? data[ref.domain][ref.subject].items[ref.idx] : data.project[ref.part];
  var eyebrow, title, role, p, meta;

  if(isItem){
    var subj = subjectByKey(ref.subject);
    eyebrow = (ref.domain === "theory" ? "Theory" : "Labs") + " · " + subj.code;
    title = obj.label;
    role = subj.name;
    p = rowStats(data[ref.domain][ref.subject].items).pct;
    meta = '<span>' + STATUS_LABEL[obj.status] + '</span><span>' + role + ' overall ' + p + '%</span>';
  }else{
    eyebrow = "Major project · Part " + (ref.part === "partA" ? "A" : "B");
    title = obj.title;
    role = STATUS_LABEL[obj.status];
    p = projectPartPct(obj);
    var n = (obj.tasks||[]).length;
    meta = '<span>' + (n ? n + " task" + (n===1?"":"s") : "No tasks yet") + '</span><span>' + p + '% complete</span>';
  }

  el.innerHTML =
    '<span class="t-label">' + esc(eyebrow) + '</span>' +
    '<div class="orb"><div class="spin"></div><div class="ring"></div><span class="pctnum">' + p + '</span></div>' +
    '<h2>' + esc(title) + '</h2>' +
    '<div class="role">' + esc(role) + '</div>' +
    (isItem && obj.score ? '<div class="scorebadge">' + esc(obj.score) + '</div>' : '') +
    '<div class="meta">' + meta + '</div>' + cog;
}

/* ============================================================ navigation model */
function navRows(){
  var rows = [];
  ["theory","labs"].forEach(function(domain){
    SUBJECTS.forEach(function(s){
      rows.push(data[domain][s.key].items.map(function(_,i){
        return { kind:"item", domain:domain, subject:s.key, idx:i };
      }));
    });
  });
  rows.push([{kind:"project",part:"partA"},{kind:"project",part:"partB"}]);
  return rows;
}
function locate(ref){
  var rows = navRows();
  for(var r=0;r<rows.length;r++) for(var c=0;c<rows[r].length;c++) if(sameSel(rows[r][c],ref)) return {rows:rows,r:r,c:c};
  return null;
}
function moveSel(dr,dc){
  var rows = navRows(), at = sel ? locate(sel) : null;
  if(!at){ setSel(rows[0][0]); renderAll(); return; }
  var r = Math.min(rows.length-1, Math.max(0, at.r+dr));
  var c = Math.min(rows[r].length-1, Math.max(0, at.c+dc));
  setSel(rows[r][c]);
  renderAll();
  var el = document.querySelector(".cell.selected,.proj-row.selected");
  if(el && el.scrollIntoView) el.scrollIntoView({block:"nearest", inline:"nearest"});
}

/* ============================================================ the sheet */
function cellHtml(item, ref, selected){
  var subj = subjectByKey(ref.subject);
  var t = subj.name + " " + item.label + " — " + STATUS_LABEL[item.status] +
          (item.score ? " · " + item.score : "") + (item.note ? " · has note" : "");
  return '<button class="cell '+item.status+(selected?" selected":"")+(item.note?" has-note":"")+(item.score?" has-score":"")+'"' +
    ' data-conf="'+item.status+'" data-kind="item" data-domain="'+ref.domain+'" data-subject="'+ref.subject+'" data-idx="'+ref.idx+'"' +
    ' title="'+esc(t)+'" aria-label="'+esc(t)+'"><span class="cell-mark"></span></button>';
}

function gridBlock(domain, heading, labels){
  var html = '<div class="block"><div class="block-title">'+heading+'</div>' +
    '<div class="grid" style="--cols:'+labels.length+'"><div class="grid-corner"></div>';
  labels.forEach(function(l){ html += '<div class="col-head">'+l+'</div>'; });
  html += '<div class="col-head col-head-meta">done</div>';

  SUBJECTS.forEach(function(s){
    var items = data[domain][s.key].items, st = rowStats(items);
    html += '<div class="row-label"><span class="row-name">'+esc(s.name)+'</span><span class="row-code">'+esc(s.code)+'</span></div>';
    items.forEach(function(item,i){
      var ref = {kind:"item", domain:domain, subject:s.key, idx:i};
      html += cellHtml(item, ref, sameSel(sel, ref));
    });
    html += '<div class="row-meta"><b>'+st.done+'</b>/'+st.total+'</div>';
  });
  return html + '</div></div>';
}

function projectBlock(){
  var html = '<div class="block"><div class="block-title">Major project</div><div class="proj-rows">';
  ["partA","partB"].forEach(function(key){
    var p = data.project[key], pp = projectPartPct(p);
    var d = (p.tasks||[]).filter(function(t){ return t.done; }).length;
    html += '<button class="proj-row '+p.status+(sameSel(sel,{kind:"project",part:key})?" selected":"")+'"' +
      ' data-conf="'+p.status+'" data-kind="project" data-part="'+key+'">' +
      '<span class="proj-tag">'+(key==="partA"?"A":"B")+'</span>' +
      '<span class="proj-name">'+esc(p.title)+'</span>' +
      '<span class="proj-status">'+STATUS_LABEL[p.status]+'</span>' +
      '<span class="proj-bar"><i style="width:'+pp+'%"></i></span>' +
      '<span class="proj-count">'+((p.tasks&&p.tasks.length)? d+"/"+p.tasks.length : "—")+'</span>' +
    '</button>';
  });
  return html + '</div></div>';
}

function renderGrids(){
  document.getElementById("grids").innerHTML =
    gridBlock("theory","Theory",THEORY_LABELS) +
    gridBlock("labs","Labs",LAB_LABELS) +
    projectBlock();
}

/* ============================================================ detail */
function statusButtons(cur){
  return '<div class="status-set">' + STATUS.map(function(s){
    return '<button class="status-opt'+(s===cur?" on":"")+'" data-set-status="'+s+'">'+STATUS_LABEL[s]+'</button>';
  }).join("") + '</div>';
}

function renderDetail(){
  var el = document.getElementById("detail");

  if(!sel){
    el.innerHTML = '<span class="t-label">Details</span><h2 class="t-title">Nothing selected</h2>' +
      '<p class="detail-empty">Pick any cell to set its status, score and notes.</p>';
    return;
  }

  if(sel.kind === "item"){
    var item = data[sel.domain][sel.subject].items[sel.idx], subj = subjectByKey(sel.subject);
    el.innerHTML =
      '<span class="t-label">'+(sel.domain==="theory"?"Theory":"Labs")+' &middot; '+esc(subj.code)+'</span>' +
      '<h2 class="t-title">'+esc(subj.name)+' &middot; '+esc(item.label)+'</h2>' +
      statusButtons(item.status) +
      '<label class="field-label" for="scoreBox">Score</label>' +
      '<input id="scoreBox" class="score-box" type="text" placeholder="e.g. 19/20" value="'+esc(item.score)+'">' +
      '<label class="field-label" for="noteBox">Notes</label>' +
      '<textarea id="noteBox" class="note-box" placeholder="Deadline, what is left, anything…">'+esc(item.note)+'</textarea>';
    return;
  }

  var p = data.project[sel.part];
  var tasks = (p.tasks||[]).map(function(t,i){
    return '<li class="task'+(t.done?" done":"")+'">' +
      '<button class="task-check'+(t.done?" checked":"")+'" data-task="'+i+'" aria-label="Toggle task"></button>' +
      '<span class="task-text">'+esc(t.text)+'</span>' +
      '<button class="task-del" data-del="'+i+'" aria-label="Delete task">&times;</button></li>';
  }).join("");

  el.innerHTML =
    '<span class="t-label">Major project &middot; Part '+(sel.part==="partA"?"A":"B")+'</span>' +
    '<h2 class="t-title">'+esc(p.title)+'</h2>' +
    statusButtons(p.status) +
    '<label class="field-label">Tasks</label>' +
    '<ul class="task-list">'+(tasks || '<li class="task-empty">No tasks yet.</li>')+'</ul>' +
    '<div class="task-add"><input type="text" id="taskInput" placeholder="Add a task…"><button id="taskAdd">Add</button></div>';
}

function renderAll(){
  renderIndex();
  renderSummaries();
  renderSpotlight();
  renderGrids();
  renderDetail();
  renderHeatmap();
  renderSpark();
}

/* ============================================================ mutations */
function cycleRef(ref){
  if(ref.kind === "item"){
    var it = data[ref.domain][ref.subject].items[ref.idx];
    it.status = nextStatus(it.status);
  }else{
    var p = data.project[ref.part];
    p.status = nextStatus(p.status);
  }
  persist();
}

/* ============================================================ events */
document.addEventListener("click", function(e){
  var modeBtn = e.target.closest(".dock button[data-mode]");
  if(modeBtn){ setMode(modeBtn.dataset.mode); return; }

  var hit = e.target.closest(".cell,.proj-row");
  if(hit){
    var ref = hit.dataset.kind === "item"
      ? {kind:"item", domain:hit.dataset.domain, subject:hit.dataset.subject, idx:+hit.dataset.idx}
      : {kind:"project", part:hit.dataset.part};
    setSel(ref); cycleRef(ref); renderAll();
    return;
  }

  var opt = e.target.closest("[data-set-status]");
  if(opt && sel){
    if(sel.kind === "item") data[sel.domain][sel.subject].items[sel.idx].status = opt.dataset.setStatus;
    else data.project[sel.part].status = opt.dataset.setStatus;
    persist(); renderAll();
    return;
  }

  var check = e.target.closest(".task-check");
  if(check && sel && sel.kind === "project"){
    var t = data.project[sel.part].tasks[+check.dataset.task];
    t.done = !t.done; persist(); renderAll();
    return;
  }

  var del = e.target.closest("[data-del]");
  if(del && sel && sel.kind === "project"){
    data.project[sel.part].tasks.splice(+del.dataset.del,1);
    persist(); renderAll();
    return;
  }

  if(e.target.id === "taskAdd") addTask();
  if(e.target.closest("#themeBtn")) toggleTheme();
});

function addTask(){
  var input = document.getElementById("taskInput");
  if(!input || !sel || sel.kind !== "project") return;
  var text = input.value.trim();
  if(!text) return;
  data.project[sel.part].tasks.push({text:text, done:false});
  persist(); renderAll();
  var again = document.getElementById("taskInput");
  if(again) again.focus();
}

// notes + score save without a full re-render so the caret stays put
var fieldTimer = null;
document.addEventListener("input", function(e){
  if(!sel || sel.kind !== "item") return;
  if(e.target.id !== "noteBox" && e.target.id !== "scoreBox") return;
  var item = data[sel.domain][sel.subject].items[sel.idx];
  if(e.target.id === "noteBox") item.note = e.target.value; else item.score = e.target.value;
  clearTimeout(fieldTimer);
  fieldTimer = setTimeout(function(){
    persist();
    var c = document.querySelector('.cell[data-domain="'+sel.domain+'"][data-subject="'+sel.subject+'"][data-idx="'+sel.idx+'"]');
    if(c){ c.classList.toggle("has-note", !!item.note); c.classList.toggle("has-score", !!item.score); }
    renderSpotlight();
  }, 400);
});

document.addEventListener("keydown", function(e){
  if(e.key === "Enter" && e.target.id === "taskInput"){ addTask(); return; }
  var el = e.target;
  if(el && (el.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(el.tagName))) return;
  if(window.__placementCapturesKeys && window.__placementCapturesKeys()) return;
  if(e.metaKey || e.ctrlKey || e.altKey) return;
  if(mode !== "semester") return;

  var handled = true;
  switch(e.key){
    case "ArrowLeft":  moveSel(0,-1); break;
    case "ArrowRight": moveSel(0, 1); break;
    case "ArrowUp":    moveSel(-1,0); break;
    case "ArrowDown":  moveSel(1, 0); break;
    case " ":
    case "Enter": if(sel){ cycleRef(sel); renderAll(); } break;
    default: handled = false;
  }
  if(handled) e.preventDefault();
});

/* ============================================================ status filter */
(function(){
  var keys = [].slice.call(document.querySelectorAll(".key")), locked = null;
  function apply(v){ v ? document.body.setAttribute("data-focus", v) : document.body.removeAttribute("data-focus"); }
  keys.forEach(function(k){
    k.addEventListener("mouseenter", function(){ if(!locked) apply(k.dataset.k); });
    k.addEventListener("mouseleave", function(){ if(!locked) apply(null); });
    k.addEventListener("click", function(){
      locked = locked === k.dataset.k ? null : k.dataset.k;
      keys.forEach(function(o){ o.setAttribute("aria-pressed", String(o.dataset.k === locked)); });
      apply(locked);
    });
  });
  addEventListener("keydown", function(e){
    if(e.key === "Escape" && locked){
      locked = null;
      keys.forEach(function(o){ o.setAttribute("aria-pressed","false"); });
      apply(null);
    }
  });
})();

/* ============================================================ mode */
var mode = localStorage.getItem(MODE_KEY) === "placement" ? "placement" : "semester";

function setMode(next){
  mode = next;
  localStorage.setItem(MODE_KEY, mode);
  document.body.dataset.tab = mode;
  document.getElementById("view-semester").classList.toggle("active", mode === "semester");
  document.getElementById("tab-placement").classList.toggle("active", mode === "placement");
  syncDock();
}

/* ============================================================ theme */
function toggleTheme(){
  var root = document.documentElement;
  var cur = root.getAttribute("data-theme") ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  var next = cur === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
}

/* ============================================================ backup */
function activeProfile(){
  return (window.Profiles && window.Profiles.active()) || { id:"default", name:"Tracker" };
}

function buildBackup(){
  var payload = { __constellation:2, profile:activeProfile().id,
                  tracker:data, activity:loadActivity(), extensions:{} };
  var exts = window.__constellationExtensions || {};
  Object.keys(exts).forEach(function(k){
    try{ payload.extensions[k] = exts[k].dump(); }catch(e){ console.warn("Could not export extension "+k, e); }
  });
  return payload;
}

document.getElementById("exportBtn").addEventListener("click", function(){
  var blob = new Blob([JSON.stringify(buildBackup(),null,2)], {type:"application/json"});
  var url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url;
  a.download = "study-tracker-" + activeProfile().id + "-" + todayStr() + ".json";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

document.getElementById("importBtn").addEventListener("click", function(){
  document.getElementById("importFile").click();
});

// Restore a backup payload into the ACTIVE profile. Shared by file import and
// by sync.js pulling from a gist. Throws on an unrecognised shape.
function applyBackup(parsed){
  var incoming;
  if(parsed && parsed.__constellation >= 2){
    if(!parsed.tracker) throw new Error("missing tracker");
    incoming = parsed.tracker;
    if(parsed.activity) localStorage.setItem(ACTIVITY_KEY, JSON.stringify(parsed.activity));
    var exts = window.__constellationExtensions || {};
    Object.keys(exts).forEach(function(k){
      if(parsed.extensions && parsed.extensions[k]){
        try{ exts[k].load(parsed.extensions[k]); }catch(err){ console.warn("Could not import extension "+k, err); }
      }
    });
  }else{
    if(!parsed || !parsed.theory || !parsed.labs) throw new Error("unrecognised shape");
    incoming = parsed;
  }
  SUBJECTS.forEach(function(s){
    incoming.theory[s.key] = reconcile(incoming.theory[s.key] || {items:[]}, THEORY_LABELS);
    incoming.labs[s.key]   = reconcile(incoming.labs[s.key]   || {items:[]}, LAB_LABELS);
  });
  data = incoming; lastOverall = -1; setSel(null);
  persist(); renderAll();
  if(window.__placementRender) window.__placementRender();
}

document.getElementById("importFile").addEventListener("change", function(e){
  var file = e.target.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(){
    try{
      applyBackup(JSON.parse(reader.result));
    }catch(err){
      alert("That file doesn't look like a valid backup.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

document.getElementById("resetBtn").addEventListener("click", function(){
  if(!confirm("Reset EVERYTHING for " + activeProfile().name +
    " — semester progress, notes, scores, and all placement prep? This can't be undone, " +
    "and it only affects this profile. Export a backup first if unsure.")) return;
  data = defaultData();
  var exts = window.__constellationExtensions || {};
  Object.keys(exts).forEach(function(k){
    if(typeof exts[k].reset === "function"){
      try{ exts[k].reset(); }catch(e){ console.warn("Could not reset extension "+k, e); }
    }
  });
  lastOverall = -1; setSel(null); persist(); renderAll();
});

/* ============================================================ toast */
function showToast(msg){
  var el = document.getElementById("magicToast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function(){ el.classList.remove("show"); }, 4500);
}

function checkWelcomeBack(){
  var raw = localStorage.getItem(VISIT_KEY), st = overallStats(), today = todayStr();
  if(raw){
    try{
      var prev = JSON.parse(raw);
      if(prev.date !== today){
        var delta = st.done - prev.lit;
        if(delta > 0) showToast("Welcome back — " + delta + " more item" + (delta===1?"":"s") + " done since your last visit.");
      }
    }catch(e){}
  }
  localStorage.setItem(VISIT_KEY, JSON.stringify({date:today, lit:st.done}));
}

/* ============================================================ title reveal */
(function(){
  var el = document.getElementById("title");
  "Semester VII".split("").forEach(function(c,i){
    var w = document.createElement("span"); w.className = "ch";
    var s = document.createElement("span");
    s.textContent = c === " " ? " " : c;
    s.style.setProperty("--d", i);
    w.appendChild(s); el.appendChild(w);
  });
})();

/* ============================================================ reveal on scroll */
(function(){
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, {threshold:.15, rootMargin:"0px 0px -6% 0px"});
  document.querySelectorAll(".tile").forEach(function(t){ io.observe(t); });
  // safety net: never leave a tile invisible
  setTimeout(function(){ document.querySelectorAll(".tile:not(.in)").forEach(function(t){ t.classList.add("in"); }); }, 2500);
})();

/* ============================================================ specular + tilt */
if(fine && !reduce){
  document.querySelectorAll(".tile").forEach(function(t){
    var tilt = !t.classList.contains("no-tilt");
    t.addEventListener("pointermove", function(e){
      var r = t.getBoundingClientRect();
      var x = (e.clientX - r.left)/r.width, y = (e.clientY - r.top)/r.height;
      t.style.setProperty("--mx", x*100 + "%");
      t.style.setProperty("--my", y*100 + "%");
      if(tilt){
        t.style.transform = "perspective(900px) rotateX(" + ((0.5-y)*3.2).toFixed(2) +
          "deg) rotateY(" + ((x-0.5)*3.2).toFixed(2) + "deg) translateY(-2px)";
      }
    });
    if(tilt) t.addEventListener("pointerleave", function(){ t.style.transform = ""; });
  });
}

/* ============================================================ dock */
var syncDock = (function(){
  var dock = document.getElementById("dock"), ind = document.getElementById("ind");
  var btns = [].slice.call(dock.querySelectorAll("button"));

  function move(b){
    ind.style.width = b.offsetWidth + "px";
    ind.style.transform = "translateX(" + b.offsetLeft + "px)";
  }
  function setActive(i){
    btns.forEach(function(b,j){ b.classList.toggle("on", j === i); });
    move(btns[i]);
  }

  btns.forEach(function(b,i){
    if(!b.dataset.go) return;
    b.addEventListener("click", function(){
      if(mode !== "semester") setMode("semester");
      setActive(i);
      var target = document.getElementById(b.dataset.go);
      if(target) target.scrollIntoView({behavior: reduce ? "auto" : "smooth", block:"start"});
    });
  });

  var cur = 0;
  function onScroll(){
    if(mode !== "semester") return;
    var mid = scrollY + innerHeight*0.42, next = 0;
    btns.forEach(function(b,i){
      if(!b.dataset.go) return;
      var a = document.getElementById(b.dataset.go);
      if(a && a.offsetTop <= mid) next = i;
    });
    if(next !== cur){ cur = next; setActive(next); }
  }
  var ticking = false;
  addEventListener("scroll", function(){
    if(!ticking){ ticking = true; requestAnimationFrame(function(){ onScroll(); ticking = false; }); }
  }, {passive:true});
  addEventListener("resize", function(){ move(btns[cur]); });

  return function(){
    var i = mode === "placement"
      ? btns.findIndex(function(b){ return b.dataset.mode === "placement"; })
      : cur;
    if(i < 0) i = 0;
    setActive(i);
  };
})();

/* ============================================================ extension hook */
window.__constellationTouch = function(){
  markActivity(); flashSaved(); renderHeatmap(); renderSpark();
  notifyChanged();
};

// consumed by sync.js
window.__constellationData = {
  build: buildBackup,
  apply: applyBackup
};

/* ============================================================ init */
setMode(mode);
renderAll();
markActivity();
renderHeatmap();
setTimeout(function(){ syncDock(); }, 80);
setTimeout(checkWelcomeBack, 900);
})();
