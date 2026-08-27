/* ============================================================
   profiles.js — two separate people on one tracker.

   Every storage key the tracker owns is namespaced per profile, so
   Amigo and Spidey keep entirely separate semester progress, activity
   streaks, flashcard schedules and practice logs. Theme and the
   semester/placement mode stay device-wide on purpose — those are
   preferences of the browser, not of the person.

   IMPORTANT: this is a profile SWITCHER, not authentication. The app
   has no server, so there is nothing to check a password against and
   nowhere to hide the data. Anyone sitting at this browser can pick
   either profile. Real privacy means each person using their own
   browser (localStorage is per-browser), or a real backend.

   Must load BEFORE app.js and placement.js.
   ============================================================ */
(function(){
"use strict";

var ACTIVE_KEY   = "constellation.activeProfile";
var MIGRATED_KEY = "constellation.migrated.profiles.v1";

var PROFILES = [
  { id:"amigo",  name:"Amigo",  note:"that's you", accent:"var(--cyan)" },
  { id:"spidey", name:"Spidey", note:"",           accent:"var(--rose)" }
];

// Storage suffixes owned by a profile. Theme and mode are deliberately absent.
var OWNED = [
  "data.v1", "activity.v1", "lastVisit.v1", "selection.v2", "seed.ia1.v1",
  "placement.v1", "placement.view.v1"
];

function byId(id){
  for(var i = 0; i < PROFILES.length; i++) if(PROFILES[i].id === id) return PROFILES[i];
  return null;
}

function activeId(){
  var id = null;
  try{ id = localStorage.getItem(ACTIVE_KEY); }catch(e){}
  return byId(id) ? id : PROFILES[0].id;
}

function active(){ return byId(activeId()); }

function key(suffix){ return "constellation." + activeId() + "." + suffix; }

/* ---------- one-time migration of pre-profile data ----------
   Anything already saved under the old un-namespaced keys belongs to
   Amigo. The originals are left in place rather than deleted, so an
   older copy of the app would still find them. */
function migrate(){
  try{
    if(localStorage.getItem(MIGRATED_KEY)) return;
    var prefix = "constellation." + PROFILES[0].id + ".";
    var moved = 0;
    OWNED.forEach(function(suffix){
      var legacy = "constellation." + suffix;
      var val = localStorage.getItem(legacy);
      if(val !== null && localStorage.getItem(prefix + suffix) === null){
        localStorage.setItem(prefix + suffix, val);
        moved++;
      }
    });
    localStorage.setItem(MIGRATED_KEY, "1");
    if(moved) console.info("Moved " + moved + " existing key(s) into the Amigo profile.");
  }catch(e){
    console.warn("Profile migration skipped:", e);
  }
}
migrate();

/* ---------- a glanceable summary of any profile ----------
   Mirrors app.js: in-progress counts half, and the headline percentage is
   the mean of theory / labs / project so the menu agrees with the big
   "Progress index" number rather than quietly disagreeing with it. */
function weightOf(s){ return s === "done" ? 1 : s === "progress" ? 0.5 : 0; }
function pct(a, b){ return b === 0 ? 0 : Math.round(a / b * 100); }

function summary(id){
  try{
    var raw = localStorage.getItem("constellation." + id + ".data.v1");
    if(!raw) return null;
    var d = JSON.parse(raw);
    var done = 0, total = 0, parts = [];

    ["theory","labs"].forEach(function(domain){
      var block = d[domain] || {}, w = 0, n = 0;
      Object.keys(block).forEach(function(k){
        ((block[k] || {}).items || []).forEach(function(it){
          if(!it) return;
          n++;
          w += weightOf(it.status);
          if(it.status === "done") done++;
        });
      });
      if(n){ total += n; parts.push(pct(w, n)); }
    });

    var proj = d.project;
    if(proj && proj.partA && proj.partB){
      var partPct = function(p){
        if(p.tasks && p.tasks.length){
          return pct(p.tasks.filter(function(t){ return t.done; }).length, p.tasks.length);
        }
        return Math.round(weightOf(p.status) * 100);
      };
      parts.push(Math.round((partPct(proj.partA) + partPct(proj.partB)) / 2));
      done  += (proj.partA.status === "done" ? 1 : 0) + (proj.partB.status === "done" ? 1 : 0);
      total += 2;
    }

    if(!total || !parts.length) return null;
    var overall = Math.round(parts.reduce(function(a,b){ return a + b; }, 0) / parts.length);
    return { done: done, total: total, pct: overall };
  }catch(e){
    return null;
  }
}

function switchTo(id){
  if(!byId(id) || id === activeId()) return;
  try{ localStorage.setItem(ACTIVE_KEY, id); }catch(e){}
  // A reload is the honest way to swap every module's storage keys at once.
  location.reload();
}

/* ---------- switcher UI ---------- */
function initial(name){ return name.slice(0,1).toUpperCase(); }

function render(){
  var host = document.getElementById("who");
  if(!host) return;
  var cur = active();

  var html = '<button class="who-btn" id="whoBtn" aria-haspopup="menu" aria-expanded="false">' +
      '<span class="who-dot" style="--a:' + cur.accent + '">' + initial(cur.name) + '</span>' +
      '<span class="who-name">' + cur.name + '</span>' +
      '<svg class="who-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 9l6 6 6-6"/></svg>' +
    '</button>';

  html += '<div class="who-menu" id="whoMenu" role="menu">' +
    '<span class="who-label">Profile</span>';

  PROFILES.forEach(function(p){
    var s = summary(p.id);
    var meta = [];
    if(p.note) meta.push(p.note);
    meta.push(s ? s.pct + "% · " + s.done + " of " + s.total + " items" : "nothing tracked yet");
    html += '<button class="who-item' + (p.id === cur.id ? ' on' : '') + '" ' +
        'data-profile="' + p.id + '" role="menuitem">' +
        '<span class="who-dot" style="--a:' + p.accent + '">' + initial(p.name) + '</span>' +
        '<span class="who-text"><b>' + p.name + '</b><i>' + meta.join(" · ") + '</i></span>' +
        '<span class="who-tick" aria-hidden="true">' + (p.id === cur.id ? "&#10003;" : "") + '</span>' +
      '</button>';
  });

  html += '<p class="who-foot">Separate progress per profile, saved in this browser. ' +
    'Not a password — anyone here can switch.</p></div>';

  host.innerHTML = html;
  // NOT data-profile — that attribute is the switch target, and putting it on
  // the host would make every click inside the chip look like a switch.
  host.dataset.active = cur.id;
}

function close(){
  var host = document.getElementById("who");
  if(!host) return;
  host.classList.remove("open");
  var btn = document.getElementById("whoBtn");
  if(btn) btn.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", function(e){
  var host = document.getElementById("who");
  if(!host) return;

  // toggle first — the chip sits outside the menu and must never read as a switch
  var btn = e.target.closest("#whoBtn");
  if(btn){
    var open = !host.classList.contains("open");
    host.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    return;
  }

  var item = e.target.closest(".who-menu [data-profile]");
  if(item && host.contains(item)){ switchTo(item.dataset.profile); return; }

  if(!host.contains(e.target)) close();
});

document.addEventListener("keydown", function(e){
  if(e.key === "Escape") close();
});

window.Profiles = {
  list: function(){ return PROFILES.slice(); },
  activeId: activeId,
  active: active,
  key: key,
  summary: summary,
  switchTo: switchTo,
  render: render
};

render();
// app.js runs after this file and may create or seed the active profile's data
// on a first visit, so refresh once the synchronous boot has finished.
setTimeout(render, 0);

})();
