// Keyword search across the whole app: tools, symptoms, conditions, medications, help programs, your rights,
// help lines and plain-language definitions. Each result opens the right place. Pure index/search + a small panel.

var SiteSearch = (function () {
  var TOOLS = [
    { title: "Get help: symptoms, medications, diagnoses", text: "symptom checker sick hurt pain medicine prescription afford drug", view: "meds" },
    { title: "Hospital bill (501r)", text: "hospital bill financial assistance charity care free discounted 501(r) apply before surgery", view: "patient" },
    { title: "Fight a bill", text: "wrong bill itemized surprise out-of-network collections credit report dispute payment plan estimate", view: "fight" },
    { title: "Get covered", text: "insurance coverage Medicaid CHIP Marketplace HealthCare.gov Medicare Extra Help pregnancy children", view: "covered" },
    { title: "Find care near me", text: "clinic health center doctor near me ZIP sliding fee dental dentist tooth teeth low-cost cheap free clinic", view: "findcare" },
    { title: "My plan", text: "saved plan deadlines reminders calendar documents checklist", view: "plan" }
  ];
  var index = null;
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function add(kind, title, text, action, extra) { index.push(Object.assign({ kind: kind, title: title, t: norm(title), x: norm(text), action: action }, extra || {})); }
  function build() {
    if (index) return index;
    index = [];
    TOOLS.forEach(function (t) { add("Tool", t.title, t.text, { view: t.view }); });
    if (typeof Suggest !== "undefined") Object.keys(Suggest.SYM).forEach(function (id) { add("Symptom", Suggest.SYM[id][0], Suggest.SYM[id].join(" "), { ask: Suggest.SYM[id][0] }); });
    (typeof SYMPTOM_CONDITIONS !== "undefined" ? SYMPTOM_CONDITIONS : []).forEach(function (c) { add("Condition", c.label, c.plain, { ask: "I think I have " + c.label.replace(/\s*\(.*?\)/g, "").toLowerCase() }, { detail: c.plain }); });
    if (typeof PROGRAMS !== "undefined" && typeof MedsLogic !== "undefined") {
      MedsLogic.drugIndex(PROGRAMS).forEach(function (d) { add("Medication", d.label || d.brand, (d.names || []).join(" "), { ask: d.brand }); });
      PROGRAMS.forEach(function (p) { add("Help program", p.program, [p.sponsor, p.summary].join(" "), { url: p.applyUrl }, { detail: p.summary, phone: p.phone }); });
    }
    // Each right gets its own first sentence as the title (several share a topic), with the topic underneath.
    (typeof FIGHT_FACTS !== "undefined" ? FIGHT_FACTS.facts : []).forEach(function (f) {
      var first = (f.plain.match(/^[^.]*\./) || [f.plain])[0];
      add("Your rights", first, f.topic + " " + f.plain + " " + (f.details || []).join(" "), { fight: f.id }, { detail: f.topic });
    });
    (typeof HELP_LINES !== "undefined" ? HELP_LINES : []).forEach(function (g) { g.items.forEach(function (i) { add("Talk to a person", i.name, i.what, { talk: true }, { detail: i.what, phone: i.tel }); }); });
    (typeof GLOSSARY !== "undefined" ? GLOSSARY : []).forEach(function (g) { add("What it means", g.terms[0], g.terms.join(" ") + " " + g.def, { def: true }, { detail: g.def }); });
    return index;
  }
  // Every word of the query must appear (as the start of a word) in the title or text. Title hits rank higher.
  function search(q, limit) {
    var words = norm(q).split(" ").filter(function (w) { return w.length > 1; });
    if (!words.length) return [];
    var out = [];
    build().forEach(function (e) {
      var score = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i], inT = (" " + e.t).indexOf(" " + w) >= 0, inX = (" " + e.x).indexOf(" " + w) >= 0;
        if (!inT && !inX) return;
        score += inT ? (e.t.indexOf(w) === 0 ? 0 : 1) : 3;
      }
      if (e.t === norm(q)) score -= 5;
      out.push({ e: e, score: score });
    });
    var ORDER = { "Tool": 0, "Symptom": 1, "Condition": 2, "Medication": 3, "Help program": 4, "Your rights": 5, "Talk to a person": 6, "What it means": 7 };
    return out.sort(function (a, b) { return a.score - b.score || ORDER[a.e.kind] - ORDER[b.e.kind] || a.e.title.localeCompare(b.e.title); })
      .slice(0, limit || 40).map(function (x) { return x.e; });
  }
  return { search: search };
})();

if (typeof document !== "undefined") (function () {
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var nav = document.querySelector("header nav");
  if (!nav) return;
  var btn = document.createElement("button");
  btn.className = "tab search-btn"; btn.id = "siteSearchBtn"; btn.type = "button"; btn.innerHTML = "🔍 Search";
  nav.insertBefore(btn, nav.querySelector("details.more"));
  var panel = document.createElement("div");
  panel.id = "siteSearch"; panel.className = "site-search hidden no-print"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Search");
  panel.innerHTML = "<div class='ss-box'><div class='ss-head'><input id='ssInput' placeholder='Search anything: a symptom, a medicine, a word like deductible, a program...' autocomplete='off'>" +
    "<button type='button' class='ghost' id='ssClose' aria-label='Close'>✕</button></div><div id='ssResults' class='ss-results'></div></div>";
  document.body.appendChild(panel);
  var input = document.getElementById("ssInput"), res = document.getElementById("ssResults"), shown = [];
  function openPanel() { panel.classList.remove("hidden"); input.focus(); input.select(); render(); }
  function closePanel() { panel.classList.add("hidden"); }
  function render() {
    var q = input.value.trim();
    if (!q) { res.innerHTML = "<p class='hint'>Try: <i>sore throat</i>, <i>insulin</i>, <i>collections</i>, <i>deductible</i>, <i>Medicaid</i>, <i>dentist</i>.</p>"; return; }
    shown = SiteSearch.search(q, 40);
    if (!shown.length) { res.innerHTML = "<p class='hint'>No matches. Try fewer or different words, or <a href='#' id='ssAsk'>ask Get help</a>.</p>"; document.getElementById("ssAsk").onclick = function (e) { e.preventDefault(); closePanel(); askGetHelp(q); }; return; }
    var groups = {}, order = [];
    shown.forEach(function (e, i) { if (!groups[e.kind]) { groups[e.kind] = []; order.push(e.kind); } if (groups[e.kind].length < 6) groups[e.kind].push(i); });
    res.innerHTML = order.map(function (k) {
      return "<h3>" + esc(k) + "</h3>" + groups[k].map(function (i) {
        var e = shown[i];
        return "<button type='button' class='ss-item' data-i='" + i + "'><b>" + esc(e.title) + "</b>" + (e.detail ? "<span class='hint'>" + esc(e.detail) + "</span>" : "") + "</button>" +
          (e.action.def || e.kind === "Help program" ? "<div class='ss-detail hidden' id='ssd" + i + "'>" + esc(e.detail || "") +
            (e.phone ? " <a href='tel:" + esc(String(e.phone).replace(/[^0-9]/g, "")) + "'>" + esc(e.phone) + "</a>" : "") +
            (e.action.url ? " <a href='" + esc(e.action.url) + "' target='_blank' rel='noopener'>Official site</a>" : "") + "</div>" : "");
      }).join("");
    }).join("");
    res.querySelectorAll(".ss-item").forEach(function (b) { b.onclick = function () { go(shown[+b.dataset.i], +b.dataset.i); }; });
  }
  function go(e, i) {
    var a = e.action;
    if (a.def || e.kind === "Help program") { var d = document.getElementById("ssd" + i); if (d) d.classList.toggle("hidden"); return; }
    closePanel();
    if (a.view) return showView(a.view);
    if (a.ask) return askGetHelp(a.ask);
    if (a.fight && window.FightUI) { var sid = FightUI.situationFor(a.fight); return sid ? FightUI.open(sid) : showView("fight"); }
    if (a.talk) { var t = document.getElementById("talkBtn"); if (t) t.click(); }
  }
  btn.onclick = openPanel;
  document.getElementById("ssClose").onclick = closePanel;
  panel.addEventListener("click", function (e) { if (e.target === panel) closePanel(); });
  input.addEventListener("input", render);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.classList.contains("hidden")) closePanel();
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) { e.preventDefault(); openPanel(); }
  });
})();
