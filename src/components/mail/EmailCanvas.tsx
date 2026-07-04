import { useRef, useEffect, useState, useCallback } from "react";
import { Trash2, Baseline, PaintBucket, ImageIcon, Bold, Italic, Underline, Strikethrough, Highlighter } from "lucide-react";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Tags treated as "text" (get the text-color tool). Everything else that isn't an
// image or a link is a "container" (gets the background-color tool).
const TEXT_TAGS = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "b", "i", "u", "li", "font", "small", "label"];

/**
 * Renders the generated email HTML and lets the user edit it directly:
 * - text is editable inline (contentEditable)
 * - clicking an element selects it and shows a toolbar (text color, bg color, remove)
 * - a corner handle resizes the selected element by dragging (width/height)
 * Any change is written back through onChange as HTML.
 */
export function EmailCanvas({
  html,
  onChange,
  onUploadImage,
}: {
  html: string;
  onChange: (h: string) => void;
  onUploadImage?: (file: File) => Promise<string | null>;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const injected = useRef<string>("");
  const selectedEl = useRef<HTMLElement | null>(null);
  const linkAnchor = useRef<HTMLAnchorElement | null>(null);
  const imageTarget = useRef<HTMLElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [selKind, setSelKind] = useState<"image" | "link" | "text" | "container">("text");
  const [href, setHref] = useState("");
  const [fmtRect, setFmtRect] = useState<Rect | null>(null);
  const savedRange = useRef<Range | null>(null);

  // Inject the AI HTML only when it changes from the outside (not from our own edits).
  useEffect(() => {
    if (contentRef.current && html !== injected.current) {
      contentRef.current.innerHTML = html;
      injected.current = html;
      selectedEl.current = null;
      setRect(null);
    }
  }, [html]);

  const computeRect = useCallback((el: HTMLElement): Rect => {
    const w = wrapperRef.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { top: r.top - w.top, left: r.left - w.left, width: r.width, height: r.height };
  }, []);

  // Read the current HTML back out, without the temporary selection outline.
  const commit = useCallback(() => {
    const el = selectedEl.current;
    const prevOutline = el?.style.outline || "";
    const prevOffset = el?.style.outlineOffset || "";
    if (el) {
      el.style.outline = "";
      el.style.outlineOffset = "";
    }
    const h = contentRef.current?.innerHTML || "";
    if (el) {
      el.style.outline = prevOutline;
      el.style.outlineOffset = prevOffset;
    }
    injected.current = h;
    onChange(h);
  }, [onChange]);

  const clearSelection = useCallback(() => {
    if (selectedEl.current) {
      selectedEl.current.style.outline = "";
      selectedEl.current.style.outlineOffset = "";
    }
    selectedEl.current = null;
    setRect(null);
  }, []);

  const selectEl = useCallback(
    (clicked: HTMLElement) => {
      const tag = clicked.tagName.toLowerCase();
      const bg = window.getComputedStyle(clicked).backgroundImage || "";

      // Figure out if this is an image: the element itself, a background image,
      // or a descendant <img> that fills most of the clicked element.
      let imgEl: HTMLElement | null = null;
      if (tag === "img") {
        imgEl = clicked;
      } else if (/url\(/i.test(bg)) {
        imgEl = clicked; // background-image lives on the clicked element
      } else {
        const desc = clicked.querySelector("img") as HTMLElement | null;
        if (desc) {
          const ca = clicked.getBoundingClientRect();
          const ia = desc.getBoundingClientRect();
          if (ca.width && ca.height && ia.width * ia.height > 0.5 * ca.width * ca.height) imgEl = desc;
        }
      }
      const isImage = !!imgEl;

      const anchor = isImage ? null : (tag === "a" ? clicked : (clicked.closest("a") as HTMLAnchorElement | null));
      const el = (anchor || clicked) as HTMLElement;

      if (selectedEl.current && selectedEl.current !== el) {
        selectedEl.current.style.outline = "";
        selectedEl.current.style.outlineOffset = "";
      }
      selectedEl.current = el;
      el.style.outline = "2px solid #7e22ce";
      el.style.outlineOffset = "-2px";
      setRect(computeRect(el));

      if (isImage) {
        setSelKind("image");
        imageTarget.current = imgEl;
        linkAnchor.current = null;
      } else if (anchor) {
        setSelKind("link");
        linkAnchor.current = anchor;
        imageTarget.current = null;
        setHref(anchor.getAttribute("href") || "");
      } else {
        setSelKind(TEXT_TAGS.includes(tag) ? "text" : "container");
        linkAnchor.current = null;
        imageTarget.current = null;
      }
    },
    [computeRect]
  );

  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (!t || t === contentRef.current) {
      clearSelection();
      return;
    }
    selectEl(t);
  };

  // Clicking anywhere outside the editor deselects.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        clearSelection();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [clearSelection]);

  const remove = () => {
    const el = selectedEl.current;
    if (el && el !== contentRef.current) {
      el.remove();
      selectedEl.current = null;
      setRect(null);
      commit();
    }
  };

  const setColor = (prop: "color" | "backgroundColor", val: string) => {
    const el = selectedEl.current;
    if (!el) return;
    el.style[prop] = val;
    setRect(computeRect(el));
  };

  const replaceImage = async (file: File) => {
    const target = imageTarget.current;
    if (!target || !onUploadImage) return;
    const url = await onUploadImage(file);
    if (!url) return;
    if (target.tagName.toLowerCase() === "img") {
      (target as HTMLImageElement).src = url;
    } else {
      target.style.backgroundImage = `url("${url}")`;
      if (!target.style.backgroundSize) target.style.backgroundSize = "cover";
      if (!target.style.backgroundPosition) target.style.backgroundPosition = "center";
    }
    if (selectedEl.current) setRect(computeRect(selectedEl.current));
    commit();
  };

  // Text formatting toolbar (shown when text is selected).
  const updateFmt = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setFmtRect(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!contentRef.current || !contentRef.current.contains(range.commonAncestorContainer)) {
      setFmtRect(null);
      return;
    }
    const w = wrapperRef.current!.getBoundingClientRect();
    const r = range.getBoundingClientRect();
    if (!r.width && !r.height) {
      setFmtRect(null);
      return;
    }
    setFmtRect({ top: r.top - w.top, left: r.left - w.left, width: r.width, height: r.height });
  }, []);

  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange();
  };

  const exec = (cmd: string, val?: string) => {
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand(cmd, false, val);
    commit();
    updateFmt();
  };

  const startResize = (axis: "width" | "height") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = selectedEl.current;
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const r = el.getBoundingClientRect();
    const startW = r.width;
    const startH = r.height;

    const move = (ev: PointerEvent) => {
      if (axis === "width") {
        const w = Math.max(20, Math.round(startW + (ev.clientX - startX)));
        el.style.width = `${w}px`;
      } else {
        // handle on top: dragging up grows the height
        const h = Math.max(16, Math.round(startH - (ev.clientY - startY)));
        el.style.height = `${h}px`;
        // Keep a button's text vertically (and horizontally) centered as it grows.
        if (selKind === "link") {
          el.style.display = "inline-flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
        }
      }
      setRect(computeRect(el));
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      commit();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onClick={onClick}
        onBlur={commit}
        onMouseUp={updateFmt}
        onKeyUp={updateFmt}
        className="outline-none min-h-full"
      />

      {/* Text formatting toolbar (Notion-style) — appears on text selection */}
      {fmtRect && (
        <div
          contentEditable={false}
          onMouseDown={saveRange}
          style={{ position: "absolute", top: Math.max(0, fmtRect.top - 42), left: fmtRect.left, zIndex: 40 }}
          className="flex items-center gap-0.5 rounded-lg bg-zinc-900 text-white px-1 py-1 shadow-lg"
        >
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/20" title="Negrito">
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/20" title="Itálico">
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/20" title="Sublinhado">
            <Underline className="h-3.5 w-3.5" />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("strikeThrough")} className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/20" title="Riscado">
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          <select
            defaultValue=""
            onChange={(e) => { exec("fontSize", e.target.value); e.currentTarget.selectedIndex = 0; }}
            className="h-7 bg-transparent text-white text-[11px] rounded px-1 outline-none hover:bg-white/10 cursor-pointer"
            title="Tamanho"
          >
            <option value="" disabled className="text-black">Tamanho</option>
            <option value="1" className="text-black">Pequeno</option>
            <option value="3" className="text-black">Normal</option>
            <option value="5" className="text-black">Grande</option>
            <option value="7" className="text-black">Enorme</option>
          </select>
          <label className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/20 cursor-pointer" title="Cor do texto">
            <Baseline className="h-4 w-4" />
            <input type="color" className="sr-only" onChange={(e) => exec("foreColor", e.target.value)} />
          </label>
          <label className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/20 cursor-pointer" title="Marca-texto">
            <Highlighter className="h-3.5 w-3.5" />
            <input type="color" className="sr-only" onChange={(e) => exec("hiliteColor", e.target.value)} />
          </label>
        </div>
      )}

      {rect && (
        <>
          {/* Floating toolbar */}
          <div
            contentEditable={false}
            style={{ position: "absolute", top: Math.max(0, rect.top - 38), left: rect.left, zIndex: 30 }}
            className="flex items-center gap-0.5 rounded-lg bg-zinc-900 text-white px-1 py-1 shadow-lg"
            onMouseDown={(e) => e.preventDefault()}
          >
            {(selKind === "text" || selKind === "link") && (
              <label className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/20 cursor-pointer" title="Cor do texto">
                <Baseline className="h-4 w-4" />
                <input type="color" className="sr-only" onChange={(e) => setColor("color", e.target.value)} onBlur={commit} />
              </label>
            )}
            {(selKind === "container" || selKind === "link") && (
              <label className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/20 cursor-pointer" title="Cor de fundo">
                <PaintBucket className="h-3.5 w-3.5" />
                <input type="color" className="sr-only" onChange={(e) => setColor("backgroundColor", e.target.value)} onBlur={commit} />
              </label>
            )}
            {selKind === "link" && (
              <input
                value={href}
                onChange={(e) => {
                  setHref(e.target.value);
                  if (linkAnchor.current) linkAnchor.current.setAttribute("href", e.target.value);
                }}
                onBlur={commit}
                placeholder="Link (https://...)"
                className="h-7 w-40 text-[11px] text-black rounded px-2 outline-none"
              />
            )}
            <button onClick={remove} className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/20" title="Remover">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Width handle (side) — drag horizontally */}
          <div
            contentEditable={false}
            onPointerDown={startResize("width")}
            title="Arrastar para largura"
            style={{ position: "absolute", top: rect.top + rect.height / 2 - 7, left: rect.left + rect.width - 7, zIndex: 30 }}
            className="h-3.5 w-3.5 rounded-full bg-purple-700 border-2 border-white shadow cursor-ew-resize"
          />

          {/* Height handle (top) — drag vertically */}
          <div
            contentEditable={false}
            onPointerDown={startResize("height")}
            title="Arrastar para altura"
            style={{ position: "absolute", top: rect.top - 7, left: rect.left + rect.width / 2 - 7, zIndex: 30 }}
            className="h-3.5 w-3.5 rounded-full bg-purple-700 border-2 border-white shadow cursor-ns-resize"
          />

          {/* Change-image icon centered on the selected image */}
          {selKind === "image" && (
            <label
              contentEditable={false}
              onMouseDown={(e) => e.preventDefault()}
              title="Trocar imagem"
              style={{ position: "absolute", top: rect.top + rect.height / 2 - 18, left: rect.left + rect.width / 2 - 18, zIndex: 30 }}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-zinc-900/80 text-white cursor-pointer hover:bg-zinc-900 shadow-lg"
            >
              <ImageIcon className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) replaceImage(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </>
      )}
    </div>
  );
}
