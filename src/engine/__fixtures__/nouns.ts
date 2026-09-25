import type { Lexeme } from '../../content/schemas'

/**
 * Test-only noun paradigms for the table-driven tests in
 * src/engine/paradigms.test.ts. Written by Claude, pending human review — they
 * are placeholders under __fixtures__/ (CLAUDE.md rule 1), not content: none
 * of these lexemes exist in content/lexemes/ and none can reach a learner.
 *
 * Some plurals (ledus, medus, lietus) are rare in real use; they are formed
 * regularly here because the test is about the ending table, not frequency.
 */

export interface NounFixture {
  lexeme: Lexeme
  /**
   * Expected form per "case.number" key. `voc.sg` is deliberately absent: the
   * singular vocative is an open gap in every table (see content/_needed.json),
   * so the test asserts inflect() reports a gap for it rather than a form.
   */
  forms: Record<string, string>
}

type SixCases = [nom: string, gen: string, dat: string, acc: string, ins: string, loc: string]

const CASES = ['nom', 'gen', 'dat', 'acc', 'ins', 'loc'] as const

function noun(
  lemma: string,
  gender: 'm' | 'f',
  declension: 1 | 2 | 3 | 4 | 5 | 6,
  sg: SixCases,
  pl: SixCases,
  irregular?: Record<string, string>,
): NounFixture {
  const forms: Record<string, string> = {}
  CASES.forEach((c, i) => {
    forms[`${c}.sg`] = sg[i]
    forms[`${c}.pl`] = pl[i]
  })
  // The plural vocative is always identical to the plural nominative.
  forms['voc.pl'] = pl[0]
  return {
    lexeme: {
      id: `lex_fixture_${lemma}`,
      lemma,
      pos: 'noun',
      gender,
      declension,
      conjugation: null,
      gloss: ['(fixture)'],
      tags: [],
      ...(irregular ? { irregular } : {}),
    },
    forms,
  }
}

export const NOUN_FIXTURES: Record<1 | 2 | 3 | 4 | 5 | 6, NounFixture[]> = {
  1: [
    noun(
      'galds',
      'm',
      1,
      ['galds', 'galda', 'galdam', 'galdu', 'galdu', 'galdā'],
      ['galdi', 'galdu', 'galdiem', 'galdus', 'galdiem', 'galdos'],
    ),
    noun(
      'draugs',
      'm',
      1,
      ['draugs', 'drauga', 'draugam', 'draugu', 'draugu', 'draugā'],
      ['draugi', 'draugu', 'draugiem', 'draugus', 'draugiem', 'draugos'],
    ),
    noun(
      'vīrs',
      'm',
      1,
      ['vīrs', 'vīra', 'vīram', 'vīru', 'vīru', 'vīrā'],
      ['vīri', 'vīru', 'vīriem', 'vīrus', 'vīriem', 'vīros'],
    ),
    noun(
      'tēvs',
      'm',
      1,
      ['tēvs', 'tēva', 'tēvam', 'tēvu', 'tēvu', 'tēvā'],
      ['tēvi', 'tēvu', 'tēviem', 'tēvus', 'tēviem', 'tēvos'],
    ),
    noun(
      'dārzs',
      'm',
      1,
      ['dārzs', 'dārza', 'dārzam', 'dārzu', 'dārzu', 'dārzā'],
      ['dārzi', 'dārzu', 'dārziem', 'dārzus', 'dārziem', 'dārzos'],
    ),
    // -š lemma ending: the stem is "ceļ", not "ceļš" minus "s".
    noun(
      'ceļš',
      'm',
      1,
      ['ceļš', 'ceļa', 'ceļam', 'ceļu', 'ceļu', 'ceļā'],
      ['ceļi', 'ceļu', 'ceļiem', 'ceļus', 'ceļiem', 'ceļos'],
    ),
  ],
  2: [
    // l → ļ in gen.sg and the whole plural.
    noun(
      'brālis',
      'm',
      2,
      ['brālis', 'brāļa', 'brālim', 'brāli', 'brāli', 'brālī'],
      ['brāļi', 'brāļu', 'brāļiem', 'brāļus', 'brāļiem', 'brāļos'],
    ),
    // c → č
    noun(
      'lācis',
      'm',
      2,
      ['lācis', 'lāča', 'lācim', 'lāci', 'lāci', 'lācī'],
      ['lāči', 'lāču', 'lāčiem', 'lāčus', 'lāčiem', 'lāčos'],
    ),
    // p → pj
    noun(
      'skapis',
      'm',
      2,
      ['skapis', 'skapja', 'skapim', 'skapi', 'skapi', 'skapī'],
      ['skapji', 'skapju', 'skapjiem', 'skapjus', 'skapjiem', 'skapjos'],
    ),
    // ķ has no alternation partner: the stem is unchanged.
    noun(
      'kaķis',
      'm',
      2,
      ['kaķis', 'kaķa', 'kaķim', 'kaķi', 'kaķi', 'kaķī'],
      ['kaķi', 'kaķu', 'kaķiem', 'kaķus', 'kaķiem', 'kaķos'],
    ),
    // -s lemma ending within declension 2, with n → ņ.
    noun(
      'suns',
      'm',
      2,
      ['suns', 'suņa', 'sunim', 'suni', 'suni', 'sunī'],
      ['suņi', 'suņu', 'suņiem', 'suņus', 'suņiem', 'suņos'],
    ),
    // gen.sg is irregular ("akmens", not "akmeņa"); the rest is table-driven.
    noun(
      'akmens',
      'm',
      2,
      ['akmens', 'akmens', 'akmenim', 'akmeni', 'akmeni', 'akmenī'],
      ['akmeņi', 'akmeņu', 'akmeņiem', 'akmeņus', 'akmeņiem', 'akmeņos'],
      { 'gen.sg': 'akmens' },
    ),
  ],
  3: [
    noun(
      'tirgus',
      'm',
      3,
      ['tirgus', 'tirgus', 'tirgum', 'tirgu', 'tirgu', 'tirgū'],
      ['tirgi', 'tirgu', 'tirgiem', 'tirgus', 'tirgiem', 'tirgos'],
    ),
    noun(
      'cirkus',
      'm',
      3,
      ['cirkus', 'cirkus', 'cirkum', 'cirku', 'cirku', 'cirkū'],
      ['cirki', 'cirku', 'cirkiem', 'cirkus', 'cirkiem', 'cirkos'],
    ),
    noun(
      'ledus',
      'm',
      3,
      ['ledus', 'ledus', 'ledum', 'ledu', 'ledu', 'ledū'],
      ['ledi', 'ledu', 'lediem', 'ledus', 'lediem', 'ledos'],
    ),
    noun(
      'medus',
      'm',
      3,
      ['medus', 'medus', 'medum', 'medu', 'medu', 'medū'],
      ['medi', 'medu', 'mediem', 'medus', 'mediem', 'medos'],
    ),
    noun(
      'lietus',
      'm',
      3,
      ['lietus', 'lietus', 'lietum', 'lietu', 'lietu', 'lietū'],
      ['lieti', 'lietu', 'lietiem', 'lietus', 'lietiem', 'lietos'],
    ),
  ],
  4: [
    noun(
      'māja',
      'f',
      4,
      ['māja', 'mājas', 'mājai', 'māju', 'māju', 'mājā'],
      ['mājas', 'māju', 'mājām', 'mājas', 'mājām', 'mājās'],
    ),
    noun(
      'grāmata',
      'f',
      4,
      ['grāmata', 'grāmatas', 'grāmatai', 'grāmatu', 'grāmatu', 'grāmatā'],
      ['grāmatas', 'grāmatu', 'grāmatām', 'grāmatas', 'grāmatām', 'grāmatās'],
    ),
    noun(
      'kafija',
      'f',
      4,
      ['kafija', 'kafijas', 'kafijai', 'kafiju', 'kafiju', 'kafijā'],
      ['kafijas', 'kafiju', 'kafijām', 'kafijas', 'kafijām', 'kafijās'],
    ),
    noun(
      'sieva',
      'f',
      4,
      ['sieva', 'sievas', 'sievai', 'sievu', 'sievu', 'sievā'],
      ['sievas', 'sievu', 'sievām', 'sievas', 'sievām', 'sievās'],
    ),
    noun(
      'skola',
      'f',
      4,
      ['skola', 'skolas', 'skolai', 'skolu', 'skolu', 'skolā'],
      ['skolas', 'skolu', 'skolām', 'skolas', 'skolām', 'skolās'],
    ),
  ],
  5: [
    // l → ļ in gen.pl only.
    noun(
      'egle',
      'f',
      5,
      ['egle', 'egles', 'eglei', 'egli', 'egli', 'eglē'],
      ['egles', 'egļu', 'eglēm', 'egles', 'eglēm', 'eglēs'],
    ),
    // p → pj
    noun(
      'upe',
      'f',
      5,
      ['upe', 'upes', 'upei', 'upi', 'upi', 'upē'],
      ['upes', 'upju', 'upēm', 'upes', 'upēm', 'upēs'],
    ),
    // m → mj
    noun(
      'zeme',
      'f',
      5,
      ['zeme', 'zemes', 'zemei', 'zemi', 'zemi', 'zemē'],
      ['zemes', 'zemju', 'zemēm', 'zemes', 'zemēm', 'zemēs'],
    ),
    // z → ž
    noun(
      'roze',
      'f',
      5,
      ['roze', 'rozes', 'rozei', 'rozi', 'rozi', 'rozē'],
      ['rozes', 'rožu', 'rozēm', 'rozes', 'rozēm', 'rozēs'],
    ),
    // d → ž
    noun(
      'priede',
      'f',
      5,
      ['priede', 'priedes', 'priedei', 'priedi', 'priedi', 'priedē'],
      ['priedes', 'priežu', 'priedēm', 'priedes', 'priedēm', 'priedēs'],
    ),
    // t → š
    noun(
      'universitāte',
      'f',
      5,
      [
        'universitāte',
        'universitātes',
        'universitātei',
        'universitāti',
        'universitāti',
        'universitātē',
      ],
      [
        'universitātes',
        'universitāšu',
        'universitātēm',
        'universitātes',
        'universitātēm',
        'universitātēs',
      ],
    ),
  ],
  6: [
    // d → ž in gen.pl only.
    noun(
      'sirds',
      'f',
      6,
      ['sirds', 'sirds', 'sirdij', 'sirdi', 'sirdi', 'sirdī'],
      ['sirdis', 'siržu', 'sirdīm', 'sirdis', 'sirdīm', 'sirdīs'],
    ),
    // v → vj
    noun(
      'zivs',
      'f',
      6,
      ['zivs', 'zivs', 'zivij', 'zivi', 'zivi', 'zivī'],
      ['zivis', 'zivju', 'zivīm', 'zivis', 'zivīm', 'zivīs'],
    ),
    noun(
      'govs',
      'f',
      6,
      ['govs', 'govs', 'govij', 'govi', 'govi', 'govī'],
      ['govis', 'govju', 'govīm', 'govis', 'govīm', 'govīs'],
    ),
    // l → ļ
    noun(
      'pils',
      'f',
      6,
      ['pils', 'pils', 'pilij', 'pili', 'pili', 'pilī'],
      ['pilis', 'piļu', 'pilīm', 'pilis', 'pilīm', 'pilīs'],
    ),
    // t → š after k
    noun(
      'nakts',
      'f',
      6,
      ['nakts', 'nakts', 'naktij', 'nakti', 'nakti', 'naktī'],
      ['naktis', 'nakšu', 'naktīm', 'naktis', 'naktīm', 'naktīs'],
    ),
    // st does not alternate: "valstu", not "valsšu".
    noun(
      'valsts',
      'f',
      6,
      ['valsts', 'valsts', 'valstij', 'valsti', 'valsti', 'valstī'],
      ['valstis', 'valstu', 'valstīm', 'valstis', 'valstīm', 'valstīs'],
    ),
  ],
}
