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

**Evento aceito**:
Um evento que a plataforma confirmou depois de guardá-lo de forma que sobreviva a uma queda.
_Avoid_: Evento recebido, evento entregue

**Perda de evento**:
Um evento gerado por uma aplicação que não ficará disponível na plataforma.
_Avoid_: Descarte, quando se fala do resultado

**Alerta**:
Um aviso enviado a uma pessoa, fora do painel, quando os eventos de uma ou mais aplicações atendem a uma condição combinada, como muitos erros ou reinícios seguidos.
_Avoid_: Notificação, alarme, monitor
