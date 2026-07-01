import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, ArrowLeft, FileSpreadsheet, Loader2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportContactsTabProps {
  subOriginId: string;
  pipelines: { id: string; nome: string }[];
  onImportingChange?: (importing: boolean) => void;
}

// Minimal CSV parser (handles quoted fields, escaped quotes, commas & newlines).
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* ignore */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((v) => (v ?? "").trim() !== ""));
}

const normalizePhone = (v: string) =>
  String(v || "").replace(/\D/g, "").replace(/^55(\d{10,11})$/, "$1");

// Core platform targets + a sentinel for ignore.
const CORE_TARGETS = [
  { key: "name", label: "Nome" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "Telefone / WhatsApp" },
  { key: "instagram", label: "Instagram" },
];

export function ImportContactsTab({ subOriginId, pipelines, onImportingChange }: ImportContactsTabProps) {
  const [step, setStep] = useState<"upload" | "preview" | "map">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [pipelineId, setPipelineId] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: customFields = [] } = useQuery({
    queryKey: ["import-custom-fields", subOriginId],
    enabled: !!subOriginId,
    queryFn: async () => {
      const { data } = await supabase
        .from("sub_origin_custom_fields")
        .select("id, field_label")
        .eq("sub_origin_id", subOriginId)
        .order("ordem");
      return (data || []) as { id: string; field_label: string }[];
    },
  });

  const targets = useMemo(
    () => [
      ...CORE_TARGETS,
      ...customFields.map((cf) => ({ key: `cf:${cf.id}`, label: cf.field_label })),
    ],
    [customFields]
  );

  // Each platform field can only be mapped once — track the ones already in use.
  const usedTargets = useMemo(
    () => new Set(Object.values(mapping).filter((v) => v && v !== "ignore")),
    [mapping]
  );

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Apenas arquivos CSV são aceitos");
      return;
    }
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length < 2) {
      toast.error("CSV vazio ou sem linhas de dados");
      return;
    }
    const hdrs = parsed[0].map((h) => h.trim());
    const body = parsed.slice(1);
    setFileName(file.name);
    setHeaders(hdrs);
    setRows(body);
    // Auto-guess mapping by header name — each field only once.
    const guess: Record<number, string> = {};
    const used = new Set<string>();
    const pick = (key: string) => (used.has(key) ? "ignore" : (used.add(key), key));
    hdrs.forEach((h, i) => {
      const l = h.toLowerCase();
      if (/insta/.test(l)) guess[i] = pick("instagram");
      else if (/nome|name/.test(l)) guess[i] = pick("name");
      else if (/mail/.test(l)) guess[i] = pick("email");
      else if (/tel|phone|whats|celular|fone/.test(l)) guess[i] = pick("whatsapp");
      else guess[i] = "ignore";
    });
    setMapping(guess);
    setStep("preview");
  };

  const reset = () => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setPipelineId("");
    setProgress(0);
  };

  const doImport = async () => {
    if (!pipelineId) return toast.error("Escolha a pipeline de destino");
    const hasName = Object.values(mapping).includes("name");
    const hasContact = Object.values(mapping).some((v) => v === "email" || v === "whatsapp" || v === "instagram");
    if (!hasName && !hasContact) return toast.error("Mapeie ao menos Nome, Email, Telefone ou Instagram");

    setImporting(true);
    setProgress(0);
    try {
      // Build lead objects + their custom responses.
      const items = rows.map((row) => {
        const lead: any = { sub_origin_id: subOriginId, pipeline_id: pipelineId };
        const custom: { field_id: string; response_value: string }[] = [];
        headers.forEach((_, idx) => {
          const target = mapping[idx];
          const val = (row[idx] ?? "").trim();
          if (!target || target === "ignore") return;
          if (target === "name") lead.name = val;
          else if (target === "email") lead.email = val || null;
          else if (target === "whatsapp") lead.whatsapp = normalizePhone(val) || null;
          else if (target === "instagram") lead.instagram = val ? (val.startsWith("@") ? val : `@${val}`) : null;
          else if (target.startsWith("cf:") && val) custom.push({ field_id: target.slice(3), response_value: val });
        });
        if (!lead.name || !lead.name.trim()) lead.name = lead.email || "Contato";
        return { lead, custom };
      });

      // Run the import server-side (service role → bypasses RLS, and finishes even
      // if the user leaves the platform). Shows a bar above the pipelines meanwhile.
      onImportingChange?.(true);
      const total = items.length;
      const targetPipeline = pipelineId;
      reset();
      toast.info(`Subindo ${total} contato(s)…`);

      const { data, error } = await supabase.functions.invoke("import-leads", {
        body: { sub_origin_id: subOriginId, pipeline_id: targetPipeline, items },
      });
      onImportingChange?.(false);

      if (error || (data as any)?.error) {
        toast.error(`Erro ao importar: ${(data as any)?.error || error?.message || "falha"}`);
        return;
      }
      toast.success(`${(data as any)?.inserted ?? total} contato(s) importado(s)!`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro ao importar: ${e.message || e}`);
    } finally {
      setImporting(false);
    }
  };

  /* ---------- Upload step ---------- */
  if (step === "upload") {
    return (
      <div className="p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold">Importar contatos</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Suba uma lista em CSV com o nome das colunas na primeira linha.</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-3 py-16 rounded-2xl border-2 border-dashed border-border hover:border-foreground/30 hover:bg-muted/30 transition-colors"
        >
          <div className="h-14 w-14 rounded-2xl bg-zinc-500/[0.08] flex items-center justify-center">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-[15px]">Clique para subir o CSV</p>
            <p className="text-xs text-muted-foreground mt-0.5">Somente arquivos .csv</p>
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>
    );
  }

  /* ---------- Preview step (all rows, sticky header) ---------- */
  if (step === "preview") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{fileName}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">· {rows.length} contatos</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={reset} className="h-9 rounded-lg gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Trocar arquivo
            </Button>
            <Button onClick={() => setStep("map")} className="h-9 rounded-lg gap-2 bg-foreground text-background hover:bg-foreground/90 font-semibold">
              <ListChecks className="h-4 w-4" /> Mapear campos
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4">
          <div className="inline-block min-w-full rounded-xl border border-border overflow-hidden">
            <table className="text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted/60 backdrop-blur">
                  {headers.map((h, i) => (
                    <th key={i} className="text-left font-semibold px-3 py-2.5 whitespace-nowrap border-b border-border">
                      {h || `Coluna ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="odd:bg-transparent even:bg-muted/20">
                    {headers.map((_, ci) => (
                      <td key={ci} className="px-3 py-2 whitespace-nowrap border-b border-border/50 text-muted-foreground max-w-[280px] truncate">
                        {row[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Map step ---------- */
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <span className="text-sm font-semibold">Mapear campos</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setStep("preview")} className="h-9 rounded-lg gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Ver lista
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-5 space-y-5">
        <p className="text-sm text-muted-foreground">
          Diga para onde vai cada coluna do CSV. As não mapeadas são ignoradas.
        </p>

        <div className="space-y-2.5">
          {headers.map((h, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="rounded-xl bg-zinc-500/[0.06] px-3 py-2.5 text-sm font-medium truncate">
                {h || `Coluna ${i + 1}`}
                <span className="block text-[11px] text-muted-foreground font-normal truncate">{rows[0]?.[i] || ""}</span>
              </div>
              <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
              <Select value={mapping[i] || "ignore"} onValueChange={(v) => setMapping((m) => ({ ...m, [i]: v }))}>
                <SelectTrigger className="h-11 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[10000]">
                  <SelectItem value="ignore">Ignorar</SelectItem>
                  {targets
                    .filter((t) => t.key === mapping[i] || !usedTargets.has(t.key))
                    .map((t) => (
                      <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-medium text-muted-foreground">Subir os leads na pipeline</label>
          <Select value={pipelineId} onValueChange={setPipelineId}>
            <SelectTrigger className="h-11 rounded-xl text-sm"><SelectValue placeholder="Selecione a pipeline..." /></SelectTrigger>
            <SelectContent className="z-[10000]">
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-border">
        <Button
          onClick={doImport}
          disabled={importing}
          className="w-full h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold gap-2"
        >
          {importing ? (<><Loader2 className="h-4 w-4 animate-spin" /> Subindo… {progress}%</>) : (<>Subir lista ({rows.length})</>)}
        </Button>
      </div>
    </div>
  );
}
