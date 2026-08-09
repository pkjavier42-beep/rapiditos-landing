import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decidir } from './rutas.mjs';

/**
 * Se corre con:   node --test
 *
 * Sin dependencias, sin instalar nada, sin Cloudflare. Toda la decisión de
 * enrutado vive en una función pura justamente para que se pueda probar acá,
 * en dos segundos, en vez de desplegando y mirando el navegador.
 */

const NAVEGA = ['document', null];
const PIDE_DATOS = [null, 'application/json'];

test('la landing no se toca', () => {
  for (const ruta of ['/', '/index.html', '/logo.png', '/images/foto.jpg']) {
    assert.deepEqual(decidir(ruta, null, null), { destino: 'assets' }, ruta);
  }
});

test('escanear el QR trae la PÁGINA de la carta', () => {
  // El caso que importa: alguien apunta la cámara al papel pegado en la
  // pared. Si esto devolviera el JSON, el cliente vería un volcado de datos.
  assert.deepEqual(decidir('/r/lafonda', ...NAVEGA), {
    destino: 'backend',
    ruta: '/carta/index.html',
  });
});

test('la MISMA ruta, pedida por el JavaScript de la página, trae el JSON', () => {
  // Y esta es la otra mitad de la colisión: `/r/lafonda` significa dos cosas
  // distintas segun quien pregunte. Elegir mal deja la carta vacia para
  // siempre, sin ningun error visible.
  assert.deepEqual(decidir('/r/lafonda', ...PIDE_DATOS), {
    destino: 'backend',
    ruta: '/r/lafonda',
  });
});

test('el resto de la API pasa tal cual', () => {
  for (const ruta of ['/r/lafonda/menu', '/r/lafonda/orders']) {
    assert.deepEqual(decidir(ruta, ...PIDE_DATOS), { destino: 'backend', ruta });
  }
});

test('los archivos que pide la página se traducen a donde el backend los tiene', () => {
  // `index.html` los pide con rutas relativas, asi que desde `/r/lafonda` el
  // navegador los busca en `/r/…`. Sin esta regla, la carta sale sin estilos
  // y sin JavaScript: una pantalla en blanco.
  assert.deepEqual(decidir('/r/styles.css', 'style', null), {
    destino: 'backend',
    ruta: '/carta/styles.css',
  });
  assert.deepEqual(decidir('/r/app.js', 'script', null), {
    destino: 'backend',
    ruta: '/carta/app.js',
  });
  assert.deepEqual(decidir('/r/config.js', 'script', null), {
    destino: 'backend',
    ruta: '/carta/config.js',
  });
});

test('un archivo gana sobre la navegación, aunque el navegador diga document', () => {
  // Orden de las reglas: el punto se mira ANTES que Sec-Fetch-Dest. Si fuera
  // al reves, abrir /r/styles.css a mano devolveria la pagina de la carta con
  // un 200 — un 200 que miente es peor que un 404.
  assert.deepEqual(decidir('/r/styles.css', 'document', 'text/html'), {
    destino: 'backend',
    ruta: '/carta/styles.css',
  });
});

test('sin restaurante no hay carta que mostrar', () => {
  for (const ruta of ['/r', '/r/']) {
    assert.deepEqual(decidir(ruta, ...NAVEGA), { destino: 'assets' }, ruta);
  }
});

test('un navegador viejo, sin Sec-Fetch-Dest, igual recibe la página', () => {
  assert.deepEqual(
    decidir('/r/lafonda', null, 'text/html,application/xhtml+xml'),
    { destino: 'backend', ruta: '/carta/index.html' },
  );
});

test('el panel del restaurante se reenvía sin tocar', () => {
  for (const ruta of ['/panel', '/panel/', '/panel/_expo/static/js/web/x.js']) {
    assert.deepEqual(decidir(ruta, 'document', null), { destino: 'backend', ruta }, ruta);
  }
});

test('una ruta que empieza parecido NO cae en la regla', () => {
  // `/rifa` empieza con "/r" y no tiene nada que ver. Si `startsWith('/r')`
  // se hubiera escrito sin la barra, esta pagina de la landing se habria
  // mandado al backend y devolveria 404.
  assert.deepEqual(decidir('/rifa', 'document', null), { destino: 'assets' });
  assert.deepEqual(decidir('/restaurantes', 'document', null), { destino: 'assets' });
});
