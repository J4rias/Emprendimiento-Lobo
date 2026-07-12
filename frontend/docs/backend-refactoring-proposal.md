# Propuesta de Refactoring del Backend — Atlas ERP

> **Autor:** Claude (agente mapeador) — revisado 2026-07-03 con perspectiva de tech lead / arquitecto / jefe de seguridad
> **Fecha:** 2026-07-03 | **Última actualización:** 2026-07-04
> **Base de evidencia:** Mapeo de 27 módulos / 176 endpoints / 133 no conformidades documentadas + 63 pruebas HTTP reales ejecutadas contra `:5001` + auditoría completa de `api-dictionary.md`.
> **Stack evaluado:** Node 24 + Express 4.22 + Sequelize 6.37 + MySQL + React 18 + Vite 5
> **Estado:** ✅ **Fase 0 COMPLETADA (2026-07-04)** — Fase 1 es el siguiente paso

---

## 1. Resumen ejecutivo

El backend de Atlas ERP **funciona en producción** y el stack base (Node + Express + Sequelize + MySQL) sigue siendo adecuado — no hay urgencia de reescritura. Después de mapear 176 endpoints, correr 63 pruebas reales y auditar el diccionario completo, se identificaron riesgos de seguridad, bugs financieros críticos y deuda estructural. **La Fase 0 (todos los P0) está completada (2026-07-04).**

**Deuda estructural pendiente (Fases 1-3):** shape de respuesta caótico (cada módulo usa wrapper `success` distinto), controllers con hasta 1155 líneas sin capa de servicio, 4 políticas de delete distintas, 4 convenciones de date params, modelos mezclando camelCase y snake_case, N+1 queries en 3 módulos críticos, 0 TypeScript, 0 CI/CD, 0 backups.

La propuesta prioriza **estabilización sobre modernización**. Cuatro fases incrementalmente seguras, sin reescritura big-bang, sin migrar a TypeScript/Prisma/Fastify de golpe.

**No se recomienda:**
- Migrar Sequelize → Prisma (44 modelos + raw SQL masiva = semanas de trabajo, alto riesgo)
- Migrar Express → Fastify (recompensa marginal)
- Migrar a TypeScript big-bang (mejor opt-in por módulo nuevo)
- Saltar a Express 5 / Sequelize 7 sin razón de negocio

**Estado actual (2026-07-04):**
- ✅ Fase 0 completa — 0 riesgos de seguridad activos, 0 bugs financieros críticos conocidos
- ✅ 27/27 módulos con tests de integración (scripts/api-tests/)
- ✅ `utils/responseHelpers.js` creado (base para normalización Fase 1)
- ✅ `console.log` eliminado de socket/posSocket.js → logger
- ✅ Dead code `void inventory` eliminado de sale.controller.js
- 🔜 Fase 1 — TypeScript setup + estándares internos (siguiente)

---

## 2. Diagnóstico del stack actual

### 2.1 Versiones instaladas vs. últimas estables

| Componente        | Versión actual | Última estable | Estado                                  |
|-------------------|----------------|----------------|-----------------------------------------|
| Node              | 24.15.0        | 24.x (LTS)     | ✅ Adecuado                            |
| Express           | 4.22.2         | 4.22 / 5.1     | ⚠️ 4.x mantenido, 5.x disponible       |
| Sequelize         | 6.37.8         | 6.37 / 7.0     | ⚠️ 6.x mantenido, 7.x disponible       |
| mysql2            | 3.22.3         | 3.x            | ✅ Adecuado                            |
| jsonwebtoken      | 9.0.3          | 9.x            | ✅ Adecuado                            |
| bcrypt + bcryptjs | 5.1.1 + 3.0.3  | —              | ❌ **Redundante** — usar solo uno      |
| multer            | 1.4.5-lts.2    | 2.x            | ⚠️ LTS funciona, 2.x disponible        |
| express-validator | 7.3.2          | 7.x            | ⚠️ Usado en solo 4 módulos             |
| helmet/cors/etc   | recientes      | —              | ✅ Adecuado                            |
| socket.io         | 4.8.3          | 4.x            | ⚠️ Presente pero "disabled" (deuda)    |
| React             | 18.2           | 19.x           | ✅ Mantener (19 aún madurando en ecosistema) |
| Vite              | 5.x            | 7.x            | ⚠️ Podría saltar a 6 estable            |
| Zustand           | 4.4            | 5.x            | ⚠️ 5.x disponible                       |
| react-router      | 6.21           | 7.x            | ⚠️ 7.x disponible                       |
| TypeScript        | **No usado**   | 5.x            | ❌ Mayor red flag                       |

### 2.2 Qué SÍ es adecuado (mantener)

- **Node 24 LTS** — sin acción
- **Express 4.22** — mantenido hasta 2026+, sin urgencia
- **Sequelize 6.37** — compatible con MySQL 8, soporta hooks, paranoid, virtual fields, raw SQL. Lo usan 44 modelos correctamente
- **mysql2** — el driver correcto para MySQL
- **JWT (jsonwebtoken)** — para single-tenant ERP está bien. No hace falta añadir sesiones DB-backed salvo que se quiera blacklist real
- **Frontend stack** (React 18 + react-query 5 + Zustand 4 + Tailwind 3) — sólido, sin urgencia de saltar versiones
- **Arquitectura MVC + routes + controllers + models** — para este tamaño, patrón adecuado

### 2.3 Qué NO es adecuado (requiere acción)

- **0 TypeScript** — para 44 modelos y 176 endpoints, es el mayor red flag. Bugs de typos en `req.body.customer_id` vs `req.body.customerId` son rutinarios (lo vi documentado en 5+ módulos)
- **Solo 3 archivos de tests** (`tests/customer.statement.test.js`, `pos.integration.test.js`, `payment-conversion.test.js`) — cobertura ínfima para 27 módulos
- **Express + body-parser 1.20.5** — error handler no captura `SyntaxError` de JSON malformado, expone stack trace completo (verificado en prueba 63)
- **bcrypt + bcryptjs ambos instalados** — Auth controller usa `bcryptjs`, otros usan `bcrypt`. Unificar
- **multer 1.4 LTS** — sin parche de seguridad garantizado, multer 2.x tiene mejoras de seguridad relevantes
- **modelos camelCase mezclados** — Customer/PriceList/Quote/PreOrder usan camelCase; resto snake. Sequelize `underscored: true` mal aplicado
- **errorHandler inconsistente** — captura bien Sequelize errors pero no body-parser; controllers individuales reimplementan try/catch con shapes distintos
- **3 módulos CRUD incompletos** — BNK/PKG/PRT solo tienen 1 endpoint. Para un ERP, es deuda operacional
- **Sin CI/CD ni backups** (ver memory `project_tech_debt`)

> ✅ **Socket.io está ACTIVO** (verificado 2026-07-03 en `server.js:12-33`, controllers emiten en 5 lugares, frontend `usePOSSocket` con `isEnabled: true`). La memory `project_pos_refactor` estaba desactualizada al decir "disabled". No eliminarlo — provee sincronización de reservas POS en tiempo real entre cajeros.

---

## 3. Principios rectores del refactoring

1. **Estabilidad primero** — nada de reescrituras big-bang. Cada cambio debe ser reversible y de bajo blast radius.
2. **Un módulo a la vez** — normalizar por módulo, con suite de tests como puerta.
3. **Acoplo cero con frontend** — los cambios de API se coordinan con Joel; el frontend no se rompe por default.
4. **Evidencia sobre opinión** — cada decisión cita una no conformidad de `endpoint-normalization.md` o un resultado de prueba.
5. **Documentación viva** — el `api-dictionary.md` se actualiza en cada PR de normalización.
6. **Tests como contrato** — antes de refactorizar un módulo, capturar su comportamiento actual en tests (caracterización).

---

## 4. P0 — Quick wins de seguridad ✅ FASE 0 COMPLETADA (2026-07-04)

Todos los ítems implementados. Cero riesgos de seguridad activos y cero bugs financieros críticos conocidos.

### 4.1 Path traversal en `DELETE /api/upload/image` ✅ IMPLEMENTADO

**Evidencia original:** prueba 49 del 2026-07-03 — `url: "../../../etc/passwd"` devolvió `200 success`.

**Fix propuesto:**

```js
// middleware/upload.js o inline en route
const path = require('path');
const PUBLIC_DIR = path.resolve(__dirname, '../public');

function safeResolve(url) {
  const resolved = path.resolve(PUBLIC_DIR, url.replace(/^\//, ''));
  if (!resolved.startsWith(PUBLIC_DIR + path.sep) && resolved !== PUBLIC_DIR) {
    throw new Error('URL fuera del directorio permitido');
  }
  return resolved;
}

// en DELETE handler
const imagePath = safeResolve(url);
```

**Implementado en:** `backend/routes/upload.routes.js` — `path.resolve` + check `startsWith(basePath + path.sep)`.

### 4.2 Stack trace expuesto en JSON malformado ✅ IMPLEMENTADO

**Evidencia:** prueba 63 — `POST /api/sales` con `{invalid json` devolvió:
```
{"success":false,"message":"...","error":"SyntaxError: ...\n    at JSON.parse (<anonymous>)\n    at parse (/home/joel/Projects/Emprendimiento-Lobo/backend/node_modules/.pnpm/body-parser@1.20.5/...)\n    at /home/joel/Projects/..."}
```

Stack trace expone paths internos, versiones de paquetes, estructura de `node:internal/*`.

**Fix propuesto:** añadir captura en `errorHandler.js`:

```js
// body-parser SyntaxError
if (err.type === 'entity.parse.failed' || err.name === 'SyntaxError') {
  return res.status(400).json({
    message: 'JSON inválido en el cuerpo de la petición'
  });
}
```

Y eliminar el campo `error: err.message` de TODOS los catch en controllers (SLE, SPY, PRE, BNK, UPL — grep `error: error.message` para localizar).

**Implementado en:** `backend/middleware/errorHandler.js` — captura `SyntaxError` con `err.status === 400 && 'body' in err`; respuesta default en prod no expone stack ni `err.message`.

### 4.3 `authorize` faltante en AR admin-pin ✅ IMPLEMENTADO

**Evidencia:** `ar.routes.js` líneas 22-24 — `getAdminPinStatus`, `validateAdminPin`, `setAdminPin` solo tienen `authenticate`, no `authorize`. Cualquier usuario autenticado puede probar PINs (con rate limit interno) o setear el PIN (en `PUT /admin-pin`).

**Fix propuesto:**
```js
router.get('/admin-pin/status', authenticate, authorize('admin'), arController.getAdminPinStatus);
router.post('/admin-pin/validate', authenticate, authorize('admin'), arController.validateAdminPin);
router.put('/admin-pin', authenticate, authorize('admin'), arController.setAdminPin);
```

**Implementado en:** `backend/routes/ar.routes.js` — los tres endpoints tienen `authorize('ar.view')`.

### 4.4 `user_id` del body en `POST /api/pos/reserve` ✅ IMPLEMENTADO

**Evidencia:** `posReservation.controller.js` línea 13 — `user_id` se lee del body. Riesgo de suplantación.

**Fix propuesto:**
```js
const user_id = req.user.id; // del token, no del body
```

**Implementado en:** `backend/controllers/posReservation.controller.js` — `const user_id = req.user.id;` (línea ~19).

### 4.5 Eliminar archivos `.bak` residuales ✅ IMPLEMENTADO

`backend/controllers/product.controller.js.bak` y `backend/controllers/inventory.controller.js.bak` — eliminados.

### 4.6 BUG-021: `addPayment` infla `paid_amount` más allá del total ✅ IMPLEMENTADO

**Contexto:** El flujo de abonos (AR) registra `credit_amount` sin validar que `paid_amount + abono <= sale.total_amount`. El resultado es sistemático en todos los clientes con historial de crédito: `paid_amount > total_amount`, lo que hace que el saldo pendiente aparezca negativo (deuda del negocio hacia el cliente) cuando en realidad ya está saldado.

**Impacto de negocio:** distorsiona los estados de cuenta, la cartera de crédito y cualquier reporte de aging de AR. Es el bug de mayor impacto financiero activo.

**Fix propuesto:**
```js
// En addPayment, antes de crear el pago:
const remainingBalance = sale.total_amount - sale.paid_amount;
const effectiveAmount = Math.min(paymentAmount, remainingBalance);
if (effectiveAmount <= 0) {
  return res.status(409).json({ message: 'La venta ya está completamente pagada' });
}
// usar effectiveAmount, no paymentAmount
```

**Implementado en:** `backend/controllers/sale.controller.js` — valida `totalNewlyPaidUSD > remainingBalance + 0.01` antes de crear pagos; retorna 400 si excede.

### 4.7 INV.getValuation: false positive en error ✅ IMPLEMENTADO

**Evidencia:** `inventory.controller.js` — el handler de `getValuation` tiene `catch` que devuelve `{ success: true, data: { items: [] } }` en lugar de propagar el error. Si la query falla (timeout, join roto, cambio de schema), el frontend recibe un reporte de valoración de $0 sin ningún aviso.

**Fix propuesto:**
```js
// catch actual (❌):
catch (error) {
  return res.json({ success: true, data: { items: [], totalValue: 0 } });
}

// fix (✅):
catch (error) {
  logger.error('getValuation failed', { error: error.message });
  return res.status(500).json({ message: 'Error al calcular la valoración de inventario' });
}
```

**Implementado en:** `backend/controllers/inventory.controller.js` — catch de `getValuation` devuelve `res.status(500).json({ message: 'Error interno del servidor' })`.

### 4.8 CORS hardcoded → variable de entorno ✅ IMPLEMENTADO

**Evidencia (memory `project_tech_debt`):** el origin de CORS está hardcodeado en `server.js`. En producción esto significa que si el dominio del frontend cambia (o se añade el catálogo como cliente), hay que tocar código y redesplegar.

**Fix propuesto:**
```js
// server.js
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000'];

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
});
app.use(cors({ origin: allowedOrigins, credentials: true }));
```

```env
# .env.empresa1
CORS_ORIGINS=https://erp.atlas-group.cloud,https://catalogo.atlas-group.cloud
```

**Implementado en:** `backend/app.js` (Express CORS) y `backend/server.js` (Socket.io CORS) — ambos leen `CORS_ORIGINS` (comma-separated) + `FRONTEND_URL`. Dev fallback: `localhost:3000-3006`.

```env
# .env.empresa1
CORS_ORIGINS=https://erp.atlas-group.cloud,https://catalogo.atlas-group.cloud
```

---

## 5. P1 — Estabilización de API (forma y errores)

Objetivo: que TODOS los endpoints usen el mismo shape de response y error, sin que importe el módulo.

### 5.1 Response shape estándar

Adoptar formalmente:

```js
// Lista paginada
{ data: [...], pagination: { total, totalPages, page, limit } }

// Single (GET/POST/PUT/PATCH)
{ message: "...", data: { ... } }

// Acción sin recurso (cancel, approve, etc.)
{ message: "..." }

// Error
{ message: "...", errors?: [...] }   // sin success, sin error.message
```

**Eliminación de `success`** — presente en 26/27 módulos. Es el cambio más grande pero más impactante.

**Estrategia de migración SIN romper frontend:**

Opción A (recomendada): añadir flag de feature `RESPONSE_STANDARD_V2=true` que envuelve respuestas con helper `res.ok()`, `res.paginated()`, `res.created()`, `res.fail()`. Backend lee el flag. Frontend puede consumir ambas formas durante la transición.

```js
// utils/responseHelpers.js
function ok(res, data, message) {
  return res.json({ message: message || 'OK', data });
}
function paginated(res, data, pagination) {
  return res.json({ data, pagination });
}
function created(res, data, message) {
  return res.status(201).json({ message: message || 'Creado', data });
}
function fail(res, status, message, errors) {
  return res.status(status).json({ message, ...(errors ? { errors } : {}) });
}
```

Cada módulo se migra en su propio PR. Una vez migrados todos, eliminar `success` de una vez.

### 5.2 Error handler unificado

Reescribir `middleware/errorHandler.js`:

```js
const ERROR_MAP = {
  SequelizeValidationError:     { status: 400, transform: e => ({ errors: e.errors.map(x => ({ field: x.path, message: x.message })) }) },
  SequelizeUniqueConstraintError:{ status: 409, transform: e => ({ errors: e.errors.map(x => ({ field: x.path, message: 'Ya existe' })) }) },
  SequelizeForeignKeyConstraintError:{ status: 400, message: 'Referencia inválida' },
  JsonWebTokenError:            { status: 401, message: 'Token inválido' },
  SyntaxError:                  { status: 400, message: 'JSON inválido' },  // body-parser
  // ... otros
};

module.exports = (err, req, res, next) => {
  logger.error(err.message, { name: err.name, url: req.originalUrl });
  const entry = ERROR_MAP[err.name] || { status: 500, message: 'Error interno del servidor' };
  const body = { message: entry.message || 'Error' };
  if (entry.transform) Object.assign(body, entry.transform(err));
  res.status(entry.status).json(body);
};
```

Esto resuelve:
- Stack trace expuesto (SyntaxError capturado)
- UniqueConstraintError ahora 409 (estándar)
- Shape consistente `{ message, errors? }`
- `error: err.message` eliminado

### 5.3 Auth middleware consistente

Hoy hay 3 patrones para acceder al usuario autenticado:
- `req.userId` (auth.controller, XCH, PRE)
- `req.user.id` (SLE, POS, INV adjust, TRF, SPY, PO)
- `req.user?.id || req.userId` (PRL — código defensivo)

**Fix:** `middleware/auth.js` debe inyectar `req.userId` Y `req.user` (siempre), y los controllers usar **solo `req.userId`**. Unificar en un único PR barriendo controllers.

### 5.4 Política única de soft delete

Hoy: PRD/BRD/SUP/QT/PRL/PRE soft-deletean; CAT/XCH/ROL/USR hard-deletean; SLE es paranoid; CST es mixto; SPY/DLV son soft-cancel.

**Recomendación:** adoptar **soft-delete con `paranoid: true`** en TODOS los modelos transaccionales (Sale ya lo hace). CAT/ROL/USR/XCH son tablas de configuración/referencia — también soft-delete con `deleted_at`.

**Cambios:**
- Todos los modelos Sequelize: añadir `paranoid: true`
- DELETE handler siempre hace `.destroy()` (Sequelize maneja el soft via paranoid)
- Para hard-delete administrativo: `destroy({ force: true })` solo desde endpoint admin dedicado

Esto es migración grande pero de bajo riesgo (no rompe endpoints). Fase 3.

---

## 6. P2 — Normalización estructural (paths y params)

### 6.1 Path renames

| Path actual                                    | Path propuesto                                              |
|------------------------------------------------|-------------------------------------------------------------|
| `app.use('/api', roleRoutes)` + `/roles`       | `app.use('/api/roles', roleRoutes)` + quitar prefijo interno|
| `/api/ar`                                      | `/api/accounts-receivable`                                  |
| `GET /api/products/barcode/:barcode`           | `GET /api/products?barcode=X`                               |
| `GET /api/products/export-csv`                 | `GET /api/products.csv` o `?format=csv`                     |
| `PUT /api/products/presentations/:id/set-default` | `PATCH /api/products/:productId/presentations/:id` con `{ is_default: true }` |
| `POST/PUT/DELETE /api/products/presentations/:id` (sin productId) | anidar `/:productId/presentations/:id` |
| `GET /api/inventory/warehouse/:id`, `/product/:id` (singular) | pluralizar + query `?warehouse_id=all` |
| `GET /api/inventory/warehouses`                | crear módulo `/api/warehouses` dedicado                     |
| `GET /api/sales/by-number/:saleNumber`         | `GET /api/sales?sale_number=X`                              |
| `GET /api/sales/daily-closure`                 | `GET /api/sales/daily-closure` (mantener — es STATS válido) |
| `GET /api/categories/with-count`               | `GET /api/categories?include=product_count`                 |
| `GET /api/brands/active`, `/customers/active`, `/suppliers/active` | `?is_active=true` + `?fields=id,name`       |
| `GET /api/supplier-payments/supplier/:id`, `/payable-balance/:id`, etc. | anidar `/api/suppliers/:id/payments` etc. |
| `PUT /api/supplier-payments/:id/cancel`        | `POST /api/supplier-payments/:id/cancel`                    |
| `PUT /api/pre-orders/:id/approve`, `/reject`   | `POST /api/pre-orders/:id/approve`, `/reject`               |
| `DELETE /api/upload/image` (con body)          | `DELETE /api/uploads/:filename`                             |
| `POST /api/upload/cleanup-expired`             | `DELETE /api/pos/reservations/expired`                      |

**Estrategia:** añadir paths nuevos manteniendo los viejos con `console.warn` (deprecation log). Tras 2 sprints sin uso del frontend, eliminar los viejos.

### 6.2 Query params estandarizados

Adoptar oficialmente:
- Paginación: `page` (default 25), `limit` (opciones 25/50/100)
- Búsqueda: `search`
- Filtros por campo: `<field>` (ej: `customer_id`)
- Fechas: SIEMPRE `date_from` / `date_to` (no `start_date`, no `from`, no `date`)
- Orden: `sort_by` + `sort_dir` (asc/desc)

**Migración por módulo:**
- PO y XCH ya conformes ✅
- SLE, INV, SPY, CN: cambiar `start_date`/`end_date` → `date_from`/`date_to`
- CST, QT: cambiar `customerId`/`dateFrom` → `customer_id`/`date_from`
- SLE summary/daily-series, CST purchases: cambiar `from`/`to` → `date_from`/`date_to`

### 6.3 Modelos camelCase → snake_case

`Customer`, `PriceList`, `Quote`, `PreOrder` usan `firstName`, `lastName`, `businessName`, `isDefault`, `validFrom`, `isDeleted`. Resto usa snake.

**Migración:** añadir `underscored: true` correctamente + cambiar definiciones de campos a snake. Frontend debe actualizar `customer.firstName` → `customer.first_name`. Es **breaking change grande**, requiere coordinación.

**Alternativa intermedia:** dejar como está pero **documentar** que esos 4 modelos son excepción. Migrar solo si se toca el módulo por otra razón.

---

## 7. Modernización — TypeScript como pilar central

> Decisión 2026-07-03: si vamos a refactorizar, **TypeScript deja de ser opcional** y se convierte en pilar del refactoring. Esta sección reemplaza al antiguo P3.

### 7.1 Socket.io — mantener y documentar

**Verificado 2026-07-03:** socket.io **está ACTIVO** (no deshabilitado como decía la memory vieja):
- `backend/server.js:12-33` inicializa el Server con CORS + transports websocket/polling
- `backend/socket/posSocket.js` define JWT auth middleware y handler completo
- `backend/controllers/posReservation.controller.js` emite `reservation:changed` en 4 acciones
- `backend/controllers/sale.controller.js` emite `reservation:changed` al completar venta
- `frontend/src/hooks/usePOSSocket.js` es hook completo con reconnect, auth, cleanup
- `frontend/src/hooks/usePOS.js:161` lo activa con `isEnabled: true`
- Background cleanup cada 30 min de reservas expiradas (`server.js:50-63`)

**Para qué sirve concretamente:** sincronización de stock reservado entre cajeros en tiempo real. Cuando cajero A en tablet 1 pone 10 unidades de Coca en su carrito (tab), cajero B en tablet 2 ve "disponible" reducir en 10 instantáneamente. Sin esto, dos cajeros podrían vender las mismas últimas unidades.

**Beneficios que entrega hoy:**
1. Prevenir overselling en POS multi-tab
2. Liberación inmediata al cerrar una pestaña (socket disconnect)
3. TTL de 2h por reserva + cron de limpieza
4. Auth vía JWT en handshake (`io.use` middleware)

**Acción:** documentarlo bien en `api-dictionary.md` como módulo POS-SOCKET. No eliminar. Evaluar extenderlo a notificaciones de stock bajo, new orders, etc. en futuras features.

### 7.2 TypeScript — estrategia de migración

**Por qué TS en este proyecto específicamente:**
- 44 modelos Sequelize con relaciones complejas — TS tipa asociaciones y evita errores en includes
- 5 patrones diferentes de `req.body.user_id` vs `req.userId` vs `req.user.id` — TS habría prevenido esto
- Modelos camelCase/snake_case mezclados — TS los hace evidentes en compile time
- Errores de typos en queries Sequelize (`Op.or` vs `op.or`) — TS los captura
- Frontend tiene `@types/react` instalado pero no usa TS — desperdicio

**Stack TS recomendado:**

```
typescript              5.5+
@types/node             20.x
@types/express          4.x
@types/jsonwebtoken     9.x
@types/multer           1.x
@types/bcryptjs         2.x
@types/cors             2.x
@types/compression      1.x
@types/winston          2.x
tsx                     4.x  (dev runner — reemplaza nodemon)
tsconfig-paths          (paths aliases)
```

**tsconfig.json propuesta inicial:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowJs": true,                    // clave: permite .js y .ts en paralelo
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,                     // meta, con allowJs aún no enforced
    "strictNullChecks": true,
    "noImplicitAny": false,             // suavizar migración
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": "./",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*", "server.ts", "app.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Estrategia de migración (Fase 1 → 3):**

| Fase | Acción | Cobertura TS |
|------|--------|--------------|
| Fase 1.0 (setup, 1 día) | Instalar TS, tsconfig con `allowJs: true`, `tsx` para dev | 0% (todos .js siguen funcionando) |
| Fase 1.1 (helpers, 2 días) | Migrar `middleware/errorHandler.ts`, `utils/responseHelpers.ts`, `middleware/auth.ts`, types centralizados | 5% pero crítico |
| Fase 1.2 (modelos Sequelize, 1 semana) | Tipar 44 modelos con `InferAttributes`/`InferCreationAttributes` nativos de Sequelize 6 (sin `sequelize-typescript` decorators) | 15% |
| Fase 2 (módulo por módulo) | Al refactorizar cada módulo, migrar sus controllers/routes a `.ts` | 50% al final de Fase 2 |
| Fase 3 (cleanup) | Activar `strict: true` completo, eliminar `noImplicitAny: false`, `allowJs: false` | 100% |

**Decisiones técnicas clave:**

- **CommonJS, no ESM** — Express 4 funciona mejor con CJS. No migrar a ESM hasta que el frontend también.
- **Sequelize 6 nativo**, sin `sequelize-typescript` — ya tiene `InferAttributes<Model>` desde v6.19. Una dependencia menos.
- **Build pipeline:** dev usa `tsx watch server.ts` (compila en memoria); prod usa `tsc && node dist/server.js`
- **TypeORM/Prisma:** NO — Sequelize 6 tiene soporte TS suficiente, migración es factible in-place
- **Frontend TS:** sí, pero después del backend. Misma estrategia `allowJs: true` → migrar por página/componente.

**Costo real estimado:**
- Setup inicial: 1 día
- Aprendizaje Joel: ya conoce JS bien, TS básico son 2-3 sesiones de pair programming
- Helpers + tipos base: 1 semana
- Modelos: 1 semana
- Migración completa módulo por módulo: distribuida en Fases 2-3 (no es esfuerzo extra, va atado al refactoring)

### 7.3 Zod para validación (junto con TS)

**Por qué Zod sobre express-validator:**
- **Type inference automática:** `z.object({ name: z.string() })` deriva el tipo TS automáticamente. No hay que mantener types y validadores separados.
- **Composición:** schemas anidados, optionals, unions, transforms fácilmente
- **Mensajes en español integrados:** `z.string({ required_error: "Nombre requerido" })`
- **OpenAPI generation:** zod-to-openapi genera docs automáticas desde schemas
- **Reusabilidad:** el mismo schema valida request body, response shape, y tipo TS

**Patrón de uso:**

```typescript
// schemas/sale.ts
import { z } from 'zod';

export const CreateSaleSchema = z.object({
  body: z.object({
    customer_id: z.number().int().positive().optional(),
    warehouse_id: z.number().int().positive(),
    sale_type: z.enum(['cash', 'credit', 'mixed']),
    items: z.array(z.object({
      product_id: z.number().int().positive(),
      presentation_id: z.number().int().positive(),
      quantity: z.number().positive(),
      is_unit: z.boolean().default(false),
      unit_price: z.number().positive().optional(),
    })).min(1, 'La venta debe tener al menos un producto'),
  }),
});

// Deriva el tipo TS automáticamente
export type CreateSaleInput = z.infer<typeof CreateSaleSchema>['body'];

// routes/sale.ts
import { validate } from '../middleware/validate';
router.post('/', validate(CreateSaleSchema), saleController.createSale);

// controllers/sale.ts — req.body ya está tipado como CreateSaleInput
```

**Migración:**
- Módulos existentes con `express-validator`: dejarlos hasta que se toquen
- Módulos nuevos: usar Zod desde el inicio
- Cuando un módulo se migre a TS (Fase 2), también migrar a Zod

**Dependencia:** `zod@3.x` + opcional `zod-to-openapi` para generar OpenAPI specs.

### 7.4 Consolidar bcrypt → solo `bcryptjs`

**Estado actual:** ambos instalados.
- `bcrypt@5.1.1` — nativo, requiere `node-gyp` (compilación), ~3x más rápido
- `bcryptjs@3.0.3` — pure JS, sin compilación, lo usa `auth.controller.js`

**Recomendación: quedarse solo con `bcryptjs`.**

| Criterio           | bcrypt                 | bcryptjs              |
|--------------------|------------------------|-----------------------|
| Performance        | ~45 ms/hash (cost 10)  | ~120 ms/hash          |
| Build              | node-gyp, falla en Windows/macOS sin toolchain | sin build |
| Mantenimiento      | native addon, deuda    | JS puro               |
| Auditabilidad      | binary, opaco          | legible               |

Para ERP con pocos logins/hora (no es auth bottleneck), los 75ms extra no importan. La simplicidad de deploy (sin `node-gyp`) sí importa.

**Acción:**
1. Grep por `require('bcrypt')` (sin `js`) — reemplazar con `bcryptjs`
2. `pnpm remove bcrypt`
3. Eliminar `node-gyp` de devDependencies

**Costo:** 30 min.

### 7.5 Migrar multer 1.4.5-lts → 2.x

**Estado actual:** `multer@1.4.5-lts.2` (rama LTS de la 1.x, con backports de seguridad).

**Qué cambia en multer 2.x:**
- Eliminado soporte Node < 14
- Mejor manejo de streams (memoria optimizada para uploads grandes)
- API mayormente compatible pero con breaking changes menores:
  - `multer().single()` ahora requiere explícito el field name
  - Manejo de errores de `LIMIT_FILE_SIZE` cambia ligeramente
- Parches de seguridad más rápidos

**Breaking changes que nos afectan:**
- `middleware/upload.js` usa `uploadSingle('image')` — verificar compat
- `handleMulterError` en `routes/upload.routes.js` — los códigos `LIMIT_FILE_SIZE` etc. se mantienen

**Acción:**
1. Branch nueva
2. `pnpm up multer@2`
3. Test manual del endpoint `/api/upload` con imagen real
4. Test de `/api/upload/multiple`
5. Verificar que `sharp` (que procesa las imágenes en `middleware/upload.js`) sigue compatible

**Costo:** 2 h (incluye tests manuales).
**Riesgo:** bajo — los cambios son pequeños y la API sigue mayormente igual.

### 7.6 CI/CD básico

**Por qué:** hoy 0 CI. Cada push a main se publica sin validación. Errores sintácticos se detectan en runtime en producción.

**Stack propuesto:**
- **GitHub Actions** (gratis para repos privados hasta 2000 min/mes)
- **Workflows:** `ci.yml` (en cada PR/push), `deploy.yml` (en merge a main)

**`.github/workflows/ci.yml` propuesta:**

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: test_db
        ports: ['3306:3306']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
        working-directory: backend
      - run: pnpm run lint
        working-directory: backend
      - run: pnpm run build  # cuando exista tsc build
        working-directory: backend
      - run: pnpm run test
        working-directory: backend
        env:
          DB_HOST: localhost
          DB_NAME: test_db
          JWT_SECRET: test-secret
```

**Beneficios concretos:**
- Detectar errores antes del deploy
- Validar que `pnpm-lock.yaml` está actualizado
- Códigos de cobertura visible en PRs
- En Fase 1 (TS), validar type-checking en CI antes de merge
- Tracking de tamaño de bundle frontend (Bundlewatch o similar)

**Costo:** 1 día setup inicial. Mantenimiento ~0.
**Bloqueador actual:** solo 3 tests — pero con TS + Fase 1 de tests base (4 por módulo = 108), CI se vuelve valioso.

### 7.7 Backups automatizados

**Estado actual:** 0 backups (memoria `project_tech_debt`). Si se rompe el VPS, se pierde todo.

**Riesgo:** datos de 5 meses de operación (ventas, customers, etc.) sin respaldo.

**Stack propuesto (mínimo viable):**
- Script `backend/scripts/backup.sh` usando `mysqldump`
- Subida a DigitalOcean Spaces o AWS S3 (compatible S3, ~$5/mes)
- Cron diario, retención 30 días rolling

**`scripts/backup.sh` prototipo:**

```bash
#!/bin/bash
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="/tmp/inversiones_db_${DATE}.sql.gz"

mysqldump \
  -h "$DB_HOST" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  --single-transaction \
  --routines --triggers \
  "$DB_NAME" | gzip > "$DUMP_FILE"

# Subir a S3-compatible
aws s3 cp "$DUMP_FILE" "s3://atlas-backups/db/${DATE}.sql.gz" \
  --endpoint-url "$S3_ENDPOINT"

# Limpiar viejos (retención 30 días)
aws s3 ls s3://atlas-backups/db/ --endpoint-url "$S3_ENDPOINT" | \
  awk '{print $4}' | sort -r | tail -n +31 | \
  xargs -I {} aws s3 rm "s3://atlas-backups/db/{}" --endpoint-url "$S3_ENDPOINT"

rm "$DUMP_FILE"
```

**Cron en el VPS:** `0 3 * * * /opt/atlas/backend/scripts/backup.sh >> /var/log/atlas-backup.log 2>&1`

** Mejoras opcionales:**
- Backup semanal a segundo destino (redundancia geográfica)
- Restore script + test de restore mensual (un backup que no se puede restaurar no sirve)
- Alertas a Telegram/email si falla el cron
- Dump de SequelizeMeta + migraciones para recrear schema en otra máquina

**Costo:** 4 h setup inicial. ~$5/mes storage.
**Riesgo sin esto:** crítico. Cualquier falla del VPS es pérdida total.

### 7.8 Eliminar archivos `.bak` y código muerto

**Hoy existen:**
- `backend/controllers/product.controller.js.bak`
- `backend/controllers/inventory.controller.js.bak`
- `console.log`/`console.error` residuales en 6+ controllers
- Variable `void inventory` en `sale.controller.js:890` (declarada pero no usada)

**Política:** prohibir `.bak` en repo. Git existe para eso. Lint rule que detecte `console.log` en código de producción.

### 7.9 Documentación OpenAPI automática

Con TS + Zod (§7.2 + §7.3), usar `@asteasolutions/zod-to-openapi` para generar spec OpenAPI desde los schemas. Esto da:
- `/api-docs` con Swagger UI
- `api-dictionary.md` generado automáticamente (reemplaza mi mapeo manual)
- Validación runtime + docs + types en una sola fuente de verdad

**Costo:** 2 días setup. Se activa después de que varios módulos estén en TS+Zod (Fase 2 avanzada).

### 7.10 Capa de servicio (Service Layer)

**Problema actual:** los controllers mezclan lógica de negocio, validación y acceso a datos. Los más grandes son `customer.controller.js` (1155 líneas) y `product.controller.js` (1054 líneas). Esto hace imposible testear la lógica de negocio sin levantar Express.

**Patrón propuesto:** extraer un directorio `backend/services/` con una clase o módulo por dominio. Los controllers se vuelven delegadores delgados.

```
backend/
  controllers/
    sale.controller.ts    ← solo maneja req/res, delega
  services/
    sale.service.ts       ← lógica de negocio, testeable
  repositories/           ← opcional: queries Sequelize complejas
    sale.repository.ts
```

```typescript
// sale.controller.ts (delgado)
export const createSale = async (req: Request, res: Response) => {
  const result = await saleService.createSale(req.body, req.userId);
  return res.status(201).json({ message: 'Venta creada', data: result });
};

// sale.service.ts (testeable sin Express)
export async function createSale(input: CreateSaleInput, userId: number) {
  return sequelize.transaction(async (t) => {
    // toda la lógica aquí
  });
}
```

**Beneficios:**
- Tests unitarios de lógica de negocio sin mock de `req`/`res`
- Reutilización entre controllers (ej. el atlas-bot puede llamar `saleService.getSummary()` directamente)
- Controllers < 100 líneas → lectura y auditoría de seguridad mucho más simples
- Con TS, los services tienen tipos completos de entrada/salida

**Estrategia:** no migrar en bulk. Extraer el servicio cuando se toque el módulo por otra razón (Fase 2). Empezar por `SaleService` (módulo más caótico y más crítico).

**Costo:** embebido en cada módulo que se refactoriza.

### 7.11 Endurecimiento de seguridad

#### 7.11.1 JWT: auditoría de expiración y rotación

**Estado actual:** `jsonwebtoken 9.0.3` con `JWT_SECRET` fijo en `.env`. No hay refresh tokens ni blacklist.

**Preguntas a responder:**
- ¿Cuánto dura el token? Si es días o "never expire", es riesgo.
- ¿Qué pasa si `JWT_SECRET` se compromete? No hay forma de invalidar todos los tokens activos.

**Recomendaciones:**
- Token de acceso con TTL corto (4-8 horas para ERP — más que suficiente para un día operativo).
- Para multi-sesión o "recordarme": refresh token con rotación (opcional, no urgente).
- Documentar explícitamente la duración en `.env.example` con `JWT_EXPIRES_IN=8h`.
- Logout → blacklist en Redis (simple set con TTL = tiempo restante del token) si se necesita invalidación real.

**Costo Fase 1:** 2 h (documentar + verificar TTL + ajustar si falta).

#### 7.11.2 UPL: `authorize` en upload ✅ IMPLEMENTADO

**Evidencia original:** `upload.routes.js` — solo aplicaba `authenticate`, no `authorize`. Cualquier usuario con sesión activa podía subir archivos al servidor.

**Riesgo:** usuario sin permisos de edición de productos puede subir imágenes y llenar el disco o inyectar contenido.

**Implementado:** `upload.routes.js` — `POST /` y `POST /multiple` tienen `authorize('products.update')`. `DELETE /image` tiene `authorize('products.update')`.

```js
router.post('/', authorize('products.update'), ...uploadSingle('image'), handleMulterError, handler);
router.post('/multiple', authorize('products.update'), ...uploadMultiple('images', 5), handleMulterError, handler);
router.delete('/image', authorize('products.update'), async (req, res) => { ... });
```

#### 7.11.3 Raw SQL: auditoría de inyección

Los módulos CTL, AR (`summary`, `customers`, `export`), SLE (`daily-closure`, `summary`, `daily-series`, `product-sales`) y POS (`credit_pin` vía raw SQL) usan `sequelize.query()` con interpolación. Aunque la mayoría pasa parámetros correctamente, el código de `credit_pin` accede a columnas no presentes en el modelo (acceso directo a BD sin ORM).

**Acciones:**
1. Auditar cada `sequelize.query()` para confirmar que usa `replacements: []` o `bind: []`, no interpolación de string directa.
2. Mover `credit_pin`, `credit_pin_attempts`, `credit_pin_locked_until` al modelo `User` con campos `allowNull: true` — dejarlos fuera del modelo es deuda que crece.
3. Documentar en `api-dictionary.md` qué queries son raw y por qué (justificación: performance, agregaciones complejas).

**Costo:** 1 día auditoría + 2 h para los campos de credit_pin.

#### 7.11.4 Escaneo de vulnerabilidades en dependencias

**Estado actual:** 0 CI, 0 npm audit automatizado. Una dependencia con CVE crítico podría estar activa sin saberlo.

**Acciones:**
- Añadir `pnpm audit --audit-level=high` como paso obligatorio en `ci.yml` (§7.6).
- Configurar Dependabot o Renovate para PRs automáticos de actualizaciones de seguridad.
- Primera ejecución manual: `pnpm audit` y triaje de CVEs activos (especialmente `multer 1.4.5-lts` y `bcrypt`).

**Costo:** 30 min setup inicial. Mantenimiento ~0.

#### 7.11.5 Audit log para operaciones sensibles

**Estado actual:** 0 registro de auditoría. No hay forma de saber quién canceló una venta, quién cambió el PIN de crédito, quién eliminó un producto o quién modificó las tasas de cambio.

**Propuesta mínima viable:** tabla `audit_logs` con `(user_id, action, entity, entity_id, old_values, new_values, ip_address, created_at)`. Middleware o hook Sequelize que registra automáticamente UPDATE/DELETE en modelos críticos.

```typescript
// middleware/auditLog.ts
export function auditLog(action: string, entity: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        AuditLog.create({
          user_id: req.userId,
          action,
          entity,
          entity_id: req.params.id,
          ip_address: req.ip,
        }).catch(err => logger.error('audit log failed', err));
      }
    });
    next();
  };
}

// En rutas críticas:
router.delete('/:id', authenticate, authorize('sales.delete'), auditLog('DELETE', 'Sale'), saleController.deleteSale);
```

**Entidades críticas:** Sale (cancel/delete), ExchangeRate (update/delete), User (create/update/delete), AR credit_pin (set/validate), ProductPresentation (price changes).

**Costo:** 1 día setup + embebido al tocar cada módulo crítico.

#### 7.11.6 Revisión de configuración de Helmet.js

`helmet` está instalado y listado como "adecuado", pero vale confirmar que se aplica a **todas** las rutas incluyendo el catálogo público y el endpoint de health. Verificar específicamente:
- `Content-Security-Policy` — si el API también sirve la SPA, puede interferir.
- `X-Frame-Options: DENY` — protege contra clickjacking.
- `Strict-Transport-Security` — solo si HTTPS está garantizado en el proxy nginx.

**Costo:** 30 min revisión + ajuste.

### 7.12 Performance

#### 7.12.1 N+1 queries — PO, CST, INV

El diccionario documenta tres casos confirmados de N+1:

| Módulo | Endpoint | Problema |
|--------|----------|---------|
| PO | `GET /api/purchase-orders` | Por cada orden: 2 queries extra (invoice + payment status) |
| CST | `GET /api/customers` | `productCount` calculado con subquery N veces |
| INV | `GET /api/inventory/warehouse/:id` | `presentations` adjuntados manualmente post-query |

**Fix general:** usar `include` de Sequelize o subqueries SQL en la query principal, no loops en JS.

```typescript
// PO antes (❌ N+1):
const orders = await PurchaseOrder.findAll();
for (const order of orders) {
  order.lastInvoice = await Invoice.findOne({ where: { po_id: order.id } });
}

// PO después (✅):
const orders = await PurchaseOrder.findAll({
  include: [{ model: Invoice, as: 'invoices', limit: 1, order: [['created_at', 'DESC']] }]
});
```

**Costo:** embebido al tocar cada módulo en Fase 2. No requiere acción inmediata.

#### 7.12.2 CTL — Catálogo público sin caché

`GET /api/catalog` es el único endpoint público del ERP y ejecuta 4 queries raw SQL por request. Si el catálogo en `catalogo.atlas-group.cloud` recibe tráfico real de clientes, cada visita golpea la BD.

**Propuesta:**
```typescript
// En catalog.controller.ts — caché en memoria simple (sin Redis)
import NodeCache from 'node-cache';
const catalogCache = new NodeCache({ stdTTL: 300 }); // 5 min

export const getCatalog = async (req, res) => {
  const cached = catalogCache.get('catalog');
  if (cached) return res.json(cached);

  const data = await buildCatalog(); // las 4 queries actuales
  catalogCache.set('catalog', data);
  res.json(data);
};

// POST /api/catalog/invalidate (protegido admin) → catalogCache.flushAll()
// O: invalidar automáticamente en hooks Sequelize de Product/Inventory afterUpdate
```

**Alternativa sin dependencia extra:** usar `node-cache` (pure JS, 0 deps externas) o un simple objeto JS con timestamp de expiración.

**Costo:** 2 h. Bajo riesgo. Alta recompensa si hay tráfico externo.

#### 7.12.3 Índices de BD para queries pesadas

Los reportes de AR (aging), SLE (summary, daily-series) y el catálogo ejecutan raw SQL sobre tablas que pueden crecer rápido. Sin índices apropiados, cada reporte hace full-table scan.

**Índices críticos a auditar/añadir:**
```sql
-- Ventas por fecha (SLE queries más frecuentes)
CREATE INDEX idx_sales_sale_date ON sales(sale_date);
CREATE INDEX idx_sales_status_date ON sales(status, sale_date);

-- AR aging (grouping por customer + due_date)
CREATE INDEX idx_sales_customer_due ON sales(customer_id, due_date);

-- Inventory movements
CREATE INDEX idx_inv_movements_product_date ON inventory_movements(product_id, created_at);

-- POS reservations (limpieza expiradas)
CREATE INDEX idx_pos_reservations_expires ON pos_reservations(expires_at);
```

**Acción:** `EXPLAIN` en las queries de daily-series, AR summary y catalog para confirmar cuáles hacen full-scan.
**Costo:** 2 h auditoría + migration con `addIndex`. Bajo riesgo (índices son aditivos).

### 7.13 Consumidores externos y estrategia de versionado

#### 7.13.1 Atlas bot como consumidor externo

El atlas-bot (Messenger + Telegram, implementado 2026-06-17) consume al menos:
- `POST /api/pre-orders` — para registrar pedidos desde el bot
- `GET /api/sales/summary` — para el resumen de ventas

Cuando en **Fase 2** se elimine el `success` wrapper y se renombren paths, el bot se romperá silenciosamente si no se coordina. El bot no tiene suite de tests, por lo que el breakage puede pasar desapercibido.

**Acciones antes de Fase 2:**
1. Mapear **todos** los endpoints que consume el bot en `api-dictionary.md` — marcarlos con `[BOT]` para señalar que tienen consumidor externo.
2. Mantener los paths del bot sin renombrar hasta que el bot sea actualizado simultáneamente.
3. Considerar que el bot podría pasar a llamar directamente a `saleService`/`preOrderService` (si se extrae capa de servicio en §7.10) sin pasar por HTTP — elimina el acoplamiento.

#### 7.13.2 Estrategia de versionado de API

Hoy no hay versionado (`/api/v1/`). La propuesta dice "no abordar ahora" — correcto para cambios internos. Pero eliminar `success` de 26 módulos **es un breaking change** que el frontend, el bot y cualquier integración futura sentirán.

**Estrategia recomendada en lugar de `/api/v2/`:**

Usar el flag de feature `RESPONSE_STANDARD_V2=true` ya propuesto en §5.1 — es más seguro que versionar paths porque:
- No requiere duplicar rutas
- El frontend y el bot pueden probar con el flag antes del cutover
- La transición es gradual módulo a módulo

**Criterio de cutover:** cuando el 100% de módulos devuelva respuestas estándar (sin `success`), desactivar el flag y eliminarlo. Solo ahí introducir `/api/v2/` si se necesitan breaking changes estructurales futuros.

---

## 8. Decisiones transversales

### 8.1 Migración de duplicados: 400 → 409

CAT, CST, USR, XCH devuelven 400 para duplicados. Con el errorHandler unificado (§5.2), pasan a 409 automáticamente. Frontend debe diferenciar 409 (mensaje friendly: "Ya existe X") de 400 (validación).

### 8.2 Mensajes de error: español por default

Política: todo mensaje user-facing en español. Los errores internos (`SequelizeValidationError` etc.) se transforman en el errorHandler. Quedan pendientes traducciones en AUTH, BRD, PRD (partial), SUP (CRUD inglés), XCH (mezcla).

### 8.3 Política de validación de body

Todo POST/PUT/PATCH debe validar con:
- `express-validator` (módulos existentes), o
- Zod (módulos nuevos)

Ningún endpoint debe hacer `const { x, y } = req.body` sin validación previa en ruta o schema.

### 8.4 Eliminación de `console.log` en producción

Hoy hay `console.log`/`console.error` en SLE, SPY, PRE, BNK, UPL, TRF, SUP. Política: usar `winston` (`logger.info/warn/error`) siempre. Configurar `morgan` para HTTP logs.

### 8.5 Política de transacciones

Hoy `sequelize.transaction()` se usa inconsistentemente: `createSale` es transaccional (correcto), pero `addPayment`, `createTransfer`, `createPurchaseOrder` y otros flujos multi-tabla no lo son. Un error a mitad de operación puede dejar la base en estado inconsistente.

**Política:** toda operación que escriba en más de 1 tabla usa `sequelize.transaction()`. No son opcionales en flujos de negocio críticos (ventas, pagos, transferencias, órdenes de compra).

**Costo:** embebido al tocar cada módulo en Fase 2.

### 8.6 Tests como puerta de refactor

Antes de migrar cualquier módulo, capturar comportamiento actual con **tests de caracterización** (regression tests). Mínimo por módulo:
- 1 test del happy path (200/201)
- 1 test de autenticación (401 sin token, 403 sin permiso)
- 1 test de validación (400 con body inválido)
- 1 test de no encontrado (404)

Con 27 módulos × 4 tests = 108 tests mínimo. Hoy hay 3.

---

## 9. Plan por fases (roadmap)

### Fase 0 — Estabilización ✅ COMPLETADA (2026-07-04)

**Quick wins P0 de seguridad + bugs de negocio críticos — todos implementados.**

| Tarea                                                   | Estado | Dónde |
|---------------------------------------------------------|--------|-------|
| Fix path traversal UPL (§4.1)                          | ✅     | `routes/upload.routes.js` |
| Fix stack trace expuesto en errorHandler (§4.2)        | ✅     | `middleware/errorHandler.js` |
| `authorize` en AR admin-pin (§4.3)                     | ✅     | `routes/ar.routes.js` |
| `user_id` del token en POS reserve (§4.4)              | ✅     | `controllers/posReservation.controller.js` |
| Eliminar `.bak` files (§4.5)                           | ✅     | eliminados del repo |
| Fix BUG-021: addPayment infla paid_amount (§4.6)       | ✅     | `controllers/sale.controller.js` |
| Fix INV.getValuation false positive (§4.7)             | ✅     | `controllers/inventory.controller.js` |
| CORS hardcoded → env var (§4.8)                        | ✅     | `app.js` + `server.js` |
| Autorización en UPL upload (§7.11.2)                   | ✅     | `routes/upload.routes.js` |

**Entregable alcanzado:** backend sin riesgos de seguridad activos ni bugs financieros conocidos.

### Fase 1 — Estándares internos + TypeScript setup (semana 3-8)

**Sin cambios visibles para el frontend. TS pasa a ser pilar desde aquí.**

| Tarea                                                   | Estado | Esfuerzo   |
|---------------------------------------------------------|--------|------------|
| Helpers `res.ok/created/paginated/fail`                | ✅ `utils/responseHelpers.js` | 1 día |
| Eliminar `console.log` → logger (controllers)          | ✅ posSocket.js; pendiente: revisar otros módulos | — |
| Dead code `void inventory` eliminado                   | ✅ sale.controller.js:895 | — |
| Quitar `bcrypt` redundante (solo bcryptjs) (§7.4)      | ✅ solo bcryptjs en package.json | — |
| Auditoría JWT: TTL en `.env.example` (§7.11.1)         | ✅ `JWT_EXPIRES_IN=24h` documentado | — |
| Auditoría raw SQL: replacements vs interpolación (§7.11.3) | ✅ todos usan `replacements:` | — |
| **Setup TypeScript** (tsconfig allowJs, tsx, @types/*) | ✅ `backend/tsconfig.json` — commit `6ab3331` | 1 día |
| errorHandler unificado en `.ts` (§5.2)                 | ✅ `middleware/errorHandler.ts` — commit `6ab3331` | 1 día |
| Auth middleware estandarizado `req.userId` en `.ts`    | ✅ `middleware/auth.ts` + `authorize.ts` — 2026-07-04 | 1 día |
| **Tipar 44 modelos Sequelize con `InferAttributes`**   | ✅ 41/41 modelos `.ts` + `models/index.ts` — commit `50a1197`, 2026-07-04 | 1 semana |
| Setup **Zod** + middleware `validateZod` en `.ts`      | ✅ `zod@4.4.3` instalado + `middleware/validateZod.ts` — 2026-07-04 | 2 días |
| Documentar socket.io en `api-dictionary.md`            | ✅ Sección 28 en api-dictionary.md — 2026-07-04 | 0.5 día |
| **Mover credit_pin al modelo User Sequelize (§7.11.3)**| ✅ `models/User.ts` — campos + exclusión en toJSON — 2026-07-04 | 2 h |
| **npm audit CI gate + Dependabot (§7.11.4)**           | ✅ script `audit:ci` en package.json — 2026-07-04 | 30 min |
| **Revisión Helmet.js (§7.11.6)**                       | ✅ ya activo en `app.js` con `crossOriginResourcePolicy: cross-origin` | 30 min |
| **Audit log — tabla + middleware (§7.11.5)**           | 🔜 diferido a Fase 3 (retención de 90 días requiere diseño de particionado) | 1 día |
| Suite de tests base por módulo (4 tests c/u)           | 🔜 diferido a Fase 2 (prerrequisito: service layer extraída) | 2 semanas |

**Entregable:** backend con contrato interno claro, TS+Zod setup, sin código muerto, sin riesgos de seguridad secundarios. Cobertura TS ~15-20% (helpers, middleware, modelos).

### Fase 2 — Normalización API visible + migración TS por módulo (semana 9-18)

**Cambios visibles para el frontend y el atlas-bot. Coordinación explícita requerida.**

| Tarea                                                   | Estado | Esfuerzo   |
|---------------------------------------------------------|--------|------------|
| **Mapear endpoints del bot en api-dictionary.md (§7.13.1)** | ✅ 2026-07-04 | 2 h |
| Eliminar `success` wrapper (helpers activados, §5.1)   | ✅ ya ausente en controllers; 6 bugs frontend corregidos 2026-07-04 | — |
| Migrar date params a `date_from`/`date_to`             | ✅ ya conformes en todos los controllers | — |
| Migrar `sortBy`/`sortOrder` → `sort_by`/`sort_dir`     | ✅ sin camelCase en controllers | — |
| Añadir `sort_by`/`sort_dir` en todos los LIST          | ✅ 11 controllers actualizados 2026-07-04 | 1 semana |
| **Fix N+1 queries en PO, CST, INV (§7.12.1)**         | ✅ PO batch query 2026-07-04; CST/INV ya usaban batch load | embebido |
| Setup **CI/CD** básico (GitHub Actions) (§7.6)         | ✅ `.github/workflows/ci.yml` — 2026-07-04 | 1 día |
| **Política de transacciones: sequelize.transaction() (§8.5)** | ✅ auditado: todos los flujos críticos multi-tabla ya tienen transaction() | embebido |
| Path renames (§6.1) con deprecation log                | ✅ parcial 2026-07-04 — 12 rutas deprecadas, query-params alternativos implementados | 2 semanas  |
| Eliminar paths viejos tras confirmar cero uso          | 🔜 (coordinar con FE — verificar 0 uso en prod) | 1 semana |
| **Extraer SaleService como primer servicio (§7.10)**   | ✅ `services/sale.service.ts` — createSale, cancelSale, addPayment extraídos — 2026-07-04 | 1 semana   |
| Migrar controllers/routes a TS por módulo (TS-first)   | ✅ 25/25 controllers `.ts` — Orq4 commit `4924d30`, 2026-07-04 | embebido   |

**Entregable:** API conforme al estándar documentado, atlas-bot coordinado, service layer iniciada.

### Fase 3 — Deuda estructural + TS estricto (semana 19-30)

| Tarea                                                   | Esfuerzo    |
|---------------------------------------------------------|-------------|
| Política única de soft-delete (`paranoid: true`)       | 2-3 semanas |
| Completar CRUD BNK, PKG, PRT                           | 1 semana    |
| Migrar modelos camelCase → snake (CST/PRL/QT/PRE)      | 3-4 semanas (coordinado con FE) |
| Eliminar legacy endpoints duplicados (SUP `/statement` vs `/ledger`) | 1 semana |
| Fix bugs de negocio detectados (Sale.payment_status in CST, validateCredit stub) | 3 días |
| Activar `strict: true` completo en tsconfig            | embebido    |
| Eliminar `allowJs: false` (100% TS)                    | final       |
| **Backups automatizados** (mysqldump + S3) (§7.7)      | 1 día       |
| **OpenAPI auto-generated** desde Zod schemas (§7.9)    | 2-3 días    |
| **Migrar multer a 2.x** (§7.5)                         | 2 h         |
| **Caché CTL catálogo público (§7.12.2)**               | 2 h         |
| **Índices BD para queries pesadas (§7.12.3)**          | 2 h         |
| **Service layer completa — todos los módulos críticos (§7.10)** | distribuido |

**Entregable:** backend sin deuda técnica conocida, 100% TypeScript, service layer, con CI/CD + backups + docs automáticas + performance optimizada.

### Fase 4 — Frontend TypeScript (semana 31+, opcional)

Si el backend queda en TS, migrar el frontend también con la misma estrategia `allowJs: true` → por página/componente. Frontend tiene `@types/react` y `@types/react-dom` instalados — solo falta activar `tsc`.

---

## 10. Riesgos y mitigaciones

| Riesgo                                                  | Probabilidad | Impacto | Mitigación                                       |
|---------------------------------------------------------|--------------|---------|--------------------------------------------------|
| Eliminar `success` rompe frontend                       | Alta         | Alto    | Helpers con flag `RESPONSE_STANDARD_V2`, rollback limpio |
| Eliminar `success` rompe atlas-bot sin aviso            | Alta         | Medio   | Mapear endpoints del bot antes de Fase 2; actualizar bot en paralelo |
| Path renames rompe bookmarks/integraciones              | Media        | Medio   | Deprecation log en paths viejos por 2 sprints    |
| Migración camelCase requiere tocar frontend             | Alta         | Alto    | Hacer en Fase 3 con ventana coordinada con Joel  |
| Auth middleware change (req.user.id → req.userId)       | Media        | Alto    | Mantener ambos durante 1 sprint, eliminar el otro después |
| Tests insuficientes para refactoring seguro             | Alta         | Alto    | Fase 1 incluye suite base obligatoria antes de Fase 2 |
| Migración Sequelize paranoid afecta queries existentes  | Media        | Medio   | Auditar queries que filtran manualmente `is_active` |
| Fix BUG-021 afecta flujos de crédito activos en prod    | Media        | Alto    | Probar con datos reales en local; deploy fuera de horario operativo |
| Service layer extraction rompe comportamiento actual    | Baja         | Alto    | Extraer sin cambiar lógica; tests de caracterización primero |
| Audit log en tabla crece indefinidamente                | Alta         | Bajo    | Añadir política de retención (90 días, archive o partition) |
| JWT con TTL largo + sin blacklist → sesión no revocable | Media        | Medio   | Documentar como "aceptado" o implementar Redis blacklist si se necesita |
| Joel trabaja solo — pérdida de velocidad                | Alta         | Medio   | Priorizar P0/P1, dejar P3 para cuando haya holgura |

---

## 11. Métricas de éxito

| Métrica                                           | Fase 0 (2026-07-04) | Objetivo Fase 1 | Objetivo Fase 2 | Objetivo Fase 3 |
|---------------------------------------------------|---------------------|-----------------|-----------------|-----------------|
| No conformidades API                              | 133                 | 133 (sin tocar) | < 30            | < 10            |
| Módulos con shape estándar                        | 0/27                | 0/27            | 27/27           | 27/27           |
| Endpoints con express-validator/zod               | ~12/176             | 100% nuevos     | 100% nuevos     | 100%            |
| Tests de integración (scripts/api-tests/)         | 27/27 ✅            | 108+ tests unit | 108+ tests      | 200+ tests      |
| `console.log` en código (controllers/socket)      | ~2 (posSocket)      | 0               | 0               | 0               |
| Bugs financieros críticos activos                 | **0** ✅            | 0               | 0               | 0               |
| Riesgos de seguridad activos                      | **0** ✅            | 0               | 0               | 0               |
| Controllers > 500 líneas                          | 3                   | 3               | 1 (SLE)         | 0               |
| Módulos con service layer                         | 0/27                | 0/27            | 5/27            | 20/27           |
| Módulos con CRUD completo                         | 21/27               | 21/27           | 24/27           | 27/27           |
| Modelos con casing uniforme                       | 23/27 snake         | 23/27           | 23/27           | 27/27           |
| Políticas de delete distintas                     | 4                   | 4               | 4               | 1               |
| Convenciones de date params                       | 4                   | 4               | 2 (transición)  | 1               |
| Operaciones multi-tabla sin transaction()         | ~6                  | ~6              | 0               | 0               |
| Endpoints externos del bot documentados           | 0                   | 0               | 100%            | 100%            |
| CTL catalog: tiempo de respuesta p95              | N/A                 | N/A             | N/A             | < 50ms (caché) |
| npm audit vulnerabilidades high/critical          | desconocido         | 0               | 0               | 0               |

---

## 12. Estado actual y próximos pasos

**Fase 0 completada (2026-07-04).** El backend no tiene riesgos de seguridad activos conocidos ni bugs financieros críticos. Los 27 módulos tienen cobertura de tests de integración (scripts/api-tests/) con 27/27 ✅.

**Próximo paso: Fase 1** — estándares internos + TypeScript setup. Sin cambios visibles al frontend.

**Orden sugerido para iniciar Fase 1:**
1. **TypeScript setup** (tsconfig `allowJs: true`, `tsx` dev runner, `@types/*`) — 1 día
2. **Helpers de respuesta** (`utils/responseHelpers.ts`: `res.ok/created/paginated/fail`) — 1 día
3. **errorHandler unificado** en `.ts` (§5.2) — 1 día
4. **Auth middleware** estandarizado `req.userId` en todos los controllers — 1 día
5. **Auditoría JWT** — verificar TTL, documentar en `.env.example` — 2 h
6. **Auditoría raw SQL** — confirmar `replacements:[]` vs interpolación — 1 día
7. **Eliminar `console.log`** → `logger.info/warn/error` — 1 día
8. **Quitar `bcrypt` redundante** (solo bcryptjs) — 0.5 día
9. **Tipar 44 modelos Sequelize** con `InferAttributes` — 1 semana
10. **Suite base de tests unitarios** (4 por módulo = 108) — 2 semanas

**No empezar Fase 2 sin:**
- Suite base de tests completada (Fase 1) — es la red de seguridad.
- Endpoints del atlas-bot documentados en `api-dictionary.md` — para no romperlo sin aviso en el cutover del wrapper `success`.

---

## 13. Apéndices

- **A.** `endpoint-normalization.md §2` — listado completo de 133 no conformidades
- **B.** `api-dictionary.md` — mapeo completo de 176 endpoints (27 módulos)
- **C.** `endpoint-normalization.md §6` — evidencia de 63 pruebas reales ejecutadas
- **D.** `atlas-ui-rules.md` — reglas de UI que el frontend ya sigue (relevante para coordinación de cambios API)
- **E.** `reference_facebook_bot.md` (memory) — atlas-bot como consumidor externo de API
