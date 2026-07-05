import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Public page — no auth. Shows "Estamos baixando..." and auto-downloads the ebook PDF.
export default function EbookDownload() {
  const { id } = useParams();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [url, setUrl] = useState("");

  const startDownload = (fileUrl: string, fileName?: string | null) => {
    const dl = fileUrl + (fileUrl.includes("?") ? "&" : "?") + "download=" + encodeURIComponent(fileName || "ebook.pdf");
    const a = document.createElement("a");
    a.href = dl;
    a.download = fileName || "ebook.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  useEffect(() => {
    (async () => {
      if (!id) { setStatus("error"); return; }
      const { data, error } = await (supabase as any)
        .from("ebooks")
        .select("file_url, file_name")
        .eq("id", id)
        .maybeSingle();
      if (error || !data?.file_url) { setStatus("error"); return; }
      setUrl(data.file_url);
      setStatus("ready");
      startDownload(data.file_url, data.file_name);
    })();
  }, [id]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-zinc-900 p-6 text-center">
      {status === "error" ? (
        <>
          <h1 className="text-2xl font-bold">Ebook não encontrado</h1>
          <p className="text-zinc-500 mt-2">Verifique o link e tente novamente.</p>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin mb-6" />
          <h1 className="text-2xl font-bold">Estamos baixando seu ebook…</h1>
          <p className="text-zinc-500 mt-2">
            O download vai começar automaticamente.{" "}
            {url && (
              <>
                Se não iniciar,{" "}
                <a href={url + (url.includes("?") ? "&" : "?") + "download="} className="text-purple-600 underline font-medium">
                  clique aqui
                </a>
                .
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
