import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, PhoneOff, UserCheck, Webhook, Globe, ChevronDown, ChevronUp, ArrowRight, ListOrdered, MoveRight, UserPlus, FileText, Users, FolderSync, UserPlus2, UserMinus2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";


interface TrackingEvent {
  id: string;
  lead_id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  origem: string | null;
  dados: unknown;
  created_at: string;
}

interface UTMData {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
}

interface OtherOriginLead {
  id: string;
  name: string;
  sub_origin_id: string | null;
  sub_origin_name: string;
  origin_name: string;
  pipeline_name: string | null;
  created_at: string;
}

interface LeadTrackingTimelineProps {
  leadId: string;
  utmData: UTMData;
  leadEmail?: string;
  leadWhatsapp?: string;
}

const getIconForType = (tipo: string) => {
  switch (tipo) {
    case "chamada_recusada":
      return <PhoneOff className="h-5 w-5" />;
    case "mudou_usuario":
      return <UserCheck className="h-5 w-5" />;
    case "webhook":
      return <Webhook className="h-5 w-5" />;
    case "mudou_pipeline":
      return <MoveRight className="h-5 w-5" />;
    case "mudou_posicao":
      return <ListOrdered className="h-5 w-5" />;
    case "mudou_origem":
      return <FolderSync className="h-5 w-5" />;
    case "cadastro":
      return <UserPlus className="h-5 w-5" />;
    case "formulario":
      return <FileText className="h-5 w-5" />;
    case "grupo_entrada":
      return <UserPlus2 className="h-5 w-5" />;
    case "grupo_saida":
      return <UserMinus2 className="h-5 w-5" />;
    default:
      return <ListOrdered className="h-5 w-5" />;
  }
};

const getIconColors = (): { bg: string; text: string } => {
  return { bg: "bg-muted dark:bg-[#1f1f1f]", text: "text-muted-foreground" };
};

export function LeadTrackingTimeline({ leadId, utmData, leadEmail, leadWhatsapp }: LeadTrackingTimelineProps) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [otherOriginLeads, setOtherOriginLeads] = useState<OtherOriginLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  useEffect(() => {
    // Validate leadId before creating realtime channel
    if (!leadId || leadId === 'null' || leadId === 'undefined') {
      console.warn('[LeadTracking] Invalid leadId, skipping subscription');
      return;
    }

    fetchEvents();
    fetchOtherOriginLeads();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`lead-tracking-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lead_tracking',
          filter: `lead_id=eq.${leadId}`
        },
        (payload) => {
          const newEvent = payload.new as TrackingEvent;
          // Add new event at the beginning (most recent first)
          setEvents(prev => {
            // Check if already exists
            if (prev.some(e => e.id === newEvent.id)) return prev;
            return [newEvent, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lead_tracking',
          filter: `lead_id=eq.${leadId}`
        },
        (payload) => {
          const updatedEvent = payload.new as TrackingEvent;
          setEvents(prev => prev.map(e => 
            e.id === updatedEvent.id ? updatedEvent : e
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'lead_tracking',
          filter: `lead_id=eq.${leadId}`
        },
        (payload) => {
          const deletedEvent = payload.old as TrackingEvent;
          setEvents(prev => prev.filter(e => e.id !== deletedEvent.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, leadEmail, leadWhatsapp]);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from("lead_tracking")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tracking events:", error);
    } else {
      setEvents(data || []);
    }
    setIsLoading(false);
  };

  const fetchOtherOriginLeads = async () => {
    if (!leadEmail && !leadWhatsapp) return;

    // Build query to find leads with same email or whatsapp but different ID
    let query = supabase
      .from("leads")
      .select(`
        id,
        name,
        sub_origin_id,
        pipeline_id,
        created_at,
        crm_sub_origins!inner (
          id,
          nome,
          crm_origins!inner (
            nome
          )
        ),
        pipelines (
          nome
        )
      `)
      .neq("id", leadId);

    // Check for email match (excluding temp emails)
    if (leadEmail && !leadEmail.includes("incompleto_") && !leadEmail.includes("@temp.com")) {
      query = query.eq("email", leadEmail);
    } else if (leadWhatsapp) {
      query = query.eq("whatsapp", leadWhatsapp);
    } else {
      return;
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching other origin leads:", error);
      return;
    }

    if (data && data.length > 0) {
      const mappedLeads: OtherOriginLead[] = data.map((lead: any) => ({
        id: lead.id,
        name: lead.name,
        sub_origin_id: lead.sub_origin_id,
        sub_origin_name: lead.crm_sub_origins?.nome || "Desconhecido",
        origin_name: lead.crm_sub_origins?.crm_origins?.nome || "Desconhecido",
        pipeline_name: lead.pipelines?.nome || null,
        created_at: lead.created_at,
      }));
      setOtherOriginLeads(mappedLeads);
    }
  };

  const hasUTMData = utmData.utm_source || utmData.utm_medium || utmData.utm_campaign || utmData.utm_term || utmData.utm_content;

  // Prepare UTM items for timeline
  const utmItems = [];
  if (utmData.utm_source) utmItems.push({ label: 'utm_source', value: utmData.utm_source });
  if (utmData.utm_medium) utmItems.push({ label: 'utm_medium', value: utmData.utm_medium });
  if (utmData.utm_campaign) utmItems.push({ label: 'utm_campaign', value: utmData.utm_campaign });
  if (utmData.utm_term) utmItems.push({ label: 'utm_term', value: utmData.utm_term });
  if (utmData.utm_content) utmItems.push({ label: 'utm_content', value: utmData.utm_content });

  // Check if there's content below the "other origins" item
  const hasContentBelow = hasUTMData || events.length > 0;

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Histórico de Rastreamento
      </h3>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex-shrink-0" />
                <div className="flex-1 bg-muted rounded-lg h-24" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative">
          {/* Other Origins - First in Timeline */}
          {otherOriginLeads.length > 0 && (
            <div className="relative flex">
              {/* Left side - Icon and vertical line */}
              <div className="flex flex-col items-center mr-4">
                {/* Icon */}
                <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted dark:bg-[#1f1f1f] text-muted-foreground shadow-sm z-10">
                  <Users className="h-5 w-5" />
                </div>
                
                {/* Vertical line */}
                {hasContentBelow && (
                  <div className="w-0.5 flex-1 bg-gray-200 dark:bg-[#1f1f1f] my-2" />
                )}
              </div>
              
              {/* Right side - Card content */}
              <div className="flex-1 pb-6">
                <Card className="border-black/5 dark:border-white/[0.06] bg-white dark:bg-[#141414] shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold text-foreground">Lead existe em outras origens</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Encontrado em {otherOriginLeads.length} {otherOriginLeads.length === 1 ? 'outra origem' : 'outras origens'}
                    </p>
                    
                    <div className="mt-3 space-y-1.5">
                      {otherOriginLeads.map((otherLead) => (
                        <div
                          key={otherLead.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="text-muted-foreground">•</span>
                          <span className="font-medium text-foreground">{otherLead.origin_name}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-foreground">{otherLead.sub_origin_name}</span>
                          {otherLead.pipeline_name && (
                            <span className="text-muted-foreground">({otherLead.pipeline_name})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* UTM Parameters Card - Modern Layout */}
          {hasUTMData && (
            <div className="relative flex">
              {/* Left side - Icon and vertical line */}
              <div className="flex flex-col items-center mr-4">
                {/* Icon */}
                <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted dark:bg-[#1f1f1f] text-muted-foreground shadow-sm z-10">
                  <Globe className="h-5 w-5" />
                </div>
                
                {/* Vertical line */}
                {events.length > 0 && (
                  <div className="w-0.5 flex-1 bg-gray-200 dark:bg-[#1f1f1f] my-2" />
                )}
              </div>
              
              {/* Right side - UTM Card content */}
              <div className="flex-1 pb-6">
                <Card className="border-black/5 dark:border-white/[0.06] bg-white dark:bg-[#141414] shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold text-foreground mb-3">Parâmetros UTM</p>
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {utmItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">{item.label}:</span>
                          <span className="text-xs font-bold text-foreground">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* No UTM and no events */}
          {!hasUTMData && events.length === 0 && (
            <div className="p-4 bg-muted/20 dark:bg-[#141414]/50 rounded-lg border border-dashed border-black/10 dark:border-white/[0.06]">
              <p className="text-sm text-muted-foreground text-center">Nenhum rastreamento registrado</p>
            </div>
          )}

          {/* Timeline Events */}
          {events.map((event, index) => {
            const iconColors = getIconColors();
            const isLast = index === events.length - 1;
            
            return (
              <div key={event.id} className="relative flex animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                {/* Left side - Icon and vertical line */}
                <div className="flex flex-col items-center mr-4">
                  {/* Icon */}
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColors.bg} ${iconColors.text} shadow-sm z-10`}>
                    {getIconForType(event.tipo)}
                  </div>
                  
                  {/* Vertical line */}
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-gray-200 dark:bg-[#1f1f1f] my-2" />
                  )}
                </div>
                
                {/* Right side - Card content */}
                <div className="flex-1 pb-6">
                  <Card className="border-black/5 dark:border-white/[0.06] bg-white dark:bg-[#141414] shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      {/* Title */}
                      <p className="text-sm font-semibold text-foreground">{event.titulo}</p>
                      
                      {/* Origin breadcrumb */}
                      {event.origem && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide flex items-center gap-1">
                          ORIGEM: <span className="font-semibold text-foreground">{event.origem.toUpperCase()}</span> 
                          <ArrowRight className="h-3 w-3" /> 
                          <span className="font-semibold text-foreground">{event.origem.toUpperCase()}</span>
                        </p>
                      )}
                      
                      {/* Description */}
                      {event.descricao && (
                        <p className="text-sm text-muted-foreground mt-3">
                          {event.descricao}
                        </p>
                      )}
                      
                      {/* Expandable data */}
                      {event.dados && typeof event.dados === 'object' && Object.keys(event.dados as object).length > 0 && (
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-gray-200 dark:border-[#1f1f1f]"
                            onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                          >
                            {expandedEvent === event.id ? (
                              <>
                                <ChevronUp className="h-3 w-3 mr-1" />
                                Ocultar dados
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Mostrar dados
                              </>
                            )}
                          </Button>
                          
                          {expandedEvent === event.id && (
                            <pre className="mt-2 p-3 bg-muted/50 dark:bg-[#0e0e0e] rounded-lg text-xs overflow-x-auto border border-black/5 dark:border-white/[0.06]">
                              {JSON.stringify(event.dados, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                      
                      {/* Timestamp */}
                      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(event.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LeadTrackingTimeline;
