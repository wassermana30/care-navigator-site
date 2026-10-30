// Plain-language definitions: hard words get a dotted underline; tap or hover shows a simple definition right under the word.
// Words come from GLOSSARY (glossary-data.js). Runs after translation, never inside buttons, links, menus or what the person typed.

var Glossary = (function () {
  var byId = {}, list = [];
  (typeof GLOSSARY !== "undefined" ? GLOSSARY : []).forEach(function (g) {
    byId[g.id] = g;
    g.terms.forEach(function (t) { list.push({ id: g.id, term: t }); });
  });
  list.sort(function (a, b) { return b.term.length - a.term.length; });  // longest first: "financial assistance policy" before "financial assistance"
  var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
  // Whole words only. Short all-caps terms (ER, PAP, FPL, CHIP) must match exactly in capitals; others ignore case.
  var caps = list.filter(function (x) { return /^[A-Z0-9()]+$/.test(x.term); }), rest = list.filter(function (x) { return !/^[A-Z0-9()]+$/.test(x.term); });
  var reCaps = caps.length ? new RegExp("(?<![\\w-])(" + caps.map(function (x) { return esc(x.term); }).join("|") + ")(?![\\w-])") : null;
  var reRest = rest.length ? new RegExp("(?<![\\w-])(" + rest.map(function (x) { return esc(x.term); }).join("|") + ")(?![\\w-])", "i") : null;
  function idFor(found) {
    for (var i = 0; i < list.length; i++) if (list[i].term.toLowerCase() === found.toLowerCase()) return list[i].id;
    return null;
  }
  // First glossary word in a piece of text: { index, text, id } or null.
  function find(text) {
    var a = reCaps ? reCaps.exec(text) : null, b = reRest ? reRest.exec(text) : null;
    var m = a && b ? (a.index <= b.index ? a : b) : a || b;
    return m ? { index: m.index, text: m[1], id: idFor(m[1]) } : null;
  }
  return { find: find, byId: byId };
})();

if (typeof document !== "undefined") (function () {
  var ROOTS = ["#chat", "#medResults", "#medPacket", "#results", "#packet", "#view-fight", "#view-covered", "#view-findcare", "#view-plan", "#talkPanel", "#gcOut"];
  var SKIP = "a, button, input, textarea, select, option, label, .gloss, #glossPop, script, style, nav, .tab, .msg.me, [data-no-gloss], .letter, .sug-tag, h1";
  var pop = document.createElement("div");
  pop.id = "glossPop"; pop.className = "gloss-pop hidden"; pop.setAttribute("role", "tooltip");
  var open = null;
  function show(el) {
    var g = Glossary.byId[el.dataset.gid]; if (!g) return;
    pop.innerHTML = "";
    var d = document.createElement("span"); d.textContent = g.def; pop.appendChild(d);
    if (g.hc) { var a = document.createElement("a"); a.href = "https://www.healthcare.gov/glossary/" + g.hc + "/"; a.target = "_blank"; a.rel = "noopener"; a.textContent = " More"; a.className = "gloss-more"; pop.appendChild(a); }
    pop.classList.remove("hidden");
    var r = el.getBoundingClientRect();
    pop.style.top = (window.scrollY + r.bottom + 6) + "px";
    pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8)) + "px";
    if (open && open !== el) open.setAttribute("aria-expanded", "false");
    open = el; el.setAttribute("aria-expanded", "true");
  }
  function hide() { pop.classList.add("hidden"); if (open) open.setAttribute("aria-expanded", "false"); open = null; }
  function wrapIn(root) {
    var used = new WeakMap();
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var p = node.parentElement; if (!p || p.closest(SKIP) || p.closest(".hidden")) return;
      var box = p.closest(".card, .msg, .site, .plan-item, .talk-item") || root;
      var seen = used.get(box) || {}; used.set(box, seen);
      var text = node.nodeValue, f = Glossary.find(text);
      while (f && seen[f.id]) { var rest = text.slice(f.index + f.text.length), g = Glossary.find(rest); f = g ? { index: f.index + f.text.length + g.index, text: g.text, id: g.id } : null; }
      if (!f || box.querySelector(".gloss[data-gid='" + f.id + "']")) return;
      seen[f.id] = 1;
      var after = node.splitText(f.index); after.nodeValue = after.nodeValue.slice(f.text.length);
      var s = document.createElement("span");
      s.className = "gloss"; s.tabIndex = 0; s.dataset.gid = f.id; s.setAttribute("role", "button"); s.setAttribute("aria-expanded", "false");
      s.setAttribute("data-no-i18n", ""); s.textContent = f.text;
      node.parentNode.insertBefore(s, after);
    });
  }
  var timer = null;
  function run() { clearTimeout(timer); timer = setTimeout(function () { ROOTS.forEach(function (sel) { var r = document.querySelector(sel); if (r) wrapIn(r); }); }, 120); }
  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(pop);
    new MutationObserver(function (muts) {
      if (muts.every(function (m) { return m.target === pop || pop.contains(m.target) || (m.target.closest && m.target.closest(".gloss")); })) return;
      run();
    }).observe(document.body, { childList: true, subtree: true });
    run();
  });
  document.addEventListener("click", function (e) {
    var g = e.target.closest && e.target.closest(".gloss");
    if (g) { e.preventDefault(); open === g ? hide() : show(g); return; }
    if (!pop.contains(e.target)) hide();
  });
  document.addEventListener("mouseover", function (e) { var g = e.target.closest && e.target.closest(".gloss"); if (g) show(g); });
  document.addEventListener("mouseout", function (e) { var g = e.target.closest && e.target.closest(".gloss"); if (g && !(e.relatedTarget && (pop.contains(e.relatedTarget) || g.contains(e.relatedTarget)))) hide(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hide();
    var g = e.target.closest && e.target.closest(".gloss");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open === g ? hide() : show(g); }
  });
  window.addEventListener("scroll", function () { if (open) show(open); }, { passive: true });
})();
