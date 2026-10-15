// Telas de apoio: menu, revisão da semana, tarefas avulsas, rotina e configurações.
import { state, actions, pwa, registrarFeito, substituir, apagarTudo, abrir, fechar, aviso, invalido, baixar, uid, texto } from '../core.js?v=4';
import { html, raw, attr, icon, topo, campo, resumo, vazio, dataCurta, dinheiro, valorCampo, n, pct } from '../ui.js?v=4';
import { seletor, calendario } from '../widgets.js?v=4';
import { hoje, somaDias, inicioSemana, resumoSemana, funil, taxa, centavos, num, AREAS, COMERCIAIS } from '../logic.js?v=4';
import { config as gemini, salvarConfig, testar, MODELO_PADRAO } from '../gemini.js?v=4';
import { config as sinc, ligada, textoStatus, conectar, desconectar, sincronizar } from '../sinc.js?v=4';
import { suportado as avisaAqui, ativo as lembretesAtivos, ativar, desativar, testar as testarLembrete } from '../lembretes.js?v=4';
import { formPlano } from './hoje.js?v=4';
import { CAMPOS_PERFIL, perfilDaIA } from '../perfil.js?v=4';

const NOMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SEMANA = [1, 2, 3, 4, 5, 6, 0];
const MINUTOS = { 5: '5 min', 30: '30 min', 90: '90 min' };

const backup = () => {
  if (!state.backupEm) return 'Nenhum backup feito ainda.';
  const dias = Math.round((new Date(hoje()) - new Date(state.backupEm)) / 864e5);
  return dias === 0 ? 'Backup feito hoje.' : `Último backup há ${dias} ${dias === 1 ? 'dia' : 'dias'}.`;
};

// ---------- Menu (só no celular; no computador os itens ficam na barra lateral) ----------

export const menu = () => html`
  ${topo('Mais')}
  <ul class="linhas">
    ${[
      ['metricas', 'chart-line-up', 'Métricas', 'Gráficos semana a semana'],
      ['semana', 'chart-bar', 'Semana', 'Revisão com os números reais'],
      ['tarefas', 'list-checks', 'Tarefas', 'Avulsas, fora do plano do dia'],
      ['rotina', 'calendar-check', 'Rotina', 'O plano de cada dia da semana'],
      ['config', 'gear-six', 'Configurações', ligada() ? textoStatus() : backup()],
    ].map(([rota, ic, nome, sub]) => html`
      <li><a class="linha com-icone" href="#/${rota}">${icon(ic, 22)}<span class="principal">${nome}</span><span class="detalhe" ${attr('data-sinc', rota === 'config' && ligada())}>${sub}</span></a></li>`)}
  </ul>`;

// ---------- Semana ----------

export function semana(ref) {
  const atual = inicioSemana(hoje());
  const ini = /^\d{4}-\d{2}-\d{2}$/.test(ref || '') ? inicioSemana(ref) : atual;
  const s = resumoSemana(state, ini);
  const f = funil(state.leads);
  const negocio = COMERCIAIS.reduce((t, a) => t + (s.minutos[a] || 0), 0);
  const conteudo = s.minutos.conteudo || 0;
  const porArea = Object.keys(AREAS).filter((a) => s.feitos.some((x) => x.area === a));
  const de = (parte, todo, base) => (taxa(parte, todo) == null ? `sem ${base} ainda` : `${parte} de ${todo} ${base} (${pct(taxa(parte, todo))})`);

  return html`
    ${topo('Semana', `${dataCurta(s.ini)} a ${dataCurta(s.fim)}`)}
    <nav class="barra" aria-label="Trocar de semana">
      <a class="btn btn-t" href="#/semana/${somaDias(ini, -7)}">${icon('caret-left', 18)} Anterior</a>
      ${ini < atual && html`<a class="btn btn-t" href="#/semana/${somaDias(ini, 7)}">Próxima ${icon('caret-right', 18)}</a>`}
    </nav>

    <section class="bloco" aria-labelledby="h-exec">
      <h2 id="h-exec">Execução</h2>
      <dl class="stats">
        <div><dt>ações concluídas</dt><dd class="num">${s.feitos.length}</dd></div>
        <div><dt>ações comerciais</dt><dd class="num">${s.comerciais}</dd></div>
        <div><dt>dias de descanso</dt><dd class="num">${s.descansos}</dd></div>
      </dl>
      ${porArea.length > 0 && html`
        <ul class="linhas compacta">
          ${porArea.map((a) => {
            const q = s.feitos.filter((x) => x.area === a).length;
            return html`<li><span class="linha"><span class="principal">${AREAS[a]}</span><span class="lado">${q} ${q === 1 ? 'ação' : 'ações'} · ${s.minutos[a] || 0} min</span></span></li>`;
          })}
        </ul>`}
      <p class="nota">Negócio ${negocio} min, conteúdo ${conteudo} min. Referência: 3 h de negócio para cada 1 h de conteúdo.</p>
    </section>

    <section class="bloco" aria-labelledby="h-prosp">
      <h2 id="h-prosp">Prospecção</h2>
      <ul class="linhas compacta">
        <li><span class="linha"><span class="principal">Leads novos na semana</span><span class="lado">${s.leadsNovos}</span></span></li>
        <li><span class="linha"><span class="principal">Responderam</span><span class="lado">${de(f.responderam, f.abordados, 'abordados')}</span></span></li>
        <li><span class="linha"><span class="principal">Chegaram a demo</span><span class="lado">${de(f.demos, f.responderam, 'respostas')}</span></span></li>
        <li><span class="linha"><span class="principal">Fecharam</span><span class="lado">${de(f.ganhos, f.propostas, 'propostas')}</span></span></li>
      </ul>
      <p class="nota">As taxas são do funil inteiro, não só desta semana.</p>
    </section>

    <section class="bloco" aria-labelledby="h-resto">
      <h2 id="h-resto">Conteúdo, corpo e dinheiro</h2>
      <ul class="linhas compacta">
        <li><span class="linha"><span class="principal">Vídeos publicados</span><span class="lado">${s.videos} de ${state.settings.videosSemana} · ${s.posts} posts</span></span></li>
        <li><span class="linha"><span class="principal">Treinos</span><span class="lado">${s.treinos}${s.treinosPlanejados > 0 && html` de ${s.treinosPlanejados} planejados`}</span></span></li>
        <li><span class="linha"><span class="principal">Média de calorias</span><span class="lado">${s.kcalMedia == null ? 'sem registro' : html`${n(s.kcalMedia)} kcal por dia registrado`}</span></span></li>
        <li><span class="linha"><span class="principal">Recebido</span><span class="lado">${dinheiro(s.financas.recebido)}</span></span></li>
        <li><span class="linha"><span class="principal">Custos e impostos</span><span class="lado">${dinheiro(s.financas.custos + s.financas.impostos)}</span></span></li>
        <li><span class="linha"><span class="principal">Reservado para o Lancer</span><span class="lado">${dinheiro(s.financas.reservado)}</span></span></li>
      </ul>
    </section>

    <section class="bloco" aria-labelledby="h-prio">
      <h2 id="h-prio">Prioridades da próxima semana</h2>
      <form class="pilha" data-act="semana.prioridades" data-ini="${ini}">
        ${campo('No máximo 3. O que não entrou aqui espera.', html`<textarea name="prioridades" rows="3" placeholder="Ex.: enviar 5 abordagens…">${state.revisoes[ini]?.prioridades || ''}</textarea>`)}
        <div class="acoes"><button class="btn btn-s">Salvar prioridades</button></div>
      </form>
    </section>`;
}

// ---------- Tarefas avulsas ----------

export function tarefas() {
  const abertas = state.tasks.filter((t) => !t.feitaEm);
  const feitas = state.tasks.filter((t) => t.feitaEm).slice(-10).reverse();
  return html`
    ${topo('Tarefas', 'Avulsas. O plano do dia fica em Rotina')}

    <form class="pilha" data-act="tarefa.nova">
      ${campo('Nova tarefa', html`<input name="titulo" required autocomplete="off" placeholder="Ex.: responder o Dr. fulano sobre a demo…">`)}
      <div class="tripla">
        ${seletor('Área', 'area', AREAS, 'clientes')}
        ${seletor('Tempo', 'min', MINUTOS, 30)}
        ${calendario('Prazo', 'prazo', '', { min: hoje() })}
      </div>
      <div class="acoes"><button class="btn btn-p">${icon('plus')} Adicionar</button></div>
    </form>

    <section class="bloco" aria-labelledby="h-abertas">
      <h2 id="h-abertas">Em aberto</h2>
      ${abertas.length === 0
        ? vazio('Nenhuma tarefa avulsa. O plano do dia já cobre a rotina.')
        : html`
          <ul class="linhas">
            ${abertas.map((t) => html`
              <li>
                <span class="linha">
                  <span class="principal">${t.titulo}</span>
                  <span class="lado">
                    <button class="ic-btn" data-act="tarefa.concluir" data-id="${t.id}" aria-label="Concluir: ${t.titulo}">${icon('check')}</button>
                    <button class="ic-btn" data-act="tarefa.excluir" data-id="${t.id}" aria-label="Excluir: ${t.titulo}">${icon('trash', 18)}</button>
                  </span>
                  <span class="detalhe">${AREAS[t.area]} · ${t.min} min${t.prazo && html`, prazo ${dataCurta(t.prazo)}`}${t.adiadaAte > hoje() && html`, adiada para ${dataCurta(t.adiadaAte)}`}</span>
                </span>
              </li>`)}
          </ul>`}
    </section>

    ${feitas.length > 0 && html`
      <details class="bloco">
        ${resumo('Concluídas recentes')}
        <ul class="linhas compacta">
          ${feitas.map((t) => html`<li><span class="linha"><span class="principal">${t.titulo}</span><span class="lado">${dataCurta(t.feitaEm)}</span></span></li>`)}
        </ul>
      </details>`}`;
}

// ---------- Rotina ----------

export const rotina = () => html`
  ${topo('Rotina', 'O que fazer em cada dia, em 5, 30 ou 90 minutos')}
  <ul class="linhas">
    ${SEMANA.map((d) => {
      const p = state.rotina[d];
      return html`
        <li>
          <button class="linha" data-act="rotina.abrir" data-dia="${d}">
            <span class="principal">${NOMES[d]}</span>
            <span class="lado">${AREAS[p.area]}</span>
            <span class="detalhe">${p.t30 || p.t5 || p.t90 || 'Sem plano'}</span>
          </button>
        </li>`;
    })}
  </ul>
  <p class="nota">Vale para toda semana. Para mudar só o dia de hoje, use Editar na tarefa da tela Hoje.</p>`;

// ---------- Configurações ----------

// O repositório privado dos dados já existe. O link do token vem preenchido; 365 dias é o máximo que o GitHub aceita.
const REPO_DADOS = 'HendryGabriel/organiza-o-dados';
const LINK_TOKEN = `https://github.com/settings/personal-access-tokens/new?name=hendry.ia&description=${encodeURIComponent('Lê e grava só o repositório de dados do app')}&expires_in=365&contents=write`;

function blocoSinc() {
  const { repo } = sinc();
  return html`
    <section class="bloco" aria-labelledby="h-sinc">
      <h2 id="h-sinc">Sincronização entre aparelhos</h2>
      ${ligada()
        ? html`
          <p class="nota"><span data-sinc>${textoStatus()}</span> Repositório ${repo}.</p>
          <div class="acoes">
            <button class="btn btn-s" data-act="sinc.agora">${icon('arrows-clockwise')} Sincronizar agora</button>
            <button class="btn btn-t perigo" data-act="sinc.desconectar">Desconectar este aparelho</button>
          </div>
          <small>Com o app aberto, cada aparelho envia o que mudou e busca o que o outro fez. Sem internet, guarda e envia depois.</small>`
        : html`
          <p class="nota">Celular e computador com os mesmos dados. Eles ficam em um repositório privado do seu GitHub: só você tem acesso.</p>
          <ol class="passos">
            <li>
              <span>Se ainda não tem um token: em “Repository access”, escolha “Only select repositories” e marque <b>organiza-o-dados</b>. Depois, “Generate token”.</span>
              <a class="btn btn-s" href="${LINK_TOKEN}" target="_blank" rel="noopener">Criar token</a>
            </li>
            <li><span>Cole o token aqui. O mesmo token serve para o celular e para o computador.</span></li>
          </ol>
          <form class="pilha" data-act="sinc.conectar">
            ${campo('Repositório', html`<input name="repo" required value="${repo || REPO_DADOS}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="usuario/organiza-o-dados…">`)}
            ${campo('Token', html`<input type="password" name="token" required autocomplete="off" spellcheck="false" placeholder="github_pat_…">`, 'Fica só neste aparelho. Não entra no backup nem vai para a nuvem.')}
            <div class="acoes"><button class="btn btn-p">Ligar sincronização</button></div>
          </form>`}
    </section>`;
}

const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const iphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

const blocoInstalar = () => html`
  <section class="bloco" aria-labelledby="h-app">
    <h2 id="h-app">Usar como aplicativo</h2>
    ${pwa.convite
      ? html`
        <p class="nota">Abre em tela cheia, com ícone próprio, e funciona sem internet.</p>
        <div class="acoes"><button class="btn btn-p" data-act="config.instalar">${icon('download-simple')} Instalar aplicativo</button></div>`
      : html`
        <p class="nota">${iphone()
          ? 'No iPhone: abra no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.'
          : 'No Android: abra no Chrome, toque nos três pontos e depois em “Instalar aplicativo” ou “Adicionar à tela inicial”.'}
          Instalado, ele abre em tela cheia, funciona sem internet e o navegador não apaga seus dados por falta de uso.</p>`}
  </section>`;

// Notificações: um lembrete de manhã e outro à noite. Quem manda o toque é o repositório de dados, por isso
// só chega com o app fechado quando a sincronização está ligada.
function blocoLembretes() {
  const bloqueado = avisaAqui() && Notification.permission === 'denied';
  return html`
    <section class="bloco" aria-labelledby="h-lembretes">
      <h2 id="h-lembretes">Notificações</h2>
      ${!avisaAqui()
        ? html`<p class="nota">${iphone() ? 'No iPhone, as notificações só funcionam com o app instalado na Tela de Início. Instale e abra por lá.' : 'Este navegador não mostra notificações.'}</p>`
        : bloqueado
          ? html`<p class="nota">As notificações estão bloqueadas para este site. Libere nas configurações do navegador (no cadeado ao lado do endereço) e volte aqui.</p>`
          : lembretesAtivos()
            ? html`
              <p class="nota">Ativas neste aparelho: por volta das 8h, o que tem para hoje; por volta das 21h, o lembrete de contar o dia.${!ligada() ? ' Para chegarem com o app fechado, ligue a sincronização acima.' : ''}</p>
              <div class="acoes">
                <button class="btn btn-s" data-act="lembretes.testar">${icon('bell')} Enviar um teste</button>
                <button class="btn btn-t perigo" data-act="lembretes.desativar">Desativar neste aparelho</button>
              </div>`
            : html`
              <p class="nota">Um lembrete de manhã com follow-ups, prazos e treino do dia, e outro à noite para contar o dia à assistente.</p>
              <div class="acoes"><button class="btn btn-p" data-act="lembretes.ativar">${icon('bell')} Ativar notificações</button></div>`}
    </section>`;
}

export function config() {
  const s = state.settings;
  const g = gemini();
  return html`
    ${topo('Configurações')}
    <section class="bloco perfil-ia" aria-labelledby="h-perfil-ia">
      <h2 id="h-perfil-ia">Sobre mim · memória da IA</h2>
      <p class="nota">Organizado a partir do seu documento hendry.ia. Edite cada assunto e acrescente novidades quando quiser. A assistente e o gerador de roteiros usam as informações salvas.</p>
      <form class="pilha" data-act="config.perfil">
        <div class="perfil-assuntos">${Object.entries(CAMPOS_PERFIL).map(([chave, assunto]) => html`
          <details class="perfil-assunto" ${attr('open', chave === 'atualizacoes')}>
            <summary>${icon(assunto.icone, 22)}<span>${assunto.titulo}<small>${chave === 'atualizacoes' ? 'Adicione o que a IA precisa saber agora' : 'Clique para consultar ou editar'}</small></span>${icon('caret-right', 16)}</summary>
            ${campo(assunto.titulo, html`<textarea name="${chave}" rows="${chave === 'atualizacoes' ? 5 : 8}" maxlength="12000" placeholder="Ex.: 14/10 — decidi focar em uma nova especialidade…">${perfilDaIA(s)[chave]}</textarea>`)}
          </details>`)}</div>
        <small>Essas informações acompanham as conversas e os roteiros enviados ao Gemini. Ao salvar, também entram no backup e na sincronização de dados, se estiver ligada. Exemplos e planos não viram atividades realizadas.</small>
        <div class="acoes"><button class="btn btn-p">${icon('check')} Salvar informações</button></div>
      </form>
    </section>
    ${!instalado() && blocoInstalar()}
    ${blocoSinc()}
    ${blocoLembretes()}

    <section class="bloco" aria-labelledby="h-metas">
      <h2 id="h-metas">Ciclo e metas</h2>
      <form class="pilha" data-act="config.salvar">
        <div class="dupla">
          ${calendario('Início do ciclo', 'cicloInicio', s.cicloInicio, { obrigatorio: true })}
          ${calendario('Fim do ciclo', 'cicloFim', s.cicloFim, { obrigatorio: true })}
        </div>
        <div class="dupla">
          ${campo('Meta do Lancer (R$)', html`<input name="metaLancer" inputmode="decimal" autocomplete="off" value="${valorCampo(s.metaLancer)}">`, 'Carro, documentação e reserva inicial.')}
          ${campo('Vídeos por semana', html`<input name="videosSemana" inputmode="numeric" autocomplete="off" value="${s.videosSemana}">`)}
        </div>
        <div class="dupla">
          ${campo('Calorias por dia (kcal)', html`<input name="metaKcal" inputmode="numeric" autocomplete="off" value="${s.metaKcal || ''}">`, 'Meta opcional. O app não prescreve dieta.')}
          ${campo('Proteína por dia (g)', html`<input name="metaProteina" inputmode="numeric" autocomplete="off" value="${s.metaProteina || ''}">`, 'Meta opcional.')}
        </div>
        <div class="dupla">
          ${campo('Cartão: dia do fechamento', html`<input name="cartaoFecha" inputmode="numeric" autocomplete="off" value="${s.cartaoFecha || ''}" placeholder="Ex.: 25…">`, 'Compra a partir desse dia entra na fatura seguinte.')}
          ${campo('Cartão: dia do vencimento', html`<input name="cartaoVence" inputmode="numeric" autocomplete="off" value="${s.cartaoVence || ''}" placeholder="Ex.: 5…">`, 'É no mês do vencimento que a compra pesa.')}
        </div>
        <div class="acoes"><button class="btn btn-p">Salvar metas</button></div>
      </form>
    </section>

    <section class="bloco" aria-labelledby="h-ia">
      <h2 id="h-ia">IA do Google (Gemini)</h2>
      <form class="pilha" data-act="config.gemini">
        ${campo('Chave da API', html`<input type="password" name="key" autocomplete="off" spellcheck="false" placeholder="${g.key ? 'Chave salva. Cole outra para trocar…' : 'Cole a chave aqui…'}">`,
          html`Crie a sua em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>. Ela fica só neste aparelho e não entra no backup.`)}
        ${campo('Modelo', html`<input name="model" autocomplete="off" spellcheck="false" value="${g.model || MODELO_PADRAO}">`, `Padrão: ${MODELO_PADRAO}, que acompanha a versão Flash mais recente.`)}
        <div class="acoes">
          <button class="btn btn-p">Salvar chave</button>
          <button type="button" class="btn btn-s" data-act="config.testar" ${attr('disabled', !g.key)}>Testar conexão</button>
          ${g.key && html`<button type="button" class="btn btn-t perigo" data-act="config.removerChave">Remover chave</button>`}
        </div>
        <small>Usada pela assistente (texto e áudio), na foto da refeição e no roteiro de vídeo. Para responder, a assistente recebe o que você contou e um resumo dos seus números: semana, dinheiro por categoria, nomes dos leads e peso. No plano gratuito do Google, o conteúdo enviado pode ser usado para melhorar os produtos deles.</small>
      </form>
    </section>

    <section class="bloco" aria-labelledby="h-dados">
      <h2 id="h-dados">Seus dados</h2>
      <p class="nota">${ligada() ? 'Além da cópia neste aparelho, os dados ficam no seu repositório privado do GitHub.' : 'Tudo fica guardado neste navegador, sem conta e sem servidor.'} ${backup()}</p>
      <div class="acoes">
        <button class="btn btn-s" data-act="config.exportar">${icon('download-simple')} Exportar backup</button>
        <label class="btn btn-s">${icon('upload-simple')} Importar backup<input class="sr" type="file" accept="application/json,.json" data-mudou="config.importar"></label>
        <button class="btn btn-t perigo" data-act="config.apagar">Apagar tudo</button>
      </div>
    </section>`;
}

const inteiro = (v) => Math.max(0, Math.round(num(v) || 0));

Object.assign(actions, {
  'config.perfil': (f, form) => {
    const perfil = {};
    for (const chave of Object.keys(CAMPOS_PERFIL)) {
      const valor = texto(f[chave]);
      if (valor.length > 12000) return invalido(form.elements[chave], 'Use até 12.000 caracteres neste assunto.');
      perfil[chave] = valor;
    }
    state.settings.perfilIA = perfil;
    aviso('Informações salvas. A IA usará este contexto nas próximas conversas e roteiros.');
  },
  'semana.prioridades': ({ ini, prioridades }) => {
    state.revisoes[ini] = { prioridades: texto(prioridades) };
    aviso('Prioridades salvas. Elas aparecem na tela Hoje na semana que vem.');
  },

  'tarefa.nova': (f) => {
    state.tasks.push({ id: uid(), titulo: texto(f.titulo), area: AREAS[f.area] ? f.area : 'pessoal', min: Number(f.min) || 30, prazo: f.prazo, criadaEm: hoje() });
  },
  'tarefa.concluir': ({ id }) => {
    const t = state.tasks.find((x) => x.id === id);
    t.feitaEm = hoje();
    registrarFeito({ chave: `task:${id}`, titulo: t.titulo, area: t.area, min: t.min });
  },
  'tarefa.excluir': ({ id }) => {
    if (!confirm('Excluir esta tarefa?')) return false;
    state.tasks = state.tasks.filter((t) => t.id !== id);
  },

  'rotina.abrir': ({ dia }) => {
    abrir(NOMES[dia], formPlano(state.rotina[dia], 'rotina.salvar', raw(`data-dia="${Number(dia)}"`)));
    return false;
  },
  'rotina.salvar': (f) => {
    state.rotina[f.dia] = { area: f.area, t5: texto(f.t5), t30: texto(f.t30), t90: texto(f.t90) };
    fechar();
  },

  'config.salvar': (f, form) => {
    if (f.cicloFim < f.cicloInicio) return invalido(form.elements.cicloFim, 'O fim do ciclo precisa ser depois do início.');
    const meta = texto(f.metaLancer) ? centavos(f.metaLancer) : 0;
    if (!(meta >= 0)) return invalido(form.elements.metaLancer, 'Use um valor como 85.000.');
    Object.assign(state.settings, {
      cicloInicio: f.cicloInicio,
      cicloFim: f.cicloFim,
      metaLancer: meta,
      videosSemana: inteiro(f.videosSemana) || 2,
      metaKcal: inteiro(f.metaKcal),
      metaProteina: inteiro(f.metaProteina),
      cartaoFecha: Math.min(31, inteiro(f.cartaoFecha)),
      cartaoVence: Math.min(31, inteiro(f.cartaoVence)),
    });
    aviso('Metas salvas.');
  },

  'sinc.conectar': async (f, form) => {
    const botao = form.querySelector('button');
    botao.disabled = true;
    botao.textContent = 'Conectando…';
    try {
      await conectar(f.repo, f.token);
      aviso('Sincronização ligada.');
    } catch (e) {
      botao.disabled = false;
      botao.textContent = 'Ligar sincronização';
      return invalido(form.elements[e.campo || 'token'], e.message);
    }
  },
  'sinc.agora': async (_, botao) => {
    botao.disabled = true;
    await sincronizar();
  },
  'sinc.desconectar': () => {
    if (!confirm('Desconectar este aparelho? Os dados continuam aqui e no GitHub. Ele só para de sincronizar.')) return false;
    desconectar();
  },

  'lembretes.ativar': async (_, botao) => {
    botao.disabled = true;
    try {
      if (!(await ativar())) aviso('Sem a permissão, o app não consegue avisar. Você pode liberar depois nas configurações do navegador.');
      else aviso('Notificações ativadas neste aparelho.');
    } catch {
      aviso('Este navegador não conseguiu ativar as notificações. No celular, instale o app e tente por ele.');
    }
  },
  'lembretes.testar': async () => {
    try {
      await testarLembrete();
    } catch {
      aviso('Não consegui mostrar a notificação. Confira se elas estão liberadas para este site.');
    }
    return false;
  },
  'lembretes.desativar': async () => {
    await desativar().catch(() => {});
    aviso('Notificações desativadas neste aparelho.');
  },

  'config.instalar': async () => {
    await pwa.convite?.prompt();
    pwa.convite = null;
  },

  'config.gemini': (f) => {
    const g = gemini();
    salvarConfig({ key: texto(f.key) || g.key, model: texto(f.model) || MODELO_PADRAO });
    aviso('Configuração do Gemini salva.');
  },
  'config.removerChave': () => {
    salvarConfig({ model: gemini().model });
    aviso('Chave removida deste aparelho.');
  },
  'config.testar': async (_, botao) => {
    botao.disabled = true;
    botao.textContent = 'Testando…';
    try {
      await testar();
      aviso('Conexão com o Gemini funcionando.');
    } catch (e) {
      aviso(e.message);
    }
  },

  'config.exportar': () => {
    state.backupEm = hoje();
    baixar(`hendry-ia-backup-${hoje()}.json`, JSON.stringify(state, null, 2));
  },
  'config.importar': async (_, entrada) => {
    const arquivo = entrada.files[0];
    entrada.value = '';
    if (!arquivo) return false;
    let dados;
    try {
      dados = JSON.parse(await arquivo.text());
    } catch {
      return aviso('Esse arquivo não é um backup válido.'), false;
    }
    if (!confirm('Substituir todos os dados deste aparelho pelos do backup?')) return false;
    if (!substituir(dados)) aviso('Esse arquivo não é um backup deste app.');
    else aviso('Backup importado.');
    return false;
  },
  'config.apagar': () => {
    const pergunta = ligada()
      ? 'Apagar os dados deste aparelho e desconectá-lo da sincronização? O que já foi enviado continua no GitHub e nos outros aparelhos.'
      : 'Apagar todos os dados deste aparelho e voltar ao plano inicial? Isso não tem volta. Exporte um backup antes.';
    if (!confirm(pergunta)) return false;
    // Desconecta antes: apagar aqui não pode virar "apagar em todo lugar" na próxima sincronização.
    desconectar();
    apagarTudo();
    aviso('Dados apagados.');
    return false;
  },
});
