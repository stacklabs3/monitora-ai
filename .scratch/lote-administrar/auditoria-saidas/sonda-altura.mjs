// Sonda: a altura da página e da área que rola em cada tela e estado, na janela de 1440×900 (a página inteira não pode passar da moldura).
// Uso: node sonda-altura.mjs
import { abrirNavegador } from './lib.mjs';
const { avaliar, abrir, fechar } = await abrirNavegador({ porta: 9474 });
const ADMINISTRADOR = '#/painel/excurfly/producao/administrador'; const INVESTIGADOR = '#/painel/excurfly/producao/investigador';
const ROTAS = [`${ADMINISTRADOR}/aplicacoes`, `${ADMINISTRADOR}/aplicacoes/nova`, `${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a/gerada`, `${ADMINISTRADOR}/aplicacoes/site/chaves/ex2b/revogar`, `${ADMINISTRADOR}/catalogo`, `${ADMINISTRADOR}/catalogo/installmentCount/declarar`, `${INVESTIGADOR}/catalogo`, `${INVESTIGADOR}/saude`, `${INVESTIGADOR}/saude/24h/api`, `${ADMINISTRADOR}/saude/24h/webhooks`, `${INVESTIGADOR}/eventos/p=1h;f=reservationId:e:R-1042`, `${INVESTIGADOR}/tentativas/reservationId/R-1042`];
for (const rota of ROTAS) {
  const medidas = [];
  for (const estado of ['default', 'offline', 'error', 'loading', 'empty']) {
    await abrir(`/?visao=painel&superficie=desktop&tema=light&estado=${estado}&print=1&idioma=pt-BR${rota}`);
    medidas.push(estado + ' ' + await avaliar(`(() => { const areaDaTela = document.querySelector('#root main main'); return document.documentElement.scrollHeight + '/' + innerHeight + (areaDaTela ? ' (área que rola ' + areaDaTela.scrollHeight + '/' + areaDaTela.clientHeight + ')' : ''); })()`));
  }
  console.log(rota.replace('#/painel/excurfly/producao/', '') + ' → ' + medidas.join(' · '));
}
fechar();
