# Pontos para aprovação: lote 2 (Administrar)

Protótipo em `prototipos/monitora-ai/`, aba **Painel**, computador, claro e escuro. Cenário: o
Administrador do Excurfly, em produção, às 15:00 de 27/11/2026, cadastra uma aplicação, declara um
campo e confere a saúde do envio. Tudo sintético; nenhuma chave é de verdade.

Para ver: `python3 -m http.server 8771 --directory prototipos/monitora-ai` e abrir
http://localhost:8771. No painel flutuante (canto de baixo), o grupo **Rotina** percorre cada uma.

Cada ponto diz o que foi escolhido. Responda "aprovado" ou diga o número do ponto que quer mudar.
Onde está escrito **Decisão sua**, a escolha foi feita pela recomendação e espera a sua palavra.

## 1. Aplicações e chaves de envio ([ticket 71](https://github.com/stacklabs3/monitora-ai/issues/71))

Rotinas `cadastrar-aplicacao` (3 de 3 toques), `guardar-a-chave` (2 de 2) e `revogar-chave` (2 de 2).

1. **A tela é uma só:** a lista das aplicações do ambiente, com as chaves de envio de cada uma. O
   cadastro, a chave gerada e a confirmação de revogar abrem em janelas por cima.
2. **O exemplo do ticket foi ajustado ao cenário.** No lote Investigar a API, o Site e os Webhooks já
   enviam eventos; por isso a rotina cadastra uma aplicação nova, a "API de parceiros", e revoga a
   chave "servidor antigo" do Site.
3. **O ambiente é o do topo do painel.** A janela de cadastro diz "em produção" por escrito e não
   tem seletor próprio. **Decisão sua:** quer um seletor de ambiente dentro do cadastro?
4. **Cadastrar já gera a primeira chave,** no mesmo botão ("Cadastrar e gerar a chave"). **Decisão
   sua:** ou prefere cadastrar primeiro e gerar depois, com um clique a mais?
5. **A chave inteira aparece uma vez só,** com aviso amarelo, "Copiar a chave" e a frase de onde
   guardá-la (no servidor da aplicação, nunca em navegador ou aplicativo).
6. **Essa janela só fecha em "Já guardei a chave".** Esc e clique fora não fecham. **Decisão sua:** é
   rígido de propósito; confirma?
7. **Depois de fechar,** um aviso verde confirma e a lista mostra só o começo (`mk_prod_ex7a…`).
8. **O formato da chave de exemplo** (`mk_prod_…`, `mk_homol_…`, com "EXEMPLO-nao-e-uma-chave-real")
   é do protótipo. **Decisão sua:** o formato de verdade ainda não foi decidido.
9. **Até duas chaves ativas por aplicação.** Com duas, "Gerar chave" fica apagado e a explicação
   fica escrita ao lado ("Revogue uma para gerar outra").
10. **A palavra é "Revogar",** como no ticket. O ticket de princípios de tela dizia "cancelar a
    chave", mas "Cancelar" já é o botão de desistir da janela. **Decisão sua:** confirma "Revogar"?
11. **Revogar pede confirmação com o nome e a consequência:** a chave, a aplicação, o produto e o
    ambiente, quem para de enviar e que não dá para desfazer. O foco começa em "Cancelar".
12. **Se for a única chave ativa,** o texto avisa que a aplicação para de enviar eventos na hora, e a
    aplicação sem chave ativa ganha uma faixa de atenção.
13. **Chave revogada continua na lista,** apagada, com quem revogou e quando. **Decisão sua:** fica
    para sempre ou some depois de um tempo?
14. **"Último envio" por chave,** para saber se a antiga ainda está em uso antes de revogar.
    **Decisão sua:** isso pede que o servidor guarde esse dado por chave.
15. **A aplicação recém-cadastrada vai para o topo da lista.** **Decisão sua:** ou ordem alfabética?
16. **Gerar e revogar "ficam na auditoria, com quem fez e quando".** A tela da auditoria não entra
    neste desenho.
17. **Sem internet,** a lista continua legível e os botões de cadastrar, gerar e revogar ficam
    apagados. A chave já gerada continua na tela, com copiar e fechar funcionando.
18. **Ambiente sem aplicação** mostra "Crie a primeira chave de envio". Criar produto não aparece:
    quem cria um produto ainda não foi decidido.

## 2. Catálogo de campos ([ticket 72](https://github.com/stacklabs3/monitora-ai/issues/72))

Rotinas `declarar-um-campo` (2 de 3 toques) e `ler-o-catalogo-como-investigador` (1 de 1).

1. **O exemplo do ticket foi ajustado ao cenário.** `amountCents` já aparecia no lote Investigar como
   declarado ("rápido desde 14:00"), e assim ficou. A rotina declara ao vivo o `installmentCount`,
   que passa a "rápido desde 15:00".
2. **A tela tem duas caixas:** em cima os campos **não declarados** (onde apareceu, desde quando, em
   quantos eventos e um exemplo de valor), embaixo os declarados (tipo, buscas permitidas, papel e
   "rápido desde"). No topo, "N de 100 campos declarados" e "X de 5 por palavras".
3. **Os não declarados saem dos eventos do ambiente** escolhido no topo; os declarados valem para o
   produto inteiro. **Decisão sua:** é assim mesmo?
4. **A janela de declarar já sugere o tipo** pelo valor visto (número, no exemplo) e pede "confira
   antes de declarar". É o que faz a rotina fechar em 2 cliques.
5. **As buscas permitidas mudam com o tipo.** Só texto tem o que marcar (começo, palavras); número e
   data têm exata e intervalo, sempre.
6. **O papel tem quatro opções:** nenhum, campo de correlação, campo principal e campo de
   localização. **Decisão sua:** ao escolher localização falta dizer qual (cliente ou viagem); essa
   escolha não foi desenhada.
7. **O aviso vem antes do botão,** em palavras simples: vale na hora para eventos novos; os antigos
   só por busca lenta, até 1 dia por vez; nada é reprocessado.
8. **Campo de correlação ou principal ganha um aviso a mais:** liga só eventos novos, e as tentativas
   avisam "campo ligado desde 15:00, podem faltar eventos".
9. **Depois de declarar,** aviso verde e a linha nova no topo dos declarados, marcada "declarado
   agora". Os declarados há pouco vêm primeiro.
10. **O Investigador lê o catálogo, sem "Declarar",** com a frase de que quem declara é o
    Administrador. Ele chega pelo botão novo "Ver no catálogo de campos", ao lado do título Atributos
    do evento aberto (só quando o evento tem campo não declarado). Isso mexeu numa tela do lote
    Investigar.
11. **O menu do Investigador não ganhou o item "Catálogo de campos".** **Decisão sua:** deve ganhar?
12. **Campo com JSON por dentro** (`providerResponse`) aparece como não declarado e a tela deixa
    declarar, sugerindo texto. **Decisão sua:** pode?
13. **`paidAt` está no cenário só com "intervalo",** mas a regra diz "exata e intervalo" para data e
    hora. O dado não foi mexido, para não mudar o filtro já aprovado. **Decisão sua.**
14. **No limite de 100,** "Declarar" fica apagado e a tela diz que é preciso remover um campo; remover
    não existe nesta tela.
15. **Ficou fora:** máscaras, listas de dados proibidos, apelidos, e mudar o tipo ou remover um campo.
    Os campos da plataforma (nível, aplicação) não aparecem nem contam nos 100. **Decisão sua** sobre
    a conta.
16. **Declarar um campo pelo nome, antes de ele aparecer nos eventos,** não foi desenhado. **Decisão
    sua:** deve existir?
17. **O protótipo não guarda o que a rotina fez:** depois de declarar, o catálogo do Investigador e o
    "Adicionar filtro" seguem mostrando `installmentCount` como não declarado.

## 3. Saúde do envio ([ticket 73](https://github.com/stacklabs3/monitora-ai/issues/73))

Rotinas `conferir-a-saude-do-envio` (2 de 2 toques), `execucao-que-sumiu` (1 de 1) e
`eventos-em-volta-da-perda` (1 de 1).

1. **"Saúde do envio" fica no menu Investigar,** para os dois papéis. É tela só de leitura.
2. **Uma linha por aplicação:** situação das execuções, dados até, último envio, perdas no período,
   faltando na numeração e "Abrir".
3. **A aplicação abre abaixo da lista,** com as execuções, a conta do que falta e as perdas com
   horário e motivo.
4. **O exemplo do ticket foi ajustado ao cenário, em dois pontos.** As 120 perdas da API por fila
   cheia ficaram às **13:00** (não às 14h), para não mudar os avisos da última hora já aprovados. E
   quem sumiu sem se despedir é o **Webhooks às 14:52** (não o site às 14h10), porque o lote
   Investigar já dizia "pode ter perdido mais depois de 14:52". **Decisão sua.**
5. **A conta aparece às claras.** API: faltam 152 = 122 com motivo (fila cheia) + 30 de motivo
   desconhecido. Webhooks: 40 faltando, todos de motivo desconhecido.
6. **Execução que sumiu** ganha o aviso "sumiu sem se despedir: pode ter perdido mais depois de
   14:52", dizendo que essa parte não tem número. A que encerrou normalmente não tem aviso.
7. **As situações são escritas,** nunca só cor: "enviando", "encerrou normalmente", "sumiu sem se
   despedir", "nunca enviou".
8. **A tela abre nas últimas 24 h,** não na última hora como a busca, com quatro períodos prontos
   (1 h, 24 h, 7 dias, 30 dias) e sem intervalo livre. **Decisão sua.** Só o de 24 h tem print.
9. **A conta do que falta vale desde o início da execução,** mesmo com período menor; as perdas de
   fora viram a linha "Fora deste período, a API informou mais 120…".
10. **Aplicação sem problema** diz "Nada a apontar", e que isso não prova que nenhum evento se perdeu.
    A que nunca enviou mostra "ainda sem dados".
11. **Uma aplicação pode ter mais de uma execução ao mesmo tempo** (API com 2, Webhooks com 2).
    **Decisão sua:** isso vale no produto?
12. **"Ver eventos em volta"** numa perda abre a busca daquela aplicação, 5 minutos antes e depois.
    **Decisão sua** sobre a folga. A busca aberta não repete o aviso da perda.
13. **Só existe o motivo "fila cheia"** nos dados. Os outros motivos decididos (evento recusado,
    servidor fora, desligamento, chave recusada) não têm exemplo. O período sem dados depois de um
    backup também ficou fora.
14. **Uma tela aprovada mudou de conteúdo:** o "nada encontrado" da tentativa e o da busca de 24 h
    agora dizem "120 perdas … às 13:00; 2 perdas … às 14:31" (antes só as 2). O texto está certo para
    o período olhado; 8 prints antigos foram refeitos. **Decisão sua:** aceita? Nesse texto, "às
    13:00" vem sem a data, num período de 30 dias.
15. **Os avisos antigos não citam o que falta por motivo desconhecido** (30 na API, 40 no Webhooks).
    **Decisão sua:** devem citar?
16. **No vazio,** os dois papéis têm "Olhar os últimos 7 dias"; só o Administrador tem o caminho para
    "Aplicações e chaves de envio".
17. **Sem internet,** a tela continua legível, com "lida às 15:00:00"; abrir outra aplicação, trocar
    o período e ver eventos ficam apagados.

## O que vale para as três rotinas

1. **Auditoria:** 63 itens, 55 PASS, 0 FAIL, 5 avisos e 3 que não se aplicam (letra mínima, alvo de
   toque de celular, segundo idioma). Foram três rodadas: a primeira achou 5 defeitos, a correção de
   um deles abriu um sexto, e a terceira fechou os dois que restavam. Relatório em
   `.scratch/lote-administrar/auditoria.md`.
2. **Contraste medido nos dois temas:** menor valor 4,98:1 no claro e 5,23:1 no escuro (o mínimo é
   4,5:1). O teste de controle, com pares ruins de propósito, reprovou como devia.
3. **Um defeito antigo foi consertado, e muda telas já aprovadas:** botão apagado ainda agia ao
   clique do mouse no protótipo inteiro (sem internet, "Adicionar filtro" e "Próxima" abriam; "Entrar"
   apagado entrava). Vinha do lote Investigar e a auditoria de lá não clicou em botão apagado. Agora
   nenhum age.
4. **As janelas mudaram para o protótipo inteiro:** têm altura máxima, rolam por dentro e ficam
   sempre na área visível, inclusive a de atalhos do teclado. "?" e "/" não abrem os atalhos por cima
   de outra janela.
5. **A faixa "Atualizando…"** empurra a lista 35 px para baixo ao entrar, como a "Buscando…" do lote
   Investigar.
6. **"Alertas" e "Configurar alertas" no menu ainda não levam a lugar nenhum:** são do lote Alertas.
7. **Os textos dizem "a chave"** em vez de "a chave de envio" nos botões ("Gerar chave", "Copiar a
   chave"), na tela que já se chama "Aplicações e chaves de envio". **Decisão sua:** basta?
8. **Não é simulado:** a espera, o "Tentar de novo" e a cópia de verdade para a área de
   transferência. Esses estados aparecem pelo grupo Estado do painel flutuante.
9. **Não foi conferido:** leitor de tela de verdade, outro navegador além do Chrome, janela com menos
   de 1280 px de largura e zoom. Ninguém olhou o protótipo num navegador com janela: tudo foi medido
   num Chrome sem janela e pelos prints.
