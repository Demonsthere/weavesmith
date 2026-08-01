import type { Pattern } from '../../src/index.js';

/**
 * Provenance for a fixture transcribed from a real, published band.
 *
 * Every prose-like fact is an array of strings, one line per fact, rather
 * than a paragraph — so a future edit (a correction, a caveat, a new
 * cross-check) diffs as a single added or changed line instead of rewriting
 * a wall of text.
 */
export interface SourcedProvenance {
  kind: 'sourced';
  /** The page or archive the pattern was published on. */
  url: string;
  /**
   * A separate primary document (e.g. an instruction PDF), when the source
   * provides one apart from the page at `url`.
   */
  documentUrl?: string;
  /** Who created or published the pattern. */
  author: string;
  /** The pattern's own name, as given by the source. */
  patternName: string;
  /** The weave structure this band uses, and what it explicitly is not. */
  weaveStructure: string;
  /** Historical or background facts about the piece, one per line. */
  context?: string[];
  /**
   * Other sources considered and rejected before this one, with why — an
   * audit trail of the search itself, not just its result.
   */
  rejectedSources?: string[];
  /** How the data was transcribed from the source, one fact per line. */
  transcription: string[];
  /** What the transcription was cross-checked against, one fact per line. */
  crossChecks: string[];
  /**
   * Confidence assessment, one aspect per line. A single band can carry
   * different confidence for different claims (e.g. card setup vs. turn
   * phase) — that split is expected, not an omission.
   */
  confidence: string[];
}

/**
 * Provenance for a fixture that encodes a self-evident property rather than
 * a claim about a real, historical band. Carries no URL or author — a
 * derived fixture never had one.
 */
export interface DerivedProvenance {
  kind: 'derived';
  /** The self-evident property this fixture is designed to encode. */
  claim: string;
  /**
   * Corrections made to the fixture's own data to bring it in line with
   * `claim`, each with the arithmetic that proves the original was
   * impossible. Absent if the fixture has never needed correcting.
   */
  corrections?: string[];
}

export type Provenance = SourcedProvenance | DerivedProvenance;

/** A test fixture: a `Pattern` plus the provenance of the data used to build it. */
export interface Fixture {
  source: Provenance;
  pattern: Pattern;
  /** The band as published/derived, one string per pick. Absent for fixtures that only pin structural properties. */
  expected?: string[];
}
