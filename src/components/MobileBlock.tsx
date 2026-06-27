import { Monitor } from "lucide-react";

export function MobileBlock() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-background px-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Monitor className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Disponível apenas no computador
      </h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Esta plataforma não pode ser acessada pelo celular. Acesse pelo seu
        computador (desktop ou notebook) para continuar.
      </p>
    </div>
  );
}
