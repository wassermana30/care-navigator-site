// "Ask for guidance": a small chat that tells people where to go in the app based on what they need.
// Built-in guide everywhere (emergencies first, then symptoms, medicines, bills, coverage, clinics).
// When the app runs with serve.py and an API key, Claude answers instead (/api/assistant), falling back to the built-in guide.

var Guide = (function () {
  var ACT = {
    symptoms: "Check my symptoms", medication: "Help paying for a medicine", hospital_bill: "Get help with a hospital bill",
    fight_bill: "Fight a bill", coverage: "Find health coverage", find_care: "Find a clinic near me", my_plan: "Open My plan",
    talk_to_person: "Talk to a person", call_911: "Call 911", call_988: "Call or text 988"
  };
  function a(type, query, label) { return { type: type, label: label || ACT[type], query: query || null }; }
  var RULES = [
    [/\b(bill|charged|charge|invoice|owe)\b.*\b(wrong|mistake|error|don'?t (recognize|understand)|itemi[sz]ed)\b|\bitemi[sz]ed\b/i, "Let's check that bill for mistakes. You have a right to an itemized bill.", ["fight_bill"]],
    [/collections?|debt collector|credit (report|score)|sued|lawsuit|garnish/i, "If a medical bill is in collections, you still have rights, and you may still qualify for financial help.", ["fight_bill", "hospital_bill"]],
    [/surprise|out[- ]of[- ]network|estimate|good faith/i, "Surprise bills and bills far above an estimate can often be disputed.", ["fight_bill"]],
    [/hospital|er bill|emergency room bill|surgery|operation|\bbill\b|can'?t (afford|pay)/i, "Hospitals often give free or discounted care to people who can't afford it, even after the bill.", ["hospital_bill", "fight_bill"]],
    [/insurance|insured|medicaid|medi-?cal|chip|marketplace|obamacare|coverage|medicare/i, "Let's see which health coverage you may qualify for.", ["coverage"]],
    [/dentist|dental|tooth|teeth|clinic|doctor near|near me|zip|cheap doctor|low[- ]cost/i, "Community health centers see people with or without insurance and charge by income.", ["find_care"]],
    [/pregnan/i, "Pregnancy care can be covered by Medicaid even at higher incomes. Let's check.", ["coverage", "find_care"]],
    [/my plan|saved|deadline|remind/i, "Your saved plans and deadlines are in My plan.", ["my_plan"]],
    [/talk|call|person|human|someone|phone|help line|211|lawyer|legal/i, "Here are free phone lines with real people.", ["talk_to_person"]]
  ];
  var MENU = [a("symptoms"), a("medication"), a("hospital_bill"), a("fight_bill"), a("coverage"), a("find_care"), a("talk_to_person")];

  // The built-in guide. Returns { urgent, reply, actions }.
  function local(text) {
    var t = String(text || ""), det = typeof CareLogic !== "undefined" ? CareLogic.detect(t) : { redFlags: [], conditions: [] };
    var flag = det.redFlags[0];
    if (flag) return flag.action === "call988"
      ? { urgent: "crisis", reply: "If you're thinking about suicide or hurting yourself, please call or text 988 now. It's free and open 24/7. If you're in danger right now, call 911.", actions: [a("call_988"), a("call_911"), a("talk_to_person")] }
      : { urgent: "emergency", reply: "This could be an emergency. Call 911 or go to the nearest emergency room now. They must help you even if you can't pay.", actions: [a("call_911"), a("hospital_bill", null, "Help with the bill later")] };
    var out = [];
    var drug = typeof NLParse !== "undefined" && typeof PROGRAMS !== "undefined" ? NLParse.parse(t, PROGRAMS).answers.drug : null;
    var sd = typeof SymptomLogic !== "undefined" ? SymptomLogic.detect(t) : { symptoms: [], named: [] };
    var bill = /bill|charge|collect|owe|afford|pay\b|insurance|coverage|medicaid|medicare|clinic|dentist|near me/i.test(t);
    if (drug) out.push({ reply: "I can look for free and discount programs for " + drug + ".", actions: [a("medication", drug)] });
    if ((sd.symptoms.filter(function (s) { return s !== "child"; }).length || sd.named.length || (det.conditions.length && !drug)) && !(bill && !sd.symptoms.length))
      out.push({ reply: "Let's figure out how urgent this is and where to go. The symptom checker will ask a few questions.", actions: [a("symptoms", t)] });
    for (var i = 0; i < RULES.length && out.length < 2; i++) if (RULES[i][0].test(t)) out.push({ reply: RULES[i][1], actions: RULES[i][2].map(function (k) { return a(k); }) });
    if (!out.length) {
      if (typeof SiteSearch !== "undefined") {
        var hits = SiteSearch.search(t, 6).filter(function (e) { return e.action && (e.action.view || e.action.ask || e.action.fight || e.action.talk); });
        if (hits.length) return { urgent: "none", reply: "Here's where I'd start:", actions: hits.slice(0, 3).map(function (e) {
          var ac = e.action;
          return ac.ask ? a(e.kind === "Medication" ? "medication" : "symptoms", ac.ask, e.title)
            : ac.fight ? a("fight_bill", null, e.title) : ac.talk ? a("talk_to_person") : a({ meds: "symptoms", patient: "hospital_bill", fight: "fight_bill", covered: "coverage", findcare: "find_care", plan: "my_plan" }[ac.view] || "symptoms");
        }) };
      }
      return { urgent: "none", reply: "I can help you find the right place. What do you need help with?", actions: MENU.slice() };
    }
    var actions = [], seen = {};
    out.forEach(function (o) { o.actions.forEach(function (x) { if (!seen[x.type] && actions.length < 3) { seen[x.type] = 1; actions.push(x); } }); });
    return { urgent: "none", reply: out.map(function (o) { return o.reply; }).join(" "), actions: actions };
  }
  return { local: local, MENU: MENU, ACT: ACT };
})();

if (typeof document !== "undefined") (function () {
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var ai = false, history = [], busy = false;
  if (/^https?:$/.test(location.protocol)) fetch("/api/status").then(function (r) { return r.json(); }).then(function (s) { ai = !!s.ai; }).catch(function () {});
  var btn = document.createElement("button");
  btn.id = "guideBtn"; btn.className = "guide-btn no-print"; btn.type = "button"; btn.textContent = "💬 Ask for guidance";
  var panel = document.createElement("div");
  panel.id = "guidePanel"; panel.className = "guide-panel hidden no-print"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Ask for guidance");
  panel.innerHTML = "<div class='talk-head'><h2>Where should I go?</h2><button type='button' class='ghost' id='guideClose' aria-label='Close'>✕</button></div>" +
    "<p class='hint'>Tell me what's going on in your own words. I'll point you to the right place. I'm not a doctor and can't diagnose.</p>" +
    "<div id='guideLog' class='guide-log'></div>" +
    "<div class='guide-input'><input id='guideIn' placeholder='e.g. \"I got a huge ER bill and have no insurance\"' autocomplete='off'><button type='button' class='primary' id='guideSend'>Send</button></div>";
  document.body.appendChild(btn); document.body.appendChild(panel);
  var log = document.getElementById("guideLog"), input = document.getElementById("guideIn");
  function say(who, html) { log.insertAdjacentHTML("beforeend", "<div class='msg " + (who === "me" ? "me" : "bot") + "'>" + html + "</div>"); log.scrollTop = log.scrollHeight; }
  function buttons(actions) {
    var id = "ga" + Date.now().toString(36);
    say("bot", "<div class='guide-acts' id='" + id + "'>" + actions.map(function (x, i) {
      return x.type === "call_911" || x.type === "call_988"
        ? "<a class='primary call' href='tel:" + (x.type === "call_911" ? "911" : "988") + "'>" + esc(x.label) + "</a>"
        : "<button type='button' class='ghost' data-i='" + i + "'>" + esc(x.label) + "</button>";
    }).join(" ") + "</div>");
    document.querySelectorAll("#" + id + " button").forEach(function (b) { b.onclick = function () { run(actions[+b.dataset.i]); }; });
  }
  function run(x) {
    var go = function (v) { close(); showView(v); };
    switch (x.type) {
      case "symptoms": case "medication": close(); if (x.query) askGetHelp(x.query); else { showView("meds"); var s = document.getElementById("drugSearch"); if (s) s.focus(); } break;
      case "hospital_bill": go("patient"); break;
      case "fight_bill": go("fight"); break;
      case "coverage": go("covered"); break;
      case "find_care": go("findcare"); break;
      case "my_plan": go("plan"); break;
      case "talk_to_person": close(); var t = document.getElementById("talkBtn"); if (t) t.click(); break;
    }
  }
  function answer(g) {
    say("bot", (g.urgent !== "none" ? "<b>" : "") + esc(g.reply) + (g.urgent !== "none" ? "</b>" : ""));
    if (g.actions && g.actions.length) buttons(g.actions);
    history.push({ role: "assistant", text: g.reply });
  }
  function send() {
    var text = input.value.trim(); if (!text || busy) return;
    input.value = ""; say("me", esc(text)); history.push({ role: "user", text: text });
    var quick = Guide.local(text);
    // Safety first: the built-in emergency check always runs, even when Claude is on.
    if (!ai || quick.urgent !== "none") return answer(quick);
    busy = true; say("bot", "<span class='hint'>Thinking…</span>"); var wait = log.lastChild;
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 30000);
    fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.slice(-12) }), signal: ctl.signal })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (g) { wait.remove(); answer(g); })
      .catch(function () { wait.remove(); answer(quick); })
      .then(function () { clearTimeout(timer); busy = false; });
  }
  function open() {
    panel.classList.remove("hidden");
    if (!log.children.length) { say("bot", "Hi! What do you need help with today?"); buttons(Guide.MENU); }
    input.focus();
  }
  function close() { panel.classList.add("hidden"); }
  btn.onclick = function () { panel.classList.contains("hidden") ? open() : close(); };
  document.getElementById("guideClose").onclick = close;
  document.getElementById("guideSend").onclick = send;
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.classList.contains("hidden")) close(); });
})();
