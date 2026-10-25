import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const isExternal = (href?: string) => !!href && /^(https?:|mailto:)/i.test(href);

// A document shown inside a page section (a SKILL.md under an h2): its headings move down two levels so the page keeps one h1,
// and links relative to the document's own folder, which the dashboard does not serve, become plain text instead of 404s.
const EMBEDDED: Components = {
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h4>{children}</h4>,
  h3: ({ children }) => <h5>{children}</h5>,
  h4: ({ children }) => <h6>{children}</h6>,
  h5: ({ children }) => <h6>{children}</h6>,
  a: ({ href, children }) => (isExternal(href) ? <a href={href} rel="noreferrer">{children}</a> : <span>{children}</span>),
};

// No rehype-raw: raw HTML in the source is never rendered (NFR-05). Styles live under `.markdown` in globals.css.
export function Markdown({ source, embedded = false }: { source: string; embedded?: boolean }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={embedded ? EMBEDDED : undefined}>{source}</ReactMarkdown>
    </div>
  );
}
