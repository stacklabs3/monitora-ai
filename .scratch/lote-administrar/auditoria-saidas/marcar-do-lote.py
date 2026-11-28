# Marca, nos achados de nomes-<rodada>.txt, os que caem em linha acrescentada pelo lote (git diff 018dd94..HEAD).
# Uso: python3 marcar-do-lote.py <arquivo-de-achados>
import re, subprocess, sys
RAIZ = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip()
diferenca = subprocess.run(['git', '-C', RAIZ, 'diff', '-U0', '018dd94..HEAD', '--', 'prototipos/monitora-ai/components'], capture_output=True, text=True).stdout
linhas_do_lote = {}
arquivo_atual = None
for linha_da_diferenca in diferenca.split('\n'):
    if linha_da_diferenca.startswith('+++ b/'):
        arquivo_atual = linha_da_diferenca.rsplit('/', 1)[-1]
        linhas_do_lote.setdefault(arquivo_atual, set())
    trecho = re.match(r'^@@ -\S+ \+(\d+)(?:,(\d+))? @@', linha_da_diferenca)
    if trecho and arquivo_atual:
        inicio = int(trecho.group(1)); quantidade = int(trecho.group(2) or '1')
        linhas_do_lote[arquivo_atual].update(range(inicio, inicio + quantidade))
do_lote = 0; de_antes = 0
for achado in open(sys.argv[1]).read().split('\n'):
    onde = re.match(r'^\s+(\S+) (\S+\.jsx):(\d+) (.*)$', achado)
    if not onde or 'controle-' in achado: continue
    tipo, arquivo, numero_da_linha, detalhe = onde.groups()
    if int(numero_da_linha) in linhas_do_lote.get(arquivo, set()):
        do_lote += 1; print(f'DO LOTE  {tipo} {arquivo}:{numero_da_linha} {detalhe[:110]}')
    else:
        de_antes += 1
print(f'achados em linha do lote: {do_lote} · em linha de antes do lote: {de_antes}')
