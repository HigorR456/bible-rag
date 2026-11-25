# Translation and license

**Translation: Biblica® Open Nova Bíblia Viva 2007 (ONBV).**

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Title            | Biblica® Open Nova Bíblia Viva 2007                                |
| Abbreviation/ID  | ONBV / `PORONBV`                                                   |
| Language         | Portuguese (Brazil)                                                |
| Copyright holder | Biblica, Inc. — Copyright © 2007, 2010                             |
| License          | Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)         |
| Source           | [eBible.org — PORONBV](https://ebible.org/bible/details.php?id=poronbv) |
| Declared origin  | www.biblica.com and open.bible                                     |

**Nature of the text:** Nova Bíblia Viva is a dynamic-equivalence
translation in contemporary language. That helps semantic topic search, but
the text must not be presented as a literal translation. API responses and
the prompt must always identify the cited translation (ONBV).

## License obligations (CC BY-SA 4.0)

- Include copyright and origin information, and keep the title unchanged.
- Display the required copyright notice, including the "Biblica" trademark
  statements in Portuguese and English.
- Credit the origin (www.biblica.com and open.bible).
- If the text is altered, indicate the changes visibly and make clear the
  licensor does not necessarily endorse them. The served text is altered
  (markup/footnote cleanup, whitespace normalization, grouping into
  chunks and merging adjacent chunks), so the `attribution` block carries a
  `changes` field with that statement.
- Derivative works must be distributed under the same license (CC BY-SA 4.0).

## Repository actions

- Create `ATTRIBUTION.md` with the copyright notice **copied verbatim** from
  the copyright page of the downloaded package (e.g. the copyright file in
  the eBible download), never written from memory.
- Record: downloaded format (USFM, USFX, VPL, etc.), exact URL, retrieval
  date and the update date reported by the source.
- List the transformations done by the chunking script (removal of footnotes,
  section titles or USFM markup; whitespace normalization). Grouping into
  chunks does not alter words, but any text cleanup must be documented.
- If `chunks_onbv.jsonl` is versioned or published, it remains under
  CC BY-SA 4.0 with the same attribution.
- With no UI, attribution travels **in the API itself**: an `attribution`
  field (including `changes`) in every response containing Bible text, and the same notice in the
  OpenAPI/Swagger description (see
  [../contracts/swagger.md](../contracts/swagger.md)). Consumers who
  display the text are responsible for showing that attribution.

> Operational summary, not legal advice. For commercial use or doubts, read
> the full CC BY-SA 4.0 text and Biblica's terms.

**Do not mix translations in the same index.** Any future translation must
go to a separate index or namespace, with its own verified license.

Application code may have its own license; CC BY-SA 4.0 applies to the
Bible text and data derived from it.
