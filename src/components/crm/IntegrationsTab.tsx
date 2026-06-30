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

const PLATFORMS = [{ id: "hubla", name: "Hubla", logo: "/integrations/hubla.webp" }];

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
              <div className="text-xs text-muted-foreground">Webhook de vendas</div>
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
    queryKey: ["platform-integrations", "hubla"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_integrations")
        .select("*")
        .eq("platform", "hubla")
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
        <Button onClick={onBack} className="h-9 gap-1.5 rounded-lg bg-white text-black hover:bg-white/90 border border-border">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!form && (
          <Button
            onClick={() => setForm({ mode: "create" })}
            className="h-10 gap-2 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold"
          >
            <Plus className="h-4 w-4" />
            Criar Integração
          </Button>
        )}

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
