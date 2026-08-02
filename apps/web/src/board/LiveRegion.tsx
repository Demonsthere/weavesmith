/**
 * Announces the last command's message (from Task 3's `CommandResult`) to
 * assistive tech — a success ("4 cells set to turn forward") or a refusal
 * ("hole C unreachable on 3 (...)") alike. `role="status"` + `aria-live`
 * means a screen reader speaks the text whenever it changes, without the
 * page needing to move focus here.
 */
export function LiveRegion({ message }: { message: string }) {
  return (
    <p className="live" role="status" aria-live="polite">
      {message}
    </p>
  );
}
