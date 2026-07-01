import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, User, Loader2, Lock } from "lucide-react";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function ProfileDialog({ open, onOpenChange, onUpdated }: ProfileDialogProps) {
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email || "");
      const { data: p } = await supabase
        .from("profiles")
        .select("name, email, photo_url")
        .eq("id", user.id)
        .maybeSingle();
      if (p) {
        setName(p.name || "");
        setEmail(p.email || user.email || "");
        setPhotoUrl(p.photo_url || "");
      }
      setNewPassword("");
      setConfirmPassword("");
    })();
  }, [open]);

  const uploadPhoto = async (file: File) => {
    if (!file || !userId) return;
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
      const url = data.publicUrl;
      await supabase.from("profiles").update({ photo_url: url }).eq("id", userId);
      setPhotoUrl(url);
      toast.success("Foto atualizada!");
      onUpdated?.();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao subir a foto");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ name: name.trim(), email: email.trim() })
        .eq("id", userId);
      if (pErr) throw pErr;

      if (newPassword) {
        if (newPassword.length < 6) { toast.error("A senha precisa ter ao menos 6 caracteres"); setSaving(false); return; }
        if (newPassword !== confirmPassword) { toast.error("As senhas não coincidem"); setSaving(false); return; }
        const { error: passErr } = await supabase.auth.updateUser({ password: newPassword });
        if (passErr) { toast.error(`Erro ao trocar senha: ${passErr.message}`); setSaving(false); return; }
      }

      toast.success("Perfil salvo!");
      onUpdated?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar o perfil");
    } finally {
      setSaving(false);
    }
  };

  const labelCls = "text-xs font-medium text-muted-foreground";
  const inputCls = "h-11 rounded-xl text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden gap-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Perfil</DialogTitle>

        {/* Header with avatar */}
        <div className="flex flex-col items-center gap-3 pt-8 pb-5 px-6 border-b border-border">
          <div className="relative">
            <div className="h-24 w-24 rounded-full overflow-hidden bg-muted flex items-center justify-center ring-2 ring-border">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center ring-2 ring-background hover:bg-foreground/90 transition-colors"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }}
            />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold leading-tight">{name || "Meu perfil"}</h3>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>

        {/* Fields */}
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} />
          </div>

          <div className="pt-1 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Trocar senha
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Nova senha</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Confirmar</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••" className={inputCls} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Deixe em branco para não alterar a senha.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={save} disabled={saving} className="flex-1 h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 rounded-xl">Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
