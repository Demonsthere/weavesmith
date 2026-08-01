export interface CellRef {
  pick: number;
  card: number;
}

export interface Selection {
  focus: CellRef;
  anchor: CellRef;
}

export interface SelectionRect {
  t0: number;
  t1: number;
  c0: number;
  c1: number;
}

export function selectionRect(selection: Selection): SelectionRect {
  const { focus, anchor } = selection;
  return {
    t0: Math.min(focus.pick, anchor.pick),
    t1: Math.max(focus.pick, anchor.pick),
    c0: Math.min(focus.card, anchor.card),
    c1: Math.max(focus.card, anchor.card),
  };
}

export function cellsIn(rect: SelectionRect): CellRef[] {
  const cells: CellRef[] = [];
  for (let pick = rect.t0; pick <= rect.t1; pick++) {
    for (let card = rect.c0; card <= rect.c1; card++) cells.push({ pick, card });
  }
  return cells;
}

export function rectContains(rect: SelectionRect, pick: number, card: number): boolean {
  return pick >= rect.t0 && pick <= rect.t1 && card >= rect.c0 && card <= rect.c1;
}
