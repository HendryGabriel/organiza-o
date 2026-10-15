import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../js/seed.js';
import { resumoSemana, progressoDoJogo, dataPublicacao } from '../js/logic.js';
import { balancoDoDia, categoriaDoTreino } from '../js/analise.js';
import { caloriasPorDia } from '../js/metricas.js';

test('musculação e cárdio somam separadamente, sem duplicar o repouso', () => {
  const s = seed();
  Object.assign(s.settings, { sexo: 'm', idade: 30, altura: 180 });
  s.medidas = [{ data: '2026-10-14', peso: 80 }];
  s.treinos = [{ data: '2026-10-14', categoria: 'musculacao', tipo: 'Perna', min: 60 }, { data: '2026-10-14', categoria: 'cardio', tipo: 'Corrida', min: 30 }];
  s.refeicoes = [{ data: '2026-10-14', kcal: 2000, p: 0, c: 0, g: 0 }];
  const b = balancoDoDia(s, '2026-10-14');
  assert.equal(b.musculacao, 280);
  assert.equal(b.cardio, 280);
  assert.equal(b.gasto, b.base + 560);
  assert.equal(b.saldo, 2000 - b.gasto);
  assert.equal(categoriaDoTreino({ tipo: 'Esteira' }), 'cardio');
  assert.equal(categoriaDoTreino({ tipo: 'Peito e tríceps' }), 'musculacao');
  assert.deepEqual(caloriasPorDia(s, '2026-10-14', 1), [b]);
  s.medidas = [];
  assert.equal(balancoDoDia(s, '2026-10-14').cardio, null);
});

test('cadastro e publicação contam sem exigir data de plataforma; republicação não duplica vídeos', () => {
  const s = seed();
  s.videos.push({ id: 'novo', criadoEm: '2026-10-14', status: 'publicado', pubs: {} });
  assert.equal(resumoSemana(s, '2026-10-14').videos, 1);
  assert.equal(resumoSemana(s, '2026-10-14').videosRegistrados, 1);
  const v = s.videos.at(-1);
  v.pubs = { instagram: { data: '2026-10-14' }, tiktok: { data: '2026-10-21' } };
  assert.equal(dataPublicacao(v), '2026-10-14');
  assert.equal(resumoSemana(s, '2026-10-21').videos, 0);
  assert.equal(resumoSemana(s, '2026-10-21').posts, 1);
});

test('XP ignora a pauta inicial, soma atividades reais e atualiza ao desfazer', () => {
  const s = seed();
  assert.equal(progressoDoJogo(s, '2026-10-14').xp, 0);
  s.treinos = [{ data: '2026-10-14' }, { data: '2026-10-14' }];
  s.videos.push({ id: 'novo', criadoEm: '2026-10-14', status: 'publicado' });
  let jogo = progressoDoJogo(s, '2026-10-14');
  assert.equal(jogo.xp, 150);
  assert.equal(jogo.missoes.filter((m) => m.feito).length, 2);
  s.videos.pop();
  assert.equal(progressoDoJogo(s, '2026-10-14').xp, 50);
});
