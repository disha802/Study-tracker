/* ============================================================
   placement.js — Placement tab: DSA + SQL roadmap, spaced-repetition
   flashcards, reference sheets, and a practice log.

   Depends on placement-data.js, placement-cards.js, placement-sheets.js
   and on these hooks exposed by app.js:
     window.__constellationTouch()   -> mark activity + flash saved + redraw heatmap
     window.__constellationExtensions -> registry for export / import
   ============================================================ */
(function(){
"use strict";

// namespaced per profile (see profiles.js)
var K = (window.Profiles && window.Profiles.key) || function(s){ return "constellation." + s; };
var PL_KEY   = K("placement.v1");
var VIEW_KEY = K("placement.view.v1");

var GRADES = [
  { g:0, label:"Again", hint:"blanked", cls:"again" },
  { g:1, label:"Hard",  hint:"got it, slowly", cls:"hard" },
  { g:2, label:"Good",  hint:"solid", cls:"good" },
  { g:3, label:"Easy",  hint:"instant", cls:"easy" }
];

var MATURE_DAYS = 21;

/* ---------------- day arithmetic (local midnight) ---------------- */
function dayNum(d){
  d = d || new Date();
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
}
function isoToday(){
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

/* ---------------- state ---------------- */
function defaultState(){
  return {
    v: 1,
    solved: {},          // "topicKey:problem-slug" -> 1
    notes:  {},          // topicKey -> string
    cards:  {},          // cardId -> { ivl, ease, due, reps, lapses, last }
    log:    [],          // { id, date, name, topic, diff, mins, unaided, lc }
    goals:  { newPerDay: 8, reviewCap: 80 },
    custom: {},          // topicKey -> [ {name, diff} ] user-added problems
    lc:     {}           // "217" -> { date, name } LeetCode numbers you have solved
  };
}

function loadState(){
  try{
    var raw = localStorage.getItem(PL_KEY);
    if(!raw) return defaultState();
    var p = JSON.parse(raw);
    var d = defaultState();
    if(!p || typeof p !== "object") return d;
    ["solved","notes","cards","custom","lc"].forEach(function(k){
      if(!p[k] || typeof p[k] !== "object") p[k] = d[k];
    });
    if(!Array.isArray(p.log)) p.log = [];
    if(!p.goals) p.goals = d.goals;
    if(typeof p.goals.newPerDay !== "number") p.goals.newPerDay = d.goals.newPerDay;
    if(typeof p.goals.reviewCap !== "number") p.goals.reviewCap = d.goals.reviewCap;
    p.v = 1;
    return p;
  }catch(e){
    console.warn("Placement data unreadable, starting fresh.", e);
    return defaultState();
  }
}

var state = loadState();
var view = localStorage.getItem(VIEW_KEY) || "overview";
var openTopics = {};      // in-memory accordion state
var sheetFilter = "";

function persist(silent){
  localStorage.setItem(PL_KEY, JSON.stringify(state));
  if(!silent && window.__constellationTouch) window.__constellationTouch();
}

/* ---------------- small helpers ---------------- */
function esc(str){
  return String(str == null ? "" : str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}
// escape, then turn `x` into <code>x</code>
function rich(str){
  return esc(str).replace(/`([^`]+)`/g, function(_, m){ return "<code>" + m + "</code>"; });
}
function slug(name){
  return String(name).toLowerCase()
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}
function pKey(topicKey, name){ return topicKey + ":" + slug(name); }
function pct(a, b){ return b === 0 ? 0 : Math.round((a/b)*100); }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function allTopics(){ return DSA_TOPICS.concat(SQL_TOPICS); }
function topicByKey(k){
  var all = allTopics();
  for(var i=0;i<all.length;i++) if(all[i].key === k) return all[i];
  return null;
}
function topicProblems(t){
  var extra = (state.custom[t.key] || []).map(function(c){ return [c.name, c.diff || "M", ""]; });
  return t.problems.concat(extra);
}
function problemUrl(p){
  if(p.length > 2){
    if(p[2] === "") return null;
    return "https://leetcode.com/problems/" + p[2] + "/";
  }
  return "https://leetcode.com/problems/" + slug(p[0]) + "/";
}

function topicStats(t){
  var probs = topicProblems(t);
  var done = 0;
  probs.forEach(function(p){ if(state.solved[pKey(t.key, p[0])]) done++; });
  return { done: done, total: probs.length, pct: pct(done, probs.length) };
}

function sideStats(list){
  var done = 0, total = 0, wDone = 0, wTotal = 0;
  list.forEach(function(t){
    var s = topicStats(t);
    var w = t.tier === 1 ? 3 : t.tier === 2 ? 2 : 1;
    done += s.done; total += s.total;
    wDone += s.done * w; wTotal += s.total * w;
  });
  return { done: done, total: total, pct: pct(done, total), weighted: pct(wDone, wTotal) };
}

/* ---------------- spaced repetition ---------------- */
function cardState(id){
  return state.cards[id] || null;
}
function cardBucket(id){
  var c = cardState(id);
  if(!c || !c.reps) return "new";
  if(c.ivl >= MATURE_DAYS) return "mature";
  return "young";
}
function dueCards(deckKey){
  var today = dayNum();
  return FLASHCARDS.filter(function(card){
    if(deckKey && card.deck !== deckKey) return false;
    var c = cardState(card.id);
    return c && c.reps > 0 && c.due <= today;
  });
}
function newCards(deckKey){
  return FLASHCARDS.filter(function(card){
    if(deckKey && card.deck !== deckKey) return false;
    return !cardState(card.id);
  });
}

function gradeCard(id, g){
  var today = dayNum();
  var c = state.cards[id] || { ivl:0, ease:2.5, due:today, reps:0, lapses:0, last:null };
  if(g === 0){
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.lapses++;
    c.ivl = 0;
    c.due = today;
  }else if(g === 1){
    c.ease = Math.max(1.3, c.ease - 0.15);
    c.ivl = c.ivl <= 0 ? 1 : Math.max(1, Math.round(c.ivl * 1.2));
    c.due = today + c.ivl;
  }else if(g === 2){
    c.ivl = c.ivl <= 0 ? 1 : (c.ivl === 1 ? 3 : Math.round(c.ivl * c.ease));
    c.due = today + c.ivl;
  }else{
    c.ease = Math.min(3.0, c.ease + 0.15);
    c.ivl = c.ivl <= 0 ? 3 : Math.round(c.ivl * c.ease * 1.3);
    c.due = today + c.ivl;
  }
  c.reps++;
  c.last = today;
  state.cards[id] = c;
  persist();
}

function intervalLabel(id, g){
  var c = cardState(id) || { ivl:0, ease:2.5 };
  var ivl;
  if(g === 0) ivl = 0;
  else if(g === 1) ivl = c.ivl <= 0 ? 1 : Math.max(1, Math.round(c.ivl * 1.2));
  else if(g === 2) ivl = c.ivl <= 0 ? 1 : (c.ivl === 1 ? 3 : Math.round(c.ivl * c.ease));
  else ivl = c.ivl <= 0 ? 3 : Math.round(c.ivl * c.ease * 1.3);
  if(ivl === 0) return "now";
  if(ivl === 1) return "1d";
  if(ivl < 30) return ivl + "d";
  return (Math.round(ivl/30 * 10)/10) + "mo";
}

/* ---------------- session ---------------- */
var session = null;   // { queue:[ids], i, flipped, deck, done, again }

function buildQueue(deckKey){
  var due = dueCards(deckKey).map(function(c){ return c.id; });
  var fresh = newCards(deckKey).map(function(c){ return c.id; });
  due = due.slice(0, state.goals.reviewCap);
  fresh = fresh.slice(0, state.goals.newPerDay);
  // interleave so new cards are spread through the review queue
  var out = [];
  var ratio = fresh.length ? Math.max(1, Math.floor(due.length / fresh.length)) : 0;
  var fi = 0;
  for(var i = 0; i < due.length; i++){
    out.push(due[i]);
    if(ratio && (i + 1) % ratio === 0 && fi < fresh.length) out.push(fresh[fi++]);
  }
  while(fi < fresh.length) out.push(fresh[fi++]);
  return out;
}

function startSession(deckKey){
  var q = buildQueue(deckKey);
  if(!q.length){
    session = null;
    render();
    toast(state.goals.newPerDay === 0
      ? "Nothing due, and your new-cards-per-day target is 0. Raise it on the Overview tab."
      : "Nothing due right now — every card is scheduled ahead. Come back tomorrow.");
    return;
  }
  session = { queue:q, i:0, flipped:false, deck:deckKey || null, done:0, again:0, total:q.length };
  render();
}

function endSession(){ session = null; render(); }

function answerCard(g){
  if(!session) return;
  var id = session.queue[session.i];
  gradeCard(id, g);
  session.done++;
  if(g === 0){ session.again++; session.queue.push(id); }
  session.i++;
  session.flipped = false;
  if(session.i >= session.queue.length){
    var summary = { done: session.done, again: session.again, total: session.total };
    session = null;
    render();
    toast("Session complete — " + summary.done + " reviews, " + summary.again + " marked again.");
    return;
  }
  render();
}

function toast(msg){
  var el = document.getElementById("magicToast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ el.classList.remove("show"); }, 4200);
}

/* ---------------- readiness score ---------------- */
function activityDaysLast(n){
  var act = {};
  try{ act = JSON.parse(localStorage.getItem(K("activity.v1"))) || {}; }catch(e){}
  var hit = 0;
  var today = new Date();
  for(var i = 0; i < n; i++){
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var key = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
    if(act[key]) hit++;
  }
  return hit;
}

function recallScore(){
  var mature = 0, young = 0;
  FLASHCARDS.forEach(function(c){
    var b = cardBucket(c.id);
    if(b === "mature") mature++;
    else if(b === "young") young++;
  });
  return {
    mature: mature, young: young,
    newLeft: FLASHCARDS.length - mature - young,
    pct: pct(Math.round(mature + young * 0.45), FLASHCARDS.length)
  };
}

function readiness(){
  var dsa = sideStats(DSA_TOPICS).weighted;
  var sql = sideStats(SQL_TOPICS).weighted;
  var rec = recallScore().pct;
  var con = Math.round((activityDaysLast(14) / 14) * 100);
  var score = Math.round(dsa*0.35 + sql*0.25 + rec*0.25 + con*0.15);
  return { dsa: dsa, sql: sql, recall: rec, consistency: con, score: clamp(score, 0, 100) };
}

function readinessBand(s){
  if(s >= 80) return { label:"Interview-ready", note:"Keep reviews warm and run timed mocks." };
  if(s >= 60) return { label:"Nearly there",   note:"Close the Tier 1 gaps, then add timed practice." };
  if(s >= 35) return { label:"Building",       note:"Stay on Tier 1 breadth. Depth comes later." };
  if(s >= 15) return { label:"Early days",     note:"Consistency beats intensity right now." };
  return { label:"Not started", note:"Pick one Tier 1 topic and complete the first item." };
}

/* ---------------- today's drill ---------------- */
function drillProblems(n){
  var today = dayNum();
  var pool = [];
  [DSA_TOPICS, SQL_TOPICS].forEach(function(list){
    list.forEach(function(t){
      var st = topicStats(t);
      topicProblems(t).forEach(function(p, idx){
        if(state.solved[pKey(t.key, p[0])]) return;
        // prefer tier 1, then topics already in progress, then earlier problems
        var rank = t.tier * 1000 + (st.done > 0 && st.pct < 100 ? 0 : 300) + idx;
        pool.push({ topic:t, p:p, rank:rank });
      });
    });
  });
  if(!pool.length) return [];
  pool.sort(function(a,b){ return a.rank - b.rank; });
  var head = pool.slice(0, Math.min(pool.length, 40));
  var out = [];
  for(var i = 0; i < n && i < head.length; i++){
    out.push(head[(today * 3 + i * 7) % head.length]);
  }
  // de-duplicate in case the modular pick collides
  var seen = {}, uniq = [];
  out.forEach(function(o){
    var k = pKey(o.topic.key, o.p[0]);
    if(!seen[k]){ seen[k] = 1; uniq.push(o); }
  });
  var j = 0;
  while(uniq.length < Math.min(n, head.length) && j < head.length){
    var cand = head[j++];
    var ck = pKey(cand.topic.key, cand.p[0]);
    if(!seen[ck]){ seen[ck] = 1; uniq.push(cand); }
  }
  return uniq;
}

/* ---------------- log stats ---------------- */
function logStats(){
  var byDiff = { E:0, M:0, H:0, C:0 };
  var unaided = 0, mins = 0;
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  var week = 0;
  state.log.forEach(function(e){
    byDiff[e.diff] = (byDiff[e.diff] || 0) + 1;
    if(e.unaided) unaided++;
    mins += (+e.mins || 0);
    if(new Date(e.date) >= cutoff) week++;
  });
  return {
    total: state.log.length, week: week, mins: mins,
    unaidedPct: pct(unaided, state.log.length), byDiff: byDiff
  };
}

/* ============================================================
   RENDERING
   ============================================================ */

var SUBVIEWS = [
  { key:"overview", label:"Overview" },
  { key:"dsa",      label:"DSA" },
  { key:"sql",      label:"SQL" },
  { key:"cards",    label:"Flashcards" },
  { key:"sheets",   label:"Cheatsheets" },
  { key:"log",      label:"Log" }
];

function subnavHtml(){
  var due = dueCards(null).length;
  return '<div class="pl-subnav">' + SUBVIEWS.map(function(v){
    var badge = "";
    if(v.key === "cards" && due > 0) badge = '<span class="pl-badge">' + due + '</span>';
    return '<button class="pl-subbtn' + (view === v.key ? ' active' : '') + '" data-view="' + v.key + '">' +
      esc(v.label) + badge + '</button>';
  }).join("") + '</div>';
}

function meterHtml(label, value, sub){
  return '<div class="pl-meter">' +
    '<div class="pl-meter-top"><span class="pl-meter-label">' + esc(label) + '</span>' +
    '<span class="pl-meter-val">' + value + '%</span></div>' +
    '<div class="pl-meter-track"><div class="pl-meter-fill" style="width:' + value + '%"></div></div>' +
    (sub ? '<div class="pl-meter-sub">' + esc(sub) + '</div>' : '') +
  '</div>';
}

/* ---------- overview ---------- */
function renderOverview(){
  var r = readiness();
  var band = readinessBand(r.score);
  var rec = recallScore();
  var dsaS = sideStats(DSA_TOPICS), sqlS = sideStats(SQL_TOPICS);
  var ls = logStats();
  var due = dueCards(null).length;
  var fresh = newCards(null).length;
  var drill = drillProblems(3);
  var circ = 2 * Math.PI * 46;
  var offset = circ - (r.score/100) * circ;

  var html = '<div class="pl-hero">' +
    '<div class="pl-hero-ring">' +
      '<svg viewBox="0 0 110 110"><circle class="plr-track" cx="55" cy="55" r="46"></circle>' +
      '<circle class="plr-fill" cx="55" cy="55" r="46" style="stroke-dasharray:' + circ.toFixed(1) +
      ';stroke-dashoffset:' + offset.toFixed(1) + '"></circle></svg>' +
      '<div class="pl-hero-ring-center"><b>' + r.score + '</b><span>readiness</span></div>' +
    '</div>' +
    '<div class="pl-hero-text">' +
      '<span class="pl-hero-band">' + esc(band.label) + '</span>' +
      '<p class="pl-hero-note">' + esc(band.note) + '</p>' +
      '<div class="pl-hero-chips">' +
        '<span class="pl-chip"><b>' + dsaS.done + '</b>/' + dsaS.total + ' DSA</span>' +
        '<span class="pl-chip"><b>' + sqlS.done + '</b>/' + sqlS.total + ' SQL</span>' +
        '<span class="pl-chip"><b>' + rec.mature + '</b> cards mature</span>' +
        '<span class="pl-chip"><b>' + ls.total + '</b> logged</span>' +
      '</div>' +
    '</div>' +
  '</div>';

  html += '<div class="pl-meters">' +
    meterHtml("DSA coverage", r.dsa, "tier-weighted · " + dsaS.pct + "% raw") +
    meterHtml("SQL coverage", r.sql, "tier-weighted · " + sqlS.pct + "% raw") +
    meterHtml("Recall strength", r.recall, rec.mature + " mature · " + rec.young + " young · " + rec.newLeft + " unseen") +
    meterHtml("Consistency", r.consistency, activityDaysLast(14) + " active days in the last 14") +
  '</div>';

  html += '<div class="pl-drill">' +
    '<div class="pl-drill-head"><span class="pl-eyebrow">TODAY</span>' +
      '<span class="pl-drill-sub">' + isoToday() + '</span></div>' +
    '<div class="pl-drill-grid">';

  html += '<div class="pl-drill-card">' +
    '<div class="pl-drill-num">' + (due + Math.min(fresh, state.goals.newPerDay)) + '</div>' +
    '<div class="pl-drill-label">cards queued</div>' +
    '<div class="pl-drill-meta">' + due + ' due · ' + Math.min(fresh, state.goals.newPerDay) + ' new</div>' +
    '<button class="pl-btn primary" data-act="go-cards">Start review</button>' +
  '</div>';

  html += '<div class="pl-drill-card wide"><div class="pl-drill-label">suggested problems</div><ul class="pl-drill-list">';
  if(!drill.length){
    html += '<li class="pl-drill-empty">Every problem in the bank is checked off. Add your own in the DSA or SQL tab.</li>';
  }else{
    drill.forEach(function(d){
      var url = problemUrl(d.p);
      var title = url ? '<a href="' + url + '" target="_blank" rel="noopener">' + esc(d.p[0]) + '</a>'
                      : '<span>' + esc(d.p[0]) + '</span>';
      html += '<li><span class="pl-diff d' + d.p[1] + '">' + d.p[1] + '</span>' + title +
        '<span class="pl-drill-topic">' + esc(d.topic.name) + '</span></li>';
    });
  }
  html += '</ul></div>';
  html += '</div></div>';

  // weakest tier-1 topics
  var weak = DSA_TOPICS.concat(SQL_TOPICS)
    .filter(function(t){ return t.tier === 1; })
    .map(function(t){ return { t:t, s:topicStats(t) }; })
    .sort(function(a,b){ return a.s.pct - b.s.pct; })
    .slice(0, 6);

  html += '<div class="pl-panel"><h3 class="pl-panel-title">Weakest Tier 1 topics</h3>' +
    '<p class="pl-panel-note">Tier 1 is non-negotiable for a placement season. Close these before touching Tier 3.</p>' +
    '<div class="pl-weak">';
  weak.forEach(function(w){
    html += '<button class="pl-weak-row" data-goto-topic="' + w.t.key + '">' +
      '<span class="pl-weak-name">' + esc(w.t.name) + '</span>' +
      '<span class="pl-weak-bar"><i style="width:' + w.s.pct + '%"></i></span>' +
      '<span class="pl-weak-num">' + w.s.done + '/' + w.s.total + '</span></button>';
  });
  html += '</div></div>';

  html += '<div class="pl-panel"><h3 class="pl-panel-title">Daily targets</h3>' +
    '<div class="pl-goals">' +
      '<label>New cards per day<input type="number" min="0" max="60" value="' + state.goals.newPerDay + '" data-goal="newPerDay"></label>' +
      '<label>Review cap<input type="number" min="10" max="400" value="' + state.goals.reviewCap + '" data-goal="reviewCap"></label>' +
    '</div>' +
    '<p class="pl-panel-note">Eight new cards a day clears the whole bank of ' + FLASHCARDS.length +
      ' in about ' + Math.ceil(FLASHCARDS.length / Math.max(1, state.goals.newPerDay)) + ' days.</p>' +
  '</div>';

  return html;
}

/* ---------- roadmap ---------- */
function tierLabel(t){ return t === 1 ? "TIER 1 · CORE" : t === 2 ? "TIER 2 · DEPTH" : "TIER 3 · EDGE"; }

function renderRoadmap(side){
  var list = side === "dsa" ? DSA_TOPICS : SQL_TOPICS;
  var s = sideStats(list);
  var intro = side === "dsa"
    ? "// twenty-four patterns, ordered by how often they decide an interview"
    : "// eighteen areas spanning query craft and the DBMS viva";

  var html = '<p class="domain-intro">' + intro + '</p>';
  html += '<div class="pl-side-head">' +
    '<div class="pl-side-stat"><b>' + s.done + '</b> / ' + s.total + ' problems</div>' +
    '<div class="pl-side-bar"><i style="width:' + s.pct + '%"></i></div>' +
    '<div class="pl-side-pct">' + s.pct + '%</div>' +
  '</div>';

  [1,2,3].forEach(function(tier){
    var group = list.filter(function(t){ return t.tier === tier; });
    if(!group.length) return;
    html += '<div class="pl-tier-label">' + tierLabel(tier) + '</div>';
    group.forEach(function(t){ html += renderTopic(t); });
  });
  return html;
}

function renderTopic(t){
  var st = topicStats(t);
  var open = !!openTopics[t.key];
  var probs = topicProblems(t);
  var customCount = (state.custom[t.key] || []).length;

  var html = '<div class="pl-topic' + (open ? ' open' : '') + (st.pct === 100 ? ' done' : '') +
    '" data-topic="' + t.key + '" id="topic-' + t.key + '">';

  html += '<button class="pl-topic-head" data-toggle="' + t.key + '">' +
    '<span class="pl-topic-caret"></span>' +
    '<span class="pl-topic-name">' + esc(t.name) + '</span>' +
    '<span class="pl-topic-bar"><i style="width:' + st.pct + '%"></i></span>' +
    '<span class="pl-topic-count">' + st.done + '/' + st.total + '</span>' +
  '</button>';

  html += '<div class="pl-topic-body">';
  html += '<p class="pl-why">' + rich(t.why) + '</p>';

  html += '<div class="pl-cols">';
  html += '<div class="pl-col"><h4>Recognise it by</h4><ul class="pl-signals">' +
    t.signals.map(function(x){ return "<li>" + rich(x) + "</li>"; }).join("") + '</ul></div>';
  html += '<div class="pl-col"><h4>Where it goes wrong</h4><ul class="pl-pitfalls">' +
    t.pitfalls.map(function(x){ return "<li>" + rich(x) + "</li>"; }).join("") + '</ul></div>';
  html += '</div>';

  html += '<h4 class="pl-problems-title">Problem set' +
    (customCount ? ' <span class="pl-custom-note">(' + customCount + ' added by you)</span>' : '') + '</h4>';
  html += '<ul class="pl-problems">';
  probs.forEach(function(p, i){
    var k = pKey(t.key, p[0]);
    var isDone = !!state.solved[k];
    var url = problemUrl(p);
    var isCustom = i >= t.problems.length;
    html += '<li class="pl-problem' + (isDone ? ' solved' : '') + '">' +
      '<span class="pl-check' + (isDone ? ' checked' : '') + '" data-solve="' + esc(k) + '"></span>' +
      '<span class="pl-diff d' + p[1] + '" title="' + (p[1]==="C"?"concept drill":p[1]==="E"?"easy":p[1]==="M"?"medium":"hard") + '">' + p[1] + '</span>' +
      (url ? '<a class="pl-problem-name" href="' + url + '" target="_blank" rel="noopener">' + esc(p[0]) + '</a>'
           : '<span class="pl-problem-name">' + esc(p[0]) + '</span>') +
      (isCustom ? '<button class="pl-problem-del" data-del-custom="' + t.key + '|' + (i - t.problems.length) + '">&times;</button>' : '') +
    '</li>';
  });
  html += '</ul>';

  html += '<div class="pl-add-row">' +
    '<input type="text" class="pl-add-input" data-add-topic="' + t.key + '" placeholder="Add your own problem…">' +
    '<select class="pl-add-diff" data-add-diff="' + t.key + '">' +
      '<option value="E">Easy</option><option value="M" selected>Medium</option>' +
      '<option value="H">Hard</option><option value="C">Concept</option>' +
    '</select>' +
    '<button class="pl-btn small" data-add-btn="' + t.key + '">Add</button>' +
  '</div>';

  html += '<textarea class="pl-note" data-note="' + t.key + '" placeholder="Notes on this topic — a recurrence you keep forgetting, a link, a mistake to stop making…">' +
    esc(state.notes[t.key] || "") + '</textarea>';

  html += '</div></div>';
  return html;
}

/* ---------- flashcards ---------- */
function renderCards(){
  if(session) return renderSession();

  var html = '<p class="domain-intro">// ' + FLASHCARDS.length +
    ' cards on a spaced-repetition schedule — answer honestly, the interval depends on it</p>';

  var totalDue = dueCards(null).length;
  var totalNew = newCards(null).length;
  var rec = recallScore();

  html += '<div class="fc-summary">' +
    '<div class="fc-sum-item"><b>' + totalDue + '</b><span>due now</span></div>' +
    '<div class="fc-sum-item"><b>' + totalNew + '</b><span>never seen</span></div>' +
    '<div class="fc-sum-item"><b>' + rec.young + '</b><span>young</span></div>' +
    '<div class="fc-sum-item"><b>' + rec.mature + '</b><span>mature</span></div>' +
    '<button class="pl-btn primary lg" data-start="">Study all decks</button>' +
  '</div>';

  html += '<div class="fc-decks">';
  CARD_DECKS.forEach(function(d){
    var total = FLASHCARDS.filter(function(c){ return c.deck === d.key; }).length;
    var due = dueCards(d.key).length;
    var fresh = newCards(d.key).length;
    var mature = FLASHCARDS.filter(function(c){ return c.deck === d.key && cardBucket(c.id) === "mature"; }).length;
    var p = pct(mature, total);
    html += '<div class="fc-deck' + (due ? ' has-due' : '') + '">' +
      '<div class="fc-deck-side">' + (d.side === "dsa" ? "DSA" : "SQL") + '</div>' +
      '<h4>' + esc(d.name) + '</h4>' +
      '<p>' + esc(d.blurb) + '</p>' +
      '<div class="fc-deck-bar"><i style="width:' + p + '%"></i></div>' +
      '<div class="fc-deck-meta">' +
        '<span>' + mature + '/' + total + ' mature</span>' +
        (due ? '<span class="fc-due">' + due + ' due</span>' : '') +
        (fresh ? '<span class="fc-new">' + fresh + ' new</span>' : '') +
      '</div>' +
      '<button class="pl-btn small" data-start="' + d.key + '"' +
        ((due || fresh) ? '' : ' disabled') + '>' +
        ((due || fresh) ? "Study" : "All scheduled") + '</button>' +
    '</div>';
  });
  html += '</div>';

  // upcoming schedule
  var today = dayNum();
  var buckets = [0,0,0,0,0,0,0];
  FLASHCARDS.forEach(function(c){
    var cs = cardState(c.id);
    if(!cs || !cs.reps) return;
    var delta = cs.due - today;
    if(delta < 0) delta = 0;
    if(delta < 7) buckets[delta]++;
  });
  var maxB = Math.max.apply(null, buckets.concat([1]));
  html += '<div class="pl-panel"><h3 class="pl-panel-title">Next seven days</h3><div class="fc-forecast">';
  buckets.forEach(function(n, i){
    html += '<div class="fc-fore-col"><span class="fc-fore-num">' + n + '</span>' +
      '<div class="fc-fore-bar" style="height:' + Math.max(3, Math.round((n/maxB)*70)) + 'px"></div>' +
      '<span class="fc-fore-day">' + (i === 0 ? "today" : "+" + i) + '</span></div>';
  });
  html += '</div></div>';

  return html;
}

function renderSession(){
  var id = session.queue[session.i];
  var card = null;
  for(var i=0;i<FLASHCARDS.length;i++){ if(FLASHCARDS[i].id === id){ card = FLASHCARDS[i]; break; } }
  if(!card){ session = null; return renderCards(); }

  var deck = CARD_DECKS.filter(function(d){ return d.key === card.deck; })[0];
  var cs = cardState(card.id);
  var bucket = cardBucket(card.id);
  var left = session.queue.length - session.i;
  var progress = pct(session.i, session.queue.length);

  var html = '<div class="fc-stage">';
  html += '<div class="fc-topbar">' +
    '<span class="fc-deckname">' + esc(deck ? deck.name : card.deck) + '</span>' +
    '<div class="fc-progress"><i style="width:' + progress + '%"></i></div>' +
    '<span class="fc-left">' + left + ' left</span>' +
    '<button class="fc-end" data-end="1">End</button>' +
  '</div>';

  html += '<div class="fc-card' + (session.flipped ? ' flipped' : '') + '" data-flip="1">' +
    '<span class="fc-tag fc-tag-' + bucket + '">' + bucket +
      (cs && cs.reps ? " · seen " + cs.reps + "x" : "") + '</span>' +
    '<div class="fc-q">' + rich(card.q) + '</div>' +
    (session.flipped
      ? '<div class="fc-a">' + rich(card.a) + '</div>'
      : '<div class="fc-hint">click, or press Space, to reveal</div>') +
  '</div>';

  if(session.flipped){
    html += '<div class="fc-grades">';
    GRADES.forEach(function(g){
      html += '<button class="fc-grade ' + g.cls + '" data-grade="' + g.g + '">' +
        '<b>' + g.label + '</b><span>' + g.hint + '</span>' +
        '<i>' + intervalLabel(card.id, g.g) + '</i>' +
        '<kbd>' + (g.g + 1) + '</kbd></button>';
    });
    html += '</div>';
  }else{
    html += '<div class="fc-grades"><button class="pl-btn primary lg" data-flip="1">Show answer</button></div>';
  }

  html += '<div class="fc-footnote">Answer before you flip. Grading yourself generously is the fastest way to make this useless.</div>';
  html += '</div>';
  return html;
}

/* ---------- sheets ---------- */
function renderSheets(){
  var html = '<p class="domain-intro">// reference material — skim before a round, or read one block a day</p>';
  html += '<div class="sh-filter"><input type="text" id="shFilter" placeholder="Filter sheets and blocks…" value="' + esc(sheetFilter) + '"></div>';

  var f = sheetFilter.trim().toLowerCase();
  var any = false;

  SHEETS.forEach(function(sheet){
    var blocks = sheet.blocks;
    if(f){
      var sheetMatch = (sheet.name + " " + sheet.tagline).toLowerCase().indexOf(f) !== -1;
      if(!sheetMatch){
        blocks = blocks.filter(function(b){ return blockText(b).toLowerCase().indexOf(f) !== -1; });
        if(!blocks.length) return;
      }
    }
    any = true;
    html += '<div class="sh-sheet">' +
      '<div class="sh-head"><span class="sh-side">' + (sheet.side === "dsa" ? "DSA" : "SQL") + '</span>' +
      '<h3>' + esc(sheet.name) + '</h3><p>' + esc(sheet.tagline) + '</p></div>';
    blocks.forEach(function(b){ html += renderBlock(b); });
    html += '</div>';
  });

  if(!any) html += '<p class="pl-empty">Nothing matches that filter.</p>';
  return html;
}

function blockText(b){
  if(b.t === "p" || b.t === "h") return b.text || "";
  if(b.t === "list") return (b.items || []).join(" ");
  if(b.t === "table") return (b.head || []).join(" ") + " " + (b.rows || []).map(function(r){ return r.join(" "); }).join(" ");
  if(b.t === "code") return (b.title || "") + " " + (b.lines || []).join(" ");
  return "";
}

function renderBlock(b){
  if(b.t === "h") return '<h4 class="sh-h">' + esc(b.text) + '</h4>';
  if(b.t === "p") return '<p class="sh-p">' + rich(b.text) + '</p>';
  if(b.t === "list") return '<ul class="sh-list">' + b.items.map(function(x){ return "<li>" + rich(x) + "</li>"; }).join("") + '</ul>';
  if(b.t === "table"){
    return '<div class="sh-table-wrap"><table class="sh-table"><thead><tr>' +
      b.head.map(function(h){ return "<th>" + esc(h) + "</th>"; }).join("") +
      '</tr></thead><tbody>' +
      b.rows.map(function(r){
        return "<tr>" + r.map(function(c){ return "<td>" + rich(c) + "</td>"; }).join("") + "</tr>";
      }).join("") + '</tbody></table></div>';
  }
  if(b.t === "code"){
    return '<div class="sh-code">' +
      '<div class="sh-code-head"><span>' + esc(b.title || "") + '</span>' +
        '<button class="sh-copy" data-copy="1">copy</button></div>' +
      '<pre><code>' + esc(b.lines.join("\n")) + '</code></pre></div>';
  }
  return "";
}

/* ---------- log ---------- */
/* ---------- LeetCode numbers ---------- */
// Kept as a plain map so it survives however you choose to record things:
// jot a bare number here, or fill the full log form below.
function lcNumbers(){
  return Object.keys(state.lc).map(Number)
    .filter(function(n){ return !isNaN(n); })
    .sort(function(a,b){ return a - b; });
}

function lcAdd(raw, name){
  var found = String(raw).match(/\d{1,4}/g) || [];
  var added = [], dupes = [];
  found.forEach(function(tok){
    var n = String(parseInt(tok, 10));
    if(n === "0" || n === "NaN") return;
    if(state.lc[n]){ dupes.push(n); return; }
    state.lc[n] = { date: isoToday(), name: name || "" };
    added.push(n);
  });
  if(added.length) persist();
  return { added: added, dupes: dupes };
}

function lcUrl(n){
  var entry = state.lc[n] || {};
  // link straight to the problem when we know its name, otherwise search by number
  if(entry.name){
    var s = slug(entry.name);
    if(s) return "https://leetcode.com/problems/" + s + "/";
  }
  return "https://leetcode.com/problemset/?search=" + n;
}

function renderLcSection(){
  var nums = lcNumbers();
  var week = 0;
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  nums.forEach(function(n){
    var d = state.lc[String(n)];
    if(d && d.date && new Date(d.date) >= cutoff) week++;
  });

  var html = '<div class="pl-panel lc-panel">' +
    '<h3 class="pl-panel-title">LeetCode solved' +
      '<span class="lc-count">' + nums.length + ' problem' + (nums.length === 1 ? '' : 's') +
      (week ? ' · ' + week + ' this week' : '') + '</span></h3>' +
    '<p class="pl-panel-note">Type a number and hit Enter. Several at once is fine — ' +
      '<code>1, 217 20</code> records all three.</p>' +
    '<div class="lc-add">' +
      '<input type="text" id="lcInput" class="lc-input" placeholder="e.g. 217" inputmode="numeric" autocomplete="off">' +
      '<button class="pl-btn primary" data-lc-add="1">Add</button>' +
    '</div>';

  if(!nums.length){
    html += '<p class="lc-empty">No numbers yet.</p>';
  }else{
    html += '<div class="lc-chips">';
    nums.forEach(function(n){
      var entry = state.lc[String(n)] || {};
      var title = "logged " + (entry.date || "—") + (entry.name ? " · " + entry.name : "");
      html += '<span class="lc-chip" title="' + esc(title) + '">' +
        '<a href="' + lcUrl(String(n)) + '" target="_blank" rel="noopener">' + n + '</a>' +
        '<button class="lc-chip-del" data-lc-del="' + n + '" aria-label="Remove ' + n + '">&times;</button>' +
      '</span>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function renderLog(){
  var ls = logStats();
  var html = '<p class="domain-intro">// log what you actually solved — unaided attempts are the only ones that count as evidence</p>';

  html += '<div class="lg-stats">' +
    '<div class="lg-stat"><b>' + ls.total + '</b><span>total solved</span></div>' +
    '<div class="lg-stat"><b>' + ls.week + '</b><span>last 7 days</span></div>' +
    '<div class="lg-stat"><b>' + ls.unaidedPct + '%</b><span>unaided</span></div>' +
    '<div class="lg-stat"><b>' + Math.round(ls.mins/60) + 'h</b><span>time logged</span></div>' +
    '<div class="lg-stat split">' +
      '<span class="lg-d dE">' + ls.byDiff.E + ' E</span>' +
      '<span class="lg-d dM">' + ls.byDiff.M + ' M</span>' +
      '<span class="lg-d dH">' + ls.byDiff.H + ' H</span>' +
    '</div>' +
  '</div>';

  html += renderLcSection();

  html += '<div class="pl-panel"><h3 class="pl-panel-title">Log an attempt</h3>' +
    '<div class="lg-form">' +
      '<input type="number" id="lgNum" class="lg-num" placeholder="LC #" min="1" max="9999">' +
      '<input type="text" id="lgName" placeholder="Problem name" list="lgProblems">' +
      '<datalist id="lgProblems">' + problemDatalist() + '</datalist>' +
      '<select id="lgTopic">' + topicOptions() + '</select>' +
      '<select id="lgDiff"><option value="E">Easy</option><option value="M" selected>Medium</option><option value="H">Hard</option><option value="C">Concept</option></select>' +
      '<input type="number" id="lgMins" placeholder="mins" min="0" max="600">' +
      '<label class="lg-unaided"><input type="checkbox" id="lgUnaided" checked> unaided</label>' +
      '<button class="pl-btn primary" data-log-add="1">Log it</button>' +
    '</div>' +
    '<p class="pl-panel-note">Logging a problem whose name matches the bank also ticks it off in the roadmap. ' +
      'A LeetCode number entered here is added to the section above too.</p>' +
  '</div>';

  if(!state.log.length){
    html += '<p class="pl-empty">Nothing logged yet. The first entry is the hardest.</p>';
    return html;
  }

  html += '<div class="lg-table-wrap"><table class="lg-table"><thead><tr>' +
    '<th>Date</th><th>LC #</th><th>Problem</th><th>Topic</th><th>Diff</th><th>Mins</th><th>Unaided</th><th></th>' +
    '</tr></thead><tbody>';
  state.log.slice().reverse().forEach(function(e){
    var t = topicByKey(e.topic);
    html += '<tr>' +
      '<td class="lg-date">' + esc(e.date) + '</td>' +
      '<td class="lg-num-cell">' + (e.lc ? esc(e.lc) : "—") + '</td>' +
      '<td>' + esc(e.name) + '</td>' +
      '<td class="lg-topic">' + esc(t ? t.name : "—") + '</td>' +
      '<td><span class="pl-diff d' + e.diff + '">' + e.diff + '</span></td>' +
      '<td>' + (e.mins ? e.mins : "—") + '</td>' +
      '<td>' + (e.unaided ? '<span class="lg-yes">yes</span>' : '<span class="lg-no">no</span>') + '</td>' +
      '<td><button class="lg-del" data-log-del="' + e.id + '">&times;</button></td>' +
    '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function problemDatalist(){
  var out = [];
  allTopics().forEach(function(t){
    t.problems.forEach(function(p){ out.push('<option value="' + esc(p[0]) + '">'); });
  });
  return out.join("");
}
function topicOptions(){
  var html = '<option value="">— topic —</option>';
  html += '<optgroup label="DSA">' + DSA_TOPICS.map(function(t){
    return '<option value="' + t.key + '">' + esc(t.name) + '</option>';
  }).join("") + '</optgroup>';
  html += '<optgroup label="SQL">' + SQL_TOPICS.map(function(t){
    return '<option value="' + t.key + '">' + esc(t.name) + '</option>';
  }).join("") + '</optgroup>';
  return html;
}

/* ---------- dispatcher ---------- */
function render(){
  var el = document.getElementById("tab-placement");
  if(!el) return;
  var body = "";
  if(view === "overview")     body = renderOverview();
  else if(view === "dsa")     body = renderRoadmap("dsa");
  else if(view === "sql")     body = renderRoadmap("sql");
  else if(view === "cards")   body = renderCards();
  else if(view === "sheets")  body = renderSheets();
  else if(view === "log")     body = renderLog();
  el.innerHTML = subnavHtml() + '<div class="pl-body">' + body + '</div>';
}

function setView(v){
  view = v;
  localStorage.setItem(VIEW_KEY, v);
  render();
  var main = document.querySelector("main");
  if(main) main.scrollIntoView({ behavior:"smooth", block:"start" });
}

/* ============================================================
   EVENTS  (delegated, scoped to the placement panel)
   ============================================================ */
document.addEventListener("click", function(e){
  var root = document.getElementById("tab-placement");
  if(!root) return;

  // "go to topic" from the overview can arrive from inside the panel only
  if(!root.contains(e.target)) return;

  var sub = e.target.closest(".pl-subbtn");
  if(sub){ setView(sub.dataset.view); return; }

  var goCards = e.target.closest('[data-act="go-cards"]');
  if(goCards){ setView("cards"); return; }

  var gotoTopic = e.target.closest("[data-goto-topic]");
  if(gotoTopic){
    var tk = gotoTopic.dataset.gotoTopic;
    var t = topicByKey(tk);
    openTopics[tk] = true;
    setView(t && SQL_TOPICS.indexOf(t) !== -1 ? "sql" : "dsa");
    requestAnimationFrame(function(){
      var node = document.getElementById("topic-" + tk);
      if(node) node.scrollIntoView({ behavior:"smooth", block:"center" });
    });
    return;
  }

  var toggle = e.target.closest("[data-toggle]");
  if(toggle){
    var key = toggle.dataset.toggle;
    openTopics[key] = !openTopics[key];
    toggle.closest(".pl-topic").classList.toggle("open", openTopics[key]);
    return;
  }

  var check = e.target.closest("[data-solve]");
  if(check){
    var sk = check.dataset.solve;
    if(state.solved[sk]) delete state.solved[sk];
    else state.solved[sk] = 1;
    persist();
    refreshTopicRow(check);
    return;
  }

  var addBtn = e.target.closest("[data-add-btn]");
  if(addBtn){ addCustom(addBtn.dataset.addBtn); return; }

  var delCustom = e.target.closest("[data-del-custom]");
  if(delCustom){
    var parts = delCustom.dataset.delCustom.split("|");
    var arr = state.custom[parts[0]] || [];
    var removed = arr.splice(+parts[1], 1)[0];
    if(removed) delete state.solved[pKey(parts[0], removed.name)];
    persist();
    render();
    return;
  }

  var start = e.target.closest("[data-start]");
  if(start){ startSession(start.dataset.start || null); return; }

  var endBtn = e.target.closest("[data-end]");
  if(endBtn){ endSession(); return; }

  var grade = e.target.closest("[data-grade]");
  if(grade){ answerCard(+grade.dataset.grade); return; }

  var flip = e.target.closest("[data-flip]");
  if(flip && session && !session.flipped){ session.flipped = true; render(); return; }

  var copy = e.target.closest("[data-copy]");
  if(copy){
    var code = copy.closest(".sh-code").querySelector("code").textContent;
    if(navigator.clipboard){
      navigator.clipboard.writeText(code).then(function(){
        copy.textContent = "copied";
        setTimeout(function(){ copy.textContent = "copy"; }, 1400);
      });
    }
    return;
  }

  var lcAddBtn = e.target.closest("[data-lc-add]");
  if(lcAddBtn){ submitLcInput(); return; }

  var lcDel = e.target.closest("[data-lc-del]");
  if(lcDel){
    delete state.lc[lcDel.dataset.lcDel];
    persist();
    render();
    return;
  }

  var logAdd = e.target.closest("[data-log-add]");
  if(logAdd){ addLogEntry(); return; }

  var logDel = e.target.closest("[data-log-del]");
  if(logDel){
    var id = logDel.dataset.logDel;
    state.log = state.log.filter(function(x){ return String(x.id) !== String(id); });
    persist();
    render();
    return;
  }
});

function refreshTopicRow(checkEl){
  var li = checkEl.closest(".pl-problem");
  var isDone = !!state.solved[checkEl.dataset.solve];
  checkEl.classList.toggle("checked", isDone);
  if(li) li.classList.toggle("solved", isDone);
  var topicEl = checkEl.closest(".pl-topic");
  if(!topicEl) return;
  var t = topicByKey(topicEl.dataset.topic);
  if(!t) return;
  var st = topicStats(t);
  topicEl.classList.toggle("done", st.pct === 100);
  var bar = topicEl.querySelector(".pl-topic-bar i");
  var count = topicEl.querySelector(".pl-topic-count");
  if(bar) bar.style.width = st.pct + "%";
  if(count) count.textContent = st.done + "/" + st.total;
  // keep the side-wide header honest without a full re-render
  var side = SQL_TOPICS.indexOf(t) !== -1 ? SQL_TOPICS : DSA_TOPICS;
  var ss = sideStats(side);
  var head = document.querySelector(".pl-side-head");
  if(head){
    head.querySelector(".pl-side-stat").innerHTML = "<b>" + ss.done + "</b> / " + ss.total + " problems";
    head.querySelector(".pl-side-bar i").style.width = ss.pct + "%";
    head.querySelector(".pl-side-pct").textContent = ss.pct + "%";
  }
}

function addCustom(topicKey){
  var input = document.querySelector('[data-add-topic="' + topicKey + '"]');
  var sel = document.querySelector('[data-add-diff="' + topicKey + '"]');
  if(!input) return;
  var name = input.value.trim();
  if(!name) return;
  if(!state.custom[topicKey]) state.custom[topicKey] = [];
  state.custom[topicKey].push({ name: name, diff: sel ? sel.value : "M" });
  persist();
  openTopics[topicKey] = true;
  render();
  requestAnimationFrame(function(){
    var again = document.querySelector('[data-add-topic="' + topicKey + '"]');
    if(again) again.focus();
  });
}

function submitLcInput(){
  var el = document.getElementById("lcInput");
  if(!el) return;
  var raw = el.value.trim();
  if(!raw) return;
  var res = lcAdd(raw);
  render();
  if(res.added.length){
    toast("Added " + res.added.join(", ") +
      (res.dupes.length ? " — " + res.dupes.join(", ") + " already recorded." : "."));
  }else if(res.dupes.length){
    toast(res.dupes.join(", ") + " already recorded.");
  }else{
    toast("No number found in that.");
  }
  requestAnimationFrame(function(){
    var again = document.getElementById("lcInput");
    if(again){ again.value = ""; again.focus(); }
  });
}

function addLogEntry(){
  var name = (document.getElementById("lgName").value || "").trim();
  var numEl = document.getElementById("lgNum");
  var num = numEl ? (numEl.value || "").trim() : "";
  // a bare number with no name still counts — record it and stop
  if(!name){
    if(num){ submitLcNumberOnly(num); }
    return;
  }
  var topic = document.getElementById("lgTopic").value;
  var diff = document.getElementById("lgDiff").value;
  var mins = +document.getElementById("lgMins").value || 0;
  var unaided = document.getElementById("lgUnaided").checked;

  state.log.push({
    id: String(dayNum()) + "-" + Math.round(performance.now() * 1000),
    date: isoToday(), name: name, topic: topic, diff: diff,
    mins: mins, unaided: unaided, lc: num
  });

  if(num) lcAdd(num, name);

  // tick it off in the roadmap when the name matches something in the bank
  var matched = 0;
  allTopics().forEach(function(t){
    topicProblems(t).forEach(function(p){
      if(slug(p[0]) === slug(name)){ state.solved[pKey(t.key, p[0])] = 1; matched++; }
    });
  });

  persist();
  render();
  toast(matched ? "Logged — also ticked off in the roadmap." : "Logged.");
  requestAnimationFrame(function(){
    var el = document.getElementById("lgName");
    if(el) el.focus();
  });
}

function submitLcNumberOnly(num){
  var res = lcAdd(num);
  render();
  if(res.added.length) toast("Recorded " + res.added.join(", ") + ".");
  else if(res.dupes.length) toast(res.dupes.join(", ") + " already recorded.");
  else toast("No number found in that.");
  requestAnimationFrame(function(){
    var el = document.getElementById("lgNum");
    if(el){ el.value = ""; el.focus(); }
  });
}

/* ---------- inputs: notes, goals, filter ---------- */
var noteTimer = null;
document.addEventListener("input", function(e){
  var root = document.getElementById("tab-placement");
  if(!root || !root.contains(e.target)) return;

  if(e.target.matches("[data-note]")){
    var key = e.target.dataset.note;
    var val = e.target.value;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function(){
      state.notes[key] = val;
      persist();
    }, 500);
    return;
  }

  if(e.target.matches("[data-goal]")){
    var g = e.target.dataset.goal;
    var n = parseInt(e.target.value, 10);
    if(isNaN(n)) return;
    state.goals[g] = clamp(n, 0, g === "newPerDay" ? 60 : 400);
    persist(true);
    return;
  }

  if(e.target.id === "shFilter"){
    sheetFilter = e.target.value;
    var pos = e.target.selectionStart;
    render();
    var again = document.getElementById("shFilter");
    if(again){ again.focus(); again.setSelectionRange(pos, pos); }
    return;
  }
});

document.addEventListener("keydown", function(e){
  if(e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
  var panel = document.getElementById("tab-placement");
  if(!panel || !panel.classList.contains("active")) return;

  if(e.key === "Enter" && e.target.classList && e.target.classList.contains("pl-add-input")) return;

  if(session){
    if(e.key === " " || e.key === "Enter"){
      e.preventDefault();
      if(!session.flipped){ session.flipped = true; render(); }
      return;
    }
    if(session.flipped && e.key >= "1" && e.key <= "4"){
      e.preventDefault();
      answerCard(+e.key - 1);
      return;
    }
    if(e.key === "Escape"){ endSession(); return; }
  }
}, true);

// Enter inside the "add problem" box
document.addEventListener("keydown", function(e){
  if(e.key !== "Enter") return;
  if(e.target.matches && e.target.matches(".pl-add-input")){
    addCustom(e.target.dataset.addTopic);
  }
  if(e.target.matches && e.target.matches("#lgName, #lgMins, #lgNum")){
    addLogEntry();
  }
  if(e.target.matches && e.target.matches("#lcInput")){
    submitLcInput();
  }
});

/* ---------- export / import registration ---------- */
window.__constellationExtensions = window.__constellationExtensions || {};
window.__constellationExtensions.placement = {
  dump: function(){ return state; },
  load: function(obj){
    if(!obj) return;
    var incoming = obj;
    state = defaultState();
    ["solved","notes","cards","custom","lc"].forEach(function(k){
      if(incoming[k] && typeof incoming[k] === "object") state[k] = incoming[k];
    });
    if(Array.isArray(incoming.log)) state.log = incoming.log;
    if(incoming.goals) state.goals = { newPerDay: +incoming.goals.newPerDay || 8, reviewCap: +incoming.goals.reviewCap || 80 };
    session = null;
    persist(true);
    render();
  },
  reset: function(){
    state = defaultState();
    session = null;
    persist(true);
    render();
  }
};

// so app.js can tell whether the flashcard session owns the number keys
window.__placementCapturesKeys = function(){
  var panel = document.getElementById("tab-placement");
  return !!(session && panel && panel.classList.contains("active"));
};
window.__placementRender = render;

/* ---------- init ---------- */
render();

})();