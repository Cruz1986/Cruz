# Content Rights & Data Sources

Every piece of content shown in the app must have a known source, licence and permission status (PRD §9).
This file records what has been evaluated. It is not legal advice: confirm rights with the holders before launch.

## Rules

1. Nothing is copied from CatholicTamil, ArulVakku or any other website because it is publicly viewable.
2. Every content row references a `content_sources` row (Phase 2). Publishing is blocked unless
   `permission_status = 'verified'` and `license_type <> 'unknown'`.
3. A repository's software licence (MIT, Unlicense, …) covers its **code**. It does not grant rights to
   third-party texts stored in it.
4. Copyrighted text never goes into this repository. Import scripts read it from a local path at import time.

## Evaluated sources

Source: [github.com/jayarathina](https://github.com/jayarathina) (reviewed 2026-10-05).

| Repository                | Content                                                                                         | Code licence | Text rights                                                                 | Decision                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Roman-Calendar            | PHP liturgical calendar generator + `calendar.csv` (feasts, ranks, colours, added/removed year) | Unlicense    | Calendar facts                                                              | **Use.** Port the rules to TypeScript and test against its output                    |
| Tamil-Catholic-Lectionary | Reading lists per liturgical day (~4k rows)                                                     | Unlicense    | References (facts)                                                          | **Use** the reading references                                                       |
| Tamil-Catholic-Lectionary | Tamil lectionary texts (~3.8k rows, partial)                                                    | Unlicense    | Published Church lectionary; no permission recorded. Also used by ArulVakku | **Development only**, `permission_status = pending`. Permission needed before launch |
| Tamil-Bible-Database      | திருவிவிலியம் 2012 (~38.5k verse rows, footnotes, cross-refs, red-letter data)                  | Unlicense    | Published Church translation; no permission recorded                        | **Development only**, `pending`. Permission needed before launch                     |
| Tamil-Bible-OSIS          | Same Bible in OSIS / SWORD format                                                               | None stated  | As above                                                                    | Not needed                                                                           |
| Tamil-Breviary            | Liturgy of the Hours: psalms, hymns, antiphons, intercessions, prayers (partial)                | None         | Published liturgical text; no licence at all                                | **Do not use.** Out of PRD scope; revisit for V2+ with permission                    |

Other sources:

| Source                                                                                | Content                                          | Decision                                                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) `DRC` | Douay-Rheims Bible, Challoner revision (1749–52) | **Use, published.** Public domain. Recorded as a verified public-domain source |

## Status of imported content

| Translation                  | Imported | Public | Why                                                       |
| ---------------------------- | -------- | ------ | --------------------------------------------------------- |
| Douay-Rheims (`en-drc`)      | Yes      | Yes    | Public domain                                             |
| திருவிவிலியம் (`ta-tcb2012`) | Yes      | **No** | Permission pending. Staff can preview it in Admin → Bible |

## Other planned sources

| Content                                      | Plan                                                                |
| -------------------------------------------- | ------------------------------------------------------------------- |
| English Bible                                | Douay-Rheims (public domain) unless another translation is licensed |
| Traditional prayers (Our Father, Hail Mary…) | Traditional wording; record the source of each Tamil version        |
| Saint biographies                            | Original writing, author and reviewer recorded                      |
| Saint images                                 | Wikimedia Commons public domain / CC only, with attribution         |

## Permissions to obtain (owner: project lead)

- [ ] Tamil Catholic Bible (திருவிவிலியம்): rights holder to be confirmed
- [ ] Tamil Lectionary text
- [ ] Optional: contact the maintainer of the jayarathina repositories about their arrangement with the rights holder
