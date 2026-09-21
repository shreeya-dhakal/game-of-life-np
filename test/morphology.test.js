/* Tests for the Nepali linguistic layer.
 *
 *   node --test
 *
 * The suite is organised around the claim the experiment makes: if a feature
 * bundle names a real Nepali form, the generator must produce that form — not
 * something that merely looks Nepali, and not two different bundles collapsing
 * onto one string.
 */

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("../morphology.js");

const verb = inf => N.VERBS.find(v => v.inf === inf);
const form = (inf, paradigm, person) => N.generate(verb(inf), paradigm, person).form;
const ruleFor = (base, suffix) => N.join(base, suffix).rule;

/* ══════════════════════════════════════════════════════════════════
   1. मोर्फोफोनोलोजी — each seam rule fires where it should
   ══════════════════════════════════════════════════════════════════ */

test("virama-matra-fusion: a halanta base absorbs a following vowel", () => {
  assert.equal(N.join("गर्", "एँ").s, "गरेँ");
  assert.equal(ruleFor("गर्", "एँ"), "virama-matra-fusion");
  assert.equal(N.join("गर्", "ओस्").s, "गरोस्");
  assert.equal(N.join("लेख्", "एको").s, "लेखेको");
});

test("hiatus: a vowel-final base keeps the independent vowel letter", () => {
  // Nepali writes the hiatus out. No य glide is epenthesised — this is the
  // language, not an oversight, so it is pinned here as a regression guard.
  assert.equal(N.join("खा", "ओस्").s, "खाओस्");
  assert.equal(ruleFor("खा", "ओस्"), "hiatus");
  assert.equal(N.join("दि", "ओस्").s, "दिओस्");
  assert.equal(N.join("दि", "ऊन्").s, "दिऊन्");
  assert.equal(N.join("खा", "एँ").s, "खाएँ");
});

test("inherent अ is a vowel, so a bare consonant does not fuse", () => {
  // the suppletive past stem ग- gives गएँ, never गेँ
  assert.equal(N.join("ग", "एँ").s, "गएँ");
  assert.equal(ruleFor("ग", "एँ"), "concatenate");
});

test("virama-absorption: a virama-initial suffix lands on a bare base", () => {
  assert.equal(N.join("ग", "्य").s, "गय");
  assert.equal(ruleFor("ग", "्य"), "virama-absorption");
  // but a base that already has a virama keeps it
  assert.equal(N.join("गर्", "्य").s, "गर््य");
});

test("empty operands are handled without inventing a seam", () => {
  assert.equal(N.join("", "छु").s, "छु");
  assert.equal(N.join("गर्", "").s, "गर्");
  assert.equal(N.join("", "").s, "");
});

/* ══════════════════════════════════════════════════════════════════
   2. Attested forms that must keep working
   ══════════════════════════════════════════════════════════════════ */

test("गर्नु — व्यञ्जनान्त paradigm", () => {
  assert.equal(form("गर्नु", "habpres", "ma"), "गर्छु");
  assert.equal(form("गर्नु", "habpres", "u"), "गर्छ");
  assert.equal(form("गर्नु", "past", "ma"), "गरेँ");
  assert.equal(form("गर्नु", "presperf", "ma"), "गरेको छु");
  assert.equal(form("गर्नु", "habpast", "ma"), "गर्थेँ");
  assert.equal(form("गर्नु", "future", "ma"), "गर्नेछु");
  assert.equal(form("गर्नु", "imp", "tapai"), "गर्नुहोस्");
});

test("दिनु — forms cross-checked against published tables", () => {
  // learnnp.com's दिनु tables; these are the externally attested spellings
  assert.equal(form("दिनु", "habpres", "ma"), "दिन्छु");
  assert.equal(form("दिनु", "habpres", "u"), "दिन्छ");
  assert.equal(form("दिनु", "past", "ma"), "दिएँ");
  assert.equal(form("दिनु", "past", "u"), "दियो");
  assert.equal(form("दिनु", "past", "uni"), "दिए");
  assert.equal(form("दिनु", "future", "ma"), "दिनेछु");
  assert.equal(form("दिनु", "imp", "tapai"), "दिनुहोस्");
});

test("खानु — स्वरान्त takes the न् linker before the छ-series", () => {
  assert.equal(form("खानु", "habpres", "ma"), "खान्छु");
  assert.equal(form("खानु", "past", "ma"), "खाएँ");
  assert.equal(form("खानु", "imp", "u"), "खाओस्");
});

test("आउनु — उ-अन्त nasalises before the छ- and द-series", () => {
  assert.equal(form("आउनु", "habpres", "ma"), "आउँछु");
  assert.equal(form("आउनु", "prescont", "ma"), "आउँदैछु");
  assert.equal(form("आउनु", "habpast", "ma"), "आउँथेँ");
});

test("honorific persons are built periphrastically, not by suffix", () => {
  assert.equal(form("गर्नु", "habpres", "tapai"), "गर्नुहुन्छ");
  assert.equal(form("गर्नु", "past", "tapai"), "गर्नुभयो");
  assert.equal(form("गर्नु", "presperf", "tapai"), "गर्नुभएको छ");
  // तपाईं and उहाँ are one form by design
  assert.equal(form("गर्नु", "habpres", "tapai"), form("गर्नु", "habpres", "uha"));
});

/* ══════════════════════════════════════════════════════════════════
   3. The bug: the ला-series took a linker that is not its own
   ══════════════════════════════════════════════════════════════════ */

test("सम्भावना — उ-अन्त stems take NO linker before ला", () => {
  // was आउँलास् / आउँलौ / आउँला / आउँलान्
  assert.equal(form("आउनु", "prob", "ta"), "आउलास्");
  assert.equal(form("आउनु", "prob", "timi"), "आउलौ");
  assert.equal(form("आउनु", "prob", "u"), "आउला");
  assert.equal(form("आउनु", "prob", "uni"), "आउलान्");
});

test("सम्भावना — the generated 3sg matches the paradigm's own example", () => {
  // the paradigm carries ex:"ऊ भोलि आउला।" — the generator used to contradict it
  const prob = N.PARADIGMS.find(p => p.id === "prob");
  assert.match(prob.ex, /आउला/);
  assert.ok(prob.ex.includes(form("आउनु", "prob", "u")));
});

test("सम्भावना — 1sg and 3sg stay distinct for every stem class", () => {
  // the old ँ linker collapsed म into ऊ for every उ-अन्त verb
  for (const v of N.VERBS){
    assert.notEqual(
      N.generate(v, "prob", "ma").form,
      N.generate(v, "prob", "u").form,
      `${v.inf}: 1sg and 3sg collapsed onto one form`,
    );
  }
});

test("सम्भावना — the 1sg ँला is untouched, since that ँ IS the ending", () => {
  assert.equal(form("आउनु", "prob", "ma"), "आउँला");
  assert.equal(form("गर्नु", "prob", "ma"), "गरुँला");
  assert.equal(form("खानु", "prob", "ma"), "खाउँला");
});

test("the linker table is keyed by series, not by stem class alone", () => {
  // same stem class, three different answers depending on what follows
  assert.equal(N.LINKER.cha.U, "ँ");
  assert.equal(N.LINKER.da.U, "ँ");
  assert.equal(N.LINKER.la.U, "");
  // and the ला-series takes nothing from anyone
  assert.deepEqual(Object.values(N.LINKER.la), ["", "", ""]);
});

test("the fix does not leak into the छ- or थ- series", () => {
  assert.equal(form("आउनु", "habpres", "u"), "आउँछ");
  assert.equal(form("आउनु", "habpast", "u"), "आउँथ्यो");
  assert.equal(form("आउनु", "prescont", "u"), "आउँदैछ");
});

/* ══════════════════════════════════════════════════════════════════
   4. Combinations that must be rejected
   ══════════════════════════════════════════════════════════════════ */

test("an unknown feature bundle is refused, not guessed at", () => {
  assert.throws(() => N.generate(verb("गर्नु"), "subjunctive", "ma"), /no such paradigm/);
  assert.throws(() => N.generate(verb("गर्नु"), "habpres", "vous"), /no such person/);
  assert.throws(() => N.generate("नभएको्नु", "habpres", "ma"), /no such verb/);
});

test("no paradigm loses a person distinction, for any verb", () => {
  for (const v of N.VERBS){
    const collisions = N.paradigmCollisions(v);
    assert.deepEqual(collisions, [], `${v.inf}: ${JSON.stringify(collisions)}`);
  }
});

test("only तपाईं/उहाँ syncretism is licensed", () => {
  assert.deepEqual(N.LICENSED_SYNCRETISM, [["tapai", "uha"]]);
});

test("wellFormed rejects orthographically impossible strings", () => {
  assert.deepEqual(N.wellFormed("गरेँ"), []);
  assert.deepEqual(N.wellFormed("आउला"), []);
  assert.ok(N.wellFormed("").includes("empty"));
  assert.ok(N.wellFormed("ेगर").includes("begins with a combining mark"));
  assert.ok(N.wellFormed("गर््").includes("doubled virama"));
  assert.ok(N.wellFormed("गेा").includes("two matras in a row"));
});

test("the whole corpus is clean — every verb, every bundle", () => {
  for (const v of N.VERBS){
    const report = N.audit(v);
    assert.deepEqual(report.collisions, [], `${v.inf} collisions`);
    assert.deepEqual(report.malformed, [], `${v.inf} malformed`);
  }
});

/* ══════════════════════════════════════════════════════════════════
   5. Nepali-specific edge cases
   ══════════════════════════════════════════════════════════════════ */

test("जानु is suppletive in the past — the stem is ग, not जा", () => {
  assert.equal(verb("जानु").past, "ग");
  assert.equal(form("जानु", "past", "ma"), "गएँ");
  assert.equal(form("जानु", "past", "u"), "गयो");
  assert.equal(form("जानु", "presperf", "ma"), "गएको छु");
  // but the present is built on जा
  assert.equal(form("जानु", "habpres", "ma"), "जान्छु");
});

test("उ-अन्त stems drop their उ in the past", () => {
  assert.equal(verb("आउनु").past, "आ");
  assert.equal(verb("पिउनु").past, "पि");
  assert.equal(form("आउनु", "past", "ma"), "आएँ");
  assert.equal(form("पिउनु", "past", "ma"), "पिएँ");
});

test("irregular imperatives override the derived form", () => {
  assert.equal(form("दिनु", "imp", "ta"), "दे");
  assert.equal(form("दिनु", "imp", "timi"), "देऊ");
  assert.equal(form("लिनु", "imp", "ta"), "ले");
  assert.equal(form("आउनु", "imp", "ta"), "आइज");
  // and a verb with no override still derives normally
  assert.equal(form("गर्नु", "imp", "timi"), "गर");
});

test("the participle agrees in number", () => {
  assert.equal(form("गर्नु", "presperf", "ma"), "गरेको छु");
  assert.equal(form("गर्नु", "presperf", "hami"), "गरेका छौं");
  assert.equal(form("गर्नु", "pastperf", "uni"), "गरेका थिए");
});

test("हुनु is suppletive throughout and is not derived", () => {
  assert.equal(N.HUNU.ho.ma, "हुँ");
  assert.equal(N.HUNU.chha.ma, "छु");
  assert.equal(N.HUNU.bhayo.u, "भयो");
  assert.ok(!N.VERBS.some(v => v.inf === "हुनु"), "हुनु must not be in the derived lexicon");
});

test("अक्षर segmentation keeps conjuncts and matras with their consonant", () => {
  assert.deepEqual(N.clusters("गरेँ"), ["ग", "रेँ"]);
  assert.deepEqual(N.clusters("आउला"), ["आ", "उ", "ला"]);
  assert.deepEqual(N.clusters("नमस्कार"), ["न", "म", "स्का", "र"]);
  assert.deepEqual(N.clusters("गर्छु"), ["ग", "र्छु"]);
  assert.deepEqual(N.clusters(""), []);
});

test("every generated form segments into at least one अक्षर", () => {
  for (const v of N.VERBS)
    for (const f of N.allForms(v))
      assert.ok(N.clusters(f.form).length > 0, `${v.inf} ${f.paradigm} ${f.person}`);
});

test("a derivation reports which rule fired at each seam", () => {
  const { trace, form: out } = N.generate(verb("गर्नु"), "past", "ma");
  assert.equal(out, "गरेँ");
  assert.ok(trace.length >= 2);
  assert.equal(trace.at(-1).rule, "virama-matra-fusion");
});

test("non-finite forms are built from the right stem", () => {
  const nf = N.nonFiniteForms(verb("जानु"));
  const by = name => nf.find(f => f.n === name || f.name === name).form;
  assert.equal(by("पूर्णकालिक"), "गएको");   // past stem
  assert.equal(by("भविष्यवाचक"), "जाने");   // present stem
});
