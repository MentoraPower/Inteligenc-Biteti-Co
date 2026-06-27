import { useEffect, useRef } from "react";

interface GaugeChartProps {
  value: number;
  maxValue: number;
  label: string;
  sublabel?: string;
}

const GaugeChart = ({ value, maxValue, label, sublabel }: GaugeChartProps) => {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const angle = (percentage / 100) * 180; // 180 degrees for semicircle

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative w-40 h-20">
        {/* Background arc */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 50"
          preserveAspectRatio="xMidYMax meet"
        >
          {/* Background track */}
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 141.37} 141.37`}
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--primary-dark))" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
          <span className="text-3xl font-bold text-foreground">{value}</span>
        </div>
      </div>
      
      {/* Labels */}
      <p className="text-sm text-muted-foreground mt-2">{label}</p>
      {sublabel && (
        <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
      )}
    </div>
  );
};

export default GaugeChart;
