import type { CSSProperties } from 'react';
import type { Card } from '@weavesmith/core';

interface Props {
  card: Card;
  index: number;
  count: number;
  pickCount: number;
  vertical: boolean;
  landmark: boolean;
  color: string;
  palette: string[];
}

/**
 * The chip, string and rail for one card. Placement mirrors `Cell`'s
 * `place()` logic from the prototype: the chip sits at the head of the
 * card's line, the string runs its length (hidden once the board is woven,
 * per the mockup), and the rail marks its foot — thickened for landmark
 * cards. Everything here is `--id` (identity colour, chrome only); no note
 * face is touched.
 */
export function CardChip({ card, index, pickCount, vertical, landmark, color, palette }: Props) {
  const idVar = { '--id': color } as CSSProperties;

  const chipStyle: CSSProperties = vertical
    ? { gridRow: 1, gridColumn: index + 2, ...idVar }
    : { gridRow: index + 2, gridColumn: 1, ...idVar };

  const stringStyle: CSSProperties = vertical
    ? { gridRow: `2 / span ${pickCount}`, gridColumn: index + 2, ...idVar }
    : { gridRow: index + 2, gridColumn: `2 / span ${pickCount}`, ...idVar };

  const railStyle: CSSProperties = vertical
    ? { gridRow: pickCount + 2, gridColumn: index + 2, ...idVar }
    : { gridRow: index + 2, gridColumn: pickCount + 2, ...idVar };

  return (
    <div className={landmark ? 'row landmark' : 'row'}>
      <button
        type="button"
        className="chip"
        style={chipStyle}
        data-card={index}
        aria-label={`Card ${index + 1}, threaded ${card.threading}, edit`}
      >
        <span className="id">{index + 1}</span>
        <span className="sz">{card.threading}</span>
        <span className="holes">
          {card.colors.map((paletteIndex, hole) => (
            <i key={hole} style={{ background: palette[paletteIndex] }} />
          ))}
        </span>
      </button>
      <span className="string" style={stringStyle} />
      <span className="rail" style={railStyle} />
    </div>
  );
}
