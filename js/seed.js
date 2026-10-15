// Estado inicial: o plano de 12/10 a 31/12/2026 e a pauta de vídeos da planilha de planejamento.
import { somaDias } from './logic.js?v=6';

const dia = (area, t5, t30, t90) => ({ area, t5, t30, t90 });

// Semana de preparação: cada dia tem tarefa própria.
const SEMANA_1 = {
  '2026-10-12': dia('organizacao', 'Criar a pasta do projeto', 'Organizar arquivos e planilha', 'Separar referências e modelos'),
  '2026-10-13': dia('conteudo', 'Definir a bio do perfil', 'Configurar perfis e links', 'Revisar a identidade simples'),
  '2026-10-14': dia('conteudo', 'Gravar 1 take em casa', 'Gravar 6 takes no setup', 'Criar a biblioteca de B-roll'),
  '2026-10-15': dia('conteudo', 'Escolher o estilo de legenda', 'Montar o template 9:16', 'Testar exportação e legenda'),
  '2026-10-16': dia('produto', 'Escrever a oferta em 3 frases', 'Definir escopo e limites da automação', 'Preparar a mensagem de prospecção'),
  '2026-10-17': dia('conteudo', 'Gravar a introdução', 'Editar o vídeo 1 do Lancer', 'Preparar o segundo vídeo'),
  '2026-10-18': dia('revisao', 'Revisar o que foi feito', 'Escolher as prioridades da próxima semana', 'Descansar e organizar arquivos'),
};

// Rotina por dia da semana (0 = domingo). Vale para toda data sem plano próprio.
const ROTINA = {
  1: dia('clientes', 'Encontrar 1 escritório qualificado', 'Pesquisar 3 escritórios e registrar no funil', 'Pesquisar 10 e preparar abordagens'),
  2: dia('clientes', 'Revisar 1 mensagem comercial', 'Enviar 2 abordagens personalizadas', 'Enviar 5 abordagens e atualizar o funil'),
  3: dia('conteudo', 'Registrar 1 take ou ideia', 'Criar ou publicar 1 vídeo curto', 'Gravar 3 takes e editar 1 vídeo'),
  4: dia('produto', 'Verificar 1 retorno pendente', 'Fazer follow-up e testar a demonstração', 'Melhorar a demo e fazer uma chamada comercial'),
  5: dia('clientes', 'Registrar 1 resultado da semana', 'Enviar 3 abordagens e revisar o funil', 'Preparar proposta ou vídeo de demonstração'),
  6: dia('produto', 'Gravar 1 take do projeto', 'Trabalhar 30 min na oferta ou na demo', 'Sessão profunda: demo e gravações'),
  0: dia('revisao', 'Revisar a semana em 5 min', 'Planejar 3 prioridades e descansar', 'Preparar 1 roteiro e organizar a semana'),
};

const pauta = (quadro, inicio, temas) =>
  temas.map((titulo, i) => ({
    id: `pauta-${quadro}-${i}`,
    quadro,
    titulo,
    status: 'ideia',
    previsto: somaDias(inicio, 7 * i),
    criadoEm: '2026-10-11',
    pubs: {},
  }));

export const seed = () => ({
  v: 1,
  settings: {
    cicloInicio: '2026-10-12',
    cicloFim: '2026-12-31',
    diasTreino: [],
    videosSemana: 2,
    metaLancer: 0, // centavos
    metaKcal: 0,
    metaProteina: 0,
    // Perfil para estimar o gasto de calorias. Vazio até a pessoa preencher: sem ele o app não chuta.
    sexo: '',
    idade: 0,
    altura: 0, // cm
    rotina: 'sentado',
    metaPeso: 0, // kg
    // Cartão de crédito: dias do mês em que a fatura fecha e vence. Zero até a pessoa informar.
    cartaoFecha: 0,
    cartaoVence: 0,
  },
  fases: [
    { nome: 'Preparação', ate: '2026-10-18' },
    { nome: 'Começar e publicar', ate: '2026-10-31' },
    { nome: 'Validar a oferta', ate: '2026-11-30' },
    { nome: 'Consolidar', ate: '2026-12-31' },
  ],
  rotina: structuredClone(ROTINA),
  plano: structuredClone(SEMANA_1),
  dias: {},
  feitos: [],
  tasks: [],
  leads: [],
  videos: [
    ...pauta('lancer', '2026-10-14', [
      'Começando o desafio', 'Minha primeira oferta', 'Demo do atendente', 'Prospectando escritórios',
      'Primeiras respostas', 'Quanto custa a automação', 'Testando a oferta', 'Objeções que ouvi',
      'Melhorando o produto', 'Resultado das prospecções', 'O que aprendi', 'Balanço do ano',
    ]),
    ...pauta('gostoso', '2026-10-17', [
      'Ponto de partida', 'Rotina após o trabalho', 'Treino da semana', 'Primeira evolução',
      'Consistência', 'Dificuldades', 'Cargas e progresso', 'Evolução mensal',
      'Alimentação', 'Rotina real', 'O que mudou',
    ]),
  ].sort((a, b) => a.previsto.localeCompare(b.previsto)),
  financas: [],
  treinos: [],
  refeicoes: [],
  medidas: [],
  revisoes: {},
  aparelhos: {}, // inscrição de notificação de cada aparelho e a chave que assina os lembretes
  apagados: {}, // exclusões, para a sincronização não trazer de volta o que foi apagado
  timer: null,
  backupEm: null,
});
