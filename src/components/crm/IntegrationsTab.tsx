import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Copy, Check, Trash2, ChevronRight, MoreVertical, Pencil, Files } from "lucide-react";
import { cn } from "@/lib/utils";

const HUBLA_EVENTS = [
  { id: "compra_aprovada", label: "Compra aprovada" },
  { id: "carrinho_abandonado", label: "Carrinho abandonado" },
  { id: "reembolso", label: "Reembolso" },
];
const eventLabel = (id: string) => HUBLA_EVENTS.find((e) => e.id === id)?.label || id;

const PLATFORMS = [
  { id: "hubla", name: "Hubla", logo: "/integrations/hubla.webp", desc: "Webhook de vendas" },
  { id: "unnichat", name: "Unnichat", logo: "/integrations/unnichat.png", desc: "Enviar lead recebido" },
  { id: "elementor", name: "Elementor", logo: "/integrations/elementor.svg", desc: "Formulários do WordPress" },
];

interface PlatformIntegration {
  id: string;
  platform: string;
  name: string;
  event_type: string;
  sub_origin_id: string | null;
  pipeline_id: string | null;
  tag_name: string | null;
  tag_color: string | null;
  token: string;
  is_active: boolean;
  created_at: string;
  config?: Record<string, any> | null;
}

interface IntegrationsTabProps {
  subOriginId: string;
  pipelines: { id: string; nome: string }[];
}

export function IntegrationsTab({ subOriginId, pipelines }: IntegrationsTabProps) {
  const [openPlatform, setOpenPlatform] = useState<string | null>(null);

  if (openPlatform === "hubla") {
    return <HublaPage onBack={() => setOpenPlatform(null)} subOriginId={subOriginId} pipelines={pipelines} />;
  }
  if (openPlatform === "unnichat") {
    return <UnnichatPage onBack={() => setOpenPlatform(null)} subOriginId={subOriginId} pipelines={pipelines} />;
  }
  if (openPlatform === "elementor") {
    return <ElementorPage onBack={() => setOpenPlatform(null)} subOriginId={subOriginId} pipelines={pipelines} />;
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold">Integrações</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Conecte plataformas direto ao seu CRM.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => setOpenPlatform(p.id)}
            className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-500/[0.06] hover:bg-zinc-500/[0.1] transition-colors text-left"
          >
            <img src={p.logo} alt={p.name} className="h-11 w-11 rounded-xl object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[15px]">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.desc}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

type FormState = { mode: "create" } | { mode: "edit"; integration: PlatformIntegration } | null;

function HublaPage({
  onBack,
  subOriginId,
  pipelines,
}: {
  onBack: () => void;
  subOriginId: string;
  pipelines: { id: string; nome: string }[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlatformIntegration | null>(null);

  const { data: integrations = [] } = useQuery({
    queryKey: ["platform-integrations", "hubla", subOriginId],
    enabled: !!subOriginId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_integrations")
        .select("*")
        .eq("platform", "hubla")
        .eq("sub_origin_id", subOriginId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PlatformIntegration[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["platform-integrations", "hubla"] });

  const deleteIntegration = async (id: string) => {
    const { error } = await supabase.from("platform_integrations").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    refresh();
    toast.success("Integração excluída");
  };

  const duplicate = async (it: PlatformIntegration) => {
    const { error } = await supabase.from("platform_integrations").insert({
      platform: "hubla",
      name: `${it.name} (cópia)`,
      event_type: it.event_type,
      sub_origin_id: it.sub_origin_id,
      pipeline_id: it.pipeline_id,
      tag_name: it.tag_name,
      tag_color: it.tag_color,
    });
    if (error) return toast.error("Erro ao duplicar");
    refresh();
    toast.success("Integração duplicada");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header: name on the left, white "Voltar" button on the right */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img src="/integrations/hubla.webp" alt="Hubla" className="h-9 w-9 rounded-lg object-cover" />
          <h3 className="text-lg font-bold">Hubla</h3>
        </div>
        <div className="flex items-center gap-2">
          {!form && (
            <Button
              onClick={() => setForm({ mode: "create" })}
              className="h-9 gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold"
            >
              <Plus className="h-4 w-4" />
              Criar Integração
            </Button>
          )}
          <Button onClick={onBack} className="h-9 gap-1.5 rounded-lg bg-white text-black hover:bg-white/90 border border-border">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {form && (
          <IntegrationForm
            subOriginId={subOriginId}
            pipelines={pipelines}
            editing={form.mode === "edit" ? form.integration : undefined}
            onDone={() => { setForm(null); refresh(); }}
            onCancel={() => setForm(null)}
          />
        )}

        {/* Saved integrations table */}
        {!form && (
          integrations.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">Nenhuma integração criada ainda.</p>
          ) : (
            <div className="rounded-xl overflow-hidden border border-border">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_120px_140px_44px] items-center gap-2 px-4 py-2.5 bg-zinc-500/[0.06] text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div>Nome</div>
                <div>Data criada</div>
                <div>Evento</div>
                <div />
              </div>
              {integrations.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-[1fr_120px_140px_44px] items-center gap-2 px-4 py-3 border-t border-border text-sm"
                >
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-muted-foreground">
                    {new Date(it.created_at).toLocaleDateString("pt-BR")}
                  </div>
                  <div className="text-muted-foreground truncate">{eventLabel(it.event_type)}</div>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[150px] rounded-xl">
                        <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg" onClick={() => setForm({ mode: "edit", integration: it })}>
                          <Pencil className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg" onClick={() => duplicate(it)}>
                          <Files className="h-4 w-4" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer rounded-lg text-destructive focus:text-destructive"
                          onClick={() => setConfirmDelete(it)}
                        >
                          <Trash2 className="h-4 w-4" /> Apagar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar integração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar a integração <span className="font-semibold text-foreground">{confirmDelete?.name}</span>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDelete) deleteIntegration(confirmDelete.id); setConfirmDelete(null); }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IntegrationForm({
  subOriginId,
  pipelines,
  editing,
  onDone,
  onCancel,
}: {
  subOriginId: string;
  pipelines: { id: string; nome: string }[];
  editing?: PlatformIntegration;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name || "");
  const [eventType, setEventType] = useState(editing?.event_type || "compra_aprovada");
  const [pipelineId, setPipelineId] = useState(editing?.pipeline_id || "");
  const [tagName, setTagName] = useState(editing?.tag_name || "");
  const [tagColor, setTagColor] = useState(editing?.tag_color || "#6366f1");
  const [saving, setSaving] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: savedTags = [] } = useQuery({
    queryKey: ["integration-tags"],
    queryFn: async () => {
      const { data: tagsData } = await supabase.from("lead_tags").select("name, color").limit(2000);
      const { data: webhookTags } = await supabase
        .from("crm_webhooks")
        .select("auto_tag_name, auto_tag_color")
        .not("auto_tag_name", "is", null);
      const all: { name: string; color: string }[] = [...((tagsData || []) as any[])];
      (webhookTags || []).forEach((t: any) => {
        if (t.auto_tag_name && String(t.auto_tag_name).trim()) {
          all.push({ name: t.auto_tag_name, color: t.auto_tag_color || "#6366f1" });
        }
      });
      const map = new Map<string, string>();
      all.forEach((t) => {
        const k = (t.name || "").trim().toLowerCase();
        if (k && !map.has(k)) map.set(k, t.color);
      });
      return Array.from(map.entries()).map(([nm, color]) => {
        const orig = all.find((t) => (t.name || "").trim().toLowerCase() === nm);
        return { name: orig?.name || nm, color };
      });
    },
  });

  const isNewTag = useMemo(
    () => tagName.trim() !== "" && !savedTags.some((t) => t.name.toLowerCase() === tagName.toLowerCase().trim()),
    [tagName, savedTags]
  );
  const tagSuggestions = useMemo(
    () => savedTags.filter((t) => t.name.toLowerCase().includes(tagName.toLowerCase().trim())),
    [savedTags, tagName]
  );

  const webhookUrl = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/hubla?token=${token}`;

  const save = async () => {
    if (!name.trim()) return toast.error("Dê um nome à integração");
    if (!pipelineId) return toast.error("Escolha a pipeline");
    setSaving(true);
    const payload = {
      name: name.trim(),
      event_type: eventType,
      sub_origin_id: subOriginId,
      pipeline_id: pipelineId,
      tag_name: tagName.trim() || null,
      tag_color: tagName.trim() ? tagColor : null,
    };

    if (editing) {
      const { error } = await supabase.from("platform_integrations").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error("Erro ao salvar");
      toast.success("Integração atualizada!");
      onDone();
    } else {
      const { data, error } = await supabase
        .from("platform_integrations")
        .insert({ platform: "hubla", ...payload })
        .select("token")
        .single();
      setSaving(false);
      if (error) return toast.error("Erro ao criar integração");
      toast.success("Integração criada!");
      setCreatedUrl(webhookUrl(data.token));
    }
  };

  const inputCls = "h-11 rounded-xl text-sm";
  const labelCls = "text-xs font-medium text-muted-foreground";

  // After creating, show the ready-to-copy webhook URL.
  if (createdUrl) {
    return (
      <div className="rounded-2xl bg-zinc-500/[0.06] p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-green-500" />
          <h4 className="font-semibold text-[15px]">Integração criada!</h4>
        </div>
        <p className="text-sm text-muted-foreground">Copie a URL abaixo e cole no webhook da Hubla:</p>
        <div className="flex items-center gap-2">
          <Input value={createdUrl} readOnly className="flex-1 h-10 text-xs font-mono rounded-lg" />
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 flex-shrink-0 rounded-lg"
            onClick={() => { navigator.clipboard.writeText(createdUrl); setCopied(true); toast.success("URL copiada!"); setTimeout(() => setCopied(false), 2000); }}
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <Button onClick={onDone} className="w-full h-10 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold">
          Concluir
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-zinc-500/[0.06] p-4 space-y-4">
      <h4 className="font-semibold text-[15px]">{editing ? "Editar integração" : "Nova integração Hubla"}</h4>

      <div className="space-y-1.5">
        <label className={labelCls}>Nome da integração</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Power Academy — Vendas" className={inputCls} autoFocus />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Evento</label>
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
          <SelectContent className="z-[10000]">
            {HUBLA_EVENTS.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Pipeline onde o lead vai cair</label>
        <Select value={pipelineId} onValueChange={setPipelineId}>
          <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione a pipeline..." /></SelectTrigger>
          <SelectContent className="z-[10000]">
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Tag automática (opcional)</label>
        <div className="flex items-center gap-2">
          <Input
            value={tagName}
            onChange={(e) => {
              const v = e.target.value;
              setTagName(v);
              const match = savedTags.find((t) => t.name.toLowerCase() === v.toLowerCase().trim());
              if (match) setTagColor(match.color);
            }}
            placeholder="Digite ou escolha uma tag"
            className={cn(inputCls, "flex-1")}
          />
          {isNewTag && (
            <label className="h-11 w-11 rounded-xl ring-1 ring-black/10 relative overflow-hidden flex-shrink-0 cursor-pointer" style={{ background: tagColor }}>
              <input type="color" value={tagColor} onChange={(e) => setTagColor(e.target.value)} className="absolute -inset-1 opacity-0 cursor-pointer" />
            </label>
          )}
        </div>

        {tagName.trim() && tagSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tagSuggestions.slice(0, 10).map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => { setTagName(t.name); setTagColor(t.color); }}
                className="px-2.5 py-1 rounded-full text-white text-[11px] font-semibold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: t.color }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {isNewTag && (
          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <span>Nova tag:</span>
            <span className="px-2.5 py-1 rounded-full text-white text-[11px] font-semibold" style={{ backgroundColor: tagColor }}>
              {tagName.trim()}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={save} disabled={saving} className="flex-1 h-10 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold">
          {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar e gerar webhook"}
        </Button>
        <Button onClick={onCancel} variant="outline" className="h-10 rounded-xl">Cancelar</Button>
      </div>
    </div>
  );
}

/* ============================ Unnichat ============================ */

function UnnichatPage({ onBack, subOriginId, pipelines }: { onBack: () => void; subOriginId: string; pipelines: { id: string; nome: string }[] }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlatformIntegration | null>(null);

  const { data: integrations = [] } = useQuery({
    queryKey: ["platform-integrations", "unnichat", subOriginId],
    enabled: !!subOriginId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_integrations")
        .select("*")
        .eq("platform", "unnichat")
        .eq("sub_origin_id", subOriginId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PlatformIntegration[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["platform-integrations", "unnichat"] });

  const deleteIntegration = async (id: string) => {
    const { error } = await supabase.from("platform_integrations").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    refresh();
    toast.success("Integração excluída");
  };

  const duplicate = async (it: PlatformIntegration) => {
    const { error } = await supabase.from("platform_integrations").insert({
      platform: "unnichat",
      name: `${it.name} (cópia)`,
      event_type: it.event_type,
      sub_origin_id: it.sub_origin_id,
      config: it.config || {},
    });
    if (error) return toast.error("Erro ao duplicar");
    refresh();
    toast.success("Integração duplicada");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img src="/integrations/unnichat.png" alt="Unnichat" className="h-9 w-9 rounded-lg object-cover" />
          <h3 className="text-lg font-bold">Unnichat</h3>
        </div>
        <div className="flex items-center gap-2">
          {!form && (
            <Button
              onClick={() => setForm({ mode: "create" })}
              className="h-9 gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold"
            >
              <Plus className="h-4 w-4" />
              Criar Integração
            </Button>
          )}
          <Button onClick={onBack} className="h-9 gap-1.5 rounded-lg bg-white text-black hover:bg-white/90 border border-border">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {form && (
          <UnnichatForm
            subOriginId={subOriginId}
            pipelines={pipelines}
            editing={form.mode === "edit" ? form.integration : undefined}
            onDone={() => { setForm(null); refresh(); }}
            onCancel={() => setForm(null)}
          />
        )}

        {!form && (
          integrations.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">Nenhuma integração criada ainda.</p>
          ) : (
            <div className="rounded-xl overflow-hidden border border-border">
              <div className="grid grid-cols-[1fr_120px_140px_44px] items-center gap-2 px-4 py-2.5 bg-zinc-500/[0.06] text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div>Nome</div>
                <div>Data criada</div>
                <div>Evento</div>
                <div />
              </div>
              {integrations.map((it) => (
                <div key={it.id} className="grid grid-cols-[1fr_120px_140px_44px] items-center gap-2 px-4 py-3 border-t border-border text-sm">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-muted-foreground">{new Date(it.created_at).toLocaleDateString("pt-BR")}</div>
                  <div className="text-muted-foreground truncate">{it.event_type === "lead_pipeline" ? "Add à pipeline" : "Recebeu lead"}</div>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[150px] rounded-xl">
                        <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg" onClick={() => setForm({ mode: "edit", integration: it })}>
                          <Pencil className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg" onClick={() => duplicate(it)}>
                          <Files className="h-4 w-4" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg text-destructive focus:text-destructive" onClick={() => setConfirmDelete(it)}>
                          <Trash2 className="h-4 w-4" /> Apagar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar integração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar a integração <span className="font-semibold text-foreground">{confirmDelete?.name}</span>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDelete) deleteIntegration(confirmDelete.id); setConfirmDelete(null); }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UnnichatForm({
  subOriginId,
  pipelines,
  editing,
  onDone,
  onCancel,
}: {
  subOriginId: string;
  pipelines: { id: string; nome: string }[];
  editing?: PlatformIntegration;
  onDone: () => void;
  onCancel: () => void;
}) {
  const cfg = (editing?.config || {}) as Record<string, any>;
  const [name, setName] = useState(editing?.name || "");
  const [eventType, setEventType] = useState(editing?.event_type || "lead_recebido");
  const [triggerPipelineId, setTriggerPipelineId] = useState(editing?.pipeline_id || "");
  const [apiToken, setApiToken] = useState(cfg.api_token || "");
  const [crmId, setCrmId] = useState(cfg.crm_id || "");
  const [columnId, setColumnId] = useState(cfg.column_id || "");
  const [tagId, setTagId] = useState(cfg.tag_id || "");
  const [saving, setSaving] = useState(false);

  const inputCls = "h-11 rounded-xl text-sm";
  const labelCls = "text-xs font-medium text-muted-foreground";

  const save = async () => {
    if (!name.trim()) return toast.error("Dê um nome à integração");
    if (eventType === "lead_pipeline" && !triggerPipelineId) return toast.error("Escolha a pipeline do gatilho");
    if (!apiToken.trim()) return toast.error("Informe o Token da API");
    if (!crmId.trim()) return toast.error("Informe o ID do CRM");
    if (!columnId.trim()) return toast.error("Informe a Pipeline (coluna)");
    setSaving(true);
    const payload = {
      name: name.trim(),
      event_type: eventType,
      sub_origin_id: subOriginId,
      pipeline_id: eventType === "lead_pipeline" ? triggerPipelineId : null,
      config: {
        api_token: apiToken.trim(),
        crm_id: crmId.trim(),
        column_id: columnId.trim(),
        tag_id: tagId.trim() || null,
      },
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("platform_integrations").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("platform_integrations").insert({ platform: "unnichat", ...payload }));
    }
    setSaving(false);
    if (error) return toast.error("Erro ao salvar");
    toast.success(editing ? "Integração atualizada!" : "Integração criada!");
    onDone();
  };

  return (
    <div className="rounded-2xl bg-zinc-500/[0.06] p-4 space-y-4">
      <div>
        <h4 className="font-semibold text-[15px]">{editing ? "Editar integração" : "Nova integração Unnichat"}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">Quando um lead for recebido neste CRM, ele é enviado pra Unnichat.</p>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Nome da integração</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Leads → Unnichat" className={inputCls} autoFocus />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Disparar quando</label>
        <Select value={eventType} onValueChange={(v) => { setEventType(v); if (v === "lead_recebido") setTriggerPipelineId(""); }}>
          <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
          <SelectContent className="z-[10000]">
            <SelectItem value="lead_recebido">Lead recebido</SelectItem>
            <SelectItem value="lead_pipeline">Lead adicionado a uma pipeline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {eventType === "lead_pipeline" && (
        <div className="space-y-1.5">
          <label className={labelCls}>Qual pipeline (deste CRM)</label>
          <Select value={triggerPipelineId} onValueChange={setTriggerPipelineId}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione a pipeline..." /></SelectTrigger>
            <SelectContent className="z-[10000]">
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <label className={labelCls}>Token API da conta</label>
        <Input value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="Cole o token da API Unnichat" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelCls}>ID do CRM</label>
          <Input value={crmId} onChange={(e) => setCrmId(e.target.value)} placeholder="crm_id" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Pipeline (coluna)</label>
          <Input value={columnId} onChange={(e) => setColumnId(e.target.value)} placeholder="column_id" className={inputCls} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Tag (opcional)</label>
        <Input value={tagId} onChange={(e) => setTagId(e.target.value)} placeholder="tag_id da Unnichat" className={inputCls} />
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={save} disabled={saving} className="flex-1 h-10 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold">
          {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar integração"}
        </Button>
        <Button onClick={onCancel} variant="outline" className="h-10 rounded-xl">Cancelar</Button>
      </div>
    </div>
  );
}

/* ============================ Elementor ============================ */

function ElementorPage({ onBack, subOriginId, pipelines }: { onBack: () => void; subOriginId: string; pipelines: { id: string; nome: string }[] }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlatformIntegration | null>(null);

  const { data: integrations = [] } = useQuery({
    queryKey: ["platform-integrations", "elementor", subOriginId],
    enabled: !!subOriginId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_integrations")
        .select("*")
        .eq("platform", "elementor")
        .eq("sub_origin_id", subOriginId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PlatformIntegration[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["platform-integrations", "elementor"] });

  const deleteIntegration = async (id: string) => {
    const { error } = await supabase.from("platform_integrations").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    refresh();
    toast.success("Integração excluída");
  };

  const duplicate = async (it: PlatformIntegration) => {
    const { error } = await supabase.from("platform_integrations").insert({
      platform: "elementor",
      name: `${it.name} (cópia)`,
      event_type: "form_submit",
      sub_origin_id: it.sub_origin_id,
      pipeline_id: it.pipeline_id,
      config: it.config || {},
    });
    if (error) return toast.error("Erro ao duplicar");
    refresh();
    toast.success("Integração duplicada");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img src="/integrations/elementor.svg" alt="Elementor" className="h-9 w-9 rounded-lg object-cover" />
          <h3 className="text-lg font-bold">Elementor</h3>
        </div>
        <div className="flex items-center gap-2">
          {!form && (
            <Button onClick={() => setForm({ mode: "create" })} className="h-9 gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold">
              <Plus className="h-4 w-4" /> Criar Integração
            </Button>
          )}
          <Button onClick={onBack} className="h-9 gap-1.5 rounded-lg bg-white text-black hover:bg-white/90 border border-border">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {form && (
          <ElementorForm
            subOriginId={subOriginId}
            pipelines={pipelines}
            editing={form.mode === "edit" ? form.integration : undefined}
            onDone={() => { setForm(null); refresh(); }}
            onCancel={() => setForm(null)}
          />
        )}

        {!form && (
          integrations.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">Nenhuma integração criada ainda.</p>
          ) : (
            <div className="rounded-xl overflow-hidden border border-border">
              <div className="grid grid-cols-[1fr_120px_44px] items-center gap-2 px-4 py-2.5 bg-zinc-500/[0.06] text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div>Nome</div>
                <div>Data</div>
                <div />
              </div>
              {integrations.map((it) => (
                <div key={it.id} className="grid grid-cols-[1fr_120px_44px] items-center gap-2 px-4 py-3 border-t border-border text-sm">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-muted-foreground">{new Date(it.created_at).toLocaleDateString("pt-BR")}</div>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[150px] rounded-xl">
                        <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg" onClick={() => setForm({ mode: "edit", integration: it })}>
                          <Pencil className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg" onClick={() => duplicate(it)}>
                          <Files className="h-4 w-4" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg text-destructive focus:text-destructive" onClick={() => setConfirmDelete(it)}>
                          <Trash2 className="h-4 w-4" /> Apagar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar integração</AlertDialogTitle>
            <AlertDialogDescription>
              Apagar a integração <span className="font-semibold text-foreground">{confirmDelete?.name}</span>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (confirmDelete) deleteIntegration(confirmDelete.id); setConfirmDelete(null); }}>
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ElementorForm({ subOriginId, pipelines, editing, onDone, onCancel }: { subOriginId: string; pipelines: { id: string; nome: string }[]; editing?: PlatformIntegration; onDone: () => void; onCancel: () => void; }) {
  const [name, setName] = useState(editing?.name || "");
  const [pipelineId, setPipelineId] = useState(editing?.pipeline_id || "");
  const [tagName, setTagName] = useState(editing?.tag_name || "");
  const [tagColor, setTagColor] = useState(editing?.tag_color || "#6366f1");
  const [token, setToken] = useState(editing?.token || "");
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: customFields = [] } = useQuery({
    queryKey: ["elementor-cf", subOriginId],
    enabled: !!subOriginId,
    queryFn: async () => {
      const { data } = await supabase.from("sub_origin_custom_fields").select("id, field_key, field_label").eq("sub_origin_id", subOriginId).order("ordem");
      return (data || []) as { id: string; field_key: string; field_label: string }[];
    },
  });

  const { data: savedTags = [] } = useQuery({
    queryKey: ["integration-tags"],
    queryFn: async () => {
      const { data: tagsData } = await supabase.from("lead_tags").select("name, color").limit(2000);
      const { data: webhookTags } = await supabase.from("crm_webhooks").select("auto_tag_name, auto_tag_color").not("auto_tag_name", "is", null);
      const all: { name: string; color: string }[] = [...((tagsData || []) as any[])];
      (webhookTags || []).forEach((t: any) => { if (t.auto_tag_name?.trim()) all.push({ name: t.auto_tag_name, color: t.auto_tag_color || "#6366f1" }); });
      const map = new Map<string, string>();
      all.forEach((t) => { const k = (t.name || "").trim().toLowerCase(); if (k && !map.has(k)) map.set(k, t.color); });
      return Array.from(map.entries()).map(([nm, color]) => { const o = all.find((t) => (t.name || "").trim().toLowerCase() === nm); return { name: o?.name || nm, color }; });
    },
  });
  const isNewTag = tagName.trim() !== "" && !savedTags.some((t) => t.name.toLowerCase() === tagName.toLowerCase().trim());
  const tagSuggestions = savedTags.filter((t) => t.name.toLowerCase().includes(tagName.toLowerCase().trim()));

  // These are the exact names to type in each Elementor field's "Campo no CRM".
  const refFields = useMemo(
    () => [
      { label: "Nome", key: "name" },
      { label: "Email", key: "email" },
      { label: "Telefone / WhatsApp", key: "phone" },
      { label: "Instagram", key: "instagram" },
      ...customFields.map((cf) => ({ label: cf.field_label, key: cf.field_key || cf.id })),
    ],
    [customFields]
  );

  const inputCls = "h-11 rounded-xl text-sm";
  const labelCls = "text-xs font-medium text-muted-foreground";

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copiado!");
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Dê um nome à integração");
    if (!pipelineId) return toast.error("Escolha a pipeline");
    setSaving(true);
    const tagFields = { tag_name: tagName.trim() || null, tag_color: tagName.trim() ? tagColor : null };
    if (editing) {
      const { error } = await supabase.from("platform_integrations").update({ name: name.trim(), pipeline_id: pipelineId, ...tagFields }).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error("Erro ao salvar");
      toast.success("Integração atualizada!");
      onDone();
    } else {
      const { data, error } = await supabase
        .from("platform_integrations")
        .insert({ platform: "elementor", name: name.trim(), event_type: "form_submit", sub_origin_id: subOriginId, pipeline_id: pipelineId, config: {}, ...tagFields })
        .select("token")
        .single();
      setSaving(false);
      if (error) return toast.error("Erro ao criar integração");
      setToken(data.token);
      toast.success("Integração criada!");
    }
  };

  return (
    <div className="rounded-2xl bg-zinc-500/[0.06] p-4 space-y-4">
      <div>
        <h4 className="font-semibold text-[15px]">{editing || token ? "Integração Elementor" : "Nova integração Elementor"}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">Gera um token de conexão. Cole no formulário do Elementor e mapeie cada campo com os nomes abaixo.</p>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Nome da integração</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Landing Mesa de Negócios" className={inputCls} autoFocus />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Pipeline onde o lead vai cair</label>
        <Select value={pipelineId} onValueChange={setPipelineId}>
          <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione a pipeline..." /></SelectTrigger>
          <SelectContent className="z-[10000]">
            {pipelines.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Tag automática (opcional)</label>
        <div className="flex items-center gap-2">
          <Input
            value={tagName}
            onChange={(e) => {
              const v = e.target.value;
              setTagName(v);
              const match = savedTags.find((t) => t.name.toLowerCase() === v.toLowerCase().trim());
              if (match) setTagColor(match.color);
            }}
            placeholder="Digite ou escolha uma tag"
            className={cn(inputCls, "flex-1")}
          />
          {isNewTag && (
            <label className="h-11 w-11 rounded-xl ring-1 ring-black/10 relative overflow-hidden flex-shrink-0 cursor-pointer" style={{ background: tagColor }}>
              <input type="color" value={tagColor} onChange={(e) => setTagColor(e.target.value)} className="absolute -inset-1 opacity-0 cursor-pointer" />
            </label>
          )}
        </div>
        {tagName.trim() && tagSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tagSuggestions.slice(0, 10).map((t) => (
              <button key={t.name} type="button" onClick={() => { setTagName(t.name); setTagColor(t.color); }} className="px-2.5 py-1 rounded-full text-white text-[11px] font-semibold hover:opacity-90" style={{ backgroundColor: t.color }}>
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {token && (
        <>
          <div className="space-y-1.5">
            <label className={labelCls}>URL de Conexão (cole no formulário do Elementor → Conexão Biteti)</label>
            <div className="flex items-center gap-2">
              <Input
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/elementor?token=${token}`}
                readOnly
                className={cn(inputCls, "flex-1 font-mono text-xs")}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl flex-shrink-0"
                onClick={() => copy(`${window.location.origin}/api/integrations/elementor?token=${token}`, "__url__")}
              >
                {copiedKey === "__url__" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelCls}>Nomes dos campos (use no campo "Biteti" de cada campo do Elementor)</label>
            <div className="rounded-xl border border-border overflow-hidden">
              {refFields.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border last:border-b-0 text-sm">
                  <span className="truncate">{f.label}</span>
                  <button onClick={() => copy(f.key, f.key)} className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground flex-shrink-0">
                    <code className="truncate max-w-[180px]">{f.key}</code>
                    {copiedKey === f.key ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-1">
        <Button onClick={token && !editing ? onDone : save} disabled={saving} className="flex-1 h-10 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold">
          {saving ? "Salvando..." : token && !editing ? "Concluir" : editing ? "Salvar alterações" : "Criar e gerar token"}
        </Button>
        <Button onClick={onCancel} variant="outline" className="h-10 rounded-xl">{token && !editing ? "Fechar" : "Cancelar"}</Button>
      </div>
    </div>
  );
}
