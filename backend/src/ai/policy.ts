import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

export interface PolicyChunk {
  source: string;
  text: string;
}

export interface PolicySearchResult {
  source: string;
  text: string;
  score: number;
}

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'for', 'to', 'of',
  'in', 'with', 'if', 'are', 'be', 'by', 'as', 'can', 'not', 'only', 'may',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

class PolicyStore {
  private chunks: PolicyChunk[] = [];
  private idf: Map<string, number> = new Map();
  private loaded = false;

  private resolvePolicyDir(): string {
    const candidates = [
      path.resolve(process.cwd(), 'policy'),
      path.resolve(__dirname, '../../policy'),
      path.resolve(__dirname, '../../../policy'),
    ];
    for (const dir of candidates) {
      if (fs.existsSync(dir)) return dir;
    }
    return candidates[0];
  }

  public load(): void {
    if (this.loaded) return;
    const dir = this.resolvePolicyDir();
    if (!fs.existsSync(dir)) {
      logger.warn({ dir }, 'Policy directory not found');
      this.loaded = true;
      return;
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
    const chunks: PolicyChunk[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const paragraphs = content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

      let buffer = '';
      for (const para of paragraphs) {
        if (buffer.length + para.length + 2 <= 500) {
          buffer = buffer ? `${buffer}\n\n${para}` : para;
        } else {
          if (buffer) chunks.push({ source: file, text: buffer });
          buffer = para.slice(0, 500);
        }
      }
      if (buffer) {
        chunks.push({ source: file, text: buffer });
      }
    }

    this.chunks = chunks;
    const docFreq = new Map<string, number>();
    for (const chunk of chunks) {
      const uniqueTerms = new Set(tokenize(chunk.text));
      for (const term of uniqueTerms) {
        docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
      }
    }

    const n = Math.max(1, chunks.length);
    for (const [term, df] of docFreq.entries()) {
      this.idf.set(term, Math.log((n + 1) / (df + 1)) + 1);
    }

    this.loaded = true;
  }

  public search(category: string, query: string, topK = 3): PolicySearchResult[] {
    this.load();
    const terms = tokenize(`${category} ${query}`);
    if (terms.length === 0) {
      return this.chunks.slice(0, topK).map((c) => ({ ...c, score: 0 }));
    }

    const scored = this.chunks.map((chunk) => {
      const chunkTokens = tokenize(chunk.text);
      const tf = new Map<string, number>();
      for (const tok of chunkTokens) {
        tf.set(tok, (tf.get(tok) ?? 0) + 1);
      }

      let score = 0;
      for (const term of terms) {
        const count = tf.get(term) ?? 0;
        if (count > 0) {
          const idf = this.idf.get(term) ?? 1;
          score += count * idf;
        }
      }
      return {
        source: chunk.source,
        text: chunk.text,
        score: Number(score.toFixed(3)),
      };
    });

    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    logger.info(
      {
        category,
        queryLength: query.length,
        sources: results.map((r) => r.source),
      },
      'Policy RAG search executed'
    );

    return results;
  }

  public getAllText(): string {
    this.load();
    return this.chunks.map((c) => c.text).join('\n');
  }
}

export const policyStore = new PolicyStore();

export function searchReturnPolicy(category: string, query: string): {
  chunks: PolicySearchResult[];
} {
  return {
    chunks: policyStore.search(category, query, 3),
  };
}
