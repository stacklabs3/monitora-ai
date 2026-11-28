# Medida: o painel em Solid no fluxo real

Medida de [Medir o painel em Solid no fluxo real](https://github.com/stacklabs3/monitora-ai/issues/66), a condição do [ADR 0004](https://github.com/stacklabs3/monitora-ai/blob/main/docs/adr/0004-solid-no-painel.md). Rodada em 28/11/2026.

## Resultado

**Aprovada.** Com a CPU 4x mais lenta, a página de 100 eventos foi desenhada em até 42,7 ms e o evento com stack trace longo abriu em até 35,6 ms. O limite é 100 ms para cada uma. O controle negativo reprovou no mesmo medidor, como precisava.

| Cenário (30 repetições) | Página: mediana | Página: pior | Evento longo: mediana | Evento longo: pior |
|---|---|---|---|---|
| CPU sem lentidão | 22,3 ms | 76,4 ms | 20,7 ms | 21,4 ms |
| **CPU 4x mais lenta (a condição)** | **39,0 ms** | **42,7 ms** | **26,9 ms** | **35,6 ms** |
| CPU 8x mais lenta | 62,7 ms | 75,4 ms | 54,1 ms | 77,7 ms |
| CPU 16x mais lenta | 134,6 ms | 155,8 ms | 112,0 ms | 129,5 ms |
| Controle negativo a 4x (5 repetições) | 596,2 ms | 622,9 ms | 604,3 ms | 615,7 ms |

Os tempos vão da chegada dos dados no navegador até o fim da pintura, sem o tempo da busca no servidor. Contando desde o clique, com o arquivo servido pela própria máquina, o pior caso a 4x foi 55,4 ms na página e 54,6 ms no evento.

**JS por visita:** 13.540 bytes transferidos com gzip (34.996 bytes sem compressão), num arquivo só, com o Solid e o roteador dentro. O CSS soma 0,8 KB.

## O que foi medido

A investigadora da `conta-7` abre `/busca`, digita `R-1042` e clica em Buscar. A página mostra 100 eventos (hora, nível, aplicação, rota, mensagem e campos de correlação). Depois ela clica no evento de erro, e o painel lateral abre com a mensagem longa, 40 atributos e um stack trace de 400 linhas, com as linhas da aplicação destacadas. O bloco do stack trace tem 19.021 px de altura, e a altura muda com o conteúdo.

- **Aplicação:** `solid-js` 1.9.20, `@solidjs/router` 1.0.3, `vite` 8.4.0 e `vite-plugin-solid` 2.11.17, sem SolidStart e sem biblioteca de lista longa. A rota é `/busca/:identificadorDoEvento?`, e o texto buscado fica na URL.
- **Navegador:** Chrome 158.0.8127.37, sem janela (headless), em 1366 x 768. A lentidão é a do DevTools (`Emulation.setCPUThrottlingRate`).
- **Máquina:** Apple M5, 24 GB, macOS 26.7.1.
- **Relógio:** começa quando o corpo da resposta chega (antes do `JSON.parse`) e para na primeira tarefa depois da pintura (`requestAnimationFrame` seguido de `MessageChannel`). Por isso todo tempo inclui a espera pelo próximo quadro, de até 16,7 ms.
- **Repetições:** cada repetição abre uma aba nova, então o código roda frio. O veredito usa o pior tempo das 30, não a mediana.
- **Dados:** sintéticos, com semente fixa (`gerar-dados.mjs`). Nenhum log real, dado pessoal ou segredo.

## Prova da falha (RP1)

O medidor só vale porque reprova quando deve:

- **A lentidão foi aplicada:** uma conta com número fixo de voltas levou 128 ms sem lentidão e 508 ms a 4x (3,97 vezes mais).
- **O controle negativo reprovou:** o mesmo painel, a 4x, com 5.000 eventos numa tela só e um stack trace de 20.000 linhas, levou no mínimo 580 ms na página e 601 ms no evento. Os dois passam de 100 ms.
- **A tela certa foi desenhada:** o medidor conta 100 linhas de evento e 400 linhas de stack no fluxo real, e 5.000 e 20.000 no controle. Se a contagem não bate, a medida sai INVÁLIDA.

## Limites desta medida

- **A máquina não é um notebook comum.** O M5 é mais rápido do que o notebook que a condição descreve, e não há outro aparelho para medir. A folga cobre a diferença: a 8x, que equivale a uma máquina com metade da velocidade desta rodando a 4x, os dois tempos ainda ficam abaixo de 100 ms (75,4 e 77,7 ms). O limite só é passado a 16x.
- **A 8x, contando desde o clique, o evento longo chegou a 108,4 ms.** A condição mede sem o tempo do servidor, e nessa conta ele ficou em 77,7 ms.
- **A tela é a da medida, não a do protótipo aprovado.** Tem a mesma ordem de elementos por linha, mas o desenho final pode pesar mais.
- **A lentidão do DevTools atrasa só a CPU do JavaScript e do layout.** Ela não imita placa de vídeo fraca nem pouca memória.
- **TanStack Virtual não foi testado.** O ticket só pedia o teste se a lista saísse lenta, e ela não saiu.

## Achado: o Solid 2.0 saiu e a ferramenta estável ainda não o acompanha

O `solid-js` 2.0.0 saiu em 17/11/2026 e a etiqueta `latest` do npm aponta para o 2.0.4. O `vite-plugin-solid` estável (2.11.17) só aceita `solid-js` `^1.7.2`, e o suporte ao 2.x está na versão `3.0.0-next.27`, ainda de teste. A pesquisa e o benchmark do ADR 0004 usaram a linha 1.9. Por isso a medida rodou no 1.9.20, e a aprovação vale para a linha 1.x. Adotar o 2.x pede rodar esta medida de novo.

## Como repetir

```sh
cd docs/research/medida-painel-solid
npm ci
npm run build
npm run medir   # sai 0 só se o veredito for APROVADA; grava resultados.json
```

## Fontes

- `docs/research/medida-painel-solid/resultados.json`: os números desta rodada, com mínimo, mediana, p95 e máximo de cada cenário.
- `docs/research/medida-painel-solid/medir.mjs` e `src/`: o medidor e o painel medido.
- [Chrome DevTools Protocol, `Emulation.setCPUThrottlingRate`](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setCPUThrottlingRate)
- [npm, `solid-js`](https://registry.npmjs.org/solid-js) e [npm, `vite-plugin-solid`](https://registry.npmjs.org/vite-plugin-solid): versões, datas e `peerDependencies`, lidos em 28/11/2026.
- [ADR 0004](https://github.com/stacklabs3/monitora-ai/blob/main/docs/adr/0004-solid-no-painel.md): a condição e o limite de 100 ms.
- [Nielsen, limites de tempo de resposta](https://www.nngroup.com/articles/response-times-3-important-limits/)
