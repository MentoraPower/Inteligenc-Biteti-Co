import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Copy, ArrowRight, Settings, Search, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { CampaignFlowEditor } from "@/components/mail/CampaignFlowEditor";

interface EmailAutomation {
  id: string;
  name: string;
  trigger_pipeline_id: string | null;
  sub_origin_id: string | null;
  subject: string;
  body_html: string;
  is_active: boolean;
  created_at: string;
  flow_steps: any[] | null;
}

export default function Mail() {
  const [editing, setEditing] = useState<EmailAutomation | null>(null);
  const [filter, setFilter] = useState("");
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<EmailAutomation | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [domainCfg, setDomainCfg] = useState<Record<string, { is_active: boolean; sender_name: string; sender_local: string }>>({});

  // Domains registered in Resend (pulled via edge function).
  const { data: resendDomains = [], isLoading: domainsLoading, error: domainsError } = useQuery({
    queryKey: ["resend-domains"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("resend-domains");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return ((data as any)?.domains || []) as any[];
    },
  });

  // Local per-domain config (active + sender name).
  const { data: domainConfigs = [], refetch: refetchDomainCfg } = useQuery({
    queryKey: ["email-domains"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("email_domains").select("*");
      return (data || []) as any[];
    },
  });

  const skipAutoSave = useRef(true);

  const openSettings = () => {
    const cfg: Record<string, { is_active: boolean; sender_name: string; sender_local: string }> = {};
    resendDomains.forEach((d: any) => {
      const existing = domainConfigs.find((c: any) => c.resend_id === d.id);
      cfg[d.id] = {
        is_active: !!existing?.is_active,
        sender_name: existing?.sender_name || "",
        sender_local: existing?.sender_local || "",
      };
    });
    skipAutoSave.current = true;
    setDomainCfg(cfg);
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    const rows = resendDomains.map((d: any) => ({
      resend_id: d.id,
      domain: d.name,
      is_active: domainCfg[d.id]?.is_active || false,
      sender_name: domainCfg[d.id]?.sender_name || "",
      sender_local: domainCfg[d.id]?.sender_local || "",
    }));
    const { error } = await (supabase as any).from("email_domains").upsert(rows, { onConflict: "resend_id" });
    setSavingSettings(false);
    if (error) return toast.error(`Erro ao salvar: ${error.message}`);
    refetchDomainCfg();
  };

  // Auto-save on any change (debounced), skipping the initial populate on open.
  useEffect(() => {
    if (!settingsOpen) return;
    if (skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }
    const t = setTimeout(() => { saveSettings(); }, 600);
    return () => clearTimeout(t);
  }, [domainCfg, settingsOpen]);

  const { data: automations = [], refetch } = useQuery({
    queryKey: ["email-automations-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_automations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as EmailAutomation[];
    },
  });

  const openCreate = () => { setNewName(""); setNameDialogOpen(true); };

  const confirmCreate = async () => {
    if (!newName.trim()) return toast.error("Dê um nome à campanha");
    const { data, error } = await (supabase as any)
      .from("email_automations")
      .insert({ name: newName.trim(), is_active: true, subject: "", body_html: "" })
      .select("*")
      .single();
    if (error) return toast.error("Erro ao criar campanha");
    setNameDialogOpen(false);
    refetch();
    setEditing(data as EmailAutomation); // open the blank builder page
  };


  const duplicate = async (a: EmailAutomation) => {
    const { error } = await (supabase as any).from("email_automations").insert({
      name: `${a.name} (cópia)`,
      trigger_pipeline_id: a.trigger_pipeline_id,
      sub_origin_id: a.sub_origin_id,
      subject: a.subject,
      body_html: a.body_html,
      is_active: false,
      flow_steps: a.flow_steps,
    });
    if (error) return toast.error("Erro ao duplicar");
    toast.success("Campanha duplicada!");
    refetch();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    const { error } = await (supabase as any).from("email_automations").delete().eq("id", id);
    if (error) return toast.error("Erro ao remover");
    toast.success("Campanha removida!");
    refetch();
  };

  // ── Campaign flow editor (vertical funnel, React Flow) ──
  if (editing) {
    return (
      <CampaignFlowEditor
        automation={editing}
        onBack={() => { setEditing(null); refetch(); }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col p-6 w-full overflow-y-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Button variant="outline" className="h-10 rounded-xl font-medium">Filtro</Button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Pesquisar"
              className="h-10 pl-9 rounded-xl"
            />
          </div>
          <Button onClick={openCreate} className="h-10 gap-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-white border-0 font-semibold">
            <Plus className="h-4 w-4" /> Criar campanha
          </Button>
          <Button variant="outline" size="icon" onClick={openSettings} title="Configuração de e-mail" className="h-10 w-10 rounded-xl">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-x-auto">
        <div className="min-w-[980px]">
          {/* Header */}
          <div className="grid grid-cols-[36px_minmax(220px,1.4fr)_230px_150px_160px_130px] items-center gap-6 px-4 py-3 border-b border-border text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
            <div>
              <input type="checkbox" className="h-4 w-4 rounded border-border accent-purple-800" />
            </div>
            <div>Automação</div>
            <div className="whitespace-nowrap">Editado pela última vez</div>
            <div>Contatos atuais</div>
            <div>Índice de conversão</div>
            <div className="flex justify-end">
              <Settings className="h-4 w-4" />
            </div>
          </div>

          {(() => {
            const visible = automations.filter((a) =>
              a.name.toLowerCase().includes(filter.trim().toLowerCase())
            );
            if (visible.length === 0) {
              return (
                <div className="px-4 py-10 border-t border-border text-center text-sm text-muted-foreground">
                  {filter.trim()
                    ? "Nenhuma campanha encontrada."
                    : <>Nenhuma campanha ainda. Clique em <b>Criar campanha</b> para começar.</>}
                </div>
              );
            }
            return visible.map((a) => (
              <div key={a.id} className="grid grid-cols-[36px_minmax(220px,1.4fr)_230px_150px_160px_130px] items-center gap-6 px-4 py-4 border-t border-border text-sm">
                <div>
                  <input type="checkbox" className="h-4 w-4 rounded border-border accent-purple-800" />
                </div>

                {/* Automação: thumbnail + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-[104px] h-[60px] rounded-lg border border-border bg-card p-2 flex flex-col gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1 text-[10px] font-medium">
                      <span className={`h-1.5 w-1.5 rounded-full ${a.is_active ? "bg-emerald-500" : "bg-zinc-400"}`} />
                      {a.is_active ? "Ativo" : "Inativo"}
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600/70" />
                      <div className="w-8 h-4 rounded-sm bg-muted" />
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing(a)}
                    className="text-blue-600 font-semibold hover:underline truncate text-left"
                  >
                    {a.name}
                  </button>
                </div>

                {/* Editado pela última vez */}
                <div className="text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </div>

                {/* Contatos atuais */}
                <div>
                  <span className="text-blue-600 font-medium">0</span>
                </div>

                {/* Índice de conversão */}
                <div className="text-muted-foreground">—</div>

                {/* Actions */}
                <div className="flex justify-end items-center gap-0.5">
                  <Button
                    onClick={() => setEditing(a)}
                    variant="ghost"
                    className="h-8 px-2.5 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 font-medium"
                  >
                    Editar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-blue-600 hover:bg-blue-500/10">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => duplicate(a)}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setConfirmDelete(a)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Rows per page */}
      <div className="flex justify-end mt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-3 h-8">
          Linhas: 20 <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Name dialog before opening the campaign page */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova campanha de e-mail</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da campanha" autoFocus onKeyDown={(e) => e.key === "Enter" && confirmCreate()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmCreate} className="bg-purple-900 hover:bg-purple-800 text-white border-0">Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email configuration — Resend domains (large popup) */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-6xl max-h-[85vh] flex flex-col [&>button:last-child]:hidden">
          <DialogHeader>
            <DialogTitle>Domínios de e-mail</DialogTitle>
          </DialogHeader>
          <Button
            size="sm"
            onClick={() => setSettingsOpen(false)}
            className="absolute right-4 top-4 h-8 bg-purple-900 text-white hover:bg-purple-800"
          >
            Voltar <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <div className="py-2 flex-1 overflow-y-auto">
            {domainsLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Carregando domínios...</p>
            ) : domainsError ? (
              <p className="text-sm text-destructive py-8 text-center">Erro ao carregar domínios da Resend.</p>
            ) : resendDomains.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum domínio cadastrado na Resend.</p>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[1.4fr_1.1fr_120px_90px] gap-2 px-4 py-2.5 bg-zinc-500/[0.06] text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <div>E-mail de envio</div>
                  <div>Nome do remetente</div>
                  <div className="text-center">Verificação</div>
                  <div className="text-center">Ativado</div>
                </div>
                {resendDomains.map((d: any) => {
                  const cfg = domainCfg[d.id] || { is_active: false, sender_name: "", sender_local: "" };
                  const st = d.status === "verified"
                    ? { label: "Verificado", cls: "bg-green-800 text-white" }
                    : (d.status === "failed" || d.status === "failure" || d.status === "temporary_failure")
                      ? { label: "Falhou", cls: "bg-red-600 text-white" }
                      : { label: "Pendente", cls: "bg-yellow-400 text-black" };
                  return (
                    <div key={d.id} className="grid grid-cols-[1.4fr_1.1fr_120px_90px] gap-2 items-center px-4 py-3 border-t border-border text-sm">
                      <div className="flex items-center gap-1 min-w-0">
                        <Input
                          value={cfg.sender_local}
                          onChange={(e) => setDomainCfg((prev) => ({ ...prev, [d.id]: { ...cfg, sender_local: e.target.value.replace(/[@\s]/g, "") } }))}
                          placeholder="contato"
                          className="h-10 rounded-lg w-28 flex-shrink-0"
                        />
                        <span className="text-sm text-muted-foreground font-semibold truncate">@{d.name}</span>
                      </div>
                      <div className="min-w-0">
                        <Input
                          value={cfg.sender_name}
                          onChange={(e) => setDomainCfg((prev) => ({ ...prev, [d.id]: { ...cfg, sender_name: e.target.value } }))}
                          placeholder="Ex: Mentora Beauty Academy"
                          className="h-10 rounded-lg w-full"
                        />
                      </div>
                      <div className="flex justify-center">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="flex justify-center">
                        <Switch
                          checked={cfg.is_active}
                          onCheckedChange={(v) => setDomainCfg((prev) => ({ ...prev, [d.id]: { ...cfg, is_active: v } }))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {savingSettings && (
            <DialogFooter>
              <span className="text-xs text-muted-foreground">Salvando...</span>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <b>"{confirmDelete?.name}"</b>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
