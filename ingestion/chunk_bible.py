"""
Bible chunking (eBible.org VPL format) for RAG.

Rules:
- Whole verses only (never cuts a verse in half).
- At most 5 verses per chunk.
- At most 120 words per chunk (concatenated text).
  Exception: a verse that alone exceeds 120 words becomes its own chunk.
- Never mixes chapters or books in the same chunk.

Usage:
    python chunk_bible.py poronbv_vpl.txt chunks.jsonl
"""
import json
import re
import sys

MAX_WORDS = 120
MAX_VERSES = 5

# E.g.: "GEN 1:1 No princípio Deus criou os céus e a terra."
LINE_RE = re.compile(r"^(\w{3})\s+(\d+):(\d+)\s+(.*)$")


def count_words(text):
    return len(text.split())


def read_vpl(path):
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            m = LINE_RE.match(line.strip())
            if not m:
                continue
            book, chap, verse, text = m.groups()
            text = text.strip()
            if text:
                yield book, int(chap), int(verse), text


def make_chunk(book, chap, verses):
    first, last = verses[0][0], verses[-1][0]
    ref = f"{book} {chap}:{first}" + (f"-{last}" if last != first else "")
    text = " ".join(t for _, t in verses)
    return {
        "id": ref.replace(" ", "_").replace(":", "_"),
        "ref": ref,
        "book": book,
        "chapter": chap,
        "verse_start": first,
        "verse_end": last,
        "word_count": count_words(text),
        "text": text,
    }


def chunk(verses_iter):
    buf, cur_key, cur_words = [], None, 0
    for book, chap, vnum, text in verses_iter:
        key = (book, chap)
        words = count_words(text)
        if buf and (key != cur_key or len(buf) >= MAX_VERSES
                    or cur_words + words > MAX_WORDS):
            yield make_chunk(*cur_key, buf)
            buf, cur_words = [], 0
        buf.append((vnum, text))
        cur_key, cur_words = key, cur_words + words
    if buf:
        yield make_chunk(*cur_key, buf)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    n = over = 0
    with open(dst, "w", encoding="utf-8") as out:
        for c in chunk(read_vpl(src)):
            out.write(json.dumps(c, ensure_ascii=False) + "\n")
            n += 1
            over += c["word_count"] > MAX_WORDS
    print(f"{n} chunks generated; {over} above {MAX_WORDS} words (single long verse).")


if __name__ == "__main__":
    main()
