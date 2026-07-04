import { useRef } from "react";

const NUL = "\uE000";
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Color a single HTML tag (already HTML-escaped): punctuation, tag name, attributes, strings.
function hlTag(tag: string): string {
  return tag.replace(/(&lt;\/?)([a-zA-Z0-9!-]+)([\s\S]*?)(\/?&gt;)/, (_m, open, name, attrs, close) => {
    const a = String(attrs).replace(
      /([a-zA-Z_:][\w:-]*)(\s*=\s*)("[^"]*"|'[^']*')/g,
      '<span class="tk-attr">$1</span>$2<span class="tk-str">$3</span>'
    );
    return `<span class="tk-punct">${open}</span><span class="tk-tag">${name}</span>${a}<span class="tk-punct">${close}</span>`;
  });
}

// Color CSS (inside <style>).
function hlCss(css: string): string {
  return css
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tk-comment">$1</span>')
    .replace(/([a-zA-Z-]+)(\s*:\s*)([^;{}]+)(;?)/g, '<span class="tk-attr">$1</span>$2<span class="tk-str">$3</span>$4');
}

// Color JavaScript (inside <script>).
function hlJs(js: string): string {
  return js
    .replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, '<span class="tk-str">$1</span>')
    .replace(/\b(var|let|const|function|return|if|else|for|while|new|this|true|false|null|typeof|document|window)\b/g, '<span class="tk-tag">$1</span>');
}

// Lightweight HTML/CSS/JS syntax highlighter (VS Code-ish colors). Display-only.
function highlight(code: string): string {
  let html = escapeHtml(code);
  const stash: string[] = [];
  const stub = (s: string) => { stash.push(s); return `${NUL}${stash.length - 1}${NUL}`; };

  // <style> / <script> blocks — highlight inner content, then protect from the tag pass.
  html = html.replace(/(&lt;(style|script)\b[\s\S]*?&gt;)([\s\S]*?)(&lt;\/\2&gt;)/gi, (_m, open, tag, inner, close) => {
    const colored = String(tag).toLowerCase() === "script" ? hlJs(inner) : hlCss(inner);
    return stub(hlTag(open) + colored + hlTag(close));
  });
  // Comments
  html = html.replace(/(&lt;!--[\s\S]*?--&gt;)/g, (m) => stub(`<span class="tk-comment">${m}</span>`));
  // Remaining tags
  html = html.replace(/&lt;\/?[a-zA-Z0-9!-][\s\S]*?&gt;/g, (m) => hlTag(m));
  // Restore protected blocks
  html = html.replace(new RegExp(`${NUL}(\\d+)${NUL}`, "g"), (_m, i) => stash[Number(i)]);
  return html;
}

export function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const sync = () => {
    const ta = taRef.current;
    if (ta && preRef.current) preRef.current.scrollTop = ta.scrollTop;
  };

  return (
    <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
      <div className="relative h-full overflow-hidden">
        <pre
          ref={preRef}
          aria-hidden
          className="absolute inset-0 m-0 pt-3 pb-16 px-5 text-[14px] leading-[22px] font-mono whitespace-pre-wrap break-words [overflow-wrap:anywhere] overflow-hidden pointer-events-none text-[#d4d4d4]"
          dangerouslySetInnerHTML={{ __html: highlight(value) + "\n" }}
        />
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={sync}
          spellCheck={false}
          wrap="soft"
          className="absolute inset-0 m-0 pt-3 pb-16 px-5 text-[14px] leading-[22px] font-mono whitespace-pre-wrap break-words [overflow-wrap:anywhere] overflow-x-hidden overflow-y-auto bg-transparent text-transparent caret-white outline-none resize-none"
        />
      </div>
    </div>
  );
}
