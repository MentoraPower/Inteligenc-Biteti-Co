import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const groqApiKey = Deno.env.get('GROK_API_KEY'); // Note: using GROK_API_KEY but it contains Groq key

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Service cost: R$1,800 labor + R$1,000 traffic = R$2,800 total
const SERVICE_COST = 2800;
const MIN_REVENUE_RATIO = 0.55; // Service should be at most 55% of revenue
const MIN_AFFORDABLE_REVENUE = Math.ceil(SERVICE_COST / MIN_REVENUE_RATIO); // ~R$ 5,091

// Auth helper - verifies JWT and returns user claims
async function verifyAuth(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims?.sub) {
    return null;
  }
  
  return { userId: data.claims.sub as string };
}

const SYSTEM_PROMPT = `Voce e um analista de leads especializado no mercado de beleza e estetica. Sua funcao e analisar dados de potenciais clientes e escrever uma analise concisa sobre o perfil do lead.

CONTEXTO IMPORTANTE:
- O servico custa R$ ${SERVICE_COST}/mes (R$ 1.800 mao de obra + R$ 1.000 trafego pago)
- Um lead e considerado MQL (Marketing Qualified Lead) se o servico representar no maximo 55% do faturamento dele
- Faturamento minimo para ser MQL: ~R$ ${MIN_AFFORDABLE_REVENUE.toLocaleString('pt-BR')}/mes

REGRAS CRITICAS - LEIA COM ATENCAO:
1. Escreva em portugues do Brasil
2. Use *texto* para destacar palavras importantes (negrito)
3. NAO use emojis em hipotese alguma
4. Seja direto e objetivo
5. Escreva entre 3-5 frases curtas
6. SEMPRE indique claramente se o lead e *MQL*, *Nao e MQL* ou *Dados insuficientes* no inicio da analise
7. Foque em: classificacao MQL, perfil profissional, capacidade de investimento, potencial de crescimento

REGRA MAIS IMPORTANTE - NAO INVENTAR NUMEROS:
- NUNCA invente, calcule, estime ou suponha valores de faturamento, receita ou ticket medio
- Se os dados de "Receita Estimada" ou "Ticket Medio" aparecem como "Nao informado" ou "Nao calculavel", voce NAO PODE inventar esses numeros
- Se os dados estao faltando, diga apenas "*Dados insuficientes*. Nao foi possivel classificar este lead como MQL pois os dados de faturamento nao foram informados."
- NAO faca calculos por conta propria. Apenas reporte o que foi informado.

FORMATO:
Comece com "*MQL*", "*Nao e MQL*" ou "*Dados insuficientes*" seguido de um ponto. Depois escreva um paragrafo curto e direto sobre o perfil.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const auth = await verifyAuth(req);
    if (!auth) {
      console.log("[analyze-lead-profile] Unauthorized request - no valid JWT");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`[analyze-lead-profile] Authenticated user: ${auth.userId}`);

    const leadData = await req.json();
    
    console.log("Analyzing lead profile:", leadData.name);

    // Parse values - CRITICAL: Only calculate if we have real data
    const weeklyAttendance = parseInt(leadData.weekly_attendance) || 0;
    const averageTicket = parseFloat(leadData.average_ticket) || 0;
    
    // Check if we have enough data to calculate
    const hasEnoughData = weeklyAttendance > 0 && averageTicket > 0;
    
    // Use existing estimated_revenue if available, otherwise calculate (only if we have data)
    let estimatedRevenue = leadData.estimated_revenue;
    if (estimatedRevenue === null || estimatedRevenue === undefined) {
      estimatedRevenue = hasEnoughData ? weeklyAttendance * 4 * averageTicket : null;
    }
    
    // Only determine MQL if we have revenue data
    const isMQL = estimatedRevenue !== null && estimatedRevenue >= MIN_AFFORDABLE_REVENUE;

    if (!groqApiKey) {
      console.log("No GROQ API key configured");
      const mqlStatus = estimatedRevenue === null 
        ? "*Dados insuficientes*" 
        : (isMQL ? "*MQL*" : "*Nao e MQL*");
      const analysis = estimatedRevenue === null
        ? `${mqlStatus}. Lead nao possui dados de atendimentos ou ticket medio para calcular faturamento estimado.`
        : `${mqlStatus}. Faturamento estimado de *R$ ${estimatedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*/mes. ${isMQL ? 'Lead tem capacidade financeira para investir no servico.' : 'Faturamento abaixo do minimo recomendado de R$ ' + MIN_AFFORDABLE_REVENUE.toLocaleString('pt-BR') + '/mes para o investimento ser sustentavel.'}`;
      return new Response(JSON.stringify({ 
        analysis,
        isMQL: estimatedRevenue !== null ? isMQL : null,
        estimatedRevenue
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = `Analise este lead:

Nome: ${leadData.name || 'Nao informado'}
Empresa/Clinica: ${leadData.clinic_name || 'Nao informada'}
Area de Atuacao: ${leadData.service_area || 'Nao informada'}
Anos de Experiencia: ${leadData.years_experience || 'Nao informado'}
Tipo de Espaco: ${leadData.workspace_type === 'physical' ? 'Espaco Fisico' : leadData.workspace_type === 'home' ? 'Domicilio/Casa' : 'Nao informado'}
Faturamento Mensal Declarado: ${leadData.monthly_billing || 'Nao informado'}
Atendimentos por Semana: ${weeklyAttendance > 0 ? weeklyAttendance : 'Nao informado'}
Ticket Medio: ${averageTicket > 0 ? `R$ ${averageTicket.toFixed(2)}` : 'Nao informado'}
Receita Estimada: ${estimatedRevenue !== null ? `R$ ${estimatedRevenue.toFixed(2)}/mes` : 'Nao calculavel (dados faltando)'}
E MQL (pode pagar R$ 2.800/mes): ${estimatedRevenue !== null ? (isMQL ? 'SIM' : 'NAO') : 'NAO DETERMINADO (dados faltando)'}
Pode Investir (resposta do formulario): ${leadData.can_afford === 'yes' ? 'Sim' : leadData.can_afford === 'no' ? 'Nao' : 'Nao respondeu'}
Quer mais informacoes: ${leadData.wants_more_info ? 'Sim' : 'Nao'}

IMPORTANTE: NAO invente numeros ou valores. Se um dado esta como "Nao informado", mencione que o dado nao foi fornecido. NAO crie valores ficticios.

Escreva sua analise:`;

    console.log("Calling Groq API for profile analysis...");

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      return new Response(JSON.stringify({ 
        analysis: "*Erro na analise* - Nao foi possivel gerar a analise automatica. Tente novamente mais tarde." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log("Groq profile analysis received");
    
    const content = data.choices?.[0]?.message?.content || '';
    
    // Clean the response
    let analysis = content
      .replace(/```/g, '')
      .replace(/^\s+|\s+$/g, '')
      .trim();

    if (!analysis) {
      analysis = isMQL ? "*MQL* - Analise incompleta." : "*Nao e MQL* - Analise incompleta.";
    }

    console.log("Profile analysis result:", analysis.substring(0, 100) + "...");
    
    return new Response(JSON.stringify({ 
      analysis,
      isMQL,
      estimatedRevenue 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-lead-profile:', error);
    
    return new Response(JSON.stringify({ 
      analysis: "*Erro no sistema* - Ocorreu um erro ao processar a analise do lead.",
      isMQL: false,
      estimatedRevenue: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
