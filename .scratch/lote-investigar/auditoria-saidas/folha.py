# Folha de contato: junta imagens lado a lado, reduzidas, para olhar várias de uma vez.
import sys
from PIL import Image
saida, colunas, largura = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
imagens = [Image.open(caminho).convert('RGB') for caminho in sys.argv[4:]]
reduzidas = [imagem.resize((largura, round(imagem.height * largura / imagem.width)), Image.LANCZOS) for imagem in imagens]
altura = max(imagem.height for imagem in reduzidas)
linhas = (len(reduzidas) + colunas - 1) // colunas
folha = Image.new('RGB', (largura * colunas + 4 * (colunas - 1), altura * linhas + 4 * (linhas - 1)), (255, 0, 255))
for indice, imagem in enumerate(reduzidas):
    folha.paste(imagem, ((indice % colunas) * (largura + 4), (indice // colunas) * (altura + 4)))
folha.save(saida)
print(saida, folha.size)
