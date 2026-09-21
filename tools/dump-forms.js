/* Dump every form the lexicon can generate, as CSV, for review.
 *
 *   node tools/dump-forms.js            → writes forms.csv
 *   node tools/dump-forms.js out.csv    → writes out.csv
 *
 * One row per feature bundle, including the morpheme breakdown and which
 * sandhi rule fired at each seam, so a wrong form can be traced to the rule
 * that produced it rather than just noticed.
 *
 * subject_marking describes the SUBJECT, not the verb. Ergative -ले is a fact
 * about argument structure; it never selects a conjugation, and no form in
 * this file is generated or constrained by it.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const N = require(path.join(__dirname, "..", "morphology.js"));

const COLUMNS = [
  "verb", "gloss", "class", "class_name", "transitive", "stem", "past_stem",
  "kind", "paradigm", "paradigm_na", "paradigm_en", "person", "person_en",
  "honorific", "subject", "subject_marking", "needs_check", "form", "aksara",
  "morphemes", "rules",
];

const cell = v => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const rows = [];

for (const v of N.VERBS){
  const base = {
    verb: v.inf,
    gloss: v.gloss,
    class: v.cls,
    class_name: N.CLASS_NAME[v.cls],
    transitive: v.tr ? "yes" : "no",
    stem: v.stem,
    past_stem: v.past,
  };

  // finite forms — the full paradigm cross product
  for (const para of N.PARADIGMS){
    for (const person of N.PERSONS){
      const g = N.generate(v, para.id, person.k);
      rows.push(Object.assign({}, base, {
        kind: "finite",
        paradigm: para.id,
        paradigm_na: para.na,
        paradigm_en: para.en,
        person: person.k,
        person_en: person.en,
        honorific: person.hon ? "yes" : "no",
        // A property of the subject's argument structure, NOT of the verb form:
        // म गर्ला and मैले गरुँला carry the same conjugation. Recorded here so
        // the dataset says which subject the form takes, never to gate it.
        subject: para.erg && v.tr ? person.erg : person.pro,
        subject_marking: para.erg && v.tr ? "ergative -ले" : "nominative",
        needs_check: para.verify ? "yes" : "no",
        form: g.form,
        aksara: N.clusters(g.form).join(" "),
        morphemes: g.parts.map(p => `${p.t}:${p.s}`).join(" + "),
        rules: g.trace.map(t => t.rule).join(" > "),
      }));
    }
  }

  // non-finite — no person at all
  for (const f of N.nonFiniteForms(v)){
    rows.push(Object.assign({}, base, {
      kind: "non-finite",
      paradigm: f.name,
      paradigm_en: f.gloss,
      form: f.form,
      aksara: N.clusters(f.form).join(" "),
    }));
  }

  rows.push(Object.assign({}, base, {
    kind: "infinitive",
    form: v.inf,
    aksara: N.clusters(v.inf).join(" "),
  }));
}

// हुनु is suppletive: listed, never derived, so it has no morpheme breakdown
for (const [series, forms] of Object.entries(N.HUNU)){
  for (const [person, form] of Object.entries(forms)){
    const p = N.PERSONS.find(x => x.k === person);
    rows.push({
      verb: "हुनु", gloss: "to be", class: "—", class_name: "अनियमित",
      transitive: "no", kind: "suppletive", paradigm: series,
      person, person_en: p ? p.en : person,
      honorific: p && p.hon ? "yes" : "no",
      form, aksara: N.clusters(form).join(" "),
    });
  }
}

const out = process.argv[2] || path.join(__dirname, "..", "forms.csv");
fs.writeFileSync(
  out,
  COLUMNS.join(",") + "\n" + rows.map(r => COLUMNS.map(c => cell(r[c])).join(",")).join("\n") + "\n",
  "utf8",
);

const distinct = new Set(rows.map(r => r.form)).size;
console.log(`${rows.length} rows · ${distinct} distinct forms → ${path.relative(process.cwd(), out)}`);
