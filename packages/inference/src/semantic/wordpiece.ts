/**
 * wordpiece.ts — pure-TypeScript BERT-uncased tokenizer (WordPiece), no
 * native deps, consumed by the on-device embedder. Mirrors the HuggingFace
 * `tokenizers` BertNormalizer + BertPreTokenizer + WordPiece pipeline;
 * parity with @xenova/transformers is machine-verified per phrase in
 * test/verify_embedder.mjs (exact input_ids equality).
 */

export interface TokenizerSpec {
  modelId: string;
  lowercase: boolean;
  unkToken: string;
  continuingPrefix: string;
  maxInputCharsPerWord: number;
  vocab: Record<string, number>;
}

// BERT _is_punctuation: ASCII blocks 33-47, 58-64, 91-96, 123-126, or any
// Unicode P* category character.
const PUNCT_RE = /\p{P}/u;
function isPunct(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  if ((c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126)) {
    return true;
  }
  return PUNCT_RE.test(ch);
}

const WS_RE = /\s|\p{Zs}/u;
const CONTROL_RE = /\p{Cc}|\p{Cf}/u;
const MARK_RE = /\p{Mn}/gu;

function isCjk(c: number): boolean {
  return (
    (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0x20000 && c <= 0x2a6df) || (c >= 0x2a700 && c <= 0x2b73f) ||
    (c >= 0x2b740 && c <= 0x2b81f) || (c >= 0x2b820 && c <= 0x2ceaf) ||
    (c >= 0xf900 && c <= 0xfaff) || (c >= 0x2f800 && c <= 0x2fa1f)
  );
}

export class WordPieceTokenizer {
  private readonly spec: TokenizerSpec;
  readonly clsId: number;
  readonly sepId: number;
  readonly padId: number;
  private readonly unkId: number;

  constructor(spec: TokenizerSpec) {
    this.spec = spec;
    const need = (t: string): number => {
      const id = spec.vocab[t];
      if (id === undefined) throw new Error(`special token missing: ${t}`);
      return id;
    };
    this.clsId = need('[CLS]');
    this.sepId = need('[SEP]');
    this.padId = need('[PAD]');
    this.unkId = need(spec.unkToken);
  }

  /** [CLS] tokens... [SEP], truncated to maxLen with [SEP] preserved. */
  encode(text: string, maxLen = 128): number[] {
    const words = this.preTokenize(this.normalize(text));
    const ids: number[] = [this.clsId];
    for (const w of words) {
      for (const id of this.wordPiece(w)) {
        if (ids.length >= maxLen - 1) break;
        ids.push(id);
      }
      if (ids.length >= maxLen - 1) break;
    }
    ids.push(this.sepId);
    return ids;
  }

  private normalize(text: string): string {
    // Clean: drop control/format chars and U+FFFD, fold whitespace to space.
    let out = '';
    for (const ch of text) {
      const c = ch.codePointAt(0)!;
      if (c === 0 || c === 0xfffd || (CONTROL_RE.test(ch) && ch !== '\t' && ch !== '\n' && ch !== '\r')) {
        continue;
      }
      out += WS_RE.test(ch) ? ' ' : ch;
    }
    // CJK chars get surrounding spaces (BertNormalizer handle_chinese_chars).
    let spaced = '';
    for (const ch of out) {
      spaced += isCjk(ch.codePointAt(0)!) ? ` ${ch} ` : ch;
    }
    if (this.spec.lowercase) {
      // Lowercase + strip accents (NFD, drop combining marks).
      spaced = spaced.toLowerCase().normalize('NFD').replace(MARK_RE, '');
    }
    return spaced;
  }

  private preTokenize(text: string): string[] {
    const words: string[] = [];
    for (const chunk of text.split(/\s+/)) {
      if (chunk.length === 0) continue;
      // Split punctuation into standalone tokens (BertPreTokenizer).
      let current = '';
      for (const ch of chunk) {
        if (isPunct(ch)) {
          if (current.length > 0) words.push(current);
          words.push(ch);
          current = '';
        } else {
          current += ch;
        }
      }
      if (current.length > 0) words.push(current);
    }
    return words;
  }

  private wordPiece(word: string): number[] {
    const chars = [...word];
    if (chars.length > this.spec.maxInputCharsPerWord) return [this.unkId];
    const pieces: number[] = [];
    let start = 0;
    while (start < chars.length) {
      let end = chars.length;
      let found = -1;
      while (start < end) {
        const sub = (start > 0 ? this.spec.continuingPrefix : '') + chars.slice(start, end).join('');
        const id = this.spec.vocab[sub];
        if (id !== undefined) {
          found = id;
          break;
        }
        end -= 1;
      }
      if (found === -1) return [this.unkId]; // whole word becomes [UNK]
      pieces.push(found);
      start = end;
    }
    return pieces;
  }
}
