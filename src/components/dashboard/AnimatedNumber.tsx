import { useAnimatedNumber, useAnimatedCurrency } from "@/hooks/use-animated-number";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  className?: string;
  duration?: number;
}

export function AnimatedNumber({ value, className, duration = 500 }: AnimatedNumberProps) {
  const displayValue = useAnimatedNumber(value, duration);
  
  return (
    <span className={cn("tabular-nums transition-all", className)}>
      {displayValue}
    </span>
  );
}

interface AnimatedCurrencyProps {
  value: number;
  className?: string;
  duration?: number;
}

export function AnimatedCurrency({ value, className, duration = 600 }: AnimatedCurrencyProps) {
  const displayValue = useAnimatedCurrency(value, duration);
  
  return (
    <span className={cn("tabular-nums transition-all", className)}>
      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(displayValue)}
    </span>
  );
}
