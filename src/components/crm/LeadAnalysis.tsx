import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeadData {
  id: string;
  name: string;
  clinic_name: string | null;
  service_area: string;
  years_experience: string;
  workspace_type: string;
  monthly_billing: string;
  weekly_attendance: string;
  average_ticket: number | null;
  estimated_revenue: number | null;
  can_afford: string | null;
  wants_more_info: boolean | null;
  ai_analysis?: string | null;
  is_mql?: boolean | null;
  analysis_created_at?: string | null;
}

interface LeadAnalysisProps {
  lead: LeadData;
}

interface AnalysisResponse {
  analysis: string;
  isMQL?: boolean;
  estimatedRevenue?: number;
}

export function LeadAnalysis({ lead }: LeadAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(lead.ai_analysis || null);
  const [isMQL, setIsMQL] = useState<boolean | null>(lead.is_mql ?? null);
  const [estimatedRevenue, setEstimatedRevenue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(!!lead.ai_analysis);

  // Calculate estimated revenue locally
  const calculateEstimatedRevenue = () => {
    if (lead.estimated_revenue) return lead.estimated_revenue;
    const weeklyAttendance = parseInt(lead.weekly_attendance) || 0;
    const averageTicket = lead.average_ticket || 0;
    return weeklyAttendance * 4 * averageTicket;
  };

  useEffect(() => {
    // If analysis already exists, use it
    if (lead.ai_analysis) {
      setAnalysis(lead.ai_analysis);
      setIsMQL(lead.is_mql ?? null);
      setEstimatedRevenue(calculateEstimatedRevenue());
      setHasLoaded(true);
      return;
    }

    // Otherwise, fetch analysis only once on mount
    fetchAnalysis();
  }, [lead.id]);

  const fetchAnalysis = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-lead-profile', {
        body: lead
      });

      if (error) {
        console.error("Error fetching analysis:", error);
        setAnalysis("*Erro ao carregar analise* - Tente novamente mais tarde.");
        setIsMQL(null);
      } else {
        const response = data as AnalysisResponse;
        setAnalysis(response.analysis);
        setIsMQL(response.isMQL ?? null);
        setEstimatedRevenue(response.estimatedRevenue ?? calculateEstimatedRevenue());

        // Save analysis to database
        await supabase
          .from("leads")
          .update({
            ai_analysis: response.analysis,
            is_mql: response.isMQL ?? null,
            estimated_revenue: response.estimatedRevenue ?? calculateEstimatedRevenue(),
            analysis_created_at: new Date().toISOString()
          })
          .eq("id", lead.id);
      }
    } catch (err) {
      console.error("Error:", err);
      setAnalysis("*Erro ao carregar analise* - Tente novamente mais tarde.");
      setIsMQL(null);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  };

  const handleRefresh = async () => {
    // Force regenerate analysis
    setAnalysis(null);
    setIsMQL(null);
    setHasLoaded(false);
    await fetchAnalysis();
  };

  // Function to render text with bold formatting
  const renderFormattedText = (text: string) => {
    const parts = text.split(/\*([^*]+)\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} className="font-semibold">{part}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2 
    });
  };

  const displayEstimatedRevenue = estimatedRevenue ?? calculateEstimatedRevenue();

  return (
    <Card className="border-[#00000010] shadow-none bg-gradient-to-br from-muted/20 to-muted/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Análise do Lead</h3>
          </div>
        </div>

        {/* Faturamento estimado */}
        {hasLoaded && displayEstimatedRevenue > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground">
              Faturamento estimado: {formatCurrency(displayEstimatedRevenue)}/mês
            </span>
          </div>
        )}

        {isLoading && !hasLoaded ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : analysis ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {renderFormattedText(analysis)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Análise não disponível
          </p>
        )}
      </CardContent>
    </Card>
  );
}
