// Painel de métricas: os mesmos registros do app, vistos semana a semana.
import { state, actions } from '../core.js?v=4';
import { html, topo, dataCurta, dinheiro, dinheiroCurto, n, compacto, pct } from '../ui.js?v=4';
import { seletor } from '../widgets.js?v=4';
import { hoje, somaDias } from '../logic.js?v=4';
import { semanasAte, serieSemanal, soma, funilDoPeriodo } from '../metricas.js?v=4';
import { barras, barrasH, linha } from '../graficos.js?v=4';
import { STATUS } from './conteudo.js?v=4';

const PERIODOS = { 4: 'Últimas 4 semanas', 8: 'Últimas 8 semanas', 12: 'Últimas 12 semanas' };
let periodo = '8';

const reaisCurtos = (cent) => `R$ ${compacto(cent / 100)}`;
const kg = (v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
const minutos = (v) => `${n(v)} min`;

// Comparação com a janela anterior de mesmo tamanho. Em texto comum: a cor fica reservada para os gráficos.
function variacao(agora, antes, formato = n) {
  if (agora === antes) return 'igual ao período anterior';
  return `${agora > antes ? '+' : '−'}${formato(Math.abs(agora - antes))} que no período anterior`;
}

export function render() {
  const qtd = Number(periodo);
  const semanas = semanasAte(hoje(), qtd);
  const serie = serieSemanal(state, semanas);
  const antes = serieSemanal(state, semanasAte(somaDias(semanas[0], -1), qtd));
  const coluna = (campo) => serie.map((s) => s[campo]);
  // Todo gráfico no tempo usa as mesmas semanas e destaca a atual, que ainda está em andamento.
  const noTempo = {
    rotulos: semanas.map(dataCurta),
    longos: serie.map((s) => `Semana de ${dataCurta(s.ini)} a ${dataCurta(s.fim)}`),
    destaque: 'semana atual',
    chave: false,
  };
  const { videosSemana, diasTreino, metaKcal, metaLancer } = state.settings;

  const acoes = soma(serie, 'negocio');
  const videos = soma(serie, 'videos');
  const treinos = soma(serie, 'treinos');
  const planejados = qtd * diasTreino.length;
  const reserva = serie.at(-1).reservado;
  const reservaNoPeriodo = reserva - antes.at(-1).reservado;
  const [minNegocio, minConteudo, minTotal] = ['minNegocio', 'minConteudo', 'minTotal'].map((c) => soma(serie, c));
  const pesos = coluna('peso').filter((p) => p != null);
  const reservas = coluna('reservado');
  const semNada = !serie.some((s) => s.negocio || s.conteudo || s.outras || s.leads || s.videos || s.treinos || s.kcal != null || s.peso != null || s.recebido || s.custos || s.reservado);

  return html`
    ${topo('Métricas', 'Os registros do app, semana a semana')}

    <div class="barra filtros">
      ${seletor('Período', 'periodo', PERIODOS, periodo, { mudou: 'metricas.periodo', oculto: true })}
    </div>

    <dl class="stats quatro">
      <div><dt>ações comerciais</dt><dd class="num">${n(acoes)}</dd><dd class="sub">${variacao(acoes, soma(antes, 'negocio'))}</dd></div>
      <div><dt>vídeos publicados</dt><dd class="num">${n(videos)}<small>/${qtd * videosSemana}</small></dd><dd class="sub">${variacao(videos, soma(antes, 'videos'))}</dd></div>
      <div><dt>treinos</dt><dd class="num">${n(treinos)}${planejados > 0 && html`<small>/${planejados}</small>`}</dd><dd class="sub">${variacao(treinos, soma(antes, 'treinos'))}</dd></div>
      <div><dt>reservado para o Lancer</dt><dd class="num">${dinheiroCurto(reserva)}</dd><dd class="sub">${reservaNoPeriodo === 0 ? 'sem aporte no período' : `${reservaNoPeriodo > 0 ? '+' : '−'}${dinheiroCurto(Math.abs(reservaNoPeriodo))} no período`}</dd></div>
    </dl>

    ${semNada
      ? html`
        <section class="bloco">
          <h2>Ainda sem dados para desenhar</h2>
          <p class="nota">Cada gráfico aparece assim que houver registro: conclua a tarefa do dia, cadastre um lead, lance uma refeição, um treino ou um aporte.</p>
          <div class="acoes"><a class="btn btn-s" href="#/hoje">Ir para Hoje</a></div>
        </section>`
      : html`
        <p class="graf-chave"><i class="s1"></i>Em vermelho, a semana atual, que ainda está em andamento.</p>

        <section class="bloco" aria-labelledby="m-exec">
          <h2 id="m-exec">Execução</h2>
          <div class="painel">
            ${barras({
              ...noTempo,
              titulo: 'Ações concluídas por semana',
              sub: 'Tudo que você marcou como feito, em qualquer frente.',
              series: [{ nome: 'Ações', valores: serie.map((s) => s.negocio + s.conteudo + s.outras) }],
              extras: [
                { nome: 'Negócio', valores: coluna('negocio') },
                { nome: 'Conteúdo', valores: coluna('conteudo') },
                { nome: 'Outras', valores: coluna('outras') },
              ],
            })}
            ${barrasH({
              titulo: 'Tempo por frente no período',
              sub: minConteudo > 0
                ? `${(minNegocio / minConteudo).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min de negócio para cada 1 de conteúdo. Referência: 3 para 1.`
                : 'Referência: 3 min de negócio para cada 1 de conteúdo.',
              formato: minutos,
              linhas: [
                { nome: 'Negócio', valor: minNegocio },
                { nome: 'Conteúdo', valor: minConteudo },
                { nome: 'Outras', valor: minTotal - minNegocio - minConteudo },
              ],
              vazio: 'Nenhuma ação concluída neste período.',
            })}
          </div>
        </section>

        <section class="bloco" aria-labelledby="m-prosp">
          <h2 id="m-prosp">Prospecção</h2>
          <div class="painel">
            ${barras({ ...noTempo, titulo: 'Leads novos por semana', series: [{ nome: 'Leads novos', valores: coluna('leads') }], vazio: 'Nenhum lead cadastrado neste período.' })}
            ${barrasH({
              titulo: 'Funil dos leads do período',
              sub: 'Até onde chegaram os leads cadastrados nestas semanas.',
              colunaNota: 'Passagem',
              linhas: funilDoPeriodo(state.leads, semanas[0]).map((e) => ({
                nome: e.nome,
                valor: e.valor,
                nota: e.taxa == null ? '' : pct(e.taxa),
                detalhe: e.base == null ? '' : e.taxa == null ? `sem ${e.deQue} ainda` : `${e.valor} de ${e.base} ${e.deQue} (${pct(e.taxa)})`,
              })),
              vazio: 'Nenhum lead cadastrado neste período.',
            })}
          </div>
        </section>

        <section class="bloco" aria-labelledby="m-cont">
          <h2 id="m-cont">Conteúdo</h2>
          <div class="painel">
            ${barras({
              ...noTempo,
              titulo: 'Vídeos publicados por semana',
              sub: 'Um vídeo em três plataformas conta uma vez.',
              series: [{ nome: 'Vídeos', valores: coluna('videos') }],
              meta: { valor: videosSemana, rotulo: `meta ${videosSemana}` },
              vazio: 'Nenhum vídeo publicado neste período.',
            })}
            ${barrasH({
              titulo: 'Pauta por etapa',
              sub: 'Situação de agora, sem filtro de período.',
              linhas: Object.entries(STATUS).map(([chave, nome]) => ({ nome, valor: state.videos.filter((v) => v.status === chave).length })),
            })}
          </div>
        </section>

        <section class="bloco" aria-labelledby="m-corpo">
          <h2 id="m-corpo">Corpo</h2>
          <div class="painel">
            ${barras({
              ...noTempo,
              titulo: 'Treinos por semana',
              series: [{ nome: 'Treinos', valores: coluna('treinos') }],
              meta: diasTreino.length > 0 && { valor: diasTreino.length, rotulo: `planejado ${diasTreino.length}` },
              vazio: 'Nenhum treino registrado neste período.',
            })}
            ${barras({
              ...noTempo,
              titulo: 'Calorias por dia, média da semana',
              sub: 'Consumo e gasto estimado nos dias com refeição registrada. O gasto requer perfil e peso.',
              series: [{ nome: 'Consumo', cor: 'sn', valores: coluna('kcal') }, { nome: 'Gasto total', cor: 's0', valores: coluna('gasto') }],
              formato: (v) => `${n(v)} kcal`,
              eixo: compacto,
              inteiro: false,
              meta: metaKcal > 0 && { valor: metaKcal, rotulo: `meta ${n(metaKcal)}` },
              vazio: 'Nenhuma refeição registrada neste período.',
            })}
            ${linha({
              ...noTempo,
              titulo: 'Peso',
              sub: pesos.length > 0 ? `Última medida: ${kg(pesos.at(-1))}. O eixo acompanha a faixa das medidas, não começa no zero.` : '',
              nome: 'Peso',
              valores: coluna('peso'),
              formato: kg,
              eixo: n,
              vazio: 'Nenhuma medida registrada neste período.',
            })}
          </div>
        </section>

        <section class="bloco" aria-labelledby="m-lancer">
          <h2 id="m-lancer">Lancer e dinheiro</h2>
          <div class="painel">
            ${linha({
              ...noTempo,
              titulo: 'Reserva acumulada',
              sub: metaLancer > 0 ? `${dinheiroCurto(reserva)} de ${dinheiroCurto(metaLancer)} (${pct(reserva / metaLancer)}).` : `${dinheiroCurto(reserva)} reservados.`,
              nome: 'Reservado',
              // Antes do primeiro aporte não há ponto: a linha começa onde a reserva começa.
              valores: reservas.map((v, i) => (reservas.slice(0, i + 1).every((x) => x === 0) ? null : v)),
              formato: dinheiro,
              eixo: reaisCurtos,
              zero: true,
              meta: metaLancer > 0 && { valor: metaLancer, rotulo: 'meta' },
              vazio: 'Nenhum aporte na reserva até aqui.',
            })}
            ${barras({
              ...noTempo,
              titulo: 'Recebido e custos por semana',
              sub: 'Custos incluem impostos. Receita a receber não entra.',
              series: [
                { nome: 'Recebido', cor: 'sn', valores: coluna('recebido') },
                { nome: 'Custos', cor: 's0', valores: coluna('custos') },
              ],
              formato: dinheiro,
              eixo: reaisCurtos,
              inteiro: false,
              vazio: 'Nenhuma receita ou custo neste período.',
            })}
          </div>
        </section>`}`;
}

Object.assign(actions, {
  'metricas.periodo': ({ valor }) => {
    periodo = valor;
  },
});
