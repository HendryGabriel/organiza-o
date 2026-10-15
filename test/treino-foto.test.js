import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../js/seed.js';
import { normalizarDia } from '../js/logic.js';
import { gastoDoTreino, balancoDoDia } from '../js/analise.js';

test('calorias informadas prevalecem sobre tempo e funcionam sem peso ou duração', () => {
  const treino = { data: '2026-10-15', tipo: 'Esteira', categoria: 'cardio', min: 20, kcal: 420 };
  assert.equal(gastoDoTreino(treino, 80), 420);
  assert.equal(gastoDoTreino({ ...treino, min: 0 }, null), 420);
  assert.equal(gastoDoTreino({ ...treino, kcal: 0 }, 80), 0);
  const s = seed(); s.treinos = [treino];
  assert.equal(balancoDoDia(s, treino.data).cardio, 420);
  assert.equal(balancoDoDia(s, treino.data).gasto, null);
  s.medidas = [{ data: treino.data, peso: 80 }];
  Object.assign(s.settings, { sexo: 'm', idade: 30, altura: 180 });
  const b = balancoDoDia(s, treino.data);
  assert.equal(b.gasto, b.base + 420);
});

test('resposta da assistente preserva kcal explícitas e não transforma ausências em zero', () => {
  const d = normalizarDia({ treinos: [{ tipo: 'Cárdio', kcal: 420 }, { tipo: 'Perna' }, { tipo: 'Bike', kcal: null }, { tipo: 'Corrida', kcal: -30 }] }, '2026-10-15');
  assert.equal(d.treinos[0].kcal, 420);
  for (const t of d.treinos.slice(1)) assert.equal(Object.hasOwn(t, 'kcal'), false);
});

test('foto só chama a IA após confirmação e envia a observação na primeira requisição', async (t) => {
  const dialogo = { innerHTML: '', open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const substituir = (nome, valor) => {
    const anterior = Object.getOwnPropertyDescriptor(globalThis, nome);
    Object.defineProperty(globalThis, nome, { configurable: true, value: valor });
    t.after(() => anterior ? Object.defineProperty(globalThis, nome, anterior) : delete globalThis[nome]);
  };
  substituir('localStorage', { getItem: (chave) => chave === 'hendry.gemini' ? JSON.stringify({ key: 'chave-ficticia' }) : null });
  substituir('document', {
    getElementById: () => dialogo,
    createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,Zm90bw==' }),
  });
  substituir('location', { hash: '#/corpo/comida' });
  substituir('addEventListener', () => {});
  substituir('createImageBitmap', async () => ({ width: 100, height: 100 }));
  const pedidos = [];
  t.mock.method(globalThis, 'fetch', async (_url, opcoes) => {
    pedidos.push(JSON.parse(opcoes.body));
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ nome: 'Almoço', itens: [{ nome: 'Arroz', porcao: '100 g', kcal: 130, p: 2, c: 28, g: 0 }], confianca: 'media', observacao: '' }) }] } }] }) };
  });
  await import('../js/views/corpo.js?v=7');
  const { actions, state } = await import('../js/core.js?v=7');
  await actions['comida.foto']({}, { files: [{}], value: 'foto' });
  assert.equal(pedidos.length, 0);
  assert.match(dialogo.innerHTML, /Observação para a IA/);
  await Promise.all([actions['comida.analisarFoto']({ dica: 'Sem óleo e comi só metade.' }), actions['comida.analisarFoto']({ dica: 'Sem óleo e comi só metade.' })]);
  assert.equal(pedidos.length, 1);
  assert.match(pedidos[0].contents[0].parts[1].text, /Sem óleo e comi só metade/);
  assert.equal(state.refeicoes.length, 0);
  actions['treino.salvar']({ min: '', kcal: '420', data: '2026-10-15', categoria: 'cardio', tipo: 'Esteira' });
  assert.equal(state.treinos.at(-1).kcal, 420);
  const id = state.treinos.at(-1).id;
  actions['treino.salvar']({ id, min: '30', kcal: '', data: '2026-10-15', categoria: 'cardio', tipo: 'Esteira' });
  assert.equal(Object.hasOwn(state.treinos.at(-1), 'kcal'), false);
  assert.equal(state.treinos.length, 1);
});
