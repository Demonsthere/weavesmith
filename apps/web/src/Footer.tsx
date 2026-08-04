import './footer.css';

const REPO = 'https://github.com/Demonsthere/weavesmith';
// Placeholder until the real page exists — swapping this string is the whole
// edit, which is why it is a constant rather than inline in the markup.
const COFFEE = 'https://buycoffee.to/foobar';

/**
 * One line: what this is, where the source lives, and somewhere to say
 * thank you. Hosting is free, so the coffee link is goodwill and not cost
 * recovery — the plan is explicit that it stays a link rather than growing
 * into a banner, and the footer test holds it to that.
 */
export function Footer() {
  return (
    <footer className="site-footer">
      <span>
        Weave<em>Smith</em>
      </span>
      <a href={REPO} target="_blank" rel="noopener noreferrer">
        Source on GitHub
      </a>
      <a href={COFFEE} target="_blank" rel="noopener noreferrer">
        Buy me a coffee
      </a>
    </footer>
  );
}
