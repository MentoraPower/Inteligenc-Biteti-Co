// Pretty-print HTML: break block tags onto their own indented lines, keep inline text/tags together.
export function formatHtml(input: string): string {
  if (!input || !input.trim()) return input;
  const block = new Set([
    "html", "head", "body", "div", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "p", "ul", "ol",
    "li", "h1", "h2", "h3", "h4", "h5", "h6", "header", "footer", "section", "article", "nav", "center",
    "style", "script", "title", "meta", "link", "hr", "blockquote", "form",
  ]);
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const tokens = input.replace(/\r/g, "").match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  let indent = 0;
  const out: string[] = [];
  let line = "";
  const pad = () => "  ".repeat(Math.max(0, indent));
  const flush = () => { if (line.trim()) out.push(pad() + line.trim()); line = ""; };

  for (const raw of tokens) {
    if (raw.startsWith("<!--")) { flush(); out.push(pad() + raw.trim()); continue; }
    if (raw.startsWith("<")) {
      const m = raw.match(/^<\/?\s*!?([a-zA-Z0-9]+)/);
      const name = (m?.[1] || "").toLowerCase();
      const isDoctype = raw.toLowerCase().startsWith("<!doctype");
      const isClose = /^<\//.test(raw);
      const isBlock = block.has(name) || isDoctype;
      const isSelf = /\/>\s*$/.test(raw) || voidTags.has(name) || isDoctype;
      if (isBlock) {
        flush();
        if (isClose) indent = Math.max(0, indent - 1);
        out.push(pad() + raw.trim());
        if (!isClose && !isSelf) indent += 1;
      } else {
        line += raw.trim();
      }
    } else {
      line += raw.replace(/\s+/g, " ");
    }
  }
  flush();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
