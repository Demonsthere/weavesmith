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

// `catalogue[key]`, typed as `Messages[K]`, resolves to plain `string` today
// — every key in the current catalogue is a plain string, so there is no
// interpolating message yet for the union to be visible in. Indexing
// directly at the call site loses that union for `typeof`-narrowing purposes
// under this compiler (typescript@7.0.2); taking the same union as a
// *parameter* narrows correctly, so resolution is factored out into a
// helper that receives `catalogue[key]` by value rather than re-deriving it
// from `key`. No cast lands on the value itself — only the interpolation
// argument, exactly as the brief's `args[0] as never` already allowed.
function resolve(value: string | ((a: never) => string), arg: unknown): string {
  return typeof value === 'function' ? value(arg as never) : value;
}

/**
 * Reads strings in the current locale. Subscribing to `locale` through the
 * store is also what re-renders a component when the language changes —
 * there is no separate context or event to wire up.
 */
export function useT() {
  const locale = useStore((state) => state.locale);
  const catalogue = CATALOGUES[locale];

  return <K extends MessageKey>(key: K, ...args: Args<K>): string => {
    return resolve(catalogue[key], args[0]);
  };
}
