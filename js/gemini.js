// Chamadas à IA do Google (Gemini API), direto do navegador com a chave do próprio usuário.
import { normalizarRefeicao } from './logic.js';

// A chave fica fora do estado do app para nunca entrar no backup exportado.
const CHAVE = 'hendry.gemini';
// Alias que acompanha o Flash mais recente, para o app não quebrar quando o Google aposentar uma versão.
export const MODELO_PADRAO = 'gemini-flash-latest';

export const config = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || {};
  } catch {
    return {};
  }
};
export const salvarConfig = (c) => localStorage.setItem(CHAVE, JSON.stringify(c));

const ERROS = {
  400: 'O Gemini recusou o pedido. Confira a chave e o modelo em Configurações.',
  401: 'Chave do Gemini inválida. Confira em Configurações.',
  403: 'Chave do Gemini sem permissão. Confira em Configurações.',
  404: 'Modelo não encontrado. Troque o modelo em Configurações.',
  429: 'Limite de uso do Gemini atingido. Espere um pouco e tente de novo.',
};

async function gerar(parts, generationConfig) {
  const { key, model } = config();
  if (!key) throw new Error('Cadastre sua chave do Gemini em Configurações para usar a IA.');
  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || MODELO_PADRAO)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts }], generationConfig }),
      },
    );
  } catch {
    throw new Error('Sem conexão com o Gemini. Confira a internet e tente de novo.');
  }
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(ERROS[res.status] || (res.status >= 500 ? 'O Gemini está fora do ar. Tente de novo em instantes.' : `Erro ${res.status} do Gemini.`));
  const saida = (dados.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  if (!saida) throw new Error(dados.promptFeedback?.blockReason ? 'O Gemini bloqueou esse conteúdo.' : 'O Gemini não respondeu. Tente de novo.');
  return saida;
}

async function gerarJson(parts, responseSchema) {
  const saida = await gerar(parts, { responseMimeType: 'application/json', responseSchema });
  try {
    return JSON.parse(saida);
  } catch {
    throw new Error('O Gemini respondeu em um formato inesperado. Tente de novo.');
  }
}

export const testar = () => gerar([{ text: 'Responda apenas: ok' }]);

// ---------- Foto da refeição ----------

// Foto de celular tem vários MB. Reduzir para 1024 px deixa o envio rápido no 4G sem perder o que importa.
export async function reduzirFoto(arquivo, lado = 1024) {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const tela = Object.assign(document.createElement('canvas'), {
    width: Math.round(bmp.width * escala),
    height: Math.round(bmp.height * escala),
  });
  tela.getContext('2d').drawImage(bmp, 0, 0, tela.width, tela.height);
  return tela.toDataURL('image/jpeg', 0.85);
}

const NUMERO = { type: 'NUMBER' };
const ESQUEMA_REFEICAO = {
  type: 'OBJECT',
  properties: {
    nome: { type: 'STRING', description: 'Nome curto da refeição, em português' },
    itens: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nome: { type: 'STRING' },
          porcao: { type: 'STRING', description: 'Porção estimada, ex.: 150 g, 1 unidade, 2 colheres de sopa' },
          kcal: NUMERO,
          proteina: NUMERO,
          carbo: NUMERO,
          gordura: NUMERO,
        },
        required: ['nome', 'porcao', 'kcal', 'proteina', 'carbo', 'gordura'],
      },
    },
    confianca: { type: 'STRING', enum: ['baixa', 'media', 'alta'] },
    observacao: { type: 'STRING', description: 'Uma frase curta sobre o que deixou a estimativa incerta, se houver' },
  },
  required: ['nome', 'itens', 'confianca'],
};

const PROMPT_REFEICAO = `Você estima o valor nutricional de uma refeição a partir de uma foto, para um diário alimentar pessoal no Brasil.
Liste cada alimento ou bebida visível com a porção estimada (gramas ou medida caseira) e os valores dessa porção: kcal, proteína, carboidrato e gordura, em gramas.
Use valores típicos de tabelas brasileiras de composição de alimentos. Conte o óleo e os molhos de preparo quando forem visíveis.
Se a foto não mostrar comida nem bebida, devolva "itens" vazio e explique em "observacao".
Em "confianca", diga o quão segura é a estimativa: porção escondida ou ambígua reduz a confiança.
Responda em português do Brasil.`;

export async function analisarRefeicao(dataUrl, dica) {
  const [, mimeType, data] = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  const pedido = dica ? `${PROMPT_REFEICAO}\n\nInformação de quem comeu, que vale mais que a aparência da foto: ${dica}` : PROMPT_REFEICAO;
  return normalizarRefeicao(await gerarJson([{ inlineData: { mimeType, data } }, { text: pedido }], ESQUEMA_REFEICAO));
}

// ---------- Roteiro ----------

const ESQUEMA_ROTEIRO = {
  type: 'OBJECT',
  properties: {
    gancho: { type: 'STRING' },
    narracao: { type: 'STRING' },
    takes: { type: 'ARRAY', items: { type: 'STRING' } },
    legenda: { type: 'STRING' },
    cta: { type: 'STRING', description: 'Opcional e contextual. Vazio se não fizer sentido.' },
  },
  required: ['gancho', 'narracao', 'takes', 'legenda'],
};

const PROMPT_ROTEIRO = `Você é roteirista do hendry.ia. Transforme o relato abaixo em um roteiro narrado em primeira pessoa para vídeo curto de 30 a 60 segundos.
Estrutura: gancho (0 a 5 s), contexto (5 a 15 s), ação (15 a 45 s), resultado ou próximo passo (45 a 60 s).
Mostre tentativa, dificuldade, resultado e próximo passo quando esses fatos existirem no relato.
Não invente fatos, clientes, valores, respostas, vendas ou resultados.
Fale como um brasileiro contando o dia para um amigo: sem frases de guru, sem sensacionalismo, sem exagero.
Sugira até 6 takes simples, gravados em casa ou na academia, nunca no ambiente de trabalho.
Preserve informações confidenciais: não cite nomes de empresas nem de pessoas que apareçam no relato.`;

export async function gerarRoteiro(relato, quadro) {
  const r = await gerarJson([{ text: `${PROMPT_ROTEIRO}\n\nQUADRO: ${quadro}\nRELATO: ${relato}` }], ESQUEMA_ROTEIRO);
  const s = (v) => String(v || '').trim();
  return {
    gancho: s(r.gancho),
    roteiro: s(r.narracao),
    takes: (Array.isArray(r.takes) ? r.takes : []).map(s).filter(Boolean).slice(0, 6).join('\n'),
    legenda: s(r.legenda),
    cta: s(r.cta),
  };
}
