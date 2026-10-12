import { state, actions, registrarFeito, abrir, fechar, uid, texto } from '../core.js';
import { html, attr, icon, topo, campo, opcoes, vazio, dataCurta, pct } from '../ui.js';
import { hoje, funil, taxa, mudarEtapa, ETAPAS, FUNIL, FECHADOS } from '../logic.js';

const CANAIS = ['WhatsApp', 'Instagram', 'E-mail', 'Ligação', 'Presencial', 'Outro'];
const CAMPOS = ['empresa', 'segmento', 'cidade', 'contato', 'origem', 'problema', 'obs', 'proximoPasso', 'followUp'];

let filtro = 'ativos';

// Toda taxa mostra de onde veio: "2 de 9 abordados (22%)". Sem denominador, não mostra taxa.
const fracao = (parte, todo, base) => (taxa(parte, todo) == null ? `sem ${base} ainda` : `${parte} de ${todo} ${base} (${pct(taxa(parte, todo))})`);

function formLead(l) {
  const novo = !l;
  l ||= { status: 'pesquisado', atividades: [] };
  return html`
    <form class="dlg-corpo" data-act="lead.salvar" data-id="${l.id || ''}">
      ${campo('Empresa ou escritório', html`<input name="empresa" required value="${l.empresa || ''}" autocomplete="off">`)}
      <div class="dupla">
        ${campo('Etapa', html`<select name="status">${opcoes(ETAPAS, l.status)}</select>`)}
        ${campo('Próximo contato', html`<input type="date" name="followUp" value="${l.followUp || ''}">`)}
      </div>
      ${campo('Próximo passo', html`<input name="proximoPasso" value="${l.proximoPasso || ''}" autocomplete="off" placeholder="Ex.: enviar a demo de 90 segundos…">`)}

      ${!novo && html`
        <fieldset class="grupo">
          <legend>Registrar contato feito hoje</legend>
          <div class="dupla">
            ${campo('Canal', html`<select name="canal">${CANAIS.map((c) => html`<option>${c}</option>`)}</select>`)}
            ${campo('O que aconteceu', html`<input name="resumo" autocomplete="off" placeholder="Ex.: mandei a abordagem…">`)}
          </div>
          <small>Conta como ação comercial do dia e marca o lead como abordado.</small>
        </fieldset>`}

      <details>
        <summary>Mais detalhes</summary>
        <div class="pilha">
          <div class="dupla">
            ${campo('Segmento', html`<input name="segmento" value="${l.segmento || ''}" autocomplete="off" placeholder="Ex.: advocacia trabalhista…">`)}
            ${campo('Cidade', html`<input name="cidade" value="${l.cidade || ''}" autocomplete="off">`)}
          </div>
          ${campo('Contato público', html`<input name="contato" value="${l.contato || ''}" autocomplete="off" placeholder="Site, Instagram ou telefone comercial…">`)}
          ${campo('Onde encontrou', html`<input name="origem" value="${l.origem || ''}" autocomplete="off">`)}
          ${campo('Problema observado', html`<textarea name="problema" rows="2">${l.problema || ''}</textarea>`, 'Só o que você viu de fato. Hipótese não é fato.')}
          ${campo('Observações', html`<textarea name="obs" rows="2">${l.obs || ''}</textarea>`)}
        </div>
      </details>

      ${l.atividades.length > 0 && html`
        <section>
          <h3>Histórico</h3>
          <ul class="historico">${l.atividades.map((a) => html`<li><b>${dataCurta(a.data)} · ${a.canal}</b> ${a.resumo}</li>`)}</ul>
        </section>`}

      <footer class="dlg-acoes">
        ${!novo && html`<button type="button" class="btn btn-t perigo" data-act="lead.excluir" data-id="${l.id}">Excluir</button>`}
        <button class="btn btn-p">Salvar lead</button>
      </footer>
      ${novo && html`<small>Só empresas sem relação com o seu emprego. Mensagem sempre revisada e enviada por você.</small>`}
    </form>`;
}

export function render() {
  const d = hoje();
  const f = funil(state.leads);
  const visiveis = state.leads
    .filter((l) => (filtro === 'todos' ? true : filtro === 'ativos' ? !FECHADOS.includes(l.status) : l.status === filtro))
    // Quem tem contato marcado vem primeiro, do mais atrasado ao mais distante.
    .sort((a, b) => (a.followUp || '9').localeCompare(b.followUp || '9') || (a.id < b.id ? 1 : -1)); // sem data: mais novo primeiro

  return html`
    ${topo('Negócio', 'Funil de prospecção')}

    <dl class="stats funil">
      <div><dt>abordados</dt><dd class="num">${f.abordados}</dd><dd class="sub">de ${f.total} no funil</dd></div>
      <div><dt>responderam</dt><dd class="num">${f.responderam}</dd><dd class="sub">${fracao(f.responderam, f.abordados, 'abordados')}</dd></div>
      <div><dt>demos</dt><dd class="num">${f.demos}</dd><dd class="sub">${fracao(f.demos, f.responderam, 'respostas')}</dd></div>
      <div><dt>propostas</dt><dd class="num">${f.propostas}</dd><dd class="sub">enviadas</dd></div>
      <div><dt>clientes</dt><dd class="num">${f.ganhos}</dd><dd class="sub">${fracao(f.ganhos, f.propostas, 'propostas')}</dd></div>
    </dl>

    <div class="barra">
      <label class="campo em-linha">
        <span class="sr">Filtrar por etapa</span>
        <select data-mudou="lead.filtro">
          <option value="ativos" ${attr('selected', filtro === 'ativos')}>Em andamento</option>
          <option value="todos" ${attr('selected', filtro === 'todos')}>Todos</option>
          ${opcoes(ETAPAS, filtro)}
        </select>
      </label>
      <button class="btn btn-p" data-act="lead.novo">${icon('plus')} Novo lead</button>
    </div>

    ${visiveis.length === 0
      ? vazio(state.leads.length ? 'Nenhum lead nessa etapa.' : 'Nenhum lead ainda. Cadastrar um leva menos de 1 minuto: nome e próximo passo.')
      : html`
        <ul class="linhas">
          ${visiveis.map((l) => html`
            <li>
              <button class="linha" data-act="lead.abrir" data-id="${l.id}">
                <span class="principal">${l.empresa}</span>
                <span class="lado ${l.followUp && l.followUp <= d ? 'alerta' : ''}">${l.followUp ? dataCurta(l.followUp) : ''}</span>
                <span class="detalhe">${ETAPAS[l.status]}${l.proximoPasso && html` · ${l.proximoPasso}`}</span>
              </button>
            </li>`)}
        </ul>`}`;
}

Object.assign(actions, {
  'lead.filtro': ({ valor }) => {
    filtro = valor;
  },

  'lead.novo': () => {
    abrir('Novo lead', formLead());
    return false;
  },

  'lead.abrir': ({ id }) => {
    const l = state.leads.find((x) => x.id === id);
    if (l) abrir(l.empresa, formLead(l));
    return false;
  },

  'lead.salvar': (f) => {
    let l = state.leads.find((x) => x.id === f.id);
    if (!l) state.leads.unshift((l = { id: uid(), criadoEm: hoje(), atividades: [], auge: 0 }));
    for (const k of CAMPOS) l[k] = texto(f[k]);
    mudarEtapa(l, f.status);
    const resumo = texto(f.resumo);
    if (resumo) {
      l.atividades.unshift({ data: hoje(), canal: f.canal, resumo });
      registrarFeito({ chave: `lead:${l.id}`, titulo: `${f.canal}: ${l.empresa}`, area: 'clientes', min: 5 });
      if (FUNIL.indexOf(l.status) >= 0 && FUNIL.indexOf(l.status) < FUNIL.indexOf('abordado')) mudarEtapa(l, 'abordado');
      // O contato marcado foi cumprido. Se houver próximo, a data nova já veio no formulário.
      if (l.followUp && l.followUp <= hoje()) l.followUp = '';
    }
    fechar();
  },

  // "Não contatar" preserva o histórico; excluir é só para cadastro errado.
  'lead.excluir': ({ id }) => {
    if (!confirm('Excluir este lead e o histórico dele? Para parar de abordar sem perder o histórico, use a etapa "Não contatar".')) return false;
    state.leads = state.leads.filter((l) => l.id !== id);
    fechar();
  },
});
