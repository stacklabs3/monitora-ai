# Monitora AI

Plataforma independente que recebe os eventos de log de vários produtos e permite investigá-los e ser avisado sobre eles.

## Language

**Produto**:
Um sistema atendido pela plataforma, como o Excurfly, que reúne uma ou mais aplicações.
_Avoid_: Projeto, cliente, tenant

**Aplicação**:
Uma parte executável de um produto que envia eventos, como a API ou um site do Excurfly.
_Avoid_: Serviço, app, sistema monitorado

**Execução**:
Um período contínuo de funcionamento de uma aplicação, do início até ela parar ou cair.
_Avoid_: Instância, processo

**Evento**:
Um registro que uma aplicação escolheu enviar à plataforma sobre algo que aconteceu nela.
_Avoid_: Log, quando se fala do registro recebido

**Origem**:
De onde um evento veio: produto, ambiente, aplicação, versão e execução.
_Avoid_: Fonte, resource

**Atributo**:
Um dado livre sobre um evento específico, cujo nome só vale dentro do produto.
_Avoid_: Propriedade, tag

**Família**:
O tipo a que um evento pertence, como `transacao-financeira`.
_Avoid_: Categoria, grupo

**Ocorrência**:
Cada vez que uma família é iniciada, com um código próprio que os eventos de dentro herdam.
_Avoid_: Instância, sessão

**Campo de correlação**:
Um campo declarado pelo produto cujo valor pode ligar eventos, como o código de uma reserva.
_Avoid_: Chave, índice

**Campo principal**:
O campo de correlação escolhido pelo produto como ponto de partida de um tipo de investigação.
_Avoid_: Campo raiz

**Vínculo de correlação**:
A ligação explícita entre eventos, por um mesmo valor num campo de correlação ou por dois códigos no mesmo evento.
_Avoid_: Relação, associação

**Tentativa**:
O grupo de eventos ligados a um valor de um campo principal, como tudo que se liga a uma reserva.
_Avoid_: Transação, sessão

**Evento aceito**:
Um evento que a plataforma confirmou depois de guardá-lo de forma que sobreviva a uma queda.
_Avoid_: Evento recebido, evento entregue

**Perda de evento**:
Um evento gerado por uma aplicação que não ficará disponível na plataforma.
_Avoid_: Descarte, quando se fala do resultado

**Alerta**:
Um aviso enviado a uma pessoa, fora do painel, quando os eventos de uma ou mais aplicações atendem a uma condição combinada, como muitos erros ou reinícios seguidos.
_Avoid_: Notificação, alarme, monitor

**Chave de envio**:
A credencial que identifica uma aplicação de um produto em um ambiente ao enviar eventos.
_Avoid_: Token, API key

**Chave de códigos**:
A chave secreta de um produto usada para gerar seus códigos de busca.
_Avoid_: Salt, chave de hash

**Situação da execução**:
O informe que uma execução manda à parte dos eventos, com o último número usado, as perdas, o início e o encerramento.
_Avoid_: Heartbeat, ping

**Valor mascarado**:
Um dado pessoal com parte escondida de forma irreversível, como `***.456.789-**`, que continua sendo dado pessoal.
_Avoid_: Valor anonimizado, valor ofuscado

**Código de busca**:
Um valor gerado com chave secreta a partir de um dado pessoal, que permite achar o dado exato sem guardá-lo.
_Avoid_: Hash, pseudônimo

**Investigador**:
Quem pode buscar e ler os eventos de um produto no painel.
_Avoid_: Leitor, analista

**Administrador**:
Um investigador que também cuida de pessoas, chaves de envio, retenção e exclusões de um produto.
_Avoid_: Admin, dono

**Campo pesquisável**:
Um campo declarado pelo produto, com tipo e formas de busca permitidas.
_Avoid_: Campo indexado, facet

**Campo de localização**:
Um campo pesquisável que o produto marca para achar tentativas sem ligar eventos entre si, como cliente ou viagem.
_Avoid_: Campo de correlação, quando não liga eventos

**Busca garantida**:
Uma busca que a plataforma promete responder dentro da meta de tempo, como a busca por um código de reserva.
_Avoid_: Busca indexada

**Busca lenta**:
Uma busca que funciona sem promessa de tempo e pode terminar com resultado parcial, como texto livre ou regex.
_Avoid_: Varredura, full scan

**Rota**:
O molde de um endereço da aplicação, sem os valores de cada chamada, como `/api/v1/trip/:id/purchase`.
_Avoid_: Endpoint, URL, quando se fala do molde
