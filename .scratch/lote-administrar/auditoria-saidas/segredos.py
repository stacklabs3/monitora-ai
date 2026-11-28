# Procura PII e coisa com cara de segredo nos componentes: e-mail, CPF/CNPJ, telefone, chave de API conhecida, sequência longa aleatória.
# Uso: python3 segredos.py <pasta-de-components> <arquivo-de-controle-plantado-fora-do-repositório>
import re, sys, os, math
PADROES = {
    'e-mail': re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
    'CPF': re.compile(r'\b\d{3}\.\d{3}\.\d{3}-\d{2}\b'),
    'CNPJ': re.compile(r'\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b'),
    'telefone': re.compile(r'(\+55\s?)?\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b'),
    'chave conhecida': re.compile(r'\b(sk_live_|sk_test_|pk_live_|AKIA[0-9A-Z]{12}|ghp_[A-Za-z0-9]{20}|xox[bp]-|eyJ[A-Za-z0-9_-]{15}|AIza[0-9A-Za-z_-]{20}|Bearer\s+[A-Za-z0-9._-]{16})'),
    'sequência longa aleatória': re.compile(r'\b[A-Za-z0-9+/_-]{28,}\b'),
}
def entropia(texto):
    return -sum((texto.count(letra) / len(texto)) * math.log2(texto.count(letra) / len(texto)) for letra in set(texto))
def varrer(caminho):
    achados = []
    for numero_da_linha, linha in enumerate(open(caminho, encoding='utf8'), 1):
        for nome_do_padrao, padrao in PADROES.items():
            for achado in padrao.finditer(linha):
                trecho = achado.group(0)
                if nome_do_padrao == 'sequência longa aleatória' and (entropia(trecho) < 4.0 or not re.search(r'\d', trecho) or not re.search(r'[A-Z]', trecho) or not re.search(r'[a-z]', trecho)):
                    continue
                achados.append(f'{os.path.basename(caminho)}:{numero_da_linha} [{nome_do_padrao}] {trecho[:60]}')
    return achados
pasta, controle = sys.argv[1], sys.argv[2]
achados_do_controle = varrer(controle)
print(f'CONTROLE NEGATIVO ({controle.rsplit("/", 1)[-1]}, plantado fora do repositório): {len(achados_do_controle)} achados (esperado: pelo menos 6, um por tipo) => {"REPROVADO como devia" if len({achado.split("[")[1].split("]")[0] for achado in achados_do_controle}) >= 6 else "NÃO REPROVOU"}')
for achado in achados_do_controle: print('   ' + achado)
total = []
for nome in sorted(os.listdir(pasta)):
    if nome.endswith('.jsx'): total += varrer(os.path.join(pasta, nome))
print(f'ACHADOS NOS COMPONENTES: {len(total)}')
for achado in total: print('   ' + achado)
