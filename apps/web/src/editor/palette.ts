import type { MessageKey } from '../i18n/messages/en.js';

/** The default band palette: dyed wool, which is what historical bands are. */
export const WOOL_PRESETS = [
  '#4B3826', // walnut
  '#B4402C', // madder
  '#2F5F8F', // woad
  '#D8A62B', // weld
  '#EADCC0', // undyed
];

/** Hex → the name's message key. The dye names are copy, not data: a Polish
 *  weaver buys marzanna, not madder. */
export const WOOL_NAME_KEYS: Record<string, MessageKey> = {
  '#4B3826': 'wool.walnut',
  '#B4402C': 'wool.madder',
  '#2F5F8F': 'wool.woad',
  '#D8A62B': 'wool.weld',
  '#EADCC0': 'wool.undyed',
};
