// Suggestions while typing in the search bar: symptoms, conditions and medications, matched against the word
// (or words) being typed right now, even in the middle of a sentence ("I have a sore thr" -> "sore throat").
// Pure functions so they can be tested. Data: SYMPTOMS, SYMPTOM_CONDITIONS, CONDITIONS, PROGRAMS.

var Suggest = (function () {
  // Readable names for symptoms (the ids aren't always natural), plus everyday words people type for them.
  var SYM = {
    "fever": ["fever", "temperature", "feverish", "hot"], "chills": ["chills", "shivering"], "fatigue": ["tiredness", "tired", "exhausted", "no energy", "weak"],
    "body-aches": ["body aches", "achy"], "night-sweats": ["night sweats"], "weight-loss": ["weight loss", "losing weight"], "weight-gain": ["weight gain"],
    "appetite-loss": ["loss of appetite", "not hungry"], "swollen-glands": ["swollen glands", "lymph nodes"], "thirst": ["thirst", "very thirsty", "dry mouth"],
    "cold-intolerance": ["always cold"], "heat-intolerance": ["always hot", "sweating a lot"], "pale-skin": ["pale skin"], "dehydration-signs": ["dehydration"],
    "headache": ["headache", "head hurts", "head pain", "migraine"], "worst-headache": ["worst headache of my life", "sudden severe headache"], "dizziness": ["dizziness", "dizzy", "lightheaded"],
    "vertigo": ["room spinning", "vertigo"], "fainting": ["fainting", "passed out", "blacked out"], "confusion": ["confusion", "confused"], "memory-problems": ["memory problems", "forgetful"],
    "seizure": ["seizure", "convulsions"], "numbness": ["numbness", "numb"], "tingling": ["tingling", "pins and needles"], "one-side-weakness": ["weakness on one side"],
    "muscle-weakness": ["muscle weakness"], "tremor": ["shaking hands", "tremor"], "trouble-speaking": ["slurred speech", "trouble speaking"], "balance-problems": ["trouble with balance"],
    "stiff-neck": ["stiff neck"], "light-sensitivity": ["sensitive to light"], "face-droop": ["face drooping"], "insomnia": ["can't sleep", "insomnia"], "sleepiness": ["very sleepy", "drowsy"],
    "snoring": ["snoring", "stop breathing in sleep"], "eye-pain": ["eye pain"], "red-eye": ["red eye", "pink eye", "bloodshot eyes"], "eye-discharge": ["goopy eye", "eye discharge"],
    "itchy-eyes": ["itchy eyes", "watery eyes"], "blurred-vision": ["blurry vision"], "vision-loss": ["vision loss", "can't see"], "double-vision": ["double vision"],
    "floaters-flashes": ["floaters", "flashes of light"], "ear-pain": ["ear pain", "earache"], "ear-discharge": ["ear draining"], "hearing-loss": ["hearing loss", "muffled hearing"],
    "ringing-ears": ["ringing in ears"], "sore-throat": ["sore throat", "throat hurts", "strep"], "trouble-swallowing": ["hard to swallow"], "hoarse-voice": ["hoarse voice", "lost my voice"],
    "runny-nose": ["runny nose"], "stuffy-nose": ["stuffy nose", "congestion"], "sneezing": ["sneezing"], "facial-pain": ["sinus pressure", "face pain"], "loss-smell-taste": ["loss of smell or taste"],
    "nosebleed": ["nosebleed"], "toothache": ["toothache", "tooth pain"], "gum-problems": ["bleeding gums", "swollen gums"], "jaw-pain": ["jaw pain"], "mouth-sores": ["mouth sores", "canker sore"],
    "face-swelling": ["swollen face", "swollen cheek"], "cough": ["cough", "coughing"], "phlegm": ["coughing up mucus", "phlegm"], "barking-cough": ["barking cough"],
    "short-breath": ["shortness of breath", "short of breath", "out of breath"], "wheezing": ["wheezing"], "chest-pain": ["chest pain", "chest tightness"],
    "palpitations": ["heart racing", "palpitations", "heart skipping"], "leg-swelling": ["swollen legs", "swollen ankles"], "calf-pain": ["calf pain"], "nausea": ["nausea", "nauseous", "queasy"],
    "vomiting": ["vomiting", "throwing up", "puking"], "diarrhea": ["diarrhea", "loose stool"], "constipation": ["constipation", "constipated"], "bloody-stool": ["blood in stool"],
    "black-stool": ["black stool"], "belly-pain": ["stomach pain", "stomach ache", "stomach hurts", "belly pain", "belly hurts", "tummy ache", "abdominal pain"], "upper-belly-pain": ["upper stomach pain"],
    "lower-right-pain": ["pain in lower right belly"], "pain-after-eating": ["pain after eating"], "heartburn": ["heartburn", "acid reflux"], "bloating": ["bloating", "gas"],
    "yellow-skin": ["yellow skin", "yellow eyes"], "dark-urine": ["dark urine", "dark pee"], "rectal-pain-itch": ["hemorrhoids", "itchy bottom"], "groin-bulge": ["bulge in groin"],
    "painful-urination": ["burning when I pee", "painful urination"], "frequent-urination": ["peeing a lot", "frequent urination"], "urgent-urination": ["urge to pee", "leaking urine"],
    "blood-in-urine": ["blood in urine"], "cloudy-urine": ["cloudy urine"], "flank-pain": ["side pain", "kidney pain"], "weak-stream": ["weak urine stream"],
    "vaginal-discharge": ["vaginal discharge"], "vaginal-itch": ["vaginal itching"], "abnormal-bleeding": ["bleeding between periods", "spotting"], "missed-period": ["missed period", "might be pregnant"],
    "period-pain": ["period cramps", "painful periods"], "heavy-periods": ["heavy periods"], "pelvic-pain": ["pelvic pain"], "pain-with-sex": ["painful sex"], "genital-sores": ["genital sores"],
    "testicle-pain": ["testicle pain"], "penile-discharge": ["penile discharge"], "erection-problems": ["erection problems"], "breast-lump": ["breast lump"], "breast-pain": ["breast pain"],
    "hot-flashes": ["hot flashes"], "rash": ["rash", "red spots"], "itchy-skin": ["itchy skin", "itching"], "hives": ["hives", "welts"], "blisters": ["blisters"],
    "red-warm-skin": ["red, warm, swollen skin"], "dry-scaly-skin": ["dry, scaly skin"], "acne": ["acne", "pimples"], "mole-change": ["changing mole"], "easy-bruising": ["bruising easily"],
    "hair-loss": ["hair loss"], "skin-wound": ["cut or wound"], "burn-skin": ["burn", "sunburn"], "bite-sting": ["bite or sting", "bug bite", "bee sting", "dog bite"], "tick-bite": ["tick bite"],
    "bullseye-rash": ["bull's-eye rash"], "skin-lump": ["boil", "lump under skin"], "scalp-itch": ["itchy scalp", "lice"], "nail-changes": ["nail fungus"],
    "injury": ["injury", "fell", "accident"], "cant-bear-weight": ["can't put weight on it"], "deformity": ["bone out of place"], "back-pain": ["back pain", "lower back pain"],
    "leg-shooting-pain": ["pain shooting down my leg", "sciatica"], "neck-pain": ["neck pain"], "joint-pain": ["joint pain"], "joint-swelling": ["swollen joint"],
    "morning-stiffness": ["stiff in the morning"], "big-toe-pain": ["big toe pain"], "muscle-pain": ["muscle pain", "muscle cramps"], "knee-pain": ["knee pain"],
    "shoulder-pain": ["shoulder pain"], "hand-wrist-pain": ["wrist pain", "hand pain"], "foot-heel-pain": ["heel pain", "foot pain"], "elbow-pain": ["elbow pain"], "ankle-pain": ["ankle pain"],
    "low-mood": ["feeling sad", "depressed", "hopeless"], "anxiety": ["anxiety", "anxious", "worried"], "panic": ["panic attacks"], "mood-swings": ["mood swings"],
    "hallucinations": ["hearing voices", "seeing things"], "trouble-concentrating": ["trouble concentrating"], "trauma-memories": ["flashbacks", "nightmares"],
    "eating-concerns": ["binge eating", "not eating"], "substance-use": ["drinking too much", "drug use", "withdrawal"]
  };
  var index = null;
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function build() {
    if (index) return index;
    index = [];
    Object.keys(SYM).forEach(function (id) {
      SYM[id].forEach(function (w, i) { index.push({ kind: "symptom", label: SYM[id][0], match: norm(w), insert: w, id: id, primary: i === 0 }); });
    });
    (typeof SYMPTOM_CONDITIONS !== "undefined" ? SYMPTOM_CONDITIONS : []).forEach(function (c) {
      var names = [c.label].concat((c.label.match(/\(([^)]+)\)/) || [])[1] ? [c.label.match(/\(([^)]+)\)/)[1]] : [], c.label.replace(/\s*\(.*?\)/g, ""));
      names.forEach(function (n, i) { if (n) index.push({ kind: "condition", label: c.label, match: norm(n), insert: n.replace(/\s*\(.*?\)/g, "").toLowerCase(), id: c.id, primary: i === 0 }); });
    });
    if (typeof PROGRAMS !== "undefined" && typeof MedsLogic !== "undefined") {
      // Every name a medication goes by: brand and generic ("ins" finds Lantus through "insulin glargine").
      MedsLogic.drugIndex(PROGRAMS).forEach(function (d) {
        [d.brand].concat(d.names || []).forEach(function (n, i) { index.push({ kind: "medication", label: d.label || d.brand, match: norm(n), insert: d.brand, brand: d.brand, primary: i === 0 }); });
      });
    }
    return index;
  }
  // The part of the text being typed: the last 1 to 4 words. Longer fragments that match win.
  function fragments(text) {
    var words = norm(text).split(" ").filter(Boolean), out = [];
    for (var n = Math.min(4, words.length); n >= 1; n--) out.push(words.slice(words.length - n).join(" "));
    return out;
  }
  var STOP = { i: 1, a: 1, an: 1, the: 1, my: 1, have: 1, has: 1, and: 1, or: 1, is: 1, it: 1, to: 1, in: 1, of: 1, me: 1, im: 1, "i'm": 1, with: 1, been: 1, so: 1, really: 1, very: 1, bad: 1, need: 1, help: 1 };
  // Returns suggestions: symptoms and conditions first (up to 4), then medications (up to 20),
  // so typing "ins" shows every insulin and typing "sore thr" shows the symptom. Each: { kind, label, insert, fragment, brand?, id? }
  function suggest(text, limit) {
    var r = match(text, 999);
    // Nothing for the half-typed word? Try the words before it ("my stomach hu" -> "stomach").
    if (!r.length) { var w = String(text || "").trim().split(/\s+/); if (w.length > 1) r = match(w.slice(0, -1).join(" "), 999).map(function (x) { x.fragment = x.fragment + " " + w[w.length - 1].toLowerCase(); return x; }); }
    var care = r.filter(function (x) { return x.kind !== "medication"; }).slice(0, 4), meds = r.filter(function (x) { return x.kind === "medication"; }).slice(0, 20);
    return care.concat(meds).slice(0, limit || 24);
  }
  function match(text, limit) {
    var idx = build(), frags = fragments(text), seen = {}, out = [], found = false;
    frags.forEach(function (f, fi) {
      if (found || f.length < 3 || STOP[f]) return;   // a longer piece already matched: don't also match its last word
      idx.forEach(function (e) {
        var pos = e.match.indexOf(f);
        if (pos < 0) return;
        var wordStart = pos === 0 || e.match.charAt(pos - 1) === " ";
        if (!wordStart) return;
        var score = (pos === 0 ? 0 : 10) + fi * 3 + (e.primary ? 0 : 1) + (e.match === f ? -5 : 0) + (e.kind === "symptom" ? 0 : e.kind === "condition" ? 1 : 2) + e.match.length / 100;
        var key = e.kind + ":" + (e.id || e.brand || e.label);
        if (!seen[key] || seen[key].score > score) seen[key] = { kind: e.kind, label: e.label, insert: e.insert, fragment: f, brand: e.brand, id: e.id, score: score };
        found = true;
      });
    });
    Object.keys(seen).forEach(function (k) { out.push(seen[k]); });
    return out.sort(function (a, b) { return a.score - b.score || a.label.localeCompare(b.label); }).slice(0, limit || 8);
  }
  // Put the chosen suggestion into the text, replacing the fragment that was being typed.
  function apply(text, s) {
    var low = text.toLowerCase(), f = s.fragment, at = -1;
    // find the fragment at the end of the text, allowing punctuation differences
    var re = new RegExp(f.split(" ").map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("[^a-z0-9']+") + "[^a-z0-9']*$", "i");
    var m = text.match(re);
    at = m ? m.index : -1;
    return (at >= 0 ? text.slice(0, at) : text + " ") + s.insert;
  }
  return { suggest: suggest, apply: apply, fragments: fragments, SYM: SYM };
})();

if (typeof module !== "undefined") module.exports = Suggest;
