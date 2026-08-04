import './footer.css';

const REPO = 'https://github.com/Demonsthere/weavesmith';
const COFFEE = 'https://buycoffee.to/demonsthere';

/*
 * buycoffee.to's own logotype, served from our origin rather than
 * hot-linked. This app is a PWA whose whole promise is opening at a loom
 * with no network, where a remote image is a broken box — and hot-linking
 * would also mean a third-party request on every page load.
 *
 * Intrinsic size is 531x269; the pair below holds that ratio (96 x 48.63
 * rounds to 49) so the browser reserves the right box before the image
 * decodes and the footer never jumps.
 */
const COFFEE_LOGO = { src: './buycoffee-logo.png', width: 96, height: 49 };

/*
 * Inline SVG, not an icon font or a remote sprite: the app has to work at a
 * loom with no network, and a glyph that arrives over the wire is a blank
 * square offline. `aria-hidden` — it decorates the words, which carry the
 * meaning.
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

/**
 * One line: what this is, where the source lives, and somewhere to say
 * thank you. Hosting is free, so the coffee link is goodwill and not cost
 * recovery — the plan is explicit that it stays a link rather than growing
 * into a banner, and the footer tests hold it to that.
 *
 * Both are anchors, never buttons. They navigate, so the browser's own
 * behaviour — middle-click, "copy link address", focus order — comes free;
 * a `<button>` calling `location.assign` would throw all of that away for a
 * shape that is only CSS. The source link is our own chip; the coffee one
 * carries buycoffee.to's own logotype, which is theirs to design, not ours.
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
        <a className="footer-coffee" href={COFFEE} target="_blank" rel="noopener noreferrer">
          {/* Width and height as attributes, not only CSS: without them the
              footer reflows the moment the image decodes. */}
          <img
            src={COFFEE_LOGO.src}
            width={COFFEE_LOGO.width}
            height={COFFEE_LOGO.height}
            alt="Postaw kawę dla demonsthere na buycoffee.to"
          />
        </a>
      </span>
    </footer>
  );
}
