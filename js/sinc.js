// Sincronização entre aparelhos. A "nuvem" é um arquivo em um repositório PRIVADO do GitHub do próprio usuário:
// sem servidor, sem conta nova, e cada envio vira um commit (histórico de graça para desfazer um erro).
// ponytail: só sincroniza com o app aberto. Envio em segundo plano exigiria tirar o estado do localStorage.
import { state, aoMudar, aplicarRemoto, aviso } from './core.js?v=6';
import { mesclar, paraNuvem, valido } from './mescla.js?v=6';

const CHAVE = 'hendry.sinc'; // fora do estado: o token nunca entra no backup nem vai para a nuvem
const ARQUIVO = 'dados.json';
export const APARELHO = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) ? 'celular' : 'computador';

export const config = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || {};
  } catch {
    return {};
  }
};
const guardar = (c) => localStorage.setItem(CHAVE, JSON.stringify(c));
export const ligada = () => Boolean(config().token);

class Falha extends Error {
  constructor(msg, extra = {}) {
    super(msg);
    Object.assign(this, extra); // semRede: tenta de novo sozinho | campo: onde mostrar o erro no formulário
  }
}
const ERROS = {
  401: 'O GitHub recusou o token: ele está errado ou venceu.',
  403: 'O token não tem permissão nesse repositório. Ele precisa de “Contents: Read and write”.',
  404: 'Repositório não encontrado, ou o token não tem acesso a ele.',
};
const falhaHttp = (res) => new Falha(ERROS[res.status] || `Erro ${res.status} do GitHub.`, { campo: res.status === 404 ? 'repo' : 'token' });

async function github(caminho, opcoes = {}, { token, repo } = config()) {
  try {
    return await fetch(`https://api.github.com/repos/${repo}${caminho}`, {
      ...opcoes,
      cache: 'no-store', // a API manda guardar a resposta por 60 s; aqui isso faria ler dado velho
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opcoes.body && { 'Content-Type': 'application/json' }),
      },
    });
  } catch {
    throw new Falha('Sem internet.', { semRede: true });
  }
}

// Base64 de texto com acento: btoa/atob sozinhos só entendem Latin-1.
function paraB64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}
const deB64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

async function baixar() {
  const res = await github(`/contents/${ARQUIVO}`);
  if (res.status === 404) return null; // primeira vez: ainda não há nada na nuvem
  if (!res.ok) throw falhaHttp(res);
  const meta = await res.json();
  // Acima de 1 MB a API devolve o conteúdo vazio; o mesmo arquivo sai inteiro pelo endereço do blob.
  const b64 = meta.content || (await (await github(`/git/blobs/${meta.sha}`)).json()).content;
  let dados = null;
  try {
    dados = JSON.parse(deB64(b64));
  } catch {
    // cai na verificação abaixo
  }
  // Arquivo estranho na nuvem: para tudo em vez de escrever por cima. As versões anteriores estão no histórico do repositório.
  if (!valido(dados)) throw new Falha('O arquivo de dados no GitHub está ilegível. Nada foi alterado.');
  return { sha: meta.sha, dados };
}

// `sha` é a versão que este aparelho leu. Se a nuvem já estiver em outra, o GitHub recusa e nada é sobrescrito.
async function enviar(json, sha) {
  const res = await github(`/contents/${ARQUIVO}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `Sincronização pelo ${APARELHO}`, content: paraB64(json), ...(sha && { sha }) }),
  });
  if (res.status === 409 || res.status === 422) return false;
  if (!res.ok) throw falhaHttp(res);
  return true;
}

// ---------- Estado da sincronização ----------

export const status = { fase: ligada() ? 'ok' : 'desligada', msg: '' };
let rodando = false;
let denovo = false;
let pendente = false;
let ultima = 0;
let espera;

function quando(ms) {
  const d = new Date(ms);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const mesmoDia = d.toDateString() === new Date().toDateString();
  return mesmoDia ? `hoje às ${hora}` : `em ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hora}`;
}

export function textoStatus() {
  const { em } = config();
  return {
    desligada: 'Desligada.',
    sincronizando: 'Sincronizando…',
    ok: em ? `Sincronizado ${quando(em)}.` : 'Ligada.',
    semRede: 'Sem internet. Envia assim que a conexão voltar.',
    erro: status.msg,
  }[status.fase];
}

// Atualiza só o texto de status na tela, sem redesenhar: quem está preenchendo um formulário não perde nada.
function definir(fase, msg = '') {
  const erroNovo = fase === 'erro' && msg !== status.msg;
  Object.assign(status, { fase, msg });
  for (const el of document.querySelectorAll('[data-sinc]')) el.textContent = textoStatus();
  if (erroNovo) aviso(`A sincronização parou. ${msg}`);
}

// Baixa, junta registro a registro, aplica o que veio e envia o que falta.
export async function sincronizar() {
  if (!ligada()) return;
  if (rodando) {
    denovo = true;
    return;
  }
  rodando = true;
  clearTimeout(espera);
  ultima = Date.now();
  definir('sincronizando');
  try {
    for (let tentativa = 1; ; tentativa++) {
      const remoto = await baixar();
      const junto = remoto ? mesclar(state, remoto.dados) : state;
      const nuvem = JSON.stringify(paraNuvem(junto));
      if (nuvem !== JSON.stringify(paraNuvem(state))) {
        aplicarRemoto(junto);
        aviso('Dados atualizados com o que veio do outro aparelho.');
      }
      if (remoto && nuvem === JSON.stringify(paraNuvem(remoto.dados))) break; // a nuvem já tem tudo
      if (await enviar(nuvem, remoto?.sha)) break;
      // O outro aparelho enviou no meio do caminho: baixa de novo, junta e tenta outra vez.
      if (tentativa === 4) throw new Falha('O GitHub não aceitou o envio. Tente de novo em instantes.');
    }
    pendente = false;
    guardar({ ...config(), em: Date.now() });
    definir('ok');
  } catch (e) {
    definir(e.semRede ? 'semRede' : 'erro', e.message);
  } finally {
    rodando = false;
    if (denovo) {
      denovo = false;
      sincronizar();
    }
  }
}

export async function conectar(repo, token) {
  repo = repo.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$|\/$/g, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Falha('Escreva o repositório no formato usuario/nome.', { campo: 'repo' });
  const cfg = { repo, token: token.trim() };
  const res = await github('', {}, cfg);
  if (!res.ok) throw falhaHttp(res);
  // Dado pessoal só vai para repositório privado. Sem essa trava, um nome trocado publicaria tudo.
  if ((await res.json()).private !== true) throw new Falha('Esse repositório é público. Crie um privado para os seus dados.', { campo: 'repo' });
  guardar(cfg);
  await sincronizar();
  if (status.fase !== 'ok') {
    const falha = new Falha(textoStatus(), { campo: 'token' });
    desconectar();
    throw falha;
  }
}

// Só este aparelho para de sincronizar. Os dados continuam aqui e no GitHub.
export function desconectar() {
  guardar({ repo: config().repo });
  pendente = false;
  definir('desligada');
}

export function iniciar() {
  aoMudar(() => {
    pendente = true;
    clearTimeout(espera);
    espera = setTimeout(sincronizar, 5000); // uma rajada de toques vira um envio só
  });
  addEventListener('online', sincronizar);
  document.addEventListener('visibilitychange', () => {
    // Saindo do app com algo por enviar: envia já. Voltando: busca o que o outro aparelho fez.
    if (document.hidden ? pendente : Date.now() - ultima > 15000) sincronizar();
  });
  sincronizar();
}
