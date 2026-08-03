import { Board } from './board/Board.js';
import { CardStepper } from './board/CardStepper.js';
import { CardEditor } from './editor/CardEditor.js';
import { useStore } from './state/store.js';

export function App() {
  const editingCard = useStore((state) => state.editingCard);
  const closeEditor = useStore((state) => state.closeEditor);
  const openEditor = useStore((state) => state.openEditor);

  return (
    <>
      <header role="banner">
        <h1>
          Weave<em>Smith</em>
        </h1>
      </header>
      <main>
        <CardStepper onAdded={openEditor} />
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
