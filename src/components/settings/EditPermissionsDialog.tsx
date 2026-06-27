import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail, Lock, Briefcase, User } from "lucide-react";

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  user_id: string;
  permissions?: {
    can_create_origins: boolean;
    can_create_sub_origins: boolean;
    allowed_origin_ids: string[];
    allowed_sub_origin_ids: string[];
  } | null;
}

interface EditPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
}

const roles = [
  { value: "admin", label: "Administrador" },
  { value: "suporte", label: "Suporte" },
  { value: "gestor_trafego", label: "Gestor de Tráfego" },
  { value: "closer", label: "Closer" },
  { value: "sdr", label: "SDR" },
];

export function EditPermissionsDialog({
  open,
  onOpenChange,
  member,
}: EditPermissionsDialogProps) {
  const [name, setName] = useState(member.name || "");
  const [email, setEmail] = useState(member.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(member.role || "");
  const [canCreateOrigins, setCanCreateOrigins] = useState(false);
  const [canCreateSubOrigins, setCanCreateSubOrigins] = useState(false);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [selectedSubOrigins, setSelectedSubOrigins] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Initialize state from member
  useEffect(() => {
    setName(member.name || "");
    setEmail(member.email || "");
    setPassword("");
    setRole(member.role || "");
    if (member.permissions) {
      setCanCreateOrigins(member.permissions.can_create_origins ?? false);
      setCanCreateSubOrigins(member.permissions.can_create_sub_origins ?? false);
      setSelectedOrigins(member.permissions.allowed_origin_ids);
      setSelectedSubOrigins(member.permissions.allowed_sub_origin_ids);
    } else {
      setCanCreateOrigins(false);
      setCanCreateSubOrigins(false);
      setSelectedOrigins([]);
      setSelectedSubOrigins([]);
    }
  }, [member]);

  // Fetch origins
  const { data: origins } = useQuery({
    queryKey: ["crm-origins-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_origins")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  // Fetch sub-origins
  const { data: subOrigins } = useQuery({
    queryKey: ["crm-sub-origins-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_sub_origins")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  // Save member data and permissions via edge function (admin-only)
  const saveMember = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      if (!trimmedName) throw new Error("Nome é obrigatório");
      if (!trimmedEmail) throw new Error("E-mail é obrigatório");
      if (!role) throw new Error("Selecione a função");

      // Validate password if provided
      if (password && password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      const { data, error } = await supabase.functions.invoke("update-team-member", {
        body: {
          user_id: member.user_id,
          name: trimmedName,
          email: trimmedEmail,
          password: password || undefined,
          role,
          can_create_origins: canCreateOrigins,
          can_create_sub_origins: canCreateSubOrigins,
          allowed_origin_ids: selectedOrigins,
          allowed_sub_origin_ids: selectedSubOrigins,
        },
      });

      if (error) {
        let msg = error.message || "Erro ao salvar";
        const jsonMatch = msg.match(/\{.*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.error) msg = parsed.error;
          } catch {
            // ignore
          }
        }
        throw new Error(msg);
      }

      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro atualizado!");
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Erro ao salvar:", error);
      toast.error(error.message || "Erro ao salvar alterações");
    },
  });

  const toggleOrigin = (originId: string) => {
    setSelectedOrigins((prev) =>
      prev.includes(originId)
        ? prev.filter((id) => id !== originId)
        : [...prev, originId]
    );
  };

  const toggleSubOrigin = (subOriginId: string) => {
    setSelectedSubOrigins((prev) =>
      prev.includes(subOriginId)
        ? prev.filter((id) => id !== subOriginId)
        : [...prev, subOriginId]
    );
  };

  // Filter sub-origins based on selected origins
  const filteredSubOrigins = subOrigins?.filter((so) =>
    selectedOrigins.includes(so.origin_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] bg-white border-0 shadow-2xl p-0 gap-0 overflow-hidden rounded-xl max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div>
            <DialogTitle className="text-gray-900 text-base font-semibold">Editar membro</DialogTitle>
            <DialogDescription className="text-gray-500 text-xs mt-0.5">
              {member.name || member.email}
            </DialogDescription>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 pb-5 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Two columns for name and email */}
          <div className="grid grid-cols-2 gap-3">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs font-medium text-gray-600">Nome</Label>
              <div className="relative">
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do membro"
                  className="pl-8 h-9 text-sm bg-gray-50 border-transparent rounded-lg focus:bg-white focus:border-transparent focus:ring-0 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
                />
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs font-medium text-gray-600">E-mail</Label>
              <div className="relative">
                <Input
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="pl-8 h-9 text-sm bg-gray-50 border-transparent rounded-lg focus:bg-white focus:border-transparent focus:ring-0 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
                />
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Two columns for password and role */}
          <div className="grid grid-cols-2 gap-3">
            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-password" className="text-xs font-medium text-gray-600">
                Nova senha <span className="text-gray-400 font-normal">(opcional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="pl-8 pr-8 h-9 text-sm bg-gray-50 border-transparent rounded-lg focus:bg-white focus:border-transparent focus:ring-0 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
                />
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-gray-100 rounded-md"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Função</Label>
              <div className="relative">
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="pl-8 h-9 text-sm bg-gray-50 border-transparent rounded-lg focus:bg-white focus:border-transparent focus:ring-0 focus:outline-none transition-all text-gray-900">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 rounded-lg shadow-xl">
                    {roles.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-sm rounded-md focus:bg-gray-50">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Show permissions only for non-admin roles */}
          {role !== "admin" && (
            <>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-600 mb-3">Permissões</p>

                {/* Permission switches in a grid */}
                <div className="grid grid-cols-1 gap-2">
                  {/* Create Origins Permission */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                    <div>
                      <Label className="font-medium text-xs text-gray-700">Criar Origens</Label>
                      <p className="text-[10px] text-gray-500">
                        Permite criar novas origens no CRM
                      </p>
                    </div>
                    <Switch
                      checked={canCreateOrigins}
                      onCheckedChange={setCanCreateOrigins}
                      className="scale-90"
                    />
                  </div>

                  {/* Create Sub-Origins Permission */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                    <div>
                      <Label className="font-medium text-xs text-gray-700">Criar Sub-origens</Label>
                      <p className="text-[10px] text-gray-500">
                        Permite criar novas sub-origens no CRM
                      </p>
                    </div>
                    <Switch
                      checked={canCreateSubOrigins}
                      onCheckedChange={setCanCreateSubOrigins}
                      className="scale-90"
                    />
                  </div>
                </div>
              </div>

              {/* Origins Access */}
              <div className="space-y-2">
                <Label className="font-medium text-xs text-gray-600">Origens CRM</Label>
                <p className="text-[10px] text-gray-500">
                  Selecione as origens que o membro pode acessar
                </p>
                <div className="space-y-1.5 p-2.5 rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
                  {origins?.map((origin) => (
                    <div
                      key={origin.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`origin-${origin.id}`}
                        checked={selectedOrigins.includes(origin.id)}
                        onCheckedChange={() => toggleOrigin(origin.id)}
                        className="h-3.5 w-3.5"
                      />
                      <label
                        htmlFor={`origin-${origin.id}`}
                        className="text-xs text-gray-700 cursor-pointer"
                      >
                        {origin.nome}
                      </label>
                    </div>
                  ))}
                  {(!origins || origins.length === 0) && (
                    <p className="text-xs text-gray-500">
                      Nenhuma origem cadastrada
                    </p>
                  )}
                </div>
              </div>

              {/* Sub-Origins Access */}
              {selectedOrigins.length > 0 && (
                <div className="space-y-2">
                  <Label className="font-medium text-xs text-gray-600">Sub-origens CRM</Label>
                  <p className="text-[10px] text-gray-500">
                    Selecione as sub-origens que o membro pode acessar
                  </p>
                  <div className="space-y-1.5 p-2.5 rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
                    {filteredSubOrigins?.map((subOrigin) => {
                      const origin = origins?.find(
                        (o) => o.id === subOrigin.origin_id
                      );
                      return (
                        <div
                          key={subOrigin.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`suborigin-${subOrigin.id}`}
                            checked={selectedSubOrigins.includes(subOrigin.id)}
                            onCheckedChange={() => toggleSubOrigin(subOrigin.id)}
                            className="h-3.5 w-3.5"
                          />
                          <label
                            htmlFor={`suborigin-${subOrigin.id}`}
                            className="text-xs text-gray-700 cursor-pointer"
                          >
                            {origin?.nome} → {subOrigin.nome}
                          </label>
                        </div>
                      );
                    })}
                    {(!filteredSubOrigins || filteredSubOrigins.length === 0) && (
                      <p className="text-xs text-gray-500">
                        Nenhuma sub-origem disponível
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-9 text-sm rounded-lg border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => saveMember.mutate()}
            disabled={saveMember.isPending}
            className="flex-1 h-9 text-sm rounded-lg bg-gray-900 hover:bg-gray-800 text-white"
          >
            {saveMember.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
