import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnimatePresence } from 'framer-motion';
import { WorkspaceLoadingOverlay } from '@/components/workspace/WorkspaceLoadingOverlay';

interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  isSwitching: boolean;
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  refetchWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

const WORKSPACE_STORAGE_KEY = 'current_workspace_id';

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setIsLoading(false);
        return;
      }

      // Get workspaces where user is a member
      const { data: memberData } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id);

      if (!memberData || memberData.length === 0) {
        // User has no workspaces, try to add them to the default workspace.
        // (Our workspaces SELECT policy requires membership, so we must join first.)
        const defaultWorkspaceId = '00000000-0000-0000-0000-000000000001';

        const { error: joinError } = await supabase.from('workspace_members').insert({
          workspace_id: defaultWorkspaceId,
          user_id: user.id,
          role: 'member'
        });

        if (joinError) {
          console.warn('Could not join default workspace:', joinError);
        }

        const { data: defaultWs } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', defaultWorkspaceId)
          .maybeSingle();

        if (defaultWs) {
          setWorkspaces([defaultWs]);
          setCurrentWorkspace(defaultWs);
          localStorage.setItem(WORKSPACE_STORAGE_KEY, defaultWs.id);
        } else {
          setWorkspaces([]);
          setCurrentWorkspace(null);
        }

        setIsLoading(false);
        return;
      }

      const workspaceIds = memberData.map(m => m.workspace_id);
      
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds)
        .order('created_at', { ascending: true });

      if (wsData) {
        setWorkspaces(wsData);
        
        // Restore last selected workspace or use first one
        const savedId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
        const savedWorkspace = wsData.find(w => w.id === savedId);
        const selected = savedWorkspace || wsData[0];
        
        if (selected) {
          setCurrentWorkspace(selected);
          localStorage.setItem(WORKSPACE_STORAGE_KEY, selected.id);
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setIsLoading(false);
      // Clear the native loading overlay after workspaces are loaded
      sessionStorage.removeItem('workspace_switching');
      const nativeOverlay = document.getElementById('workspace-loading-overlay');
      if (nativeOverlay) nativeOverlay.style.display = 'none';
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchWorkspaces();
    });

    return () => subscription.unsubscribe();
  }, [fetchWorkspaces]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (workspace && workspace.id !== currentWorkspace?.id) {
      setIsSwitching(true);
      setCurrentWorkspace(workspace);
      localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
      localStorage.removeItem('crm_last_sub_origin');
      // Set flag so the native overlay shows immediately on reload
      sessionStorage.setItem('workspace_switching', 'true');
      // Show native overlay now
      const nativeOverlay = document.getElementById('workspace-loading-overlay');
      if (nativeOverlay) nativeOverlay.style.display = 'flex';
      // Small delay then reload
      setTimeout(() => {
        window.location.href = '/crm';
      }, 150);
    }
  }, [workspaces, currentWorkspace]);

  const createWorkspace = useCallback(async (name: string): Promise<Workspace | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Create workspace (avoid RETURNING/select before membership exists, due to RLS)
      const workspaceId = crypto.randomUUID();

      const { error: wsError } = await supabase
        .from('workspaces')
        .insert({ id: workspaceId, name, created_by: user.id });

      if (wsError) {
        console.error('Error creating workspace:', wsError);
        return null;
      }

      // Add creator as owner first
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          role: 'owner'
        });

      if (memberError) {
        console.error('Error adding member:', memberError);
        return null;
      }

      // Get all members from the default workspace and add them to the new workspace
      const defaultWorkspaceId = '00000000-0000-0000-0000-000000000001';
      const { data: defaultMembers } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', defaultWorkspaceId)
        .neq('user_id', user.id); // Exclude creator (already added as owner)

      if (defaultMembers && defaultMembers.length > 0) {
        const newMembers = defaultMembers.map(m => ({
          workspace_id: workspaceId,
          user_id: m.user_id,
          role: 'member'
        }));

        const { error: bulkError } = await supabase
          .from('workspace_members')
          .insert(newMembers);

        if (bulkError) {
          console.warn('Error adding other members:', bulkError);
        }
      }

      // Now that membership exists, we can SELECT the workspace row
      const { data: newWorkspace, error: fetchError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (fetchError || !newWorkspace) {
        console.error('Error fetching created workspace:', fetchError);
        return null;
      }

      // Add to list and select immediately
      setWorkspaces(prev => [...prev, newWorkspace]);
      setCurrentWorkspace(newWorkspace);
      localStorage.setItem(WORKSPACE_STORAGE_KEY, newWorkspace.id);
      
      // Show loading and reload
      setIsSwitching(true);
      sessionStorage.setItem('workspace_switching', 'true');
      const nativeOverlay = document.getElementById('workspace-loading-overlay');
      if (nativeOverlay) nativeOverlay.style.display = 'flex';
      setTimeout(() => {
        window.location.href = '/crm';
      }, 150);
      
      return newWorkspace;
    } catch (error) {
      console.error('Error creating workspace:', error);
      return null;
    }
  }, []);

  const refetchWorkspaces = useCallback(async () => {
    await fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      currentWorkspace,
      isLoading,
      isSwitching,
      switchWorkspace,
      createWorkspace,
      refetchWorkspaces
    }}>
      <AnimatePresence>
        {isSwitching && <WorkspaceLoadingOverlay />}
      </AnimatePresence>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
