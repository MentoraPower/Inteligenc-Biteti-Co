import { memo, useState } from "react";
import { FileText, Image, FileSpreadsheet, File, Download, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilePreviewProps {
  url: string;
  className?: string;
}

function getFileInfo(url: string) {
  const ext = url.split(".").pop()?.split("?")[0]?.toLowerCase() || "";
  
  const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
  const pdfExts = ["pdf"];
  const docExts = ["doc", "docx"];
  const sheetExts = ["xls", "xlsx", "csv"];
  const presentationExts = ["ppt", "pptx"];
  
  if (imageExts.includes(ext)) return { type: "image" as const, ext, label: ext.toUpperCase() };
  if (pdfExts.includes(ext)) return { type: "pdf" as const, ext, label: "PDF" };
  if (docExts.includes(ext)) return { type: "doc" as const, ext, label: ext.toUpperCase() };
  if (sheetExts.includes(ext)) return { type: "sheet" as const, ext, label: ext.toUpperCase() };
  if (presentationExts.includes(ext)) return { type: "presentation" as const, ext, label: ext.toUpperCase() };
  return { type: "other" as const, ext, label: ext.toUpperCase() || "ARQUIVO" };
}

function FileIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "image": return <Image className={cn("text-blue-500", className)} />;
    case "pdf": return <FileText className={cn("text-red-500", className)} />;
    case "doc": return <FileText className={cn("text-blue-600", className)} />;
    case "sheet": return <FileSpreadsheet className={cn("text-green-600", className)} />;
    case "presentation": return <FileText className={cn("text-orange-500", className)} />;
    default: return <File className={cn("text-muted-foreground", className)} />;
  }
}

export const FilePreview = memo(function FilePreview({ url, className }: FilePreviewProps) {
  const [showLightbox, setShowLightbox] = useState(false);
  const info = getFileInfo(url);
  
  const isImage = info.type === "image";

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        {isImage ? (
          <button
            onClick={() => setShowLightbox(true)}
            className="group relative w-full"
          >
            <img
              src={url}
              alt="Comprovante"
              className="h-16 w-16 object-cover rounded-lg border border-border cursor-pointer transition-opacity group-hover:opacity-80"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Eye className="h-5 w-5 text-white drop-shadow-lg" />
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted/50 border border-border flex-shrink-0">
              <FileIcon type={info.type} className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-foreground">{info.label}</span>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
              title="Baixar arquivo"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        )}
      </div>

      {/* Lightbox for images */}
      {showLightbox && isImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          <img
            src={url}
            alt="Comprovante"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
            Baixar
          </a>
        </div>
      )}
    </>
  );
});
