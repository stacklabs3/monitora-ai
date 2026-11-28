# Pontos para aprovação: casca do protótipo único

Ticket: [Criar o protótipo único](https://github.com/stacklabs3/monitora-ai/issues/16). Dados todos
sintéticos (a investigadora da `conta-7`, a reserva `R-1042`, a API do Excurfly).

## Painel (computador)

1. **Cara do painel.** O repositório não tinha paleta. Nasceu aqui: verde-petróleo escuro (`#0E3B43`)
   como cor principal, verde-água (`#0F766E`) como destaque, IBM Plex Sans no texto e IBM Plex Mono
   nos eventos. Todo texto passa de 4,5:1 nos dois temas.
2. **Barra de cima.** Produto (lista), ambiente (produção | homologação) e "Ver como" (Investigador |
   Administrador) sempre à vista, mais tema, atalhos e as iniciais da pessoa. Trocar o produto ou o
   ambiente muda o endereço da página.
3. **Seletor de papel dentro do painel.** Em Administrador aparece a seção "Administrar" no menu:
   Aplicações e chaves de envio, Catálogo de campos e Configurar alertas. É um controle do protótipo; no
   painel de verdade o papel vem do acesso da pessoa.
4. **Menu da esquerda.** "Investigar" tem Busca de eventos, Tentativas, Saúde do envio e Alertas. Só a
   busca abre: as outras entradas são dos tickets dos lotes 1 a 3.
5. **Miolo provisório da busca.** Caixa de texto livre com `/`, período escrito com o fuso
   ("Última hora · 13:00–14:00 (BRT, UTC−3)"), uma ficha "aplicação é API" marcada *garantida*, e a
   lista de uma linha por evento com "Quebrar linha". A busca de verdade se desenha em
   [Prototipar a busca de eventos](https://github.com/stacklabs3/monitora-ai/issues/68).
6. **Nível do evento.** ERRO, AVISO e INFO escritos, a cor só reforça. "INFO" é abreviação; se preferir,
   troca por outra palavra.
7. **Estados.** Carregando mostra "Buscando…" com Cancelar sobre linhas-esqueleto; vazio diz o que foi
   olhado e oferece "Ampliar para 24 horas"; erro mantém os filtros e tem "Tentar de novo"; sem internet
   fixa o aviso no topo e a lista continua legível.
8. **Atalhos.** `/` vai para a busca, setas andam na lista, `?` abre a lista de atalhos, Esc fecha.
   Nenhum atalho dispara enquanto se digita.

## Entrada (computador e celular)

9. **Entrada por convite com segundo fator.** E-mail e senha, depois o código de 6 dígitos. Quem chega
   pelo link do alerta vê "Entre para ver o alerta …" e cai direto no alerta depois do código.
10. **Erro sem perder o que foi digitado.** Senha errada limpa só a senha; o e-mail fica.

## Painel no celular

11. **Só leitura.** O alerta que disparou (nome, contagem, limite, hora com fuso) e os eventos dele em
    duas linhas cada. O rodapé manda abrir o computador para investigar a fundo. O detalhe de um evento
    entra em [Prototipar a chegada pelo link do alerta](https://github.com/stacklabs3/monitora-ai/issues/75).
12. **Abre no escuro**, porque o alerta das 23h chega com o celular no modo escuro.

## Alerta no Telegram

13. **Moldura de conversa sem a marca do Telegram.** O bot "Monitora AI" manda: "Excurfly · API ·
    produção: 42 erros em 5 min", o nome do alerta, a hora com fuso e o botão "Ver no painel". Se o canal
    mudar em [Escolher os canais de alerta](https://github.com/stacklabs3/monitora-ai/issues/31), troca a
    moldura e a mensagem fica.

## Toques

| Rotina | Toques / meta |
|---|---|
| Entrar no painel | 2 / 3 |
| Ver o painel como Administrador | 1 / 1 |
| Entrar pelo link do alerta (celular) | 2 / 3 |
| Receber o alerta e abrir o painel (Telegram) | 3 / 3 |
