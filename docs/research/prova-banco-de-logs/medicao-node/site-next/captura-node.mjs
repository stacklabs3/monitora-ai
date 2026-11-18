// Liga console.warn e console.error do site à biblioteca sintética.
import { randomUUID } from 'node:crypto';
import { criarMonitora } from './biblioteca.mjs';

const NIVEL_AVISO = 40;
const NIVEL_ERRO = 50;

export function iniciarCaptura() {
  if (globalThis.monitoraSintetica || !process.env.RECEBEDOR) return;
  const monitora = criarMonitora({
    endereco: process.env.RECEBEDOR,
    chaveCodigos: 'chave-sintetica-da-prova',
    produto: 'excurfly',
    aplicacao: 'site-sintetico',
    execucao: `site-${randomUUID()}`,
  });
  globalThis.monitoraSintetica = monitora;

  const capturar = (nivel, argumentos) => {
    const dados = argumentos.find((argumento) => argumento !== null && typeof argumento === 'object') ?? {};
    const mensagem = argumentos.find((argumento) => typeof argumento === 'string') ?? '';
    monitora.destino.write(JSON.stringify({ level: nivel, time: Date.now(), msg: mensagem, ...dados }));
  };
  for (const [nomeMetodo, nivel] of [['warn', NIVEL_AVISO], ['error', NIVEL_ERRO]]) {
    const metodoOriginal = console[nomeMetodo].bind(console);
    console[nomeMetodo] = (...argumentos) => {
      capturar(nivel, argumentos);
      metodoOriginal(...argumentos);
    };
  }
  // Tentativa sem garantia: o Next pode encerrar o processo antes de terminar (ADR 0001).
  process.once('SIGTERM', () => { monitora.encerrar(); });
}
