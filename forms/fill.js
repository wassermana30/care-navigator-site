// Fill official program application PDFs in the browser (pdf-lib, no server).
// Only the PATIENT sections are filled. Signatures, dates, and the doctor's section stay
// blank on purpose: the patient signs, and the prescriber completes their part.

var FormFill = (function () {
  // Field names read from the official PDF's form fields (pypdf, 2026-10-14).
  // Radio values: residency /0 = YES, /1 = NO; language /0 English, /1 Spanish, /2 Other; gender /0 male, /1 female.
  var FORMS = {
    "amgen-safety-net-foundation": {
      drug: "Enbrel",
      title: "Amgen Safety Net Foundation application for Enbrel (official form, Jul 2026)",
      b64: function () { return AMGEN_ENBREL_PDF_B64; },
      map: function (p) {
        var ins = p.insurance;
        return {
          text: {
            "first name 1": p.firstName, "last name 1": p.lastName, "middle initial 1": p.middleInitial,
            "address 1": p.address, "city 1": p.city, "state 1": p.state, "zip 1": p.zip,
            "preferred phone 1": p.phone, "email 1": p.email,
            "dob MM 1": p.dobMM, "dob DD 1": p.dobDD, "dob YYYY 1": p.dobYYYY,
            "household size 1": p.householdSize ? String(p.householdSize) : "",
            "household income 1": p.income !== undefined ? Math.round(p.income).toLocaleString() : "",
            "printed name of patient 1": [p.firstName, p.lastName].filter(Boolean).join(" "),
            "printed name of patient 3": [p.firstName, p.lastName].filter(Boolean).join(" ")
          },
          check: {
            "None 1": ins === "none", "Commercial Insurance 1": ins === "commercial",
            "Medicaid 1": ins === "medicaid", "VA 1": ins === "va"
          },
          radio: {
            "residency-radio-yes-no": p.usResident === true ? "0" : p.usResident === false ? "1" : null,
            "language-english-spanish-other": p.language === "en" ? "0" : p.language === "es" ? "1" : null
          }
        };
      }
    }
  };

  function available(programId, drug) {
    var f = FORMS[programId];
    return !!(f && drug && f.drug.toLowerCase() === String(drug).toLowerCase());
  }

  function b64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Returns a Promise of { bytes, filled: [field names], skipped: [field names] }
  function fill(programId, person) {
    var f = FORMS[programId];
    // pdf-lib and the official form (1.2 MB together) load only when someone fills a form.
    var need = typeof loadScript === "function" ? Promise.all([loadScript("vendor/pdf-lib.min.js"), loadScript("forms/amgen-enbrel-pdf.js")]) : Promise.resolve();
    return need.then(function () { return PDFLib.PDFDocument.load(b64ToBytes(f.b64())); }).then(function (doc) {
      var form = doc.getForm(), m = f.map(person), filled = [], skipped = [];
      Object.keys(m.text).forEach(function (k) {
        var v = m.text[k];
        if (!v) { skipped.push(k); return; }
        form.getTextField(k).setText(String(v)); filled.push(k);
      });
      Object.keys(m.check).forEach(function (k) { if (m.check[k]) { form.getCheckBox(k).check(); filled.push(k); } });
      Object.keys(m.radio).forEach(function (k) {
        var v = m.radio[k];
        if (v === null) { skipped.push(k); return; }
        // The PDF names radio choices "Choice1", "Choice2"...; v is the 0-based position (/0, /1...).
        var g = form.getRadioGroup(k); g.select(g.getOptions()[+v]); filled.push(k);
      });
      return doc.save().then(function (bytes) { return { bytes: bytes, filled: filled, skipped: skipped }; });
    });
  }

  return { available: available, fill: fill, FORMS: FORMS };
})();
