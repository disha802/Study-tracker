/* ============================================================
   sync.js — keep a profile's data in a secret GitHub Gist.

   The gist IS the save file. Every change is pushed (debounced); on
   load the newer side wins, and if both sides moved you are asked
   rather than silently overwritten.

   The token is a classic PAT with the `gist` scope only. It lives in
   this browser's localStorage, per profile, and is sent to
   api.github.com and nowhere else. It is never written to the repo.

   Loads after app.js, and uses:
     window.__constellationData.build()  -> backup payload
     window.__constellationData.apply(p) -> restore a payload
     window.__constellationChanged()     -> called by app/placement on save
   ============================================================ */
(function(){
"use strict";

var API        = "https://api.github.com";
var FILENAME   = "study-tracker.json";
var MARKER     = "study-tracker-sync";
var DEBOUNCE   = 5000;
var DEVICE_KEY = "constellation.deviceId";

var K = (window.Profiles && window.Profiles.key) || function(s){ return "constellation." + s; };
var TOKEN_KEY = K("gist.token.v1");
var STATE_KEY = K("gist.state.v1");

/* ---------------- local state ---------------- */
function profileId(){
  return (window.Profiles && window.Profiles.activeId()) || "default";
}
function profileName(){
  return (window.Profiles && window.Profiles.active().name) || "Tracker";
}

function deviceId(){
  var d = null;
  try{ d = localStorage.getItem(DEVICE_KEY); }catch(e){}
  if(!d){
    d = Math.random().toString(36).slice(2, 8);
    try{ localStorage.setItem(DEVICE_KEY, d); }catch(e){}
  }
  return d;
}

function token(){
  try{ return localStorage.getItem(TOKEN_KEY) || ""; }catch(e){ return ""; }
}
function setToken(v){
  try{ v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); }catch(e){}
}

function loadState(){
  try{
    var s = JSON.parse(localStorage.getItem(STATE_KEY));
    if(s && typeof s === "object") return s;
  }catch(e){}
  return { gistId:"", login:"", lastRemoteSavedAt:"", lastPushedAt:"", dirty:false };
}
function saveState(){
  try{ localStorage.setItem(STATE_KEY, JSON.stringify(state)); }catch(e){}
}

var state = loadState();
var status = { kind: token() && state.gistId ? "idle" : "off", message:"", at:0 };
var conflict = null;     // { localAt, remoteAt, remotePayload }
var applying = false;    // guard so a pull does not re-trigger a push
var busy = false;
var timer = null;

function connected(){ return !!(token() && state.gistId); }

/* ---------------- GitHub API ---------------- */
function api(path, options){
  options = options || {};
  var headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if(options.body) headers["Content-Type"] = "application/json";
  var t = token();
  if(t) headers["Authorization"] = "Bearer " + t;

  return fetch(API + path, {
    method: options.method || "GET",
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    keepalive: !!options.keepalive
  }).then(function(res){
    if(res.status === 401){
      throw new Error("GitHub rejected the token. It may have been revoked, or it lacks the gist scope.");
    }
    if(res.status === 404){
      throw new Error("Not found on GitHub. If the gist was deleted, disconnect and connect again to make a new one.");
    }
    if(res.status === 403){
      var remaining = res.headers.get("x-ratelimit-remaining");
      throw new Error(remaining === "0"
        ? "GitHub rate limit reached. It resets within the hour."
        : "GitHub refused the request (403). Check the token has the gist scope.");
    }
    if(!res.ok){
      return res.text().then(function(body){
        throw new Error("GitHub returned " + res.status + ". " + body.slice(0, 160));
      });
    }
    return res.status === 204 ? null : res.json().then(function(json){
      json.__scopes = res.headers.get("x-oauth-scopes");
      return json;
    });
  }, function(err){
    if(err instanceof TypeError) throw new Error("Could not reach GitHub. Check your connection.");
    throw err;
  });
}

function description(){
  return MARKER + ":" + profileId() + " — Study Tracker save file (" + profileName() + ")";
}

function readGist(g){
  var file = g.files && g.files[FILENAME];
  if(!file) return Promise.resolve(null);
  if(file.truncated && file.raw_url){
    return fetch(file.raw_url).then(function(r){ return r.json(); });
  }
  try{ return Promise.resolve(JSON.parse(file.content)); }
  catch(e){ return Promise.resolve(null); }
}

/* ---------------- push / pull ---------------- */
function buildPayload(){
  var p = window.__constellationData.build();
  p.savedAt = new Date().toISOString();
  p.device  = deviceId();
  return p;
}

function writeGist(payload){
  var body = { description: description(), files: {} };
  body.files[FILENAME] = { content: JSON.stringify(payload, null, 2) };
  var path = state.gistId ? "/gists/" + state.gistId : "/gists";
  if(!state.gistId) body.public = false;
  return api(path, { method: state.gistId ? "PATCH" : "POST", body: body });
}

function push(force){
  if(!connected()) return Promise.resolve();
  if(busy) return Promise.resolve();
  busy = true;
  setStatus("syncing", "Saving to GitHub…");

  var payload = buildPayload();

  var precheck = force
    ? Promise.resolve(null)
    : api("/gists/" + state.gistId).then(readGist);

  return precheck.then(function(remote){
    if(!force && remote && remote.savedAt &&
       state.lastRemoteSavedAt && remote.savedAt !== state.lastRemoteSavedAt){
      conflict = { localAt: payload.savedAt, remoteAt: remote.savedAt, remotePayload: remote,
                   remoteDevice: remote.device || "another device" };
      setStatus("conflict", "This profile changed on GitHub too — choose which copy to keep.");
      toast("Sync paused: the same profile changed somewhere else.");
      return null;
    }
    return writeGist(payload).then(function(g){
      if(g && g.id) state.gistId = g.id;
      state.lastRemoteSavedAt = payload.savedAt;
      state.lastPushedAt = payload.savedAt;
      state.dirty = false;
      saveState();
      setStatus("synced", "");
    });
  }).catch(function(err){
    setStatus("error", err.message);
  }).then(function(){
    busy = false;
    render();
  });
}

function pull(){
  if(!connected()) return Promise.resolve();
  if(busy) return Promise.resolve();
  busy = true;
  setStatus("syncing", "Fetching from GitHub…");

  return api("/gists/" + state.gistId).then(readGist).then(function(remote){
    if(!remote) throw new Error("That gist has no " + FILENAME + " in it.");
    applyRemote(remote);
    setStatus("synced", "");
  }).catch(function(err){
    setStatus("error", err.message);
  }).then(function(){
    busy = false;
    render();
  });
}

function applyRemote(remote){
  applying = true;
  try{
    window.__constellationData.apply(remote);
    state.lastRemoteSavedAt = remote.savedAt || "";
    state.dirty = false;
    saveState();
  }finally{
    applying = false;
  }
}

/* ---------------- connect / disconnect ---------------- */
function connect(rawToken){
  var t = (rawToken || "").trim();
  if(!t){ setStatus("error", "Paste a token first."); render(); return; }
  setToken(t);
  busy = true;
  setStatus("syncing", "Checking the token…");
  render();

  api("/user").then(function(user){
    var scopes = user.__scopes;
    if(scopes !== null && scopes !== undefined && scopes !== "" && scopes.indexOf("gist") === -1){
      throw new Error("That token has scopes [" + scopes + "] but not `gist`. Make a new one with the gist scope ticked.");
    }
    state.login = user.login || "";
    // Adopt an existing save file for this profile if one is already on the account,
    // so a second device joins instead of creating a duplicate.
    return api("/gists?per_page=100").then(function(list){
      var want = MARKER + ":" + profileId();
      var hit = (list || []).filter(function(g){
        return g.description && g.description.indexOf(want) === 0 && g.files && g.files[FILENAME];
      })[0];
      return hit || null;
    });
  }).then(function(existing){
    if(existing){
      state.gistId = existing.id;
      saveState();
      return api("/gists/" + existing.id).then(readGist).then(function(remote){
        if(remote){
          applyRemote(remote);
          toast("Connected — pulled this profile's data from GitHub.");
        }
      });
    }
    state.gistId = "";
    saveState();
    var payload = buildPayload();
    return writeGist(payload).then(function(g){
      state.gistId = g.id;
      state.lastRemoteSavedAt = payload.savedAt;
      state.lastPushedAt = payload.savedAt;
      state.dirty = false;
      saveState();
      toast("Connected — created a secret gist for this profile.");
    });
  }).then(function(){
    setStatus("synced", "");
  }).catch(function(err){
    // never leave a token we could not validate sitting in storage
    if(!state.gistId){ setToken(""); state.login = ""; saveState(); }
    setStatus("error", err.message);
  }).then(function(){
    busy = false;
    render();
  });
}

function disconnect(keepRemote){
  setToken("");
  state = { gistId: keepRemote ? state.gistId : "", login:"", lastRemoteSavedAt:"", lastPushedAt:"", dirty:false };
  saveState();
  conflict = null;
  setStatus("off", "");
  render();
  toast("Disconnected. The gist itself is untouched — delete it on GitHub if you want it gone.");
}

/* ---------------- change tracking ---------------- */
function setStatus(kind, message){
  status = { kind: kind, message: message || "", at: Date.now() };
  paintDot();
}

window.__constellationChanged = function(){
  if(applying) return;
  if(!connected()) return;
  state.dirty = true;
  saveState();
  if(status.kind !== "conflict"){
    setStatus("pending", "");
    paintDot();
  }
  clearTimeout(timer);
  timer = setTimeout(function(){
    if(status.kind === "conflict") return;
    push(false);
  }, DEBOUNCE);
};

// best-effort flush when the tab goes away
document.addEventListener("visibilitychange", function(){
  if(document.visibilityState !== "hidden") return;
  if(!connected() || !state.dirty || status.kind === "conflict") return;
  clearTimeout(timer);
  push(false);
});

/* ---------------- boot reconciliation ---------------- */
function reconcileOnLoad(){
  if(!connected()) return;
  setStatus("syncing", "Checking GitHub…");
  paintDot();
  api("/gists/" + state.gistId).then(readGist).then(function(remote){
    var remoteAt = remote && remote.savedAt || "";
    var remoteMoved = !!remoteAt && remoteAt !== state.lastRemoteSavedAt;

    if(remoteMoved && state.dirty){
      conflict = { localAt: state.lastPushedAt || "(unsaved local edits)", remoteAt: remoteAt,
                   remotePayload: remote, remoteDevice: remote.device || "another device" };
      setStatus("conflict", "Both this browser and GitHub have changes.");
      toast("Sync paused: this profile changed here and on GitHub.");
    }else if(remoteMoved){
      applyRemote(remote);
      setStatus("synced", "");
      toast("Pulled newer data from GitHub.");
    }else if(state.dirty){
      return push(false);
    }else{
      setStatus("synced", "");
    }
  }).catch(function(err){
    setStatus("error", err.message);
  }).then(function(){ render(); });
}

/* ---------------- helpers ---------------- */
function toast(msg){
  var el = document.getElementById("magicToast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ el.classList.remove("show"); }, 5000);
}

function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function ago(iso){
  if(!iso) return "never";
  var t = Date.parse(iso);
  if(isNaN(t)) return esc(iso);
  var s = Math.round((Date.now() - t) / 1000);
  if(s < 60) return "just now";
  if(s < 3600) return Math.round(s/60) + " min ago";
  if(s < 86400) return Math.round(s/3600) + " h ago";
  return Math.round(s/86400) + " d ago";
}

function stamp(iso){
  var t = Date.parse(iso);
  return isNaN(t) ? esc(iso || "—") : new Date(t).toLocaleString();
}

var LABEL = {
  off:"Not connected", idle:"Ready", syncing:"Syncing…",
  pending:"Unsaved changes", synced:"Synced", conflict:"Needs a decision", error:"Error"
};

function paintDot(){
  var dot = document.querySelector(".who-sync");
  if(!dot) return;
  dot.dataset.state = status.kind;
  dot.title = "Sync: " + LABEL[status.kind] + (status.message ? " — " + status.message : "");
}

/* ---------------- modal ---------------- */
function ensureModal(){
  var el = document.getElementById("syncModal");
  if(el) return el;
  el = document.createElement("div");
  el.id = "syncModal";
  el.className = "sync-modal";
  el.innerHTML = '<div class="sync-sheet" role="dialog" aria-modal="true" aria-label="Sync with GitHub">' +
    '<div class="sync-body" id="syncBody"></div></div>';
  document.body.appendChild(el);
  return el;
}

function open(){ ensureModal().classList.add("show"); render(); }
function close(){ var m = document.getElementById("syncModal"); if(m) m.classList.remove("show"); }

function render(){
  paintDot();
  var body = document.getElementById("syncBody");
  if(!body) return;

  var h = '<div class="sync-head">' +
      '<div><span class="sync-eyebrow">SYNC · ' + esc(profileName().toUpperCase()) + '</span>' +
      '<h3>Save to GitHub</h3></div>' +
      '<button class="sync-x" data-sync="close" aria-label="Close">&times;</button>' +
    '</div>';

  h += '<div class="sync-status" data-state="' + status.kind + '">' +
      '<span class="sync-dot"></span><b>' + LABEL[status.kind] + '</b>' +
      (status.kind === "synced" && state.lastPushedAt ? '<i>' + ago(state.lastPushedAt) + '</i>' : '') +
      (status.message ? '<p>' + esc(status.message) + '</p>' : '') +
    '</div>';

  if(conflict){
    h += '<div class="sync-conflict">' +
      '<b>Two copies have moved apart.</b>' +
      '<p>GitHub was last written ' + esc(stamp(conflict.remoteAt)) + ' from device <code>' +
        esc(conflict.remoteDevice) + '</code>. This browser last pushed ' + esc(stamp(conflict.localAt)) + '.</p>' +
      '<p>Nothing has been overwritten. Pick the copy to keep — the other one is lost, so export a backup first if unsure.</p>' +
      '<div class="sync-row">' +
        '<button class="sync-btn danger" data-sync="keep-local">Keep this browser</button>' +
        '<button class="sync-btn" data-sync="keep-remote">Take GitHub’s copy</button>' +
      '</div></div>';
  }

  if(!connected()){
    h += '<p class="sync-p">Paste a GitHub token with the <b>gist</b> scope and nothing else. ' +
        'The tracker keeps this profile in a secret gist and syncs it to any device where you paste the same token.</p>' +
      '<div class="sync-field">' +
        '<input type="password" id="syncToken" placeholder="ghp_…" autocomplete="off" spellcheck="false">' +
        '<button class="sync-btn primary" data-sync="connect">Connect</button>' +
      '</div>' +
      '<a class="sync-link" target="_blank" rel="noopener" ' +
        'href="https://github.com/settings/tokens/new?scopes=gist&description=Study%20Tracker">' +
        'Create one on GitHub &rarr;</a>';
  }else{
    h += '<dl class="sync-facts">' +
      '<dt>Account</dt><dd>' + esc(state.login || "—") + '</dd>' +
      '<dt>Gist</dt><dd>' + (state.gistId
        ? '<a href="https://gist.github.com/' + esc(state.gistId) + '" target="_blank" rel="noopener">' +
          esc(state.gistId.slice(0,10)) + '…</a>' : "—") + '</dd>' +
      '<dt>Last push</dt><dd>' + esc(stamp(state.lastPushedAt)) + '</dd>' +
      '<dt>This device</dt><dd><code>' + esc(deviceId()) + '</code></dd>' +
    '</dl>' +
    '<div class="sync-row">' +
      '<button class="sync-btn" data-sync="push"' + (busy ? " disabled" : "") + '>Push now</button>' +
      '<button class="sync-btn" data-sync="pull"' + (busy ? " disabled" : "") + '>Pull now</button>' +
      '<button class="sync-btn danger" data-sync="disconnect">Disconnect</button>' +
    '</div>';
  }

  h += '<p class="sync-note"><b>Secret gists are unlisted, not private</b> — anyone with the URL can read them, ' +
    'so keep anything sensitive out of your notes. The token is stored in this browser only, is sent to ' +
    'api.github.com and nowhere else, and is never part of the repo.</p>';

  body.innerHTML = h;
}

/* ---------------- events ---------------- */
document.addEventListener("click", function(e){
  var open_ = e.target.closest("#syncBtn, [data-sync-open]");
  if(open_){ open(); return; }

  var act = e.target.closest("[data-sync]");
  if(act){
    var what = act.dataset.sync;
    if(what === "close") close();
    else if(what === "connect") connect((document.getElementById("syncToken")||{}).value);
    else if(what === "push"){ conflict = null; push(false); render(); }
    else if(what === "pull"){ conflict = null; pull(); render(); }
    else if(what === "disconnect"){
      if(confirm("Disconnect this profile from GitHub? The gist stays on your account; only this browser stops syncing.")) disconnect(true);
    }
    else if(what === "keep-local"){ conflict = null; push(true).then(function(){ toast("Kept this browser's copy."); }); render(); }
    else if(what === "keep-remote"){
      var remote = conflict && conflict.remotePayload;
      conflict = null;
      if(remote){ applyRemote(remote); setStatus("synced",""); toast("Took GitHub's copy."); }
      render();
    }
    return;
  }

  var modal = document.getElementById("syncModal");
  if(modal && e.target === modal) close();
});

document.addEventListener("keydown", function(e){
  if(e.key === "Escape") close();
  if(e.key === "Enter" && e.target && e.target.id === "syncToken") connect(e.target.value);
});

/* ---------------- init ---------------- */
(function boot(){
  if(!window.__constellationData){
    console.warn("sync.js: app.js did not expose __constellationData; sync disabled.");
    return;
  }
  // status dot inside the profile chip
  var attach = function(){
    var btn = document.querySelector(".who-btn");
    if(btn && !btn.querySelector(".who-sync")){
      var dot = document.createElement("span");
      dot.className = "who-sync";
      btn.appendChild(dot);
    }
    paintDot();
  };
  attach();
  setTimeout(attach, 0);

  render();
  reconcileOnLoad();
})();

window.__constellationSync = { open: open, push: push, pull: pull, status: function(){ return status; } };

})();
