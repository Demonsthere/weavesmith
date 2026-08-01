import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url));

interface LoadedFixture {
  file: string;
  raw: unknown;
}

function loadFixtures(): LoadedFixture[] {
  return readdirSync(fixturesDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((file) => {
      const text = readFileSync(path.join(fixturesDir, file), 'utf8');
      const raw: unknown = JSON.parse(text);
      return { file, raw };
    });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** An array of non-empty strings — prose-like facts, one line each. */
function isLines(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

/** Non-empty array of non-empty strings, if present at all (optional field). */
function isLinesIfPresent(value: unknown): boolean {
  return value === undefined || isLines(value);
}

describe('fixture provenance', () => {
  const fixtures = loadFixtures();

  it('finds fixtures to check', () => {
    // If this fails, the discovery glob above is broken, not the fixtures.
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const { file, raw } of fixtures) {
    describe(file, () => {
      const fixture = (raw ?? {}) as Record<string, unknown>;
      const source = fixture.source;

      it('has a pattern', () => {
        expect(typeof fixture.pattern).toBe('object');
        expect(fixture.pattern).not.toBeNull();
      });

      it('declares a source object, not a bare string', () => {
        // The old shape was a single prose paragraph. Structure, not prose,
        // is what makes provenance testable.
        expect(typeof source).toBe('object');
        expect(source).not.toBeNull();
        expect(Array.isArray(source)).toBe(false);
      });

      const provenance = (typeof source === 'object' && source !== null
        ? (source as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      const kind = provenance.kind;

      it('declares kind as "sourced" or "derived"', () => {
        expect(kind === 'sourced' || kind === 'derived').toBe(true);
      });

      if (kind === 'sourced') {
        it('has a non-empty URL', () => {
          expect(isNonEmptyString(provenance.url)).toBe(true);
        });

        it('has a non-empty author', () => {
          expect(isNonEmptyString(provenance.author)).toBe(true);
        });

        it('names the pattern', () => {
          expect(isNonEmptyString(provenance.patternName)).toBe(true);
        });

        it('states the weave structure', () => {
          expect(isNonEmptyString(provenance.weaveStructure)).toBe(true);
        });

        it('records how it was transcribed, as an array of lines', () => {
          expect(isLines(provenance.transcription)).toBe(true);
        });

        it('records what it was cross-checked against, as an array of lines', () => {
          expect(isLines(provenance.crossChecks)).toBe(true);
        });

        it('records a confidence assessment, as an array of lines', () => {
          expect(isLines(provenance.confidence)).toBe(true);
        });

        it('keeps documentUrl, context and rejectedSources as line arrays when present', () => {
          expect(
            provenance.documentUrl === undefined || isNonEmptyString(provenance.documentUrl),
          ).toBe(true);
          expect(isLinesIfPresent(provenance.context)).toBe(true);
          expect(isLinesIfPresent(provenance.rejectedSources)).toBe(true);
        });

        it('carries no derived-only fields', () => {
          expect(provenance.claim).toBeUndefined();
        });
      } else if (kind === 'derived') {
        it('states the self-evident claim it encodes', () => {
          expect(isNonEmptyString(provenance.claim)).toBe(true);
        });

        it('keeps corrections as an array of lines when present', () => {
          expect(isLinesIfPresent(provenance.corrections)).toBe(true);
        });

        it('carries no sourced-only fields', () => {
          expect(provenance.url).toBeUndefined();
          expect(provenance.author).toBeUndefined();
        });
      } else {
        it('has a recognised provenance kind', () => {
          expect.unreachable(
            `fixture "${file}" has source.kind = ${JSON.stringify(kind)}, expected "sourced" or "derived"`,
          );
        });
      }
    });
  }
});
