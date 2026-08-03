import { Board } from './board/Board.js';
import { CardStepper } from './board/CardStepper.js';
import { CardEditor } from './editor/CardEditor.js';
import { WeaveBar } from './weave/WeaveBar.js';
import { useStore } from './state/store.js';
import type { ScreenMode } from './state/store.js';
import './screenMode.css';

const SCREEN_MODES: { value: ScreenMode; label: string }[] = [
  { value: 'design', label: 'Design' },
  { value: 'weave', label: 'Weave' },
];

export function App() {
  const editingCard = useStore((state) => state.editingCard);
  const closeEditor = useStore((state) => state.closeEditor);
  const openEditor = useStore((state) => state.openEditor);
  const mode = useStore((state) => state.mode);
  const setMode = useStore((state) => state.setMode);

  return (
    <>
      <header role="banner">
        <h1>
          Weave<em>Smith</em>
        </h1>
      </header>
      <main>
        <div className="controls">
          <CardStepper onAdded={openEditor} />
          <div className="segmented" role="group" aria-label="Screen mode">
            {SCREEN_MODES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {/* Same component in both modes, per the design spec — `mode`
            already turns Board into the at-loom tracker on its own (Task
            4); WeaveBar is only mounted, not switched to, so it never holds
            stale state from a mode it isn't currently in. */}
        {mode === 'weave' && <WeaveBar />}
        <Board />
        {/* `key` forces a remount on every change of which card is being
            edited — belt and braces alongside CardEditor's own
            cardIndex-keyed reset effect, not a substitute for it: the
            component must not depend on its parent remembering this. */}
        <CardEditor key={editingCard} cardIndex={editingCard} onClose={closeEditor} />
      </main>
    </>
  );
}
