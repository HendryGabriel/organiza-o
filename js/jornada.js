import { html, icon, n, dinheiroCurto } from './ui.js?v=4';
import { hoje, resumoSemana, progressoDoJogo, financas, funil, inicioSemana, dataRegistroVideo } from './logic.js?v=4';

const ARENAS = {
  hoje: ['CENTRAL DE MISSÕES', 'Um passo hoje. Um novo nível amanhã.', 'Escolha sua missão, registre o que fez e acompanhe a sua evolução.', 'lightning'],
  negocio: ['BASE DE NEGÓCIOS', 'Sua próxima conquista começa com uma conversa.', 'Encontre oportunidades, avance no funil e construa sua carteira de clientes.', 'handshake'],
  corpo: ['ARENA DA EVOLUÇÃO', 'Seu personagem evolui com você.', 'Treinos, alimentação e peso: cada registro ajuda a enxergar sua jornada.', 'barbell'],
  lancer: ['GARAGEM DOS OBJETIVOS', 'Cada aporte aproxima você da próxima fase.', 'Acompanhe sua reserva, organize os gastos e avance em direção ao Lancer.', 'gauge'],
  metricas: ['PAINEL DE EVOLUÇÃO', 'Veja até onde você já chegou.', 'Seus registros viram gráficos. Explore as áreas e compare os períodos.', 'chart-line-up'],
  semana: ['FIM DO CAPÍTULO', 'Reveja a semana. Prepare a próxima.', 'Observe os resultados e escolha suas próximas prioridades.', 'chart-bar'],
  tarefas: ['DIÁRIO DE MISSÕES', 'Tire as ideias do papel.', 'Organize as tarefas extras, escolha o próximo passo e marque suas conquistas.', 'list-checks'],
  rotina: ['MAPA DA CAMPANHA', 'Uma rota para cada dia.', 'Monte seu plano para dias difíceis, normais e livres. Seu ritmo define o caminho.', 'calendar-check'],
  config: ['BASE DE OPERAÇÕES', 'Prepare as ferramentas da sua jornada.', 'Personalize suas metas e cuide do perfil, dos backups e das conexões.', 'gear-six'],
  mais: ['PORTAL DE ÁREAS', 'Escolha seu próximo destino.', 'Acesse os painéis, organize suas missões e ajuste a sua base.', 'list'],
};

export function painelDaArea(state, rota, sub) {
  if (!ARENAS[rota]) return html``;
  const [nome, titulo, descricao, icone] = ARENAS[rota];
  const ref = rota === 'semana' && /^\d{4}-\d{2}-\d{2}$/.test(sub || '') ? inicioSemana(sub) : hoje();
  const s = resumoSemana(state, ref);
  let valor, rotulo, detalhe, fracao = null, links = [];
  switch (rota) {
    case 'hoje': {
      const jogo = progressoDoJogo(state, hoje());
      valor = `LVL ${jogo.nivel}`; rotulo = `${n(jogo.xp)} XP conquistados`; detalhe = `${jogo.atual} / ${jogo.proximo} XP para o próximo nível`; fracao = jogo.atual / jogo.proximo;
      links = [['handshake', 'Negócio', 'Avance nas oportunidades', '#/negocio'], ['film-slate', 'Conteúdo', 'Continue suas produções', '#/conteudo'], ['barbell', 'Corpo', 'Registre sua evolução', '#/corpo']]; break;
    }
    case 'negocio': {
      const f = funil(state.leads); valor = n(f.ganhos); rotulo = 'clientes conquistados'; detalhe = `${f.total} oportunidades no funil`;
      links = [['plus', 'Nova oportunidade', 'Cadastre um lead', '', 'lead.novo'], ['chart-line-up', 'Resultados', 'Veja a evolução comercial', '#/metricas'], ['list-checks', 'Próximas ações', 'Organize as tarefas extras', '#/tarefas']]; break;
    }
    case 'corpo': {
      const dias = new Set(state.treinos.filter((t) => t.data >= s.ini && t.data <= s.fim).map((t) => t.data)).size;
      valor = n(dias); rotulo = 'dias de treino nesta semana'; detalhe = state.settings.diasTreino.length ? `${dias} / ${state.settings.diasTreino.length} dias planejados` : 'Configure os dias de treino para acompanhar a meta'; fracao = state.settings.diasTreino.length ? dias / state.settings.diasTreino.length : null;
      links = [['barbell', 'Treinos', 'Musculação e cárdio', '#/corpo/treino'], ['camera', 'Alimentação', 'Consumo e gastos', '#/corpo/comida'], ['chart-line-up', 'Peso', 'Acompanhe suas medidas', '#/corpo/medidas']]; break;
    }
    case 'lancer': {
      const f = financas(state.financas); valor = dinheiroCurto(f.reservado); rotulo = 'na reserva do Lancer'; detalhe = state.settings.metaLancer > 0 ? `Meta: ${dinheiroCurto(state.settings.metaLancer)}` : 'Defina a meta na aba Placar'; fracao = state.settings.metaLancer > 0 ? f.reservado / state.settings.metaLancer : null;
      links = [['gauge', 'Placar', 'Sua reserva e sua meta', '#/lancer/placar'], ['chart-line-up', 'Análise', 'Entenda entradas e saídas', '#/lancer/analise'], ['plus', 'Lançamentos', 'Registre as movimentações', '#/lancer/lancamentos']]; break;
    }
    case 'metricas':
      valor = n(state.feitos.length); rotulo = 'ações registradas'; detalhe = 'Histórico de execução em todas as áreas';
      links = [['lightning', 'Execução', 'Registre o que você fez', '#/hoje'], ['film-slate', 'Produção', `${state.videos.filter(dataRegistroVideo).length} vídeos registrados`, '#/conteudo'], ['gauge', 'Reserva', 'Acompanhe seu objetivo', '#/lancer']]; break;
    case 'semana':
      valor = n(s.feitos.length); rotulo = 'ações concluídas na semana'; detalhe = `${s.videos} vídeos publicados · ${s.treinos} treinos`;
      links = [['lightning', 'Missões de hoje', 'Continue o capítulo', '#/hoje'], ['calendar-check', 'Planejar', 'Ajuste sua rotina', '#/rotina'], ['chart-line-up', 'Evolução', 'Compare as semanas', '#/metricas']]; break;
    case 'tarefas': {
      const feitas = state.tasks.filter((t) => t.feitaEm).length; valor = n(state.tasks.length - feitas); rotulo = 'missões extras em aberto'; detalhe = `${feitas} concluídas de ${state.tasks.length} cadastradas`; fracao = state.tasks.length ? feitas / state.tasks.length : null;
      links = [['lightning', 'Missão do dia', 'Seu plano principal', '#/hoje'], ['calendar-check', 'Rotina', 'Organize a campanha', '#/rotina']]; break;
    }
    case 'rotina':
      valor = n(Object.keys(state.rotina).length); rotulo = 'dias com plano definido'; detalhe = 'Versões de 5, 30 e 90 minutos';
      links = [['lightning', 'Jogar hoje', 'Escolha seu tempo disponível', '#/hoje'], ['list-checks', 'Tarefas extras', 'Missões fora da rotina', '#/tarefas']]; break;
    case 'config': {
      const campos = [state.settings.sexo, state.settings.idade, state.settings.altura].filter(Boolean).length;
      valor = `${campos}/3`; rotulo = 'campos do perfil preenchidos'; detalhe = 'Sexo, idade e altura para estimar o gasto'; fracao = campos / 3;
      links = [['barbell', 'Completar perfil', 'Perfil e peso corporal', '#/corpo/medidas'], ['download-simple', 'Guardar progresso', 'Exportar backup dos dados', '', 'config.exportar']]; break;
    }
    default: valor = '5'; rotulo = 'ferramentas de apoio'; detalhe = 'Métricas, semana, tarefas, rotina e configurações';
  }
  const porcentagem = Math.round(Math.max(0, Math.min(1, fracao || 0)) * 100);
  return html`<section class="arena-hero" aria-label="Painel da área"><div class="arena-hero-texto"><span class="arena-kicker">${icon(icone, 16)} ${nome}</span><h2>${titulo}</h2><p>${descricao}</p><span class="arena-legenda">${detalhe}</span>${fracao != null && html`<progress value="${porcentagem}" max="100" aria-label="${detalhe}"></progress>`}</div><div class="arena-trofeu"><span class="arena-emblema">${icon(icone, 52)}</span><b>${valor}</b><span>${rotulo}</span></div></section>${links.length > 0 && html`<div class="arena-atalhos" aria-label="Atalhos da área">${links.map(([ic, texto, dica, destino, acao]) => acao
    ? html`<button class="arena-atalho" data-act="${acao}"><span class="arena-atalho-icone">${icon(ic, 25)}</span><span><strong>${texto}</strong><small>${dica}</small></span><b aria-hidden="true">↗</b></button>`
    : html`<a class="arena-atalho" href="${destino}"><span class="arena-atalho-icone">${icon(ic, 25)}</span><span><strong>${texto}</strong><small>${dica}</small></span><b aria-hidden="true">↗</b></a>`)}</div>`}`;
}
