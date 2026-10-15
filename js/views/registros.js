import { state, actions, abrir, fechar, aviso, invalido } from '../core.js?v=6';
import { html, topo, campo, icon, dataMedia, dinheiro, n, vazio } from '../ui.js?v=6';
import { AREAS, TIPOS } from '../logic.js?v=6';
import { seletor, calendario } from '../widgets.js?v=6';
import { editarRegistro } from '../edicao.js?v=6';
import { filtroPeriodo, lerPeriodo } from '../periodos.js?v=6';

const TIPOS_REGISTRO = {
  todos: 'Todos', treinos: 'Treinos', refeicoes: 'Refeições', medidas: 'Peso', feitos: 'Ações concluídas',
  tasks: 'Tarefas', financas: 'Dinheiro', videos: 'Vídeos', leads: 'Leads', dias: 'Relatos e descanso', contatos: 'Contatos',
};
const EDITORES = { treinos: 'treino.abrir', refeicoes: 'comida.abrir', financas: 'fin.abrir', videos: 'video.abrir', leads: 'lead.abrir' };
let filtro = 'todos';
let periodo = null;

export function render() {
  const registros = Object.keys(TIPOS_REGISTRO).filter((k) => !['todos', 'dias', 'contatos'].includes(k)).flatMap((lista) => state[lista].map((r) => ({
    lista, id: r.id, data: r.data || r.feitaEm || r.criadaEm || r.criadoEm || '',
    titulo: r.titulo || r.empresa || r.nome || r.tipo || r.descricao || TIPOS_REGISTRO[lista],
    detalhe: lista === 'financas' ? `${TIPOS[r.tipo]} · ${dinheiro(r.valor)}${r.parcela ? ` · parcela ${r.parcela}` : ''}` : lista === 'medidas' ? `${n(r.peso)} kg` : lista === 'refeicoes' ? `${n(r.kcal)} kcal` : lista === 'tasks' ? (r.feitaEm ? 'Concluída' : 'Em aberto') : r.min ? `${r.min} min` : '',
  })));
  for (const [data, dia] of Object.entries(state.dias)) if (dia.nota || dia.descanso) registros.push({ lista: 'dias', id: data, data, titulo: 'Relato do dia', detalhe: dia.descanso ? 'Descanso registrado' : dia.nota.slice(0, 80) });
  for (const lead of state.leads) for (const [indice, contato] of (lead.atividades || []).entries()) registros.push({ lista: 'contatos', id: lead.id, indice, data: contato.data, titulo: lead.empresa, detalhe: `${contato.canal} · ${contato.resumo}` });
  const limites = periodo ? lerPeriodo(periodo) : null;
  const visiveis = registros.filter((r) => (filtro === 'todos' || r.lista === filtro) && (!limites || r.data >= limites[0] && r.data <= limites[1])).sort((a, b) => b.data.localeCompare(a.data));
  return html`${topo('Registros', 'Tudo o que entrou no aplicativo, com acesso à edição')}
    <p class="nota">Abra qualquer registro para corrigir os dados. As alterações atualizam os totais, gráficos e o contexto da IA.</p>
    <div class="barra">${filtroPeriodo('Período', periodo, 'registros.periodo', '30', periodo ? '' : 'Todas as datas')}<button class="btn btn-t" data-act="registros.todos">Limpar período</button></div>
    <div class="barra">${seletor('Tipo de registro', 'filtro', TIPOS_REGISTRO, filtro, { mudou: 'registros.filtro' })}<span>${visiveis.length} registros</span></div>
    ${visiveis.length ? html`<ul class="linhas">${visiveis.map((r) => html`<li><button class="linha" data-act="${EDITORES[r.lista] || 'registro.abrir'}" data-id="${r.id}" data-lista="${r.lista}" data-indice="${r.indice ?? ''}"><span class="principal">${r.titulo}</span><span class="lado">${r.data ? dataMedia(r.data) : ''} · Editar ${icon('caret-right', 14)}</span><span class="detalhe">${TIPOS_REGISTRO[r.lista]}${r.detalhe ? ` · ${r.detalhe}` : ''}</span></button></li>`)}</ul>` : vazio('Nenhum registro deste tipo ainda.')}`;
}

Object.assign(actions, {
  'registros.periodo': ({ valor }) => { periodo = valor; },
  'registros.todos': () => { periodo = null; },
  'registros.filtro': ({ valor }) => { filtro = valor; },
  'registro.abrir': ({ lista, id, indice }) => {
    const r = lista === 'dias' ? state.dias[id] : lista === 'contatos' ? state.leads.find((l) => l.id === id)?.atividades?.[Number(indice)] : state[lista]?.find((x) => x.id === id);
    if (!r) return aviso('Registro não encontrado.'), false;
    abrir(`Editar ${TIPOS_REGISTRO[lista]}`, html`<form class="dlg-corpo" data-act="registro.salvar" data-lista="${lista}" data-id="${id}" data-indice="${indice || ''}">
      ${['feitos', 'tasks'].includes(lista) && html`${campo('Título', html`<input name="titulo" required value="${r.titulo}">`)}${seletor('Área', 'area', AREAS, r.area)}${campo('Duração (min)', html`<input name="min" inputmode="numeric" value="${r.min || 0}">`)}`}
      ${lista === 'tasks' ? calendario('Prazo', 'prazo', r.prazo) : calendario('Data', 'data', lista === 'dias' ? id : r.data, { obrigatorio: true })}
      ${lista === 'medidas' && html`${campo('Peso (kg)', html`<input name="peso" required inputmode="decimal" value="${r.peso}">`)}${campo('Observações', html`<textarea name="obs" rows="3">${r.obs || ''}</textarea>`)}`}
      ${lista === 'dias' && html`${campo('Relato', html`<textarea name="nota" rows="8">${r.nota || ''}</textarea>`)}<label class="marcar"><input type="checkbox" name="descanso" ${r.descanso ? html`checked` : ''}>Descanso registrado</label>`}
      ${lista === 'contatos' && html`${seletor('Canal', 'canal', { WhatsApp: 'WhatsApp', Instagram: 'Instagram', 'E-mail': 'E-mail', Ligação: 'Ligação', Presencial: 'Presencial', Outro: 'Outro' }, r.canal)}${campo('Resumo do contato', html`<textarea name="resumo" required rows="4">${r.resumo}</textarea>`)}`}
      <footer class="dlg-acoes"><button class="btn btn-p">Salvar alterações</button></footer></form>`);
    return false;
  },
  'registro.salvar': (f, form) => {
    if (f.lista === 'dias') {
      if (f.data !== f.id && state.dias[f.data]?.nota) return invalido(form.elements.data, 'Já existe um relato nessa data. Escolha outra para não substituir o registro.');
      if (f.data !== f.id) { delete state.dias[f.id].nota; delete state.dias[f.id].descanso; }
      Object.assign(state.dias[f.data] ||= {}, { nota: f.nota.trim(), descanso: f.descanso === 'on' });
    } else if (f.lista === 'contatos') {
      const lead = state.leads.find((l) => l.id === f.id);
      const r = lead?.atividades?.[Number(f.indice)];
      if (!r) return aviso('Contato não encontrado.'), false;
      const vinculados = state.feitos.filter((a) => a.chave === `lead:${lead.id}` && a.data === r.data && a.titulo === `${r.canal}: ${lead.empresa}`);
      if (vinculados.length === 1) Object.assign(vinculados[0], { data: f.data, titulo: `${f.canal}: ${lead.empresa}` });
      Object.assign(r, { data: f.data, canal: f.canal, resumo: f.resumo.trim() });
    } else {
      const erro = editarRegistro(state, f.lista, f.id, f);
      if (erro) return erro.campo ? invalido(form.elements[erro.campo], erro.mensagem) : (aviso(erro.mensagem), false);
    }
    fechar(); aviso('Registro atualizado.');
  },
});
