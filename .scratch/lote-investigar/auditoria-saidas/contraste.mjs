// Contraste medido em cada tela do lote, nos dois temas e em todos os estados do painel flutuante.
// Uso: node contraste.mjs <rotulo-da-rodada> [porta]
import { readFileSync, writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';

const rodada = process.argv[2] || 'rodada';
const navegador = await abrirNavegador({ porta: Number(process.argv[3]) || 9361 });
const { avaliar, abrir, registros, fechar } = navegador;
const medidor = readFileSync(PASTA + 'medidor.js', 'utf8');
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const ROTINAS_DO_LOTE = ['buscar-eventos', 'avisos-da-busca', 'ler-um-evento', 'filtrar-por-um-valor', 'ler-o-erro-do-evento', 'achar-a-tentativa', 'ler-a-linha-do-tempo', 'codigo-em-duas-tentativas'];
const ESTADOS = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'empty', 'error', 'offline'];

await abrir('/?listarPrints=todas');
const prints = JSON.parse(await avaliar('document.querySelector("#lista-de-prints").textContent'));
const telas = new Map();
for (const print of prints) {
  const rotina = print.arquivo.split('/')[0];
  if (!ROTINAS_DO_LOTE.includes(rotina)) continue;
  const rota = print.endereco.slice(print.endereco.indexOf('#'));
  if (!telas.has(rota)) telas.set(rota, `${rotina}/${print.arquivo.split('/')[1].split('--')[0]}`);
}
dizer(`telas distintas do lote: ${telas.size}`);

// ---------- Controles (RP1): o medidor precisa reprovar o que é sabidamente reprovado ----------
const medirControles = async (tema) => {
  await abrir(`/?visao=painel&superficie=desktop&tema=${tema}&estado=default&print=1&idioma=pt-BR${[...telas.keys()][0]}`);
  await avaliar(medidor + '; true');
  return avaliar(`(() => {
    const caixa = document.createElement('div'); caixa.id = 'controles-da-medida';
    caixa.innerHTML = [
      '<span data-controle="negativo-fixo" style="color:#9aa;background:#fff">CONTROLE negativo fixo #9aa sobre #fff</span>',
      '<span data-controle="negativo-token-muted-sobre-primary" style="color:var(--muted);background:var(--primary)">CONTROLE negativo token muted sobre primary</span>',
      '<span data-controle="negativo-token-warn-sobre-warn-soft" style="color:var(--warn);background:var(--warn-soft)">CONTROLE token warn sobre warn-soft</span>',
      '<span data-controle="negativo-token-muted-sobre-warn-soft" style="color:var(--muted);background:var(--warn-soft)">CONTROLE token muted sobre warn-soft</span>',
      '<span data-controle="negativo-token-accent-sobre-accent-soft" style="color:var(--accent);background:var(--accent-soft)">CONTROLE token accent sobre accent-soft</span>',
      '<span data-controle="negativo-opacidade" style="background:#fff"><span style="color:#000;opacity:0.3">CONTROLE negativo preto com opacidade 0,3 sobre branco</span></span>',
      '<span data-controle="negativo-alfa-em-camadas" style="background:#fff"><span style="background:rgba(0,0,0,0.5)"><span style="color:#555">CONTROLE negativo cinza sobre preto 50% sobre branco</span></span></span>',
      '<span data-controle="positivo" style="color:#000;background:#fff">CONTROLE positivo preto sobre branco</span>',
    ].join('');
    document.body.appendChild(caixa);
    const achados = window.medirContraste().filter((achado) => achado.texto.startsWith('CONTROLE'));
    caixa.remove();
    return achados;
  })()`);
};
let controlesValidos = true;
for (const tema of ['light', 'dark']) {
  dizer(`\n== CONTROLES no tema ${tema} ==`);
  const controles = await medirControles(tema);
  for (const controle of controles) {
    const reprovou = controle.razao < controle.minimo;
    dizer(`  ${reprovou ? 'REPROVADO' : 'aprovado '}  ${controle.razao}:1 (mínimo ${controle.minimo})  ${controle.texto_cor} sobre ${controle.fundo_cor}  «${controle.texto}»`);
  }
  const porNome = (trecho) => controles.find((controle) => controle.texto.includes(trecho));
  const negativoFixo = porNome('negativo fixo'); const negativoToken = controles.filter((controle) => controle.texto.includes('token') && controle.razao < controle.minimo);
  const negativoOpacidade = porNome('opacidade'); const negativoAlfa = porNome('cinza sobre preto'); const positivo = porNome('positivo');
  const valeu = negativoFixo.razao < 4.5 && negativoToken.length > 0 && negativoOpacidade.razao < 4.5 && negativoAlfa.razao < 4.5 && positivo.razao > 20.9;
  dizer(`  => controle negativo fixo reprovou: ${negativoFixo.razao < 4.5} · negativos com tokens que reprovaram: ${negativoToken.length} · negativo de opacidade reprovou: ${negativoOpacidade.razao < 4.5} · negativo de alfa em camadas reprovou: ${negativoAlfa.razao < 4.5} · positivo passou: ${positivo.razao > 20.9} (${positivo.razao}:1)`);
  if (!valeu) controlesValidos = false;
}
dizer(`\nMEDIDA ${controlesValidos ? 'VÁLIDA' : 'INVÁLIDA'}: os controles negativos ${controlesValidos ? 'reprovaram' : 'NÃO reprovaram'} e o positivo ${controlesValidos ? 'passou' : 'não passou'}.`);
if (!controlesValidos) { fechar(); process.exit(2); }

// ---------- Telas ----------
const resumo = { light: { pares: 0, menor: 99, reprovados: 0 }, dark: { pares: 0, menor: 99, reprovados: 0 } };
const reprovados = new Map(); const desabilitados = new Map(); const bordas = new Map(); const menores = new Map(); const comImagem = new Map();
for (const [rota, nomeDaTela] of telas) {
  for (const tema of ['light', 'dark']) {
    for (const estado of ESTADOS) {
      await abrir(`/?visao=painel&superficie=desktop&tema=${tema}&estado=${estado}&print=1&idioma=pt-BR${rota}`);
      await avaliar(medidor + '; true');
      const achados = await avaliar('window.medirContraste()');
      const cena = `${nomeDaTela} ${tema} ${estado}`;
      let menorDaCena = 99; let reprovadosDaCena = 0;
      for (const achado of achados) {
        if (achado.tipo === 'cor-ilegivel') { dizer(`COR ILEGÍVEL em ${cena}: ${achado.bruta}`); continue; }
        if (achado.temImagemDeFundo) comImagem.set(`${tema} ${achado.onde}`, cena);
        if (achado.desabilitado) {
          if (achado.razao < achado.minimo) { const chave = `${tema} ${achado.texto_cor}/${achado.fundo_cor}`; if (!desabilitados.has(chave)) desabilitados.set(chave, { ...achado, cena, vezes: 0 }); desabilitados.get(chave).vezes++; }
          continue;
        }
        resumo[tema].pares++;
        if (achado.razao < resumo[tema].menor) { resumo[tema].menor = achado.razao; menores.set(tema, { ...achado, cena }); }
        menorDaCena = Math.min(menorDaCena, achado.razao);
        if (achado.razao < achado.minimo) {
          resumo[tema].reprovados++; reprovadosDaCena++;
          const chave = `${tema} ${achado.texto_cor}/${achado.fundo_cor} ${achado.onde}`;
          if (!reprovados.has(chave)) reprovados.set(chave, { ...achado, cena, vezes: 0, cenas: new Set() });
          reprovados.get(chave).vezes++; reprovados.get(chave).cenas.add(cena);
        }
      }
      for (const borda of await avaliar('window.medirBordas()')) {
        const chave = `${tema} ${borda.onde} ${borda.borda}/${borda.fora}/${borda.dentro}${borda.desabilitado ? ' (desabilitado)' : ''}`;
        if (!bordas.has(chave)) bordas.set(chave, { ...borda, cena, vezes: 0 });
        bordas.get(chave).vezes++;
      }
      dizer(`${reprovadosDaCena ? 'FAIL' : 'ok  '} ${cena}: ${achados.length} textos, menor ${menorDaCena}:1, reprovados ${reprovadosDaCena}`);
    }
  }
}
dizer('\n== RESUMO POR TEMA (texto habilitado) ==');
for (const tema of ['light', 'dark']) {
  const menor = menores.get(tema);
  dizer(`${tema}: ${resumo[tema].pares} pares medidos · menor razão ${resumo[tema].menor}:1 («${menor?.texto}» ${menor?.texto_cor} sobre ${menor?.fundo_cor}, ${menor?.cena}) · reprovados ${resumo[tema].reprovados}`);
}
dizer(`\n== PARES REPROVADOS (distintos: ${reprovados.size}) ==`);
for (const [chave, achado] of reprovados) dizer(`FAIL ${achado.razao}:1 < ${achado.minimo}  ${achado.texto_cor} sobre ${achado.fundo_cor}  ${achado.tamanho}px/${achado.peso}  «${achado.texto}»  ${achado.onde}  [${achado.vezes}x em ${achado.cenas.size} cenas; ex.: ${achado.cena}]  (${chave.split(' ')[0]})`);
dizer(`\n== TEXTO DE CONTROLE DESABILITADO ABAIXO DO MÍNIMO (isento pelo WCAG 1.4.3; pares distintos: ${desabilitados.size}) ==`);
for (const [chave, achado] of desabilitados) dizer(`isento ${achado.razao}:1  ${achado.texto_cor} sobre ${achado.fundo_cor}  «${achado.texto}»  ${achado.onde}  [${achado.vezes}x; ex.: ${achado.cena}]  (${chave.split(' ')[0]})`);
dizer(`\n== BORDAS DE CAMPO (1.4.11, mínimo 3:1; distintas: ${bordas.size}) ==`);
for (const [chave, borda] of bordas) dizer(`${borda.razao < 3 && !borda.desabilitado ? 'FAIL' : (borda.desabilitado ? 'isen' : 'ok  ')} ${borda.razao}:1  borda ${borda.borda} · fora ${borda.fora} · dentro ${borda.dentro} · ${borda.larguraDaBorda}px  ${borda.onde} «${borda.rotulo}»  [${borda.vezes}x; ex.: ${borda.cena}]  (${chave.split(' ')[0]})`);
dizer(`\n== TEXTO SOBRE IMAGEM DE FUNDO (não medido com exatidão; ${comImagem.size}) ==`);
for (const [chave, cena] of comImagem) dizer(`  ${chave} · ${cena}`);
dizer(`\n== CONSOLE DURANTE A MEDIDA (${new Set(registros).size} mensagens distintas) ==`);
for (const registro of new Set(registros)) dizer('  ' + registro);
writeFileSync(`${PASTA}contraste-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
