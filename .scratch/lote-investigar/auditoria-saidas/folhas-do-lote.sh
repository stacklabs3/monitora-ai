#!/bin/sh
# Monta as folhas de contato dos prints do lote. Uso: folhas-do-lote.sh <pasta-dos-prints> <prefixo-da-saida>
P="$1"; R="$2"; A="$(cd "$(dirname "$0")" && pwd)"
T() { echo "$P/$1--desktop--$2--$3.png"; }
par() { python3 "$A/folha.py" "$A/folhas/$R-temas-$1.png" 2 760 "$(T $2 light default)" "$(T $2 dark default)" "$(T $3 light default)" "$(T $3 dark default)"; }
par 1 buscar-eventos/01-painel_investigador buscar-eventos/02-busca_investigador
par 2 avisos-da-busca/01-busca_investigador avisos-da-busca/02-busca_investigador
par 3 avisos-da-busca/03-busca_investigador ler-um-evento/02-evento_investigador
par 4 ler-um-evento/03-tentativa_investigador ler-o-erro-do-evento/02-evento_secao_investigador
par 5 ler-o-erro-do-evento/03-evento_secao_investigador filtrar-por-um-valor/02-busca_investigador
par 6 achar-a-tentativa/01-tentativas_investigador achar-a-tentativa/02-tentativas_achadas_investigador
par 7 ler-a-linha-do-tempo/02-tentativa_evento_investigador ler-a-linha-do-tempo/03-tentativa_secao_investigador
par 8 codigo-em-duas-tentativas/01-tentativa_investigador codigo-em-duas-tentativas/02-tentativa_investigador
estados() { python3 "$A/folha.py" "$A/folhas/$R-estados-$1.png" 2 760 "$(T $2 light empty)" "$(T $2 light error)" "$(T $2 light loading)" "$(T $2 light offline)"; }
estados buscar buscar-eventos/02-busca_investigador
estados avisos avisos-da-busca/02-busca_investigador
estados evento ler-um-evento/02-evento_investigador
estados erro ler-o-erro-do-evento/03-evento_secao_investigador
estados filtrar filtrar-por-um-valor/02-busca_investigador
estados achar achar-a-tentativa/02-tentativas_achadas_investigador
estados linha ler-a-linha-do-tempo/03-tentativa_secao_investigador
estados codigo codigo-em-duas-tentativas/01-tentativa_investigador
