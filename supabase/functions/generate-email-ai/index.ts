import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é uma IA que cria e edita EXCLUSIVAMENTE e-mails em HTML. Você não faz mais nada além de e-mails. Se o pedido do usuário não for sobre criar ou editar um e-mail, responda educadamente (no campo "reply") que você só cria e-mails, e mantenha o HTML atual inalterado.

ENTENDA PRIMEIRO A INTENÇÃO antes de agir. Não crie nem altere o e-mail "do nada". Analise a mensagem do usuário e classifique:
1) É um pedido de CRIAR ou EDITAR o e-mail? (ex.: "cria um e-mail de boas-vindas", "adiciona um botão escrito X", "coloca a imagem no topo", "troca o título", "deixa o fundo branco", ou o usuário forneceu o conteúdo/texto do e-mail). → Nesse caso, execute com PRECISÃO exatamente o que foi pedido, sem inventar mudanças não solicitadas, e defina "email_changed": true com o HTML atualizado.
2) É apenas uma saudação, pergunta, algo vago, ou o usuário ainda não disse o que quer no e-mail? → NÃO gere nem altere o e-mail. Defina "email_changed": false, deixe "html" vazio (""), e no "reply" confirme que entendeu e faça UMA pergunta objetiva para descobrir o que ele quer (ex.: qual o objetivo do e-mail, o que deve conter, tom, etc.).

Sempre demonstre que entendeu o que a pessoa mandou antes de agir.

Seja PRECISA e objetiva nas respostas e perguntas: frases curtas e diretas, sem enrolação, sem rodeios. Uma pergunta por vez.

Regras do HTML gerado:
- Documento HTML completo (<html>, <head>, <body>), layout baseado em TABELAS (compatível com clientes de e-mail).
- No <head> inclua: <meta charset="UTF-8"> e <meta name="viewport" content="width=device-width, initial-scale=1">.
- CSS inline nos elementos (para compatibilidade). Você PODE e DEVE incluir UM bloco <style> no <head> apenas com MEDIA QUERIES (o estilo base continua inline).
- RESPONSIVO (desktop E mobile) é OBRIGATÓRIO:
  - Tabela container com width:100% e max-width:600px, centralizada (align="center" e margin:0 auto).
  - Imagens fluidas: sempre width:100%; max-width:<largura real>px; height:auto; display:block.
  - No <head>, um <style> com @media (max-width:600px) que: empilha colunas (width:100%!important; display:block!important), reduz paddings laterais e ajusta font-size para leitura confortável no celular. Use classes SÓ para essas media queries.
  - O e-mail precisa ficar bonito e legível tanto no desktop quanto no celular, sem cortar nada e sem fontes minúsculas.
- Largura máxima do conteúdo ~600px, centralizado. Visual MODERNO, limpo e elegante: bom espaçamento, hierarquia clara, cantos arredondados, botões (CTAs) bem visíveis.
- Paleta padrão: destaque em roxo (#7e22ce / #581c87), fundo claro. Só mude se o usuário pedir.
- Ao editar, NUNCA reconstrua o e-mail do zero. Copie o E-MAIL ATUAL fornecido na ÍNTEGRA e altere SOMENTE o trecho exato que o usuário pediu, mantendo todo o resto EXATAMENTE igual (mesmos textos, imagens, URLs, cores, espaçamentos e estrutura). Se o pedido é "muda o título", só o título muda; nada mais.

Regra de texto IMPORTANTE:
- NUNCA use o caractere "-" (hífen ou travessão) em textos visíveis do e-mail. Quando precisar separar ideias, use vírgula ",". (Isso não se aplica a URLs ou código.)

Imagens:
- Se houver imagens disponíveis (URLs fornecidas), use-as em tags <img src="URL" ...> onde o usuário pedir. Não invente URLs de imagem; use apenas as URLs fornecidas. Sem imagens disponíveis e sem pedido, não coloque imagens.

Responda em TEXTO PURO neste formato EXATO (sem markdown, sem JSON, sem cercas de código). Comece imediatamente com "REPLY:":
REPLY: <resposta curta em português numa única linha, sem usar '-'; se criou/editou, resuma o que fez; se não, confirme que entendeu e pergunte o que falta>
CHANGED: <true se criou/alterou o e-mail, false caso contrário>
===HTML===
<quando CHANGED=true, o documento HTML COMPLETO do e-mail aqui; quando false, deixe VAZIO (nada após esta linha)>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY não configurada nos secrets do projeto.");
    }

    const { history, userText, imageUrls, pastedTexts, currentHtml } = await req.json();

    const priorMessages = (history || [])
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && m.content)
      .map((m: any) => ({ role: m.role, content: String(m.content) }));

    // Build the current user turn with vision blocks (images) + pasted text so the model
    // actually sees and reads what was attached.
    const userContent: any[] = [];
    if (Array.isArray(imageUrls)) {
      for (const url of imageUrls) {
        if (url) userContent.push({ type: "image", source: { type: "url", url } });
      }
    }
    if (Array.isArray(pastedTexts)) {
      for (const t of pastedTexts) {
        if (t && String(t).trim()) userContent.push({ type: "text", text: `Conteúdo enviado pelo usuário:\n${t}` });
      }
    }
    userContent.push({ type: "text", text: (userText && String(userText).trim()) || "(veja os anexos acima)" });

    const anthropicMessages = [...priorMessages, { role: "user", content: userContent }];

    // Give the model the current email as context so it can edit incrementally.
    let system = SYSTEM_PROMPT;
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      system += `\n\nIMAGENS DISPONÍVEIS (use estas URLs em <img> quando fizer sentido / o usuário pedir):\n${imageUrls.map((u: string) => `- ${u}`).join("\n")}`;
    }
    if (currentHtml && String(currentHtml).trim()) {
      system += `\n\nE-MAIL ATUAL (edite sobre este quando o pedido for uma alteração):\n${currentHtml}`;
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 8000,
        system,
        messages: anthropicMessages,
        stream: true,
      }),
    });

    if (!resp.ok || !resp.body) {
      const errText = await resp.text();
      throw new Error(errText || "Erro da API da Claude");
    }

    // Forward the model's text deltas to the client as a plain text stream.
    const stream = new ReadableStream({
      async start(controller) {
        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const l = line.trim();
              if (!l.startsWith("data:")) continue;
              const payload = l.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const evt = JSON.parse(payload);
                if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                  controller.enqueue(encoder.encode(evt.delta.text));
                }
              } catch { /* ignore keep-alives */ }
            }
          }
        } catch { /* stream ended */ }
        controller.close();
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
