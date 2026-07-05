import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClaudeChatInput, type ClaudeChatSendData } from "@/components/ui/claude-style-chat-input";
import { EmailCanvas } from "@/components/mail/EmailCanvas";
import { CodeEditor } from "@/components/mail/CodeEditor";
import { formatHtml } from "@/lib/htmlFormat";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import {
  ChevronLeft,
  Pencil,
  Undo2,
  Redo2,
  Code2,
  Eye,
  BookDown,
  Mail,
  FileText,
  X,
  User,
} from "lucide-react";

// Injected into the mobile preview iframe so a fixed-width (600px) email reflows to phone width
// while keeping real font sizes (not a shrunken desktop).
const MOBILE_CSS =
  "<style>html,body{margin:0!important;padding:0!important;width:100%!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
  '*{box-sizing:border-box!important;max-width:100%!important}' +
  'table{width:100%!important;max-width:100%!important}' +
  'td,th{word-break:break-word!important}' +
  'img{width:auto!important;max-width:100%!important;height:auto!important}</style>';
const mobileDoc = (html: string) =>
  html.includes("</head>") ? html.replace("</head>", MOBILE_CSS + "</head>") : MOBILE_CSS + html;

// Widen the email container (600px -> desktop width) for the desktop preview only.
const widenEmail = (html: string) =>
  html
    .replace(/(max-width|width)\s*:\s*600px/gi, "$1:760px")
    .replace(/width\s*=\s*["']600["']/gi, 'width="760"');

// Best-effort extraction of the email's outer background color, so the desktop
// preview card can be fully filled with it.
function emailBg(html: string): string | undefined {
  if (!html) return undefined;
  let m = html.match(/<body[^>]*style=["'][^"']*background(?:-color)?\s*:\s*([^;"']+)/i);
  if (m) return m[1].trim();
  m = html.match(/<body[^>]*bgcolor=["']?(#?[\w(),.\s%-]+?)["'\s>]/i);
  if (m) return m[1].trim();
  m = html.match(/background-color\s*:\s*([^;"'}]+)/i);
  if (m) return m[1].trim();
  return undefined;
}

// Reveals text one character at a time (typewriter effect). Animates once per text.
function TypewriterText({ text }: { text: string }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text]);
  return <>{shown}</>;
}

interface Attachment {
  id: string;
  kind: "image" | "text";
  name: string;
  url?: string;
  content?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  loading?: boolean;
  animate?: boolean;
}

interface TemplateEditorProps {
  template: { id: string; name: string };
  onBack: () => void;
}

export function TemplateEditor({ template, onBack }: TemplateEditorProps) {
  const [name, setName] = useState(template.name);
  const [editingName, setEditingName] = useState(false);

  const initialHtml = (((template as any).body_html as string) && (template as any).body_html.includes("<")) ? ((template as any).body_html as string) : "";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [emailHtml, setEmailHtml] = useState<string>(initialHtml);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const interacted = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const emailHtmlRef = useRef(initialHtml);

  // Undo/redo + code/preview for the email.
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const baseHtml = useRef(initialHtml);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeHeight, setCodeHeight] = useState(360);
  const [viewOpen, setViewOpen] = useState(false);

  const openCode = () => {
    setCodeDraft(formatHtml(emailHtml));
    setCodeHeight(Math.round(window.innerHeight * 0.5));
    setCodeOpen(true);
  };
  const startCodeResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = codeHeight;
    const move = (ev: PointerEvent) =>
      setCodeHeight(Math.min(window.innerHeight - 60, Math.max(120, startH - (ev.clientY - startY))));
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  // Set the email HTML while recording an undo step.
  const commitEmail = useCallback((next: string) => {
    setEmailHtml((prev) => {
      if (next === prev) return prev;
      setUndoStack((u) => [...u, prev]);
      setRedoStack([]);
      return next;
    });
  }, []);

  // Upload an ebook PDF, register it, and insert a download button into the email.
  const ebookInputRef = useRef<HTMLInputElement>(null);
  const [ebookUploading, setEbookUploading] = useState(false);
  const uploadEbook = async (file: File) => {
    if (!file) return;
    setEbookUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await (supabase as any).storage.from("ebooks").upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
      if (upErr) { toast.error("Erro ao enviar o ebook"); return; }
      const { data: pub } = (supabase as any).storage.from("ebooks").getPublicUrl(path);
      const { data: rec, error: recErr } = await (supabase as any).from("ebooks").insert({ name: file.name, file_url: pub.publicUrl, file_name: file.name }).select("id").single();
      if (recErr || !rec) { toast.error("Erro ao registrar o ebook"); return; }
      const url = `https://app.bitet.co/ebook/${rec.id}`;
      const btn = `<div style="text-align:center;margin:24px 0;"><a href="${url}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 30px;border-radius:8px;font-family:Arial,sans-serif;font-size:16px;">Baixar ebook</a></div>`;
      const html = emailHtmlRef.current || "";
      const next = html.includes("</body>") ? html.replace("</body>", btn + "</body>") : (html + btn);
      commitEmail(next);
      toast.success("Ebook adicionado — botão inserido no e‑mail!");
    } finally {
      setEbookUploading(false);
    }
  };

  const undo = useCallback(() => {
    setUndoStack((u) => {
      if (!u.length) return u;
      const prev = u[u.length - 1];
      setEmailHtml((cur) => {
        setRedoStack((r) => [...r, cur]);
        return prev;
      });
      return u.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((r) => {
      if (!r.length) return r;
      const next = r[r.length - 1];
      setEmailHtml((cur) => {
        setUndoStack((u) => [...u, cur]);
        return next;
      });
      return r.slice(0, -1);
    });
  }, []);

  // Collapse the Mail submenu while editing.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mail-editor", { detail: { open: true } }));
    return () => window.dispatchEvent(new CustomEvent("mail-editor", { detail: { open: false } }));
  }, []);

  // Auto-scroll the conversation to the bottom.
  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Keep refs in sync so persist() always sees the latest values.
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { emailHtmlRef.current = emailHtml; }, [emailHtml]);
  // Keep the editor's title in sync when the template's name changes (e.g. named via the popup).
  useEffect(() => { setName(template.name); }, [template.name]);

  // Load the saved email + chat for this template.
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("email_templates")
        .select("body_html, chat")
        .eq("id", template.id)
        .single();
      // Don't overwrite anything the user already started typing/sending.
      if (data && !interacted.current) {
        if (typeof data.body_html === "string" && data.body_html.includes("<")) {
          setEmailHtml(data.body_html);
          baseHtml.current = data.body_html;
        }
        if (Array.isArray(data.chat) && data.chat.length) setMessages(data.chat as ChatMessage[]);
      }
      loaded.current = true;
    })();
  }, [template.id]);

  // Persist email + chat to the database (reads latest via refs; never saves the "animate" flag).
  const persist = useCallback(async () => {
    const cleanChat = messagesRef.current
      .filter((m) => !m.loading)
      .map((m) => ({ id: m.id, role: m.role, content: m.content, attachments: m.attachments || null }));
    await (supabase as any)
      .from("email_templates")
      .update({ body_html: emailHtmlRef.current, chat: cleanChat })
      .eq("id", template.id);
  }, [template.id]);

  // Auto-save (debounced) after the initial load.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => { void persist(); }, 800);
    return () => clearTimeout(t);
  }, [messages, emailHtml, persist]);

  // Save once more on unmount so the last message isn't lost if the debounce hasn't fired.
  useEffect(() => {
    return () => { if (loaded.current) void persist(); };
  }, [persist]);

  // ESC closes the code / preview overlays.
  useEffect(() => {
    if (!codeOpen && !viewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (codeOpen) { commitEmail(codeDraft); setCodeOpen(false); }
      if (viewOpen) setViewOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [codeOpen, viewOpen, codeDraft, commitEmail]);

  const saveName = async () => {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === template.name) {
      setName(template.name);
      return;
    }
    const { error } = await (supabase as any)
      .from("email_templates")
      .update({ name: trimmed })
      .eq("id", template.id);
    if (error) {
      toast.error("Erro ao renomear");
      setName(template.name);
    } else {
      toast.success("Nome atualizado!");
    }
  };

  // Upload a single image to Storage and return its public URL (used by the email editor).
  const uploadImage = async (file: File): Promise<string | null> => {
    const path = `${template.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.]+/g, "_")}`;
    const { error } = await (supabase as any).storage
      .from("email-assets")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      toast.error("Erro ao enviar a imagem");
      return null;
    }
    const { data: pub } = (supabase as any).storage.from("email-assets").getPublicUrl(path);
    return pub?.publicUrl || null;
  };

  const handleAiSend = async (data: ClaudeChatSendData) => {
    const text = data.message.trim();
    if (!text && data.files.length === 0) return;

    interacted.current = true;
    const priorMessages = messages;

    // Guess whether this message is actually a create/edit request — only then
    // show the "generating email" bar/placeholder; plain replies stay neutral.
    const wantsEmail =
      data.files.length > 0 ||
      /\b(cri[ae]|criar|gera|gerar|faz|fazer|monta|montar|refaz|refazer|adicion|coloc|colocar|mud[ae]|mudar|troc[ae]|trocar|remov|edit|escrev|bot[ãa]o|imagem|imagens|foto|t[íi]tulo|texto|fundo|cor|link|banner|logo|rodap[ée]|cabe[çc]alho|e-?mail)\b/i.test(text);

    const placeholderId = crypto.randomUUID();
    if (wantsEmail) setGenerating(true);

    try {
      // Upload attached images to Storage; collect their public URLs.
      const attachments: Attachment[] = [];
      const imageUrls: string[] = [];
      for (const f of data.files) {
        if (!f.file.type.startsWith("image/")) continue;
        const path = `${template.id}/${crypto.randomUUID()}-${f.file.name.replace(/[^\w.]+/g, "_")}`;
        const { error: upErr } = await (supabase as any).storage
          .from("email-assets")
          .upload(path, f.file, { upsert: true, contentType: f.file.type });
        if (!upErr) {
          const { data: pub } = (supabase as any).storage.from("email-assets").getPublicUrl(path);
          if (pub?.publicUrl) {
            imageUrls.push(pub.publicUrl);
            attachments.push({ id: crypto.randomUUID(), kind: "image", name: f.file.name, url: pub.publicUrl });
          }
        }
      }
      const pastedTexts = data.pastedContent.map((p) => p.content);
      data.pastedContent.forEach((p) =>
        attachments.push({ id: p.id, kind: "text", name: "Texto colado", content: p.content })
      );

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text || (attachments.length ? "(anexo enviado)" : ""),
        attachments: attachments.length ? attachments : undefined,
      };
      setMessages((m) => [
        ...m,
        userMsg,
        { id: placeholderId, role: "assistant", content: "", loading: true },
      ]);

      const history = priorMessages.map((m) => ({ role: m.role, content: m.content }));
      const { data: res, error } = await (supabase as any).functions.invoke("generate-email-ai", {
        body: { history, userText: text, imageUrls, pastedTexts, currentHtml: emailHtml },
      });
      if (error) throw new Error(error.message);
      if (res?.error) throw new Error(res.error);

      setMessages((m) => m.map((x) => (x.id === placeholderId ? { ...x, content: res.reply || "Pronto!", loading: false, animate: true } : x)));
      if (res.email_changed && res.html) {
        baseHtml.current = res.html;
        commitEmail(res.html);
      }
    } catch (e: any) {
      setMessages((m) => {
        const hasPlaceholder = m.some((x) => x.id === placeholderId);
        const errText = `Erro ao gerar o e-mail: ${e?.message || e}`;
        return hasPlaceholder
          ? m.map((x) => (x.id === placeholderId ? { ...x, content: errText, loading: false } : x))
          : [...m, { id: placeholderId, role: "assistant" as const, content: errText }];
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background pt-2">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={async () => { await persist(); onBack(); }} className="h-9 rounded">
            Salvar e sair
          </Button>
        </div>
      </div>

      {/* Sub bar */}
      <div className="flex items-center justify-between px-5 h-11 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Campanha</span>
          <span className="text-muted-foreground">/</span>
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") { setName(template.name); setEditingName(false); }
              }}
              className="font-medium bg-transparent border-b border-blue-400 outline-none min-w-[120px] max-w-[280px]"
            />
          ) : (
            <>
              <span className="font-medium">{name}</span>
              <button
                onClick={() => setEditingName(true)}
                title="Renomear"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!undoStack.length}
            title="Desfazer"
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={!redoStack.length}
            title="Refazer"
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            onClick={openCode}
            title="Ver/editar código"
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            <Code2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewOpen(true)}
            title="Ver e-mail"
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            <Eye className="h-4 w-4" />
          </button>
          <input
            ref={ebookInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadEbook(f); e.currentTarget.value = ""; }}
          />
          <button
            onClick={() => ebookInputRef.current?.click()}
            disabled={ebookUploading}
            title="Adicionar ebook (PDF) — insere botão de download"
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors disabled:opacity-40"
          >
            <BookDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Chat (history above, input at the bottom) */}
        <div className="flex-1 flex flex-col min-h-0 bg-muted/20">
          <div ref={historyRef} className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length > 0 && (
              <div className="max-w-2xl mx-auto space-y-6">
                {messages.map((m) => (
                  <div key={m.id} className={cn("w-full flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                    {m.attachments && m.attachments.length > 0 && (
                      <div className={cn("flex flex-wrap gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                        {m.attachments.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setPreview(a)}
                            className="rounded-xl overflow-hidden border border-border transition-colors text-left"
                            title={a.name}
                          >
                            {a.kind === "image" ? (
                              <img src={a.url} alt={a.name} className="w-24 h-24 object-cover" />
                            ) : (
                              <div className="w-40 h-24 bg-background p-3 flex flex-col gap-1">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-medium truncate">{a.name}</span>
                                <span className="text-[10px] text-muted-foreground line-clamp-2 font-mono">{a.content}</span>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.loading ? (
                      <div className="py-1 leading-none">
                        <span className="text-3xl leading-none text-foreground/60 animate-pulse">•</span>
                      </div>
                    ) : m.content ? (
                      <div
                        className={cn(
                          "max-w-full text-base font-medium leading-relaxed text-foreground",
                          m.role === "user" ? "bg-muted/60 rounded-2xl px-4 py-2.5 text-left" : "py-1 text-left"
                        )}
                      >
                        {m.role === "assistant" && m.animate ? <TypewriterText text={m.content} /> : m.content}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI chat input */}
          <div className="border-t border-border p-4 flex-shrink-0">
            <ClaudeChatInput onSendMessage={handleAiSend} />
          </div>
        </div>

        {/* Email preview (wider) */}
        <div className="w-[760px] max-w-[60%] border-l border-border bg-background flex-shrink-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: emailBg(emailHtml) || "#ffffff" }}>
            {generating && (
              <div className="mb-3 flex justify-center">
                <div className="ws-loading-track"><div className="ws-loading-fill" /></div>
              </div>
            )}
            <div className="mx-auto min-h-full">
              {emailHtml ? (
                <EmailCanvas html={emailHtml} onChange={commitEmail} onUploadImage={uploadImage} />
              ) : (
                <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center text-muted-foreground">
                  <p className="text-lg font-medium">Crie seu Email...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Code editor — bottom panel (half screen), overlays the content */}
      {codeOpen && (
        <div
          className="fixed left-16 right-0 bottom-0 z-[60] flex flex-col bg-[#1e1e1e] text-zinc-200 border-t border-black/50 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]"
          style={{ height: codeHeight }}
        >
          {/* Header */}
          <div className="relative flex items-center justify-between px-3 h-9 bg-[#252526] border-b border-black/40 flex-shrink-0 text-zinc-400 text-xs">
            <div className="flex items-center gap-1">
              <button className="h-6 px-1.5 rounded hover:bg-white/10 font-medium">Aa</button>
              <button className="h-6 px-1.5 rounded hover:bg-white/10 font-medium">A↕</button>
            </div>
            {/* Drag handle to resize height */}
            <div
              onPointerDown={startCodeResize}
              title="Arrastar para redimensionar"
              className="absolute left-1/2 -translate-x-1/2 top-0 h-9 flex items-center px-8 cursor-ns-resize"
            >
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="h-1 w-1 rounded-full bg-zinc-500" />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">CSS</span>
              <button
                onClick={() => { commitEmail(codeDraft); setCodeOpen(false); }}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10"
                title="Fechar (ESC)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Code area */}
          <CodeEditor value={codeDraft} onChange={setCodeDraft} />
        </div>
      )}

      {/* View email — full-screen preview (desktop + mobile), portaled above everything */}
      {viewOpen && createPortal((
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#eef1f8]">
          {/* Top bar: back (left) + ESC (right) */}
          <div className="flex items-center justify-between px-4 h-14 bg-white border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setViewOpen(false)} className="text-muted-foreground hover:text-foreground" title="Voltar">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 h-9 px-3 rounded border border-border text-sm font-medium text-foreground">
                <Mail className="h-4 w-4" /> {name}
              </div>
            </div>
            <button onClick={() => setViewOpen(false)} className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground hover:text-foreground" title="Fechar (ESC)">
              ESC <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body: desktop + mobile side by side */}
          <div className="flex-1 overflow-auto p-8 flex gap-8 justify-center items-start">
            {/* Desktop */}
            <div
              className="flex-1 min-h-[85vh] rounded-xl shadow-sm overflow-hidden"
              style={{ backgroundColor: emailBg(emailHtml) || "#ffffff" }}
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-white">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="h-2 w-28 bg-muted rounded" />
                  <div className="h-2 w-16 bg-muted rounded" />
                </div>
              </div>
              {emailHtml ? (
                <div dangerouslySetInnerHTML={{ __html: widenEmail(emailHtml) }} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-16">Nenhum e-mail gerado ainda.</p>
              )}
            </div>

            {/* Mobile phone mockup */}
            <div className="flex-shrink-0 hidden lg:block">
              <div className="w-[400px] rounded-[2.5rem] bg-white border border-zinc-200 shadow-xl px-3 pt-3 pb-2">
                <div className="flex justify-center py-2">
                  <div className="h-1.5 w-16 bg-muted rounded-full" />
                </div>
                <div className="h-[620px] w-[360px] mx-auto overflow-hidden rounded-lg border border-border bg-white">
                  {emailHtml && (
                    <iframe
                      title="Pré-visualização mobile"
                      srcDoc={mobileDoc(emailHtml)}
                      className="w-full h-full border-0"
                    />
                  )}
                </div>
                <div className="flex justify-center py-3">
                  <div className="h-9 w-9 rounded-full border border-border" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Attachment preview popup */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl overflow-visible [&>button:last-child]:hidden">
          <DialogClose className="absolute -top-8 -right-8 h-9 w-9 rounded-full bg-background border border-border shadow-lg flex items-center justify-center hover:bg-accent z-10">
            <X className="h-4 w-4" />
          </DialogClose>
          <div className="max-h-[80vh] overflow-auto">
            {preview?.kind === "image" ? (
              <img src={preview.url} alt={preview.name} className="max-w-full rounded-lg mx-auto" />
            ) : (
              <pre className="text-sm whitespace-pre-wrap break-words font-mono">{preview?.content}</pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
