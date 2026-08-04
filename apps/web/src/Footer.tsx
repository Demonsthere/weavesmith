import './footer.css';

const REPO = 'https://github.com/Demonsthere/weavesmith';
// Placeholder until the real page exists — swapping this string is the whole
// edit, which is why it is a constant rather than inline in the markup.
const COFFEE = 'https://buycoffee.to/foobar';

/*
 * Icons are inline SVG, not an icon font or a remote sprite: the app has to
 * work at a loom with no network, and a glyph that arrives over the wire is
 * a blank square offline. Both are `aria-hidden` — they decorate the words,
 * which carry the meaning.
 */
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
           0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01
           1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
           0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27
           2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
           1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01
           2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}

function CoffeeCup() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 6h8v4a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3V6Zm8 .8h1.6a1.7 1.7 0 0 1 0 3.4h-1.6M4.6 1.8v1.6M7.4 1.8v1.6"
      />
    </svg>
  );
}

/**
 * One line: what this is, where the source lives, and somewhere to say
 * thank you. Hosting is free, so the coffee link is goodwill and not cost
 * recovery — the plan is explicit that it stays a link rather than growing
 * into a banner, and the footer tests hold it to that.
 *
 * The two chips look like buttons and are anchors. They navigate, so the
 * browser's own behaviour — middle-click, "copy link address", focus order
 * — comes free; a `<button>` calling `location.assign` would throw all of
 * that away for a shape that is only CSS.
 */
export function Footer() {
  return (
    <footer className="site-footer">
      <span className="footer-name">
        Weave<em>Smith</em>
      </span>
      <span className="footer-links">
        <a className="footer-btn" href={REPO} target="_blank" rel="noopener noreferrer">
          <GitHubMark />
          Source on GitHub
        </a>
        <a className="footer-btn" href={COFFEE} target="_blank" rel="noopener noreferrer">
          <CoffeeCup />
          Buy me a coffee
        </a>
      </span>
    </footer>
  );
}
