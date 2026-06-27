import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton = ({ className, style }: SkeletonProps) => (
  <div
    className={cn(
      "animate-pulse rounded-lg bg-gradient-to-r from-muted via-muted/70 to-muted bg-[length:200%_100%]",
      className
    )}
    style={{
      animation: "shimmer 1.5s ease-in-out infinite",
      ...style,
    }}
  />
);

export const CardSkeleton = () => (
  <div className="bg-card border border-border/50 rounded-xl p-5">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton className="h-10 w-10 rounded-xl" />
    </div>
  </div>
);

export const ChartSkeleton = ({ height = "300px" }: { height?: string }) => (
  <div className="bg-card border border-border/50 rounded-xl p-6">
    <div className="space-y-2 mb-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
    <div className="relative" style={{ height }}>
      <div className="absolute inset-0 flex items-end justify-between gap-2 px-4">
        {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  </div>
);

export const GaugeSkeleton = () => (
  <div className="bg-card border border-border/50 rounded-xl p-6">
    <div className="space-y-2 mb-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative w-40 h-20">
        <Skeleton className="absolute inset-0 rounded-t-full" />
      </div>
      <Skeleton className="h-4 w-24 mt-4" />
      <Skeleton className="h-3 w-20 mt-2" />
    </div>
  </div>
);

export const AreaChartSkeleton = () => (
  <div className="bg-card border border-border/50 rounded-xl p-6 lg:col-span-2">
    <div className="space-y-2 mb-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
    <div className="h-[300px] relative">
      <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="skeletonGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,150 Q50,140 100,120 T200,100 T300,80 T400,90 L400,200 L0,200 Z"
          fill="url(#skeletonGradient)"
          className="animate-pulse"
        />
        <path
          d="M0,150 Q50,140 100,120 T200,100 T300,80 T400,90"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="2"
          className="animate-pulse"
        />
      </svg>
    </div>
  </div>
);

// Add shimmer animation to index.css or here
const shimmerStyle = `
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = shimmerStyle;
  document.head.appendChild(styleSheet);
}
