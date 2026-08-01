import { Board } from './board/Board.js';
import { CardEditor } from './editor/CardEditor.js';
import { useStore } from './state/store.js';

export function App() {
  const editingCard = useStore((state) => state.editingCard);
  const closeEditor = useStore((state) => state.closeEditor);

  return (
    <>
      <header role="banner">
        <h1>
          Weave<em>Smith</em>
        </h1>
      </header>
      <main>
        <Board />
        <CardEditor cardIndex={editingCard} onClose={closeEditor} />
      </main>
    </>
  );
}
