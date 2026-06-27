import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import DotShaderBackground from "@/components/DotShaderBackground";
const loginSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(128, "Senha muito longa")
});
const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
      setIsCheckingAuth(false);
    };
    checkAuth();

    // Listen for auth changes
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    const validation = loginSchema.safeParse({
      email,
      password
    });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    setIsLoading(true);
    try {
      const {
        error
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email ou senha incorretos");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Email não confirmado. Verifique sua caixa de entrada.");
        } else {
          toast.error("Erro ao fazer login. Tente novamente.");
        }
        return;
      }
      toast.success("Login realizado com sucesso!");
      navigate("/");
    } catch (err) {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };
  if (isCheckingAuth) {
    return <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>;
  }
  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      <DotShaderBackground 
        bgColor="#0a0a0a" 
        dotColor="#FFFFFF" 
        gridSize={80} 
        dotOpacity={0.1}
      />
      <div className="w-full max-w-md relative z-10">
        {/* White Card Container */}
        <div className="bg-[#f5f5f5] rounded-3xl p-10 shadow-2xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mb-2">Acesse sua conta</h1>
            <p className="text-neutral-500 text-sm leading-relaxed">
              Se você já possui uma conta, preencha seus dados de acesso à plataforma.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-700 text-sm font-medium">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="contato@email.com.br" 
                className="bg-transparent border-0 border-b border-neutral-300 rounded-none text-neutral-900 placeholder:text-neutral-400 focus:ring-0 focus:border-neutral-900 h-12 px-0 transition-all duration-200" 
                disabled={isLoading} 
                autoComplete="email" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-700 text-sm font-medium">Senha</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••••••" 
                  className="bg-transparent border-0 border-b border-neutral-300 rounded-none text-neutral-900 placeholder:text-neutral-400 focus:ring-0 focus:border-neutral-900 h-12 px-0 pr-10 transition-all duration-200" 
                  disabled={isLoading} 
                  autoComplete="current-password" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isLoading} 
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-medium h-14 rounded-xl transition-all duration-200 hover:shadow-lg mt-4"
            >
              {isLoading ? "Entrando..." : "Acessar sua conta"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default Auth;