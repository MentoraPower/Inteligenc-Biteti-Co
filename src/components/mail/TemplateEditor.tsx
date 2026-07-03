import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pencil,
  History,
  BarChart2,
  Undo2,
  Redo2,
  Code2,
  Eye,
  ListChecks,
  Settings,
  Image as ImageIcon,
  Type,
  MousePointerClick,
  MoveVertical,
  Play,
  Share2,
  RectangleHorizontal,
  Timer,
  Menu as MenuIcon,
  ShoppingCart,
  ShoppingBag,
  Rss,
  Facebook,
  Twitter,
  Linkedin,
  Youtube,
  Instagram,
  type LucideIcon,
} from "lucide-react";

interface TemplateEditorProps {
  template: { id: string; name: string };
  onBack: () => void;
}

const BLOCKS: { label: string; icon: LucideIcon }[] = [
  { label: "Imagem", icon: ImageIcon },
  { label: "Texto", icon: Type },
  { label: "Botão", icon: MousePointerClick },
  { label: "Espaçador", icon: MoveVertical },
  { label: "Vídeo", icon: Play },
  { label: "Social", icon: Share2 },
  { label: "Banner", icon: RectangleHorizontal },
  { label: "Timer", icon: Timer },
  { label: "Menu", icon: MenuIcon },
  { label: "HTML", icon: Code2 },
  { label: "Carrinho abandonado", icon: ShoppingCart },
  { label: "Browse Abandonment", icon: ShoppingBag },
  { label: "RSS", icon: Rss },
];

// Column layouts (relative widths) shown under "Estruturas".
const STRUCTURES: number[][] = [[1], [1, 1], [1, 1, 1], [1, 1, 1, 1], [1, 2], [2, 1]];

const TOOLBAR: LucideIcon[] = [History, BarChart2, Undo2, Redo2, Code2, Eye, ListChecks, Settings];

const SOCIAL: LucideIcon[] = [Facebook, Twitter, Linkedin, Youtube, Instagram];

type SectionKey = "estruturas" | "blocos" | "modulos";

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold hover:bg-accent/50 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        {title}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function TemplateEditor({ template, onBack }: TemplateEditorProps) {
  const [tab, setTab] = useState<"conteudo" | "globais">("conteudo");
  const [openSection, setOpenSection] = useState<SectionKey | null>("blocos");

  // Collapse the Mail submenu while the editor is open (full-screen editing).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mail-editor", { detail: { open: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent("mail-editor", { detail: { open: false } }));
    };
  }, []);

  const toggle = (key: SectionKey) => setOpenSection((prev) => (prev === key ? null : key));

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>

        <div className="flex items-center rounded-lg border border-border overflow-hidden text-sm">
          <button className="px-4 h-8 text-muted-foreground hover:bg-accent transition-colors max-w-[180px] truncate">
            Automação {template.name}
          </button>
          <button className="px-4 h-8 bg-blue-600 text-white max-w-[220px] truncate">
            E-mail {template.name}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack} className="h-9 rounded-lg">Salvar e sair</Button>
          <Button className="h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white gap-1">
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Sub bar: breadcrumb + toolbar */}
      <div className="flex items-center justify-between px-5 h-11 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Campanha</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{template.name}</span>
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-1">
          {TOOLBAR.map((Icon, i) => (
            <button
              key={i}
              className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Canvas */}
        <div className="flex-1 overflow-y-auto bg-muted/30 p-10">
          <div className="mx-auto max-w-[640px] bg-white rounded-lg shadow-sm border border-border p-10 space-y-8">
            {/* Logo */}
            <div className="h-20 border border-border bg-muted/40 flex items-center justify-center">
              <span className="text-2xl font-extrabold tracking-wide text-zinc-800">LOGóTIPO</span>
            </div>

            <h2 className="text-xl font-bold text-center text-zinc-900">Crie seu email aqui!</h2>
            <p className="text-sm text-zinc-500 text-center max-w-md mx-auto leading-relaxed">
              Este editor oferece a habilidade de personalizar totalmente o layout e o estilo dos
              seus emails. Você pode adicionar, remanejar e remover estruturas e seções.
            </p>

            {/* Two-column section */}
            <div className="flex gap-6 items-center">
              <div className="w-1/2 aspect-[4/3] rounded-md bg-zinc-100 border border-border flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-zinc-400" />
              </div>
              <div className="w-1/2 space-y-3">
                <h3 className="font-bold text-zinc-900">Crie do jeito que você quiser</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  As estruturas ajudam a criar um relatório com múltiplas colunas sem complicações.
                  Você pode adicionar a um email quantas estruturas quiser.
                </p>
                <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded transition-colors">
                  Adicionar texto do botão
                </button>
              </div>
            </div>

            {/* Social icons */}
            <div className="flex justify-center gap-3 pt-2">
              {SOCIAL.map((Icon, i) => (
                <div key={i} className="h-7 w-7 rounded-full bg-zinc-900 flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-[320px] border-l border-border flex flex-col bg-background flex-shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-border flex-shrink-0">
            <button
              onClick={() => setTab("conteudo")}
              className={cn(
                "flex-1 h-11 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === "conteudo"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Conteúdo
            </button>
            <button
              onClick={() => setTab("globais")}
              className={cn(
                "flex-1 h-11 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === "globais"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Configurações globais
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "conteudo" ? (
              <>
                {/* Estruturas */}
                <Section title="Estruturas" open={openSection === "estruturas"} onToggle={() => toggle("estruturas")}>
                  <div className="space-y-2.5">
                    {STRUCTURES.map((cols, i) => (
                      <button
                        key={i}
                        className="w-full rounded-lg border border-border p-1.5 hover:border-blue-400 hover:shadow-sm transition-all"
                      >
                        <div className="flex gap-1.5">
                          {cols.map((w, j) => (
                            <div
                              key={j}
                              style={{ flex: w }}
                              className="h-9 rounded border border-dashed border-blue-300 bg-blue-50/60"
                            />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Blocos */}
                <Section title="Blocos" open={openSection === "blocos"} onToggle={() => toggle("blocos")}>
                  <div className="space-y-2">
                    {BLOCKS.map(({ label, icon: Icon }) => (
                      <button
                        key={label}
                        className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg border border-border bg-card hover:border-blue-400 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm">{label}</span>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Módulos */}
                <Section title="Módulos" open={openSection === "modulos"} onToggle={() => toggle("modulos")}>
                  <p className="text-xs text-muted-foreground py-2">Nenhum módulo salvo ainda.</p>
                </Section>
              </>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                Configurações globais do e-mail (cores, fontes, largura) — em breve.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
