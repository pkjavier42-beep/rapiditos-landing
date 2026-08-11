/**
 * A dónde va cada petición que llega a rapiditos.app.
 *
 * Función pura y en su propio archivo para poder probarla sin Cloudflare, sin
 * red y sin desplegar nada. El Worker de al lado solo la llama y hace el
 * fetch: toda la decisión está acá, y toda la decisión tiene test.
 *
 * ═══ EL PROBLEMA QUE RESUELVE ═══
 *
 * El QR que el restaurante cuelga en la pared dice `rapiditos.app/r/lafonda`.
 * Pero ahí no hay nada: `rapiditos.app` es la landing de marketing, y la
 * carta la sirve el backend, en otro dominio.
 *
 * La salida fácil sería copiar los archivos de la carta a este repositorio.
 * Sería una segunda copia de algo que ya existe, y las segundas copias se
 * separan: una carta vieja llamando a una API nueva carga entera y después no
 * deja pedir. Así que en vez de copiar, este Worker **reenvía**.
 *
 * ═══ LA COLISIÓN QUE HAY QUE DESARMAR ═══
 *
 * `/r/lafonda` significa DOS cosas distintas según quién pregunte:
 *
 *   - el navegador, al abrir el QR  → quiere la PÁGINA de la carta
 *   - `app.js`, ya dentro de la página → quiere el JSON del restaurante
 *
 * Y las dos son la misma URL. Si se elige mal, o el cliente ve un volcado de
 * JSON en la pantalla, o la página carga y se queda vacía para siempre.
 *
 * Se distinguen por el propósito que el propio navegador declara en cada
 * petición (`Sec-Fetch-Dest`), no por adivinanza. Una navegación —escribir la
 * dirección, escanear un QR, hacer clic— llega como `document`; un `fetch`
 * desde el JavaScript de la página, no.
 *
 * Y antes que eso: si el último tramo tiene un punto, es un archivo
 * (`styles.css`, `app.js`). Los slugs de restaurante no llevan puntos —son
 * letras, números y guiones— así que la regla no puede confundirse.
 */

/** Dónde el backend sirve los archivos de la carta. */
const CARTA = '/carta';

/**
 * @param {string} pathname  la ruta pedida, tal cual
 * @param {string|null} destino  cabecera `Sec-Fetch-Dest`, si vino
 * @param {string|null} acepta   cabecera `Accept`, si vino
 * @returns {{destino: 'assets'} | {destino: 'backend', ruta: string}}
 */
export function decidir(pathname, destino, acepta) {
  // El panel del restaurante: reenvío tal cual, sin reglas. El backend lo
  // sirve bajo el mismo prefijo, así que las rutas coinciden una a una.
  if (pathname === '/panel' || pathname.startsWith('/panel/')) {
    return { destino: 'backend', ruta: pathname };
  }

  if (pathname !== '/r' && !pathname.startsWith('/r/')) {
    // Todo lo demás es la landing. En la práctica el Worker ni se entera:
    // Cloudflare sirve los archivos que existen sin invocarlo. Esta rama es
    // el cinturón de seguridad, no el camino habitual.
    return { destino: 'assets' };
  }

  const tramos = pathname.slice('/r/'.length).split('/').filter(Boolean);

  // `/r` o `/r/` sin restaurante: no hay carta que mostrar. Va a la landing,
  // que al menos explica qué es Rapiditos.
  if (tramos.length === 0) {
    return { destino: 'assets' };
  }

  const ultimo = tramos[tramos.length - 1];

  // 1. Un archivo. `index.html` pide `styles.css` y `app.js` con rutas
  //    relativas, así que desde `/r/lafonda` el navegador los busca en
  //    `/r/styles.css`. Se traducen a donde el backend los tiene.
  if (ultimo.includes('.')) {
    return { destino: 'backend', ruta: `${CARTA}/${ultimo}` };
  }

  // 2. Una navegación: alguien abrió esta dirección. Va la página.
  const esNavegacion =
    destino === 'document' ||
    // Navegadores viejos no mandan Sec-Fetch-Dest. `Accept: text/html` es el
    // respaldo: un `fetch` de datos pide JSON, no HTML.
    (destino === null && (acepta ?? '').includes('text/html'));

  if (esNavegacion) {
    return { destino: 'backend', ruta: `${CARTA}/index.html` };
  }

  // 3. Lo que queda es la página hablándole a la API: `/r/lafonda`,
  //    `/r/lafonda/menu`, `POST /r/lafonda/orders`. Pasa tal cual.
  //
  //    Y como sale por el mismo dominio, el navegador no lo trata como una
  //    llamada cruzada: no hay CORS que configurar ni que se pueda escribir
  //    mal. Ese es el motivo real de reenviar en vez de apuntar la carta a
  //    `api.rapiditos.app`.
  return { destino: 'backend', ruta: pathname };
}
