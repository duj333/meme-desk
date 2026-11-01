"use strict";
const $ = (id) => document.getElementById(id);
const CFG = window.DESK_CONFIG || {}, POLL_MS = CFG.pollMs || 15000;
const usd = (v) => (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const sUsd = (v) => (v > 0 ? "+" : v < 0 ? "" : "±") + usd(v);
const sPct = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(2) + "%";
const cls = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "flat");
const px = (v) => v == null ? "—" : (v >= 1 ? v.toFixed(4) : v.toPrecision(4));
const hm = (iso) => iso ? iso.slice(11, 16) : "";
const ago = (s) => s < 0 ? "just now" : s < 5 ? "just now" : s < 60 ? `${Math.round(s)}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s ago` : s < 86400 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago` : `${Math.floor(s / 86400)}d ago`;
function el(tag, c, text) { const e = document.createElement(tag); if (c) e.className = c; if (text !== undefined) e.textContent = text; return e; }
function colorFor(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h} 62% 46%)`; }

let last = null, lastOkAt = 0, lastEq = null, firstDone = false, failStreak = 0, lastId = null;

/* ---------- splash (quick terminal boot, ~0.8 s) ---------- */
const SPLASH = ["$ desk --mode paper", "> scout · filter · analyst", "> executor · risk · logger", "> polling relay…"];
(function splash() {
  if (sessionStorage.getItem("splashed")) { $("splash").remove(); return; }
  sessionStorage.setItem("splashed", "1");
  let i = 0; const t = $("spTerm");
  const iv = setInterval(() => { if (i < SPLASH.length) t.textContent += (i ? "\n" : "") + SPLASH[i++]; else clearInterval(iv); }, 160);
  const hide = () => { const s = $("splash"); if (s) { s.classList.add("gone"); setTimeout(() => s.remove(), 400); } };
  setTimeout(() => { if (firstDone) hide(); else { const w = setInterval(() => { if (firstDone) { clearInterval(w); hide(); } }, 100); setTimeout(hide, 1600); } }, 750);
})();

/* ---------- chart ---------- */
function curve(pts, start) {
  const W = 500, H = 120, P = 4;
  if (!pts || pts.length < 2) return "";
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]).concat([start]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), pad = Math.max((y1 - y0) * 0.1, 20);
  const X = (x) => P + (W - 2 * P) * ((x - x0) / ((x1 - x0) || 1)), Y = (y) => H - P - (H - 2 * P) * ((y - (y0 - pad)) / ((y1 + pad) - (y0 - pad)));
  let d = ""; pts.forEach((p, i) => { d += (i ? " L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); });
  const lp = pts[pts.length - 1], col = lp[1] >= start ? "#00ba7c" : "#f4212e";
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Equity curve"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
  <line x1="0" x2="${W}" y1="${Y(start).toFixed(1)}" y2="${Y(start).toFixed(1)}" stroke="#71767b" stroke-opacity=".5" stroke-dasharray="3 5" vector-effect="non-scaling-stroke"/>
  <path d="${d} L${X(lp[0]).toFixed(1)} ${H} L${X(pts[0][0]).toFixed(1)} ${H} Z" fill="url(#g)"/>
  <path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

/* ---------- render (snapshot from the ntfy relay) ---------- */
const nowS = () => Date.now() / 1000;
function render(s) {
  const eq = usd(s.equity), cut = eq.lastIndexOf(".");
  const big = $("eq"); big.replaceChildren(document.createTextNode(eq.slice(0, cut)), el("small", "", eq.slice(cut)));
  if (lastEq !== null && s.equity !== lastEq) { big.classList.remove("flash-up", "flash-dn"); void big.offsetWidth; big.classList.add(s.equity > lastEq ? "flash-up" : "flash-dn"); }
  lastEq = s.equity;
  const c = $("chg"); c.textContent = `${sUsd(s.chg)} (${sPct(s.chgPct)})`; c.className = "chgpill " + (s.chg >= 0 ? "pos" : "neg");
  const t = $("today"); t.replaceChildren(document.createTextNode("Today "), el("span", cls(s.todayChg), `${sUsd(s.todayChg)} (${sPct(s.todayPct)})`),
    el("span", "hsub", ` · ${s.todayClosed} closed`));
  $("curve").innerHTML = curve(s.curve, s.start);
  $("sWR").textContent = s.winRate == null ? "—" : s.winRate.toFixed(0) + "%";
  $("sWL").replaceChildren(el("span", "pos", String(s.wins)), document.createTextNode("/"), el("span", "neg", String(s.losses)));
  $("sOpen").textContent = s.openN; $("sScan").textContent = s.scanned >= 10000 ? (s.scanned / 1000).toFixed(1) + "k" : s.scanned.toLocaleString("en-US");
  $("posSub").textContent = s.pos.length ? `${s.pos.length} open · max 5` : "";
  $("positions").replaceChildren(...(s.pos.length ? s.pos.map((p) => {
    const r = el("div", "row"), av = el("div", "av", (p.sym.replace(/[^A-Za-z0-9]/g, "")[0] || "?").toUpperCase()); av.style.background = colorFor(p.sym);
    const mid = el("div"), nm = el("div", "rn"); nm.append(el("span", "", "$" + p.sym), el("span", "tag open", "OPEN"));
    if (p.trail) nm.append(el("span", "tag trail", "TRAIL"));
    mid.append(nm, el("div", "rs", `${usd(p.size)} · in ${hm(p.opened)} · entry ${px(p.entry)} · now ${px(p.last)} · stop ${px(p.stop)}`));
    const pp = el("div", "rp " + cls(p.pnl), sUsd(p.pnl)); pp.append(el("div", "", sPct(p.pct))); r.append(av, mid, pp); return r;
  }) : [el("div", "empty", "No open positions in the latest snapshot.")]));
  renderHb(s);
  $("trSub").textContent = `${s.wins} won · ${s.losses} lost`;
  $("trades").replaceChildren(...(s.recent.length ? s.recent.map((p) => {
    const r = el("div", "row"), av = el("div", "av", (p.sym.replace(/[^A-Za-z0-9]/g, "")[0] || "?").toUpperCase()); av.style.background = colorFor(p.sym);
    const mid = el("div"), nm = el("div", "rn"); nm.append(el("span", "", "$" + p.sym), el("span", "tag r", p.reason || "closed"));
    const day = p.closed.slice(5, 10).split("-").reverse().join(".");
    mid.append(nm, el("div", "rs", `${usd(p.size)} · ${day} ${hm(p.opened)}→${hm(p.closed)}`), el("div", "rs mono", `entry ${px(p.entry)} → exit ${px(p.exit)}`));
    const pp = el("div", "rp " + cls(p.pnl), sUsd(p.pnl)); pp.append(el("div", "", sPct(p.pct))); r.append(av, mid, pp); return r;
  }) : [el("div", "empty", "No closed trades yet.")]));
}
function renderHb(s) {
  const extra = nowS() - s.ts; let alive = 0; const names = Object.keys(s.hb);
  $("hbs").replaceChildren(...names.map((n) => {
    const a0 = s.hb[n], a = a0 == null ? null : a0 + extra, ok = a !== null && a < 120 + (s.ka || s.every || 60); if (ok) alive++;
    const b = el("div", "hb"); b.append(el("span", "dot" + (ok ? "" : " off")));
    const tx = el("div"); tx.append(el("div", "hbn", n), el("div", "hba", a === null ? "no signal" : ok ? `ok · ${ago(a)}` : `down · ${ago(a)}`)); b.append(tx); return b;
  }));
  $("hbSub").textContent = `${alive}/${names.length} alive`;
}

/* ---------- freshness ---------- */
const ageS = () => last ? Math.max(0, nowS() - last.ts) : Infinity;
const staleAfter = () => (last ? (last.ka || last.every || 60) : 60) + 90;
function updateStatus(reachable) {
  const age = ageS(), stale = age > staleAfter();
  const u = $("updated");
  if (last) { u.textContent = `Last updated ${ago(age)} · desk sends changes every ~${last.every >= 120 ? Math.round(last.every / 60) + " min" : last.every + " s"}, check-in every ${Math.round((last.ka || 600) / 60)} min` + (reachable ? "" : " · relay unreachable"); u.className = "updated" + (stale ? " stale" : ""); renderHb(last); }
  const b = $("stale");
  if (last && stale) {
    b.replaceChildren(el("b", "", `Not live — last snapshot is ${ago(age).replace(" ago", "")} old. `),
      document.createTextNode("The desk computer is paused (it sleeps when no agent is active), so it stopped sending numbers. These are the last ones it sent, not live prices."));
    b.classList.remove("hidden");
  } else b.classList.add("hidden");
  $("main").classList.toggle("dim", !!last && stale);
  const dot = $("dot"), lt = $("liveTxt");
  if (!reachable && !last) { dot.className = "dot off"; lt.textContent = "offline"; }
  else if (!reachable) { dot.className = "dot off"; lt.textContent = "no connection"; }
  else if (stale) { dot.className = "dot warn"; lt.textContent = "not live"; }
  else { dot.className = "dot"; lt.textContent = "live"; }
}
function showOffline(h, p) {
  $("offH").textContent = h; $("offP").textContent = p;
  const ls = JSON.parse(localStorage.getItem("lastSeen") || "null");
  $("offLast").textContent = ls ? `Last snapshot ${ago(nowS() - ls.ts)} · balance then ${usd(ls.equity)}` : "";
  $("offline").classList.remove("hidden"); if (!last) $("main").classList.add("hidden");
}

async function tick() {
  let reachable = false;
  try {
    const url = `${CFG.relay}/${encodeURIComponent(CFG.topic)}/json?poll=1&since=latest`;
    const r = await fetch(url, {cache: "no-store"});
    if (!r.ok) throw new Error("relay " + r.status);
    reachable = true; failStreak = 0;
    const lines = (await r.text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((m) => m.event === "message");
    if (!lines.length) {
      if (!last) showOffline("Desk paused", "The relay has no recent snapshot (it keeps them 12 h). The desk computer has been asleep; numbers return when it wakes.");
    } else {
      const m = lines[lines.length - 1], s = JSON.parse(m.message);
      if (s.v !== 1) throw new Error("bad snapshot");
      lastOkAt = Date.now();
      if (!last || m.id !== lastId) { last = s; lastId = m.id; render(s); }
      localStorage.setItem("lastSeen", JSON.stringify({ts: s.ts, equity: s.equity}));
      $("offline").classList.add("hidden"); $("main").classList.remove("hidden");
    }
  } catch (e) {
    failStreak++;
    if (failStreak >= 2 || !last) showOffline("No connection", "Can't reach the relay. Check the phone's internet. If the desk computer is paused, numbers also stop until it wakes.");
  } finally { firstDone = true; updateStatus(reachable || (failStreak < 2 && !!last)); }
}

$("retry").addEventListener("click", tick);
setInterval(() => { if (!document.hidden) tick(); }, POLL_MS);
setInterval(() => updateStatus(failStreak === 0), 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
tick();

/* ---------- service worker: update on reload ---------- */
if ("serviceWorker" in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (had && !window.__reloaded) { window.__reloaded = true; location.reload(); } });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", {scope: "./", updateViaCache: "none"}).then((reg) => {
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}
