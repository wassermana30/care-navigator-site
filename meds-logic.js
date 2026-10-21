// Medication matching. Pure functions, no page code, so it can be tested on its own.
// Program data lives in programs.js (each program has a `rules` block written from its sources).

var MedsLogic = (function () {
  var RANK = { "free-drug": 0, "copay-help": 1, government: 2, clinic: 3, "low-cost": 4, directory: 5 };
  var STATUS_RANK = { likely: 0, maybe: 1, no: 2 };

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  // "Ozempic (semaglutide)" -> { brand: "Ozempic", names: ["ozempic", "semaglutide"] }
  function parseDrug(entry) {
    var m = String(entry).match(/^([^(]+)(?:\(([^)]+)\))?/);
    var brand = (m ? m[1] : entry).trim();
    var names = [norm(brand)];
    if (m && m[2]) m[2].split(/[\/,;]| and /).forEach(function (g) { if (norm(g)) names.push(norm(g)); });
    return { brand: brand, label: String(entry).trim(), names: names };
  }

  // Every drug the database knows, de-duplicated by brand.
  function drugIndex(programs) {
    var byBrand = {};
    programs.forEach(function (p) {
      (p.drugs || []).concat(p.drugsNotCovered || []).forEach(function (d) {
        var pd = parseDrug(d);
        var key = norm(pd.brand);
        if (!key || /any |all /.test(key)) return;
        if (!byBrand[key]) byBrand[key] = { brand: pd.brand, label: pd.label, names: pd.names.slice(), programs: [] };
        pd.names.forEach(function (n) { if (byBrand[key].names.indexOf(n) < 0) byBrand[key].names.push(n); });
        if (byBrand[key].programs.indexOf(p.id) < 0) byBrand[key].programs.push(p.id);
      });
    });
    return Object.keys(byBrand).map(function (k) { return byBrand[k]; });
  }

  function searchDrugs(query, programs) {
    var q = norm(query);
    if (q.length < 2) return [];
    return drugIndex(programs)
      .map(function (d) {
        var best = 9;
        d.names.forEach(function (n) {
          if (n === q) best = Math.min(best, 0);
          else if (n.indexOf(q) === 0) best = Math.min(best, 1);
          else if (n.indexOf(q) > 0) best = Math.min(best, 2);
        });
        return { drug: d, score: best };
      })
      .filter(function (x) { return x.score < 9; })
      .sort(function (a, b) { return a.score - b.score || a.drug.brand.localeCompare(b.drug.brand); })
      .map(function (x) { return x.drug; });
  }

  // Is this text plausibly a medication name (vs. a question or instruction)?
  var STOP = ("a an the me my i you your we our give show tell help example examples please can could would how what why where when who " +
    "is are do does did need want find get to for of and or with about it this that some any something there here hi hello hey test try").split(" ");
  function looksLikeDrug(text) {
    var words = norm(text).split(" ").filter(Boolean);
    if (!words.length || words.length > 3) return false;
    if (words.some(function (w) { return STOP.indexOf(w) >= 0; })) return false;
    return /[a-z]{3,}/.test(words.join(""));
  }

  function editDistance(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) d[i] = [i];
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  // "Did you mean...?" for misspellings: brands whose name is within 1-2 edits of the query.
  function didYouMean(text, programs) {
    var q = norm(text);
    if (q.length < 4) return [];
    var max = q.length <= 6 ? 1 : 2;
    return drugIndex(programs).map(function (d) {
      return { d: d, dist: Math.min.apply(null, d.names.map(function (n) { return editDistance(q, n); })) };
    }).filter(function (x) { return x.dist <= max; }).sort(function (a, b) { return a.dist - b.dist; }).slice(0, 3).map(function (x) { return x.d; });
  }

  function coversDrug(p, brand) {
    var b = norm(brand);
    return (p.drugs || []).some(function (d) { return norm(parseDrug(d).brand) === b; });
  }

  function excludesDrug(p, brand) {
    var b = norm(brand);
    return (p.drugsNotCovered || []).some(function (d) { return norm(parseDrug(d).brand) === b; });
  }

  function fpl(size, cfg) { return cfg.FPL.base + cfg.FPL.perAdditional * (Math.max(1, Math.floor(size)) - 1); }

  // Which questions are still needed, given the answers so far and the candidate programs.
  // Only asks what at least one candidate program actually checks.
  function nextQuestion(a, candidates) {
    var uses = function (key) { return candidates.some(function (p) { return p.rules && p.rules.asks && p.rules.asks.indexOf(key) >= 0; }); };
    var order = ["usResident", "insurance", "householdSize", "income", "medicareResources", "commercialDenied", "hasPrescriber", "state"];
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      if (a[k] !== undefined && a[k] !== "") continue;
      if (k === "medicareResources" && a.insurance !== "medicare") continue;
      if (k === "commercialDenied" && a.insurance !== "commercial") continue;
      if (k === "insurance" || k === "householdSize" || k === "income" || k === "usResident" || uses(k)) return k;
    }
    return null;
  }

  // Program-wide rules with any drug-specific overrides merged on top.
  function rulesFor(p, drug) {
    var base = p.rules || {}, r = {};
    Object.keys(base).forEach(function (k) { if (k !== "drugRules") r[k] = base[k]; });
    var over = base.drugRules && drug ? base.drugRules[Object.keys(base.drugRules).filter(function (k) { return norm(k) === norm(drug); })[0]] : null;
    if (over) Object.keys(over).forEach(function (k) {
      if (k === "insurance" || k === "insuranceNotes") r[k] = Object.assign({}, base[k] || {}, over[k]);
      else r[k] = over[k];
    });
    return r;
  }

  // Dollar limit for this household, from a % of poverty or a published dollar table.
  function incomeLimit(r, size, cfg) {
    if (r.incomeTable) {
      var t = r.incomeTable, n = t.capAt ? Math.min(size, t.capAt) : size;
      return t.base + t.perAdditional * Math.max(0, n - (t.flatUpTo || 1));
    }
    if (r.maxPctFPL) return Math.round(fpl(size, cfg) * r.maxPctFPL / 100);
    return null;
  }

  function evaluate(p, a, cfg) {
    var r = rulesFor(p, a.drug), reasons = [], status = "likely";
    function downgrade(to, why) { if (STATUS_RANK[to] > STATUS_RANK[status]) status = to; reasons.push(why); }

    if (a.drug && !p.general && !coversDrug(p, a.drug)) downgrade("no", "Does not list " + a.drug + ".");
    if (a.drug && excludesDrug(p, a.drug)) downgrade("no", a.drug + " is specifically excluded.");
    if (r.usResident && a.usResident === false) downgrade("no", "Requires US residency.");

    if (a.insurance && r.insurance) {
      var ins = r.insurance[a.insurance];
      var note = (r.insuranceNotes && r.insuranceNotes[a.insurance]) || "";
      if (a.insurance === "commercial" && r.needsCommercialDenial && a.commercialDenied === true && ins === "maybe") {
        ins = "yes"; note = "Your insurance refused to cover it, which is what this program requires for insured patients.";
      }
      if (ins === "no") downgrade("no", note || "Not open to people with this type of coverage.");
      else if (ins === "maybe") downgrade("maybe", note || "Only some people with this coverage qualify.");
      else if (ins === "yes" && note) reasons.push(note);
    }

    var limit = a.householdSize ? incomeLimit(r, a.householdSize, cfg) : null;
    if (limit !== null && a.income !== undefined) {
      var lim = "$" + limit.toLocaleString() + " for a household of " + a.householdSize;
      if (a.income > limit) downgrade("no", "Income $" + a.income.toLocaleString() + " is over the limit of " + lim + ".");
      else reasons.push("Income is under the limit of " + lim + ".");
    } else if (r.incomeText) {
      reasons.push("Income rule: " + r.incomeText);
    }

    if (r.resourcesBySize && a.insurance === "medicare" && a.medicareResources !== undefined && a.householdSize) {
      var cap = r.resourcesBySize[Math.min(a.householdSize, r.resourcesBySize.length) - 1];
      if (a.medicareResources > cap) downgrade("no", "Savings are above the $" + cap.toLocaleString() + " resource limit.");
    }

    // Medicaid: once we know the state, replace "check your state" with that state's actual rules.
    if (r.medicaidByState && a.state && typeof MEDICAID_STATES !== "undefined" && MEDICAID_STATES.expansion && a.insurance !== "medicaid") {
      var exp = MEDICAID_STATES.expansion[a.state];
      var line138 = a.householdSize ? Math.round(fpl(a.householdSize, cfg) * 1.38) : null;
      if (exp === true) {
        if (line138 !== null && a.income !== undefined && a.income <= line138)
          reasons.push(a.state + " expanded Medicaid: adults qualify up to about 138% of the poverty line ($" + line138.toLocaleString() + " for a household of " + a.householdSize + "), and you're under it.");
        else { downgrade("maybe", a.state + " expanded Medicaid, but adults are limited to about 138% of the poverty line" + (line138 ? " ($" + line138.toLocaleString() + ")" : "") + ". Children and pregnant people qualify at higher incomes."); }
        reasons.push("Starting Jan 1, 2027, federal law requires most expansion adults to meet work or community-engagement rules" +
          (MEDICAID_STATES.workStates.indexOf(a.state) >= 0 ? ". " + a.state + " is starting early." : "."));
      } else if (exp === false) {
        var par = MEDICAID_STATES.parents[a.state];
        downgrade("maybe", a.state + " did not expand Medicaid. Adults without children usually can't qualify" + (par ? ", and parents only up to about " + par + "% of the poverty line" : "") +
          ". Children and pregnant people qualify at much higher incomes, so apply for them.");
      }
      r = Object.assign({}, r, { maybeReason: null });
      reasons = reasons.filter(function (x) { return x.indexOf("Income rule:") !== 0; });  // the state's real rule replaces the generic one
    }
    if (r.maybeReason) downgrade("maybe", r.maybeReason);

    if (r.needsCommercialDenial && a.insurance === "commercial" && a.commercialDenied === false)
      downgrade("maybe", "With private insurance, usually only if your plan won't cover the drug.");

    if (p.prescriberRequired && a.hasPrescriber === false)
      reasons.push("You'll need a doctor to prescribe it and sign the doctor's section first.");

    if (r.states && a.state && r.states.indexOf(a.state) < 0) downgrade("no", "Only available in certain states.");

    return { program: p, status: status, reasons: reasons };
  }

  function catRank(p) { return p.category in RANK ? RANK[p.category] : 9; }

  function match(a, programs, cfg) {
    return programs
      .map(function (p) { return evaluate(p, a, cfg); })
      .filter(function (m) { return m.status !== "no" || (a.drug && (coversDrug(m.program, a.drug) || excludesDrug(m.program, a.drug))); }) // keep the drug's own programs even if "no", to explain why
      .sort(function (x, y) {
        return STATUS_RANK[x.status] - STATUS_RANK[y.status] ||
          catRank(x.program) - catRank(y.program) ||
          x.program.program.localeCompare(y.program.program);
      });
  }

  // Requirement categories for the "compare programs" view.
  var REQ = [
    ["Proof of income", /income|tax return|pay ?stub|w-?2|1099|social security|benefit statement/i],
    ["Prescription / prescriber section", /prescri|physician|doctor|provider|hcp/i],
    ["Proof of insurance or denial", /insurance|denial|coverage|part d|explanation of benefits|eob|card/i],
    ["Proof of US residency / ID", /residen|address|id\b|identification|citizen|driver/i],
    ["Household size", /household/i],
    ["Signed application / consent", /sign|consent|attest|certif/i]
  ];

  function requirementMatrix(programs) {
    return {
      columns: REQ.map(function (r) { return r[0]; }),
      rows: programs.map(function (p) {
        var text = (p.documents || []).concat(p.otherRequirements || [], p.howToApply || []).join(" | ");
        return { program: p, has: REQ.map(function (r) { return r[1].test(text); }) };
      })
    };
  }

  return { norm: norm, parseDrug: parseDrug, drugIndex: drugIndex, searchDrugs: searchDrugs,
    coversDrug: coversDrug, excludesDrug: excludesDrug, looksLikeDrug: looksLikeDrug, didYouMean: didYouMean, nextQuestion: nextQuestion, evaluate: evaluate, match: match,
    requirementMatrix: requirementMatrix, fpl: fpl, rulesFor: rulesFor, incomeLimit: incomeLimit };
})();

if (typeof module !== "undefined") module.exports = MedsLogic;
