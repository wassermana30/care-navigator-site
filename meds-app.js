// Medications tab: search -> guided questions -> matched programs -> application summary.

(function () {
  var A = {};          // answers so far
  var history = [];    // for "change an answer"
  var UNDO = [];       // snapshots taken before each answered question (newest last)
  var pending = null;  // snapshot of the question currently on screen
  var CATEGORY = { care: "Free help / your rights", "free-drug": "Free medication", "copay-help": "Copay help (insured)", government: "Government program",
    clinic: "Low-cost clinic", "low-cost": "Lower price", directory: "Search directory" };

  var Q = {
    usResident: { ask: "Do you live in the United States?", type: "choice",
      options: [["Yes", true], ["No", false]] },
    insurance: { ask: "What insurance do you have?", type: "choice",
      options: [["None", "none"], ["Through a job or the marketplace", "commercial"], ["Medicare", "medicare"], ["Medicaid", "medicaid"], ["VA or TRICARE", "va"]] },
    householdSize: { ask: "How many people live in your household? (you, a spouse, and anyone you claim on taxes)", type: "number", min: 1 },
    income: { ask: "What is your household's total income before taxes?", type: "income" },
    state: { ask: "What state do you live in?", type: "state" },
    medicareResources: { ask: "About how much do you have in savings, checking, and investments? Don't count your home or car.", type: "number", min: 0, money: true },
    commercialDenied: { ask: "Has your insurance refused to cover this medication, or is the copay too high to afford?", type: "choice",
      options: [["Refused to cover it", true], ["Covered, but too expensive", false], ["Not sure", "unsure"]] },
    hasPrescriber: { ask: "Do you have a doctor who prescribed it and can sign a form?", type: "choice",
      options: [["Yes", true], ["Not yet", false]] }
  };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };

  var idx = MedsLogic.drugIndex(PROGRAMS);
  $("dbStats").textContent = PROGRAMS.length + " programs and " + idx.length + " brand-name medications in the database. Rules checked against official sources " + PROGRAMS_META.verified + ".";

  // ------------------------------------------------------------ search
  var input = $("drugSearch"), sug = $("drugSuggest");
  function isSentence(v) { return v.trim().split(/\s+/).length >= 5 || /\d/.test(v); }
  // Suggestions while typing: symptoms, conditions and medications (suggest.js), matched to the word being typed.
  var TAG = { symptom: "Symptom", condition: "Condition", medication: "Medication" }, picks = [], hi = -1;
  function hideSug() { sug.classList.add("hidden"); picks = []; hi = -1; }
  function pick(sg) {
    var whole = input.value.trim().toLowerCase();
    // Typing only a medication's name: go straight to medication help.
    if (sg.kind === "medication" && (whole === sg.fragment || sg.insert.toLowerCase().indexOf(whole) === 0)) { hideSug(); return start(sg.brand); }
    input.value = Suggest.apply(input.value, sg) + " ";
    hideSug(); input.focus();
  }
  function showSug() {
    var text = input.value;
    if (!text.trim()) return hideSug();
    var det = CareLogic.detect(text), flag = det.redFlags[0];
    picks = Suggest.suggest(text, 24); hi = -1;
    var cnd = !picks.length && !flag ? CareLogic.primary(det.conditions) : null;
    sug.innerHTML =
      (flag ? "<button class='care-sug' data-act='go'>⚠ Get help now: " + esc(flag.title) + "</button>" : "") +
      picks.map(function (p, i) { return "<button data-i='" + i + "'><span class='sug-tag sug-" + p.kind + "'>" + TAG[p.kind] + "</span> " + esc(p.label) + "</button>"; }).join("") +
      (cnd ? "<button class='care-sug' data-act='go'>Get help with: " + esc(cnd.label) + "</button>" : "") +
      "<button class='other' data-act='go'>" + (isSentence(text) ? "Press Enter and I'll read your whole description" : "Press Enter and I'll look it up") + "</button>";
    sug.classList.remove("hidden");
    sug.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () { if (b.dataset.act === "go") { hideSug(); route(input.value); } else pick(picks[+b.dataset.i]); };
    });
  }
  function highlight() { sug.querySelectorAll("button[data-i]").forEach(function (b) { b.classList.toggle("on", +b.dataset.i === hi); }); }
  input.addEventListener("input", showSug);
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" && picks.length) { e.preventDefault(); hi = Math.min(picks.length - 1, hi + 1); highlight(); return; }
    if (e.key === "ArrowUp" && picks.length) { e.preventDefault(); hi = Math.max(-1, hi - 1); highlight(); return; }
    if (e.key === "Escape") { hideSug(); return; }
    if (e.key !== "Enter") return;
    if (hi >= 0 && picks[hi]) { e.preventDefault(); return pick(picks[hi]); }
    hideSug(); route(input.value);
  });

  var EXAMPLES = ["Ozempic", "Eliquis", "Trulicity",
    "I need Lantus, I make $3,000 a month, family of 3, insurance through my job but they won't cover it",
    "I'm on Medicare, income $1,800 a month, live alone, about $5,000 in savings, need Eliquis",
    "I need Enbrel, I make $1,500 every two weeks, family of 2, no insurance"];

  // Clear everything typed or answered on the Get help tab.
  $("clearHelp").onclick = function () {
    input.value = ""; sug.classList.add("hidden"); sug.innerHTML = "";
    A = {}; C = null; matches = []; history = []; resetUndo();
    ["chatLog", "chatInput", "medResults", "medPacket"].forEach(function (id) { $(id).innerHTML = ""; });
    $("chat").classList.add("hidden"); $("medResults").classList.add("hidden"); $("medPacket").classList.add("hidden");
    input.focus();
  };

  // ------------------------------------------------------------ undo
  function cloneCare(c) { return Object.assign({}, c, { checks: c.checks.slice(), q: c.q.slice(), money: Object.assign({}, c.money), S: c.S ? JSON.parse(JSON.stringify(c.S)) : c.S }); }
  function renderUndo() { $("chatUndo").classList.toggle("hidden", !UNDO.length); }
  function resetUndo() { UNDO = []; pending = null; renderUndo(); }
  function commit(snap) { if (snap) UNDO.push(snap); renderUndo(); }
  function undo() {
    var s = UNDO.pop(); if (!s) return;
    $("chatLog").innerHTML = s.html;
    $("medResults").classList.add("hidden"); $("medResults").innerHTML = "";
    $("medPacket").classList.add("hidden"); $("medPacket").innerHTML = "";
    var fix = $("fixUnderstood");  // the restored HTML lost its click handler
    if (fix) fix.onclick = function () { start(A.drug, A.drugUnknown); };
    if (s.flow === "drug") { A = s.A; ask(); } else { C = s.C; careNext(); }
    renderUndo();
  }
  $("undoBtn").onclick = undo;

  function showChat() {
    sug.classList.add("hidden");
    $("medResults").classList.add("hidden");
    $("medPacket").classList.add("hidden");
    $("chat").classList.remove("hidden");
    $("chatLog").innerHTML = "";
    $("chatInput").innerHTML = "";
  }

  function exampleButtons() {
    $("chatInput").innerHTML = EXAMPLES.map(function (e, i) { return "<button class='ghost ex' data-i='" + i + "'>" + esc(e) + "</button>"; }).join(" ");
    $("chatInput").querySelectorAll(".ex").forEach(function (b) {
      b.onclick = function () { var e = EXAMPLES[+b.dataset.i]; input.value = e; isSentence(e) ? fromSentence(e) : start(e); };
    });
  }

  // Text that isn't a known medication: never pretend it is one.
  function notFound(text) {
    showChat();
    me(text);
    if (!MedsLogic.looksLikeDrug(text)) {
      bot("That doesn't look like a medication name. Type the name of a medication, or describe your situation in a sentence. Try one of these:");
      return exampleButtons();
    }
    var guesses = MedsLogic.didYouMean(text, PROGRAMS);
    if (guesses.length) {
      bot("I couldn't find <b>" + esc(text) + "</b>. Did you mean:");
      $("chatInput").innerHTML = guesses.map(function (d) { return "<button class='ghost dym' data-b='" + esc(d.brand) + "'>" + esc(d.label) + "</button>"; }).join(" ") +
        " <button class='ghost anyway'>No, I meant " + esc(text) + "</button>";
      $("chatInput").querySelectorAll(".dym").forEach(function (b) { b.onclick = function () { start(b.dataset.b); }; });
    } else {
      bot("<b>" + esc(text) + "</b> isn't in our database of " + PROGRAMS.length + " programs yet. I can still check help that works for <i>any</i> medication (government programs, copay charities, discount cards), or you can try another spelling.");
      $("chatInput").innerHTML = "<button class='ghost anyway'>Check general help for " + esc(text) + "</button>";
    }
    $("chatInput").querySelector(".anyway").onclick = function () { start(text, true); };
  }

  function exactDrug(text) {
    var q = MedsLogic.norm(text);
    return MedsLogic.drugIndex(PROGRAMS).filter(function (d) { return d.names.indexOf(q) >= 0; })[0] || null;
  }

  // Decide what kind of request this is: a medication, a symptom/diagnosis, or neither.
  // ------------------------------------------------------------ Claude Sonnet (when serve.py runs with an API key)
  var AI = { on: false, model: null };
  if (/^https?:/.test(location.protocol)) {
    fetch("/api/status").then(function (r) { return r.json(); }).then(function (st) {
      AI.on = !!st.ai; AI.model = st.model;
      $("aiBadge").innerHTML = AI.on ? "<span class='ai-on'>● AI on: Claude Sonnet 5.5 reads what you type</span>" : "<span class='ai-off'>Offline reader (no API key set)</span>";
    }).catch(function () {});
  }

  // Turn Claude's structured reading into the same shapes the offline reader produces.
  function fromAI(u, text) {
    var answers = {}, understood = [];
    var INS = { none: "No insurance", commercial: "Private / job insurance", medicare: "Medicare", medicaid: "Medicaid", va: "VA / TRICARE" };
    if (u.drug) { answers.drug = u.drug; understood.push(["drug", u.drug]); }
    if (u.yearly_income !== null && u.yearly_income !== undefined) { answers.income = u.yearly_income; understood.push(["income", "$" + u.yearly_income.toLocaleString() + " a year"]); }
    if (u.household_size) { answers.householdSize = u.household_size; understood.push(["householdSize", u.household_size + (u.household_size === 1 ? " person" : " people") + " in the household"]); }
    if (u.insurance) { answers.insurance = u.insurance; understood.push(["insurance", INS[u.insurance]]); }
    if (u.us_resident !== null && u.us_resident !== undefined) { answers.usResident = u.us_resident; if (u.us_resident) understood.push(["usResident", "Lives in the US"]); }
    if (u.has_prescriber !== null && u.has_prescriber !== undefined) { answers.hasPrescriber = u.has_prescriber; if (u.has_prescriber) understood.push(["hasPrescriber", "Has a prescribing doctor"]); }
    if (u.insurance_refused_drug !== null && u.insurance_refused_drug !== undefined) { answers.commercialDenied = u.insurance_refused_drug; understood.push(["commercialDenied", u.insurance_refused_drug ? "Insurance won't cover it" : "Covered, but too expensive"]); }
    if (u.state) { answers.state = u.state; answers.usResident = true; understood.push(["state", "Lives in " + u.state]); }
    if (u.savings !== null && u.savings !== undefined) { answers.medicareResources = u.savings; understood.push(["medicareResources", "$" + u.savings.toLocaleString() + " in savings"]); }
    // Safety: warning signs found by the built-in pattern check are ALWAYS kept; Claude can only add more.
    var det = CareLogic.detect(text);
    (u.red_flags || []).forEach(function (id) {
      var f = CARE_RED_FLAGS.filter(function (x) { return x.id === id; })[0];
      if (f && det.redFlags.indexOf(f) < 0) det.redFlags.push(f);
    });
    var c = u.condition_id && CONDITIONS.filter(function (x) { return x.id === u.condition_id; })[0];
    if (c) det.conditions = [c].concat(det.conditions.filter(function (x) { return x !== c; }));
    // Symptoms: keep the built-in reader's, add Claude's (only ids from our list count).
    var sd = SymptomLogic.detect(text);
    (u.symptoms || []).forEach(function (id) { if (SymptomLogic.byId(id) && sd.symptoms.indexOf(id) < 0) sd.symptoms.push(id); });
    if (u.named_condition && SymptomLogic.cond(u.named_condition) && sd.named.indexOf(u.named_condition) < 0) sd.named.push(u.named_condition);
    return { parsed: { answers: answers, understood: understood, notes: [] }, det: det, sd: sd };
  }

  function aiRoute(text) {
    showChat(); me(text);
    bot("<span class='hint thinking'>Reading that with Claude…</span>");
    var ctl = new AbortController(); var timer = setTimeout(function () { ctl.abort(); }, 30000);
    fetch("/api/understand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text }), signal: ctl.signal })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); })
      .then(function (u) {
        clearTimeout(timer);
        var x = fromAI(u, text), careHit = x.det.redFlags.length || (u.condition_id && u.kind !== "medication");
        var reply = u.reply ? "<span class='ai-reply'>" + esc(u.reply) + "</span>" : "";
        if (symptomHit(x.sd) && u.kind !== "medication") return startSymptoms(text, x.parsed, x.det, x.sd, reply);
        if (careHit) return startCare(text, x.parsed, x.det, reply);
        if (u.drug) { start(u.drug, false, x.parsed); if (reply) prependBot(reply); return; }
        if (u.drug_not_in_list) return notFound(u.drug_not_in_list);
        localRoute(text);
      })
      .catch(function (e) {
        clearTimeout(timer);
        localRoute(text);
        prependBot("<span class='hint'>Claude couldn't be reached (" + esc(e.name === "AbortError" ? "timed out" : e.message) + "), so I used the offline reader.</span>");
      });
  }

  function prependBot(html) { $("chatLog").insertAdjacentHTML("afterbegin", "<div class='msg bot'>" + html + "</div>"); }

  // Other parts of the app (site search, the guide) can send a question into Get help.
  window.askGetHelp = function (text) { showView("meds"); input.value = text; sug.classList.add("hidden"); route(text); window.scrollTo(0, 0); };

  function route(raw) {
    var text = String(raw || "").trim();
    if (!text) return;
    // Exact drug names skip the AI round-trip; everything else goes to Claude when it's available.
    if (AI.on && !(exactDrug(text) && !CareLogic.detect(text).conditions.length)) return aiRoute(text);
    localRoute(text);
  }

  function localRoute(raw) {
    var text = String(raw || "").trim();
    if (!text) return;
    var det = CareLogic.detect(text), careHit = det.redFlags.length || det.conditions.length;
    var sd = SymptomLogic.detect(text), symHit = symptomHit(sd);
    var exact = exactDrug(text);
    if (exact && !careHit && !symHit) return start(exact.brand);
    if (symHit) return startSymptoms(text, NLParse.parse(text, PROGRAMS), det, sd);
    if (careHit) return startCare(text, NLParse.parse(text, PROGRAMS), det);
    if (isSentence(text)) return fromSentence(text);
    var hits = MedsLogic.searchDrugs(text, PROGRAMS);
    if (hits.length) return start(hits[0].brand);
    // Short phrases with a drug name inside ("I need Eliquis", "help with ozempick")
    if (NLParse.parse(text, PROGRAMS).answers.drug) return fromSentence(text);
    notFound(text);
  }

  // ------------------------------------------------------------ care flow (symptoms & diagnoses)
  var C = null;
  function srcLink(src) { return src ? " <a class='src-link' href='" + esc(src.url) + "' target='_blank' rel='noopener'>Source: " + esc(src.name) + "</a>" : ""; }
  function emergencyCard(kind, src, id) {
    return kind === "call988"
      ? "<div class='urgent crisis'><b>If you're thinking about suicide or hurting yourself, call or text 988 now.</b> It's free and open 24/7. If you're in immediate danger, call 911." + srcLink(src) + "</div>"
      : "<div class='urgent emergency'><b>If this is happening now, call 911 or go to the nearest emergency room.</b> Emergency rooms must examine and stabilize you even if you can't pay." +
        (id === "stroke" ? " Note the time symptoms started." : "") + srcLink(src) + "</div>";
  }

  function startCare(text, parsed, det, aiReply) {
    showChat(); me(text); resetUndo();
    if (aiReply) bot(aiReply);
    var cond = CareLogic.primary(det.conditions);
    C = { text: text, cond: cond, checks: [], redFlags: det.redFlags, q: [],
      money: { usResident: true, insurance: parsed.answers.insurance, householdSize: parsed.answers.householdSize, income: parsed.answers.income, state: parsed.answers.state },
      drug: parsed.answers.drug };
    det.redFlags.forEach(function (f) { bot(emergencyCard(f.action, f.source, f.id)); });
    if (det.redFlags.length) bot("When you're safe, I can help you figure out where to follow up and how to pay for it.");
    if (cond) {
      var others = det.conditions.filter(function (c) { return c !== cond && c.id !== "general"; });
      bot("It sounds like: <b>" + esc(cond.label) + "</b>" + (others.length ? " (you also mentioned " + others.map(function (c) { return esc(c.label.toLowerCase()); }).join(", ") + ")" : "") +
        ". A few quick questions so I can tell you where to go, who to see, and how to pay for it.<br><span class='hint'>This is guidance on where to get care, not a diagnosis.</span>");
    }
    if (parsed.understood.length) {
      var u = parsed.understood.filter(function (x) { return x[0] !== "drug"; });
      if (u.length) bot("I also picked up: " + u.map(function (x) { return esc(x[1]); }).join(", ") + ".");
    }
    // question queue: warning signs -> diagnosed -> how long -> money (only what's missing)
    (cond ? cond.checks : []).forEach(function (c, i) {
      var k = custom(c.q);
      // "Not sure" on a warning sign counts as yes: when in doubt, get checked.
      C.q.push({ ask: (k && k.q) || c.q, type: "choice", options: k ? k.options.map(function (o) { return [o[0], o[1] === null ? true : o[1]]; }) : [["Yes", true], ["No", false]], set: function (v) { C.checks[i] = v; }, warn: c.ifYes });
    });
    if (cond) {
      C.q.push({ ask: "Has a doctor already diagnosed this?", type: "choice", options: [["Yes, it's diagnosed", true], ["Not yet", false]], set: function (v) { C.diagnosed = v; } });
      C.q.push({ ask: "How long has this been going on?", type: "choice", options: [["It started today", "today"], ["A few days", "days"], ["A week or more", "weeks"]], set: function (v) { C.duration = v; } });
    }
    if (!C.money.insurance) C.q.push({ ask: Q.insurance.ask, type: "choice", options: Q.insurance.options, set: function (v) { C.money.insurance = v; } });
    if (!C.money.householdSize) C.q.push({ ask: Q.householdSize.ask, type: "number", min: 1, set: function (v) { C.money.householdSize = v; } });
    if (C.money.income === undefined) C.q.push({ ask: Q.income.ask, type: "income", set: function (v) { C.money.income = v; } });
    if (!C.money.state) C.q.push({ ask: "What state do you live in? (Medicaid and hospital rules depend on it)", type: "state", set: function (v) { C.money.state = v; } });
    careNext();
  }

  function careNext() {
    var snap = { flow: "care", C: cloneCare(C), html: $("chatLog").innerHTML };
    if (C.S && !C.symDone) {
      var sq = SymptomLogic.next(C.S);
      if (sq) return askSymptom(sq, snap);
      C.symDone = true;
    }
    var q = C.q.shift();
    if (!q) return careFinish();
    bot(esc(q.ask));
    var box = $("chatInput");
    if (q.type === "choice") {
      box.innerHTML = q.options.map(function (o, i) { return "<button class='ghost' data-i='" + i + "'" + (typeof o[1] === "boolean" ? " data-means='" + means(o[1]) + "'" : "") + ">" + esc(o[0]) + "</button>"; }).join(" ");
      box.querySelectorAll("button").forEach(function (b) {
        b.onclick = function () {
          var o = q.options[+b.dataset.i]; commit(snap); me(o[0]); box.innerHTML = ""; q.set(o[1]);
          if (o[1] === true && (q.warn === "emergency" || q.warn === "crisis")) bot(emergencyCard(q.warn === "crisis" ? "call988" : "call911", C.cond && C.cond.source));
          careNext();
        };
      });
    } else if (q.type === "state") {
      box.innerHTML = "<select id='qIn'>" + "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ").map(function (x) { return "<option>" + x + "</option>"; }).join("") + "</select> <button class='primary' id='qGo'>OK</button>";
      $("qGo").onclick = function () { var v = $("qIn").value; commit(snap); me(v); box.innerHTML = ""; q.set(v); careNext(); };
    } else if (q.type === "number") {
      box.innerHTML = "<input id='qIn' type='number' min='" + q.min + "' style='width:180px'> <button class='primary' id='qGo'>OK</button>";
      $("qGo").onclick = function () { var v = Number($("qIn").value); if ($("qIn").value === "" || v < q.min) return; commit(snap); me(String(v)); box.innerHTML = ""; q.set(v); careNext(); };
    } else {
      box.innerHTML = "<input id='qIn' type='number' min='0' placeholder='Amount' style='width:150px'> <select id='qFreq'><option value='1'>per year</option><option value='12'>per month</option><option value='26'>every 2 weeks</option><option value='52'>per week</option></select> <button class='primary' id='qGo'>OK</button>";
      $("qGo").onclick = function () { if ($("qIn").value === "") return; var y = Math.round(Number($("qIn").value) * Number($("qFreq").value)); commit(snap); me("$" + y.toLocaleString() + " a year"); box.innerHTML = ""; q.set(y); careNext(); };
    }
    var f = box.querySelector("input"); if (f) { f.focus(); f.onkeydown = function (e) { if (e.key === "Enter") $("qGo").click(); }; }
  }

  // ------------------------------------------------------------ symptom checker
  function symptomHit(sd) { return sd.symptoms.filter(function (id) { return id !== "child"; }).length > 0 || sd.named.length > 0; }
  function symName(id) { return id.replace(/-/g, " "); }

  function startSymptoms(text, parsed, det, sd, aiReply) {
    showChat(); me(text); resetUndo();
    if (aiReply) bot(aiReply);
    C = { text: text, S: SymptomLogic.newState(sd), cond: CareLogic.primary(det.conditions), checks: [], redFlags: det.redFlags, q: [],
      money: { usResident: true, insurance: parsed.answers.insurance, householdSize: parsed.answers.householdSize, income: parsed.answers.income, state: parsed.answers.state },
      drug: parsed.answers.drug };
    det.redFlags.forEach(function (f) { bot(emergencyCard(f.action, f.source, f.id)); });
    if (det.redFlags.length) bot("When you're safe, I can help you figure out what might be going on and how to pay for care.");
    var heard = sd.symptoms.filter(function (id) { return id !== "child"; }).map(symName);
    var named = sd.named.map(function (id) { return SymptomLogic.cond(id).label; });
    bot((heard.length ? "I heard: <b>" + heard.map(esc).join(", ") + "</b>. " : "") + (named.length ? "You mentioned <b>" + named.map(esc).join(", ") + "</b>. " : "") +
      "I'll ask a few quick questions to narrow down what could be causing this, then give you a plan." +
      "<br><span class='hint'>I'm not a doctor and this isn't a diagnosis. Only a doctor or nurse can tell you for sure.</span>");
    if (parsed.understood.length) {
      var u = parsed.understood.filter(function (x) { return x[0] !== "drug"; });
      if (u.length) bot("I also picked up: " + u.map(function (x) { return esc(x[1]); }).join(", ") + ".");
    }
    C.q.push({ ask: "How long has this been going on?", type: "choice", options: [["It started today", "today"], ["A few days", "days"], ["A week or more", "weeks"]], set: function (v) { C.duration = v; } });
    if (!C.money.insurance) C.q.push({ ask: Q.insurance.ask, type: "choice", options: Q.insurance.options, set: function (v) { C.money.insurance = v; } });
    if (!C.money.householdSize) C.q.push({ ask: Q.householdSize.ask, type: "number", min: 1, set: function (v) { C.money.householdSize = v; } });
    if (C.money.income === undefined) C.q.push({ ask: Q.income.ask, type: "income", set: function (v) { C.money.income = v; } });
    if (!C.money.state) C.q.push({ ask: "What state do you live in? (Medicaid and hospital rules depend on it)", type: "state", set: function (v) { C.money.state = v; } });
    careNext();
  }

  // Questions that aren't plain yes/no get their own answer buttons (question-options.js). Each still maps to yes/no/not sure.
  var YES_NO = [["Yes", true], ["No", false], ["Not sure", null]];
  function custom(q) { return typeof QUESTION_OPTIONS !== "undefined" ? QUESTION_OPTIONS[q] : null; }
  function means(v) { return v === true ? "yes" : v === false ? "no" : "unsure"; }

  function askSymptom(sq, snap) {
    var c = custom(sq.ask);
    bot(esc((c && c.q) || sq.ask));
    var box = $("chatInput"), opts = c ? c.options : YES_NO;
    box.innerHTML = opts.map(function (o, i) { return "<button class='ghost' data-i='" + i + "' data-means='" + means(o[1]) + "'>" + esc(o[0]) + "</button>"; }).join(" ");
    box.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        var o = opts[+b.dataset.i]; commit(snap); me(o[0]); box.innerHTML = "";
        SymptomLogic.answer(C.S, sq, o[1]);
        if (o[1] === true && sq.kind === "flag" && (sq.ifYes === "emergency" || sq.ifYes === "crisis")) bot(emergencyCard(sq.ifYes === "crisis" ? "call988" : "call911", SymptomLogic.cond(sq.key.split(":")[0]).source));
        careNext();
      };
    });
  }

  // Turn the symptom checker's result into the same plan shape the care flow shows.
  function symptomPlan(plan) {
    var res = SymptomLogic.result(C.S, C.duration), top = res.top, u = res.urgency;
    (C.redFlags || []).forEach(function (f) { u = SymptomLogic.RANK[f.action === "call988" ? "crisis" : "emergency"] > SymptomLogic.RANK[u] ? (f.action === "call988" ? "crisis" : "emergency") : u; });
    var said = Object.keys(C.S.known).filter(function (k) { return C.S.known[k] === true && k !== "child"; }).map(symName);
    var where = (u === "crisis" || u === "emergency") ? URGENCY[u].where : top ? top.where : "A primary care provider or a community health center (they charge based on income).";
    var steps = [];
    if (u === "crisis" || u === "emergency") steps.push(URGENCY[u].where);
    else steps.push((u === "today" ? "Get checked today: " : "Get checked: ") + where);
    steps.push("Tell them your symptoms" + (said.length ? " (" + said.join(", ") + ")" : "") + ", when they started, and what makes them better or worse." +
      (top ? " Ask: \"Could this be " + top.label.toLowerCase() + "?\"" : ""));
    if (top && top.seeDoctorIf && top.seeDoctorIf.length) steps.push("Go sooner if: " + top.seeDoctorIf.map(function (x) { return x.replace(/\.$/, ""); }).join("; ") + ".");
    steps.push("Only a doctor can confirm what this is. Ask what tests you need, and what they cost, before they're done.");
    return Object.assign(plan, {
      urgency: u, urgencyInfo: URGENCY[u], where: where, who: top && top.who && top.who.length ? top.who : ["Primary care provider or community health center"],
      steps: steps, meanwhile: (u === "crisis" || u === "emergency") ? [] : (top && top.selfCare) || [], source: top && top.source,
      hospitalBill: plan.hospitalBill || u === "emergency" || u === "today", sym: res
    });
  }

  function causesHtml(res) {
    if (!res.causes.length) return "<div class='card'><h3>What it could be</h3><p>I couldn't narrow it down from what you told me. That doesn't mean it's nothing. A primary care provider or health center can figure it out.</p></div>";
    return "<div class='card causes'><h3>What it could be</h3>" +
      "<p class='hint'><b>This is not a diagnosis.</b> These are possible causes that match what you told me. Only a doctor or nurse can tell you what you have, so use this to know what to ask.</p>" +
      res.causes.map(function (x) {
        return "<div class='cause'><span class='pill " + (x.level === "Best match" ? "yes" : "maybe") + "'>" + x.level + "</span> <b>" + esc(x.cond.label) + "</b>" +
          "<p>" + esc(x.cond.plain) + "</p>" + srcLink(x.cond.source) + " <span class='hint'>· checked " + esc(x.cond.checked || "") + "</span></div>";
      }).join("") +
      (res.why.length ? "<p class='hint'>Why this urgency: " + res.why.map(esc).join(" ") + "</p>" : "") + "</div>";
  }

  function careFinish() {
    if (C.S) {
      var top0 = SymptomLogic.result(C.S, C.duration).top;
      var base = top0 ? CONDITIONS.filter(function (c) { return c.id === top0.careCategory; })[0] || C.cond : C.cond;
      C.cond = base;
    }
    var plan = CareLogic.plan(C.cond, { checks: C.checks, diagnosed: C.diagnosed, duration: C.duration, redFlags: C.redFlags, money: C.money }, PROGRAMS, NAV_CONFIG);
    $("chatInput").innerHTML = "<button class='ghost' id='restart'>Start over</button>";
    $("restart").onclick = function () { route(C.text); };
    if (C.S) plan = symptomPlan(plan);
    bot("Here's your plan.");
    matches = plan.programs;
    var cls = { crisis: "crisis", emergency: "emergency", today: "today", soon: "soon", routine: "soon" }[plan.urgency];
    var out = $("medResults");
    out.innerHTML =
      "<div class='urgent " + cls + " big-urgent'><div class='u-label'>" + esc(plan.urgencyInfo.label) + "</div>" + esc(plan.where) + "</div>" +
      (plan.sym ? causesHtml(plan.sym) : "") +
      "<div class='care-grid'>" +
        "<div class='card'><h3>Who to see</h3><ul class='list'>" + plan.who.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul></div>" +
        "<div class='card'><h3>Your plan of action</h3><ol class='list'>" + plan.steps.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" +
        "<p class='hint'>" + (plan.sym ? "Not a diagnosis. Questions and advice based on the official pages linked above." : plan.source ? "Warning-sign questions based on " + srcLink(plan.source).replace("Source: ", "") + "." : "Warning-sign questions are general safety checks. When in doubt, call your doctor or 911.") + "</p>" +
        (plan.meanwhile.length ? "<h4>In the meantime</h4><ul class='list'>" + plan.meanwhile.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul><p class='hint'>General first-aid guidance, not a diagnosis. If you're unsure, get checked.</p>" : "") + "</div>" +
      "</div>" +
      "<h2 class='pay-h'>How to pay for it if you can't afford it</h2>" +
      (plan.hospitalBill ? "<div class='card prog likely'><div class='prog-head'><div><div class='hint'>Hospital financial assistance · nonprofit hospitals</div><h3>Ask the hospital for financial assistance (501(r))</h3></div><span class='pill yes'>Use our tool</span></div>" +
        "<p>Nonprofit hospitals must have a financial assistance policy, and many patients qualify for free or discounted care. You can apply before or after you get the bill.</p>" +
        "<button class='primary' id='go501r'>Check what I'd qualify for</button></div>" : "") +
      plan.programs.map(card).join("") +
      (plan.drugs.length || C.drug ? "<div class='card'><h3>Need help paying for a medicine?</h3><p class='hint'>Medicines often used for this. Tap one to check free programs. Your answers carry over.</p>" +
        (C.drug ? [C.drug] : []).concat(plan.drugs.filter(function (d) { return d !== C.drug; })).map(function (d) { return "<button class='ghost drugchip' data-d='" + esc(d) + "'>" + esc(d) + "</button>"; }).join(" ") + "</div>" : "");
    out.insertAdjacentHTML("beforeend", "<div class='row-actions'>" + planButton("planCare") +
      (plan.urgency !== "emergency" && plan.urgency !== "crisis" ? "<button class='ghost' id='careFindClinic'>Find a low-cost clinic near me</button>" : "") + "</div>");
    out.insertAdjacentHTML("beforeend", Share.bar("shareCare"));
    wirePlanButton("planCare", function () {
      return { kind: "Care plan", title: (plan.sym && plan.sym.top ? "Possible " + plan.sym.top.label.toLowerCase() : C.cond ? C.cond.label : "Health problem") + ": " + plan.urgencyInfo.label.toLowerCase(),
        summary: plan.where, steps: plan.steps,
        links: plan.programs.slice(0, 5).filter(function (m) { return m.program.applyUrl; }).map(function (m) { return { label: m.program.program, url: m.program.applyUrl }; }) };
    });
    var fc = $("careFindClinic"); if (fc) fc.onclick = function () { findCareFor(""); };
    out.insertAdjacentHTML("beforeend", helpfulBox("fbCare")); wireHelpful("fbCare", plan.sym ? "Get help: symptoms" : "Get help: care plan");
    out.classList.remove("hidden");
    wireWorksheets(out);
    Share.wire("shareCare", function () {
      return Share.planText((plan.sym ? "Your symptoms" : C.cond ? C.cond.label : "Your health problem") + ": your plan", [
        { heading: plan.urgencyInfo.label, items: [plan.where] }].concat(plan.sym && plan.sym.causes.length ? [{ heading: "Possible causes (not a diagnosis)", items: plan.sym.causes.map(function (x) { return x.level + ": " + x.cond.label; }) }] : []).concat([
        { heading: "Who to see", items: plan.who },
        { heading: "Plan of action", numbered: true, items: plan.steps },
        { heading: "How to pay for it", items: (plan.hospitalBill ? ["Ask the hospital for financial assistance (nonprofit hospitals must have a policy)."] : []).concat(plan.programs.map(function (m) {
          return m.program.program + (m.program.phone ? " (" + m.program.phone + ")" : "") + (m.program.applyUrl ? " " + m.program.applyUrl : "");
        })) }]));
    }, "My care plan: " + (C.cond ? C.cond.label : "health problem"));
    out.querySelectorAll(".drugchip").forEach(function (b) {
      b.onclick = function () { input.value = b.dataset.d; start(b.dataset.d, false, { answers: Object.assign({ drug: b.dataset.d }, C.money), understood: [], notes: [] }); window.scrollTo(0, 0); };
    });
    var g = $("go501r"); if (g) g.onclick = function () { open501r(); };
    out.scrollIntoView({ behavior: "smooth" });
  }

  // Jump to the hospital-bill tool with the answers we already have.
  function open501r() {
    document.querySelector('.tab[data-view="patient"]').click();
    // Care already happened (or is happening): start on "I already have a bill". The person can switch to "coming up".
    var r = document.querySelector("input[name=timing][value=after]"); if (r) { r.checked = true; if (r.onchange) r.onchange(); }
    if (C.money.insurance) $("insurance").value = { none: "none", commercial: "private", medicare: "medicare", medicaid: "medicaid", va: "private" }[C.money.insurance] || "none";
    if (C.money.householdSize) $("householdSize").value = C.money.householdSize;
    if (C.money.income !== undefined) {
      $("incomeRows").innerHTML = ""; addIncomeRow({ kind: "wages", amount: C.money.income, freq: "annual" });
    }
    window.scrollTo(0, 0);
  }

  // Plain-English description: pull out what it clearly says, then ask only what's missing.
  function fromSentence(text) {
    var r = NLParse.parse(text, PROGRAMS);
    if (!r.answers.drug) {
      showChat();
      me(text);
      bot("I couldn't find a medication name in that" + (r.understood.length ? ", though I did catch: " + r.understood.map(function (u) { return esc(u[1]); }).join(", ") : "") +
        ". Include the medication's name, like one of these examples:");
      return exampleButtons();
    }
    start(r.answers.drug, false, r);
    input.value = text;
  }

  function start(drug, unknown, parsed) {
    sug.classList.add("hidden");
    input.value = drug;
    A = { drug: drug, drugUnknown: !!unknown }; resetUndo();
    if (parsed) Object.keys(parsed.answers).forEach(function (k) { if (k !== "drug") A[k] = parsed.answers[k]; });
    history = [];
    $("chatLog").innerHTML = "";
    $("medResults").classList.add("hidden");
    $("medPacket").classList.add("hidden");
    $("chat").classList.remove("hidden");
    var own = PROGRAMS.filter(function (p) { return MedsLogic.coversDrug(p, drug); });
    var excl = PROGRAMS.filter(function (p) { return MedsLogic.excludesDrug(p, drug); });
    if (!unknown && !own.length && excl.length) bot("Heads up: <b>" + esc(drug) + "</b> is not covered by " + excl.map(function (p) { return esc(p.sponsor); }).join(", ") + "'s free-medicine program right now. I'll check every other option.");
    bot(unknown
      ? "I don't have a drug company program for <b>" + esc(drug) + "</b> in my database yet. I'll still check the programs that work for any medication and point you to a directory that lists more. A few questions:"
      : !own.length ? "A few questions so I can find what else might help:" : "Got it: <b>" + esc(drug) + "</b>. I found " + own.length + " program" + (own.length === 1 ? "" : "s") + " that cover it, plus programs that work for any medication. A few questions so I only show what you can actually get:");
    if (parsed && parsed.understood.length > 1) {
      bot("Here's what I understood from your description:<ul class='list'>" + parsed.understood.map(function (u) { return "<li>" + esc(u[1]) + "</li>"; }).join("") + "</ul>" +
        (parsed.notes.length ? "<span class='hint'>" + parsed.notes.map(esc).join(" ") + "</span><br>" : "") +
        "<button class='ghost' id='fixUnderstood'>Something's wrong, ask me everything</button>");
      $("fixUnderstood").onclick = function () { start(drug, unknown); };
    }
    ask();
  }

  // ------------------------------------------------------------ chat
  function bot(html) { $("chatLog").insertAdjacentHTML("beforeend", "<div class='msg bot'>" + html + "</div>"); }
  function me(text) { $("chatLog").insertAdjacentHTML("beforeend", "<div class='msg me'>" + esc(text) + "</div>"); }

  function ask() {
    pending = { flow: "drug", A: JSON.parse(JSON.stringify(A)), html: $("chatLog").innerHTML };
    var key = MedsLogic.nextQuestion(A, PROGRAMS);
    if (!key) return finish();
    var q = Q[key], box = $("chatInput");
    bot(esc(q.ask));
    if (q.type === "choice") {
      box.innerHTML = q.options.map(function (o, i) { return "<button class='ghost' data-i='" + i + "'" + (typeof o[1] === "boolean" ? " data-means='" + means(o[1]) + "'" : "") + ">" + esc(o[0]) + "</button>"; }).join(" ");
      box.querySelectorAll("button").forEach(function (b) {
        b.onclick = function () { var o = q.options[+b.dataset.i]; answer(key, o[1] === "unsure" ? null : o[1], o[0]); };
      });
    } else if (q.type === "number") {
      box.innerHTML = "<input id='qIn' type='number' min='" + q.min + "' style='width:180px'> <button class='primary' id='qGo'>OK</button>";
      $("qGo").onclick = function () {
        var v = Number($("qIn").value);
        if ($("qIn").value === "" || v < q.min) return;
        answer(key, v, q.money ? "$" + v.toLocaleString() : String(v));
      };
    } else if (q.type === "income") {
      box.innerHTML = "<input id='qIn' type='number' min='0' placeholder='Amount' style='width:150px'> " +
        "<select id='qFreq'><option value='1'>per year</option><option value='12'>per month</option><option value='26'>every 2 weeks</option><option value='52'>per week</option></select> " +
        "<button class='primary' id='qGo'>OK</button>";
      $("qGo").onclick = function () {
        if ($("qIn").value === "") return;
        var yearly = Math.round(Number($("qIn").value) * Number($("qFreq").value));
        answer("income", yearly, "$" + yearly.toLocaleString() + " a year");
      };
    } else if (q.type === "state") {
      box.innerHTML = "<select id='qIn'>" + "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ").map(function (s) { return "<option>" + s + "</option>"; }).join("") + "</select> <button class='primary' id='qGo'>OK</button>";
      $("qGo").onclick = function () { answer("state", $("qIn").value, $("qIn").value); };
    }
    var f = box.querySelector("input"); if (f) { f.focus(); f.onkeydown = function (e) { if (e.key === "Enter") $("qGo").click(); }; }
  }

  function answer(key, value, label) {
    commit(pending);
    me(label);
    history.push(key);
    A[key] = value === null ? "unsure" : value;
    $("chatInput").innerHTML = "";
    ask();
  }

  // ------------------------------------------------------------ results
  var matches = [];
  function finish() {
    $("chatInput").innerHTML = "<button class='ghost' id='restart'>Start over</button>";
    $("restart").onclick = function () { start(A.drug, A.drugUnknown); };
    var ans = Object.assign({}, A, { commercialDenied: A.commercialDenied === "unsure" ? undefined : A.commercialDenied });
    matches = MedsLogic.match(ans, PROGRAMS.filter(function (p) { return !p.careOnly; }), NAV_CONFIG);
    var likely = matches.filter(function (m) { return m.status === "likely"; }).length;
    bot("Done. " + (likely ? "You look eligible for <b>" + likely + "</b> option" + (likely === 1 ? "" : "s") + ". The best ones are at the top." : "I didn't find a program you clearly qualify for, but there are options to check below."));
    renderResults();
  }

  function card(m, i) {
    var p = m.program;
    var pill = { likely: ["yes", "Likely eligible"], maybe: ["check", "Maybe, check"], no: ["no", "Not eligible"] }[m.status];
    return "<div class='card prog " + m.status + "'>" +
      "<div class='prog-head'><div><div class='hint'>" + esc(CATEGORY[p.category] || p.category) + " · " + esc(p.sponsor) + "</div>" +
      "<h3>" + esc(p.program) + "</h3></div><span class='pill " + pill[0] + "'>" + pill[1] + "</span></div>" +
      (p.summary ? "<p>" + esc(p.summary) + "</p>" : "") +
      "<ul class='list why'>" + m.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>" +
      (m.status === "no" ? "" :
        "<details" + (i === 0 ? " open" : "") + "><summary>What you'll need and how to apply</summary>" +
        (p.documents && p.documents.length ? "<h4>What you'll need</h4><ul class='list'>" + p.documents.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul>" : "") +
        (p.howToApply && p.howToApply.length ? "<h4>How to apply</h4><ol class='list'>" + p.howToApply.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ol>" : "") +
        "<p>" + (p.applyUrl ? "<a href='" + esc(p.applyUrl) + "' target='_blank' rel='noopener'>Apply / official page ↗</a>" : "") + (p.phone ? " · Call " + esc(p.phone) : "") + "</p>" +
        (p.patientNote ? "<p class='hint'>Note: " + esc(p.patientNote) + "</p>" : "") +
        (p.howToApply && p.howToApply.length && !FormFill.FORMS[p.id] && p.category !== "care" ? "<button class='ghost ws' data-p='" + esc(p.id) + "'>Print a pre-filled worksheet</button>" : "") +
        "</details>") +
      Share.freshness(p) +
      "<p class='hint src'>Checked " + esc(p.verified) + " · " + (p.sources || []).slice(0, 3).map(function (s, j) { return "<a href='" + esc(s) + "' target='_blank' rel='noopener'>source " + (j + 1) + "</a>"; }).join(", ") + "</p>" +
      "</div>";
  }

  function wireWorksheets(root) {
    root.querySelectorAll(".ws").forEach(function (b) {
      b.onclick = function () {
        var p = PROGRAMS.filter(function (x) { return x.id === b.dataset.p; })[0];
        var ans = C && C.money && !A.drug ? Object.assign({}, C.money) : A;
        var pct = ans.householdSize && ans.income !== undefined ? Math.round(ans.income / MedsLogic.fpl(ans.householdSize, NAV_CONFIG) * 100) : null;
        Share.worksheet(p, ans, pct);
      };
    });
  }

  function renderResults() {
    var out = $("medResults");
    var ok = matches.filter(function (m) { return m.status !== "no"; });
    var no = matches.filter(function (m) { return m.status === "no"; });
    out.innerHTML = "<div class='res-head'><h2>Your options for " + esc(A.drug) + "</h2>" +
      (ok.length ? "<button class='primary' id='buildPacket'>Build my application summary</button>" : "") + "</div>" +
      ok.map(card).join("") +
      (A.drugUnknown || !ok.some(function (m) { return m.program.category === "free-drug"; })
        ? "<div class='card'><h3>Search more programs for " + esc(A.drug) + "</h3><p>These free directories list programs we don't cover yet: " +
          "<a target='_blank' rel='noopener' href='https://www.needymeds.org/'>NeedyMeds</a> and " +
                    "<a target='_blank' rel='noopener' href='https://www.rxassist.org/patients'>RxAssist</a>. NeedyMeds also has a free helpline: 1-800-503-6897.</p></div>" : "") +
      (no.length ? "<h3 class='muted-h'>Why not these?</h3>" + no.map(card).join("") : "");
    out.insertAdjacentHTML("beforeend", "<div class='row-actions'>" + planButton("planDrug") + "</div>");
    out.insertAdjacentHTML("beforeend", Share.bar("shareDrug"));
    out.insertAdjacentHTML("beforeend", helpfulBox("fbDrug")); wireHelpful("fbDrug", "Get help: medication");
    wirePlanButton("planDrug", function () {
      var docs = [];
      ok.forEach(function (m) { (m.program.documents || []).forEach(function (d) { if (docs.indexOf(d) < 0) docs.push(d); }); });
      return { kind: "Medication help", title: "Paying for " + A.drug, summary: ok.length + " program" + (ok.length === 1 ? "" : "s") + " to apply to.",
        steps: ok.map(function (m) { return "Apply to " + m.program.program + (m.program.phone ? " (" + m.program.phone + ")" : ""); }), docs: docs.slice(0, 10),
        links: ok.filter(function (m) { return m.program.applyUrl; }).map(function (m) { return { label: m.program.program, url: m.program.applyUrl }; }) };
    });
    out.classList.remove("hidden");
    wireWorksheets(out);
    Share.wire("shareDrug", function () {
      return Share.planText("Your options for " + A.drug, [{ heading: "Programs to apply to", numbered: true, items: ok.map(function (m) {
        return m.program.program + (m.program.phone ? " (" + m.program.phone + ")" : "") + (m.program.applyUrl ? " " + m.program.applyUrl : "");
      }) }]);
    }, "My medication help plan: " + A.drug);
    var b = $("buildPacket"); if (b) b.onclick = renderPacket;
    out.scrollIntoView({ behavior: "smooth" });
  }

  // ------------------------------------------------------------ application summary
  function renderPacket() {
    var ok = matches.filter(function (m) { return m.status !== "no"; });
    var docs = {};
    ok.forEach(function (m) { (m.program.documents || []).forEach(function (d) { (docs[d] = docs[d] || []).push(m.program.program); }); });
    var insLabel = { none: "Uninsured", commercial: "Private (job / marketplace)", medicare: "Medicare", medicaid: "Medicaid", va: "VA / TRICARE" }[A.insurance] || "";
    var pct = A.householdSize && A.income !== undefined ? Math.round(A.income / MedsLogic.fpl(A.householdSize, NAV_CONFIG) * 100) : null;
    var rows = [["Medication", A.drug], ["Household size", A.householdSize], ["Household income (yearly)", A.income !== undefined ? "$" + A.income.toLocaleString() : ""],
      ["% of 2026 federal poverty guideline", pct !== null ? pct + "%" : ""], ["Insurance", insLabel], ["State", A.state || ""], ["US resident", A.usResident ? "Yes" : "No"]];
    var el = $("medPacket");
    el.innerHTML = "<div class='card letter'>" +
      "<h2>Application summary: " + esc(A.drug) + "</h2>" +
      "<p class='hint'>These answers go in the patient section of every application below, so you only gather them once. Your doctor still fills in and signs the prescriber section.</p>" +
      "<table>" + rows.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</table>" +
      "<h3>Apply to, in this order</h3><ol class='list'>" + ok.map(function (m) { return "<li><b>" + esc(m.program.program) + "</b>" + (m.program.applyUrl ? ": " + esc(m.program.applyUrl) : "") + (m.program.phone ? " · " + esc(m.program.phone) : "") + "</li>"; }).join("") + "</ol>" +
      "<h3>Documents to gather</h3><ul class='list'>" + Object.keys(docs).map(function (d) { return "<li>☐ " + esc(d) + " <span class='hint'>(" + docs[d].length + " program" + (docs[d].length > 1 ? "s" : "") + ")</span></li>"; }).join("") + "</ul>" +
      "</div><div class='actions no-print'><button class='ghost' onclick='window.print()'>Print / save as PDF</button></div>" +
      ok.filter(function (m) { return FormFill.available(m.program.id, A.drug); }).map(function (m) { return officialFormBox(m.program); }).join("");
    el.classList.remove("hidden");
    el.querySelectorAll(".official").forEach(wireOfficial);
    el.scrollIntoView({ behavior: "smooth" });
  }

  // ------------------------------------------------------------ official application auto-fill
  function officialFormBox(p) {
    var f = FormFill.FORMS[p.id];
    var inp = function (id, label, val, w) { return "<label style='flex:" + (w || 1) + "'>" + label + "<input data-k='" + id + "' value='" + esc(val || "") + "'></label>"; };
    return "<div class='card official no-print' data-p='" + esc(p.id) + "' style='margin-top:14px'>" +
      "<h3>Fill out the official application</h3><p class='hint'>" + esc(f.title) + ". Your answers above are already included. Add the details below and I'll fill in the real form. " +
      "Nothing is sent anywhere. The PDF is made in your browser.</p>" +
      "<div class='row'>" + inp("firstName", "First name") + inp("middleInitial", "M.I.", "", .3) + inp("lastName", "Last name") + "</div>" +
      "<div class='row'>" + inp("dob", "Date of birth (MM/DD/YYYY)") + inp("phone", "Phone") + inp("email", "Email") + "</div>" +
      "<div class='row'>" + inp("address", "Street address (no P.O. box)", "", 2) + inp("city", "City") + inp("state", "State", A.state) + inp("zip", "ZIP", "", .6) + "</div>" +
      "<div class='row'><label style='flex:1'>Preferred language<select data-k='language'><option value='en'>English</option><option value='es'>Spanish</option><option value=''>Other</option></select></label></div>" +
      "<button class='primary make'>Create my filled application (PDF)</button> <span class='out'></span></div>";
  }

  function wireOfficial(box) {
    box.querySelector(".make").onclick = function () {
      var v = {}; box.querySelectorAll("[data-k]").forEach(function (i) { v[i.dataset.k] = i.value.trim(); });
      var dob = (v.dob || "").split("/");
      var person = { firstName: v.firstName, lastName: v.lastName, middleInitial: v.middleInitial, address: v.address, city: v.city,
        state: v.state, zip: v.zip, phone: v.phone, email: v.email, dobMM: dob[0], dobDD: dob[1], dobYYYY: dob[2], language: v.language,
        householdSize: A.householdSize, income: A.income, insurance: A.insurance, usResident: A.usResident };
      var out = box.querySelector(".out"); out.textContent = "Filling…";
      FormFill.fill(box.dataset.p, person).then(function (r) {
        var url = URL.createObjectURL(new Blob([r.bytes], { type: "application/pdf" }));
        out.innerHTML = "<a class='primary-link' href='" + url + "' download='Amgen-Enbrel-application-filled.pdf'>Download filled application</a> · filled " + r.filled.length + " fields";
        box.insertAdjacentHTML("beforeend", "<div class='still'><h4>You still need to</h4><ol class='list'>" +
          "<li>Sign and date the Patient Authorization and the Patient Certification pages, and choose a consent option.</li>" +
          "<li>Check the insurance boxes. Medicare patients pick their Medicare parts; I left those blank.</li>" +
          "<li>Ask your doctor to send the prescription electronically to Transition Pharmacy (the form lists the details).</li>" +
          "<li>Fax or mail the signed pages to the address and fax number on the form, or call 1-800-932-3060.</li></ol>" +
          (r.skipped.length ? "<p class='hint'>Left blank because you didn't enter them: " + esc(r.skipped.join(", ")) + ".</p>" : "") + "</div>");
        box.querySelector(".make").disabled = true;
      }).catch(function (e) { out.textContent = "Couldn't fill the form: " + e.message; });
    };
  }

  // ------------------------------------------------------------ compare tab
  window.renderCompare = function () {
    var mtx = MedsLogic.requirementMatrix(PROGRAMS.filter(function (p) { return p.category === "free-drug"; }));
    var counts = mtx.columns.map(function (_, j) { return mtx.rows.filter(function (r) { return r.has[j]; }).length; });
    $("commonSummary").innerHTML = mtx.columns.slice(0, 4).map(function (c, j) {
      return "<div class='stat'><div class='k'>" + esc(c) + "</div><div class='v'>" + counts[j] + "/" + mtx.rows.length + "</div><div class='hint'>programs ask for it</div></div>";
    }).join("");
    $("compareTable").innerHTML = "<thead><tr><th>Program</th><th>Income limit</th><th>Uninsured</th><th>Private ins.</th><th>Medicare</th><th>Medicaid</th>" +
      mtx.columns.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      mtx.rows.map(function (r) {
        var p = r.program, ins = (p.rules && p.rules.insurance) || {};
        var mark = function (v) { return v === "yes" ? "✓" : v === "maybe" ? "~" : v === "no" ? "✗" : "?"; };
        return "<tr><td><b>" + esc(p.program) + "</b><div class='hint'>" + esc(CATEGORY[p.category] || "") + "</div></td>" +
          "<td>" + (p.rules && p.rules.maxPctFPL ? p.rules.maxPctFPL + "% FPL" : esc((p.rules && p.rules.incomeText) || "—")) + "</td>" +
          ["none", "commercial", "medicare", "medicaid"].map(function (k) { return "<td class='c'>" + mark(ins[k]) + "</td>"; }).join("") +
          r.has.map(function (h) { return "<td class='c'>" + (h ? "●" : "") + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody>";
  };
})();
