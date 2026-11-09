# SuChemaFC

Catálogo y pedidos de camisetas de fútbol. _Tu equipo, tus colores, tu pasión._

Stack: Vite + React (JavaScript), Tailwind CSS, Firebase (Hosting, Firestore y Auth, plan Spark) y Google Apps Script para Drive. El plan completo está en [`docs/plan.md`](docs/plan.md).

## Instalación

```bash
npm install
cp .env.example .env   # en PowerShell: Copy-Item .env.example .env
```

Completa `.env` con la configuración web de Firebase, la URL del Web App de Apps Script y el número de WhatsApp.

## Scripts

| Comando                           | Descripción                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                     | Servidor de desarrollo. La página `/__design` muestra los tokens y pares de color (solo en dev).             |
| `npm run build`                   | Compilación de producción en `dist/`.                                                                        |
| `npm run lint`                    | ESLint.                                                                                                      |
| `npm run format` / `format:check` | Prettier.                                                                                                    |
| `npm run check:contrast`          | Verifica contraste WCAG AA de los tokens de `src/index.css`.                                                 |
| `npm run check:brand`             | Verifica navbar negro fijo y colores dentro de la paleta.                                                    |
| `npm run prerender`               | Genera `dist/p/<id>/` por camisa (Open Graph), `sitemap.xml` y `robots.txt`. Requiere `npm run build` antes. |

## Marca y diseño

- Paleta: negro `#000000`, dorado `#D4AF37` y blanco como detalle. Tema oscuro por defecto (fondo 100% negro) y tema claro, guardado en `localStorage`.
- El **navbar es siempre negro** (con borde y acentos dorados) en ambos temas.
- Logo oficial: `src/assets/logo.png` (y `logo-small.png` para tamaños chicos), usado siempre mediante el componente `Logo`.

## Despliegue

```bash
npm run build
npm run prerender   # lee las camisas visibles de Firestore; define SITE_URL si usas dominio propio
npx firebase-tools login
npx firebase-tools deploy --only hosting
```

La puesta en marcha (publicar reglas, crear el primer admin, Apps Script), el flujo diario, la revisión de seguridad y las cuotas de Spark están en [`docs/operacion.md`](docs/operacion.md). `npm run deploy` hace build + prerender + deploy de hosting y reglas.

## OneDrive

Esta carpeta se sincroniza con OneDrive. Conviene excluir `node_modules`, `dist` y `.firebase` de la sincronización.
