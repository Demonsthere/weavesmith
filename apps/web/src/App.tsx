import { Board } from './board/Board.js';
import { CardStepper } from './board/CardStepper.js';
import { CardEditor } from './editor/CardEditor.js';
import { Chart } from './chart/Chart.js';
import { WeaveBar } from './weave/WeaveBar.js';
import { useStore } from './state/store.js';
import { useRoute } from './state/route.js';
import type { ScreenMode } from './state/store.js';
import './screenMode.css';

const SCREEN_MODES: { value: ScreenMode; label: string }[] = [
  { value: 'design', label: 'Design' },
  { value: 'weave', label: 'Weave' },
];

// Real anchors, not buttons: they are navigation, so they get the browser's
// history, middle-click and "copy link" for free, and satisfy the
// keyboard-reachability constraint without a binding of their own.
const SCREENS: { hash: string; label: string }[] = [
  { hash: '#/board', label: 'Board' },
  { hash: '#/chart', label: 'Chart' },
];

export function App() {
  const route = useRoute();

  return (
    <>
      <header role="banner">
        <h1>
          Weave<em>Smith</em>
        </h1>
        <nav className="screen-nav" aria-label="Screens">
          {SCREENS.map(({ hash, label }) => (
            <a key={hash} href={hash} aria-current={hash === `#/${route}` ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main>{route === 'chart' ? <Chart /> : <BoardScreen />}</main>
    </>
  );
}

/**
 * The board and everything that only makes sense beside it. Split out so
 * that routing to the chart unmounts the board's controls with it — the
 * card stepper and the design/weave toggle act on a board that isn't on
 * screen otherwise.
 */
function BoardScreen() {
  const editingCard = useStore((state) => state.editingCard);
  const closeEditor = useStore((state) => state.closeEditor);
  const openEditor = useStore((state) => state.openEditor);
  const mode = useStore((state) => state.mode);
  const setMode = useStore((state) => state.setMode);

  return (
    <>
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
    </>
  );
}
