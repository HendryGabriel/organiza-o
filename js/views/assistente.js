// A assistente: a pessoa escreve ou grava, a IA responde e separa o que foi contado em registros.
// Nada entra no app sem a confirmação dela, e dá para desfazer logo em seguida.
import { state, actions, commit, registrarFeito, abrir, fechar, dialogoAberto, aviso, invalido, uid, texto } from '../core.js';
import { html, icon, dataCurta, dataLonga, dinheiro, n } from '../ui.js';
import { hoje, somaMacros, mudarEtapa, financas, AREAS, TIPOS, CATEGORIAS, FUNIL } from '../logic.js';
import { contextoDaAssistente, faturaDe, parcelar } from '../analise.js';
import { conversar, config as gemini } from '../gemini.js';
import { gravar, parar, cancelar } from '../audio.js';

const LIMITE_DO_AUDIO = 3 * 60 * 1000;
const MEMORIA = 10; // falas que voltam para a IA a cada mensagem
const PERGUNTAS = ['Como foi minha semana?', 'Onde posso economizar?', 'Estou em déficit?', 'Como vender mais?'];

let conversa = []; // [{ de: 'voce' | 'ia', texto, plano, estado, dito }] desta sessão; some ao recarregar a página
let entrada = null; // mensagem enviada e ainda sem resposta: { texto } ou { audio }
let esperando = false;
let erro = '';
let rascunho = ''; // o que está escrito na caixa da tela Hoje, para não se perder quando a tela redesenha
let gravando = null; // { inicio } enquanto o microfone está aberto
let limite;
let pedido = 0;

const kg = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const emOutroDia = (data) => (data === hoje() ? '' : `em ${dataCurta(data)}`);
const junta = (...partes) => partes.filter(Boolean).join(', ');
const igual = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const naTela = () => dialogoAberto() && document.querySelector('#dlg .conversa');

// O rascunho acompanha a digitação, para a tela poder redesenhar sem apagar o que foi escrito.
document.addEventListener('input', (e) => {
  if (e.target.matches?.('.assistente textarea')) rascunho = e.target.value;
});

// ---------- A caixa da tela Hoje ----------

export function caixaDaAssistente() {
  const temChave = Boolean(gemini().key);
  return html`
    <section class="assistente" aria-labelledby="t-assistente">
      <h2 id="t-assistente">Assistente</h2>
      ${gravando
        ? html`
          <div class="gravando">
            <p><i class="rec" aria-hidden="true"></i><span class="num" aria-hidden="true" data-inicio="${gravando.inicio}">00:00</span> <span role="status">Gravando. Conte o seu dia ou pergunte.</span></p>
            <div class="acoes">
              <button class="btn btn-p" data-act="ia.pararAudio">${icon('check')} Parar e enviar</button>
              <button class="btn btn-t" data-act="ia.cancelarAudio">Cancelar</button>
            </div>
          </div>`
        : entrada?.audio
          ? html`
            <div class="gravando">
              <p>Seu áudio ainda não foi respondido.</p>
              <div class="acoes">
                <button class="btn btn-p" data-act="ia.abrir">Continuar</button>
                <button class="btn btn-t" data-act="ia.descartar">Descartar o áudio</button>
              </div>
            </div>`
          : html`
            <form class="pilha" data-act="ia.enviar" data-caixa="1">
              <label class="campo">
                <span class="sr">Mensagem para a assistente</span>
                <textarea name="texto" rows="3" placeholder="Conte o seu dia ou pergunte. Ex.: treinei perna 1 hora, almocei arroz, feijão e frango, gastei 35 no mercado…">${rascunho}</textarea>
              </label>
              ${temChave
                ? html`
                  <div class="acoes">
                    <button class="btn btn-p">Enviar</button>
                    <button type="button" class="btn btn-s" data-act="ia.gravar">${icon('microphone')} Gravar áudio</button>
                    ${conversa.length > 0 && html`<button type="button" class="btn btn-t" data-act="ia.abrir">Ver a conversa</button>`}
                  </div>
                  <div class="sugestoes" role="group" aria-label="Perguntas prontas">
                    ${PERGUNTAS.map((p) => html`<button type="button" data-act="ia.perguntar" data-texto="${p}">${p}</button>`)}
                  </div>
                  <small>Por texto ou áudio. Ela separa treino, refeições, gastos, contatos e tarefas, e você confere antes de gravar.</small>`
                : html`
                  <div class="acoes">
                    <button type="button" class="btn btn-p" data-act="ia.guardar">Guardar como relato</button>
                    <a class="btn btn-s" href="#/config">Ligar a assistente</a>
                  </div>
                  <small>A assistente usa a IA do Google. Com a sua chave do Gemini em Configurações, ela registra e responde por texto ou áudio. Sem a chave, o texto fica guardado como relato do dia.</small>`}
            </form>`}
    </section>`;
}

// ---------- A conversa ----------

function itensDoPlano(p) {
  const itens = [];
  p.treinos.forEach((t, i) => itens.push({ chave: `treinos:${i}`, grupo: 'Treino', titulo: t.tipo, detalhe: junta(t.min && `${t.min} min`, t.obs, emOutroDia(t.data)) }));
  p.refeicoes.forEach((r, i) => itens.push({ chave: `refeicoes:${i}`, grupo: 'Refeição', titulo: r.nome, valor: `${n(somaMacros(r.itens).kcal)} kcal`, detalhe: junta(r.itens.map((x) => `${x.nome} (${x.porcao})`).join(', '), emOutroDia(r.data)) }));
  p.acoes.forEach((a, i) => itens.push({ chave: `acoes:${i}`, grupo: 'Ação', titulo: a.titulo, detalhe: junta(AREAS[a.area], a.min && `${a.min} min`, emOutroDia(a.data)) }));
  p.contatos.forEach((c, i) => {
    const existe = state.leads.some((l) => igual(l.empresa, c.empresa));
    itens.push({ chave: `contatos:${i}`, grupo: existe ? 'Contato' : 'Lead novo', titulo: c.empresa, detalhe: junta(c.canal, c.resumo, c.respondeu && 'respondeu', c.followUp && `próximo contato em ${dataCurta(c.followUp)}`) });
  });
  p.financas.forEach((f, i) => itens.push({ chave: `financas:${i}`, grupo: TIPOS[f.tipo], titulo: f.descricao || CATEGORIAS[f.tipo]?.[f.categoria] || TIPOS[f.tipo], valor: dinheiro(f.valor), detalhe: junta(f.descricao !== CATEGORIAS[f.tipo]?.[f.categoria] && f.descricao && CATEGORIAS[f.tipo]?.[f.categoria], f.cartao && (f.parcelas > 1 ? `cartão em ${f.parcelas}x` : 'cartão'), emOutroDia(f.data)) }));
  p.tarefas.forEach((t, i) => itens.push({ chave: `tarefas:${i}`, grupo: 'Tarefa', titulo: t.titulo, detalhe: junta(AREAS[t.area], t.prazo && `até ${dataCurta(t.prazo)}`) }));
  if (p.peso) itens.push({ chave: 'peso:0', grupo: 'Peso', titulo: `${kg(p.peso)} kg`, detalhe: '' });
  return itens;
}

function proposta(m, i) {
  if (m.estado !== 'pendente') return html`<p class="nota">${m.estado === 'registrado' ? 'Registrado no app.' : 'Trocado pela versão mais abaixo.'}</p>`;
  return html`
    <form class="pilha" data-act="ia.registrar" data-i="${i}">
      <fieldset class="grupo itens">
        <legend>Vou registrar</legend>
        ${itensDoPlano(m.plano).map((it) => html`
          <label class="item">
            <input type="checkbox" name="item" value="${it.chave}" checked>
            <span><b>${it.grupo}: ${it.titulo}</b>${it.detalhe && html`<small>${it.detalhe}</small>`}</span>
            <span class="num">${it.valor || ''}</span>
          </label>`)}
      </fieldset>
      <small>Calorias e valores são estimativas da IA. Desmarque o que não quiser.</small>
      <div class="acoes"><button class="btn btn-p">Registrar</button></div>
    </form>`;
}

function mostrar() {
  abrir('Assistente', html`
    <div class="dlg-corpo conversa">
      ${conversa.length > 0 && html`<button type="button" class="btn btn-t nova" data-act="ia.limpar">Nova conversa</button>`}
      ${conversa.map((m, i) =>
        m.de === 'voce'
          ? html`<div class="fala voce" tabindex="-1"><b>Você</b><p>${m.texto}</p></div>`
          : html`<div class="fala ia"><b>Assistente</b><p>${m.texto}</p>${m.plano && proposta(m, i)}</div>`)}
      ${entrada && html`<div class="fala voce" tabindex="-1"><b>Você</b><p>${entrada.texto || 'Mensagem em áudio'}</p></div>`}
      ${esperando && html`<div class="esqueleto" role="status"><p>${entrada?.audio ? 'Ouvindo e pensando…' : 'Pensando…'}</p><i></i><i></i><i></i></div>`}
      ${erro && html`
        <div class="fala ia">
          <p class="erro" role="alert">${erro}</p>
          <div class="acoes">
            <button class="btn btn-s" data-act="ia.denovo">Tentar de novo</button>
            ${entrada?.texto && html`<button class="btn btn-t" data-act="ia.guardar">Guardar como relato</button>`}
          </div>
        </div>`}
      <form class="responder" data-act="ia.enviar">
        <label class="campo"><span class="sr">Responder, corrigir ou perguntar</span><input name="texto" autocomplete="off" enterkeyhint="send" placeholder="Responda, corrija ou pergunte…"></label>
        <button class="btn btn-s">Enviar</button>
      </form>
    </div>`);
  // A leitura começa na última fala da pessoa: a resposta fica logo abaixo, inteira.
  const ultima = [...document.querySelectorAll('#dlg .fala.voce')].at(-1);
  ultima?.scrollIntoView({ block: 'start' });
  ultima?.focus({ preventScroll: true });
}

const resumoDoPlano = (p) => itensDoPlano(p).map((it) => `${it.grupo}: ${it.titulo}${it.valor ? ` (${it.valor})` : ''}`).join('; ');
const NOTA = { pendente: 'proposta ainda não registrada', registrado: 'registrado', trocado: 'proposta trocada por outra' };
// O que volta para a IA: as últimas falas, com uma nota dizendo o que aconteceu com cada proposta.
const memoria = () => conversa.slice(-MEMORIA).map((m) => ({ de: m.de, texto: m.plano ? `${m.texto}\n[${NOTA[m.estado]}: ${resumoDoPlano(m.plano)}]` : m.texto }));

async function responder() {
  const vez = ++pedido;
  const msg = entrada;
  erro = '';
  esperando = true;
  mostrar();
  try {
    const r = await conversar({ texto: msg.texto, audio: msg.audio, historico: memoria(), contexto: contextoDaAssistente(state), hojeIso: hoje(), hojeLongo: dataLonga(hoje()) });
    if (vez !== pedido) return;
    const temPlano = itensDoPlano(r).length > 0;
    // Proposta nova troca a anterior que ficou sem registrar: é a mesma, corrigida.
    if (temPlano) for (const m of conversa) if (m.estado === 'pendente') m.estado = 'trocado';
    const dito = msg.texto || r.relato || 'Mensagem em áudio';
    conversa.push(
      { de: 'voce', texto: dito },
      { de: 'ia', texto: r.resposta || (temPlano ? 'Confira o que eu entendi.' : 'Não entendi. Pode dizer de outro jeito?'), plano: temPlano ? r : null, estado: temPlano ? 'pendente' : '', dito },
    );
    if (msg.daCaixa) rascunho = '';
    entrada = null;
  } catch (e) {
    if (vez !== pedido) return;
    erro = e.message;
  }
  esperando = false;
  commit(); // a caixa da tela Hoje acompanha: some o rascunho enviado e aparece "Ver a conversa"
  if (naTela()) mostrar();
  else if (!erro) aviso('A assistente respondeu. Toque em “Ver a conversa”.');
}

// ---------- Gravar no app o que foi confirmado. Devolve a função que desfaz tudo. ----------

function aplicar(p, marcados, dito) {
  const d = hoje();
  const hora = new Date().toTimeString().slice(0, 5);
  const criados = { treinos: [], refeicoes: [], feitos: [], leads: [], financas: [], tasks: [], medidas: [] };
  const leadsAntes = []; // leads que já existiam e ganharam um contato, para o desfazer devolver como estavam
  const notaAntes = state.dias[d]?.nota;
  const contagem = {};
  const contar = (nome) => (contagem[nome] = (contagem[nome] || 0) + 1);
  const novo = (lista, registro) => {
    state[lista].push(registro);
    criados[lista].push(registro.id);
  };

  p.treinos.forEach((t, i) => {
    if (!marcados.has(`treinos:${i}`)) return;
    novo('treinos', { id: uid(), data: t.data, tipo: t.tipo, min: t.min, obs: t.obs });
    contar('treino');
  });
  p.refeicoes.forEach((r, i) => {
    if (!marcados.has(`refeicoes:${i}`)) return;
    novo('refeicoes', { id: uid(), data: r.data, hora: r.data === d ? hora : '', nome: r.nome, ...somaMacros(r.itens), itens: r.itens, origem: 'assistente' });
    contar('refeição');
  });
  p.acoes.forEach((a, i) => {
    if (!marcados.has(`acoes:${i}`)) return;
    criados.feitos.push(registrarFeito({ chave: `relato:${uid()}`, titulo: a.titulo, area: a.area, min: a.min, data: a.data }));
    contar('ação');
  });
  p.contatos.forEach((c, i) => {
    if (!marcados.has(`contatos:${i}`)) return;
    let lead = state.leads.find((l) => igual(l.empresa, c.empresa));
    if (lead) leadsAntes.push(structuredClone(lead));
    else {
      lead = { id: uid(), empresa: c.empresa, criadoEm: c.data, status: 'pesquisado', auge: 0, atividades: [], segmento: '', cidade: '', contato: '', origem: 'Assistente', problema: '', obs: '', proximoPasso: '', followUp: '' };
      novo('leads', lead);
    }
    lead.atividades.unshift({ data: c.data, canal: c.canal, resumo: c.resumo || 'Contato contado à assistente' });
    // Mesma regra do registro manual: contato feito leva o lead para "abordado" (ou "respondeu"), nunca para trás.
    // "Sem resposta" vale como abordado: se agora respondeu, anda.
    const etapa = c.respondeu ? 'respondeu' : 'abordado';
    const atual = lead.status === 'sem_resposta' ? 'abordado' : lead.status;
    if (FUNIL.includes(atual) && FUNIL.indexOf(atual) < FUNIL.indexOf(etapa)) mudarEtapa(lead, etapa);
    if (c.proximoPasso) lead.proximoPasso = c.proximoPasso;
    if (c.followUp) lead.followUp = c.followUp;
    else if (lead.followUp && lead.followUp <= d) lead.followUp = '';
    criados.feitos.push(registrarFeito({ chave: `lead:${lead.id}`, titulo: `${c.canal}: ${lead.empresa}`, area: 'clientes', min: 5, data: c.data }));
    contar('contato');
  });
  let recusados = 0;
  p.financas.forEach((f, i) => {
    if (!marcados.has(`financas:${i}`)) return;
    // A reserva não pode ficar negativa, como no lançamento manual.
    if (f.tipo === 'retirada' && financas(state.financas).reservado < f.valor) return recusados++;
    const base = { tipo: f.tipo, categoria: f.categoria, data: f.data, descricao: f.descricao, cliente: '', recebido: true };
    // Compra no cartão vira uma parcela por fatura, a partir da fatura em que a compra cai.
    if (f.cartao) for (const p of parcelar(f.valor, f.parcelas, faturaDe(f.data, state.settings))) novo('financas', { id: uid(), ...base, valor: p.valor, cartao: true, fatura: p.fatura, ...(p.parcela && { parcela: p.parcela }) });
    else novo('financas', { id: uid(), ...base, valor: f.valor });
    contar('lançamento');
  });
  p.tarefas.forEach((t, i) => {
    if (!marcados.has(`tarefas:${i}`)) return;
    novo('tasks', { id: uid(), titulo: t.titulo, area: t.area, min: t.min, prazo: t.prazo, criadaEm: d });
    contar('tarefa');
  });
  if (p.peso && marcados.has('peso:0')) {
    novo('medidas', { id: uid(), data: d, peso: p.peso, obs: '' });
    contar('peso');
  }
  // O que a pessoa contou vira o relato do dia: é a matéria-prima dos vídeos.
  if (dito) (state.dias[d] ||= {}).nota = [notaAntes, dito].filter(Boolean).join('\n');

  const plural = { treino: 'treinos', refeição: 'refeições', ação: 'ações', contato: 'contatos', lançamento: 'lançamentos', tarefa: 'tarefas', peso: 'pesos' };
  const resumo = Object.entries(contagem).map(([nome, q]) => `${q} ${q === 1 ? nome : plural[nome]}`).join(', ');
  return {
    resumo: `${resumo ? `Registrado: ${resumo}.` : 'Nada registrado.'}${recusados ? ' Uma retirada maior que a reserva ficou de fora.' : ''}`,
    desfazer: () => {
      for (const [lista, ids] of Object.entries(criados)) state[lista] = state[lista].filter((x) => !ids.includes(x.id));
      state.leads = state.leads.map((l) => leadsAntes.find((a) => a.id === l.id) || l);
      if (state.dias[d]) state.dias[d].nota = notaAntes;
    },
  };
}

// Sem chave ou sem internet: o texto não se perde, fica como relato do dia.
function guardarRelato(conteudo) {
  const d = hoje();
  const antes = state.dias[d]?.nota;
  (state.dias[d] ||= {}).nota = [antes, conteudo].filter(Boolean).join('\n');
  aviso('Relato guardado.', () => {
    state.dias[d].nota = antes;
  });
}

async function encerrarGravacao() {
  clearTimeout(limite);
  // Com outro formulário aberto (um treino, por exemplo), o áudio fica guardado na caixa em vez de tomar a tela.
  const ocupado = dialogoAberto();
  if (!ocupado) abrir('Assistente', html`<div class="dlg-corpo conversa"><div class="esqueleto" role="status"><p>Preparando o áudio…</p><i></i><i></i><i></i></div></div>`);
  try {
    entrada = { audio: await parar() };
  } catch {
    entrada = null;
    if (!ocupado) fechar();
    aviso('Não consegui ler a gravação. Tente de novo ou escreva.');
  }
  gravando = null;
  commit(); // a caixa sai do modo "gravando"
  if (entrada && !ocupado) await responder();
}

Object.assign(actions, {
  'ia.enviar': async (f, form) => {
    const msg = texto(f.texto);
    if (!msg) return invalido(form.elements.texto, 'Escreva uma mensagem ou grave um áudio.');
    if (esperando) return false;
    entrada = { texto: msg, daCaixa: Boolean(f.caixa) };
    await responder();
    return false;
  },

  'ia.perguntar': async ({ texto: pergunta }) => {
    if (esperando) return false;
    entrada = { texto: pergunta };
    await responder();
    return false;
  },

  'ia.denovo': async () => {
    if (entrada && !esperando) await responder();
    return false;
  },

  // Reabre a conversa. Se ficou uma mensagem sem resposta (áudio gravado sem internet, por exemplo), tenta de novo.
  'ia.abrir': async () => {
    if (entrada && !esperando) await responder();
    else mostrar();
    return false;
  },

  'ia.limpar': () => {
    pedido++; // uma resposta que ainda esteja a caminho não entra na conversa nova
    conversa = [];
    entrada = null;
    esperando = false;
    erro = '';
    fechar();
  },

  'ia.descartar': () => {
    pedido++;
    entrada = null;
    esperando = false;
    erro = '';
  },

  'ia.guardar': (_, botao) => {
    const conteudo = texto(botao.form?.elements.texto?.value ?? entrada?.texto);
    if (!conteudo) return aviso('Escreva alguma coisa primeiro.'), false;
    if (naTela()) fechar();
    entrada = null;
    erro = '';
    rascunho = '';
    guardarRelato(conteudo);
  },

  'ia.registrar': (f, form) => {
    const m = conversa[f.i];
    if (m?.estado !== 'pendente') return false;
    const marcados = new Set(new FormData(form).getAll('item'));
    if (marcados.size === 0) return aviso('Marque pelo menos um item para registrar.'), false;
    const { resumo, desfazer } = aplicar(m.plano, marcados, m.dito);
    m.estado = 'registrado';
    fechar();
    // Desfeito, a proposta volta a ficar disponível em "Ver a conversa".
    aviso(resumo, () => {
      desfazer();
      m.estado = 'pendente';
    });
  },

  'ia.gravar': async (_, botao) => {
    try {
      await gravar();
    } catch {
      aviso('Não consegui usar o microfone. Libere o acesso para este site e tente de novo.');
      return false;
    }
    gravando = { inicio: Date.now() };
    // O limite não depende da tela: vale mesmo se a pessoa trocou de aba do app durante a gravação.
    limite = setTimeout(encerrarGravacao, LIMITE_DO_AUDIO);
  },

  'ia.cancelarAudio': () => {
    clearTimeout(limite);
    cancelar();
    gravando = null;
  },

  'ia.pararAudio': async () => {
    await encerrarGravacao();
    return false;
  },
});
