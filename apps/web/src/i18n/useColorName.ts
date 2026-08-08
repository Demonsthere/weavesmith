import { useT } from './useT.js';
import { WOOL_NAME_KEYS } from '../editor/palette.js';

/**
 * A wool's spoken name — the dye name where the hex matches a known wool
 * (`WOOL_NAME_KEYS`), otherwise the bare hex. This is a hook rather than a
 * plain function because it needs `t` from `useT()`, which is only callable
 * inside a component; the closure it returns is what call sites keep using.
 *
 * Shared by every place that lists palette colours: the brush strip, the
 * printed chart and its summary, and (via `useDescribeColor` below) the card
 * editor's swatches.
 */
export function useColorName() {
  const t = useT();
  return (hex: string): string => {
    const key = WOOL_NAME_KEYS[hex];
    return key ? t(key) : hex;
  };
}

/**
 * The name plus its hex, for swatches where a screen-reader user should hear
 * "marzanna #B4402C" rather than a bare, indistinguishable colour code. Built
 * on `useColorName` rather than re-deriving the lookup — but only appends the
 * hex when a name was actually found, so an unnamed colour still reads as
 * just the hex, not "hex hex".
 */
export function useDescribeColor() {
  const colorName = useColorName();
  return (hex: string): string => (WOOL_NAME_KEYS[hex] ? `${colorName(hex)} ${hex}` : hex);
}
