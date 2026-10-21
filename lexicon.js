// Slang, casual phrasing and vague descriptions -> plain words the rest of the app understands.
// expand(text) returns the original text PLUS canonical phrases for anything it recognized, so every
// existing pattern (conditions, emergency signs, insurance, income) also catches the casual version.
// Safety-first: anything that could mean an emergency maps to the emergency wording.

var Lexicon = (function () {
  var BODY = "(arm|wrist|hand|finger|thumb|ankle|foot|toe|leg|knee|shoulder|elbow|collarbone|rib|ribs|nose|hip)";
  var WHO = "(my|his|her|their|the|our|[a-z]+'?s)";  // also "son's", "sons", "mom's"
  var RULES = [
    // ---- emergencies (always map to the emergency wording) ----
    [/\b(unalive|kms|kill my ?self|better off dead|end it all|don'?t want to (be here|live|wake up)( anymore)?|wanna die|want to disappear forever|no reason to live|(better|be) off without me|no point (in )?(living|going on)|can'?t go on( anymore)?|thinking about killing)\b/i, " want to end my life "],
    [/\b(od'?d|o\.d\.?|overdosed|took a bunch of pills|took too much)\b/i, " overdose "],
    [/\b(can'?t catch (my|his|her) breath|gasping|can'?t get air|struggling to breathe)\b/i, " trouble breathing "],
    [/\b((clutching|grabbing|holding|gripping) (my|his|her|their) chest|elephant (sitting )?on (my|his|her) chest|chest (is )?(killing|crushing)|squeez\w* (in|on) (my|his|her) chest)\b/i, " chest pain "],
    [/\b(face (went|is) (numb|crooked|lopsided)|talking funny all of a sudden|words (are )?coming out wrong)\b/i, " slurred speech stroke "],
    [/\b(bleeding (out|everywhere|like crazy|nonstop))\b/i, " won't stop bleeding "],
    [/\b(throat (is )?closing up|lips (are )?blowing up|swelling up after (eating|a bee|a sting))\b/i, " throat swelling "],
    // ---- injuries ----
    [new RegExp("\\b(busted|jacked( up)?|messed up|screwed up|smashed|snapped|wrecked|banged up|f\\w*ed up) " + WHO + " " + BODY, "i"), " possibly broken bone fracture "],
    [new RegExp("\\b" + BODY + "\\b[^.!?]{0,40}\\b(crooked|bent( the wrong way)?|deformed|twisted (all )?(the )?wrong way|out of place|sticking out|swollen and purple)", "i"), " possibly broken bone fracture "],
    [/\b(think (it'?s|its) broken|heard a (pop|snap|crack))\b/i, " possibly broken bone fracture "],
    [/\b(rolled|tweaked|twisted) (my|his|her) (ankle|wrist|knee|back)\b/i, " sprained "],
    [/\b(smacked|whacked|banged|bonked|cracked) (my|his|her|their) head|hit (my|his|her) head hard\b/i, " hit my head "],
    [/\b(sliced|gashed|split open) (my|his|her)\b/i, " deep cut need stitches "],
    [/\b(stitches|cut|wound|scrape|scratch|bite)\b[^.!?]{0,50}\b(red|oozing|pus|infected|swollen|hot|leaking)\b/i, " wound infection need stitches "],
    // ---- conditions ----
    [/\b(my|his|her) sugar(s)? (is |are |been |has been |was )?(high|low|off|up|down|crazy|outta whack|out of whack)|\bsugar diabetes\b|\bthe sugar\b|\bmy sugar\b/i, " diabetes blood sugar "],
    [/\b(my|his|her) pressure (is |been |was )?(high|up|through the roof|crazy)|\bhigh pressure\b|\bbp\b/i, " high blood pressure "],
    [/\b(feeling|feel|been|i'?m|im) (so )?(down|low|blue|hopeless|empty|numb inside|in a dark place)\b|can'?t get out of bed|nerves are shot|losing my mind|freaking out all the time|stressed out of my mind/i, " depressed anxiety mental health "],
    [/\b(drinking (a lot|too much|every day)|using again|hooked on|can'?t stop (drinking|using)|on pills bad)\b/i, " substance use addiction "],
    [/\b(throwing up|puking|barfing|the runs|can'?t keep (anything|food) down|tummy|stomach bug)\b/i, " vomiting stomach "],
    [/\b(under the weather|sick as a dog|stuffy|stuffed up|got the flu|caught a bug|coughing up)\b/i, " cold flu cough "],
    [/\b(wheezy|winded all the time|puffer)\b/i, " asthma inhaler "],
    [/\b(knocked up|having a baby|bun in the oven|baby on the way|missed my period)\b/i, " pregnant "],
    [/\b(breaking out|bumps all over|itchy all over)\b/i, " rash skin "],
    [/\b(my )?(tooth|teeth|molar|filling) (is |are )?(killing me|throbbing|cracked|chipped|fell out)\b/i, " toothache dental "],
    [/\b(can'?t see (good|right|straight)|eyes? (are |is )?(messed up|blurry|fuzzy))\b/i, " blurry vision eye "],
    [/\b(blood thinner|thinners?)\b/i, " blood clot heart "],
    [/\b(weight loss (shot|injection|med|medication|drug)|skinny shot|glp-?1)\b/i, " weight loss medication "],
    [/\b(the pill|plan b|morning after)\b/i, " birth control "],
    [/\b(my back is (killing|wrecked|shot)|threw out my back|throw my back out)\b/i, " back pain "],
    [/\b(head(ache)? (is )?(pounding|splitting|killing me))\b/i, " headache "],
    [/\b(feel(ing)? (like )?(crap|garbage|awful|terrible)|not doing (good|well)|something'?s (wrong|off) with me)\b/i, " not feeling well symptom "],
    // ---- insurance & money ----
    [/\b(no (health )?(coverage|ins|insurance|health care)|don'?t got (no )?insurance|ain'?t got (no )?insurance|not covered at all|lost (my )?(job and (my )?)?(health )?(insurance|coverage)|got no insurance)\b/i, " no insurance "],
    [/\b(on the state|state insurance|state medical|state health plan|medi-?cal|medical card|chip card)\b/i, " medicaid "],
    [/\b(obama ?care|aca plan|exchange plan)\b/i, " marketplace insurance "],
    [/\b(insurance (won'?t|wont|don'?t|doesn'?t) (pay|cover)|insurance denied|denied by (my )?insurance)\b/i, " insurance won't cover "],
    [/\b(bring home|take home|clear|pull in|pulling in|making)\b/i, " make "],
    [/\b(single (mom|mother|dad|father|parent) of|(mom|mother|dad|father) of) (\w+)\b/i, function (m, a, b, c, n) { return " me and " + n + " kids "; }],
    [/\b(meds|medicine|prescription)s? (are |is )?(too expensive|too much|outta reach|out of reach)|can'?t afford (my|the) (meds|medicine|prescriptions?|pills)\b/i, " can't afford medication "]
  ];

  function expand(text) {
    var t = String(text || ""), extra = "";
    RULES.forEach(function (r) {
      var m = t.match(r[0]);
      if (m) extra += typeof r[1] === "function" ? r[1].apply(null, m) : r[1];
    });
    return extra ? t + " ||" + extra : t;
  }

  return { expand: expand, RULES: RULES };
})();

if (typeof module !== "undefined") module.exports = Lexicon;
