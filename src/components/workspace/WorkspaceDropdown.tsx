import { useState, useEffect } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Plus, Check, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

type Ws = { id: string; name: string };

export function WorkspaceDropdown() {
  const { workspaces, currentWorkspace, switchWorkspace, createWorkspace, renameWorkspace, deleteWorkspace } = useWorkspace();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [renameTarget, setRenameTarget] = useState<Ws | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Ws | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    setIsCreating(true);
    await createWorkspace(newWorkspaceName.trim());
    setIsCreating(false);
    setIsCreateDialogOpen(false);
    setNewWorkspaceName('');
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setIsRenaming(true);
    await renameWorkspace(renameTarget.id, renameValue.trim());
    setIsRenaming(false);
    setRenameTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await deleteWorkspace(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  // Keep the workspace trigger stable across refreshes: persist the name and use it
  // as a fallback so the selector (and its position) never disappears or shifts
  // while the workspaces are loading. We intentionally DO NOT swap it for a skeleton.
  useEffect(() => {
    if (currentWorkspace?.name) {
      try {
        localStorage.setItem('crm_ws_name', currentWorkspace.name);
      } catch { /* ignore */ }
    }
  }, [currentWorkspace?.name]);

  const getInitials = (name: string) => name.charAt(0).toUpperCase();

  let persistedName = '';
  try {
    persistedName = localStorage.getItem('crm_ws_name') || '';
  } catch { /* ignore */ }
  const displayName = currentWorkspace?.name || persistedName || 'Workspace';

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button className="h-9 flex items-center gap-2 pl-1 pr-3 ml-3 rounded-full bg-white/10 transition-colors outline-none hover:bg-white/15">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-semibold text-white">
                {getInitials(displayName)}
              </span>
            </div>
            <span className="text-sm font-bold text-white">{displayName}</span>
            <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-80 bg-popover border border-border p-0 rounded-2xl overflow-hidden shadow-2xl">
          {/* Current workspace header */}
          <div className="p-3 bg-muted/40 border-b border-border">
            <span className="block px-1 pb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Espaço atual
            </span>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-sm font-bold text-white">
                  {currentWorkspace ? getInitials(currentWorkspace.name) : 'W'}
                </span>
              </div>
              <span className="flex-1 text-[15px] font-bold truncate">{currentWorkspace?.name || 'Workspace'}</span>
              <Check className="h-[18px] w-[18px] text-primary flex-shrink-0" />
            </div>
          </div>

          {/* Workspace list */}
          <div className="p-2">
            <span className="block px-2 pt-1 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Trocar de espaço
            </span>
            <div className="space-y-0.5 max-h-[280px] overflow-y-auto kanban-scroll">
              {workspaces.map((workspace) => {
                const isActive = currentWorkspace?.id === workspace.id;
                return (
                  <div
                    key={workspace.id}
                    className={cn(
                      "group flex items-center gap-1 pl-2 pr-1 py-1.5 rounded-xl transition-colors",
                      isActive ? "bg-accent" : "hover:bg-accent"
                    )}
                  >
                    <button
                      onClick={() => { setIsDropdownOpen(false); switchWorkspace(workspace.id); }}
                      className="flex flex-1 items-center gap-3 min-w-0 outline-none"
                    >
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">
                          {getInitials(workspace.name)}
                        </span>
                      </div>
                      <span className="flex-1 text-sm font-medium text-left truncate">{workspace.name}</span>
                      {isActive && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                    </button>

                    {/* Kebab (vertical 3 dots) with edit & delete */}
                    <DropdownMenuSub>
                      <DropdownMenuPrimitive.SubTrigger asChild>
                        <button
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 outline-none data-[state=open]:bg-black/5 dark:data-[state=open]:bg-white/10 flex-shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuPrimitive.SubTrigger>
                      <DropdownMenuSubContent className="min-w-[160px] p-1 rounded-xl">
                        <DropdownMenuItem
                          className="text-sm gap-2 cursor-pointer rounded-lg"
                          onClick={() => { setRenameTarget(workspace); setRenameValue(workspace.name); }}
                        >
                          <Pencil className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        {workspace.id !== DEFAULT_WORKSPACE_ID && (
                          <DropdownMenuItem
                            className="text-sm gap-2 cursor-pointer rounded-lg text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(workspace)}
                          >
                            <Trash2 className="h-4 w-4" /> Apagar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Create */}
          <div className="p-2 border-t border-border">
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent hover:border-foreground/20 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Criar espaço de trabalho
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar novo espaço de trabalho</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nome do espaço de trabalho"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateWorkspace} disabled={!newWorkspaceName.trim() || isCreating}>
              {isCreating ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear espaço de trabalho</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nome do espaço de trabalho"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={!renameValue.trim() || isRenaming}>
              {isRenaming ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar espaço de trabalho</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar o espaço{' '}
              <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>? Todos os
              dados desse espaço serão removidos. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
            >
              {isDeleting ? 'Apagando...' : 'Apagar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
