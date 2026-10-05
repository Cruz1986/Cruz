/**
 * Precedence ranks (Table of Liturgical Days, UNLY 59), as numbers where lower wins.
 * Ported from Roman-Calendar RomanCalendarRanks.php: keys are matched exactly first, then
 * as anchored regular expressions in reverse-sorted key order (so "Mem-Other" wins over "Mem").
 */
const RANKS: Record<string, number> = {
  "EW01-0Sun": 1,
  "LW06-6Sat": 1,
  "LW06-5Fri": 1,
  "Nativity of the Lord": 2,
  "CW03-Epiphany": 2,
  "EW07-Ascension": 2,
  "EW08-Pentecost": 2,
  "AW\\d{2}-0Sun": 2.1,
  "LW\\d{2}-0Sun": 2.1,
  "EW\\d{2}-0Sun": 2.1,
  "LW00-3Wed": 2.2,
  LW06: 2.3,
  EW01: 2.4,
  Solemnity: 3.1,
  "OW00-Trinity": 3.1,
  "OW00-CorpusChristi": 3.1,
  "OW00-SacredHeart": 3.1,
  "OW34-0Sun": 3.1,
  "All Souls": 3.2,
  "Solemnity-PrincipalPartron-Place": 4.1,
  "Solemnity-OwnChurchDedication": 4.2,
  "Solemnity-PrincipalPartron-OwnChurch": 4.3,
  "Solemnity-Religious": 4.4,
  "Feast-Lord": 5,
  "CW04-Baptism": 5,
  "CW01-HolyFamily": 5,
  "OW\\d{2}-0Sun": 6,
  "CW\\d{2}-Sun": 6,
  Feast: 7,
  "Feast-PrincipalPartron-Diocese": 8.1,
  "Feast-CathedralDedication": 8.2,
  "Feast-PrincipalPartron-Place": 8.3,
  "Feast-Religious": 8.4,
  "Feast-OwnChurch": 8.5,
  "Feast-Other": 8.6,
  "AW04-Dec": 9.1,
  CW01: 9.2,
  LW: 9.3,
  "Mem-Mary": 10.1,
  Mem: 10.2,
  "Mem-Mary-Sat": 10.3,
  "Mem-SecondaryPatron": 11.1,
  "Mem-OwnChurch": 11.2,
  "Mem-Other": 11.3,
  OpMem: 12.1,
  "OpMem-Commomeration": 12.1,
  AW: 12.2,
  CW: 12.3,
  EW: 12.4,
  OW: 12.5,
};

const PATTERNS = Object.keys(RANKS)
  .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  .map((key) => [new RegExp(`^${key}`), RANKS[key]] as const);

export function rankOf(codeOrType: string): number {
  if (codeOrType in RANKS) return RANKS[codeOrType];
  for (const [pattern, rank] of PATTERNS) if (pattern.test(codeOrType)) return rank;
  throw new Error(`Unknown liturgical code: ${codeOrType}`);
}
