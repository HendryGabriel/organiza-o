// Gravação do relato em áudio. O navegador grava no formato dele (webm no Chrome, mp4 no Safari); antes de enviar,
// o áudio vira WAV mono de 16 kHz: formato que o Gemini aceita em qualquer aparelho e que fica pequeno
// (uns 2 MB por minuto, bem abaixo do limite de 20 MB do pedido).
let gravador = null;
let fluxo = null;
let pedacos = [];

const soltarMicrofone = () => fluxo?.getTracks().forEach((t) => t.stop());

export async function gravar() {
  fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    pedacos = [];
    gravador = new MediaRecorder(fluxo);
    gravador.ondataavailable = (e) => e.data.size > 0 && pedacos.push(e.data);
    gravador.start();
  } catch (e) {
    soltarMicrofone(); // navegador sem gravador: o microfone não fica aberto à toa
    throw e;
  }
}

// Para a gravação e devolve o áudio em WAV, já em base64.
export function parar() {
  return new Promise((resolve, reject) => {
    if (!gravador || gravador.state === 'inactive') return reject(new Error('Nenhuma gravação em andamento.'));
    gravador.onstop = async () => {
      soltarMicrofone();
      const gravacao = new Blob(pedacos, { type: gravador.mimeType });
      pedacos = [];
      try {
        resolve(emBase64(await paraWav(gravacao)));
      } catch (e) {
        reject(e);
      }
    };
    gravador.stop();
  });
}

export function cancelar() {
  if (gravador && gravador.state !== 'inactive') {
    gravador.onstop = null;
    gravador.stop();
  }
  soltarMicrofone();
}

async function paraWav(blob) {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  const ctx = new Contexto();
  const original = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const taxa = 16000;
  const mesa = new OfflineAudioContext(1, Math.max(1, Math.ceil(original.duration * taxa)), taxa);
  const fonte = mesa.createBufferSource();
  fonte.buffer = original;
  fonte.connect(mesa.destination);
  fonte.start();
  const amostras = (await mesa.startRendering()).getChannelData(0);

  // Cabeçalho WAV (PCM de 16 bits, 1 canal) seguido das amostras.
  const wav = new DataView(new ArrayBuffer(44 + amostras.length * 2));
  const escrever = (pos, txt) => [...txt].forEach((c, i) => wav.setUint8(pos + i, c.charCodeAt(0)));
  escrever(0, 'RIFF');
  wav.setUint32(4, 36 + amostras.length * 2, true);
  escrever(8, 'WAVEfmt ');
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, 1, true);
  wav.setUint32(24, taxa, true);
  wav.setUint32(28, taxa * 2, true);
  wav.setUint16(32, 2, true);
  wav.setUint16(34, 16, true);
  escrever(36, 'data');
  wav.setUint32(40, amostras.length * 2, true);
  for (let i = 0; i < amostras.length; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, amostras[i])) * 0x7fff, true);
  return new Uint8Array(wav.buffer);
}

// Também usada para mandar o PDF do extrato.
export function emBase64(bytes) {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}
