// Symptom checker logic: read symptoms from text, ask the questions that best tell causes apart,
// and rank POSSIBLE causes. Never a diagnosis: the page always says to see a doctor to find out for sure.
// Pure functions (no page code) so they can be tested. Data: SYMPTOMS (symptom-data.js), SYMPTOM_CONDITIONS (symptom-conditions.js).

var SymptomLogic = (function () {
  var MAX_SYMPTOM_QS = 5, MAX_FEATURE_QS = 3, MAX_FLAG_QS = 5;
  // Causes that only make sense with a known risk (sex with a new partner, a tick bite) are only shown when the person says yes to it.
  var GATED = ["new-sex-partner", "tick-bite"];
  function gate(c) { var all = c.symptoms.core.concat(c.symptoms.common); return GATED.filter(function (g) { return all.indexOf(g) >= 0; }); }
  var RANK = { routine: 0, soon: 1, today: 2, emergency: 3, crisis: 4 };
  function byId(id) { for (var i = 0; i < SYMPTOMS.length; i++) if (SYMPTOMS[i].id === id) return SYMPTOMS[i]; return null; }
  function cond(id) { for (var i = 0; i < SYMPTOM_CONDITIONS.length; i++) if (SYMPTOM_CONDITIONS[i].id === id) return SYMPTOM_CONDITIONS[i]; return null; }
  function expand(t) { t = String(t || ""); return typeof Lexicon !== "undefined" ? Lexicon.expand(t) : t; }
  function maxU(a, b) { return RANK[b] > RANK[a] ? b : a; }
  // The wording the person actually saw (some questions are reworded in question-options.js).
  function wording(q) { var o = typeof QUESTION_OPTIONS !== "undefined" && QUESTION_OPTIONS[q]; return (o && o.q) || q; }

  // Symptoms mentioned, and conditions named outright ("I think I have strep").
  // "no cough", "without a fever", "I don't have a rash" count as a no, not a yes.
  var NEG = /\b(no|not|without|never|don'?t have|doesn'?t have|haven'?t had|didn'?t have|isn'?t|aren'?t)\b[^.,;!?]{0,14}$/i;
  function detect(text) {
    var t = expand(text), yes = [], no = [];
    SYMPTOMS.forEach(function (s) {
      var g = new RegExp(s.rx.source, "gi"), m, pos = false, neg = false;
      while ((m = g.exec(t))) { if (NEG.test(t.slice(Math.max(0, m.index - 30), m.index))) neg = true; else pos = true; if (!m[0].length) g.lastIndex++; }
      if (pos) yes.push(s.id); else if (neg) no.push(s.id);
    });
    return {
      symptoms: yes, negated: no,
      named: namedIn(t)
    };
  }

  // Conditions named outright. If one name sits inside a longer one ("diabetes" inside "type 2 diabetes"), keep only the longer.
  function namedIn(t) {
    var hits = SYMPTOM_CONDITIONS.map(function (c) { var m = c.aliasRx && t.match(c.aliasRx); return m ? { id: c.id, text: m[0].toLowerCase() } : null; }).filter(Boolean);
    return hits.filter(function (h) { return !hits.some(function (o) { return o !== h && o.text.length > h.text.length && o.text.indexOf(h.text) >= 0; }); }).map(function (h) { return h.id; });
  }

  function newState(det) {
    var s = { known: {}, feats: {}, flags: {}, asked: {}, nSym: 0, nFeat: 0, nFlag: 0, named: det.named.slice() };
    (det.negated || []).forEach(function (id) { s.known[id] = false; });
    det.symptoms.forEach(function (id) { s.known[id] = true; });
    return s;
  }

  // How well a condition explains what we know. Hallmark symptoms count most; symptoms it doesn't explain count against it.
  function score(c, s) {
    var v = 0, hits = 0, mine = {};
    c.symptoms.core.forEach(function (id) { mine[id] = 1; if (s.known[id] === true) { v += 3; hits++; } else if (s.known[id] === false) v -= 2; });
    c.symptoms.common.forEach(function (id) { mine[id] = 1; if (s.known[id] === true) { v += 1.5; hits++; } else if (s.known[id] === false) v -= 0.4; });
    Object.keys(s.known).forEach(function (id) { if (s.known[id] === true && !mine[id] && id !== "child") v -= 0.75; });
    (c.features || []).forEach(function (f, i) { var a = s.feats[c.id + ":" + i]; if (a === true) v += f.weight * 1.5; else if (a === false) v -= f.weight * 0.75; });
    if (s.named.indexOf(c.id) >= 0) { v += 6; hits++; }
    if (c.population === "children" && s.known.child === false) v -= 4;
    return { cond: c, score: v, hits: hits };
  }

  function ranked(s) {
    return SYMPTOM_CONDITIONS.map(function (c) { return score(c, s); })
      .filter(function (r) { return r.hits > 0; })
      .sort(function (a, b) { return b.score - a.score || RANK[b.cond.urgency] - RANK[a.cond.urgency]; });
  }

  // The next question: first symptoms that split the top candidates, then each candidate's telling question, then warning signs.
  function next(s) {
    var top = ranked(s).slice(0, 6);
    if (!top.length) return null;
    var lead = top.length > 1 ? top[0].score - top[1].score : 99;
    if (s.nSym < MAX_SYMPTOM_QS && !(s.nSym >= 3 && lead >= 6)) {
      var w = {}, total = 0;
      top.forEach(function (r, i) {
        var wt = 1 / (i + 1); total += wt;
        r.cond.symptoms.core.forEach(function (id) { w[id] = (w[id] || 0) + wt; });
        r.cond.symptoms.common.forEach(function (id) { w[id] = (w[id] || 0) + wt * 0.6; });
      });
      var best = null, bestV = 0.15;
      Object.keys(w).forEach(function (id) {
        if (id in s.known || !byId(id)) return;
        // Split the candidates, but first confirm the hallmark symptoms of the leaders.
        var v = Math.min(w[id], total - w[id]) + (top[0].cond.symptoms.core.indexOf(id) >= 0 ? 0.6 : 0) +
          (top.length > 1 && top[1].cond.symptoms.core.indexOf(id) >= 0 ? 0.3 : 0);
        if (v > bestV) { bestV = v; best = id; }
      });
      if (best) return { kind: "symptom", id: best, ask: byId(best).ask };
    }
    // Ask about the risk behind a gated cause before showing it.
    for (var g = 0; g < Math.min(3, top.length); g++) {
      var need = gate(top[g].cond).filter(function (id) { return !(id in s.known); })[0];
      if (need) return { kind: "symptom", id: need, ask: byId(need).ask };
    }
    if (s.nFeat < MAX_FEATURE_QS) {
      for (var i = 0; i < Math.min(3, top.length); i++) {
        var fs = top[i].cond.features || [];
        for (var j = 0; j < fs.length; j++) {
          var k = top[i].cond.id + ":" + j;
          if (!(k in s.feats) && !s.asked[fs[j].q]) return { kind: "feature", key: k, ask: fs[j].q };
        }
      }
    }
    if (s.nFlag < MAX_FLAG_QS) {
      var flags = [];
      // Suicide and self-harm questions are always asked when any candidate has one.
      top.forEach(function (r) {
        (r.cond.redFlags || []).forEach(function (f, j) { if (f.ifYes === "crisis") flags.push({ key: r.cond.id + ":" + j, ask: f.q, ifYes: f.ifYes }); });
      });
      top.slice(0, 3).forEach(function (r, i) {
        (r.cond.redFlags || []).forEach(function (f, j) {
          if (i === 0 || RANK[f.ifYes] >= RANK.emergency) flags.push({ key: r.cond.id + ":" + j, ask: f.q, ifYes: f.ifYes });
        });
      });
      for (var m = 0; m < flags.length; m++) if (!(flags[m].key in s.flags) && !s.asked[flags[m].ask]) return { kind: "flag", key: flags[m].key, ask: flags[m].ask, ifYes: flags[m].ifYes };
    }
    return null;
  }

  // Record an answer: true, false, or null for "not sure".
  function answer(s, q, v) {
    s.asked[q.ask] = true;
    if (q.kind === "symptom") { s.nSym++; s.known[q.id] = v; }
    else if (q.kind === "feature") { s.nFeat++; s.feats[q.key] = v; }
    else { s.nFlag++; s.flags[q.key] = { yes: v === true, unsure: v === null, ifYes: q.ifYes, ask: q.ask }; }
  }

  // Up to 3 possible causes, how urgent, and why. Urgency follows the most serious cause we can't rule out.
  function result(s, duration) {
    var r = ranked(s).filter(function (x) { return gate(x.cond).every(function (id) { return s.known[id] === true; }); }), positives = Object.keys(s.known).filter(function (k) { return s.known[k] === true && k !== "child"; }).length;
    var confident = r.length && (r[0].score >= 4 || s.named.indexOf(r[0].cond.id) >= 0);
    var shown = confident ? r.filter(function (x, i) { return i === 0 || x.score >= Math.max(2, r[0].score * 0.45); }).slice(0, 3) : [];
    var u = shown.length ? shown[0].cond.urgency : "soon", why = [];
    shown.slice(1).forEach(function (x) {
      if (RANK[x.cond.urgency] >= RANK.emergency) { u = maxU(u, "today"); why.push(x.cond.label + " is also possible and can be serious, so get checked today."); }
    });
    Object.keys(s.flags).forEach(function (k) {
      var f = s.flags[k];
      if (f.yes) { u = maxU(u, f.ifYes); why.push("You said yes to: \"" + wording(f.ask) + "\""); }
      // Not sure about a serious warning sign: don't wait days. Get checked today.
      else if (f.unsure && RANK[f.ifYes] >= RANK.today) { u = maxU(u, "today"); why.push("You weren't sure about: \"" + wording(f.ask) + "\". When in doubt, get checked."); }
    });
    if (duration === "weeks" && u === "routine") u = "soon";
    return {
      urgency: u, why: why, positives: positives,
      causes: shown.map(function (x, i) { return { cond: x.cond, level: i === 0 ? "Best match" : "Also possible" }; }),
      top: shown.length ? shown[0].cond : null
    };
  }

  return { detect: detect, newState: newState, ranked: ranked, next: next, answer: answer, result: result, byId: byId, cond: cond, RANK: RANK };
})();

if (typeof module !== "undefined") module.exports = SymptomLogic;
