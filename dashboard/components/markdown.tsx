import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// No rehype-raw: raw HTML in the source is never rendered (NFR-05). Styles live under `.markdown` in globals.css.
export function Markdown({ source }: { source: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
