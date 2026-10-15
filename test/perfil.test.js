import test from 'node:test';
import assert from 'node:assert/strict';
import { perfilDaIA } from '../js/perfil.js';
import { seed } from '../js/seed.js';
import { contextoDaAssistente } from '../js/analise.js';
import { conversar, gerarRoteiro } from '../js/gemini.js';

test('perfil inicial separa exemplos de resultados e aceita atualizações ou campos apagados', () => {
  const s = seed();
  const inicial = perfilDaIA(s.settings);
  assert.match(inicial.objetivos, /exemplo, não meu saldo/);
  assert.match(inicial.negocios, /ainda não validadas/);
  assert.equal(s.settings.metaLancer, 0);
  s.settings.perfilIA = { identidade: '', atualizacoes: 'Agora posso trabalhar nos projetos aos sábados.' };
  const backup = JSON.parse(JSON.stringify(s));
  const c = contextoDaAssistente(backup, '2026-10-14');
  assert.equal(c.sobreHendry.identidade, '');
  assert.match(c.sobreHendry.atualizacoes, /aos sábados/);
  assert.equal(c.sobreHendry.objetivos, inicial.objetivos);
  assert.equal(backup.feitos.length, 0);
  assert.equal(c.lancer.meta, null);
});

test('conversa e roteiro recebem as informações editadas sem enviar requisições reais', async (t) => {
  const anterior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify({ key: 'chave-ficticia' }) } });
  t.after(() => { if (anterior) Object.defineProperty(globalThis, 'localStorage', anterior); else delete globalThis.localStorage; });
  const pedidos = [];
  t.mock.method(globalThis, 'fetch', async (_url, opcoes) => {
    pedidos.push(JSON.parse(opcoes.body));
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(pedidos.length === 1 ? { resposta: 'Podemos planejar para sábado.' } : { gancho: 'Um teste real.', narracao: 'Testei a demo.', takes: ['Computador em casa'], legenda: 'Teste da demo.' }) }] } }] }) };
  });
  const s = seed();
  s.settings.perfilIA = { atualizacoes: 'Agora posso trabalhar nos projetos aos sábados.' };
  await conversar({ texto: 'Como organizar o fim de semana?', contexto: contextoDaAssistente(s, '2026-10-14'), hojeIso: '2026-10-14', hojeLongo: '14 de outubro' });
  assert.match(pedidos[0].systemInstruction.parts[0].text, /Agora posso trabalhar nos projetos aos sábados/);
  assert.match(pedidos[0].systemInstruction.parts[0].text, /Nunca crie registros a partir do perfil/);
  await gerarRoteiro('Testei a demo em casa.', 'Até o Lancer', perfilDaIA(s.settings));
  assert.match(pedidos[1].contents[0].parts[0].text, /Agora posso trabalhar nos projetos aos sábados/);
  assert.match(pedidos[1].contents[0].parts[0].text, /20 a 45 segundos/);
});
