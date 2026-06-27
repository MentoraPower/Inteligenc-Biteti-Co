import { useState, useEffect } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function WorkspaceDropdown() {
  const { workspaces, currentWorkspace, switchWorkspace, createWorkspace, isLoading } = useWorkspace();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    
    setIsCreating(true);
    await createWorkspace(newWorkspaceName.trim());
    setIsCreating(false);
    setIsCreateDialogOpen(false);
    setNewWorkspaceName('');
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
          <button className="h-7 flex items-center gap-2 px-2 ml-3 rounded bg-black/10 dark:bg-white/10 transition-colors outline-none hover:bg-black/15 dark:hover:bg-white/15">
            <div className="h-5 w-5 rounded-[4px] bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-semibold text-white">
                {getInitials(displayName)}
              </span>
            </div>
            <span className="text-xs font-bold text-foreground">{displayName}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 bg-popover border border-border">
          <div className="px-2 py-1.5 mb-1">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-sidebar-accent">
              <div className="h-5 w-5 rounded-[4px] bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-semibold text-white">
                  {currentWorkspace ? getInitials(currentWorkspace.name) : 'WS'}
                </span>
              </div>
              <span className="text-sm font-medium">{currentWorkspace?.name || 'Workspace'}</span>
            </div>
          </div>
          <DropdownMenuSeparator />
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => switchWorkspace(workspace.id)}
              className="flex items-center gap-2"
            >
              <div className="h-5 w-5 rounded-[4px] bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-semibold text-white">
                  {getInitials(workspace.name)}
                </span>
              </div>
              <span className="flex-1">{workspace.name}</span>
              {currentWorkspace?.id === workspace.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar espaço de trabalho
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
            <Button 
              onClick={handleCreateWorkspace} 
              disabled={!newWorkspaceName.trim() || isCreating}
            >
              {isCreating ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
