import { Suspense } from "react";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { ExportLeadsDialog } from "@/components/crm/ExportLeadsDialog";
import { CRMColumnsSkeleton } from "@/components/crm/CRMColumnsSkeleton";
import { useAuth } from "@/hooks/useAuth";

export default function CRM() {
  // Keep auth check active (it redirects unauthenticated users), but DON'T replace
  // the whole page while it resolves — the board renders its own structure
  // (submenu/ViewTabs) with the skeleton scoped to just the pipelines area.
  useAuth("/auth");

  return (
    <>
      <Suspense fallback={<CRMColumnsSkeleton />}>
        <KanbanBoard />
      </Suspense>
      <ExportLeadsDialog />
    </>
  );
}
