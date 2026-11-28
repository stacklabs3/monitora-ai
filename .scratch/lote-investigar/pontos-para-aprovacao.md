# Pontos para aprovação: lote 1 (Investigar)

Protótipo em `prototipos/monitora-ai/`, aba **Painel**, computador, claro e escuro. Cenário: a
investigadora busca a reserva `R-1042` da cliente `conta-7` no Excurfly, em produção. Tudo sintético.

Para ver: `python3 -m http.server 8765 --directory prototipos/monitora-ai` e abrir
http://localhost:8765. No painel flutuante (canto de baixo), o grupo **Rotina** percorre cada uma.

Cada ponto diz o que foi escolhido. Responda "aprovado" ou diga o número do ponto que quer mudar.

## 1. Buscar eventos ([ticket 68](https://github.com/stacklabs3/monitora-ai/issues/68))

Rotinas `buscar-eventos` (3 de 3 toques) e `avisos-da-busca` (3 de 3 toques).

1. **O "agora" do cenário é 27/11/2026 15:00.** A última hora vai de 14:00 a 15:00 e o painel diz
   "Dados até 14:58:41". Foi o jeito de caber "rápido desde 14h" e "olhou até 12h" na mesma história.
2. **Para filtrar pela reserva são 3 cliques:** "Adicionar filtro", o campo `reservationId`, digitar
   `R-1042` e "Aplicar filtro". Com Enter no lugar do último clique, são 2.
3. **"Adicionar filtro" abre a lista dos campos do produto**, com o tipo de cada um e se a busca é
   garantida. Há uma procura dentro da lista, já pronta para digitar.
4. **Cada filtro vira uma ficha** acima da lista, com a etiqueta "garantida", "lenta" ou "rápido
   desde 14:00". Entre as fichas aparece um "e" escrito.
5. **O período fica na linha das fichas**, não ao lado da caixa de texto, sempre com data, fuso e
   "pela origem".
6. **A caixa de texto livre tem sempre a etiqueta "busca lenta"** e uma linha embaixo dizendo que ela
   não alcança nome de campo, valor mascarado nem código de busca. Regex é um botão dentro da caixa.
7. **Campos com poucos valores** (nível, aplicação, `method`) se escolhem por botões. Nos outros,
   vírgula quer dizer "ou" (`pix, cartao`).
8. **A lista tem uma linha por evento**, com a contagem e as páginas em cima e embaixo
   ("1–100 de 438 eventos", "Página 1 de 5").
9. **Passou de 5.000 eventos:** um aviso curto logo abaixo da contagem pede um filtro melhor.
10. **Período de mais de um dia:** a coluna de horário ganha a data (`27/11 14:55:16.010`).
11. **Resultado parcial:** faixa amarela "Parcial, olhou até 12:00; reduza o período." com o botão
    "Reduzir para a última hora".
12. **"Rápido desde":** buscar `amountCents` de 1000 a 5000 mostra a faixa "amountCents: rápido desde
    14:00" e o botão "Buscar antes das 14:00 (busca lenta)".
13. **Nada encontrado:** um quadro com cinco fatos (período olhado, dados até, dados desde, perdas no
    período, rápido desde), a frase "Isso não quer dizer que nada aconteceu" e até três próximos passos.
14. **Buscando:** uma faixa "Buscando… / Cancelar" aparece sobre o resultado anterior, sem apagar a
    lista. Ela empurra a lista 49 px para baixo quando entra. **Decisão sua:** fica assim ou a faixa
    ganha um lugar fixo?
15. **Erro:** "Servidor ocupado, tente em instantes", com "Tentar de novo". A lista some; fichas e
    período ficam.
16. **Todo campo declarado no catálogo aparece como "garantida"**, inclusive `method` e `amountCents`,
    que não estão na lista de buscas garantidas do ticket de busca. **Decisão sua:** confirma, ou
    esses campos ganham outra etiqueta (por exemplo "rápida")?
17. **Código de busca:** ao buscar por CPF, o endereço e a ficha guardam o código (`cb_…`), nunca o
    que foi digitado.

## 2. Abrir e ler um evento ([ticket 69](https://github.com/stacklabs3/monitora-ai/issues/69))

Rotinas `ler-um-evento` (2 de 3), `filtrar-por-um-valor` (1 de 3) e `ler-o-erro-do-evento` (2 de 3).

1. **O evento abre ao lado da lista**, que continua na tela, mais estreita (5 partes para a lista, 7
   para o evento). A mensagem da lista corta mais cedo.
2. **No topo do evento:** "5 de 9 nesta página", setas para o evento de cima e o de baixo, "Copiar
   link do evento" e fechar. As setas do teclado fazem o mesmo; Esc fecha.
3. **Faixa "Ir para":** Horários, Origem, Vínculos, Atributos, Erro. Um clique rola até a parte, e o
   link guarda a parte aberta.
4. **Ordem de leitura:** nível e mensagem; nome, família e ocorrência; os dois horários; origem;
   vínculos de correlação; atributos; erro.
5. **Os dois horários aparecem sempre**, com a diferença escrita ("380 ms depois da origem"). No
   evento atrasado isso vira uma nota com relógio.
6. **"Abrir a tentativa"** é um botão ao lado do valor do campo principal (`reservationId` =
   `R-1042`). Evento sem campo principal não tem o botão.
7. **Filtrar por um valor:** dois botões, "é" e "não é", em cada atributo que filtra. Clicar fecha o
   evento e mostra a busca com a ficha nova. O "é" fica apagado quando o valor já é filtro.
8. **Valor mascarado** (`***.456.789-**`): aparece com a etiqueta "valor mascarado" e "sem filtro ⓘ",
   com a explicação ao passar o mouse ou focar. O código de busca do mesmo dado fica na linha de
   baixo, e esse filtra.
9. **Campo não declarado** (`installmentCount`): aparece, com a etiqueta "não declarado" e sem
   filtro. Uma legenda embaixo diz que só filtra depois de declarado no catálogo de campos.
10. **Valor incompatível** (`abc` num campo de número): aparece com "fora do filtro: valor
    incompatível com o tipo".
11. **Ordem dos atributos:** primeiro os que filtram, depois mascarado, código de busca,
    incompatível e, por fim, os não declarados.
12. **Erro longo:** a pilha aparece recolhida numa caixa de altura fixa com rolagem, com "Mostrar
    tudo" e "Copiar a pilha".
13. **Evento que não existe mais** (link antigo): quadro dizendo o que foi procurado e a retenção de
    30 dias, com "voltar à busca". Não diz que o fato não ocorreu.
14. **Sem internet:** o evento aberto continua legível; filtrar, abrir tentativa e abrir outro evento
    ficam apagados e dizem que esperam a conexão.
15. **Trocar produto ou ambiente fecha o evento;** trocar o papel mantém.
16. **Os botões do protótipo inteiro ganharam realce** ao passar o mouse e ao clicar (vale para a
    casca também).

## 3. Achar a tentativa e ler a linha do tempo ([ticket 70](https://github.com/stacklabs3/monitora-ai/issues/70))

Rotinas `achar-a-tentativa` (2 de 3), `ler-a-linha-do-tempo` (2 de 3) e
`codigo-em-duas-tentativas` (1 de 3).

1. **"Tentativas" no menu abre uma tela própria.** Escolhe-se "cliente" ou "viagem" (campos de
   localização) ou `reservationId` (campo principal), digita-se o valor inteiro e pronto.
2. **A tela diz onde a busca por cliente olha:** `accountId`, `buyerAccountId` e os códigos de busca
   de telefone, e-mail e CPF. E diz que `passengerId` não entra, porque é outra pessoa.
3. **Buscar `conta-7` lista as tentativas dela,** uma linha por tentativa: `R-1042` (13 eventos,
   ERRO, "houve perda: podem faltar eventos"), `R-1046` e `R-1047`. Nada é emendado.
4. **"Eventos sem tentativa" ficam à parte,** embaixo, com uma frase dizendo por quê (`user signed
   in`, `page viewed`). Clicar num deles abre o evento na busca de eventos.
5. **Buscar pelo campo principal vai direto à linha do tempo;** o botão vira "Abrir a linha do tempo".
6. **Cabeçalho da tentativa:** período coberto, "13 · Site, API, Webhooks", a ocorrência com a
   duração e a corrente de códigos `R-1042 → T-900 → T-901 → E-3`.
7. **A linha do tempo vai do mais antigo ao mais novo** (o contrário da busca) e diz isso: "em ordem
   de acontecimento, mais antigo primeiro". Usa as mesmas colunas da busca.
8. **Cada linha diz por que está ali:** "ligado por `pspTxId` = `T-900`", à direita.
9. **Evento atrasado** fica na posição do horário de origem, com "recebido 14:04:10, 4 min 7 s
   depois".
10. **Dois eventos de aplicações diferentes no mesmo horário** levam a marca "mesmo horário; a ordem
    entre aplicações não é garantida".
11. **Aviso de perda:** uma faixa só junta as duas frases, a com número ("2 eventos da aplicação API
    às 14:31, motivo fila cheia") e a sem número ("pode ter perdido mais depois de 14:52").
12. **Aviso de campo ligado depois:** "`pspTxId` é campo de correlação desde 14:00… Podem faltar
    eventos."
13. **"Mesmo horário, sem vínculo" fica à parte,** depois da linha do tempo, com a frase de que
    horário próximo nunca cria vínculo. Entra ali o evento sem campo de correlação, a até 5 segundos
    de um evento da tentativa e com a mesma viagem ou cliente. **O critério dos 5 segundos é do
    protótipo; confirme ou troque.**
14. **Abrir um evento da linha do tempo** divide a tela meio a meio, e os avisos encolhem para só o
    título.
15. **Código em duas tentativas** (`T-905` em `R-1046` e `R-1047`): cada uma mostra o aviso e um botão
    para a outra; o evento leva a etiqueta "também na tentativa R-…". Elas não se juntam. Isso ganhou
    uma rotina própria, porque não se chega lá a partir de `R-1042` em 3 cliques.
16. **"Ver estes eventos na busca"** abre o filtro `reservationId é R-1042`, que traz 9 dos 13
    eventos: os que entraram só por `T-…` ou `E-3` não vêm. Hoje isso só está dito na dica do botão.
    **Decisão sua:** basta, ou o botão deve dizer isso às claras?
17. **Ocorrência sem fim** aparece como "o fim não foi informado", sem dizer que está em andamento.
18. **Ao abrir por link,** o cabeçalho da tentativa cresce de 58 para 98 px quando os dados chegam, e
    os avisos só aparecem depois. **Decisão sua:** aceita, ou reserva-se o espaço antes?

## O que vale para as três

1. **Auditoria:** 59 itens, 52 PASS, 0 FAIL, 4 avisos e 3 itens que não se aplicam (alvo de toque de
   celular, letra mínima, segundo idioma). Relatório em `.scratch/lote-investigar/auditoria.md`.
2. **Contraste medido nos dois temas:** menor valor 4,98:1 no claro e 5,23:1 no escuro (o mínimo é
   4,5:1). O teste de controle, com um par ruim de propósito, reprovou como devia.
3. **As telas do Administrador** (as mesmas, com o papel trocado) abrem sem erro, mas não estão em
   nenhuma rotina nem em print. **Decisão sua:** entram numa rotina ou ficam assim até o lote
   Administrar?
4. **Não é simulado:** a espera de 1 segundo antes de "Buscando…", o "Cancelar" e o "Tentar de novo".
   Esses estados aparecem pelo grupo Estado do painel flutuante.
5. **"Saúde do envio" e "Alertas" no menu ainda não levam a lugar nenhum:** são dos lotes seguintes.
6. **Não foi conferido:** leitor de tela de verdade, outro navegador além do Chrome, janela com menos
   de 1280 px de largura e zoom.
