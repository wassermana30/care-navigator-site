// Spanish/English switch. Watches the page and swaps whole English text pieces for Spanish
// (I18N_ES, built from i18n/*.json). Never touches what the user typed (inputs, their chat bubbles).
var I18N = (function () {
  // Languages come from Joseph's table (i18n-multi.js). Spanish uses the full phrase map (i18n-es.js);
  // the other 13 cover the interface, questions and emergency messages, and show his "draft" notice.
  var LANGS = typeof I18N_LANGS !== "undefined" ? I18N_LANGS : [{ code: "en", native: "English", dir: "ltr", status: "official" }, { code: "es", native: "Español", dir: "ltr", status: "reviewed" }];
  var codes = LANGS.map(function (L) { return L.code; });
  var saved = null; try { saved = localStorage.getItem("lang") || localStorage.getItem("cn.lang"); } catch (e) {}
  var nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  var lang = codes.indexOf(saved) >= 0 ? saved : codes.indexOf(nav) >= 0 ? nav : "en";
  var META = LANGS.filter(function (L) { return L.code === lang; })[0] || LANGS[0];
  if (typeof I18N_ES === "undefined") window.I18N_ES = {};  // not loaded (page isn't in Spanish)
  var MAP = lang === "es" ? Object.assign({}, (typeof I18N_MULTI !== "undefined" && I18N_MULTI.es) || {}, I18N_ES)
          : lang === "en" ? {} : ((typeof I18N_MULTI !== "undefined" && I18N_MULTI[lang]) || {});
  var RULES = [  // text with numbers or names in it
    [/^(\d+) programs and (\d+) brand-name medications in the database\. Rules checked against official sources (\S+)\.$/, function (m, a, b, d) { return a + " programas y " + b + " medicamentos de marca en la base de datos. Reglas revisadas en fuentes oficiales el " + d + "."; }],
    [/^I also picked up: (.+)\.$/, function (m, list) { return "También entendí: " + list.split(", ").map(function (x) { return tr(x) || x; }).join(", ") + "."; }],
    [/^(Free medication|Copay help \(insured\)|Government program|Low-cost clinic|Lower price|Search directory|Free help \/ your rights) · (.+)$/, function (m, c, sp) { return I18N_ES[c] + " · " + sp; }],
    [/^Income rule: (.+)$/, function (m, r) { return "Regla de ingresos: " + (I18N_ES[r] || r); }],
    [/^([A-Z]{2}) did not expand Medicaid\. Adults without children usually can't qualify(?:, and parents only up to about (\d+)% of the poverty line)?\. Children and pregnant people qualify at much higher incomes, so apply for them\.$/, function (m, st, p) { return st + " no amplió Medicaid. Los adultos sin hijos normalmente no califican" + (p ? ", y los padres solo hasta alrededor del " + p + "% del nivel de pobreza" : "") + ". Los niños y las personas embarazadas califican con ingresos mucho más altos, así que solicite para ellos."; }],
    [/^([A-Z]{2}) expanded Medicaid: adults qualify up to about 138% of the poverty line \(\$([\d,]+) for a household of (\d+)\), and you're under it\.$/, function (m, st, a, n) { return st + " amplió Medicaid: los adultos califican hasta alrededor del 138% del nivel de pobreza ($" + a + " para un hogar de " + n + "), y usted está por debajo."; }],
    [/^Starting Jan 1, 2027, federal law requires most expansion adults to meet work or community-engagement rules(\. ([A-Z]{2}) is starting early)?\.$/, function (m, x, st) { return "A partir del 1 de enero de 2027, la ley federal exige que la mayoría de los adultos de la ampliación cumplan requisitos de trabajo o servicio comunitario" + (st ? ". " + st + " empieza antes" : "") + "."; }],
    [/^Got it: $/, "Entendido: "],
    [/^\. I found (\d+) programs? that cover it, plus programs that work for any medication\. A few questions so I only show what you can actually get:$/, function (m, n) { return ". Encontré " + n + " programa(s) que lo cubren, además de programas para cualquier medicamento. Unas preguntas para mostrarle solo lo que de verdad puede obtener:"; }],
    [/^Done\. You look eligible for $/, "Listo. Parece que califica para "],
    [/^ options?\. The best ones are at the top\.$/, " opción(es). Las mejores están arriba."],
    [/^Your options for (.+)$/, function (m, d) { return "Sus opciones para " + d; }],
    [/^Income is under the limit of \$([\d,]+) for a household of (\d+)\.$/, function (m, a, n) { return "Su ingreso está por debajo del límite de $" + a + " para un hogar de " + n + "."; }],
    [/^Income \$([\d,]+) is over the limit of \$([\d,]+) for a household of (\d+)\.$/, function (m, a, b, n) { return "Su ingreso de $" + a + " está por encima del límite de $" + b + " para un hogar de " + n + "."; }],
    [/^\$([\d,]+) a year$/, function (m, a) { return "$" + a + " al año"; }],
    [/^(\d+) people in the household$/, function (m, n) { return n + " personas en el hogar"; }],
    [/^1 person in the household$/, "1 persona en el hogar"],
    [/^No insurance$/, "Sin seguro"], [/^Lives in ([A-Z]{2})$/, function (m, s) { return "Vive en " + s; }],
    [/^Checked (\d{4}-\d{2}-\d{2}) · $/, function (m, d) { return "Revisado " + d + " · "; }],
    [/^source (\d)$/, function (m, n) { return "fuente " + n; }],
    [/^ · Call (.+)$/, function (m, p) { return " · Llame al " + p; }]
  ];
  function tr(raw) {
    var t = raw.trim(); if (!t) return null;
    var hit = MAP[t];
    if (hit === undefined && lang === "es") for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(raw)) return raw.replace(RULES[i][0], RULES[i][1]);
      if (RULES[i][0].test(t)) { hit = t.replace(RULES[i][0], RULES[i][1]); break; }
    }
    if (hit === undefined) return null;
    return raw.replace(t, hit);  // keep surrounding spaces
  }
  function skip(el) { return !el || el.closest && el.closest(".msg.me, [data-no-i18n], script, style, textarea, input, select option[data-raw]"); }
  function walk(node) {
    if (lang === "en") return;
    if (node.nodeType === 3) { if (!skip(node.parentElement)) { var n = tr(node.nodeValue); if (n !== null && n !== node.nodeValue) node.nodeValue = n; } return; }
    if (node.nodeType !== 1 || skip(node)) return;
    ["placeholder", "title", "aria-label"].forEach(function (a) { var v = node.getAttribute && node.getAttribute(a); if (v) { var n = tr(v); if (n) node.setAttribute(a, n); } });
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }
  function noteEnglishDetails() {
    var r = document.getElementById("medResults");
    if (r && !r.classList.contains("hidden") && !document.getElementById("esNote") && r.querySelector(".prog")) {
      r.insertAdjacentHTML("afterbegin", "<p id='esNote' class='stale' data-no-i18n>Los pasos para solicitar y las listas de documentos de cada programa aparecen en inglés, tal como los publica cada programa. Puede llamar al programa y pedir ayuda en español.</p>");
    }
  }
  function start() {
    document.documentElement.lang = lang;
    document.documentElement.dir = META.dir || "ltr";
    var hdr = document.querySelector("header nav");
    if (hdr) {
      var sel = document.createElement("select"); sel.className = "lang-select"; sel.setAttribute("data-no-i18n", ""); sel.setAttribute("aria-label", "Language");
      sel.innerHTML = LANGS.map(function (L) { return "<option value='" + L.code + "'" + (L.code === lang ? " selected" : "") + ">" + L.native + "</option>"; }).join("");
      sel.onchange = function () { try { localStorage.setItem("lang", sel.value); localStorage.setItem("cn.lang", sel.value); } catch (e) {} location.reload(); };
      hdr.appendChild(sel);
      var dm = document.createElement("button"); dm.className = "tab mode-toggle"; dm.setAttribute("data-no-i18n", ""); dm.title = "Dark mode"; dm.textContent = "◐";
      dm.onclick = function () { var d = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", d); try { localStorage.setItem("theme", d); } catch (e) {} };
      hdr.appendChild(dm);
    }
    if (lang === "en") return;
    if (META.status === "draft" && typeof I18N_DRAFT_NOTE !== "undefined") {
      var b = document.getElementById("sample-banner");
      if (b) b.insertAdjacentHTML("afterend", "<div class='banner draft-note no-print' data-no-i18n>⚠ " + (I18N_DRAFT_NOTE[lang] || "") +
        " <span class='hint'>(Plan details and program information are shown in English. Spanish is fully translated.)</span></div>");
    }
    var ph = document.getElementById("drugSearch");
    if (ph && lang === "es") ph.placeholder = 'p. ej. "me rompí el brazo y no tengo seguro", "necesito Eliquis" o "me duele mucho una muela"';
    else if (ph && MAP["Tell us what you need help with"]) ph.placeholder = MAP["Tell us what you need help with"];
    walk(document.body);
    new MutationObserver(function (muts) { muts.forEach(function (m) {
      if (m.type === "characterData") walk(m.target); else m.addedNodes.forEach(walk);
    }); if (lang === "es") noteEnglishDetails(); }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  return { lang: lang, tr: tr, start: start, walk: walk };
})();
if (typeof document !== "undefined") {
  try { var th = localStorage.getItem("theme"); if (th) document.documentElement.setAttribute("data-theme", th); } catch (e) {}
  document.addEventListener("DOMContentLoaded", I18N.start);
}
