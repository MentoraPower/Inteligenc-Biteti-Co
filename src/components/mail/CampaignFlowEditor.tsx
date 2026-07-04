import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mail,
  Plus,
  Send,
  MailOpen,
  MousePointerClick,
  Ban,
  History,
  Users,
  ChevronLeft,
  ChevronRight,
  Zap,
  Timer,
  X,
  Check,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ------------------------------- Types ------------------------------- */

interface TriggerCfg {
  workspaceId: string;
  workspaceName: string;
  subOriginId: string;
  subOriginName: string;
  pipelineId: string;
  pipelineName: string;
}
type Step =
  | { id: string; type: "email"; templateId?: string; templateName?: string; subject?: string; preheader?: string }
  | { id: string; type: "timer"; amount: number; unit: "minutes" | "hours" | "days" };

interface Opt { id: string; nome?: string; name?: string; body_html?: string | null; subject?: string | null }

const genId = () => crypto.randomUUID();
const UNIT_LABEL: Record<string, string> = { minutes: "minuto(s)", hours: "hora(s)", days: "dia(s)" };

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

  // Panels
  const [triggerPanel, setTriggerPanel] = useState(false);
  const [addAt, setAddAt] = useState<number | null>(null); // insert index for the add panel
  const [emailPickerFor, setEmailPickerFor] = useState<string | null>(null); // step id
  const [timerFor, setTimerFor] = useState<string | null>(null); // step id

  // Data
  const [templates, setTemplates] = useState<Opt[]>([]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mail-editor", { detail: { open: true } }));
    return () => window.dispatchEvent(new CustomEvent("mail-editor", { detail: { open: false } }));
  }, []);

  // Load saved flow + templates.
  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: t }] = await Promise.all([
        (supabase as any).from("email_automations").select("flow_steps").eq("id", automation.id).single(),
        (supabase as any).from("email_templates").select("id,name,body_html,subject").order("created_at", { ascending: false }),
      ]);
      if (a?.flow_steps) {
        setTrigger(a.flow_steps.trigger ?? null);
        setSteps(Array.isArray(a.flow_steps.steps) ? a.flow_steps.steps : []);
      }
      setTemplates((t || []) as Opt[]);
      loaded.current = true;
    })();
  }, [automation.id]);

  // Persist flow (debounced).
  const persist = useCallback(async () => {
    const { error } = await (supabase as any)
      .from("email_automations")
      .update({
        flow_steps: { trigger, steps },
        trigger_pipeline_id: trigger?.pipelineId ?? null,
        sub_origin_id: trigger?.subOriginId ?? null,
      })
      .eq("id", automation.id);
    if (error) toast.error("Erro ao salvar o fluxo");
    else setSaved(true);
  }, [trigger, steps, automation.id]);

  useEffect(() => {
    if (!loaded.current) return;
    setSaved(false);
    const t = setTimeout(() => void persist(), 700);
    return () => clearTimeout(t);
  }, [trigger, steps, persist]);

  // Save once more on unmount so nothing is lost before the debounce fires.
  const stateRef = useRef({ trigger, steps });
  useEffect(() => { stateRef.current = { trigger, steps }; }, [trigger, steps]);
  useEffect(() => {
    return () => {
      if (!loaded.current) return;
      const { trigger: tr, steps: st } = stateRef.current;
      void (supabase as any)
        .from("email_automations")
        .update({ flow_steps: { trigger: tr, steps: st }, trigger_pipeline_id: tr?.pipelineId ?? null, sub_origin_id: tr?.subOriginId ?? null })
        .eq("id", automation.id);
    };
  }, [automation.id]);

  const toggleActive = async (next: boolean) => {
    setActive(next);
    const { error } = await (supabase as any).from("email_automations").update({ is_active: next }).eq("id", automation.id);
    if (error) { setActive(!next); toast.error("Erro ao atualizar status"); }
  };

  /* --------------------------- Step helpers --------------------------- */

  const insertStep = (index: number, step: Step) =>
    setSteps((s) => [...s.slice(0, index), step, ...s.slice(index)]);
  const updateStep = (id: string, patch: Partial<Step>) =>
    setSteps((s) => s.map((x) => (x.id === id ? ({ ...x, ...patch } as Step) : x)));
  const removeStep = (id: string) => setSteps((s) => s.filter((x) => x.id !== id));

  const addEmail = (index: number) => {
    const id = genId();
    insertStep(index, { id, type: "email" });
    setAddAt(null);
    setEmailPickerFor(id);
  };
  const addTimer = (index: number) => {
    const id = genId();
    insertStep(index, { id, type: "timer", amount: 1, unit: "days" });
    setAddAt(null);
    setTimerFor(id);
  };

  /* ------------------------------- Render ------------------------------ */

  const AddButton = ({ index }: { index: number }) => (
    <button
      onClick={() => setAddAt(index)}
      className="w-8 h-8 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-foreground hover:bg-accent hover:border-purple-400 transition-colors"
      title="Adicionar etapa"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
  const Line = () => <div className="w-px h-6 bg-border" />;

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

      {/* Vertical flow canvas */}
      <div className="flex-1 min-h-0 overflow-auto bg-[radial-gradient(circle,#e4e4e7_1px,transparent_1px)] [background-size:20px_20px] dark:bg-[radial-gradient(circle,#3f3f46_1px,transparent_1px)]">
        <div className="min-h-full flex flex-col items-center py-10">
          {/* Trigger */}
          {trigger ? (
            <button onClick={() => setTriggerPanel(true)} className="w-[300px] rounded-xl bg-card border border-border shadow-sm p-4 text-left hover:border-purple-400 transition-colors">
              <div className="flex items-center gap-2 text-purple-700 text-xs font-semibold uppercase tracking-wide">
                <Zap className="h-3.5 w-3.5" /> Gatilho
              </div>
              <p className="text-sm font-semibold mt-1.5">Entrou no pipeline “{trigger.pipelineName}”</p>
              <p className="text-xs text-muted-foreground mt-0.5">{trigger.workspaceName} › {trigger.subOriginName}</p>
            </button>
          ) : (
            <button onClick={() => setTriggerPanel(true)} className="w-[300px] px-5 py-5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-purple-400 hover:text-foreground transition-colors flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" /> Adicione um gatilho de entrada
            </button>
          )}

          {/* Steps */}
          <Line />
          <AddButton index={0} />
          {steps.map((step, i) => (
            <div key={step.id} className="flex flex-col items-center">
              <Line />
              {step.type === "email" ? (
                <div className="w-[380px] rounded-xl bg-card shadow-sm border border-border overflow-hidden group relative">
                  <button onClick={() => removeStep(step.id)} className="absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent opacity-0 group-hover:opacity-100" title="Remover"><X className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setEmailPickerFor(step.id)} className="w-full text-left">
                    <div className="flex items-start gap-3 p-4">
                      <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0"><Mail className="h-4 w-4 text-white" /></div>
                      <div className="pt-0.5 min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate max-w-[290px]">{step.templateName || "Enviar um e‑mail"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[290px]">{step.subject || (step.templateName ? "Sem assunto" : "Escolher e‑mail")}</p>
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
                <div className="w-[300px] rounded-xl bg-card shadow-sm border border-border p-4 group relative">
                  <button onClick={() => removeStep(step.id)} className="absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent opacity-0 group-hover:opacity-100" title="Remover"><X className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setTimerFor(step.id)} className="w-full text-left flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0"><Timer className="h-4 w-4 text-white" /></div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">Temporizador</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Aguardar {step.amount} {UNIT_LABEL[step.unit]}</p>
                    </div>
                  </button>
                </div>
              )}
              <Line />
              <AddButton index={i + 1} />
            </div>
          ))}

          {/* End */}
          <Line />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <Ban className="h-3.5 w-3.5" /> A automação é encerrada
          </div>
        </div>
      </div>

      {/* Trigger panel (top-to-bottom, half screen) */}
      {triggerPanel && (
        <TriggerPanel
          current={trigger}
          onClose={() => setTriggerPanel(false)}
          onSave={(cfg) => { setTrigger(cfg); setTriggerPanel(false); }}
        />
      )}

      {/* Add step panel (top-to-bottom) */}
      {addAt !== null && (
        <BottomSheet title="Adicionar etapa" subtitle="Escolha o que acontece nesta etapa do fluxo" onClose={() => setAddAt(null)}>
          <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
            <button onClick={() => addEmail(addAt)} className="group rounded-2xl border border-border p-6 text-left hover:border-purple-400 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform"><Mail className="h-5 w-5 text-white" /></div>
              <p className="text-base font-semibold">Enviar e‑mail</p>
              <p className="text-sm text-muted-foreground mt-1">Dispara um e‑mail com um template salvo</p>
            </button>
            <button onClick={() => addTimer(addAt)} className="group rounded-2xl border border-border p-6 text-left hover:border-purple-400 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform"><Timer className="h-5 w-5 text-white" /></div>
              <p className="text-base font-semibold">Temporizador</p>
              <p className="text-sm text-muted-foreground mt-1">Aguarda um tempo antes da próxima etapa</p>
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Email config (side panel): subject + preheader + template preview/picker */}
      {emailPickerFor && (() => {
        const step = steps.find((s) => s.id === emailPickerFor);
        if (!step || step.type !== "email") return null;
        const tpl = templates.find((t) => t.id === step.templateId);
        return (
          <SidePanel title="Configurar e‑mail" width="w-[600px]" onClose={() => setEmailPickerFor(null)}>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Assunto</label>
                <input
                  value={step.subject || ""}
                  onChange={(e) => updateStep(step.id, { subject: e.target.value } as Partial<Step>)}
                  placeholder="Assunto do e‑mail"
                  className="w-full h-10 rounded-lg border border-border px-3 mt-1 outline-none focus:border-purple-400 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Pré‑assunto</label>
                <input
                  value={step.preheader || ""}
                  onChange={(e) => updateStep(step.id, { preheader: e.target.value } as Partial<Step>)}
                  placeholder="Texto de pré‑visualização (aparece após o assunto na caixa de entrada)"
                  className="w-full h-10 rounded-lg border border-border px-3 mt-1 outline-none focus:border-purple-400 text-sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">E‑mail</label>
                  {tpl && (
                    <button onClick={() => updateStep(step.id, { templateId: undefined, templateName: undefined } as Partial<Step>)} className="text-xs text-purple-700 hover:underline font-medium">
                      Trocar template
                    </button>
                  )}
                </div>
                {tpl ? (
                  <div className="rounded-lg border border-border overflow-hidden bg-white">
                    <iframe title={tpl.name || ""} srcDoc={tpl.body_html || ""} className="w-full h-[440px] border-0" />
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum template salvo. Crie um em Estrutura › Templates.</p>
                ) : (
                  <div className="space-y-2">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => updateStep(step.id, { templateId: t.id, templateName: t.name, subject: step.subject || t.subject || "" } as Partial<Step>)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg border border-border hover:border-purple-400 hover:bg-accent text-left transition-colors"
                      >
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
                )}
              </div>
            </div>
          </SidePanel>
        );
      })()}

      {/* Timer config (side panel) */}
      {timerFor && (() => {
        const step = steps.find((s) => s.id === timerFor);
        if (!step || step.type !== "timer") return null;
        return (
          <SidePanel title="Temporizador" onClose={() => setTimerFor(null)}>
            <p className="text-sm text-muted-foreground mb-3">Aguardar antes da próxima etapa:</p>
            <div className="flex items-center gap-2">
              <input type="number" min={1} value={step.amount} onChange={(e) => updateStep(timerFor, { amount: Math.max(1, Number(e.target.value) || 1) } as Partial<Step>)} className="w-24 h-10 rounded-lg border border-border px-3 outline-none focus:border-purple-400" />
              <select value={step.unit} onChange={(e) => updateStep(timerFor, { unit: e.target.value } as Partial<Step>)} className="h-10 rounded-lg border border-border px-3 outline-none focus:border-purple-400">
                <option value="minutes">minuto(s)</option>
                <option value="hours">hora(s)</option>
                <option value="days">dia(s)</option>
              </select>
            </div>
            <button onClick={() => setTimerFor(null)} className="mt-4 h-9 px-4 rounded-lg bg-purple-900 hover:bg-purple-800 text-white text-sm font-semibold">Concluir</button>
          </SidePanel>
        );
      })()}
    </div>
  );
}

/* ---------------------------- Sub-panels ---------------------------- */

function BottomSheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/5" />
      <div
        className="absolute left-16 right-0 bottom-0 h-1/2 bg-background border-t border-border rounded-t-2xl flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 h-14 border-b border-border flex-shrink-0">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-8">{children}</div>
      </div>
    </div>
  );
}

function SidePanel({ title, onClose, children, width = "w-[420px]" }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/5" />
      <div className={cn("absolute top-0 right-0 h-full max-w-[95vw] bg-background border-l border-border flex flex-col animate-in slide-in-from-right duration-200", width)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-12 border-b border-border flex-shrink-0">
          <span className="text-sm font-semibold">{title}</span>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/* Trigger config: choose type -> cascade workspace -> espaço -> pipeline */
function TriggerPanel({ current, onClose, onSave }: { current: TriggerCfg | null; onClose: () => void; onSave: (c: TriggerCfg) => void }) {
  const [type, setType] = useState<"pipeline_enter" | null>(current ? "pipeline_enter" : null);
  const [workspaces, setWorkspaces] = useState<Opt[]>([]);
  const [subOrigins, setSubOrigins] = useState<Opt[]>([]);
  const [pipelines, setPipelines] = useState<Opt[]>([]);
  const [ws, setWs] = useState<Opt | null>(current ? { id: current.workspaceId, name: current.workspaceName } : null);
  const [sub, setSub] = useState<Opt | null>(current ? { id: current.subOriginId, nome: current.subOriginName } : null);
  const [pipe, setPipe] = useState<Opt | null>(current ? { id: current.pipelineId, nome: current.pipelineName } : null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("workspaces").select("id,name").order("name");
      setWorkspaces((data || []) as Opt[]);
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

  const Column = ({ label, items, selected, onPick, empty }: { label: string; items: Opt[]; selected: Opt | null; onPick: (o: Opt) => void; empty: string }) => (
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{label}</p>
      <div className="rounded-lg border border-border divide-y divide-border max-h-[30vh] overflow-auto">
        {items.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{empty}</p>}
        {items.map((o) => (
          <button key={o.id} onClick={() => onPick(o)} className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2", selected?.id === o.id && "bg-purple-500/10 text-purple-800 font-medium")}>
            <span className="truncate">{nameOf(o)}</span>
            {selected?.id === o.id && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <BottomSheet
      title="Gatilho de entrada"
      subtitle={type ? "Escolha onde o contato precisa entrar para iniciar o fluxo" : "Escolha o que inicia a automação"}
      onClose={onClose}
    >
      {!type ? (
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setType("pipeline_enter")} className="group w-full flex items-center gap-4 rounded-2xl border border-border p-5 text-left hover:border-purple-400 hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-700 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"><GitBranch className="h-5 w-5 text-white" /></div>
            <div className="flex-1">
              <p className="text-base font-semibold">Entrou em um pipeline</p>
              <p className="text-sm text-muted-foreground mt-0.5">Dispara quando um contato entra no pipeline escolhido</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-4">
            <Column label="Workspace" items={workspaces} selected={ws} empty="Nenhum workspace" onPick={(o) => { setWs(o); setSub(null); setPipe(null); }} />
            <Column label="Espaço" items={subOrigins} selected={sub} empty={ws ? "Nenhum espaço" : "Escolha um workspace"} onPick={(o) => { setSub(o); setPipe(null); }} />
            <Column label="Pipeline" items={pipelines} selected={pipe} empty={sub ? "Nenhum pipeline" : "Escolha um espaço"} onPick={(o) => setPipe(o)} />
          </div>
          <div className="flex items-center justify-between mt-6">
            <button onClick={() => setType(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <button
              disabled={!ws || !sub || !pipe}
              onClick={() => ws && sub && pipe && onSave({
                workspaceId: ws.id, workspaceName: nameOf(ws),
                subOriginId: sub.id, subOriginName: nameOf(sub),
                pipelineId: pipe.id, pipelineName: nameOf(pipe),
              })}
              className="h-10 px-5 rounded-lg bg-purple-900 hover:bg-purple-800 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Salvar gatilho
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
