import { useState, useEffect } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Plus, Check, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
          <button className="h-9 flex items-center gap-2 pl-1 pr-3 ml-3 rounded-full bg-black/10 dark:bg-white/10 transition-colors outline-none hover:bg-black/15 dark:hover:bg-white/15">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-semibold text-white">
                {getInitials(displayName)}
              </span>
            </div>
            <span className="text-sm font-bold text-foreground">{displayName}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 bg-popover border border-border p-1.5">
          {/* Current workspace header */}
          <div className="px-1 py-1 mb-1">
            <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl bg-sidebar-accent">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-white">
                  {currentWorkspace ? getInitials(currentWorkspace.name) : 'W'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Espaço atual</span>
                <span className="block text-base font-semibold truncate">{currentWorkspace?.name || 'Workspace'}</span>
              </div>
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Workspace list */}
          <div className="py-1 space-y-0.5">
            {workspaces.map((workspace) => {
              const isActive = currentWorkspace?.id === workspace.id;
              return (
                <div
                  key={workspace.id}
                  className="group flex items-center gap-1 pl-2 pr-1 py-1.5 rounded-lg hover:bg-accent transition-colors"
                >
                  <button
                    onClick={() => { setIsDropdownOpen(false); switchWorkspace(workspace.id); }}
                    className="flex flex-1 items-center gap-2.5 min-w-0 outline-none"
                  >
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-semibold text-white">
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
                        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 outline-none data-[state=open]:bg-black/5 dark:data-[state=open]:bg-white/10 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuPrimitive.SubTrigger>
                    <DropdownMenuSubContent className="min-w-[160px] p-1">
                      <DropdownMenuItem
                        className="text-sm gap-2 cursor-pointer"
                        onClick={() => { setRenameTarget(workspace); setRenameValue(workspace.name); }}
                      >
                        <Pencil className="h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      {workspace.id !== DEFAULT_WORKSPACE_ID && (
                        <DropdownMenuItem
                          className="text-sm gap-2 cursor-pointer text-destructive focus:text-destructive"
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

          <DropdownMenuSeparator />

          <DropdownMenuItem className="text-sm gap-2 py-2.5 cursor-pointer" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Criar espaço de trabalho
          </DropdownMenuItem>
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
