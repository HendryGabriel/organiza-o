// Notificações. O app deixa guardado no aparelho um resumo dos próximos dias. Duas vezes por dia um "toque" de
// push, enviado pelo repositório de dados (ver a pasta lembretes/), acorda o service worker, que monta o lembrete
// com esse resumo. O toque não leva conteúdo: nenhum dado pessoal passa pelo serviço de push.
import './lembrete.js?v=6';
import { state, commit, uid } from './core.js?v=6';
import { hoje } from './logic.js?v=6';
import { resumoDosLembretes } from './analise.js?v=6';
import { APARELHO } from './sinc.js?v=6';

const CHAVE = 'hendry.aparelho'; // identidade deste aparelho, para ele achar a própria inscrição entre as sincronizadas
export const meuId = () => {
  let id = localStorage.getItem(CHAVE);
  if (!id) localStorage.setItem(CHAVE, (id = uid()));
  return id;
};

export const suportado = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
export const ativo = () => suportado() && Notification.permission === 'granted' && Boolean(state.aparelhos[meuId()]);

const bytes = (b64url) => Uint8Array.from(atob(b64url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const b64url = (lista) => btoa(String.fromCharCode(...lista)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Par de chaves que assina os toques (VAPID). É criado pelo primeiro aparelho que ativa as notificações e viaja
// com a sincronização, dentro do repositório privado: é de lá que o enviador lê. Ela só serve para mandar
// toques para estes aparelhos; não dá acesso a nenhum dado.
async function chaveDoEnviador() {
  if (!state.aparelhos.vapid) {
    const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    const { d, x, y } = await crypto.subtle.exportKey('jwk', par.privateKey);
    state.aparelhos.vapid = { publica: b64url([4, ...bytes(x), ...bytes(y)]), d, x, y };
  }
  return state.aparelhos.vapid.publica;
}

// O que o service worker vai ler quando o toque chegar com o app fechado. Fica no cache deste aparelho.
export async function guardarResumo() {
  if (!('caches' in window)) return;
  const cache = await caches.open('hendry-lembretes');
  await cache.put('resumo', new Response(JSON.stringify(resumoDosLembretes(state, hoje()))));
}

async function inscrever() {
  const publica = await chaveDoEnviador();
  const reg = await navigator.serviceWorker.ready;
  const antiga = await reg.pushManager.getSubscription();
  // Inscrição feita com outra chave não aceita toque assinado com a atual.
  if (antiga && state.aparelhos[meuId()]?.chave !== publica) await antiga.unsubscribe();
  const inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(publica) });
  state.aparelhos[meuId()] = { endpoint: inscricao.endpoint, chave: publica, nome: APARELHO, em: hoje() };
}

// Devolve false quando a pessoa não deu a permissão. Lança erro quando o navegador não consegue se inscrever.
export async function ativar() {
  if ((await Notification.requestPermission()) !== 'granted') return false;
  await guardarResumo();
  await inscrever();
  return true;
}

export async function desativar() {
  const reg = await navigator.serviceWorker.ready;
  await (await reg.pushManager.getSubscription())?.unsubscribe();
  delete state.aparelhos[meuId()];
}

// Mostra agora o lembrete que chegaria neste horário, pelo mesmo caminho do service worker.
export async function testar() {
  await guardarResumo();
  const reg = await navigator.serviceWorker.ready;
  const l = self.montarLembrete(resumoDosLembretes(state, hoje()), new Date());
  await reg.showNotification(l.title, { body: l.body, tag: 'teste', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: l.url } });
}

export function iniciar() {
  if (!suportado()) return;
  guardarResumo().catch(() => {});
  // Ao sair da tela, o resumo é atualizado com tudo que mudou (inclusive o que veio do outro aparelho).
  document.addEventListener('visibilitychange', () => document.hidden && guardarResumo().catch(() => {}));
  // Dois aparelhos podem ter criado chaves ao mesmo tempo: quem ficou com a que perdeu refaz a inscrição.
  if (ativo() && state.aparelhos[meuId()].chave !== state.aparelhos.vapid?.publica) inscrever().then(commit).catch(() => {});
}
