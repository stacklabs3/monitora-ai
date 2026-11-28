# Compara os prints do repositório com os refeitos: iguais, ruído de desenho (poucos pixels, diferença pequena) ou diferentes de verdade.
import sys, os
from PIL import Image, ImageChops
repositorio, novo = sys.argv[1], sys.argv[2]
so = sys.argv[3:] 
iguais = ruido = 0; diferentes = []; animados = []
for pasta, _, nomes in os.walk(novo):
    for nome in sorted(nomes):
        if not nome.endswith('.png'): continue
        relativo = os.path.relpath(os.path.join(pasta, nome), novo)
        if so and not any(relativo.startswith(prefixo) for prefixo in so): continue
        antigo = os.path.join(repositorio, relativo)
        if not os.path.exists(antigo): diferentes.append((relativo, 'não existe no repositório')); continue
        if open(antigo, 'rb').read() == open(os.path.join(novo, relativo), 'rb').read(): iguais += 1; continue
        imagem_do_repositorio = Image.open(antigo).convert('RGB'); imagem_refeita = Image.open(os.path.join(novo, relativo)).convert('RGB')
        if imagem_do_repositorio.size != imagem_refeita.size: diferentes.append((relativo, f'tamanho {imagem_do_repositorio.size} x {imagem_refeita.size}')); continue
        diferenca = ImageChops.difference(imagem_do_repositorio, imagem_refeita).convert('L')
        histograma = diferenca.histogram(); pixels = sum(histograma[1:]); fortes = sum(histograma[41:])
        if pixels == 0: iguais += 1
        elif '--loading' in relativo: animados.append((relativo, pixels))
        elif fortes < 40: ruido += 1
        else: diferentes.append((relativo, f'{pixels} pixels, {fortes} com diferença forte, caixa {diferenca.getbbox()}'))
print(f'iguais {iguais} · ruído de desenho (menos de 40 pixels com diferença forte) {ruido} · carregando (animação) {len(animados)} · DIFERENTES {len(diferentes)}')
for item in diferentes: print('  DIFERENTE', item)
