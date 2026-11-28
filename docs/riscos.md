# Riscos

Os riscos que os testes do projeto cobrem. Risco novo entra só com a origem: a issue, o ticket ou a
ADR em que o humano o aprovou. Como ler e usar este registro: [docs/agents/riscos.md](agents/riscos.md).

- **Origem `#45`** é o ticket [Riscos que os testes cobrem](https://github.com/stacklabs3/monitora-ai/issues/45),
  em que a coordenação aprovou os riscos por delegação do responsável pelo produto (20/11/2026).
- **Origem `#66`** é o ticket [Medir o painel em Solid no fluxo real](https://github.com/stacklabs3/monitora-ai/issues/66),
  em que a coordenação aprovou o risco por delegação (28/11/2026).
- **Situação `pendente #35`** aponta o [Mapa: fases do desenvolvimento](https://github.com/stacklabs3/monitora-ai/issues/35):
  ainda não há fatia. O `/to-spec` de cada fase troca o `#35` pela fatia que cobre o risco.
- **Onde** usa os módulos do [ADR 0003](adr/0003-modulos-e-seams-do-servidor.md), mais "biblioteca"
  (Node.js e Java) e "painel".
- Os exemplos são sintéticos: a Ana Souza, a conta `conta-7`, a reserva `R-1042` e o CPF de teste
  `123.456.789-09`.

## Evento aceito, reenvio e perda de evento

| Risco | O que dá errado | Dano | Onde | Origem | Situação |
|---|---|---|---|---|---|
| RK1 | Evento aceito some depois de uma queda do servidor, do banco ou da máquina | quem investiga não acha o erro que a aplicação enviou e recebeu confirmação | recebimento, guarda de eventos | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK2 | O servidor confirma um evento que não gravou (banco fora, disco com falha, resposta parcial do banco tratada como sucesso) | a biblioteca não reenvia e o evento se perde sem contar como perda | recebimento, guarda de eventos | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK3 | Reenviar o mesmo código em até 15 minutos cria outro evento, inclusive depois de reinício do servidor ou com dois envios ao mesmo tempo | erro contado em dobro: alerta falso e linha do tempo errada | recebimento | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK4 | Mesmo código com conteúdo diferente troca o evento já aceito, ou o conflito não é contado | o evento aceito muda depois de lido, sem ninguém saber | recebimento | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK5 | Um evento inválido derruba o lote inteiro, ou os recusados somem sem motivo e sem contar | 497 eventos válidos perdidos por causa de 3 inválidos, ou perda invisível | recebimento, saúde do envio | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK6 | Perda de evento não é contada, é contada em dobro ou fica sem motivo (fila cheia, prazo de 5 minutos, desligamento, lacuna na numeração da execução) | o painel mostra "tudo chegou" quando faltam 40 eventos | biblioteca, saúde do envio | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK7 | A aplicação some sem se despedir e o painel não avisa "pode ter perdido mais depois de 14h03" | quem investiga confia numa linha do tempo que acaba antes da queda | saúde do envio, painel | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK8 | Com a fila cheia, a biblioteca descarta o erro ou o aviso e mantém o informativo | o erro que explicaria o incidente é justamente o que falta | biblioteca | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK9 | O corte de 1 MB tira nível, horário, código, aplicação ou campo de correlação, ou não marca o evento como "cortado" | o evento fica sem como ser achado ou ligado à tentativa `R-1042` | biblioteca | #45: aprovado pela coordenação, por delegação | pendente #35 |

## Biblioteca dentro da aplicação

| Risco | O que dá errado | Dano | Onde | Origem | Situação |
|---|---|---|---|---|---|
| RK10 | Uma chamada de log bloqueia, lança erro ou derruba a aplicação (servidor fora, envio que morre, função da aplicação que lança erro, falha ao conectar) | a API do Excurfly para de vender por causa do log | biblioteca | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK11 | A fila passa de 2.048 eventos ou 16 MB, ou a biblioteca insiste além de 5 minutos | a aplicação fica sem memória enquanto o servidor está fora | biblioteca | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK12 | O desligamento da aplicação espera a biblioteca por mais de 3 segundos | o deploy trava ou a plataforma mata a aplicação no meio de uma requisição | biblioteca | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK13 | Em recusa permanente (chave de envio errada), a biblioteca continua insistindo, escreve mais de 1 linha por minuto ou gera evento do próprio aviso | disco e log da aplicação cheios de avisos, em laço | biblioteca | #45: aprovado pela coordenação, por delegação | pendente #35 |

## Segredo, dado pessoal e permissão

| Risco | O que dá errado | Dano | Onde | Origem | Situação |
|---|---|---|---|---|---|
| RK14 | Senha, token, chave, cookie, link assinado ou número de cartão fica gravado num evento (campo, URL, erro ou texto livre) | credencial de cliente ou do produto exposta a quem lê o painel e aos backups | biblioteca, recebimento, catálogo de campos | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK15 | CPF, telefone, e-mail, documento, nome ou data de nascimento fica gravado sem máscara, porque a biblioteca não mascarou e o servidor não conferiu de novo | o telefone da Ana aparece inteiro para quem investiga; vazamento exige comunicação à ANPD | biblioteca, recebimento, catálogo de campos | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK16 | Chave de envio, chave de códigos, token do bot do Telegram ou senha aparece em log, mensagem de erro ou argumento de comando do próprio Monitora AI | quem lê o log do servidor consegue enviar eventos falsos ou gerar códigos de busca | acesso, alertas, biblioteca | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK17 | Uma pessoa lê eventos, catálogo ou auditoria de um produto em que não tem permissão, ou o Investigador faz o que só o Administrador pode | dado de cliente de um produto visto por quem não devia; chave ou retenção mudada por quem não podia | consulta, acesso, entrada do painel | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK18 | Chave de envio cancelada ainda envia, ou o evento entra no produto, ambiente ou aplicação que veio escrito nele e não nos da chave | evento falso em produção do Excurfly; chave vazada continua valendo | acesso, entrada do envio | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK19 | Alguém entra sem convite, sem segundo fator, com sessão de mais de 8 horas ou parada há mais de 1 hora | computador esquecido aberto dá acesso aos eventos | acesso | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK20 | Busca, evento aberto, mudança de permissão, de chave, de retenção ou exclusão não fica na auditoria; ou a auditoria guarda o termo sem máscara, guarda o padrão da regex ou aceita edição | não dá para saber quem viu o dado da Ana, ou a própria auditoria vaza o CPF buscado | auditoria | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK21 | Texto livre ou regex alcança nome, valor mascarado ou código de busca | buscar `456` devolve os eventos com `***.456.789-**` e ajuda a reconstruir o CPF | consulta, guarda de eventos | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK22 | O alerta leva conteúdo do evento ou dado pessoal, além de condição, aplicação, ambiente, contagem, horário e link | dado de cliente sai da plataforma e fica nos servidores do Telegram | alertas | #45: aprovado pela coordenação, por delegação | pendente #35 |

## Retenção e exclusão

| Risco | O que dá errado | Dano | Onde | Origem | Situação |
|---|---|---|---|---|---|
| RK23 | Evento vencido continua na base ou nos índices depois de 24 horas, ou volta ao restaurar um backup | dado pessoal guardado além dos 38 dias prometidos | retenção, guarda de eventos | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK24 | A exclusão por pedido deixa eventos da pessoa (por `accountId` ou por código de busca), ou não é reaplicada quando um backup volta | a Ana pediu exclusão no dia 1 e os eventos de `conta-7` reaparecem no dia 20 | retenção, guarda de eventos | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK25 | Depois de restaurar um backup, o painel não marca o período sem dados | quem investiga lê "nenhum erro às 14h" num período que foi perdido | retenção, saúde do envio, painel | #45: aprovado pela coordenação, por delegação | pendente #35 |

## Busca, tentativa e linha do tempo

| Risco | O que dá errado | Dano | Onde | Origem | Situação |
|---|---|---|---|---|---|
| RK26 | Uma busca garantida não acha um evento que existe (campo de correlação, campo de localização com apelido, código de busca de `(11) 90000-4321` contra `+55 11 90000-4321`, começo da URL) | quem investiga conclui que a compra da Ana não gerou erro | consulta, guarda de eventos, catálogo de campos | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK27 | A tentativa junta eventos de outra tentativa: vínculo por horário próximo, log que herda a ocorrência errada, corrente que atravessa para outro valor do campo principal | a linha do tempo de `R-1042` mostra o estorno de outra reserva | consulta, biblioteca | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK28 | A linha do tempo sai da ordem (horário de origem, execução, número na execução), o evento atrasado, do futuro ou sem horário entra sem marca, ou o fuso muda o período buscado ou o dia que vence | causa e efeito aparecem trocados; evento das 23h50 some da busca do dia | consulta, recebimento, retenção | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK29 | O painel diz que nada foi encontrado sem mostrar "dados até", "dados desde", as perdas do período e "rápido desde", ou esconde que o resultado é parcial | "não achei" vira "não aconteceu" e o incidente é fechado errado | consulta, painel | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK30 | Mudar o catálogo de campos (declarar, trocar o tipo, remover) altera ou esconde eventos antigos sem aviso, ou um valor incompatível faz o evento ser recusado | eventos de ontem somem do filtro sem o painel dizer desde quando | catálogo de campos, consulta, guarda de eventos | #45: aprovado pela coordenação, por delegação | pendente #35 |

## Limites e o que não é nosso

| Risco | O que dá errado | Dano | Onde | Origem | Situação |
|---|---|---|---|---|---|
| RK31 | Entrada acima de um limite (lote de 5 MB ou 1.000 eventos, evento de 1 MB, 100 campos por produto, 128 letras) é aceita, derruba o servidor ou o faz passar dos 2 GB | um envio grande tira o recebimento e o painel do ar para todos os produtos | recebimento, entrada do envio, catálogo de campos | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK32 | Uma aplicação acima do limite de volume faz as outras receberem "tente depois" | um site do Excurfly em laço cala os erros da API | recebimento | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK33 | Com o disco quase cheio, o servidor segue aceitando até encher, ou a busca para junto | banco corrompido e nenhuma investigação possível | recebimento, guarda de eventos | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK34 | Busca lenta ou regex roda sem limite: mais de 2 ao mesmo tempo, além de 10 segundos, padrão de tempo imprevisível ou mais de 5.000 resultados | uma busca trava o servidor e o recebimento para | consulta, guarda de eventos | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK35 | Os tipos de Rust, TypeScript e Java saem de paridade com o arquivo do contrato `/v1`, ou Node.js e Java se comportam diferente nos mesmos casos | a biblioteca envia o que o servidor recusa e todos os eventos de uma versão viram perda | entrada do envio, biblioteca | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK36 | O Telegram recusa, limita (429) ou está fora e o alerta se perde calado, sem aparecer nos últimos disparos | a pessoa não é avisada dos 40 erros em 5 minutos e ninguém sabe que o aviso falhou | alertas | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK37 | O alerta não dispara quando a condição acontece, ou dispara em dobro ou sem a condição | incidente sem aviso, ou tanto aviso falso que a pessoa silencia o bot | alertas | #45: aprovado pela coordenação, por delegação | pendente #35 |
| RK38 | O desenho da página de 100 eventos ou a abertura de um evento com stack trace longo passa de 100 ms no Chrome com a CPU 4x mais lenta, sem contar a busca no servidor | quem investiga `R-1042` espera a cada página e a cada evento aberto, e a escolha do Solid ([ADR 0004](adr/0004-solid-no-painel.md)) deixa de valer | painel | #66: aprovado pela coordenação, por delegação | pendente #35 |
