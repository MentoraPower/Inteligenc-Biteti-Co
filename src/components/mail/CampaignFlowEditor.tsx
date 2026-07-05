import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Mail, Plus, Send, MailOpen, MousePointerClick, Ban, Users,
  ChevronLeft, ChevronRight, X, GitBranch, Tag, Search, ChevronDown,
  ZoomIn, ZoomOut, Maximize2, Calendar as CalendarIcon,
} from "lucide-react";
import emailIcon from "@/assets/mail/email.png";
import aguardeIcon from "@/assets/mail/aguarde.png";
import tagIcon from "@/assets/mail/tag.png";
import pipelineIcon from "@/assets/mail/pipeline.png";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ------------------------------- Types ------------------------------- */

type TriggerCfg =
  | { type?: "pipeline_enter"; workspaceId: string; workspaceName: string; subOriginId: string; subOriginName: string; pipelineId: string; pipelineName: string }
  | { type: "tag_added" | "tag_removed"; tagName: string };

const isPipelineTrigger = (t: TriggerCfg | null): t is Extract<TriggerCfg, { pipelineId: string }> =>
  !!t && t.type !== "tag_added" && t.type !== "tag_removed";

type Step =
  | { id: string; type: "email"; templateId?: string; templateName?: string; subject?: string; preheader?: string }
  | { id: string; type: "timer"; mode?: "duration" | "datetime"; amount?: number; unit?: "seconds" | "minutes" | "hours" | "days" | "months" | "years"; datetime?: string };

const fmtDateTime = (dt: string) => {
  const [d, t] = (dt || "").split("T");
  if (!d) return "";
  const [y, mo, da] = d.split("-");
  return `${da}/${mo}/${y}${t ? " às " + t : ""}`;
};

interface Opt { id: string; nome?: string; name?: string; body_html?: string | null; subject?: string | null }
interface Domain { domain: string; sender_name: string | null; sender_local: string | null }

const genId = () => crypto.randomUUID();
const UNIT_LABEL: Record<string, string> = { seconds: "segundo(s)", minutes: "minuto(s)", hours: "hora(s)", days: "dia(s)", months: "mês(es)", years: "ano(s)" };
const UNIT_OPTIONS = ["seconds", "minutes", "hours", "days", "months", "years"] as const;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Icon badges use the actual designed app-icons, clipped to a full circle.
const IconBadge = ({ src, alt, box = "w-9 h-9" }: { src: string; alt: string; box?: string }) => (
  <div className={cn("rounded-full overflow-hidden flex-shrink-0", box)}>
    <img src={src} alt={alt} className="w-full h-full object-cover scale-[1.6]" />
  </div>
);
const MailBadge = ({ box = "w-9 h-9" }: { box?: string; icon?: string }) => <IconBadge src={emailIcon} alt="E‑mail" box={box} />;
const AguardeBadge = ({ box = "w-9 h-9" }: { box?: string; icon?: string }) => <IconBadge src={aguardeIcon} alt="Aguarde" box={box} />;
const TagBadge = ({ box = "w-9 h-9" }: { box?: string; icon?: string }) => <IconBadge src={tagIcon} alt="Tag" box={box} />;
const PipelineBadge = ({ box = "w-9 h-9" }: { box?: string; icon?: string }) => <IconBadge src={pipelineIcon} alt="Pipeline" box={box} />;

// Styled dropdown (our visual) — native select + custom chevron.
function SelectField({ label, value, onChange, disabled, children }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground/80">{label}</label>
      <div className="relative mt-2">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="w-full h-12 rounded-lg border border-border pl-4 pr-11 outline-none text-base bg-background appearance-none cursor-pointer hover:border-foreground/30 focus:border-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}
// Zoom the email content a bit in previews so the fonts read larger.
const previewDoc = (html: string) => {
  const z = "<style>html{zoom:1.15}</style>";
  return html.includes("</head>") ? html.replace("</head>", z + "</head>") : z + html;
};

const triggerDesc = (t: TriggerCfg) => {
  if (isPipelineTrigger(t)) return `Entrou no pipeline “${t.pipelineName}”`;
  return t.type === "tag_removed" ? `Perdeu a tag “${t.tagName}”` : `Recebeu a tag “${t.tagName}”`;
};

// Trigger card (top of the flow) — icon circle + "Inicie a automação quando" + bold description.
function TriggerCard({ trigger, onClick }: { trigger: TriggerCfg; onClick: () => void }) {
  const pipeline = isPipelineTrigger(trigger);
  return (
    <button data-node onClick={onClick} className="relative w-[280px] rounded-2xl bg-card border border-border shadow-sm px-6 pt-9 pb-6 text-center hover:border-purple-400 transition-colors">
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full ring-4 ring-background">
        {pipeline ? <PipelineBadge box="w-12 h-12" /> : <TagBadge box="w-12 h-12" />}
      </div>
      <p className="text-sm text-muted-foreground">Inicie a automação quando</p>
      <p className="text-[15px] font-bold mt-1 leading-snug">{triggerDesc(trigger)}</p>
    </button>
  );
}

// Curved connectors from each trigger card down to the central "+" of the flow.
function TriggerConnectors({ count }: { count: number }) {
  const CARD = 280, GAP = 16, H = 48;
  const W = count * CARD + (count - 1) * GAP;
  const cx = W / 2;
  return (
    <svg width={W} height={H} className="block mx-auto text-zinc-300 dark:text-zinc-600" style={{ overflow: "visible" }}>
      {Array.from({ length: count }).map((_, i) => {
        const x = i * (CARD + GAP) + CARD / 2;
        return <path key={i} d={`M ${x} 0 C ${x} ${H * 0.7}, ${cx} ${H * 0.35}, ${cx} ${H}`} stroke="currentColor" strokeWidth={2} fill="none" />;
      })}
    </svg>
  );
}

function DashedAddTrigger({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button data-node onClick={onClick} className="w-[280px] rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-purple-400 hover:text-foreground transition-colors flex items-center justify-center px-4 min-h-[90px]">
      {label}
    </button>
  );
}

/* ------------------------------- Editor ------------------------------ */

interface Props {
  automation: { id: string; name: string; is_active: boolean };
  onBack: () => void;
}

export function CampaignFlowEditor({ automation, onBack }: Props) {
  const initFlow = ((automation as any).flow_steps || {}) as { triggers?: TriggerCfg[]; trigger?: TriggerCfg; steps?: Step[] };
  const [active, setActive] = useState(!!automation.is_active);
  const [tags, setTags] = useState<string[]>(((automation as any).tags as string[]) || []);
  const [tagInput, setTagInput] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const saveTags = async (next: string[]) => {
    setTags(next);
    await (supabase as any).from("email_automations").update({ tags: next }).eq("id", automation.id);
  };
  const addTag = () => {
    const v = tagInput.trim();
    setAddingTag(false);
    setTagInput("");
    if (!v || tags.includes(v)) return;
    void saveTags([...tags, v]);
  };
  const removeTag = (t: string) => void saveTags(tags.filter((x) => x !== t));
  const [triggers, setTriggers] = useState<TriggerCfg[]>(
    Array.isArray(initFlow.triggers) ? initFlow.triggers : (initFlow.trigger ? [initFlow.trigger] : [])
  );
  const [steps, setSteps] = useState<Step[]>(Array.isArray(initFlow.steps) ? initFlow.steps : []);
  const [saved, setSaved] = useState(true);
  const loaded = useRef(false);

  // Which trigger is being configured: an index (edit), "new" (add), or null (closed).
  const [triggerEdit, setTriggerEdit] = useState<number | "new" | null>(null);
  const [addAt, setAddAt] = useState<number | null>(null);
  const [emailFor, setEmailFor] = useState<string | null>(null);
  const [timerFor, setTimerFor] = useState<string | null>(null);

  const [templates, setTemplates] = useState<Opt[]>([]);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [stats, setStats] = useState<Record<string, { sent: number; opened: number; clicked: number }>>({});

  // Pan / zoom
  const [view, setView] = useState({ x: 0, y: 48, k: 1 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mail-editor", { detail: { open: true } }));
    return () => window.dispatchEvent(new CustomEvent("mail-editor", { detail: { open: false } }));
  }, []);

  useEffect(() => {
    (async () => {
      // Flow (trigger/steps) is already initialized from the prop, so it renders instantly.
      // Here we only fetch what the panels/metrics need.
      const [{ data: t }, { data: d }, { data: st }] = await Promise.all([
        (supabase as any).from("email_templates").select("id,name,body_html,subject").order("created_at", { ascending: false }),
        (supabase as any).from("email_domains").select("domain,sender_name,sender_local").eq("is_active", true).limit(1).maybeSingle(),
        (supabase as any).rpc("automation_step_stats", { p_automation_id: automation.id }),
      ]);
      setTemplates((t || []) as Opt[]);
      setDomain((d as Domain) || null);
      const map: Record<string, { sent: number; opened: number; clicked: number }> = {};
      ((st || []) as any[]).forEach((r) => { map[r.step_id] = { sent: Number(r.sent), opened: Number(r.opened), clicked: Number(r.clicked) }; });
      setStats(map);
      loaded.current = true;
    })();
  }, [automation.id]);

  const persist = useCallback(async () => {
    const pipe = triggers.find((t) => isPipelineTrigger(t)) as Extract<TriggerCfg, { pipelineId: string }> | undefined;
    const { error } = await (supabase as any)
      .from("email_automations")
      .update({ flow_steps: { triggers, steps }, trigger_pipeline_id: pipe?.pipelineId ?? null, sub_origin_id: pipe?.subOriginId ?? null })
      .eq("id", automation.id);
    if (error) toast.error("Erro ao salvar o fluxo"); else setSaved(true);
  }, [triggers, steps, automation.id]);

  useEffect(() => {
    if (!loaded.current) return;
    setSaved(false);
    const t = setTimeout(() => void persist(), 700);
    return () => clearTimeout(t);
  }, [triggers, steps, persist]);

  const stateRef = useRef({ triggers, steps });
  useEffect(() => { stateRef.current = { triggers, steps }; }, [triggers, steps]);
  useEffect(() => () => {
    if (!loaded.current) return;
    const { triggers: trs, steps: st } = stateRef.current;
    const pipe = trs.find((t) => isPipelineTrigger(t)) as Extract<TriggerCfg, { pipelineId: string }> | undefined;
    void (supabase as any).from("email_automations")
      .update({ flow_steps: { triggers: trs, steps: st }, trigger_pipeline_id: pipe?.pipelineId ?? null, sub_origin_id: pipe?.subOriginId ?? null })
      .eq("id", automation.id);
  }, [automation.id]);

  const toggleActive = async (next: boolean) => {
    setActive(next);
    const { error } = await (supabase as any).from("email_automations").update({ is_active: next }).eq("id", automation.id);
    if (error) { setActive(!next); toast.error("Erro ao atualizar status"); }
  };

  /* --------------------------- Steps --------------------------- */
  const insertStep = (i: number, s: Step) => setSteps((arr) => [...arr.slice(0, i), s, ...arr.slice(i)]);
  const updateStep = (id: string, patch: Partial<Step>) => setSteps((arr) => arr.map((x) => (x.id === id ? ({ ...x, ...patch } as Step) : x)));
  const removeStep = (id: string) => setSteps((arr) => arr.filter((x) => x.id !== id));
  const addEmail = (i: number) => { const id = genId(); insertStep(i, { id, type: "email" }); setAddAt(null); setEmailFor(id); };
  const addTimer = (i: number) => { const id = genId(); insertStep(i, { id, type: "timer", mode: "duration", amount: 1, unit: "days" }); setAddAt(null); setTimerFor(id); };
  const sentCount = (id: string) => stats[id]?.sent ?? 0;
  const pct = (id: string, key: "opened" | "clicked") => { const s = stats[id]; return s && s.sent ? Math.round((s[key] / s.sent) * 100) : 0; };

  /* --------------------------- Pan / zoom --------------------------- */
  useEffect(() => {
    const el = viewportRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      setView((v) => {
        const k = clamp(v.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.3, 2);
        const wx = (mx - v.x) / v.k, wy = (my - v.y) / v.k;
        return { k, x: mx - wx * k, y: my - wy * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPanStart = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-node], button, input, a, label, select")) return;
    pan.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    const move = (ev: MouseEvent) => {
      if (!pan.current) return;
      setView((v) => ({ ...v, x: pan.current!.vx + (ev.clientX - pan.current!.sx), y: pan.current!.vy + (ev.clientY - pan.current!.sy) }));
    };
    const up = () => { pan.current = null; document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
  const zoomBy = (factor: number) => setView((v) => {
    const el = viewportRef.current; if (!el) return v;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2, my = rect.height / 2;
    const k = clamp(v.k * factor, 0.3, 2);
    const wx = (mx - v.x) / v.k, wy = (my - v.y) / v.k;
    return { k, x: mx - wx * k, y: my - wy * k };
  });

  const AddBtn = ({ index }: { index: number }) => (
    <button onClick={() => setAddAt(index)} className="w-9 h-9 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-foreground hover:bg-accent hover:border-purple-400 hover:text-purple-700 transition-colors" title="Adicionar etapa">
      <Plus className="h-4 w-4" />
    </button>
  );
  const Line = () => <div className="w-[2px] h-7 bg-zinc-300 dark:bg-zinc-600" />;

  return (
    <div className="h-full flex flex-col bg-background pt-2">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1.5 text-sm">
          <button onClick={onBack} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors font-medium">
            <ChevronLeft className="h-4 w-4" /> Automações
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">{automation.name}</span>
          {/* Campaign tags */}
          <div className="flex items-center gap-1.5 ml-2">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 text-xs font-medium">
                {t}
                <button onClick={() => removeTag(t)} className="hover:bg-purple-500/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {addingTag ? (
              <input
                autoFocus
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTag(); if (e.key === "Escape") { setAddingTag(false); setTagInput(""); } }}
                onBlur={addTag}
                placeholder="nova tag"
                className="h-6 w-28 rounded-full border border-border px-2.5 text-xs outline-none focus:border-purple-400 bg-background"
              />
            ) : (
              <button onClick={() => setAddingTag(true)} className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-dashed border-border text-xs text-muted-foreground hover:border-purple-400 hover:text-purple-700 transition-colors">
                <Tag className="h-3 w-3" /> Tag
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs font-medium">
            <button onClick={() => toggleActive(true)} className={cn("flex items-center gap-1.5 px-3 h-8 transition-colors", active ? "bg-emerald-500/15 text-emerald-600" : "text-muted-foreground hover:bg-accent")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground/40")} /> Ativo
            </button>
            <button onClick={() => toggleActive(false)} className={cn("flex items-center gap-1.5 px-3 h-8 transition-colors border-l border-border", !active ? "bg-zinc-500/15 text-foreground" : "text-muted-foreground hover:bg-accent")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", !active ? "bg-zinc-400" : "bg-muted-foreground/40")} /> Inativo
            </button>
          </div>
        </div>
      </div>

      {/* Canvas — free pan + zoom */}
      <div
        ref={viewportRef}
        onMouseDown={onPanStart}
        className="flex-1 min-h-0 relative overflow-hidden cursor-grab active:cursor-grabbing bg-[radial-gradient(circle,#c4c4cc_1px,transparent_1px)] [background-size:22px_22px] dark:bg-[radial-gradient(circle,#52525b_1px,transparent_1px)]"
      >
        <div className="absolute top-0 left-0 w-full" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0" }}>
          <div className="flex flex-col items-center pb-24">
            {/* Triggers — cards side by side at the top + dashed "add another" */}
            <div className="relative pt-6">
              <div className="flex items-stretch justify-center gap-4">
                {triggers.map((t, i) => (
                  <TriggerCard key={i} trigger={t} onClick={() => setTriggerEdit(i)} />
                ))}
                {triggers.length === 0 && (
                  <DashedAddTrigger label="Adicione um gatilho de entrada" onClick={() => setTriggerEdit("new")} />
                )}
              </div>
              {triggers.length > 0 && (
                <div className="absolute top-6" style={{ left: `calc(50% + ${(triggers.length * 280 + (triggers.length - 1) * 16) / 2 + 16}px)` }}>
                  <DashedAddTrigger label="Adicione outro gatilho de entrada" onClick={() => setTriggerEdit("new")} />
                </div>
              )}
            </div>

            {triggers.length >= 2 ? <TriggerConnectors count={triggers.length} /> : <Line />}
            <AddBtn index={0} />

            {steps.map((step, i) => (
              <div key={step.id} className="flex flex-col items-center">
                <Line />
                {step.type === "email" ? (
                  <div data-node className="w-[520px] rounded-xl bg-card shadow-sm border border-border overflow-hidden group relative">
                    <button onClick={() => removeStep(step.id)} className="absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent opacity-0 group-hover:opacity-100 z-10" title="Remover"><X className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setEmailFor(step.id)} className="w-full text-left">
                      <div className="flex items-center gap-5 pl-4 pr-6 py-6">
                        <MailBadge box="w-12 h-12" />
                        <p className="text-[15px] font-bold text-foreground flex items-center gap-2.5 leading-tight whitespace-nowrap min-w-0">
                          Enviar um email:
                          <span className="px-2.5 py-1 rounded-md bg-[#e7eefc] text-[13px] font-medium text-foreground truncate max-w-[300px]">{step.templateName || "New Campaign"}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-6 px-5 py-3 border-t border-border text-[13px] font-semibold text-blue-600 whitespace-nowrap">
                        <span className="flex items-center gap-1.5"><Send className="h-3.5 w-3.5" /> {sentCount(step.id)} enviados</span>
                        <span className="flex items-center gap-1.5"><MailOpen className="h-3.5 w-3.5" /> {pct(step.id, "opened")}% de taxa de abertura</span>
                        <span className="flex items-center gap-1.5"><MousePointerClick className="h-3.5 w-3.5" /> {pct(step.id, "clicked")}% de taxa de cliques</span>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div data-node className="w-[400px] rounded-xl bg-card shadow-sm border border-border overflow-hidden group relative">
                    <button onClick={() => removeStep(step.id)} className="absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent opacity-0 group-hover:opacity-100" title="Remover"><X className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setTimerFor(step.id)} className="w-full text-left">
                      <div className="flex items-start gap-3 p-4">
                        <AguardeBadge />
                        <div className="pt-0.5 min-w-0">
                          <p className="text-sm font-semibold leading-tight">Aguarde</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {step.mode === "datetime" && step.datetime
                              ? `Até ${fmtDateTime(step.datetime)}`
                              : `Aguardar ${step.amount ?? 1} ${UNIT_LABEL[step.unit ?? "days"]}`}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}
                <Line />
                <AddBtn index={i + 1} />
              </div>
            ))}

            <Line />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1"><Ban className="h-3.5 w-3.5" /> A automação é encerrada</div>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 left-4 flex flex-col rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          <button onClick={() => zoomBy(1.15)} className="h-8 w-8 flex items-center justify-center hover:bg-accent" title="Aproximar"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={() => zoomBy(1 / 1.15)} className="h-8 w-8 flex items-center justify-center hover:bg-accent border-t border-border" title="Afastar"><ZoomOut className="h-4 w-4" /></button>
          <button onClick={() => setView({ x: 0, y: 48, k: 1 })} className="h-8 w-8 flex items-center justify-center hover:bg-accent border-t border-border" title="Redefinir"><Maximize2 className="h-4 w-4" /></button>
        </div>
        <div className="absolute bottom-4 right-4 text-[11px] text-muted-foreground bg-card/80 border border-border rounded px-2 py-1">{Math.round(view.k * 100)}%</div>
      </div>

      {/* Modals / panels */}
      {triggerEdit !== null && (
        <TriggerModal
          current={typeof triggerEdit === "number" ? triggers[triggerEdit] : null}
          onClose={() => setTriggerEdit(null)}
          onSave={(cfg) => {
            setTriggers((prev) => {
              if (typeof triggerEdit === "number") { const next = [...prev]; next[triggerEdit] = cfg; return next; }
              return [...prev, cfg];
            });
            setTriggerEdit(null);
          }}
          onDelete={typeof triggerEdit === "number" ? () => {
            setTriggers((prev) => prev.filter((_, i) => i !== triggerEdit));
            setTriggerEdit(null);
          } : undefined}
        />
      )}
      {addAt !== null && (
        <AddActionModal onClose={() => setAddAt(null)} onEmail={() => addEmail(addAt)} onTimer={() => addTimer(addAt)} />
      )}
      {emailFor && (() => {
        const step = steps.find((s) => s.id === emailFor);
        if (!step || step.type !== "email") return null;
        return <EmailPanel step={step} templates={templates} domain={domain} onChange={(p) => updateStep(step.id, p)} onClose={() => setEmailFor(null)} />;
      })()}
      {timerFor && (() => {
        const step = steps.find((s) => s.id === timerFor);
        if (!step || step.type !== "timer") return null;
        return <TimerPanel step={step} onChange={(p) => updateStep(step.id, p)} onClose={() => setTimerFor(null)} />;
      })()}
    </div>
  );
}

/* ---------------------------- Shared shells ---------------------------- */

function CenterModal({ children, onClose, size = "max-w-4xl", tall = true }: { children: React.ReactNode; onClose: () => void; size?: string; tall?: boolean }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/30" />
      <div className={cn("relative w-full bg-background rounded-2xl border border-border shadow-xl flex flex-col overflow-hidden", size, tall ? "h-[82vh]" : "max-h-[88vh]")} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}

function SidePanel({ title, subtitle, icon, onClose, footer, children, width = "w-[560px]" }: { title: string; subtitle?: string; icon?: React.ReactNode; onClose: () => void; footer?: (close: () => void) => React.ReactNode; children: React.ReactNode; width?: string }) {
  const [closing, setClosing] = useState(false);
  const close = () => { if (closing) return; setClosing(true); setTimeout(onClose, 260); };
  return createPortal(
    <div className="fixed inset-0 z-[100]" onClick={close}>
      <div className={cn("absolute inset-0 bg-foreground/20 transition-opacity duration-300", closing && "opacity-0")} />
      <div className={cn("absolute top-[52px] bottom-4 right-4 rounded-2xl overflow-hidden max-w-[96vw] bg-background border border-border shadow-xl flex flex-col", closing ? "panel-slide-out" : "panel-slide-in", width)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <p className="text-base font-bold leading-tight">{title}</p>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={close} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent flex-shrink-0"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-auto px-6 pt-7 pb-6">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-6 h-16 border-t border-border flex-shrink-0">{footer(close)}</div>}
      </div>
    </div>,
    document.body
  );
}

/* ---------------------------- Trigger modal ---------------------------- */

function TriggerModal({ current, onClose, onSave, onDelete }: { current: TriggerCfg | null; onClose: () => void; onSave: (c: TriggerCfg) => void; onDelete?: () => void }) {
  const cp = isPipelineTrigger(current) ? current : null;
  const initStage = current ? (isPipelineTrigger(current) ? "pipeline_enter" : current.type) : "list";
  const [stage, setStage] = useState<"list" | "pipeline_enter" | "tag_added" | "tag_removed">(initStage as any);
  const [search, setSearch] = useState("");

  // Pre-seed the option lists with the current selection so the config shows instantly (no flash).
  const [workspaces, setWorkspaces] = useState<Opt[]>(cp ? [{ id: cp.workspaceId, name: cp.workspaceName }] : []);
  const [subOrigins, setSubOrigins] = useState<Opt[]>(cp ? [{ id: cp.subOriginId, nome: cp.subOriginName }] : []);
  const [pipelines, setPipelines] = useState<Opt[]>(cp ? [{ id: cp.pipelineId, nome: cp.pipelineName }] : []);
  const [tags, setTags] = useState<string[]>(!cp && current ? [current.tagName] : []);
  const [ws, setWs] = useState<Opt | null>(cp ? { id: cp.workspaceId, name: cp.workspaceName } : null);
  const [sub, setSub] = useState<Opt | null>(cp ? { id: cp.subOriginId, nome: cp.subOriginName } : null);
  const [pipe, setPipe] = useState<Opt | null>(cp ? { id: cp.pipelineId, nome: cp.pipelineName } : null);
  const [tag, setTag] = useState<string>(current && !isPipelineTrigger(current) ? current.tagName : "");

  useEffect(() => {
    (async () => {
      const [{ data: wss }, { data: lt }] = await Promise.all([
        (supabase as any).from("workspaces").select("id,name").order("name"),
        (supabase as any).from("lead_tags").select("name").limit(2000),
      ]);
      setWorkspaces((wss || []) as Opt[]);
      setTags(Array.from(new Set(((lt || []) as any[]).map((r) => r.name).filter(Boolean))).sort() as string[]);
    })();
  }, []);
  useEffect(() => {
    if (!ws) { setSubOrigins([]); return; }
    (async () => {
      const { data: origins } = await (supabase as any).from("crm_origins").select("id").eq("workspace_id", ws.id);
      const ids = (origins || []).map((o: any) => o.id);
      if (!ids.length) { setSubOrigins([]); return; }
      const { data } = await (supabase as any).from("crm_sub_origins").select("id,nome").in("origin_id", ids).order("ordem");
      setSubOrigins((data || []) as Opt[]);
    })();
  }, [ws]);
  useEffect(() => {
    if (!sub) { setPipelines([]); return; }
    (async () => {
      const { data } = await (supabase as any).from("pipelines").select("id,nome").eq("sub_origin_id", sub.id).order("ordem");
      setPipelines((data || []) as Opt[]);
    })();
  }, [sub]);

  const nameOf = (o: Opt) => o.nome || o.name || "";
  const TRIGGERS = [
    { key: "pipeline_enter", label: "Entrou em um pipeline", icon: GitBranch, cat: "crm", desc: "Dispara quando um contato entra no pipeline escolhido" },
    { key: "tag_added", label: "Tag adicionada", icon: Tag, cat: "tags", desc: "Dispara quando uma tag é adicionada ao contato" },
    { key: "tag_removed", label: "Tag removida", icon: Tag, cat: "tags", desc: "Dispara quando uma tag é removida do contato" },
  ] as const;
  const visible = TRIGGERS.filter((t) => t.label.toLowerCase().includes(search.toLowerCase()));


  const configFooter = (canSave: boolean, save: () => void) => (
    <>
      <div className="flex items-center justify-between px-6 h-16 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setStage("list")} className="h-10 px-4 rounded border border-border text-sm font-medium hover:bg-accent flex items-center gap-1"><ChevronLeft className="h-4 w-4" /> Voltar</button>
          {onDelete && <button onClick={onDelete} className="h-10 px-4 rounded border border-border text-sm font-medium text-red-600 hover:bg-red-500/10">Remover</button>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded border border-border text-sm font-medium hover:bg-accent">Cancelar</button>
          <button disabled={!canSave} onClick={save} className="h-10 px-5 rounded bg-purple-900 hover:bg-purple-800 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Salvar</button>
        </div>
      </div>
    </>
  );

  return (
    <CenterModal onClose={onClose} size={stage === "list" ? "max-w-4xl" : "max-w-2xl"} tall={stage === "list"}>
      {stage === "list" ? (
        <>
          <div className="flex items-center justify-between gap-4 px-6 h-16 border-b border-border flex-shrink-0">
            <h2 className="text-lg font-bold">Selecione um acionador</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar gatilhos" className="h-9 w-56 rounded-lg border border-border pl-8 pr-3 text-sm outline-none focus:border-purple-400" />
              </div>
              <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 overflow-auto p-8">
              <div className="grid grid-cols-2 gap-4">
                {visible.map((t) => (
                  <button key={t.key} onClick={() => setStage(t.key as any)} className="group flex items-center gap-4 rounded-2xl border border-border p-5 text-left hover:bg-accent transition-colors">
                    {t.key === "pipeline_enter" ? <PipelineBadge box="w-14 h-14" icon="h-6 w-6" /> : <TagBadge box="w-14 h-14" />}
                    <div>
                      <p className="text-base font-semibold">{t.label}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
                    </div>
                  </button>
                ))}
                {visible.length === 0 && <p className="text-sm text-muted-foreground col-span-2">Nada encontrado.</p>}
              </div>
            </div>
          </div>
        </>
      ) : stage === "pipeline_enter" ? (
        <>
          <div className="flex items-center gap-3 px-6 h-16 border-b border-border flex-shrink-0">
            <div><p className="text-base font-bold leading-tight">Entrou em um pipeline</p></div>
          </div>
          <div className="flex-1 overflow-auto p-8 space-y-5">
            <SelectField label="Workspace" value={ws?.id || ""} onChange={(e) => { const o = workspaces.find((w) => w.id === e.target.value) || null; setWs(o); setSub(null); setPipe(null); }}>
              <option value="">Selecione o workspace</option>
              {workspaces.map((o) => <option key={o.id} value={o.id}>{nameOf(o)}</option>)}
            </SelectField>
            <SelectField label="Espaço" value={sub?.id || ""} disabled={!ws} onChange={(e) => { const o = subOrigins.find((s) => s.id === e.target.value) || null; setSub(o); setPipe(null); }}>
              <option value="">{ws ? "Selecione o espaço" : "Escolha um workspace"}</option>
              {subOrigins.map((o) => <option key={o.id} value={o.id}>{nameOf(o)}</option>)}
            </SelectField>
            <SelectField label="Pipeline" value={pipe?.id || ""} disabled={!sub} onChange={(e) => { const o = pipelines.find((p) => p.id === e.target.value) || null; setPipe(o); }}>
              <option value="">{sub ? "Selecione o pipeline" : "Escolha um espaço"}</option>
              {pipelines.map((o) => <option key={o.id} value={o.id}>{nameOf(o)}</option>)}
            </SelectField>
          </div>
          {configFooter(!!(ws && sub && pipe), () => ws && sub && pipe && onSave({ type: "pipeline_enter", workspaceId: ws.id, workspaceName: nameOf(ws), subOriginId: sub.id, subOriginName: nameOf(sub), pipelineId: pipe.id, pipelineName: nameOf(pipe) }))}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 px-6 h-16 border-b border-border flex-shrink-0">
            <div><p className="text-base font-bold leading-tight">{stage === "tag_removed" ? "Tag removida" : "Tag adicionada"}</p><p className="text-xs text-muted-foreground">Escolha a tag que inicia a automação</p></div>
          </div>
          <div className="flex-1 overflow-auto p-8">
            <SelectField label="Selecionar tag" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Escolha uma tag</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </SelectField>
            {tags.length === 0 && <p className="text-sm text-muted-foreground mt-2">Nenhuma tag encontrada nos contatos.</p>}
          </div>
          {configFooter(!!tag, () => onSave({ type: stage, tagName: tag }))}
        </>
      )}
    </CenterModal>
  );
}

/* ---------------------------- Add action modal ---------------------------- */

function AddActionModal({ onClose, onEmail, onTimer }: { onClose: () => void; onEmail: () => void; onTimer: () => void }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("enviando");
  const TABS = [
    { key: "enviando", label: "Enviando", icon: Mail },
    { key: "fluxo", label: "Fluxo de trabalho", icon: GitBranch },
    { key: "contatos", label: "Contatos", icon: Users },
    { key: "crm", label: "CRM", icon: Tag },
  ];
  const actions = [
    { key: "email", tab: ["enviando"], title: "Enviar um e‑mail", desc: "Um e‑mail de marketing para os contatos inscritos", run: onEmail },
    { key: "timer", tab: ["fluxo"], title: "Aguarde", desc: "Esperar por um período de tempo antes da próxima etapa", run: onTimer },
  ];
  const visible = actions.filter((a) => a.tab.includes(tab) && a.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <SidePanel title="Adicione uma ação" width="w-[560px]" onClose={onClose}>
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar por uma ação" className="h-11 w-full rounded-lg border border-border pl-9 pr-3 text-base outline-none" />
          </div>
          <div className="flex items-center gap-2.5 mt-5 flex-wrap">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors", tab === t.key ? "bg-purple-500/10 text-purple-800" : "text-muted-foreground hover:bg-accent")}>
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto mt-4 space-y-2.5">
          {visible.map((a) => (
            <button key={a.key} onClick={a.run} className="w-full flex items-center gap-3.5 rounded-xl border border-border p-4 text-left hover:bg-accent transition-colors">
              {a.key === "email" ? <MailBadge box="w-12 h-12" /> : <AguardeBadge box="w-12 h-12" />}
              <div><p className="text-base font-semibold">{a.title}</p><p className="text-sm text-muted-foreground mt-0.5">{a.desc}</p></div>
            </button>
          ))}
          {visible.length === 0 && <p className="text-base text-muted-foreground text-center py-8">Nenhuma ação nesta categoria ainda.</p>}
        </div>
      </div>
    </SidePanel>
  );
}

/* ---------------------------- Email panel ---------------------------- */

function EmailRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3 py-3.5 border-b border-border">
      <label className="text-base text-muted-foreground">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function EmailPanel({ step, templates, domain, onChange, onClose }: { step: Extract<Step, { type: "email" }>; templates: Opt[]; domain: Domain | null; onChange: (p: Partial<Step>) => void; onClose: () => void }) {
  const [picking, setPicking] = useState(!step.templateId);
  const tpl = templates.find((t) => t.id === step.templateId);
  const fromLine = domain?.domain ? `${domain.sender_name || "Equipe"} <${domain.sender_local || "contato"}@${domain.domain}>` : "Nenhum domínio ativo";

  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSubject, setTestSubject] = useState(step.subject || tpl?.subject || "");
  const [sending, setSending] = useState(false);
  const sendTest = async () => {
    if (!testEmail || !tpl) return;
    setSending(true);
    const { error } = await (supabase as any).functions.invoke("send-email", {
      body: { leadId: "test", leadName: "Teste", leadEmail: testEmail, templateId: step.templateId, subject: testSubject || "Teste", bodyHtml: tpl.body_html || "" },
    });
    setSending(false);
    if (error) toast.error("Erro ao enviar o teste");
    else { toast.success("E‑mail de teste enviado!"); setTestOpen(false); }
  };

  const canFinish = !!tpl && !!(step.subject && step.subject.trim());

  return (
    <SidePanel
      title="Enviar um e‑mail"
      subtitle="Um e‑mail de marketing para os contatos inscritos"
      icon={<MailBadge />}
      width="w-[760px]"
      onClose={onClose}
      footer={(close) => (
        <div className="flex-1 flex items-center justify-between">
          <button onClick={() => setTestOpen((v) => !v)} className="text-sm text-purple-700 font-medium hover:underline">Enviar um teste</button>
          <div className="flex items-center gap-3">
            {!canFinish && <span className="text-xs text-red-500">{!tpl ? "Escolha o e‑mail" : "Assunto é obrigatório"}</span>}
            <button onClick={close} disabled={!canFinish} className="h-10 px-5 rounded bg-purple-900 hover:bg-purple-800 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Finalizar</button>
          </div>
        </div>
      )}
    >
      <div className="flex flex-col h-full">
        {testOpen && (
          <div className="mb-4 rounded-xl border border-border bg-muted/40 p-4 flex-shrink-0">
            <p className="text-sm font-semibold mb-2">Enviar e‑mail de teste</p>
            <input value={testSubject} onChange={(e) => setTestSubject(e.target.value)} placeholder="Assunto do teste" className="w-full h-9 bg-transparent border-b border-border mb-2 outline-none text-sm placeholder:text-muted-foreground/70" />
            <div className="flex items-center gap-2">
              <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="e‑mail para receber o teste" className="flex-1 h-9 bg-transparent border-b border-border outline-none text-sm placeholder:text-muted-foreground/70" />
              <button onClick={sendTest} disabled={!testEmail || !tpl || sending} className="h-9 px-4 rounded-lg bg-purple-900 hover:bg-purple-800 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">{sending ? "Enviando…" : "Enviar"}</button>
            </div>
            {!tpl && <p className="text-xs text-muted-foreground mt-2">Escolha um template antes de enviar o teste.</p>}
          </div>
        )}
        <div className="flex-shrink-0">
          <EmailRow label="Nome do e‑mail:">
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-medium truncate">{tpl?.name || "Nenhum e‑mail selecionado"}</span>
              <button onClick={() => setPicking((v) => !v)} className="text-base text-purple-700 hover:underline font-medium flex-shrink-0">{tpl ? "Selecionar novo e‑mail" : "Escolher e‑mail"}</button>
            </div>
          </EmailRow>
          <EmailRow label="Linha de assunto:" required>
            <input value={step.subject || ""} onChange={(e) => onChange({ subject: e.target.value })} placeholder="Escreva sua linha de assunto" className={cn("w-full h-9 bg-transparent outline-none text-base", tpl && !step.subject?.trim() ? "placeholder:text-red-400" : "placeholder:text-muted-foreground/70")} />
          </EmailRow>
          <EmailRow label="Pré‑cabeçalho:">
            <input value={step.preheader || ""} onChange={(e) => onChange({ preheader: e.target.value })} placeholder="Escreva seu preheader" className="w-full h-9 bg-transparent outline-none text-base placeholder:text-muted-foreground/70" />
          </EmailRow>
          <EmailRow label="De:">
            <span className="text-base">{fromLine}</span>
          </EmailRow>
        </div>

        {picking ? (
          <div className="flex-1 overflow-auto mt-4 space-y-2">
            {templates.length === 0 && <p className="text-base text-muted-foreground">Nenhum template salvo. Crie um em Estrutura › Templates.</p>}
            {templates.map((t) => (
              <button key={t.id} onClick={() => { onChange({ templateId: t.id, templateName: t.name, subject: step.subject || t.subject || "" }); setPicking(false); }} className="w-full flex items-center gap-3 p-2 rounded-lg border border-border text-left transition-colors">
                <div className="w-[56px] h-[56px] rounded-sm border border-border overflow-hidden bg-white flex-shrink-0 relative">
                  {t.body_html && t.body_html.includes("<") ? (
                    <iframe title={t.name} srcDoc={t.body_html} scrolling="no" tabIndex={-1} aria-hidden className="border-0 pointer-events-none absolute top-0 left-0" style={{ width: 600, height: 600, transform: `scale(${56 / 600})`, transformOrigin: "top left" }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Mail className="h-4 w-4 text-muted-foreground/40" /></div>
                  )}
                </div>
                <span className="text-base font-medium truncate flex-1">{t.name}</span>
              </button>
            ))}
          </div>
        ) : tpl ? (
          <div className="flex-1 min-h-[380px] mt-4 rounded-xl border border-border overflow-hidden bg-white">
            <iframe title={tpl.name || ""} srcDoc={previewDoc(tpl.body_html || "")} className="w-full h-full border-0" />
          </div>
        ) : null}
      </div>
    </SidePanel>
  );
}

/* ---------------------------- Timer panel ---------------------------- */

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEKDAYS_PT = ["D","S","T","Q","Q","S","S"];

// Custom calendar dropdown (our visual).
function MiniCalendar({ value, onPick }: { value: string; onPick: (d: string) => void }) {
  const parse = (s: string) => {
    const [y, m, d] = (s || "").split("-").map(Number);
    return (y && m && d) ? new Date(y, m - 1, d) : new Date();
  };
  const [view, setView] = useState(() => { const s = parse(value); return new Date(s.getFullYear(), s.getMonth(), 1); });
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return (
    <div className="w-[268px] rounded-xl border border-border bg-background shadow-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setView(new Date(year, month - 1, 1))} className="h-7 w-7 rounded-md hover:bg-accent flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-semibold">{MONTHS_PT[month]} {year}</span>
        <button onClick={() => setView(new Date(year, month + 1, 1))} className="h-7 w-7 rounded-md hover:bg-accent flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS_PT.map((w, i) => <div key={i} className="h-7 flex items-center justify-center text-[11px] text-muted-foreground font-medium">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => d === null ? <div key={i} /> : (
          <button
            key={i}
            onClick={() => onPick(fmt(d))}
            className={cn(
              "h-8 rounded-md text-sm transition-colors flex items-center justify-center",
              value === fmt(d)
                ? "bg-purple-600 text-white font-semibold"
                : (today.getFullYear() === year && today.getMonth() === month && today.getDate() === d)
                ? "text-purple-700 font-semibold hover:bg-accent"
                : "hover:bg-accent"
            )}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

// Format a stored time (HH:MM or HH:MM:SS) as a masked HH:MM:SS while typing.
const maskTime = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
};
const normalizeTime = (raw: string) => {
  const digits = (raw || "").replace(/\D/g, "").padEnd(6, "0").slice(0, 6);
  const h = Math.min(23, Number(digits.slice(0, 2)));
  const m = Math.min(59, Number(digits.slice(2, 4)));
  const s = Math.min(59, Number(digits.slice(4, 6)));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
};

function TimerPanel({ step, onChange, onClose }: { step: Extract<Step, { type: "timer" }>; onChange: (p: Partial<Step>) => void; onClose: () => void }) {
  const mode = step.mode || "duration";
  const [calOpen, setCalOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const dt = step.datetime || "";
  const datePart = dt.includes("T") ? dt.split("T")[0] : "";
  const timePart = dt.includes("T") ? dt.split("T")[1] : "";
  const defaultDate = () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const toDuration = () => onChange({ mode: "duration", amount: step.amount ?? 1, unit: step.unit ?? "days" });
  const toDatetime = () => onChange({ mode: "datetime", datetime: dt || `${defaultDate()}T00:00:00` });

  return (
    <SidePanel
      title="Aguarde"
      subtitle="Espere um período ou até uma data e hora específicas"
      icon={<AguardeBadge />}
      width="w-[480px]"
      onClose={onClose}
      footer={(close) => <button onClick={close} className="h-10 px-5 rounded bg-purple-900 hover:bg-purple-800 text-white text-sm font-semibold">Finalizar</button>}
    >
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted mb-6">
        <button onClick={toDuration} className={cn("flex-1 h-9 rounded-lg text-sm font-medium transition-colors", mode === "duration" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
          Período de tempo
        </button>
        <button onClick={toDatetime} className={cn("flex-1 h-9 rounded-lg text-sm font-medium transition-colors", mode === "datetime" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
          Data e hora
        </button>
      </div>

      {mode === "duration" ? (
        <div>
          <label className="text-sm font-semibold text-foreground/80">O contato aguardará</label>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min={1}
              value={step.amount ?? 1}
              onChange={(e) => onChange({ amount: Math.max(1, Number(e.target.value) || 1) })}
              className="w-24 h-12 rounded-lg border border-border px-3 outline-none focus:border-purple-400 text-base"
            />
            <div className="relative flex-1">
              <button
                onClick={() => setUnitOpen((v) => !v)}
                className="w-full h-12 rounded-lg border border-border pl-4 pr-11 flex items-center text-base bg-background cursor-pointer hover:border-foreground/30 focus:border-purple-400 transition-colors text-left"
              >
                {UNIT_LABEL[step.unit ?? "days"]}
              </button>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              {unitOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUnitOpen(false)} />
                  <div className="absolute z-50 mt-1 left-0 right-0 rounded-lg border border-border bg-background shadow-xl py-1 max-h-64 overflow-auto">
                    {UNIT_OPTIONS.map((u) => (
                      <button
                        key={u}
                        onClick={() => { onChange({ unit: u }); setUnitOpen(false); }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-base hover:bg-accent transition-colors",
                          (step.unit ?? "days") === u ? "text-purple-700 font-semibold" : "text-foreground"
                        )}
                      >
                        {UNIT_LABEL[u]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Dispara em uma data e horário específicos, no fuso de <b>São Paulo</b>.</p>
          <div>
            <label className="text-sm font-semibold text-foreground/80">Data</label>
            <div className="relative mt-2">
              <button
                onClick={() => setCalOpen((v) => !v)}
                className="w-full h-12 rounded-lg border border-border px-4 flex items-center justify-between text-base bg-background hover:border-foreground/30 focus:border-purple-400 transition-colors"
              >
                <span className={datePart ? "" : "text-muted-foreground"}>
                  {datePart ? datePart.split("-").reverse().join("/") : "Selecione a data"}
                </span>
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              </button>
              {calOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCalOpen(false)} />
                  <div className="absolute z-50 mt-1 left-0">
                    <MiniCalendar
                      value={datePart}
                      onPick={(d) => { onChange({ mode: "datetime", datetime: `${d}T${timePart || "00:00:00"}` }); setCalOpen(false); }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-foreground/80">Horário (São Paulo)</label>
            <input
              type="text"
              inputMode="numeric"
              value={timePart}
              placeholder="00:00:00"
              onChange={(e) => onChange({ mode: "datetime", datetime: `${datePart || defaultDate()}T${maskTime(e.target.value)}` })}
              onBlur={(e) => onChange({ mode: "datetime", datetime: `${datePart || defaultDate()}T${normalizeTime(e.target.value)}` })}
              className="w-full h-12 mt-2 rounded-lg border border-border px-4 outline-none text-base bg-background focus:border-purple-400 tracking-wider"
            />
          </div>
          {datePart && timePart && (
            <p className="text-sm text-foreground bg-muted/60 rounded-lg px-3 py-2">
              Vai disparar em <b>{datePart.split("-").reverse().join("/")} às {timePart}</b> (horário de São Paulo).
            </p>
          )}
        </div>
      )}
    </SidePanel>
  );
}
