// Rode com: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../js/seed.js';
import { num, centavos, inicioSemana, somaDias, planoDoDia, faseDe, candidatos, mudarEtapa, funil, taxa, financas, normalizarRefeicao, normalizarDia, resumoSemana } from '../js/logic.js';

test('num entende o jeito brasileiro de digitar', () => {
  assert.equal(num('1.250,50'), 1250.5);
  assert.equal(num('1.250'), 1250);
  assert.equal(num('85.000'), 85000);
  assert.equal(num('80.5'), 80.5);
  assert.equal(num('78,4'), 78.4);
  assert.equal(num('R$ 697,00'), 697);
  assert.ok(Number.isNaN(num('')));
  assert.ok(Number.isNaN(num('abc')));
  assert.equal(centavos('0,1') + centavos('0,2'), 30);
});

test('semana começa na segunda', () => {
  assert.equal(inicioSemana('2026-10-11'), '2026-10-05'); // domingo
  assert.equal(inicioSemana('2026-10-12'), '2026-10-12'); // segunda
  assert.equal(somaDias('2026-10-31', 1), '2026-11-01');
});

test('plano: semana 1 tem tarefa própria, depois vale a rotina', () => {
  const s = seed();
  assert.equal(planoDoDia(s, '2026-10-12').t5, 'Criar a pasta do projeto');
  assert.equal(planoDoDia(s, '2026-10-19').t5, 'Encontrar 1 escritório qualificado');
  assert.equal(faseDe(s, '2026-10-11'), null);
  assert.equal(faseDe(s, '2026-11-15').nome, 'Validar a oferta');
  assert.equal(faseDe(s, '2026-12-31').nome, 'Consolidar');
  assert.equal(s.videos.length, 23);
});

test('tarefa do dia: follow-up vencido vem antes, depois prazo, depois o plano', () => {
  const s = seed();
  const d = '2026-10-19';
  assert.equal(candidatos(s, d, 5)[0].titulo, 'Encontrar 1 escritório qualificado');
  assert.equal(candidatos(s, d, 30)[0].min, 30);
  assert.deepEqual(candidatos(s, d, 90).map((c) => c.min), [90, 30, 5]);

  s.tasks.push({ id: 't1', titulo: 'Longa', area: 'sistema', min: 90 }, { id: 't2', titulo: 'Com prazo', area: 'sistema', min: 5, prazo: d });
  s.leads.push({ id: 'l1', empresa: 'Escritório Fictício', status: 'abordado', followUp: '2026-10-18' }, { id: 'l2', empresa: 'Fechado', status: 'perdido', followUp: '2026-10-18' });
  assert.deepEqual(candidatos(s, d, 5).map((c) => c.chave), ['lead:l1', 'task:t2', 'plano:5']); // t1 não cabe em 5 min

  // Trocar tira da lista de hoje; concluir também. Nada disso existe amanhã.
  s.dias[d] = { pulos: ['lead:l1'] };
  s.feitos.push({ data: d, chave: 'task:t2' });
  assert.deepEqual(candidatos(s, d, 5).map((c) => c.chave), ['plano:5']);
  assert.ok(candidatos(s, somaDias(d, 1), 5).some((c) => c.chave === 'lead:l1'));

  // Tarefa adiada só volta na data.
  s.tasks[0].adiadaAte = somaDias(d, 1);
  assert.ok(!candidatos(s, d, 90).some((c) => c.chave === 'task:t1'));
  assert.ok(candidatos(s, somaDias(d, 1), 90).some((c) => c.chave === 'task:t1'));
});

test('funil: taxa tem denominador e lead perdido não apaga o que já aconteceu', () => {
  assert.equal(taxa(0, 0), null);
  const leads = [{}, {}, {}, {}].map((l) => ({ ...l, auge: 0 }));
  mudarEtapa(leads[0], 'abordado');
  mudarEtapa(leads[1], 'demo');
  mudarEtapa(leads[1], 'perdido');
  mudarEtapa(leads[2], 'sem_resposta');
  mudarEtapa(leads[3], 'proposta');
  mudarEtapa(leads[3], 'ganho');
  assert.deepEqual(funil(leads), { total: 4, abordados: 4, responderam: 2, demos: 2, propostas: 1, ganhos: 1 });
  assert.equal(taxa(2, 4), 0.5);
});

test('Lancer: só aporte registrado mexe no placar', () => {
  const f = financas([
    { tipo: 'receita', valor: 100000, recebido: true },
    { tipo: 'receita', valor: 50000, recebido: false },
    { tipo: 'custo', valor: 20000 },
    { tipo: 'imposto', valor: 6000 },
  ]);
  assert.equal(f.reservado, 0); // faturar não é reservar
  assert.equal(f.recebido, 100000);
  assert.equal(f.aReceber, 50000);
  assert.equal(f.resultado, 74000);
  assert.equal(financas([{ tipo: 'reserva', valor: 30000 }, { tipo: 'retirada', valor: 5000 }]).reservado, 25000);
  // Salário e gasto pessoal ficam registrados, mas não entram no resultado do negócio.
  const misto = financas([{ tipo: 'receita', valor: 100000 }, { tipo: 'receita', categoria: 'salario', valor: 400000 }, { tipo: 'custo', categoria: 'mercado', valor: 60000 }, { tipo: 'custo', valor: 10000 }]);
  assert.equal(misto.recebido, 100000);
  assert.equal(misto.custos, 10000);
  assert.equal(misto.resultado, 90000);
});

test('resposta da IA é saneada antes de entrar no app', () => {
  const r = normalizarRefeicao({ nome: 'Almoço', itens: [{ nome: 'Arroz', porcao: '150 g', kcal: '195.4', proteina: 4, carbo: 42, gordura: -3 }, null], confianca: 'altíssima' });
  assert.deepEqual(r.itens[0], { nome: 'Arroz', porcao: '150 g', kcal: 195, p: 4, c: 42, g: 0 });
  assert.equal(r.itens[1].kcal, 0);
  assert.equal(r.confianca, 'media');
  assert.deepEqual(normalizarRefeicao('lixo').itens, []);
});

test('relato do dia: o que a IA devolve só entra com data, número e categoria válidos', () => {
  const hoje = '2026-03-03';
  const d = normalizarDia(
    {
      relato: 'treinei perna',
      treinos: [{ data: '2026-03-02', tipo: 'Perna', minutos: '60' }, { data: '2026-02-30', tipo: '' }, { data: '2026-01-01', tipo: 'Corrida', minutos: 99999 }],
      refeicoes: [{ data: '2026-03-03', nome: 'Almoço', itens: [{ nome: 'Arroz', porcao: '150 g', kcal: 195, proteina: 4, carbo: 42, gordura: 0 }] }, { nome: 'Vazia', itens: [] }],
      acoes: [{ data: '2026-03-09', titulo: 'Editei o vídeo', area: 'conteudo', minutos: 40 }, { titulo: 'Li um livro', area: 'constructor' }, { titulo: '   ' }],
      contatos: [
        { empresa: 'Escritório Silva', canal: 'WhatsApp', resumo: 'mandei a demo', respondeu: 'sim', proximo_contato: '2026-03-10' },
        { empresa: 'Padaria Sol', canal: 'Pombo', respondeu: true, proximo_contato: '2026-03-01' },
        { empresa: '' },
      ],
      financas: [{ tipo: 'receita', categoria: 'salario', valor: 1500.5, descricao: 'Site' }, { tipo: 'custo', categoria: 'toString', valor: -49.9 }, { tipo: 'salario', valor: 3000 }, { tipo: 'custo', valor: 0 }],
      tarefas: [{ titulo: 'Ligar para o contador', area: 'organizacao', minutos: 30, prazo: '2026-03-06' }, { titulo: 'Sem prazo', minutos: 7, prazo: '2020-01-01' }, { titulo: '' }],
      resposta: 'Anotei.',
      peso: '78.44',
    },
    hoje,
  );
  // Ontem vale. Data que não existe, data antiga e data no futuro viram hoje.
  assert.deepEqual(d.treinos, [
    { data: '2026-03-02', tipo: 'Perna', min: 60, obs: '' },
    { data: hoje, tipo: 'Treino', min: 0, obs: '' },
    { data: hoje, tipo: 'Corrida', min: 600, obs: '' },
  ]);
  assert.equal(d.refeicoes.length, 1);
  assert.deepEqual(d.refeicoes[0].itens[0], { nome: 'Arroz', porcao: '150 g', kcal: 195, p: 4, c: 42, g: 0 });
  assert.deepEqual(d.acoes, [
    { data: hoje, titulo: 'Editei o vídeo', area: 'conteudo', min: 40 },
    { data: hoje, titulo: 'Li um livro', area: 'pessoal', min: 0 },
  ]);
  assert.deepEqual(d.contatos.map((c) => [c.empresa, c.canal, c.respondeu, c.followUp]), [
    ['Escritório Silva', 'WhatsApp', false, '2026-03-10'],
    ['Padaria Sol', 'Outro', true, ''],
  ]);
  // Categoria desconhecida cai na do negócio, que é a que não mexe na análise pessoal por engano.
  assert.deepEqual(d.financas.map((f) => [f.tipo, f.categoria, f.valor]), [['receita', 'salario', 150050], ['custo', 'negocio', 4990]]);
  assert.deepEqual(d.tarefas, [
    { titulo: 'Ligar para o contador', area: 'organizacao', min: 30, prazo: '2026-03-06' },
    { titulo: 'Sem prazo', area: 'pessoal', min: 30, prazo: '' },
  ]);
  assert.equal(d.resposta, 'Anotei.');
  assert.equal(d.peso, 78.4);

  const vazio = normalizarDia('lixo', hoje);
  assert.deepEqual(vazio, { resposta: '', relato: '', treinos: [], refeicoes: [], acoes: [], contatos: [], financas: [], tarefas: [], peso: null });
  assert.equal(normalizarDia({ peso: 900 }, hoje).peso, null);
});

test('semana: 1 vídeo em 3 plataformas é 1 vídeo e 3 posts', () => {
  const s = seed();
  s.videos[0].pubs = { instagram: { data: '2026-10-14' }, tiktok: { data: '2026-10-14' }, youtube: { data: '2026-10-15' } };
  s.feitos.push({ data: '2026-10-13', area: 'clientes', min: 30 }, { data: '2026-10-14', area: 'conteudo', min: 30 }, { data: '2026-10-20', area: 'clientes', min: 5 });
  const r = resumoSemana(s, '2026-10-16');
  assert.equal(r.videos, 1);
  assert.equal(r.posts, 3);
  assert.equal(r.comerciais, 1);
  assert.deepEqual(r.minutos, { clientes: 30, conteudo: 30 });
});
