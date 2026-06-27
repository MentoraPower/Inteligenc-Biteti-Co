import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, UserPlus, Mail, Lock, Briefcase, ChevronDown } from "lucide-react";
import { countries, Country, getFlagUrl } from "@/data/countries";

interface AddTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roles = [
  { value: "admin", label: "Administrador", description: "Acesso total ao sistema" },
  { value: "suporte", label: "Suporte", description: "Atendimento ao cliente" },
  { value: "gestor_trafego", label: "Gestor de Tráfego", description: "Gerencia campanhas" },
  { value: "closer", label: "Closer", description: "Fechamento de vendas" },
  { value: "sdr", label: "SDR", description: "Prospecção de leads" },
];

export function AddTeamMemberDialog({
  open,
  onOpenChange,
}: AddTeamMemberDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryButtonRef = useRef<HTMLButtonElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("");
  const queryClient = useQueryClient();

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setSelectedCountry(countries[0]);
    setCountrySearch("");
    setShowPassword(false);
    setPassword("");
    setRole("");
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        countryButtonRef.current && 
        !countryButtonRef.current.contains(event.target as Node) &&
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target as Node)
      ) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update dropdown position
  useEffect(() => {
    if (countryDropdownOpen && countryButtonRef.current) {
      const rect = countryButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
  }, [countryDropdownOpen]);

  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      country.dialCode.includes(countrySearch)
  );

  const createMember = useMutation({
    mutationFn: async () => {
      if (!name || !email || !password || !role) {
        throw new Error("Preencha todos os campos obrigatórios");
      }

      if (password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      const { data, error } = await supabase.functions.invoke("create-team-member", {
        body: { name, email, phone, password, role },
      });

      if (error) {
        let errorMessage = error.message || "Erro ao criar membro";
        const jsonMatch = errorMessage.match(/\{.*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.error) {
              errorMessage = parsed.error;
            }
          } catch {
            // Keep original error message
          }
        }
        throw new Error(errorMessage);
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro adicionado com sucesso!");
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Erro ao criar membro:", error);
      toast.error(error.message || "Erro ao criar membro");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] bg-white border-0 shadow-2xl p-0 gap-0 overflow-hidden rounded-xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div>
            <DialogTitle className="text-gray-900 text-base font-semibold">Novo membro</DialogTitle>
            <DialogDescription className="text-gray-500 text-xs mt-0.5">
              Adicione um novo membro à equipe
            </DialogDescription>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 pb-5 space-y-4">
          {/* Two columns for name and email */}
          <div className="grid grid-cols-2 gap-3">
            {/* Name field */}
            <div className="space-y-1.5">
              <Label htmlFor="member-name" className="text-xs font-medium text-gray-600">
                Nome completo
              </Label>
              <div className="relative">
                <Input
                  id="member-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite o nome"
                  className="pl-8 h-9 text-sm bg-gray-50 border-transparent rounded-lg focus:bg-white focus:border-transparent focus:ring-0 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
                />
                <UserPlus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>

            {/* Email field */}
            <div className="space-y-1.5">
              <Label htmlFor="member-email" className="text-xs font-medium text-gray-600">
                E-mail
              </Label>
              <div className="relative">
                <Input
                  id="member-email"
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

          {/* Two columns for phone and password */}
          <div className="grid grid-cols-2 gap-3">
            {/* Phone field with country selector */}
            <div className="space-y-1.5">
              <Label htmlFor="member-phone" className="text-xs font-medium text-gray-600">
                Telefone <span className="text-gray-400 font-normal">(opcional)</span>
              </Label>
              <div className="flex">
                {/* Country selector */}
                <button
                  ref={countryButtonRef}
                  type="button"
                  onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                  className="flex items-center gap-1.5 h-9 px-2 bg-gray-50 rounded-l-lg border-transparent text-sm transition-colors hover:bg-gray-100"
                >
                  <img 
                    src={getFlagUrl(selectedCountry.code)} 
                    alt={selectedCountry.name}
                    className="w-5 h-3.5 object-cover rounded-sm"
                  />
                  <span className="text-gray-600 text-xs">{selectedCountry.dialCode}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
                <Input
                  id="member-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="00000-0000"
                  className="flex-1 h-9 text-sm bg-gray-50 border-transparent rounded-l-none rounded-r-lg focus:bg-white focus:border-transparent focus:ring-0 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
                />
              </div>
              {/* Country dropdown portal */}
              {countryDropdownOpen && createPortal(
                <div 
                  ref={countryDropdownRef}
                  className="fixed w-64 max-h-72 overflow-hidden rounded-lg border border-gray-200 shadow-xl bg-white"
                  style={{ 
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                    zIndex: 99999
                  }}
                >
                  <div className="p-2 border-b border-gray-100 bg-white">
                    <input
                      type="text"
                      placeholder="Buscar país..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full h-8 px-3 rounded-md bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto bg-white">
                    {filteredCountries.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => {
                          setSelectedCountry(country);
                          setCountryDropdownOpen(false);
                          setCountrySearch("");
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gray-50 ${
                          selectedCountry.code === country.code ? 'bg-gray-50' : ''
                        }`}
                      >
                        <img 
                          src={getFlagUrl(country.code)} 
                          alt={country.name}
                          className="w-5 h-3.5 object-cover rounded-sm"
                        />
                        <span className="text-sm text-gray-900 flex-1 truncate">{country.name}</span>
                        <span className="text-xs text-gray-500">{country.dialCode}</span>
                      </button>
                    ))}
                  </div>
                </div>,
                document.body
              )}
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <Label htmlFor="member-password" className="text-xs font-medium text-gray-600">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="member-password"
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
          </div>

          {/* Role field - full width */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Função</Label>
            <div className="relative">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="pl-8 h-9 text-sm bg-gray-50 border-transparent rounded-lg focus:bg-white focus:border-transparent focus:ring-0 focus:outline-none transition-all text-gray-900">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 rounded-lg shadow-xl">
                  {roles.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="py-2 text-sm rounded-md focus:bg-gray-50">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{r.label}</span>
                        <span className="text-xs text-gray-500">{r.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
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
            onClick={() => createMember.mutate()}
            disabled={createMember.isPending}
            className="flex-1 h-9 text-sm rounded-lg bg-gray-900 hover:bg-gray-800 text-white"
          >
            {createMember.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              "Adicionar membro"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
