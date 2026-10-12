# hendry.ia

Painel pessoal de execução: abre, mostra **uma** tarefa que cabe no tempo que você tem e registra o progresso em segundos.

| Tela | O que faz |
|---|---|
| **Hoje** | Escolha 5, 30 ou 90 min (ou descanso) e aparece uma tarefa só. Concluir, trocar, adiar, cronômetro opcional, relato do dia. |
| **Negócio** | Funil de prospecção, follow-ups e histórico de contatos. Toda taxa mostra o denominador. |
| **Conteúdo** | Pauta dos vídeos, do relato ao roteiro (com IA) até as publicações por plataforma. |
| **Corpo** | Treinos, alimentação com **foto → calorias pela IA do Google** e peso. |
| **Lancer** | Placar da reserva. Só anda com aporte registrado: faturar não é reservar. |
| **Semana** | Revisão com os números reais e até 3 prioridades para a semana seguinte. |

## Usar

Publicado em **<https://hendrygabriel.github.io/organiza-o/>** (GitHub Pages, branch `main`). Cada `git push` atualiza o site em cerca de um minuto.

### No celular, como aplicativo

- **Android (Chrome):** abra o endereço, toque nos três pontos e em "Instalar aplicativo". Também há um botão em Configurações.
- **iPhone (Safari):** abra o endereço, toque em Compartilhar e em "Adicionar à Tela de Início".

Instalado, ele abre em tela cheia, com ícone próprio, e funciona sem internet depois da primeira visita. Segurar o dedo no ícone (Android) dá atalhos para foto da refeição, treino e funil.

### No computador

É um site estático, sem build e sem dependências:

```bash
npm start
```

Abre em `http://localhost:5173`.

## IA do Google (Gemini)

1. Crie uma chave em <https://aistudio.google.com/apikey>.
2. No app: Configurações → IA do Google → cole a chave → **Testar conexão**.

A chave fica só no navegador daquele aparelho. Ela não vai para este repositório nem para o backup. Como o app chama o Gemini direto do navegador, restrinja a chave ao endereço do seu site (no Google Cloud Console, em "Restrições de aplicativo" → "Sites").

O modelo padrão é `gemini-flash-latest`. Dá para trocar em Configurações.

## Sincronização entre celular e computador

Os dados ficam no navegador de cada aparelho e, com a sincronização ligada, também em um arquivo (`dados.json`) de um **repositório privado do seu GitHub**. Não há servidor nem conta nova, e cada envio vira um commit, então dá para voltar a uma versão anterior.

Para ligar, em cada aparelho: Configurações → Sincronização entre aparelhos.

1. **Criar repositório** (só na primeira vez): o botão abre o GitHub já preenchido com `organiza-o-dados`, privado.
2. **Criar token**: o botão abre o GitHub já preenchido. Em "Repository access" escolha "Only select repositories" e marque `organiza-o-dados`. O token só enxerga esse repositório e vale 1 ano.
3. Cole o token no app e toque em **Ligar sincronização**.

Como funciona:

- Com o app aberto, ele envia o que mudou alguns segundos depois e busca o que o outro aparelho fez ao abrir ou voltar para o app.
- Sem internet, tudo fica guardado e é enviado quando a conexão voltar.
- Os dois aparelhos são juntados registro a registro: o que só existe de um lado entra, e o mesmo registro alterado nos dois fica com a versão mais recente. Apagar em um apaga no outro.
- O token fica só no aparelho. Ele não entra no backup nem no arquivo sincronizado. O app se recusa a enviar dados para um repositório público.
- "Apagar tudo" em um aparelho desconecta só ele: a nuvem e os outros aparelhos ficam como estão.

## Seus dados

- Backup manual continua existindo: Configurações → Exportar backup. Os arquivos `hendry-ia-backup-*.json` estão no `.gitignore` de propósito.
- Sem a sincronização ligada, limpar os dados do navegador apaga tudo.

## Código

```
index.html, styles.css    casca e estilos
js/app.js                 navegação por hash e despacho de ações
js/core.js                estado, salvar, diálogo, aviso
js/logic.js               regras puras (tarefa do dia, funil, dinheiro, semana)
js/mescla.js              regras puras da sincronização (o que mudou, como juntar dois aparelhos)
js/sinc.js                conversa com o GitHub: baixar, juntar, enviar
js/seed.js                plano inicial de 12/10 a 31/12/2026 e pauta de vídeos
js/gemini.js              foto → calorias e relato → roteiro
js/views/                 uma tela por arquivo
js/icons.js               ícones Phosphor (MIT)
sw.js                     uso offline
test/                     testes das regras e da sincronização
```

```bash
npm test
```
