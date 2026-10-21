// Care navigation logic: detect symptoms/diagnoses, screen for emergencies, build a plan.
// Pure functions (no page code) so they can be tested.

var CareLogic = (function () {
  function detect(text) {
    var t = String(text || "");
    if (typeof Lexicon !== "undefined") t = Lexicon.expand(t);  // slang -> plain words
    return {
      redFlags: CARE_RED_FLAGS.filter(function (f) { return f.rx.test(t); }),
      conditions: CONDITIONS.filter(function (c) { return c.rx.test(t); })
    };
  }

  // Most specific match wins: "general" only when nothing else matched.
  function primary(conds) {
    var specific = conds.filter(function (c) { return c.id !== "general"; });
    return specific[0] || conds[0] || null;
  }

  function maxUrgency(a, b) { return URGENCY[a].rank >= URGENCY[b].rank ? a : b; }

  // answers: { checks: [true/false...], diagnosed: true/false, duration: "today"|"days"|"weeks", redFlags: [...] }
  function urgencyFor(cond, ans) {
    var u = cond ? cond.urgency : "soon";
    (ans.checks || []).forEach(function (yes, i) { if (yes && cond.checks[i]) u = maxUrgency(u, cond.checks[i].ifYes); });
    (ans.redFlags || []).forEach(function (f) { u = maxUrgency(u, f.action === "call988" ? "crisis" : "emergency"); });
    // Undiagnosed symptoms that have lasted weeks deserve a visit soon; a known, diagnosed condition doesn't.
    if (ans.duration === "weeks" && u === "routine" && ans.diagnosed !== true) u = "soon";
    return u;
  }

  function plan(cond, ans, programs, cfg) {
    var u = urgencyFor(cond, ans);
    var steps = [];
    if (u === "crisis" || u === "emergency") steps.push(URGENCY[u].where);
    if (cond) {
      if (ans.diagnosed === true) steps.push("Since it's already diagnosed, focus on follow-up care and paying for treatment. Bring your diagnosis paperwork to every visit.");
      // Conditions handled "today" already start their steps with where to go; only add this for routine/soon ones.
      if (ans.diagnosed === false && (u === "soon" || u === "routine")) steps.push("Get it checked first: " + cond.where);
      steps = steps.concat(cond.steps);
    }
    var hospitalLikely = u === "emergency" || u === "today" || (cond && ["broken-bone", "cancer", "pregnancy"].indexOf(cond.id) >= 0);

    // Which programs to evaluate: general programs + this condition's programs. Never drug-specific ones on their own.
    var ids = ((cond && cond.programs) || []).slice();
    if ((u === "emergency" || u === "today") && ids.indexOf("emtala") < 0) ids.unshift("emtala");
    if (u === "crisis" && ids.indexOf("988") < 0) ids.unshift("988");
    var pool = programs.filter(function (p) { return p.general || ids.indexOf(p.id) >= 0; });
    var matches = MedsLogic.match(Object.assign({}, ans.money || {}, { drug: undefined }), pool, cfg)
      .filter(function (m) { return m.status !== "no"; });
    // Condition-specific programs first, then the rest in normal order.
    var pos = function (m) { var i = ids.indexOf(m.program.id); return i < 0 ? 999 : i; };
    matches = matches.map(function (m, i) { return { m: m, i: i }; })
      .sort(function (a, b) { return pos(a.m) - pos(b.m) || a.i - b.i; })
      .map(function (x) { return x.m; });

    var known = MedsLogic.drugIndex(programs).map(function (d) { return MedsLogic.norm(d.brand); });
    var drugs = ((cond && cond.drugs) || []).filter(function (d) { return known.indexOf(MedsLogic.norm(d)) >= 0; });

    return {
      urgency: u, urgencyInfo: URGENCY[u], condition: cond,
      where: (u === "crisis" || u === "emergency") ? URGENCY[u].where : (cond ? cond.where : URGENCY[u].where),
      who: cond ? cond.who : ["Primary care provider"], steps: steps, meanwhile: cond ? cond.meanwhile : [],
      hospitalBill: hospitalLikely, programs: matches, drugs: drugs, source: cond && cond.source
    };
  }

  return { detect: detect, primary: primary, urgencyFor: urgencyFor, plan: plan };
})();

if (typeof module !== "undefined") module.exports = CareLogic;
