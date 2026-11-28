// Biblioteca da auditoria: Chrome sem janela pelo protocolo de depuração.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

export const BASE = 'http://localhost:8771';
export const PASTA = new URL('.', import.meta.url).pathname;
export const esperar = (milissegundos) => new Promise((resolver) => setTimeout(resolver, milissegundos));

export const abrirNavegador = async ({ porta = 9361, largura = 1440, altura = 900 } = {}) => {
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${PASTA}perfil-${porta}`, `--window-size=${largura},${altura}`,
    '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  let conexao; let proximoId = 1; const pendentes = new Map(); const registros = [];
  const enviar = (method, params = {}) => new Promise((resolver) => {
    const id = proximoId++; pendentes.set(id, resolver); conexao.send(JSON.stringify({ id, method, params }));
  });
  for (let vez = 0; vez < 60; vez++) {
    try {
      const alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json();
      const pagina = alvos.find((alvo) => alvo.type === 'page');
      if (pagina) { conexao = new WebSocket(pagina.webSocketDebuggerUrl); break; }
    } catch { /* ainda subindo */ }
    await esperar(200);
  }
  await new Promise((resolver) => { conexao.onopen = resolver; });
  conexao.onmessage = (mensagem) => {
    const dados = JSON.parse(mensagem.data);
    if (dados.id && pendentes.has(dados.id)) { pendentes.get(dados.id)(dados.result || dados.error); pendentes.delete(dados.id); return; }
    if (dados.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(dados.params.type)) {
      registros.push(`console.${dados.params.type}: ${dados.params.args.map((argumento) => argumento.value ?? argumento.description).join(' ').slice(0, 300)}`);
    }
    if (dados.method === 'Runtime.exceptionThrown') registros.push(`excecao: ${dados.params.exceptionDetails.exception?.description || dados.params.exceptionDetails.text}`.slice(0, 400));
    if (dados.method === 'Log.entryAdded' && ['error', 'warning'].includes(dados.params.entry.level)) registros.push(`log.${dados.params.entry.level}: ${dados.params.entry.text} ${dados.params.entry.url || ''}`);
    if (dados.method === 'Network.responseReceived' && dados.params.response.status >= 400) registros.push(`http ${dados.params.response.status}: ${dados.params.response.url}`);
    if (dados.method === 'Network.loadingFailed' && !dados.params.canceled) registros.push(`rede falhou: ${dados.params.errorText}`);
  };
  for (const dominio of ['Runtime', 'Log', 'Network', 'Page', 'DOM', 'CSS']) await enviar(`${dominio}.enable`);
  await enviar('Network.setCacheDisabled', { cacheDisabled: true });
  await enviar('Emulation.setFocusEmulationEnabled', { enabled: true });
  await enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false });

  const avaliar = async (expressao) => {
    const resposta = await enviar('Runtime.evaluate', { expression: expressao, returnByValue: true, awaitPromise: true });
    if (resposta.exceptionDetails) throw new Error(resposta.exceptionDetails.exception?.description || 'erro ao avaliar');
    return resposta.result.value;
  };
  const abrir = async (caminho) => {
    await enviar('Page.navigate', { url: 'about:blank' });
    await esperar(80);
    await enviar('Page.navigate', { url: BASE + caminho });
    for (let vez = 0; vez < 100; vez++) {
      await esperar(120);
      if (await avaliar('Boolean(document.querySelector("#root") && document.querySelector("#root").children.length)')) break;
    }
    await avaliar('document.fonts.ready.then(() => true)');
    await esperar(450);
  };
  const clicar = async (expressaoDoElemento, descricao) => {
    const ponto = await avaliar(`(() => { const el = ${expressaoDoElemento}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const caixa = el.getBoundingClientRect(); return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }; })()`);
    if (!ponto) throw new Error(`não achei: ${descricao || expressaoDoElemento}`);
    await enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: ponto.x, y: ponto.y });
    for (const type of ['mousePressed', 'mouseReleased']) await enviar('Input.dispatchMouseEvent', { type, x: ponto.x, y: ponto.y, button: 'left', clickCount: 1 });
    await esperar(300);
  };
  const moverMouse = async (horizontal, vertical) => { await enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: horizontal, y: vertical }); await esperar(150); };
  const digitar = async (texto) => { await enviar('Input.insertText', { text: texto }); await esperar(150); };
  const CODIGOS = { Enter: 13, Tab: 9, Escape: 27, ArrowDown: 40, ArrowUp: 38, ' ': 32, '/': 191, '?': 191 };
  const tecla = async (key, { shift = false } = {}) => {
    const code = key === ' ' ? 'Space' : key;
    for (const type of ['keyDown', 'keyUp']) {
      await enviar('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: CODIGOS[key] || 0, modifiers: shift ? 8 : 0,
        text: type === 'keyDown' && key === 'Enter' ? '\r' : (type === 'keyDown' && key.length === 1 ? key : undefined) });
    }
    await esperar(220);
  };
  const foto = async (nome) => {
    const { data } = await enviar('Page.captureScreenshot', { format: 'png' });
    mkdirSync(`${PASTA}fotos`, { recursive: true });
    writeFileSync(`${PASTA}fotos/${nome}.png`, Buffer.from(data, 'base64'));
  };
  const fechar = () => { try { conexao.close(); } catch { /* já fechou */ } chrome.kill(); };
  return { enviar, avaliar, abrir, clicar, moverMouse, digitar, tecla, foto, registros, fechar };
};
export const porTexto = (seletor, texto) => `[...document.querySelectorAll(${JSON.stringify(seletor)})].find((el) => el.textContent.trim().startsWith(${JSON.stringify(texto)}))`;
