// Turn a plain-English description into screening answers.
// Offline and rule-based: it only fills an answer when the text clearly says it, and reports
// what it understood so the person can correct it. Anything unclear is left for the chat to ask.
// (A Claude-powered parser can replace parse() later. See README "Plugging in Claude".)

var NLParse = (function () {
  var PER_YEAR = { hour: 2080, week: 52, biweekly: 26, semimonthly: 24, month: 12, year: 1 };
  var WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1 };

  function num(s) {
    s = String(s).toLowerCase().replace(/[$,\s]/g, "");
    if (WORDNUM[s] !== undefined) return WORDNUM[s];
    var m = s.match(/^(\d+(?:\.\d+)?)(k|grand|thousand)?$/);
    if (!m) return NaN;
    return parseFloat(m[1]) * (m[2] ? 1000 : 1);
  }

  function freqOf(s) {
    s = s.toLowerCase();
    if (/hour|hr\b|hourly/.test(s)) return "hour";
    if (/(every|each) (two|2|other) weeks?|bi-?weekly|every other week|per paycheck|a paycheck/.test(s)) return "biweekly";
    if (/twice a month|semi-?monthly/.test(s)) return "semimonthly";
    if (/week/.test(s)) return "week";
    if (/month|\/mo\b|\bmo\b/.test(s)) return "month";
    if (/year|annual|\/yr|\byr\b|salary/.test(s)) return "year";
    return null;
  }

  var MONEY = "\\$?\\s?(\\d[\\d,]*(?:\\.\\d+)?\\s?(?:k|grand|thousand)?)";

  function parseIncome(t, notes) {
    // "$15 an hour, 30 hours a week"
    var h = t.match(new RegExp(MONEY + "\\s*(?:an|per|/|a)\\s*(?:hour|hr)\\b(?:[^.]*?(\\d+)\\s*hours?\\s*(?:a|per)\\s*week)?", "i"));
    if (h) {
      var rate = num(h[1]), hrs = h[2] ? +h[2] : 40;
      if (!h[2]) notes.push("Assumed 40 hours a week.");
      return Math.round(rate * hrs * 52);
    }
    // "make/earn/income ... $2,000 every two weeks" or "45k a year"
    var rx = new RegExp(MONEY + "\\s*((?:a|per|each|every|/)\\s*(?:two |2 |other )?(?:week|weeks|month|year|paycheck|yr|mo)|bi-?weekly|weekly|monthly|yearly|annually|twice a month|a year|salary)", "i");
    var m = t.match(rx);
    if (m) return Math.round(num(m[1]) * PER_YEAR[freqOf(m[2])]);
    // "income is 45k" / "make 45 grand" with no period: assume yearly only if it's clearly large
    var m2 = t.match(new RegExp("(?:make|earn|income(?: is)?|salary(?: is)?)\\s*(?:about|around|roughly|like)?\\s*" + MONEY, "i"));
    if (m2) {
      var v = num(m2[1]);
      if (v >= 5000) { notes.push("Read $" + v.toLocaleString() + " as yearly income."); return Math.round(v); }
    }
    return undefined;
  }

  function parseHousehold(t) {
    var m = t.match(/(?:family|household) of (\w+)/i) || t.match(/(\w+) (?:people|person|of us) (?:in (?:my|our) (?:house|household|family)|live)/i) || t.match(/\bwe(?:'re| are) (?:a family of )?(\w+)\b/i);
    if (m && !isNaN(num(m[1]))) return num(m[1]);
    if (/\b(just me|only me|live alone|by myself|single,? no kids)\b/i.test(t)) return 1;
    // "me, my wife and 2 kids"
    if (/\b(me|i)\b/i.test(t) && /\b(wife|husband|spouse|partner|kids?|children|child|son|daughter|mom|dad|mother|father)\b/i.test(t)) {
      var n = 1;
      if (/\b(wife|husband|spouse|partner|girlfriend|boyfriend)\b/i.test(t)) n += 1;
      var k = t.match(/(\w+) (?:kids|children|sons|daughters)/i);
      if (k && !isNaN(num(k[1]))) n += num(k[1]);
      else if (/\b(a|one|my) (kid|child|son|daughter|baby)\b/i.test(t)) n += 1;
      if (/\bmy (mom|dad|mother|father)\b/i.test(t)) n += 1;
      return n;
    }
    return undefined;
  }

  function parseInsurance(t) {
    var l = t.toLowerCase();
    if (/\b(no|don'?t have|do not have|without|lost my|no health)\s+(health\s+)?insurance\b|\buninsured\b|\bnot insured\b/.test(l)) return "none";
    if (/\bmedicaid\b|\bchip\b/.test(l)) return "medicaid";
    if (/\bmedicare\b/.test(l)) return "medicare";
    if (/\b(va|tricare|veteran'?s? (benefits|affairs))\b/.test(l)) return "va";
    if (/insurance (through|from) (my |our )?(job|work|employer|husband|wife|spouse)|employer insurance|marketplace|obamacare|aca plan|blue ?cross|aetna|cigna|united ?health|humana plan|kaiser|private insurance|(have|got) insurance/.test(l)) return "commercial";
    return undefined;
  }

  var STATES = { alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
    "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
    kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
    missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
    "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
    "west virginia": "WV", wisconsin: "WI", wyoming: "WY" };
  var ABBR = Object.keys(STATES).map(function (k) { return STATES[k]; });

  function parseState(t) {
    var names = Object.keys(STATES).sort(function (a, b) { return b.length - a.length; });  // "west virginia" before "virginia"
    for (var i = 0; i < names.length; i++) if (new RegExp("\\b" + names[i] + "\\b", "i").test(t)) {
      if (names[i] === "washington" && /washington (dc|d\.c\.)/i.test(t)) return "DC";
      return STATES[names[i]];
    }
    var m = t.match(/\b(?:in|from|live in|living in|out of)\s+([A-Z]{2})\b/);  // "in TX" (uppercase only, so "in me" never matches)
    return m && ABBR.indexOf(m[1]) >= 0 ? m[1] : undefined;
  }

  function parse(text, programs) {
    var raw = String(text || "");
    var t = typeof Lexicon !== "undefined" ? Lexicon.expand(raw) : raw, a = {}, notes = [], got = [];
    var inc = parseIncome(t, notes); if (inc !== undefined) { a.income = inc; got.push(["income", "$" + inc.toLocaleString() + " a year"]); }
    var hh = parseHousehold(t); if (hh) { a.householdSize = hh; got.push(["householdSize", hh + (hh === 1 ? " person" : " people") + " in the household"]); }
    var ins = parseInsurance(t); if (ins) { a.insurance = ins; got.push(["insurance", { none: "No insurance", commercial: "Private / job insurance", medicare: "Medicare", medicaid: "Medicaid", va: "VA / TRICARE" }[ins]]); }
    if (/\b(denied|won'?t cover|doesn'?t cover|does not cover|refused to cover|not covered)\b/i.test(t)) { a.commercialDenied = true; got.push(["commercialDenied", "Insurance won't cover it"]); }
    else if (/\b(copay|co-pay|deductible)\b.*\b(too (high|much|expensive)|can'?t afford)\b/i.test(t)) { a.commercialDenied = false; got.push(["commercialDenied", "Covered, but the copay is too high"]); }
    var sav = t.match(new RegExp(MONEY + "\\s*(?:in savings|saved|in the bank)|savings (?:of|are|is)\\s*(?:about|around)?\\s*" + MONEY, "i"));
    if (sav) { a.medicareResources = num(sav[1] || sav[2]); got.push(["medicareResources", "$" + a.medicareResources.toLocaleString() + " in savings"]); }
    if (/\b(my doctor|doctor (prescribed|put me on|wrote)|have a prescription|prescribed)\b/i.test(t)) { a.hasPrescriber = true; got.push(["hasPrescriber", "Has a prescribing doctor"]); }
    var st = parseState(raw);
    if (st) { a.state = st; a.usResident = true; got.push(["state", "Lives in " + st]); }
    else if (/\b(live in|from|in) (the )?(us|usa|u\.s\.|united states|america|the states)\b/i.test(t)) { a.usResident = true; got.push(["usResident", "Lives in the US"]); }

    if (programs && typeof MedsLogic !== "undefined") {
      var words = t.split(/[^A-Za-z0-9-]+/).filter(function (w) { return w.length >= 4; });
      for (var i = 0; i < words.length; i++) {
        var hit = MedsLogic.searchDrugs(words[i], programs).filter(function (d) { return d.names.indexOf(MedsLogic.norm(words[i])) >= 0; })[0];
        if (hit) { a.drug = hit.brand; got.unshift(["drug", hit.brand]); break; }
      }
      // Misspelled drug names inside a sentence ("ozempick", "elliquis"): one clear close match only.
      if (!a.drug && MedsLogic.didYouMean) {
        for (var j = 0; j < words.length && !a.drug; j++) {
          if (words[j].length < 5 || /^(about|their|there|which|would|could|should|where|insurance|income|month|money|every|weeks?)$/i.test(words[j])) continue;
          var g = MedsLogic.didYouMean(words[j], programs);
          if (g.length === 1) { a.drug = g[0].brand; got.unshift(["drug", g[0].brand + " (I read \"" + words[j] + "\" as " + g[0].brand + ")"]); }
        }
      }
    }
    return { answers: a, understood: got, notes: notes };
  }

  return { parse: parse, num: num };
})();

if (typeof module !== "undefined") module.exports = NLParse;
