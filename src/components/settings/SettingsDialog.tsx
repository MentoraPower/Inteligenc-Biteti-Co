import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Bell, Shield, Palette, HelpCircle, ChevronRight, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = "profile" | "notifications" | "security" | "appearance" | "integrations" | "help";

const menuItems: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Perfil", icon: User },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "security", label: "Segurança", icon: Shield },
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "integrations", label: "API e integrações", icon: Plug },
  { id: "help", label: "Ajuda", icon: HelpCircle },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      return { profile: data, user };
    },
    enabled: open,
  });

  useEffect(() => {
    if (profile?.profile) {
      setName(profile.profile.name || "");
      setEmail(profile.profile.email || profile.user?.email || "");
    } else if (profile?.user) {
      setEmail(profile.user.email || "");
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não encontrado");

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          name,
          email,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Perfil atualizado com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao atualizar perfil:", error);
      toast.error("Erro ao atualizar perfil");
    },
  });

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Perfil</h2>
              <p className="text-sm text-muted-foreground">Gerencie suas informações pessoais</p>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted border border-border">
              <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">{name || "Usuário"}</p>
                <p className="text-sm text-muted-foreground">{email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="bg-card border-border focus:border-primary focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled
                  className="bg-muted border-border"
                />
                <p className="text-xs text-muted-foreground">
                  O e-mail não pode ser alterado
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-border text-foreground hover:bg-accent"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => updateProfile.mutate()}
                disabled={updateProfile.isPending || isLoading}
                className="bg-foreground hover:bg-foreground/90 text-background"
              >
                {updateProfile.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        );
      case "notifications":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Notificações</h2>
              <p className="text-sm text-muted-foreground">Configure como você recebe notificações</p>
            </div>
            <div className="flex items-center justify-center h-40 rounded-xl bg-muted text-muted-foreground">
              Em breve
            </div>
          </div>
        );
      case "security":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Segurança</h2>
              <p className="text-sm text-muted-foreground">Gerencie sua senha e autenticação</p>
            </div>
            <div className="flex items-center justify-center h-40 rounded-xl bg-muted text-muted-foreground">
              Em breve
            </div>
          </div>
        );
      case "appearance":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Aparência</h2>
              <p className="text-sm text-muted-foreground">Personalize a interface do sistema</p>
            </div>
            <div className="flex items-center justify-center h-40 rounded-xl bg-muted text-muted-foreground">
              Em breve
            </div>
          </div>
        );
      case "integrations":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">API e integrações</h2>
              <p className="text-sm text-muted-foreground">Conecte serviços externos e gerencie APIs</p>
            </div>
            <div className="flex items-center justify-center h-40 rounded-xl bg-muted text-muted-foreground">
              Em breve
            </div>
          </div>
        );
      case "help":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Ajuda</h2>
              <p className="text-sm text-muted-foreground">Suporte e documentação</p>
            </div>
            <div className="flex items-center justify-center h-40 rounded-xl bg-muted text-muted-foreground">
              Em breve
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[850px] p-0 gap-0 overflow-hidden bg-card">
        <DialogTitle className="sr-only">Configurações</DialogTitle>
        
        <div className="flex h-[700px]">
          {/* Sidebar Menu */}
          <div className="w-[200px] bg-muted p-3 flex flex-col gap-1 border-r border-border">
            <div className="px-2 py-3 mb-2">
              <h3 className="text-sm font-semibold text-foreground">Configurações</h3>
            </div>
            
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left",
                  activeTab === item.id
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {activeTab === item.id && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-card">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}