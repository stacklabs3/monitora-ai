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
