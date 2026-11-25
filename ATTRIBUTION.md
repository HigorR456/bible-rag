# Attribution

This project serves text from **Biblica® Open Nova Bíblia Viva 2007 (ONBV)**,
licensed under the Creative Commons Attribution-ShareAlike 4.0 International
License (CC BY-SA 4.0): <https://creativecommons.org/licenses/by-sa/4.0>

## Notice served by the API

The text between the markers below is the `notice` and `changes` served in
the `attribution` block of every response containing Bible text. The
`src/attribution.ts` constant must match it exactly (checked by a test).
The copyright notice is copied verbatim from the copyright page of the
source package ([ebible.org/poronbv/copr.htm](https://ebible.org/poronbv/copr.htm)).

<!-- attribution:start -->
## notice

Biblica® Open Nova Bíblia Viva™
Copyright © 2007, 2010 by Biblica, Inc.
“Biblica” é uma marca registrada na Oficina de Patentes e Marcas dos Estados Unidos por Biblica, Inc. Usado com permissão.
“Biblica” is a trademark registered in the United States Patent and Trademark Office by Biblica, Inc. Used with permission.
The original Work by its copyright holders is available for free at www.biblica.com and open.bible.
License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0), https://creativecommons.org/licenses/by-sa/4.0

## changes

This is a derivative work. The text was altered: footnotes, section titles and markup were removed, whitespace was normalized, verses were grouped into chunks of up to 5 verses (at most 120 words, never crossing a chapter or book), and adjacent chunks may be merged in responses. The wording of the verses was not changed. The original licensor, Biblica, Inc., does not necessarily endorse these changes.
<!-- attribution:end -->

## Provenance

| Field                | Value                                                         |
| -------------------- | ------------------------------------------------------------- |
| Title                | Biblica® Open Nova Bíblia Viva 2007 (ONBV, ID `PORONBV`)      |
| Language             | Portuguese (Brazil)                                           |
| Copyright holder     | Biblica, Inc. — Copyright © 2007, 2010                        |
| License              | CC BY-SA 4.0                                                  |
| Source page          | <https://ebible.org/bible/details.php?id=poronbv>             |
| Package URL          | <https://ebible.org/bible/details.php?id=poronbv> (`poronbv_vpl.zip`, BibleWorks import, VPL format) |
| Declared origin      | www.biblica.com and open.bible                                |
| Source update date   | 2025-05-20 (reported by eBible.org)                           |
| Retrieved on         | 2026-11-13 |

## Transformations

Done by [`ingestion/chunk_bible.py`](ingestion/chunk_bible.py), which
produces `ingestion/chunks_onbv.jsonl`:

- Reads one verse per line from the VPL file (`BOOK C:V text`); lines that
  do not match, and verses with empty text, are skipped.
- Strips surrounding whitespace from each verse; verses are joined with a
  single space inside a chunk.
- Groups whole verses into chunks of at most 5 verses and 120 words, never
  mixing chapters or books. A single verse above 120 words becomes its own
  chunk.
- Verse wording is never altered or cut.

At response time, adjacent chunks may be merged (see
[query flow](specs/flows/query.md)).

## Redistribution

`chunks_onbv.jsonl` and any other data derived from the ONBV text remain
under CC BY-SA 4.0 with this same attribution. Application code may have
its own license.
