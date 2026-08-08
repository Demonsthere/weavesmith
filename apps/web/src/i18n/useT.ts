import { CATALOGUES } from './catalogues.js';
import type { Messages, MessageKey } from './messages/en.js';
import { useStore } from '../state/store.js';

/**
 * The arguments a key takes: exactly one object for an interpolating key,
 * and none at all for a plain string. This is what makes `t('app.nav.board',
 * {x: 1})` and a forgotten argument object both compile errors rather than
 * runtime surprises.
 */
type Args<K extends MessageKey> = Messages[K] extends (a: infer A) => string ? [A] : [];

/**
 * Reads strings in the current locale. Subscribing to `locale` through the
 * store is also what re-renders a component when the language changes —
 * there is no separate context or event to wire up.
 */
export function useT() {
  const locale = useStore((state) => state.locale);
  const catalogue = CATALOGUES[locale];

  return <K extends MessageKey>(key: K, ...args: Args<K>): string => {
    const value = catalogue[key];
    // `value` typed as `Messages[K]` currently resolves to plain `string`,
    // because every key in today's catalogue is a plain string — there is
    // no interpolating message yet. That makes the function branch below
    // provably unreachable *today*, and this compiler (typescript@7.0.2)
    // narrows the `typeof value === 'function'` branch to `never` as a
    // result, refusing to let it be called at all — a stricter reading than
    // the brief's plan verified against. The cast is required until a real
    // interpolating key exists to keep the union honest; `Args<K>` (the
    // caller-facing contract this hook exists to enforce) is unaffected.
    return typeof value === 'function'
      ? (value as (a: never) => string)(args[0] as never)
      : value;
  };
}
