/** Book table: code (as in chunks_onbv.jsonl) -> Portuguese name, order, testament. */

export type Testament = "AT" | "NT";

export interface Book {
  code: string;
  name: string;
  order: number;
  testament: Testament;
}

export const BOOKS = {
  "GEN": { code: "GEN", name: "Gênesis", order: 1, testament: "AT" },
  "EXO": { code: "EXO", name: "Êxodo", order: 2, testament: "AT" },
  "LEV": { code: "LEV", name: "Levítico", order: 3, testament: "AT" },
  "NUM": { code: "NUM", name: "Números", order: 4, testament: "AT" },
  "DEU": { code: "DEU", name: "Deuteronômio", order: 5, testament: "AT" },
  "JOS": { code: "JOS", name: "Josué", order: 6, testament: "AT" },
  "JDG": { code: "JDG", name: "Juízes", order: 7, testament: "AT" },
  "RUT": { code: "RUT", name: "Rute", order: 8, testament: "AT" },
  "1SA": { code: "1SA", name: "1 Samuel", order: 9, testament: "AT" },
  "2SA": { code: "2SA", name: "2 Samuel", order: 10, testament: "AT" },
  "1KI": { code: "1KI", name: "1 Reis", order: 11, testament: "AT" },
  "2KI": { code: "2KI", name: "2 Reis", order: 12, testament: "AT" },
  "1CH": { code: "1CH", name: "1 Crônicas", order: 13, testament: "AT" },
  "2CH": { code: "2CH", name: "2 Crônicas", order: 14, testament: "AT" },
  "EZR": { code: "EZR", name: "Esdras", order: 15, testament: "AT" },
  "NEH": { code: "NEH", name: "Neemias", order: 16, testament: "AT" },
  "EST": { code: "EST", name: "Ester", order: 17, testament: "AT" },
  "JOB": { code: "JOB", name: "Jó", order: 18, testament: "AT" },
  "PSA": { code: "PSA", name: "Salmos", order: 19, testament: "AT" },
  "PRO": { code: "PRO", name: "Provérbios", order: 20, testament: "AT" },
  "ECC": { code: "ECC", name: "Eclesiastes", order: 21, testament: "AT" },
  "SOL": { code: "SOL", name: "Cantares de Salomão", order: 22, testament: "AT" },
  "ISA": { code: "ISA", name: "Isaías", order: 23, testament: "AT" },
  "JER": { code: "JER", name: "Jeremias", order: 24, testament: "AT" },
  "LAM": { code: "LAM", name: "Lamentações", order: 25, testament: "AT" },
  "EZE": { code: "EZE", name: "Ezequiel", order: 26, testament: "AT" },
  "DAN": { code: "DAN", name: "Daniel", order: 27, testament: "AT" },
  "HOS": { code: "HOS", name: "Oseias", order: 28, testament: "AT" },
  "JOE": { code: "JOE", name: "Joel", order: 29, testament: "AT" },
  "AMO": { code: "AMO", name: "Amós", order: 30, testament: "AT" },
  "OBA": { code: "OBA", name: "Obadias", order: 31, testament: "AT" },
  "JON": { code: "JON", name: "Jonas", order: 32, testament: "AT" },
  "MIC": { code: "MIC", name: "Miqueias", order: 33, testament: "AT" },
  "NAH": { code: "NAH", name: "Naum", order: 34, testament: "AT" },
  "HAB": { code: "HAB", name: "Habacuque", order: 35, testament: "AT" },
  "ZEP": { code: "ZEP", name: "Sofonias", order: 36, testament: "AT" },
  "HAG": { code: "HAG", name: "Ageu", order: 37, testament: "AT" },
  "ZEC": { code: "ZEC", name: "Zacarias", order: 38, testament: "AT" },
  "MAL": { code: "MAL", name: "Malaquias", order: 39, testament: "AT" },
  "MAT": { code: "MAT", name: "Mateus", order: 40, testament: "NT" },
  "MAR": { code: "MAR", name: "Marcos", order: 41, testament: "NT" },
  "LUK": { code: "LUK", name: "Lucas", order: 42, testament: "NT" },
  "JOH": { code: "JOH", name: "João", order: 43, testament: "NT" },
  "ACT": { code: "ACT", name: "Atos", order: 44, testament: "NT" },
  "ROM": { code: "ROM", name: "Romanos", order: 45, testament: "NT" },
  "1CO": { code: "1CO", name: "1 Coríntios", order: 46, testament: "NT" },
  "2CO": { code: "2CO", name: "2 Coríntios", order: 47, testament: "NT" },
  "GAL": { code: "GAL", name: "Gálatas", order: 48, testament: "NT" },
  "EPH": { code: "EPH", name: "Efésios", order: 49, testament: "NT" },
  "PHI": { code: "PHI", name: "Filipenses", order: 50, testament: "NT" },
  "COL": { code: "COL", name: "Colossenses", order: 51, testament: "NT" },
  "1TH": { code: "1TH", name: "1 Tessalonicenses", order: 52, testament: "NT" },
  "2TH": { code: "2TH", name: "2 Tessalonicenses", order: 53, testament: "NT" },
  "1TI": { code: "1TI", name: "1 Timóteo", order: 54, testament: "NT" },
  "2TI": { code: "2TI", name: "2 Timóteo", order: 55, testament: "NT" },
  "TIT": { code: "TIT", name: "Tito", order: 56, testament: "NT" },
  "PHM": { code: "PHM", name: "Filemom", order: 57, testament: "NT" },
  "HEB": { code: "HEB", name: "Hebreus", order: 58, testament: "NT" },
  "JAM": { code: "JAM", name: "Tiago", order: 59, testament: "NT" },
  "1PE": { code: "1PE", name: "1 Pedro", order: 60, testament: "NT" },
  "2PE": { code: "2PE", name: "2 Pedro", order: 61, testament: "NT" },
  "1JO": { code: "1JO", name: "1 João", order: 62, testament: "NT" },
  "2JO": { code: "2JO", name: "2 João", order: 63, testament: "NT" },
  "3JO": { code: "3JO", name: "3 João", order: 64, testament: "NT" },
  "JUD": { code: "JUD", name: "Judas", order: 65, testament: "NT" },
  "REV": { code: "REV", name: "Apocalipse", order: 66, testament: "NT" },
} as const satisfies Record<string, Book>;

export type BookCode = keyof typeof BOOKS;

/** Non-empty tuple, usable by `z.enum`. */
export const BOOK_CODES = Object.keys(BOOKS) as [BookCode, ...BookCode[]];

export function isBookCode(value: string): value is BookCode {
  return Object.prototype.hasOwnProperty.call(BOOKS, value);
}
