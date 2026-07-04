import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mail, Plus, Send, MailOpen, MousePointerClick, Ban, History, Users,
  ChevronLeft, ChevronRight, Zap, Timer, X, Check, GitBranch, Tag, Search,
  Sparkles, ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";
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
  | { id: string; type: "timer"; amount: number; unit: "minutes" | "hours" | "days" };

interface Opt { id: string; nome?: string; name?: string; body_html?: string | null; subject?: string | null }
interface Domain { domain: string; sender_name: string | null; sender_local: string | null }

const genId = () => crypto.randomUUID();
const UNIT_LABEL: Record<string, string> = { minutes: "minuto(s)", hours: "hora(s)", days: "dia(s)" };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* ------------------------------- Editor ------------------------------ */

interface Props {
  automation: { id: string; name: string; is_active: boolean };
  onBack: () => void;
}

export function CampaignFlowEditor({ automation, onBack }: Props) {
  const [active, setActive] = useState(!!automation.is_active);
  const [trigger, setTrigger] = useState<TriggerCfg | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [saved, setSaved] = useState(true);
  const loaded = useRef(false);

  const [triggerOpen, setTriggerOpen] = useState(false);
  const [addAt, setAddAt] = useState<number | null>(null);
  const [emailFor, setEmailFor] = useState<string | null>(null);
  const [timerFor, setTimerFor] = useState<string | null>(null);

  const [templates, setTemplates] = useState<Opt[]>([]);
  const [domain, setDomain] = useState<Domain | null>(null);

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
      const [{ data: a }, { data: t }, { data: d }] = await Promise.all([
        (supabase as any).from("email_automations").select("flow_steps").eq("id", automation.id).single(),
        (supabase as any).from("email_templates").select("id,name,body_html,subject").order("created_at", { ascending: false }),
        (supabase as any).from("email_domains").select("domain,sender_name,sender_local").eq("is_active", true).limit(1).maybeSingle(),
      ]);
      if (a?.flow_steps) {
        setTrigger(a.flow_steps.trigger ?? null);
        setSteps(Array.isArray(a.flow_steps.steps) ? a.flow_steps.steps : []);
      }
      setTemplates((t || []) as Opt[]);
      setDomain((d as Domain) || null);
      loaded.current = true;
    })();
  }, [automation.id]);

  const persist = useCallback(async () => {
    const pipe = isPipelineTrigger(trigger) ? trigger : null;
    const { error } = await (supabase as any)
      .from("email_automations")
      .update({ flow_steps: { trigger, steps }, trigger_pipeline_id: pipe?.pipelineId ?? null, sub_origin_id: pipe?.subOriginId ?? null })
      .eq("id", automation.id);
    if (error) toast.error("Erro ao salvar o fluxo"); else setSaved(true);
  }, [trigger, steps, automation.id]);

  useEffect(() => {
    if (!loaded.current) return;
    setSaved(false);
    const t = setTimeout(() => void persist(), 700);
    return () => clearTimeout(t);
  }, [trigger, steps, persist]);

  const stateRef = useRef({ trigger, steps });
  useEffect(() => { stateRef.current = { trigger, steps }; }, [trigger, steps]);
  useEffect(() => () => {
    if (!loaded.current) return;
    const { trigger: tr, steps: st } = stateRef.current;
    const pipe = isPipelineTrigger(tr) ? tr : null;
    void (supabase as any).from("email_automations")
      .update({ flow_steps: { trigger: tr, steps: st }, trigger_pipeline_id: pipe?.pipelineId ?? null, sub_origin_id: pipe?.subOriginId ?? null })
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
  const addTimer = (i: number) => { const id = genId(); insertStep(i, { id, type: "timer", amount: 1, unit: "days" }); setAddAt(null); setTimerFor(id); };

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
  const Line = () => <div className="w-px h-7 bg-border" />;

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
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <History className="h-3.5 w-3.5" /> {saved ? "Salvo" : "Salvando…"}
          </span>
          <button className="h-8 px-3 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors">
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Ver contatos</span>
          </button>
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
        className="flex-1 min-h-0 relative overflow-hidden cursor-grab active:cursor-grabbing bg-[radial-gradient(circle,#e4e4e7_1px,transparent_1px)] [background-size:22px_22px] dark:bg-[radial-gradient(circle,#3f3f46_1px,transparent_1px)]"
      >
        <div className="absolute top-0 left-0 w-full" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0" }}>
          <div className="flex flex-col items-center pb-24">
            {/* Trigger */}
            {trigger ? (
              <button data-node onClick={() => setTriggerOpen(true)} className="w-[320px] rounded-xl bg-card border border-border shadow-sm p-4 text-left hover:border-purple-400 transition-colors">
                <div className="flex items-center gap-2 text-purple-700 text-xs font-semibold uppercase tracking-wide"><Zap className="h-3.5 w-3.5" /> Gatilho</div>
                {isPipelineTrigger(trigger) ? (
                  <>
                    <p className="text-sm font-semibold mt-1.5">Entrou no pipeline “{trigger.pipelineName}”</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{trigger.workspaceName} › {trigger.subOriginName}</p>
                  </>
                ) : (
                  <p className="text-sm font-semibold mt-1.5">{trigger.type === "tag_removed" ? "Tag removida" : "Tag adicionada"}: {trigger.tagName}</p>
                )}
              </button>
            ) : (
              <button data-node onClick={() => setTriggerOpen(true)} className="w-[320px] px-5 py-5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-purple-400 hover:text-foreground transition-colors flex items-center justify-center gap-2">
                <Zap className="h-4 w-4" /> Adicione um gatilho de entrada
              </button>
            )}

            <Line />
            <AddBtn index={0} />

            {steps.map((step, i) => (
              <div key={step.id} className="flex flex-col items-center">
                <Line />
                {step.type === "email" ? (
                  <div data-node className="w-[400px] rounded-xl bg-card shadow-sm border border-border overflow-hidden group relative">
                    <button onClick={() => removeStep(step.id)} className="absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent opacity-0 group-hover:opacity-100" title="Remover"><X className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setEmailFor(step.id)} className="w-full text-left">
                      <div className="flex items-start gap-3 p-4">
                        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0"><Mail className="h-4 w-4 text-white" /></div>
                        <div className="pt-0.5 min-w-0">
                          <p className="text-sm font-semibold leading-tight truncate max-w-[300px]">{step.templateName || "Enviar um e‑mail"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]">{step.subject || (step.templateName ? "Sem assunto" : "Escolher e‑mail")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-[11px] font-medium text-blue-600">
                        <span className="flex items-center gap-1"><Send className="h-3 w-3" /> 0 enviados</span>
                        <span className="flex items-center gap-1"><MailOpen className="h-3 w-3" /> 0% abertura</span>
                        <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> 0% cliques</span>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div data-node className="w-[320px] rounded-xl bg-card shadow-sm border border-border p-4 group relative">
                    <button onClick={() => removeStep(step.id)} className="absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent opacity-0 group-hover:opacity-100" title="Remover"><X className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setTimerFor(step.id)} className="w-full text-left flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0"><Timer className="h-4 w-4 text-white" /></div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">Aguarde</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Aguardar {step.amount} {UNIT_LABEL[step.unit]}</p>
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
      {triggerOpen && (
        <TriggerModal current={trigger} onClose={() => setTriggerOpen(false)} onSave={(cfg) => { setTrigger(cfg); setTriggerOpen(false); }} />
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

function CenterModal({ children, onClose, size = "max-w-4xl" }: { children: React.ReactNode; onClose: () => void; size?: string }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/30" />
      <div className={cn("relative w-full h-[82vh] bg-background rounded-2xl border border-border shadow-xl flex flex-col overflow-hidden", size)} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function SidePanel({ title, subtitle, icon, onClose, footer, children, width = "w-[560px]" }: { title: string; subtitle?: string; icon?: React.ReactNode; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode; width?: string }) {
  return (
    <div className="fixed inset-0 z-[90]" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/20" />
      <div className={cn("absolute top-0 right-0 h-full max-w-[96vw] bg-background border-l border-border flex flex-col animate-in slide-in-from-right duration-200", width)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <p className="text-base font-bold leading-tight">{title}</p>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent flex-shrink-0"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-6 h-16 border-t border-border flex-shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------------------- Trigger modal ---------------------------- */

function TriggerModal({ current, onClose, onSave }: { current: TriggerCfg | null; onClose: () => void; onSave: (c: TriggerCfg) => void }) {
  const initStage = current ? (isPipelineTrigger(current) ? "pipeline_enter" : current.type) : "list";
  const [stage, setStage] = useState<"list" | "pipeline_enter" | "tag_added" | "tag_removed">(initStage as any);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");

  const [workspaces, setWorkspaces] = useState<Opt[]>([]);
  const [subOrigins, setSubOrigins] = useState<Opt[]>([]);
  const [pipelines, setPipelines] = useState<Opt[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const cp = isPipelineTrigger(current) ? current : null;
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
    { key: "pipeline_enter", label: "Entrou em um pipeline", icon: GitBranch, cat: "crm" },
    { key: "tag_added", label: "Tag adicionada", icon: Tag, cat: "tags" },
    { key: "tag_removed", label: "Tag removida", icon: Tag, cat: "tags" },
  ] as const;
  const CATS = [{ key: "all", label: "Visualizar tudo" }, { key: "crm", label: "Vendas e CRM" }, { key: "tags", label: "Tags" }];
  const visible = TRIGGERS.filter((t) => (cat === "all" || t.cat === cat) && t.label.toLowerCase().includes(search.toLowerCase()));

  const Column = ({ label, items, selected, onPick, empty }: { label: string; items: Opt[]; selected: Opt | null; onPick: (o: Opt) => void; empty: string }) => (
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{label}</p>
      <div className="rounded-xl border border-border divide-y divide-border max-h-[40vh] overflow-auto">
        {items.length === 0 && <p className="px-3 py-2.5 text-xs text-muted-foreground">{empty}</p>}
        {items.map((o) => (
          <button key={o.id} onClick={() => onPick(o)} className={cn("w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2", selected?.id === o.id && "bg-purple-500/10 text-purple-800 font-medium")}>
            <span className="truncate">{nameOf(o)}</span>
            {selected?.id === o.id && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );

  const configFooter = (canSave: boolean, save: () => void) => (
    <>
      <div className="flex items-center justify-between px-6 h-16 border-t border-border flex-shrink-0">
        <button onClick={() => setStage("list")} className="h-10 px-4 rounded-lg border border-border text-sm font-medium hover:bg-accent flex items-center gap-1"><ChevronLeft className="h-4 w-4" /> Voltar</button>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-border text-sm font-medium hover:bg-accent">Cancelar</button>
          <button disabled={!canSave} onClick={save} className="h-10 px-5 rounded-lg bg-purple-900 hover:bg-purple-800 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Salvar</button>
        </div>
      </div>
    </>
  );

  return (
    <CenterModal onClose={onClose}>
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
            <div className="w-56 flex-shrink-0 border-r border-border p-4 overflow-auto">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 px-2">Acionar categorias</p>
              <div className="space-y-0.5">
                {CATS.map((c) => (
                  <button key={c.key} onClick={() => setCat(c.key)} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors", cat === c.key ? "bg-purple-500/10 text-purple-800 font-medium" : "text-foreground/70 hover:bg-accent")}>{c.label}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-8">
              <div className="grid grid-cols-4 gap-6">
                {visible.map((t) => (
                  <button key={t.key} onClick={() => setStage(t.key as any)} className="group flex flex-col items-center gap-3 p-2 rounded-xl hover:bg-accent transition-colors">
                    <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors"><t.icon className="h-6 w-6 text-purple-700" /></div>
                    <span className="text-xs text-center leading-tight font-medium">{t.label}</span>
                  </button>
                ))}
                {visible.length === 0 && <p className="text-sm text-muted-foreground col-span-4">Nada encontrado.</p>}
              </div>
            </div>
          </div>
        </>
      ) : stage === "pipeline_enter" ? (
        <>
          <div className="flex items-center gap-3 px-6 h-16 border-b border-border flex-shrink-0">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center"><GitBranch className="h-4 w-4 text-purple-700" /></div>
            <div><p className="text-base font-bold leading-tight">Entrou em um pipeline</p><p className="text-xs text-muted-foreground">Escolha onde o contato precisa entrar</p></div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-3 gap-4">
              <Column label="Workspace" items={workspaces} selected={ws} empty="Nenhum workspace" onPick={(o) => { setWs(o); setSub(null); setPipe(null); }} />
              <Column label="Espaço" items={subOrigins} selected={sub} empty={ws ? "Nenhum espaço" : "Escolha um workspace"} onPick={(o) => { setSub(o); setPipe(null); }} />
              <Column label="Pipeline" items={pipelines} selected={pipe} empty={sub ? "Nenhum pipeline" : "Escolha um espaço"} onPick={(o) => setPipe(o)} />
            </div>
          </div>
          {configFooter(!!(ws && sub && pipe), () => ws && sub && pipe && onSave({ type: "pipeline_enter", workspaceId: ws.id, workspaceName: nameOf(ws), subOriginId: sub.id, subOriginName: nameOf(sub), pipelineId: pipe.id, pipelineName: nameOf(pipe) }))}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 px-6 h-16 border-b border-border flex-shrink-0">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center"><Tag className="h-4 w-4 text-purple-700" /></div>
            <div><p className="text-base font-bold leading-tight">{stage === "tag_removed" ? "Tag removida" : "Tag adicionada"}</p><p className="text-xs text-muted-foreground">Escolha a tag que inicia a automação</p></div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-md">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Selecionar tag</label>
              <select value={tag} onChange={(e) => setTag(e.target.value)} className="w-full h-10 rounded-lg border border-border px-3 mt-1.5 outline-none focus:border-purple-400 text-sm bg-background">
                <option value="">Escolha uma tag</option>
                {tags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {tags.length === 0 && <p className="text-xs text-muted-foreground mt-2">Nenhuma tag encontrada nos contatos.</p>}
            </div>
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
  const [tab, setTab] = useState("sugerido");
  const TABS = [
    { key: "sugerido", label: "Sugerido", icon: Sparkles },
    { key: "enviando", label: "Enviando", icon: Mail },
    { key: "fluxo", label: "Fluxo de trabalho", icon: GitBranch },
    { key: "contatos", label: "Contatos", icon: Users },
    { key: "crm", label: "CRM", icon: Tag },
  ];
  const actions = [
    { key: "timer", tab: ["sugerido", "fluxo"], icon: Timer, color: "bg-amber-500", title: "Aguarde", desc: "Esperar por um período de tempo antes da próxima etapa", run: onTimer },
    { key: "email", tab: ["sugerido", "enviando"], icon: Mail, color: "bg-blue-600", title: "Enviar um e‑mail", desc: "Um e‑mail de marketing para os contatos inscritos", run: onEmail },
  ];
  const visible = actions.filter((a) => a.tab.includes(tab) && a.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <CenterModal onClose={onClose} size="max-w-lg">
      <div className="flex items-center justify-between px-6 h-16 border-b border-border flex-shrink-0">
        <h2 className="text-lg font-bold">Adicione uma ação</h2>
        <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent"><X className="h-5 w-5" /></button>
      </div>
      <div className="px-6 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar por uma ação" className="h-10 w-full rounded-lg border border-border pl-9 pr-3 text-sm outline-none focus:border-purple-400" />
        </div>
        <div className="flex items-center gap-5 mt-4 border-b border-border">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex flex-col items-center gap-1 pb-2.5 text-xs transition-colors border-b-2 -mb-px", tab === t.key ? "border-purple-600 text-purple-700 font-semibold" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 py-4 space-y-2.5">
        {visible.map((a) => (
          <button key={a.key} onClick={a.run} className="w-full flex items-start gap-3 rounded-xl border border-border p-4 text-left hover:border-purple-400 hover:shadow-sm transition-all">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", a.color)}><a.icon className="h-5 w-5 text-white" /></div>
            <div><p className="text-sm font-semibold">{a.title}</p><p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p></div>
          </button>
        ))}
        {visible.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ação nesta categoria ainda.</p>}
      </div>
    </CenterModal>
  );
}

/* ---------------------------- Email panel ---------------------------- */

function EmailPanel({ step, templates, domain, onChange, onClose }: { step: Extract<Step, { type: "email" }>; templates: Opt[]; domain: Domain | null; onChange: (p: Partial<Step>) => void; onClose: () => void }) {
  const [picking, setPicking] = useState(!step.templateId);
  const tpl = templates.find((t) => t.id === step.templateId);
  const fromLine = domain?.domain ? `${domain.sender_name || "Equipe"} <${domain.sender_local || "contato"}@${domain.domain}>` : "Nenhum domínio ativo";

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[130px_1fr] items-center gap-3 py-3 border-b border-border">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="min-w-0">{children}</div>
    </div>
  );

  return (
    <SidePanel
      title="Enviar um e‑mail"
      subtitle="Um e‑mail de marketing para os contatos inscritos"
      icon={<div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0"><Mail className="h-4 w-4 text-white" /></div>}
      width="w-[620px]"
      onClose={onClose}
      footer={<button onClick={onClose} className="h-10 px-5 rounded-lg bg-purple-900 hover:bg-purple-800 text-white text-sm font-semibold">Concluir</button>}
    >
      <Row label="Nome do e‑mail:">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{tpl?.name || "Nenhum e‑mail selecionado"}</span>
          <button onClick={() => setPicking((v) => !v)} className="text-sm text-purple-700 hover:underline font-medium flex-shrink-0">{tpl ? "Selecionar novo e‑mail" : "Escolher e‑mail"}</button>
        </div>
      </Row>
      <Row label="Linha de assunto:">
        <input value={step.subject || ""} onChange={(e) => onChange({ subject: e.target.value })} placeholder="Escreva sua linha de assunto" className="w-full h-9 rounded-lg border border-border px-3 outline-none focus:border-purple-400 text-sm" />
      </Row>
      <Row label="Pré‑cabeçalho:">
        <input value={step.preheader || ""} onChange={(e) => onChange({ preheader: e.target.value })} placeholder="Escreva seu preheader" className="w-full h-9 rounded-lg border border-border px-3 outline-none focus:border-purple-400 text-sm" />
      </Row>
      <Row label="De:">
        <span className="text-sm">{fromLine}</span>
      </Row>

      {picking ? (
        <div className="mt-4 space-y-2">
          {templates.length === 0 && <p className="text-sm text-muted-foreground">Nenhum template salvo. Crie um em Estrutura › Templates.</p>}
          {templates.map((t) => (
            <button key={t.id} onClick={() => { onChange({ templateId: t.id, templateName: t.name, subject: step.subject || t.subject || "" }); setPicking(false); }} className="w-full flex items-center gap-3 p-2 rounded-lg border border-border hover:border-purple-400 hover:bg-accent text-left transition-colors">
              <div className="w-[56px] h-[56px] rounded-sm border border-border overflow-hidden bg-white flex-shrink-0 relative">
                {t.body_html && t.body_html.includes("<") ? (
                  <iframe title={t.name} srcDoc={t.body_html} scrolling="no" tabIndex={-1} aria-hidden className="border-0 pointer-events-none absolute top-0 left-0" style={{ width: 600, height: 600, transform: `scale(${56 / 600})`, transformOrigin: "top left" }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Mail className="h-4 w-4 text-muted-foreground/40" /></div>
                )}
              </div>
              <span className="text-sm font-medium truncate flex-1">{t.name}</span>
            </button>
          ))}
        </div>
      ) : tpl ? (
        <div className="mt-4 rounded-lg border border-border overflow-hidden bg-white">
          <iframe title={tpl.name || ""} srcDoc={tpl.body_html || ""} className="w-full h-[440px] border-0" />
        </div>
      ) : null}
    </SidePanel>
  );
}

/* ---------------------------- Timer panel ---------------------------- */

function TimerPanel({ step, onChange, onClose }: { step: Extract<Step, { type: "timer" }>; onChange: (p: Partial<Step>) => void; onClose: () => void }) {
  return (
    <SidePanel
      title="Aguarde"
      subtitle="Esperar por um período de tempo antes da próxima etapa"
      icon={<div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0"><Timer className="h-4 w-4 text-white" /></div>}
      width="w-[460px]"
      onClose={onClose}
      footer={<button onClick={onClose} className="h-10 px-5 rounded-lg bg-purple-900 hover:bg-purple-800 text-white text-sm font-semibold">Concluir</button>}
    >
      <p className="text-sm text-muted-foreground mb-3">O contato aguardará:</p>
      <div className="flex items-center gap-2">
        <input type="number" min={1} value={step.amount} onChange={(e) => onChange({ amount: Math.max(1, Number(e.target.value) || 1) })} className="w-24 h-10 rounded-lg border border-border px-3 outline-none focus:border-purple-400 text-sm" />
        <select value={step.unit} onChange={(e) => onChange({ unit: e.target.value as any })} className="h-10 rounded-lg border border-border px-3 outline-none focus:border-purple-400 text-sm bg-background">
          <option value="minutes">minuto(s)</option>
          <option value="hours">hora(s)</option>
          <option value="days">dia(s)</option>
        </select>
      </div>
    </SidePanel>
  );
}
