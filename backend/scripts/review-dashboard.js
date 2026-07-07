"use strict";
// Majstr review dashboard — talks to local-queue-server endpoints.
(function () {
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NP = ["uk", "ua", "ru", "en", "it"];
const pickName = (n) => { if (!n) return ""; if (typeof n === "string") return n; for (const k of NP) if (n[k]) return n[k]; for (const k in n) if (n[k]) return n[k]; return ""; };
const initials = (n) => (String(n || "?").trim()[0] || "?");
const LANG_FLAG = { uk: "🇺🇦", ru: "🇷🇺", it: "🇮🇹", en: "🇬🇧" };
async function api(path, opts) {
  opts = opts || {};
  const o = { method: opts.method || "GET", headers: {} };
  if (opts.body) { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(opts.body); }
  const r = await fetch(path, o);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
  return j;
}
function toast(m) { const e = document.createElement("div"); e.className = "toast"; e.textContent = m; document.body.appendChild(e); setTimeout(() => e.remove(), 1700); }
function tgLink(chatID, msg) { let s = String(chatID || ""); if (/^-100\d+$/.test(s)) s = s.slice(4); else if (/^-\d+$/.test(s)) s = s.slice(1); if (!/^\d+$/.test(s) || msg == null) return null; return "https://t.me/c/" + s + "/" + msg; }

// ---- reference / config ----
let profs = [], locs = [], cats = [], profById = {}, locById = {}, chatCountry = {}, defCountry = "IT";
async function loadRefs() {
  [profs, locs, cats] = await Promise.all([
    api("/api/reference/professions"), api("/api/reference/locations"), api("/api/reference/prof-categories"),
  ]);
  profById = {}; profs.forEach((p) => (profById[p.id] = p));
  locById = {}; locs.forEach((l) => (locById[l.id] = l));
  try { const c = await api("/api/local/config"); chatCountry = c.chatCountry || {}; defCountry = c.defaultCountry || "IT"; } catch (e) {}
}
const profLabel = (id) => (id && profById[id] ? pickName(profById[id].name) : "");
const locLabel = (id) => (id && locById[id] ? pickName(locById[id].name) : "");
const profOptions = (sel) => '<option value=""></option>' + profs.map((p) => '<option value="' + p.id + '"' + (p.id === sel ? " selected" : "") + ">" + esc(pickName(p.name)) + "</option>").join("");
const catOptions = (sel) => '<option value=""></option>' + cats.map((c) => '<option value="' + c.id + '"' + (c.id === sel ? " selected" : "") + ">" + esc(pickName(c.name)) + "</option>").join("");
const locOptions = (sel) => '<option value=""></option>' + locs.map((l) => '<option value="' + l.id + '"' + (l.id === sel ? " selected" : "") + ">" + esc(pickName(l.name)) + "</option>").join("");

// ---- tabs / theme / splitter ----
function showTab(t) {
  document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
  ["mining", "review", "approved", "stats", "reference"].forEach((v) => $(v).classList.toggle("on", v === t));
  if (t === "stats") renderStats();
  if (t === "approved") renderApproved();
  if (t === "reference") renderReference();
  if (t === "mining") { sizeCanvas(); loadMineChats(); }
}
document.querySelectorAll(".tab").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
$("theme").onclick = () => { const cur = document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light"); document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark"); drawGraph(); };
(function () { const sp = $("splitter"); let drag = false;
  sp.addEventListener("pointerdown", (e) => { drag = true; sp.classList.add("drag"); sp.setPointerCapture(e.pointerId); });
  sp.addEventListener("pointermove", (e) => { if (!drag) return; const w = Math.max(340, Math.min(window.innerWidth - 260, window.innerWidth - e.clientX)); document.documentElement.style.setProperty("--detailW", w + "px"); });
  sp.addEventListener("pointerup", (e) => { drag = false; sp.classList.remove("drag"); try { sp.releasePointerCapture(e.pointerId); } catch (_) {} });
})();

// ---- REVIEW ----
let entries = [], cat = "recommended", selectedId = null, checked = new Set(), approvedSession = [];
function entryFromBucket(b) {
  const sigs = (b.signals || []).map((s) => ({ candidateId: s.candidateId, author: s.responderName || "—", text: s.text || "", extracted: s.extracted || {}, chatID: s.chatID, anchor: s.anchorMessageID, state: "pending" }));
  if (b.type === "existing") {
    const m = b.master;
    return { id: "m:" + b.masterId, kind: "existing", masterId: b.masterId, name: m.name || "(no name)", profId: m.professionID || "", cityId: m.locationID || "", contacts: [], about: "", chatID: sigs[0] && sigs[0].chatID, recs: sigs, srcAnchor: sigs[0] && sigs[0].anchor, srcText: sigs[0] && sigs[0].text, source: "existing" };
  }
  const ex = (b.seed && b.seed.extracted) || {};
  return { id: "c:" + b.clusterKey, kind: "proposed", name: ex.name || (b.seed && b.seed.author) || "(no name)", profId: (b.seed && b.seed.suggestProfessionID) || "", cityId: (b.seed && b.seed.suggestLocationID) || "", contacts: (ex.contacts || []).map((c) => ({ contactType: c.contactType, value: c.value })), about: ex.description || "", chatID: b.seed && b.seed.chatID, recs: sigs, srcAnchor: b.seed && b.seed.anchorMessageID, srcText: b.seed && b.seed.text, source: "proposed" };
}
function entryFromCandidate(c) {
  const ex = c.extracted || {};
  return { id: "a:" + c.id, kind: "self", repCandidateId: c.id, name: ex.name || c.responderName || "(no name)", profId: c.suggestProfessionID || "", cityId: c.suggestLocationID || "", contacts: (ex.contacts || []).map((x) => ({ contactType: x.contactType, value: x.value })), about: ex.description || "", chatID: c.chatID, recs: [], srcAnchor: c.anchorMessageID, srcText: c.text, source: "scraped" };
}
async function loadReview() {
  try {
    const [buckets, anns] = await Promise.all([
      api("/api/mining/recommendation-buckets"),
      api("/api/mining/candidates?status=new&kind=announcement&pageSize=300"),
    ]);
    entries = (buckets.buckets || []).map(entryFromBucket).concat((anns.candidates || []).map(entryFromCandidate));
    if (!entries.find((e) => e.id === selectedId)) selectedId = null;
    renderAll();
  } catch (e) { toast("Load failed: " + e.message); }
}
const listFor = (c) => entries.filter((e) => (c === "recommended" ? e.recs.length > 0 : e.recs.length === 0)).sort((a, b) => b.recs.length - a.recs.length || a.name.localeCompare(b.name));
function renderHead() {
  const recd = entries.filter((e) => e.recs.length > 0).length, tot = entries.reduce((s, e) => s + e.recs.length, 0);
  $("headstat").innerHTML = '<div class="s"><span class="n">' + entries.length + '</span><span class="l">suggested</span></div><div class="s"><span class="n t">' + recd + '</span><span class="l">recommended</span></div><div class="s"><span class="n">' + approvedSession.length + '</span><span class="l">approved</span></div>';
  $("cntRec").textContent = entries.filter((e) => e.recs.length > 0).length;
  $("cntSelf").textContent = entries.filter((e) => e.recs.length === 0).length;
}
function renderTable() {
  const rows = listFor(cat), tb = $("tbody");
  $("tableEmpty").style.display = rows.length ? "none" : "block";
  tb.innerHTML = rows.map((e) => {
    const n = e.recs.length;
    return '<tr data-id="' + esc(e.id) + '" class="' + (e.id === selectedId ? "sel" : "") + '"><td><input type="checkbox" class="ck" data-ck="' + esc(e.id) + '" ' + (checked.has(e.id) ? "checked" : "") + "></td>" +
      '<td class="name">' + esc(e.name) + '</td><td class="sub">' + esc(profLabel(e.profId) || (e.recs[0] && e.recs[0].extracted && e.recs[0].extracted.profession) || "—") + '</td><td class="sub">' + esc(locLabel(e.cityId) || "—") + '</td>' +
      '<td class="num"><span class="recpill ' + (n ? "" : "zero") + '">' + n + "</span></td>" +
      '<td><span class="chip ' + e.kind + '">' + e.source + '</span></td><td><button class="rowx" data-x="' + esc(e.id) + '">✕</button></td></tr>';
  }).join("");
}
function renderAll() { renderHead(); renderTable(); renderDetail(); updateRemoveBtn(); }
$("tbody").addEventListener("click", (e) => {
  const ck = e.target.closest("[data-ck]"), x = e.target.closest("[data-x]"), tr = e.target.closest("tr");
  if (ck) { ck.checked ? checked.add(ck.dataset.ck) : checked.delete(ck.dataset.ck); updateRemoveBtn(); e.stopPropagation(); return; }
  if (x) { declineEntry(entries.find((en) => en.id === x.dataset.x)); e.stopPropagation(); return; }
  if (tr) { selectedId = tr.dataset.id; renderTable(); renderDetail(); $("detail").classList.add("open"); }
});
function updateRemoveBtn() { const b = $("removeSel"); b.disabled = checked.size === 0; b.textContent = checked.size ? "Decline selected (" + checked.size + ")" : "Decline selected"; }
$("removeSel").onclick = async () => { for (const id of [...checked]) await declineEntry(entries.find((e) => e.id === id), true); checked.clear(); await loadReview(); };
$("reviewReload").onclick = loadReview;
document.querySelectorAll(".subtab").forEach((b) => (b.onclick = () => { cat = b.dataset.cat; document.querySelectorAll(".subtab").forEach((x) => x.setAttribute("aria-selected", String(x === b))); selectedId = null; renderTable(); renderDetail(); }));

const processed = (e) => e.recs.filter((r) => r.state !== "pending").length;
const allDone = (e) => e.recs.every((r) => r.state !== "pending");
function renderDetail() {
  const e = entries.find((x) => x.id === selectedId), inner = $("detailInner"), no = $("noDetail");
  if (!e) { no.style.display = "grid"; inner.style.display = "none"; return; }
  no.style.display = "none"; inner.style.display = "flex";
  const n = e.recs.length, proc = processed(e), gate = n > 0 && !allDone(e);
  const link = tgLink(e.chatID, e.srcAnchor);
  const catId = e.profId && profById[e.profId] ? profById[e.profId].categoryID : "";
  const contactsHtml = e.contacts.map((c, i) => '<div class="crow"><select data-ct="' + i + '">' + ["telegram", "phone", "instagram", "whatsapp", "viber", "other"].map((t) => "<option" + (t === c.contactType ? " selected" : "") + ">" + t + "</option>").join("") + '</select><input class="cv" value="' + esc(c.value) + '"><button data-rmc="' + i + '">×</button></div>').join("");
  const langsHtml = ["uk", "ru", "it", "en"].map((l) => '<label><input type="checkbox" class="flang" value="' + l + '"' + (["uk", "it"].includes(l) ? " checked" : "") + '><span class="flag">' + LANG_FLAG[l] + "</span>" + l.toUpperCase() + "</label>").join("");
  const recsHtml = n ? e.recs.map((r, i) => '<div class="rec ' + r.state + '" data-i="' + i + '"><div class="who"><span class="av">' + esc(initials(r.author)) + "</span>" + esc(r.author) + '<span class="st">' + (r.state === "pending" ? "" : r.state === "approved" ? "✓ approved" : "✕ declined") + "</span></div>" + (r.text ? '<textarea class="rtext">' + esc(r.text) + "</textarea>" : '<div class="none">(no text — counts only)</div>') + '<div class="acts"><button class="rbtn ap' + (r.state === "approved" ? " active" : "") + '" data-ap="' + i + '">Approve</button><button class="rbtn de' + (r.state === "declined" ? " active" : "") + '" data-de="' + i + '">Decline</button></div></div>').join("") : '<div class="rec"><div class="none">Self-posted master — no recommendations to process.</div></div>';
  inner.innerHTML =
    '<div class="dhead"><div class="dkicker">' + (e.kind === "existing" ? "Existing master · attach recs" : n ? "Recommended master" : "Self-posted master") + '</div><div class="dname">' + esc(e.name) + '</div><div class="dmeta">' + esc(profLabel(e.profId) || "—") + " · " + esc(locLabel(e.cityId) || "—") + '</div><div class="dbadges"><span class="dbadge"><span class="num">' + n + '</span> recommendations</span><span class="dbadge">' + esc(e.source) + "</span></div></div>" +
    '<div class="dbody">' +
      '<div class="src"><div class="sh"><span>Original message</span>' + (link ? '<a href="' + link + '" target="_blank" rel="noopener">Open in Telegram ↗</a>' : "") + '</div><div class="st">' + esc(e.srcText || "(no text)") + "</div></div>" +
      '<div class="fld"><label>Name</label><input class="f-name" value="' + esc(e.name) + '"></div>' +
      '<div class="fld"><label>Category</label><select class="f-cat">' + catOptions(catId) + "</select></div>" +
      '<div class="fld"><label>Occupation</label><div class="addrow"><select class="f-prof">' + profOptions(e.profId) + '</select><button class="addc" data-add="prof">+ Add</button></div></div>' +
      '<div class="fld"><label>City</label><div class="addrow"><select class="f-city">' + locOptions(e.cityId) + '</select><button class="addc" data-add="city">+ Add</button></div></div>' +
      '<div class="fld"><label>Contacts</label><div class="f-contacts">' + contactsHtml + '</div><button class="addc" data-addc="1">+ contact</button></div>' +
      '<div class="fld"><label>Languages spoken</label><div class="langs">' + langsHtml + "</div></div>" +
      '<div class="fld"><label>Tags (comma-separated)</label><input class="f-tags"></div>' +
      '<div class="fld"><div class="lblrow"><label>About / description</label>' + (n ? '<button class="sumbtn" data-sum="1">✨ Summarize from reviews</button>' : "") + '</div><textarea class="f-about">' + esc(e.about) + "</textarea></div>" +
      '<div class="secttl"><h3>Recommendations</h3><span class="procpill ' + (!gate && n ? "done" : "") + '">' + proc + " / " + n + " processed</span></div>" + recsHtml +
    "</div>" +
    '<div class="dfoot"><div class="derr"></div>' + (gate ? '<div class="gate">Process every recommendation to enable approval.</div>' : "") + '<div class="row"><button class="approveM" ' + (gate ? "disabled" : "") + ">✓ " + (e.kind === "existing" ? "Attach & save" : "Approve master") + '</button><button class="declineM">Decline</button></div></div>';
  inner.querySelectorAll("[data-ap]").forEach((b) => (b.onclick = () => setRec(e, +b.dataset.ap, "approved")));
  inner.querySelectorAll("[data-de]").forEach((b) => (b.onclick = () => setRec(e, +b.dataset.de, "declined")));
  inner.querySelectorAll("[data-rmc]").forEach((b) => (b.onclick = () => { e.contacts.splice(+b.dataset.rmc, 1); renderDetail(); }));
  const ac = inner.querySelector("[data-addc]"); if (ac) ac.onclick = () => { e.contacts.push({ contactType: "phone", value: "" }); renderDetail(); };
  const sb = inner.querySelector("[data-sum]"); if (sb) sb.onclick = () => { inner.querySelector(".f-about").value = summarize(e); };
  inner.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => addInline(b)));
  inner.querySelector(".approveM").onclick = () => { if (!gate) publish(e); };
  inner.querySelector(".declineM").onclick = () => declineEntry(e);
}
function setRec(e, i, state) { const r = e.recs[i]; if (!r) return; r.text = curRecText(i, r.text); r.state = r.state === state ? "pending" : state; renderDetail(); renderTable(); }
function curRecText(i, fallback) { const el = document.querySelector('.rec[data-i="' + i + '"] .rtext'); return el ? el.value : fallback; }
function summarize(e) { const t = e.recs.filter((r) => (r.text || "").trim()); if (!t.length) return e.about; return (profLabel(e.profId) || "Майстер") + (locLabel(e.cityId) ? " у місті " + locLabel(e.cityId) : "") + ". За " + t.length + " відгуками спільноти клієнти відзначають якість роботи, уважність і приємні ціни — рекомендують звертатися знову."; }
function addInline(btn) {
  const kind = btn.dataset.add, row = btn.parentElement; if (row.querySelector(".newv")) return;
  const sel = row.querySelector(kind === "prof" ? ".f-prof" : ".f-city");
  const inp = document.createElement("input"); inp.className = "newv"; inp.placeholder = kind === "prof" ? "New occupation (English)" : "New city (English)";
  const ok = document.createElement("button"); ok.className = "addc"; ok.textContent = "OK";
  btn.style.display = "none"; row.appendChild(inp); row.appendChild(ok); inp.focus();
  ok.onclick = async () => {
    const v = inp.value.trim(); if (!v) { inp.remove(); ok.remove(); btn.style.display = ""; return; }
    try {
      if (kind === "prof") { const catId = row.closest(".dbody").querySelector(".f-cat").value; const p = await api("/api/reference/professions", { method: "POST", body: { categoryID: catId, name: { en: v } } }); profs.push(p); profById[p.id] = p; sel.innerHTML = profOptions(p.id); }
      else { const l = await api("/api/reference/locations", { method: "POST", body: { countryID: defCountry, name: { en: v } } }); locs.push(l); locById[l.id] = l; sel.innerHTML = locOptions(l.id); }
    } catch (err) { toast("Add failed: " + err.message); }
    inp.remove(); ok.remove(); btn.style.display = "";
  };
  inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") ok.click(); });
}
function readForm(e) {
  const q = (s) => $("detailInner").querySelector(s);
  const contacts = [...$("detailInner").querySelectorAll(".crow")].map((row) => ({ contactType: row.querySelector("select").value, value: row.querySelector(".cv").value.trim() })).filter((c) => c.value);
  const languages = [...$("detailInner").querySelectorAll(".flang:checked")].map((x) => x.value);
  const tags = q(".f-tags").value.split(",").map((s) => s.trim()).filter(Boolean);
  return { name: q(".f-name").value.trim(), professionID: q(".f-prof").value, locationID: q(".f-city").value, countryID: chatCountry[String(e.chatID)] || defCountry, contacts, about: q(".f-about").value.trim() || undefined, ...(languages.length ? { languages } : {}), ...(tags.length ? { tags: { ua: tags, en: [] } } : {}) };
}
function showErr(m) { const el = $("detailInner").querySelector(".derr"); if (el) el.textContent = m; }
const decl = (cid) => api("/api/mining/candidates/" + cid + "/decline", { method: "POST", body: { reasonCode: "other", note: "declined in review dashboard" } });
const attach = (cid, masterID, text) => api("/api/mining/candidates/" + cid + "/attach", { method: "POST", body: { masterID, text: text || "" } });
async function publish(e) {
  showErr("");
  const p = readForm(e);
  try {
    if (e.kind === "self") {
      if (!p.professionID || !p.locationID || !p.contacts.length) throw new Error("Need occupation + city + at least one contact.");
      await api("/api/mining/candidates/" + e.repCandidateId + "/accept", { method: "POST", body: { master: p, force: true } });
    } else if (e.kind === "existing") {
      for (let i = 0; i < e.recs.length; i++) { const r = e.recs[i]; if (r.state === "approved") await attach(r.candidateId, e.masterId, curRecText(i, r.text)); else if (r.state === "declined") await decl(r.candidateId); }
    } else {
      if (!p.professionID || !p.locationID || !p.contacts.length) throw new Error("Need occupation + city + at least one contact.");
      const approved = e.recs.map((r, i) => ({ r, i })).filter((x) => x.r.state === "approved");
      const declined = e.recs.filter((r) => r.state === "declined");
      if (!approved.length) throw new Error("Approve at least one recommendation, or decline the master.");
      const rep = approved[0];
      const res = await api("/api/mining/candidates/" + rep.r.candidateId + "/accept", { method: "POST", body: { master: p, force: true } });
      const masterID = res.masterID;
      for (const x of approved.slice(1)) await attach(x.r.candidateId, masterID, curRecText(x.i, x.r.text));
      for (const r of declined) await decl(r.candidateId);
    }
    approvedSession.unshift({ name: p.name, prof: profLabel(p.professionID), city: locLabel(p.locationID), recs: e.recs.filter((r) => r.state === "approved").length, when: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    toast(p.name + " approved ✓"); selectedId = null; await loadReview();
  } catch (err) { showErr(err.message); }
}
async function declineEntry(e, silent) {
  if (!e) return;
  try {
    if (e.kind === "self") await decl(e.repCandidateId);
    else for (const r of e.recs) await decl(r.candidateId);
    checked.delete(e.id); if (selectedId === e.id) selectedId = null;
    if (!silent) { toast(e.name + " declined"); await loadReview(); }
  } catch (err) { toast("Decline failed: " + err.message); }
}

// ---- APPROVED / STATS / REFERENCE ----
function renderApproved() {
  $("approvedEmpty").style.display = approvedSession.length ? "none" : "block";
  $("approvedBody").innerHTML = approvedSession.map((a) => '<tr><td class="name">' + esc(a.name) + '</td><td class="sub">' + esc(a.prof || "—") + '</td><td class="sub">' + esc(a.city || "—") + '</td><td class="num"><span class="recpill">' + a.recs + "</span></td><td class=\"sub\">" + a.when + "</td></tr>").join("");
}
function renderStats() {
  const recd = entries.filter((e) => e.recs.length > 0), tot = entries.reduce((s, e) => s + e.recs.length, 0);
  const byProf = {}; entries.forEach((e) => { if (e.recs.length) { const k = profLabel(e.profId) || (e.recs[0] && e.recs[0].extracted && e.recs[0].extracted.profession) || "—"; byProf[k] = (byProf[k] || 0) + e.recs.length; } });
  const top = Object.entries(byProf).sort((a, b) => b[1] - a[1]).slice(0, 8); const mx = top.length ? top[0][1] : 1;
  const topM = recd.slice().sort((a, b) => b.recs.length - a.recs.length).slice(0, 8); const mxM = topM.length ? topM[0].recs.length : 1;
  $("statsPad").innerHTML =
    '<div class="cards"><div class="statcard"><div class="big">' + entries.length + '</div><div class="lab">suggested masters</div></div>' +
    '<div class="statcard"><div class="big t">' + recd.length + '</div><div class="lab">recommended</div></div>' +
    '<div class="statcard"><div class="big te">' + tot + '</div><div class="lab">recommendations</div></div>' +
    '<div class="statcard"><div class="big">' + approvedSession.length + '</div><div class="lab">approved (session)</div></div></div>' +
    '<div class="h2">Most-recommended masters</div><div class="panelbox">' + (topM.map((m) => '<div class="brow"><div>' + esc(m.name) + '</div><div class="track"><i style="width:' + (m.recs.length / mxM * 100) + '%"></i></div><div class="v">' + m.recs.length + "</div></div>").join("") || '<div class="empty">No data yet</div>') + "</div>" +
    '<div class="h2">Recommendations by occupation</div><div class="panelbox">' + (top.map(([p, c]) => '<div class="brow"><div>' + esc(p) + '</div><div class="track"><i style="width:' + (c / mx * 100) + '%"></i></div><div class="v">' + c + "</div></div>").join("") || '<div class="empty">No data yet</div>') + "</div>";
}
function renderReference() {
  const tags = (arr) => arr.map((x) => '<span class="reftag">' + esc(pickName(x.name)) + "</span>").join("") || '<span class="empty">none</span>';
  $("refProfN").textContent = profs.length;
  $("refProf").innerHTML = tags(profs); $("refCity").innerHTML = tags(locs); $("refCat").innerHTML = tags(cats);
}

// ================= MINING =================
const cv = $("mineCanvas"), ctx = cv.getContext("2d"), card = $("nodecard");
let W = 0, H = 0, dpr = 1, gnodes = new Map(), gedges = [], eseen = new Set(), gSel = null, running = false, raf = null, minePoll = null;
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function sizeCanvas() { const r = cv.parentElement.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2); cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
new ResizeObserver(sizeCanvas).observe(cv.parentElement);
async function loadMineChats() { try { const { chats } = await api("/api/local/mine/chats"); const sel = $("mineChat"); if (!chats || !chats.length) { sel.innerHTML = '<option value="">— no imported chats —</option>'; return; } sel.innerHTML = chats.map((c) => '<option value="' + esc(c.chatID) + '">' + esc(c.label) + " — " + c.messages + " msg" + (c.candidates ? " · " + c.candidates + " pending" : "") + "</option>").join(""); } catch (e) {} }
function feed(k, t) { const d = document.createElement("div"); d.className = "row"; d.innerHTML = '<span class="dot ' + (k === "m" ? "m" : "r") + '"></span><span>' + esc(t) + "</span>"; $("feed").prepend(d); while ($("feed").children.length > 40) $("feed").lastChild.remove(); }
function resetGraph() { gnodes = new Map(); gedges = []; eseen = new Set(); gSel = null; card.style.display = "none"; $("feed").innerHTML = ""; }
function mergeGraph(g) {
  if (!g) return;
  (g.masters || []).forEach((m) => { let n = gnodes.get(m.key); if (!n) { n = { type: "master", key: m.key, label: m.name, recs: m.recs, x: W / 2 + (Math.random() - .5) * 140, y: H / 2 + (Math.random() - .5) * 140, vx: 0, vy: 0, age: 0 }; gnodes.set(m.key, n); feed("m", "Master — " + m.name); } else n.recs = m.recs; });
  (g.edges || []).forEach((e) => { const ek = e.r + "|" + e.m; if (eseen.has(ek)) return; eseen.add(ek); const rk = "r:" + e.r; let rn = gnodes.get(rk); if (!rn) { rn = { type: "rec", key: rk, x: W / 2 + (Math.random() - .5) * 260, y: H / 2 + (Math.random() - .5) * 200, vx: 0, vy: 0, age: 0 }; gnodes.set(rk, rn); } const mn = gnodes.get(e.m); if (mn) { gedges.push({ a: rn, b: mn }); feed("r", e.r + " recommends " + (mn.label || e.m)); } });
}
$("mineStart").onclick = async () => {
  const chatID = $("mineChat").value; if (!chatID) return;
  resetGraph(); sizeCanvas();
  try { const r = await api("/api/local/mine/start", { method: "POST", body: { chatID } }); running = true; $("mineStart").disabled = true; $("mineStop").style.display = "inline-block"; applyJob(r.job); if (minePoll) clearInterval(minePoll); minePoll = setInterval(pollMine, 700); loop(); }
  catch (e) { toast("Mine failed: " + e.message); }
};
$("mineStop").onclick = () => api("/api/local/mine/stop", { method: "POST" });
$("mineChatsReload").onclick = loadMineChats;
async function pollMine() { try { const { job } = await api("/api/local/mine/progress"); if (job) applyJob(job); if (job && !job.running) { running = false; $("mineStart").disabled = false; $("mineStop").style.display = "none"; if (minePoll) { clearInterval(minePoll); minePoll = null; } feed("m", "Done — see the Review tab."); loadReview(); } } catch (e) {} }
function applyJob(job) {
  const pct = job.total ? Math.round(job.done / job.total * 100) : 0;
  $("mineBar").style.width = pct + "%"; $("minePct").textContent = pct + "%";
  $("stMsg").textContent = job.done; $("stMasters").textContent = (job.graph && job.graph.masters.length) || 0; $("stRecs").textContent = job.useful;
  mergeGraph(job.graph);
}
cv.addEventListener("click", (e) => {
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let hit = null;
  for (const n of gnodes.values()) { if (n.type !== "master") continue; const rad = 10 + Math.sqrt(n.recs) * 5; if (Math.hypot(n.x - x, n.y - y) <= rad + 3) { hit = n; break; } }
  gSel = hit;
  if (hit) { const conn = gedges.filter((ed) => ed.b === hit).length; card.innerHTML = '<button class="close">×</button><h5>' + esc(hit.label) + '</h5><div class="r"><b>' + hit.recs + "</b> recommendations · " + conn + " people</div>"; card.style.display = "block"; const cw = card.offsetWidth || 200; card.style.left = Math.max(8, Math.min(W - cw - 8, hit.x - cw / 2)) + "px"; card.style.top = Math.max(8, hit.y + 20) + "px"; card.querySelector(".close").onclick = () => { gSel = null; card.style.display = "none"; drawGraph(); }; }
  else card.style.display = "none";
  drawGraph();
});
cv.addEventListener("mousemove", (e) => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let over = false; for (const n of gnodes.values()) { if (n.type !== "master") continue; const rad = 10 + Math.sqrt(n.recs) * 5; if (Math.hypot(n.x - x, n.y - y) <= rad + 3) { over = true; break; } } cv.style.cursor = over ? "pointer" : "default"; });
function tickGraph() {
  const arr = [...gnodes.values()], cx = W / 2, cy = H / 2;
  for (let i = 0; i < arr.length; i++) { const n = arr[i]; n.age = Math.min(1, n.age + .06); for (let j = i + 1; j < arr.length; j++) { const m = arr[j]; let dx = n.x - m.x, dy = n.y - m.y, d2 = dx * dx + dy * dy || 1, d = Math.sqrt(d2), f = 1400 / d2; n.vx += dx / d * f; n.vy += dy / d * f; m.vx -= dx / d * f; m.vy -= dy / d * f; } }
  gedges.forEach((e) => { let dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.hypot(dx, dy) || 1, f = (d - 70) * .02; e.a.vx += dx / d * f; e.a.vy += dy / d * f; e.b.vx -= dx / d * f; e.b.vy -= dy / d * f; });
  arr.forEach((n) => { n.vx += (cx - n.x) * .006; n.vy += (cy - n.y) * .006; n.vx *= .85; n.vy *= .85; n.x += n.vx; n.y += n.vy; const pad = 30; n.x = Math.max(pad, Math.min(W - pad, n.x)); n.y = Math.max(pad, Math.min(H - pad, n.y)); });
}
function drawGraph() {
  ctx.clearRect(0, 0, W, H); const ink = css("--ink"), terra = css("--terra"), teal = css("--teal");
  const sc = gSel ? new Set(gedges.filter((e) => e.b === gSel).map((e) => e.a).concat([gSel])) : null;
  gedges.forEach((e) => { const on = !sc || (sc.has(e.a) && sc.has(e.b)); ctx.globalAlpha = Math.min(e.a.age, e.b.age) * (on ? 1 : .15); ctx.strokeStyle = on && sc ? terra : "rgba(140,110,80,.3)"; ctx.lineWidth = on && sc ? 2 : 1; ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke(); });
  ctx.globalAlpha = 1;
  for (const n of gnodes.values()) {
    const dim = sc && !sc.has(n); ctx.globalAlpha = (.35 + .65 * n.age) * (dim ? .2 : 1);
    if (n.type === "rec") { ctx.beginPath(); ctx.arc(n.x, n.y, 5, 0, 7); ctx.fillStyle = css("--panel"); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = teal; ctx.stroke(); }
    else { const r = 10 + Math.sqrt(n.recs) * 5; if (n === gSel) { ctx.beginPath(); ctx.arc(n.x, n.y, r + 5, 0, 7); ctx.fillStyle = terra; ctx.globalAlpha = .25; ctx.fill(); ctx.globalAlpha = (.35 + .65 * n.age); } ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 7); ctx.fillStyle = terra; ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 " + Math.max(9, r * .75) + "px " + css("--mono"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n.recs, n.x, n.y); ctx.fillStyle = ink; ctx.font = "600 11px " + css("--sans"); ctx.textBaseline = "top"; ctx.fillText(n.label, n.x, n.y + r + 3); }
    ctx.globalAlpha = 1;
  }
}
function loop() { tickGraph(); drawGraph(); if (running || [...gnodes.values()].some((n) => Math.abs(n.vx) + Math.abs(n.vy) > .3)) raf = requestAnimationFrame(loop); }

// ---- boot ----
(async function () {
  sizeCanvas();
  try { await loadRefs(); } catch (e) { toast("Reference load failed: " + e.message); }
  await loadReview();
  loadMineChats();
})();
})();
