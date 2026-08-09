import { decidir } from './rutas.mjs';

/**
 * rapiditos.app: la landing, la carta del cliente y el panel del restaurante,
 * bajo un solo dominio.
 *
 * ═══ QUÉ HACE Y QUÉ NO ═══
 *
 * Casi nada, a propósito. La landing la sigue sirviendo Cloudflare
 * directamente: cuando la dirección pedida corresponde a un archivo que existe
 * en este repositorio, **este código ni se ejecuta**. Eso no es un detalle —
 * es lo que hace que un error acá no pueda tumbar el sitio de marketing. El
 * radio de daño son las direcciones que hoy dan 404.
 *
 * Lo que sí atiende:
 *
 *   /r/<slug>   la carta del cliente   → la sirve el backend en /carta/
 *   /panel/…    el panel del dueño     → la sirve el backend en /panel/
 *
 * La decisión de qué va a dónde está en `rutas.mjs`, que es una función pura
 * con sus tests. Acá solo queda el reenvío.
 *
 * ═══ POR QUÉ REENVIAR Y NO REDIRIGIR ═══
 *
 * Un redirect a `api.rapiditos.app` sería más simple de escribir y peor de
 * usar: la dirección en la barra cambiaría, el QR impreso dejaría de
 * coincidir con lo que el cliente ve, y la carta pasaría a hacer llamadas
 * cruzadas de dominio — o sea, CORS, y una lista blanca más que puede quedar
 * mal escrita.
 *
 * Reenviando, para el navegador todo ocurre en `rapiditos.app`. No hay
 * llamada cruzada. No hay nada que configurar.
 *
 * ═══ SIN `BACKEND_URL` ESTO NO HACE NADA ═══
 *
 * A propósito. Mientras la variable no esté puesta en Cloudflare, `/r/*` y
 * `/panel/*` se comportan igual que hoy: 404. Así este archivo puede vivir en
 * `main` antes de que el backend exista, sin cambiarle nada al sitio.
 *
 * Se enciende poniendo la variable, y se apaga borrándola.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const decision = decidir(
      url.pathname,
      request.headers.get('Sec-Fetch-Dest'),
      request.headers.get('Accept'),
    );

    const backend = (env.BACKEND_URL ?? '').trim();

    if (decision.destino === 'assets' || !backend) {
      return env.ASSETS.fetch(request);
    }

    const destino = new URL(decision.ruta, backend);
    // La consulta viaja entera: de ahí sale el `?r=<slug>` cuando se usa esa
    // forma, y cualquier parámetro que se agregue mañana.
    destino.search = url.search;

    // `redirect: 'manual'` para que un redirect del backend —por ejemplo
    // /panel → /panel/— llegue al navegador tal cual en vez de seguirse acá.
    // Si se siguiera, el navegador nunca corregiría la barra en su barra de
    // direcciones y las rutas relativas seguirían rotas.
    return fetch(
      new Request(destino, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'manual',
      }),
    );
  },
};
