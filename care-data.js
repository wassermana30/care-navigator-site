// Symptoms & diagnoses: where to go, who to see, what to do, and which programs help pay.
// This is care NAVIGATION, not diagnosis. Content stays at the level of "where to go" and
// standard first aid. Emergency warning signs always win.
//
// urgency: "emergency" (911 / ER now) | "today" (urgent care / same day) | "soon" (within days) | "routine" (make an appointment)
// checks:  condition-specific warning-sign questions; a "yes" raises urgency to ifYes.
// programs: extra program ids to highlight (general ones like Medicaid and health centers are always considered).
// drugs:   brand names in our medication database often used for this condition (links into the drug search).

var CARE_RED_FLAGS = [
  { id: "chest", source: { name: "CDC: heart attack signs", url: "https://www.cdc.gov/heart-disease/about/heart-attack.html" }, rx: /chest (pain|pressure|tight|hurts|is hurting|feels heavy)|pain in (my|the) chest|heart attack/i, title: "Possible heart attack", action: "call911" },
  { id: "breathing", rx: /(can'?t|cannot|hard to|trouble|difficulty|struggling to) breath|short(ness)? of breath|choking/i, title: "Trouble breathing", action: "call911" },
  { id: "stroke", source: { name: "CDC: stroke signs", url: "https://www.cdc.gov/stroke/signs-symptoms/index.html" }, rx: /\bstroke\b|face (is )?droop|drooping face|slurred speech|one side of (my|his|her|their) (body|face) (is |went |feels )?(weak|numb)|sudden(ly)? (can'?t|cannot) (see|speak|talk)/i, title: "Possible stroke", action: "call911" },
  { id: "suicide", source: { name: "988 Lifeline", url: "https://988lifeline.org/we-can-all-prevent-suicide/warning-signs/" }, rx: /suicid|kill myself|end my life|want to die|hurt(ing)? myself|self[- ]harm/i, title: "Thoughts of suicide or self-harm", action: "call988" },
  { id: "overdose", rx: /overdos|took too many (pills)?|won'?t wake up|can'?t wake (him|her|them)|unconscious/i, title: "Possible overdose or unresponsive person", action: "call911" },
  { id: "bleeding", rx: /(won'?t|can'?t|doesn'?t) stop bleeding|bleeding (a lot|heavily|badly)|severe bleeding|vomiting blood|coughing up blood/i, title: "Severe bleeding", action: "call911" },
  { id: "anaphylaxis", source: { name: "MedlinePlus: Anaphylaxis", url: "https://medlineplus.gov/ency/article/000844.htm" }, rx: /throat (is )?(closing|swelling|tight)|tongue (is )?swelling|lips? (are |is )?swelling|anaphyla/i, title: "Possible severe allergic reaction", action: "call911" },
  { id: "thunderclap", source: { name: "CDC: stroke signs", url: "https://www.cdc.gov/stroke/signs-symptoms/index.html" }, rx: /worst headache (of my life|ever|i'?ve ever had)|thunderclap headache|sudden(,)? (severe|terrible|horrible|explosive) headache/i, title: "Sudden, severe headache", action: "call911" },
  { id: "open-fracture", source: { name: "MedlinePlus: Broken bone", url: "https://medlineplus.gov/ency/article/000001.htm" }, rx: /bone (is |was )?(poking|sticking|coming|projecting|pushing) (out|through)|through the skin|bone (is )?(out|showing) of (my|his|her|their|the) (skin|arm|leg)|can see (the )?bone/i, title: "A bone through the skin", action: "call911" },
  { id: "seizure-now", rx: /having a seizure|is seizing|seizure (right )?now|seizure (that )?(won'?t|didn'?t) stop/i, title: "Seizure happening now", action: "call911" }
];

var CONDITIONS = [
  { id: "broken-bone", label: "Broken bone (fracture)", rx: /\bbroke (my|his|her|their|a|an) |\bbroken (arm|leg|wrist|ankle|rib|ribs|finger|toe|hand|foot|bone|nose|collarbone|hip|elbow)|fractur|cracked (a |my )?(bone|arm|leg|wrist|ankle|rib|finger|toe|hand|foot)/i, urgency: "today",
    where: "Urgent care or an emergency room for an X-ray. Many urgent cares can X-ray and splint simple breaks.",
    who: ["Urgent care or ER doctor (X-ray and splint)", "Orthopedic specialist for follow-up (cast, setting the bone, or surgery)"],
    checks: [
      { q: "Is a bone poking through the skin?", ifYes: "emergency" },
      { q: "Is the area below the injury pale, cold, clammy, or blue?", ifYes: "emergency" },
      { q: "Could the break be in the head, neck, back, hip, pelvis, or upper leg?", ifYes: "emergency" },
      { q: "Is there severe bleeding, or is the person not responding or losing consciousness?", ifYes: "emergency" }],
    source: { name: "MedlinePlus: Broken bone", url: "https://medlineplus.gov/ency/article/000001.htm" },
    steps: ["Get an X-ray today at urgent care or the ER.", "Ask them to write down the follow-up you need (for example \"see orthopedics within 1 week\").",
      "Book the orthopedic follow-up before you leave. Ask the front desk whether they offer financial assistance or a payment plan.",
      "Keep every bill. If you can't pay, apply for the hospital's financial assistance (our Hospital bill tab walks you through it)."],
    meanwhile: ["Keep the injured part still. Don't try to straighten it.", "Ice wrapped in a cloth, about 20 minutes at a time.", "Raise the injured part if you can do it comfortably."],
    programs: ["emtala", "hill-burton"], drugs: [] },

  { id: "sprain", label: "Sprain or strain", rx: /sprain|twisted (my )?(ankle|wrist|knee)|strain(ed)? (my )?(ankle|wrist|knee|back|muscle)|pulled (a )?muscle|rolled (my )?ankle/i, urgency: "soon",
    where: "A primary care provider or urgent care if it isn't improving in a few days.",
    who: ["Primary care or urgent care", "Physical therapist if it's slow to heal"],
    checks: [{ q: "Can you not put any weight on it at all, or does the bone look out of place?", ifYes: "today" },
      { q: "Is it numb, cold, or turning blue?", ifYes: "emergency" }],
    steps: ["Rest it for a few days.", "If it isn't better in a few days, or you can't walk on it, get it checked. It may need an X-ray.", "Ask about physical therapy if it keeps hurting."],
    meanwhile: ["Rest, ice wrapped in a cloth, gentle compression, and keep it raised."], programs: [], drugs: [] },

  { id: "cut", label: "Cut or wound", rx: /\bcut (my|myself)|laceration|\bgash|need(s)? stitches|deep cut|\bbitten\b|(dog|cat|animal|human) bite|bit by (a|the|my) (dog|cat|animal|spider|snake)/i, urgency: "today",
    where: "Urgent care for cuts that may need stitches (best within a few hours). ER for severe bleeding.",
    who: ["Urgent care or ER"],
    checks: [{ q: "Is it still bleeding after 10 minutes of firm pressure?", ifYes: "emergency" },
      { q: "Is it deep or gaping, or can you see fat, muscle or bone?", ifYes: "today" },
      { q: "Was it an animal or human bite?", ifYes: "today" }],
    steps: ["Get it checked today if it might need stitches.", "Ask whether you need a tetanus shot.", "Watch for redness, swelling, pus or fever over the next days."],
    meanwhile: ["Press firmly with a clean cloth to stop bleeding.", "Rinse gently with clean water once bleeding stops."], programs: ["emtala"], drugs: [] },

  { id: "burn", label: "Burn", rx: /\bburn(ed|t)? (my|myself|on)|\bburns?\b(?! when)(?!ing (when|while))/i, urgency: "soon",
    where: "Small, minor burns can be treated at home. Bigger or deeper burns need urgent care or the ER.",
    who: ["Urgent care or ER for serious burns"],
    checks: [{ q: "Is the burn bigger than your palm, or on the face, hands, feet, groin or a joint?", ifYes: "today" },
      { q: "Is it white, leathery or charred, or from electricity or chemicals?", ifYes: "emergency" }],
    steps: ["Get bigger or blistering burns checked today.", "Watch for signs of infection: spreading redness, pus, fever."],
    meanwhile: ["Cool the burn under cool (not ice-cold) running water for 10 to 20 minutes.", "Cover loosely with a clean bandage. Don't pop blisters."], programs: [], drugs: [] },

  { id: "head-injury", label: "Head injury / concussion", rx: /hit (my |his |her |their )?head|head injury|concussion|bumped (my )?head/i, urgency: "today",
    where: "Get checked today by a doctor or urgent care. Go to the ER right away for any danger sign.",
    who: ["Urgent care or ER", "Primary care for follow-up"],
    checks: [{ q: "Did they lose consciousness, or are they very drowsy or hard to wake?", ifYes: "emergency" },
      { q: "Any seizures, trouble recognizing people or places, or unusual confusion or agitation?", ifYes: "emergency" },
      { q: "Repeated vomiting, a headache that gets worse and won't go away, slurred speech, weakness or numbness, or one pupil larger than the other?", ifYes: "emergency" }],
    source: { name: "CDC HEADS UP: concussion danger signs", url: "https://www.cdc.gov/heads-up/signs-symptoms/index.html" },
    steps: ["Get checked today.", "Have someone stay with the injured person for the first day.", "Rest from screens, sports and heavy thinking until a doctor clears you."],
    meanwhile: [], programs: ["emtala"], drugs: [] },

  { id: "back-pain", label: "Back pain", rx: /back pain|lower back|my back (hurts|is killing)|sciatica|pinched nerve/i, urgency: "routine",
    where: "A primary care provider. A community health center if you don't have a doctor.",
    who: ["Primary care", "Physical therapist", "Spine or orthopedic specialist if it doesn't improve"],
    checks: [{ q: "Have you lost control of your bladder or bowels, or is your groin or inner thigh numb?", ifYes: "emergency" },
      { q: "Did it start after a fall or accident, or do you also have a fever?", ifYes: "today" }],
    steps: ["Make a primary care appointment if it lasts more than a week or two.", "Ask about physical therapy. Many health centers offer it on a sliding scale."],
    meanwhile: ["Keep gently moving. Long bed rest usually doesn't help."], programs: [], drugs: [] },

  { id: "headache", label: "Headache or migraine", rx: /headache|migraine/i, urgency: "routine",
    where: "A primary care provider for frequent headaches or migraines.",
    who: ["Primary care", "Neurologist for hard-to-treat migraines"],
    checks: [{ q: "Is this the worst headache of your life, or did it hit suddenly like a thunderclap?", ifYes: "emergency" },
      { q: "Do you also have a fever and a stiff neck, or confusion?", ifYes: "emergency" },
      { q: "Did it start after a head injury?", ifYes: "today" }],
    steps: ["Keep a headache diary (when, how bad, what helped). Bring it to your appointment.", "Ask whether a preventive migraine medicine makes sense."],
    meanwhile: [], programs: [], drugs: ["Ubrelvy", "Qulipta", "Nurtec ODT", "Emgality", "Ajovy", "Aimovig"] },

  { id: "diabetes", label: "Diabetes / blood sugar", rx: /diabet|blood sugar|\ba1c\b|insulin/i, urgency: "routine",
    where: "A primary care provider for ongoing diabetes care.",
    who: ["Primary care", "Endocrinologist (diabetes specialist)", "Diabetes educator", "Eye doctor once a year"],
    checks: [{ q: "Is blood sugar very high with vomiting, confusion, deep fast breathing, or fruity-smelling breath?", ifYes: "emergency" },
      { q: "Is blood sugar very low with shaking, sweating or confusion that isn't improving after sugar?", ifYes: "emergency" }],
    steps: ["Keep regular primary care visits (often every 3 months until controlled).", "Ask for an A1C test, a yearly eye exam, and a foot check.",
      "If you can't afford insulin or other medicines, use the medication search below. Free programs exist for most insulins."],
    meanwhile: [], programs: ["insulin-35-manufacturer-programs", "medicare-insulin-35-cap"], drugs: ["Lantus", "Humalog", "NovoLog", "Basaglar", "Tresiba", "Ozempic", "Trulicity", "Januvia", "Jardiance"] },

  { id: "blood-pressure", label: "High blood pressure", rx: /blood pressure|hypertension/i, urgency: "routine",
    where: "A primary care provider.",
    who: ["Primary care", "Cardiologist if it's hard to control"],
    checks: [{ q: "Is it very high (around 180/120 or more) with chest pain, shortness of breath, vision changes, or weakness?", ifYes: "emergency" }],
    steps: ["See primary care to confirm the readings and set a plan.", "Check your blood pressure at home or a pharmacy machine and write it down.", "Ask about low-cost generic medicines."],
    meanwhile: [], programs: [], drugs: ["Caduet"] },

  { id: "breathing-condition", label: "Asthma / COPD", rx: /asthma|copd|emphysema|wheez|inhaler|bronchitis/i, urgency: "routine",
    where: "A primary care provider for ongoing care. ER for a severe attack.",
    who: ["Primary care", "Pulmonologist (lung specialist)"],
    checks: [{ q: "Is it hard to speak in full sentences, are lips or fingertips bluish, or is the rescue inhaler not helping?", ifYes: "emergency" }],
    steps: ["Ask for a written action plan for flare-ups.", "If inhalers are too expensive, search for them below. Several have free programs."],
    meanwhile: [], programs: [], drugs: ["Trelegy Ellipta", "Breo Ellipta", "Breztri", "Airsupra", "Wixela Inhub", "Anoro Ellipta", "Yupelri", "Nucala", "Fasenra"] },

  { id: "heart", label: "Heart condition / blood clots", rx: /heart failure|heart disease|afib|a-fib|atrial fibrillation|blood clot|\bdvt\b|cholesterol|irregular heartbeat/i, urgency: "routine",
    where: "Primary care or a cardiologist.",
    who: ["Primary care", "Cardiologist"],
    checks: [{ q: "Any chest pain, fainting, or sudden shortness of breath?", ifYes: "emergency" },
      { q: "Is one leg suddenly swollen, red and painful?", ifYes: "today" }],
    steps: ["Keep regular cardiology or primary care follow-ups.", "Don't stop blood thinners on your own because of cost. Search them below first."],
    meanwhile: [], programs: [], drugs: ["Eliquis", "Xarelto", "Farxiga", "Entresto", "Repatha", "Leqvio", "Vyndamax", "Camzyos"] },

  { id: "kidney", label: "Kidney disease", rx: /kidney/i, urgency: "routine",
    where: "Primary care and a kidney specialist.", who: ["Primary care", "Nephrologist (kidney specialist)"],
    checks: [{ q: "Are you passing very little urine, or have sudden swelling and shortness of breath?", ifYes: "emergency" }],
    steps: ["Ask for regular kidney blood and urine tests.", "Ask about medicines that protect the kidneys."], meanwhile: [], programs: [], drugs: ["Kerendia", "Jynarque", "Lokelma", "Farxiga"] },

  { id: "thyroid", label: "Thyroid condition", rx: /thyroid/i, urgency: "routine",
    where: "A primary care provider.", who: ["Primary care", "Endocrinologist"], checks: [],
    steps: ["Get thyroid blood tests as your doctor recommends.", "Ask about low-cost generic options."], meanwhile: [], programs: [], drugs: ["Synthroid", "Armour Thyroid"] },

  { id: "mental-health", label: "Depression, anxiety or other mental health", rx: /depress|anxiety|anxious|panic attack|mental health|bipolar|schizo|ptsd|can'?t stop crying|feel hopeless|adhd/i, urgency: "soon",
    where: "A community health center (many offer counseling on a sliding scale) or a primary care provider.",
    who: ["Primary care", "Therapist or counselor", "Psychiatrist for medication"],
    checks: [{ q: "Are you having thoughts of hurting yourself or someone else?", ifYes: "crisis" }],
    source: { name: "988 Lifeline: warning signs", url: "https://988lifeline.org/we-can-all-prevent-suicide/warning-signs/" },
    steps: ["You can call or text 988 any time to talk to someone, even if it isn't an emergency.", "Book a visit with a health center or primary care. Say you'd like help with your mental health.",
      "Ask about sliding-scale therapy, and use the medication search if medicine is too expensive."],
    meanwhile: [], programs: ["988", "samhsa-helpline", "health-center-dental"], drugs: ["Trintellix", "Rexulti", "Vraylar", "Viibryd", "Fetzima", "Abilify Maintena", "Intuniv"] },

  { id: "substance-use", label: "Alcohol or drug use", rx: /\baddict|\balcohol(ic|ism)?\b|drinking problem|\bopioids?\b|\bfentanyl\b|\bheroin\b|\bmeth\b|substance use|\brelapse/i, urgency: "soon",
    where: "SAMHSA's free helpline can connect you to treatment near you.",
    who: ["Addiction treatment program", "Primary care"],
    checks: [{ q: "Has someone overdosed, or are they unresponsive or barely breathing?", ifYes: "emergency" }],
    steps: ["Call SAMHSA's National Helpline (free, confidential, 24/7) for treatment referrals.", "Ask about programs that are free or sliding-scale, and about medication-assisted treatment."],
    meanwhile: [], programs: ["samhsa-helpline", "988"], drugs: [] },

  { id: "cold-flu", label: "Cold, flu, cough or fever", rx: /\bcold\b|\bflu\b|cough|fever|sore throat|covid|congest|runny nose|chills/i, urgency: "routine",
    where: "Most colds get better at home. A primary care visit, health center or urgent care if it's severe or lasting.",
    who: ["Primary care, health center, or urgent care"],
    source: { name: "MedlinePlus: Fever (when to call)", url: "https://medlineplus.gov/ency/article/003090.htm" },
    checks: [{ q: "Is this a baby under 3 months old with a fever? (MedlinePlus: call the child's provider right away)", ifYes: "today" },
      { q: "Is there trouble breathing, chest pain, or confusion?", ifYes: "emergency" },
      { q: "Has a fever lasted more than 3 days, or are symptoms getting worse after a week?", ifYes: "today" }],
    steps: ["Rest and drink fluids.", "Get seen if it's lasting or getting worse.", "Ask a pharmacist about low-cost over-the-counter options."],
    meanwhile: [], programs: [], drugs: ["Paxlovid"] },

  { id: "uti", label: "Urinary tract infection", rx: /\buti\b|burn(s|ing)? when (i )?(pee|urinat)|urinary|bladder infection|pee a lot/i, urgency: "soon",
    where: "Primary care, a health center, or urgent care. These are usually treated quickly.",
    who: ["Primary care or urgent care"],
    checks: [{ q: "Do you also have a fever, back or side pain, or vomiting?", ifYes: "today" }, { q: "Are you pregnant?", ifYes: "today" }],
    steps: ["Get seen within a day or two. It usually needs a quick urine test.", "Ask for a low-cost generic antibiotic if one is prescribed."], meanwhile: ["Drink plenty of water."], programs: [], drugs: [] },

  { id: "eye", label: "Eye or vision problem", rx: /\beyes?\b|\bvision\b|blurry|can'?t see well|glaucoma|macular/i, urgency: "routine",
    where: "An eye doctor. ER for sudden vision loss or an eye injury.",
    who: ["Optometrist (glasses, eye exams)", "Ophthalmologist (eye diseases and surgery)"],
    checks: [{ q: "Was there sudden vision loss, a chemical in the eye, or an injury to the eye?", ifYes: "emergency" }],
    steps: ["Book an eye exam. Some health centers offer vision care.", "Ask about low-cost glasses programs."], meanwhile: [], programs: ["health-center-dental"], drugs: ["Eylea", "Vabysmo", "Lumigan", "Restasis"] },

  { id: "dental", label: "Tooth or dental pain", rx: /\btooth|\bteeth\b|\bdental\b|toothache|\bgums?\b|\bcavity|wisdom tooth/i, urgency: "soon",
    where: "A dentist. If you can't afford one, try a health center with dental or a dental school clinic.",
    who: ["Dentist", "Oral surgeon for extractions"],
    checks: [{ q: "Is your face or jaw swelling with fever, or is it hard to swallow or breathe?", ifYes: "emergency" }],
    steps: ["Call a community health center that offers dental care and ask for the soonest visit.", "Dental school clinics offer low-cost care by supervised students."], meanwhile: [], programs: ["health-center-dental", "dental-schools"], drugs: [] },

  { id: "pregnancy", label: "Pregnancy", rx: /pregnan|prenatal|expecting a baby|i'?m expecting/i, urgency: "soon",
    where: "An OB/GYN, midwife, or health center for prenatal care as early as possible.",
    who: ["OB/GYN or midwife", "Community health center"],
    checks: [{ q: "Any heavy bleeding, severe belly pain, or a severe headache with vision changes?", ifYes: "emergency" }],
    steps: ["Start prenatal care early.", "Apply for Medicaid. Pregnant people often qualify at higher incomes than other adults (rules vary by state)."],
    meanwhile: [], programs: ["planned-parenthood-title-x"], drugs: [] },

  { id: "skin", label: "Skin problem or rash", rx: /\brash(es)?\b|\bhives\b|eczema|psoriasis|\bacne\b|itchy skin|skin (problem|condition)|\bmoles?\b/i, urgency: "routine",
    where: "Primary care or a health center first. A dermatologist for ongoing problems.",
    who: ["Primary care", "Dermatologist"],
    checks: [{ q: "Is there swelling of the lips, tongue or throat, or trouble breathing?", ifYes: "emergency" },
      { q: "Is the rash spreading fast with a fever, or blistering and painful?", ifYes: "today" }],
    steps: ["Book a visit. Bring photos if it comes and goes.", "For psoriasis or eczema medicines, use the medication search."], meanwhile: [], programs: [],
    drugs: ["Skyrizi", "Cosentyx", "Bimzelx", "Cimzia", "Taltz", "Sotyktu", "Ebglyss", "Rinvoq"] },

  { id: "digestive", label: "Stomach or digestive problem", rx: /stomach|belly|abdominal|nausea|vomit|diarrhea|constipat|acid reflux|heartburn|crohn|colitis|\bibs\b/i, urgency: "routine",
    where: "Primary care or a health center. ER for severe pain.",
    who: ["Primary care", "Gastroenterologist (GI specialist)"],
    checks: [{ q: "Is there severe belly pain (especially lower right), vomiting blood, or black or bloody stool?", ifYes: "emergency" },
      { q: "Have you been unable to keep fluids down for a day?", ifYes: "today" }],
    steps: ["See primary care if it lasts more than a few days or keeps coming back.", "For ongoing conditions like Crohn's or colitis, ask about a GI specialist."], meanwhile: [], programs: [],
    drugs: ["Linzess", "Dexilant", "Lialda", "Skyrizi", "Rinvoq", "Eohilia", "Viberzi"] },

  { id: "joint", label: "Arthritis or joint pain", rx: /arthritis|joint pain|rheumatoid|\bgout\b|knee pain|hip pain|lupus/i, urgency: "routine",
    where: "Primary care first. A rheumatologist for rheumatoid arthritis or lupus.",
    who: ["Primary care", "Rheumatologist", "Physical therapist"],
    checks: [{ q: "Is a joint suddenly hot, red and very swollen with a fever?", ifYes: "today" }],
    steps: ["Book a primary care visit and ask whether you need a specialist.", "Biologic medicines for arthritis are expensive. Most have free programs (search below)."], meanwhile: [], programs: [],
    drugs: ["Enbrel", "Rinvoq", "Orencia", "Xeljanz", "Cimzia", "Olumiant", "Actemra", "Benlysta"] },

  { id: "cancer", label: "Cancer (diagnosed or suspected)", rx: /cancer|tumou?r|chemo|oncolog|leukemia|lymphoma/i, urgency: "soon",
    where: "An oncologist (cancer specialist). Ask the hospital for a financial counselor on your first visit.",
    who: ["Oncologist", "Hospital financial counselor", "Patient navigator"],
    checks: [],
    steps: ["Ask your care team for a financial counselor or patient navigator. Most cancer centers have them.", "Apply for the hospital's financial assistance (501(r)) before bills pile up.",
      "Cancer drug makers and charities (TotalAssist, HealthWell) have funds for treatment costs."],
    meanwhile: [], programs: ["paf-totalassist", "healthwell-foundation"], drugs: ["Ibrance", "Verzenio", "Revlimid", "Tagrisso", "Xtandi", "Nubeqa", "Cabometyx", "Brukinsa", "Jakafi", "Erleada", "Calquence", "Imbruvica", "Opdivo"] },

  { id: "neuro", label: "Seizures, MS or Parkinson's", rx: /seizure|epilep|multiple sclerosis|\bms\b|parkinson|tremor/i, urgency: "routine",
    where: "A neurologist for ongoing care.", who: ["Neurologist", "Primary care"],
    checks: [{ q: "Was this a first-ever seizure, or did a seizure last more than 5 minutes?", ifYes: "emergency" }],
    steps: ["Keep regular neurology follow-ups.", "Search your medicines below. Most MS and seizure medicines have free programs."], meanwhile: [], programs: [],
    drugs: ["Briviact", "Kesimpta", "Ocrevus", "Mayzent", "Zeposia", "Duopa", "Vyalev", "Nuedexta", "Austedo"] },

  { id: "hiv", label: "HIV, PrEP or hepatitis", rx: /\bhiv\b|\bprep\b|hepatitis|hep c|hep b/i, urgency: "soon",
    where: "A health center or HIV/infectious disease clinic.", who: ["Infectious disease specialist", "Community health center"], checks: [],
    steps: ["Get tested if you haven't. Many health centers test for free or low cost.", "Medicines for HIV, PrEP and hepatitis C have free programs (search below)."],
    meanwhile: [], programs: ["gilead-advancing-access-pap-map"], drugs: ["Biktarvy", "Descovy", "Yeztugo", "Mavyret"] },

  { id: "allergy", label: "Allergies", rx: /allerg/i, urgency: "routine",
    where: "Primary care or an allergist.", who: ["Primary care", "Allergist"],
    checks: [{ q: "Any swelling of the throat, tongue or lips, or trouble breathing?", ifYes: "emergency" }],
    source: { name: "MedlinePlus: Anaphylaxis", url: "https://medlineplus.gov/ency/article/000844.htm" },
    steps: ["Ask whether you need an epinephrine auto-injector.", "Ask about allergy testing."], meanwhile: [], programs: [], drugs: ["Xolair", "Epinephrine auto-injector", "Dymista"] },

  { id: "weight-loss", label: "Weight-loss medication", rx: /weight loss (medication|medicine|drug|shot)|lose weight|obesity|\bwegovy\b|\bzepbound\b/i, urgency: "routine",
    where: "A primary care provider, who can check whether a weight-loss medication is right for you and write the prescription.",
    who: ["Primary care", "Obesity medicine or weight-management clinic"], checks: [],
    steps: ["See primary care to talk about options and get a prescription if it's appropriate.",
      "Free drug-company programs usually exclude weight-loss drugs, so check the cash-price programs and (with Medicare) the GLP-1 Bridge below."],
    meanwhile: [], programs: ["medicare-glp1-bridge", "novocare-wegovy-self-pay", "lillydirect-zepbound-self-pay", "trumprx-gov"], drugs: ["Wegovy", "Zepbound"] },

  { id: "reproductive", label: "Birth control, sexual health or menopause", rx: /birth control|contracept|\biud\b|\bstds?\b|\bstis?\b|menopause|hot flash|period (pain|problem)|endometriosis/i, urgency: "routine",
    where: "A Title X family planning clinic or health center. Costs are based on income.", who: ["Title X clinic or health center", "OB/GYN"], checks: [],
    steps: ["Find a Title X clinic. Visits are free or low cost based on income.", "Ask about free or low-cost birth control options."], meanwhile: [], programs: ["planned-parenthood-title-x"],
    drugs: ["Mirena", "Kyleena", "Skyla", "Xulane", "Orilissa", "Lynkuet"] },

  { id: "general", label: "Pain, illness or a health problem", rx: /\bpain\b|hurts?\b|\bsick\b|symptom|not feeling well|doctor/i, urgency: "soon",
    where: "A primary care provider. No doctor? A community health center or free clinic.", who: ["Primary care", "Community health center"], checks: [],
    steps: ["Book a visit and describe your symptoms, when they started, and what makes them better or worse.", "Ask the clinic about sliding-scale fees before your visit."], meanwhile: [], programs: ["free-clinics"], drugs: [] }
];

var URGENCY = {
  crisis: { rank: 4, label: "Get help now: call or text 988", where: "Call or text 988 (Suicide & Crisis Lifeline), free and 24/7. If someone is in immediate danger, call 911." },
  emergency: { rank: 3, label: "Emergency: call 911 or go to the ER now", where: "Call 911 or go to the nearest emergency room now. Emergency rooms must examine and stabilize you even if you can't pay." },
  today: { rank: 2, label: "Get care today", where: "Urgent care or a same-day clinic today. Go to the ER if it gets worse." },
  soon: { rank: 1, label: "See someone within a few days", where: "Book a visit within a few days." },
  routine: { rank: 0, label: "Make an appointment", where: "Make an appointment with a primary care provider." }
};

if (typeof module !== "undefined") module.exports = { CARE_RED_FLAGS: CARE_RED_FLAGS, CONDITIONS: CONDITIONS, URGENCY: URGENCY };
