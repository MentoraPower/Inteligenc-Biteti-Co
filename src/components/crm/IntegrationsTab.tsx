import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Copy, Check, Trash2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const HUBLA_EVENTS = [
  { id: "compra_aprovada", label: "Compra aprovada" },
  { id: "carrinho_abandonado", label: "Carrinho abandonado" },
  { id: "reembolso", label: "Reembolso" },
];

const PLATFORMS = [
  { id: "hubla", name: "Hubla", logo: "/integrations/hubla.webp" },
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
}

export function IntegrationsTab() {
  const [openPlatform, setOpenPlatform] = useState<string | null>(null);

  if (openPlatform === "hubla") {
    return <HublaPage onBack={() => setOpenPlatform(null)} />;
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

function HublaPage({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const webhookUrl = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/hubla?token=${token}`;

  const copyUrl = (id: string, token: string) => {
    navigator.clipboard.writeText(webhookUrl(token));
    setCopiedId(id);
    toast.success("URL copiada!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteIntegration = async (id: string) => {
    const { error } = await supabase.from("platform_integrations").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["platform-integrations", "hubla"] });
    toast.success("Integração excluída");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header: name on the left, white "Voltar" button on the right */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img src="/integrations/hubla.webp" alt="Hubla" className="h-9 w-9 rounded-lg object-cover" />
          <h3 className="text-lg font-bold">Hubla</h3>
        </div>
        <Button
          onClick={onBack}
          className="h-9 gap-1.5 rounded-lg bg-white text-black hover:bg-white/90 border border-border"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!creating && (
          <Button
            onClick={() => setCreating(true)}
            className="h-10 gap-2 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold"
          >
            <Plus className="h-4 w-4" />
            Criar Integração
          </Button>
        )}

        {creating && (
          <CreateHublaIntegration
            onDone={() => {
              setCreating(false);
              queryClient.invalidateQueries({ queryKey: ["platform-integrations", "hubla"] });
            }}
            onCancel={() => setCreating(false)}
          />
        )}

        {/* Existing integrations */}
        {!creating && (
          <div className="space-y-2.5">
            {integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">Nenhuma integração criada ainda.</p>
            ) : (
              integrations.map((it) => (
                <div key={it.id} className="p-4 rounded-xl bg-zinc-500/[0.06] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[15px] truncate">{it.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {HUBLA_EVENTS.find((e) => e.id === it.event_type)?.label || it.event_type}
                        {it.tag_name && (
                          <span
                            className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-white text-[10px] font-semibold"
                            style={{ backgroundColor: it.tag_color || "#6366f1" }}
                          >
                            {it.tag_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 rounded-lg text-destructive hover:text-destructive"
                      onClick={() => deleteIntegration(it.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={webhookUrl(it.token)} readOnly className="flex-1 h-8 text-xs font-mono rounded-lg" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 rounded-lg"
                      onClick={() => copyUrl(it.id, it.token)}
                    >
                      {copiedId === it.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateHublaIntegration({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("compra_aprovada");
  const [subOriginId, setSubOriginId] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);

  const { data: subOrigins = [] } = useQuery({
    queryKey: ["integration-suborigins"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_sub_origins").select("id, nome").order("nome");
      return (data || []) as { id: string; nome: string }[];
    },
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ["integration-pipelines", subOriginId],
    enabled: !!subOriginId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pipelines")
        .select("id, nome")
        .eq("sub_origin_id", subOriginId)
        .order("ordem");
      return (data || []) as { id: string; nome: string }[];
    },
  });

  const { data: savedTags = [] } = useQuery({
    queryKey: ["integration-tags"],
    queryFn: async () => {
      const { data } = await supabase.from("lead_tags").select("name, color").limit(2000);
      const map = new Map<string, string>();
      (data || []).forEach((t: any) => {
        const k = (t.name || "").trim().toLowerCase();
        if (k && !map.has(k)) map.set(k, t.color);
      });
      return Array.from(map.entries()).map(([name, color]) => {
        const orig = (data || []).find((t: any) => (t.name || "").trim().toLowerCase() === name);
        return { name: orig?.name || name, color };
      });
    },
  });

  const tagSuggestions = useMemo(
    () => savedTags.filter((t) => t.name.toLowerCase().includes(tagName.toLowerCase().trim())),
    [savedTags, tagName]
  );

  const save = async () => {
    if (!name.trim()) return toast.error("Dê um nome à integração");
    if (!subOriginId) return toast.error("Escolha onde o lead vai cair");
    if (!pipelineId) return toast.error("Escolha a pipeline");
    setSaving(true);
    const { error } = await supabase.from("platform_integrations").insert({
      platform: "hubla",
      name: name.trim(),
      event_type: eventType,
      sub_origin_id: subOriginId,
      pipeline_id: pipelineId,
      tag_name: tagName.trim() || null,
      tag_color: tagName.trim() ? tagColor : null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar integração");
      return;
    }
    toast.success("Integração criada!");
    onDone();
  };

  const inputCls = "h-11 rounded-xl text-sm";
  const labelCls = "text-xs font-medium text-muted-foreground";

  return (
    <div className="rounded-2xl bg-zinc-500/[0.06] p-4 space-y-4">
      <h4 className="font-semibold text-[15px]">Nova integração Hubla</h4>

      <div className="space-y-1.5">
        <label className={labelCls}>Nome da integração</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Power Academy — Vendas" className={inputCls} autoFocus />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Evento</label>
        <div className="grid grid-cols-3 gap-2">
          {HUBLA_EVENTS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEventType(e.id)}
              className={cn(
                "h-10 rounded-xl text-xs font-medium px-2 border transition-all",
                eventType === e.id
                  ? "border-foreground bg-foreground/[0.04] text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Onde o lead vai cair (espaço)</label>
        <select
          value={subOriginId}
          onChange={(e) => { setSubOriginId(e.target.value); setPipelineId(""); }}
          className={cn(inputCls, "w-full border border-border bg-background px-3")}
        >
          <option value="">Selecione o espaço...</option>
          {subOrigins.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </div>

      {subOriginId && (
        <div className="space-y-1.5">
          <label className={labelCls}>Pipeline de entrada</label>
          <select
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            className={cn(inputCls, "w-full border border-border bg-background px-3")}
          >
            <option value="">Selecione a pipeline...</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <label className={labelCls}>Tag automática (opcional)</label>
        <div className="flex items-center gap-2">
          <Input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="Nome da tag" className={cn(inputCls, "flex-1")} />
          <label className="h-11 w-11 rounded-xl ring-1 ring-black/10 relative overflow-hidden flex-shrink-0 cursor-pointer" style={{ background: tagColor }}>
            <input type="color" value={tagColor} onChange={(e) => setTagColor(e.target.value)} className="absolute -inset-1 opacity-0 cursor-pointer" />
          </label>
        </div>
        {tagName.trim() && tagSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tagSuggestions.slice(0, 8).map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => { setTagName(t.name); setTagColor(t.color); }}
                className="px-2 py-1 rounded-full text-white text-[11px] font-semibold"
                style={{ backgroundColor: t.color }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={save} disabled={saving} className="flex-1 h-10 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold">
          {saving ? "Criando..." : "Criar e gerar webhook"}
        </Button>
        <Button onClick={onCancel} variant="outline" className="h-10 rounded-xl">Cancelar</Button>
      </div>
    </div>
  );
}
