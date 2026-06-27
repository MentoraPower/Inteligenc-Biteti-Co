import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      gap={12}
      icons={{
        success: null,
        error: null,
        warning: null,
        info: null,
        loading: null,
      }}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-neutral-900/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-white group-[.toaster]:border-none group-[.toaster]:shadow-[0_8px_32px_rgba(0,0,0,0.25)] group-[.toaster]:rounded-xl group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:font-medium group-[.toaster]:text-sm group-[.toaster]:tracking-tight group-[.toaster]:overflow-hidden group-[.toaster]:relative",
          description: "group-[.toast]:text-neutral-300 group-[.toast]:text-xs",
          actionButton: "group-[.toast]:bg-white group-[.toast]:text-neutral-900 group-[.toast]:rounded-lg group-[.toast]:text-xs group-[.toast]:font-semibold",
          cancelButton: "group-[.toast]:bg-neutral-800 group-[.toast]:text-neutral-300 group-[.toast]:rounded-lg group-[.toast]:text-xs",
          error: "group-[.toaster]:bg-neutral-900/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-white group-[.toaster]:border-none",
          success: "group-[.toaster]:bg-neutral-900/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-white group-[.toaster]:border-none",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
