/* ══════════════════════════════════════════════════════════════════════
   नेपाली क्रियारूप — the linguistic layer.

   This file knows about Nepali and nothing else. It has no idea that a
   Game of Life board exists, and the board has no idea how a verb is
   built: it asks this module to combine two morphemes and to say whether
   the result is a real form, and that is the whole of the contract.

   Three things live here, in this order:
     1. मोर्फोफोनोलोजी — the ordered rules that fire at a morpheme seam
     2. रूपावली        — stems, endings, linkers, paradigms, the lexicon
     3. जाँच           — validation, as a safeguard over the rules above

   Loads as a plain script in the browser (window.Nepali) and as a module
   under Node (require), so the page and the test suite run the same code.
   ══════════════════════════════════════════════════════════════════════ */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Nepali = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
"use strict";

/* ══════════════════════════════════════════════════════════════════════
   देवनागरी सन्धि — orthographic joining.
   Suffixes are written in their abstract form (एँ, ्यौं, इस्). This decides
   how each one is actually spelled once it lands on a given stem:
     गर् + एँ  → गरेँ   (the halanta drops, the vowel becomes a matra)
     खा  + एँ  → खाएँ   (after a vowel it keeps its independent letter)
     ग   + एँ  → गएँ    (inherent अ is a vowel too, so nothing fuses)
   ══════════════════════════════════════════════════════════════════════ */
const VIRAMA = "्";
const MATRA = { "अ":"", "आ":"ा", "इ":"ि", "ई":"ी", "उ":"ु", "ऊ":"ू", "ए":"े", "ऐ":"ै", "ओ":"ो", "औ":"ौ" };
const COMBINING_RE = /[ऺ-ॏ॑-ॗॢॣ़]/;

/* ══════════════════════════════════════════════════════════════════════
   मोर्फोफोनोलोजी — the rules that fire at a morpheme seam.

   Each rule is named, ordered, and reports which one applied, so a
   derivation can be traced rather than guessed at. Adding an alternation
   means adding a rule here — never special-casing a call site.
   ══════════════════════════════════════════════════════════════════════ */

// A base ends in a vowel if its last character is a matra or an independent
// vowel letter. A bare consonant does not: it carries its inherent अ.
const VOWEL_END = /[ािीुूृेैोौअआइईउऊएऐओऔ]$/;

const SANDHI = [
  {
    name: "virama-matra-fusion",
    why: "गर् + एँ → गरेँ — the halanta drops and the vowel becomes a matra",
    when: (base, suffix) => base.endsWith(VIRAMA) && suffix[0] in MATRA,
    apply: (base, suffix) => {
      const stripped = base.slice(0, -1);
      return { s: stripped + MATRA[suffix[0]] + suffix.slice(1), cut: stripped.length };
    },
  },
  {
    name: "virama-absorption",
    why: "जा + न् + छु → जान्छु — a virama-initial suffix lands on a base that has none",
    when: (base, suffix) => suffix[0] === VIRAMA && !base.endsWith(VIRAMA),
    apply: (base, suffix) => ({ s: base + suffix.slice(1), cut: base.length }),
  },
  {
    name: "hiatus",
    why: "खा + ओस् → खाओस्, दि + ओस् → दिओस् — a vowel-final base keeps the "
       + "suffix's independent vowel letter. Nepali writes the hiatus out; no "
       + "य glide is epenthesised. This rule exists so that staying put is a "
       + "decision the model records, not an accident of falling through.",
    when: (base, suffix) => VOWEL_END.test(base) && suffix[0] in MATRA,
    apply: (base, suffix) => ({ s: base + suffix, cut: base.length }),
  },
  {
    name: "concatenate",
    why: "nothing to resolve at the seam",
    when: () => true,
    apply: (base, suffix) => ({ s: base + suffix, cut: base.length }),
  },
];

/** Join a suffix onto a base. Returns the spelled result, where the suffix
 *  begins, and which rule decided it. */
function join(base, suffix){
  if (!base) return { s: suffix, cut: 0, rule: "empty-base" };
  if (!suffix) return { s: base, cut: base.length, rule: "empty-suffix" };
  for (const rule of SANDHI){
    if (rule.when(base, suffix)){
      const { s, cut } = rule.apply(base, suffix);
      return { s, cut, rule: rule.name };
    }
  }
}

/** Assemble morpheme parts into a finished word. */
function assemble(parts){
  let word = "";
  for (const p of parts){ if (p.s) word = join(word, p.s).s; }
  return word;
}

/** Combining marks get a dotted circle, the way grammar books cite them. */
function cite(s){
  if (!s) return "∅";
  return COMBINING_RE.test(s[0]) ? "◌" + s : s;
}

/* ══════════════════════════════════════════════════════════════════════
   PARADIGMS — every inflected form on this page comes from here.
   To correct a form, correct the rule; the whole lexicon follows.
   ══════════════════════════════════════════════════════════════════════ */

const PERSONS = [
  { k:"ma", en:"1st person · singular", reg:"",    pro:"म",            erg:"मैले",           grade:"प्रथम पुरुष" },
  { k:"hami", en:"1st person · plural", reg:"",  pro:"हामी(हरू)",     erg:"हामी(हरू)ले",     grade:"प्रथम बहुवचन" },
  { k:"ta", en:"2nd person · low grade", reg:"intimate — for children and close equals; rude to an adult you don't know well",    pro:"तँ",            erg:"तैंले",           grade:"द्वितीय · निम्न" },
  { k:"timi", en:"2nd person · mid grade", reg:"familiar — friends, juniors, younger relatives",  pro:"तिमी(हरू)",     erg:"तिमी(हरू)ले",     grade:"द्वितीय · मध्यम" },
  { k:"tapai", en:"2nd person · high grade", reg:"polite — elders, strangers, anyone senior to you", pro:"तपाईं(हरू)",    erg:"तपाईं(हरू)ले",    grade:"द्वितीय · आदर", hon:true },
  { k:"u", en:"3rd person · low grade", reg:"children, animals, objects; blunt for an adult",     pro:"ऊ / त्यो",      erg:"उसले / त्यसले",   grade:"तृतीय · निम्न" },
  { k:"uni", en:"3rd person · mid grade", reg:"familiar, and the plural for low and mid alike",   pro:"उनी / उनीहरू",  erg:"उनले / उनीहरूले", grade:"तृतीय · मध्यम" },
  { k:"uha", en:"3rd person · high grade", reg:"respectful — elders, guests, people spoken of politely",   pro:"उहाँ / वहाँ",   erg:"उहाँले",          grade:"तृतीय · आदर", hon:true },
];

// छ-series endings, shared by habitual present, continuous, perfect and future.
const CHA  = { ma:"छु", hami:"छौं", ta:"छस्", timi:"छौ", u:"छ", uni:"छन्" };
// Past endings, shared by simple past and habitual past. One set, both spellings.
const PAST = { ma:"एँ", hami:"यौं", ta:"इस्", timi:"यौ", u:"यो", uni:"ए" };
// अभ्यस्त भूत: the -थ- marker fuses with the ending, so it is one morph here.
const HPAST = { ma:"थेँ", hami:"थ्यौं", ta:"थिस्", timi:"थ्यौ", u:"थ्यो", uni:"थे" };
// थियो-series, for the past compound tenses.
const THI  = { ma:"थिएँ", hami:"थियौं", ta:"थिइस्", timi:"थियौ", u:"थियो", uni:"थिए" };
// -एको participle: plural subjects take -एका.
const PTCP = { ma:"एको", hami:"एका", ta:"एको", timi:"एको", u:"एको", uni:"एका" };

/* Which linker a stem class takes depends on WHICH suffix series follows,
   not on the stem alone. Keying it by series is what keeps the ला-series
   from borrowing the ँ that belongs to the छ- and थ- series — see the note
   on the सम्भावना paradigm below. */
const LINKER = {
  cha: { C:"",  V:"न्", U:"ँ" },   // छु, छौं … and थेँ, थ्यौं …
  da:  { C:"",  V:"ँ",  U:"ँ" },   // दै, दा
  la:  { C:"",  V:"",   U:"" },    // ला, लास्, लौ, लान् — no nasalisation
};

// the names the paradigms already use
const L_CHA = LINKER.cha;
const L_DA  = LINKER.da;

const st  = v => ({ t:"stem", s:v.stem });
const pst = v => ({ t:"stem", s:v.past });
const inf = v => ({ t:"stem", s:v.inf });

const PARADIGMS = [
  {
    id:"habpres", short:"वर्तमान", na:"अभ्यस्त वर्तमान", en:"habitual present", enNote:"regular action, profession, general truth",
    note:"नियमित काम, पेशा, सामान्य सत्य।", ex:"म हरेक बिहान चिया खान्छु।",
    rule:{ C:"धातु + छु", V:"धातु + न् + छु", U:"धातु + ◌ँ + छु" },
    parts(v,k){
      return PERSONS.find(p=>p.k===k).hon
        ? [inf(v), { t:"aux", s:"हुन्छ" }]
        : [st(v), { t:"link", s:L_CHA[v.cls] }, { t:"end", s:CHA[k] }];
    }
  },
  {
    id:"prescont", short:"निरन्तर", na:"वर्तमान निरन्तर", en:"present continuous", enNote:"happening right now, as you speak",
    note:"बोल्दै गर्दा भइरहेको काम।", ex:"म अहिले भात खाँदैछु।",
    rule:{ C:"धातु + दै + छु", V:"धातु + ◌ँ + दै + छु", U:"धातु + ◌ँ + दै + छु" },
    parts(v,k){
      const base = [st(v), { t:"link", s:L_DA[v.cls] }, { t:"end", s:"दै" }];
      return PERSONS.find(p=>p.k===k).hon
        ? base.concat({ t:"aux", s:" हुनुहुन्छ" })
        : base.concat({ t:"aux", s:CHA[k] });
    }
  },
  {
    id:"presperf", short:"पूर्ण", na:"वर्तमान पूर्ण", en:"present perfect", enNote:"done already, and still relevant now",
    note:"भइसकेको, तर अहिलेसम्म असर रहेको काम।", ex:"मैले त्यो किताब पढेको छु।",
    erg:true,
    rule:{ C:"भूत धातु + एको + छु", V:"भूत धातु + एको + छु", U:"उ हटेको धातु + एको + छु" },
    parts(v,k){
      return PERSONS.find(p=>p.k===k).hon
        ? [inf(v), { t:"aux", s:"भएको छ" }]
        : [pst(v), { t:"end", s:PTCP[k] }, { t:"aux", s:" " + CHA[k] }];
    }
  },
  {
    id:"past", short:"भूत", na:"सामान्य भूत", en:"simple past", enNote:"completed, usually at a stated time",
    note:"सकिएको काम, तोकिएको समय।", ex:"मैले हिजो चिठी लेखेँ।",
    erg:true,
    rule:{ C:"धातु + एँ → गरेँ", V:"धातु + एँ → खाएँ", U:"उ हट्छ → आएँ" },
    parts(v,k){
      return PERSONS.find(p=>p.k===k).hon
        ? [inf(v), { t:"aux", s:"भयो" }]
        : [pst(v), { t:"end", s:PAST[k] }];
    }
  },
  {
    id:"habpast", short:"अभ्यस्त भूत", na:"अभ्यस्त भूत", en:"habitual past", enNote:"used to do it regularly — but not any more",
    note:"पहिले नियमित गरिने काम — अब गरिँदैन।", ex:"म बर्सेनि पोखरा जान्थेँ।",
    rule:{ C:"धातु + थेँ", V:"धातु + न् + थेँ", U:"धातु + ◌ँ + थेँ" },
    parts(v,k){
      return PERSONS.find(p=>p.k===k).hon
        ? [inf(v), { t:"aux", s:"हुन्थ्यो" }]
        : [st(v), { t:"link", s:L_CHA[v.cls] }, { t:"end", s:HPAST[k] }];
    }
  },
  {
    id:"pastcont", short:"भूत निरन्तर", na:"भूत निरन्तर", en:"past continuous", enNote:"was in progress at some moment in the past",
    note:"भूतमा कुनै बेला भइरहेको काम।", ex:"म खाना खाँदै थिएँ।",
    rule:{ C:"धातु + दै + थिएँ", V:"धातु + ◌ँ + दै + थिएँ", U:"धातु + ◌ँ + दै + थिएँ" },
    parts(v,k){
      const base = [st(v), { t:"link", s:L_DA[v.cls] }, { t:"end", s:"दै" }];
      return PERSONS.find(p=>p.k===k).hon
        ? base.concat({ t:"aux", s:" हुनुहुन्थ्यो" })
        : base.concat({ t:"aux", s:" " + THI[k] });
    }
  },
  {
    id:"pastperf", short:"भूत पूर्ण", na:"भूत पूर्ण", en:"past perfect", enNote:"finished before some other past event",
    note:"अर्को भूत घटनाभन्दा अघि सकिएको काम।", ex:"ऊ आउनुअघि मैले खाना पकाएको थिएँ।",
    erg:true,
    rule:{ C:"भूत धातु + एको + थिएँ", V:"भूत धातु + एको + थिएँ", U:"उ हटेको धातु + एको + थिएँ" },
    parts(v,k){
      return PERSONS.find(p=>p.k===k).hon
        ? [inf(v), { t:"aux", s:"भएको थियो" }]
        : [pst(v), { t:"end", s:PTCP[k] }, { t:"aux", s:" " + THI[k] }];
    }
  },
  {
    id:"future", short:"भविष्यत्", na:"सामान्य भविष्यत्", en:"simple future", enNote:"mostly written; speech usually uses the habitual present",
    note:"लेख्य भाषामा बढी। बोलीमा प्रायः अभ्यस्त वर्तमानले नै काम चलाउँछ।", ex:"म भोलि काठमाडौं जानेछु।",
    rule:{ C:"धातु + ने + छु", V:"धातु + ने + छु", U:"धातु + ने + छु" },
    parts(v,k){
      return PERSONS.find(p=>p.k===k).hon
        ? [inf(v), { t:"aux", s:"हुनेछ" }]
        : [st(v), { t:"end", s:"ने" }, { t:"end", s:CHA[k] }];
    }
  },
  {
    id:"prob", short:"सम्भावना", na:"सम्भावना", en:"probable", enNote:"guess or likelihood — might, probably will",
    note:"हुन सक्छ, होला भन्ने अनुमान।", ex:"ऊ भोलि आउला।",
    verify:true,
    rule:{ C:"धातु + ला", V:"धातु + ला", U:"धातु + ला" },
    parts(v,k){
      if (PERSONS.find(p=>p.k===k).hon) return [inf(v), { t:"aux", s:"होला" }];
      if (k === "ma") return [st(v), { t:"end", s:{ C:"उँला", V:"उँला", U:"ँला" }[v.cls] }];
      if (k === "hami") return v.cls === "U"
        ? [pst(v), { t:"end", s:"औंला" }]
        : [st(v), { t:"end", s:"औंला" }];
      // The ला-series takes no linker from any stem class. Handing उ-अन्त
      // stems the ँ of the छ-series both misspelled the form (आउँला for
      // ऊ, where the paradigm's own example says आउला) and collapsed म
      // into ऊ, since the 1sg ending for this class is itself ँला.
      const tail = { ta:"लास्", timi:"लौ", u:"ला", uni:"लान्" }[k];
      return [st(v), { t:"link", s:LINKER.la[v.cls] }, { t:"end", s:tail }];
    }
  },
  {
    id:"imp", short:"आज्ञा", na:"आज्ञा र इच्छा", en:"imperative & optative", enNote:"commands, requests, and “let's …”",
    note:"आदेश, अनुरोध, र “गरौं” भन्ने प्रस्ताव।", ex:"कृपया यता आउनुहोस्।",
    rule:{ C:"तिमी → धातु + अ", V:"तिमी → धातु + ऊ", U:"तिमी → उ हट्छ + ऊ" },
    parts(v,k){
      if (PERSONS.find(p=>p.k===k).hon) return [inf(v), { t:"aux", s:"होस्" }];
      const over = v.imp && v.imp[k];
      if (over) return [{ t:"stem", s:over }];
      const base = v.cls === "U" ? v.past : v.stem;
      if (k === "ta") return [{ t:"stem", s:base }];
      const tail = { ma:"ऊँ", hami:"औं", timi:(v.cls === "C" ? "अ" : "ऊ"), u:"ओस्", uni:"ऊन्" }[k];
      return [{ t:"stem", s:base }, { t:"end", s:tail }];
    }
  },
];

/* ── the lexicon ── */
const V = (inf, stem, cls, gloss, tr, extra) =>
  Object.assign({ inf, stem, cls, gloss, tr }, extra || {});

const VERBS = [
  V("गर्नु","गर्","C","to do",true),
  V("भन्नु","भन्","C","to say",true),
  V("हेर्नु","हेर्","C","to look",true),
  V("पढ्नु","पढ्","C","to read",true),
  V("लेख्नु","लेख्","C","to write",true),
  V("सुन्नु","सुन्","C","to hear",true),
  V("बुझ्नु","बुझ्","C","to understand",true),
  V("सिक्नु","सिक्","C","to learn",true),
  V("देख्नु","देख्","C","to see",true),
  V("किन्नु","किन्","C","to buy",true),
  V("राख्नु","राख्","C","to keep",true),
  V("बस्नु","बस्","C","to sit, live",false),
  V("सुत्नु","सुत्","C","to sleep",false),
  V("हिँड्नु","हिँड्","C","to walk",false),

  V("खानु","खा","V","to eat",true),
  V("जानु","जा","V","to go",false,{ past:"ग", irr:"भूत धातु ग" }),
  V("दिनु","दि","V","to give",true,{ imp:{ ta:"दे", timi:"देऊ" } }),
  V("लिनु","लि","V","to take",true,{ imp:{ ta:"ले", timi:"लेऊ" } }),

  V("आउनु","आउ","U","to come",false,{ imp:{ ta:"आइज" } }),
  V("पाउनु","पाउ","U","to get",true),
  V("गाउनु","गाउ","U","to sing",true),
  V("ल्याउनु","ल्याउ","U","to bring",true),
  V("पिउनु","पिउ","U","to drink",true),
  V("नुहाउनु","नुहाउ","U","to bathe",false),
];

// उ-अन्त धातुको भूत रूपमा अन्तिम उ हट्छ: आउ → आ, पिउ → पि
for (const v of VERBS){
  if (!v.past) v.past = v.cls === "U" ? v.stem.replace(/उ$/, "") : v.stem;
}

const CLASS_NAME = { C:"व्यञ्जनान्त", V:"स्वरान्त", U:"उ-अन्त" };

/* ── हुनु: suppletive, so it is written out rather than derived ── */
const HUNU = {
  ho:      { ma:"हुँ",  hami:"हौं",   ta:"होस्",  timi:"हौ",   tapai:"हुनुहुन्छ",    u:"हो",   uni:"हुन्",   uha:"हुनुहुन्छ" },
  chha:    { ma:"छु",   hami:"छौं",   ta:"छस्",   timi:"छौ",   tapai:"हुनुहुन्छ",    u:"छ",    uni:"छन्",    uha:"हुनुहुन्छ" },
  hunchha: { ma:"हुन्छु", hami:"हुन्छौं", ta:"हुन्छस्", timi:"हुन्छौ", tapai:"हुनुहुन्छ",    u:"हुन्छ",  uni:"हुन्छन्",  uha:"हुनुहुन्छ" },
  thiyo:   { ma:"थिएँ", hami:"थियौं", ta:"थिइस्", timi:"थियौ", tapai:"हुनुहुन्थ्यो", u:"थियो", uni:"थिए",    uha:"हुनुहुन्थ्यो" },
  bhayo:   { ma:"भएँ",  hami:"भयौं",  ta:"भइस्",  timi:"भयौ",  tapai:"हुनुभयो",     u:"भयो",  uni:"भए",     uha:"हुनुभयो" },
};

/* ── non-finite forms ── */
const NONFINITE = [
  { n:"क्रियार्थक नाम", g:"dictionary form",       build:v => v.inf },
  { n:"उद्देश्यवाचक",   g:"in order to …",          build:v => join(v.stem, "न").s },
  { n:"भविष्यवाचक",    g:"the one that will …",     build:v => join(v.stem, "ने").s },
  { n:"पूर्णकालिक",     g:"having …-ed",            build:v => join(v.past, "एको").s },
  { n:"पूर्वकालिक",     g:"…-ing, then",            build:v => join(v.past, "एर").s },
  { n:"क्रियाविशेषण",   g:"by …-ing",               build:v => join(v.past, "ई").s },
  { n:"अपूर्णकालिक",    g:"while …-ing",            build:v => join(join(v.stem, L_DA[v.cls]).s, "दै").s },
  { n:"समयवाचक",       g:"when …-ing",             build:v => join(join(v.stem, L_DA[v.cls]).s, "दा").s },
  { n:"सर्तवाचक",      g:"if …",                   build:v => join(v.past, "ए").s + " भने" },
];

/* ── अक्षर segmentation. Lives here because where one अक्षर ends and the
      next begins is a fact about Devanagari, not about cellular automata. ── */
const MARKS = /[ऀ-ः़ा-्॑-ॗॢॣ]/;

/** Split into अक्षर — a consonant plus whatever marks and conjuncts hang off it. */
function clusters(str){
  const out = [];
  let cur = "";
  for (const ch of str){
    if (!cur){ cur = ch; continue; }
    if (MARKS.test(ch) || cur.endsWith(VIRAMA)){ cur += ch; continue; }
    out.push(cur);
    cur = ch;
  }
  if (cur) out.push(cur);
  return out;
}

/* ══════════════════════════════════════════════════════════════════════
   उत्पादन — generation.

   A form is built from a feature bundle (which paradigm, which person),
   never by gluing strings and hoping. Every derivation carries a trace of
   which sandhi rule fired at each seam.
   ══════════════════════════════════════════════════════════════════════ */

const PARADIGM_BY_ID = Object.fromEntries(PARADIGMS.map(p => [p.id, p]));
const PERSON_BY_KEY  = Object.fromEntries(PERSONS.map(p => [p.k, p]));
const VERB_BY_INF    = Object.fromEntries(VERBS.map(v => [v.inf, v]));

/** Generate one cell of the paradigm, with the derivation that produced it. */
function generate(v, paradigmId, personKey){
  if (typeof v === "string") v = VERB_BY_INF[v];
  const para = PARADIGM_BY_ID[paradigmId];
  const person = PERSON_BY_KEY[personKey];
  if (!v) throw new Error("no such verb");
  if (!para) throw new Error("no such paradigm: " + paradigmId);
  if (!person) throw new Error("no such person: " + personKey);

  const parts = para.parts(v, personKey).filter(p => p.s);
  const trace = [];
  let form = "";
  for (const part of parts){
    const step = join(form, part.s);
    trace.push({ add: part.s, type: part.t, rule: step.rule, got: step.s });
    form = step.s;
  }
  return { form, parts, trace, paradigm: para, person, verb: v };
}

/** Every finite form of a verb, tagged with the features that produced it. */
function allForms(v){
  if (typeof v === "string") v = VERB_BY_INF[v];
  const out = [];
  for (const para of PARADIGMS)
    for (const person of PERSONS)
      out.push({ form: generate(v, para.id, person.k).form, paradigm: para.id, person: person.k });
  return out;
}

/** The non-finite forms, which have no person at all. */
function nonFiniteForms(v){
  if (typeof v === "string") v = VERB_BY_INF[v];
  return NONFINITE.map(f => ({ form: f.build(v), name: f.n, gloss: f.g }));
}

/* ══════════════════════════════════════════════════════════════════════
   जाँच — validation.

   This is a safeguard, not the mechanism. Everything below should pass
   because the rules above are right — not because bad output is being
   filtered out at the last moment. A failure here means a rule is wrong.
   ══════════════════════════════════════════════════════════════════════ */

// तपाईं and उहाँ share one form by design: Nepali does not distinguish the
// two honorific subjects in the verb. Any OTHER two persons landing on the
// same form means a person distinction has been lost.
const LICENSED_SYNCRETISM = [["tapai", "uha"]];

function licensed(a, b){
  return LICENSED_SYNCRETISM.some(pair => pair.includes(a) && pair.includes(b));
}

/** Person slots that collapsed into one form when they should not have.
 *  Losing a person distinction is a rule bug, not a spelling slip — this is
 *  the check that catches the सम्भावना class of error generically. */
function paradigmCollisions(v){
  if (typeof v === "string") v = VERB_BY_INF[v];
  const out = [];
  for (const para of PARADIGMS){
    const seen = new Map();
    for (const person of PERSONS){
      const form = generate(v, para.id, person.k).form;
      const other = seen.get(form);
      if (other !== undefined){
        if (!licensed(other, person.k))
          out.push({ paradigm: para.id, form, persons: [other, person.k] });
      } else {
        seen.set(form, person.k);
      }
    }
  }
  return out;
}

/** Orthographic well-formedness of a single string. */
function wellFormed(form){
  const problems = [];
  if (!form) { problems.push("empty"); return problems; }
  if (/^[ा-ौ्ঁँं]/.test(form)) problems.push("begins with a combining mark");
  if (form.includes(VIRAMA + VIRAMA)) problems.push("doubled virama");
  if (/[ािीुूृेैोौ][ािीुूृेैोौ]/.test(form)) problems.push("two matras in a row");
  return problems;
}

/** Full report for one verb: collisions plus malformed strings. */
function audit(v){
  if (typeof v === "string") v = VERB_BY_INF[v];
  return {
    verb: v.inf,
    collisions: paradigmCollisions(v),
    malformed: allForms(v)
      .map(f => Object.assign({}, f, { problems: wellFormed(f.form) }))
      .filter(f => f.problems.length),
  };
}

/** Two finished forms do not combine. गरेको छ + गरेको छ is not a longer word,
 *  it is two words sitting next to each other — and at 14 characters it slips
 *  under any length cap, so it has to be refused on grammatical grounds rather
 *  than on size. `isForm` is supplied by the caller, which owns the lexicon;
 *  this layer never learns what is on the board. */
function canCombine(a, b, isForm){
  if (!a || !b) return true;
  return !(isForm(a) && isForm(b));
}

/** Every form a verb has, as a Set — what the board checks a merge against. */
function formSet(v){
  const s = new Set();
  for (const f of allForms(v)) if (f.form) s.add(f.form);
  for (const f of nonFiniteForms(v)) if (f.form) s.add(f.form);
  if (typeof v === "string") v = VERB_BY_INF[v];
  s.add(v.inf);
  return s;
}

return {
  // morphophonology
  VIRAMA, MATRA, SANDHI, LINKER, join, assemble, cite, clusters,
  // representation
  PERSONS, PARADIGMS, VERBS, HUNU, NONFINITE, CLASS_NAME, L_CHA, L_DA,
  CHA, PAST, HPAST, THI, PTCP,
  // generation
  generate, allForms, nonFiniteForms, formSet, canCombine,
  // validation
  paradigmCollisions, wellFormed, audit, LICENSED_SYNCRETISM,
};
});
