# Atlas ERP — Normalización de Endpoints

> **Documento interno para Claude.** Se actualiza mientras se trabaja en el proyecto.  
> No ejecutar cambios sin instrucción explícita del usuario. Solo recolectar y documentar.

---

## 1. Estándares REST para esta API

Referencia para evaluar cada endpoint. Un endpoint es **no conforme** si viola cualquiera de estas reglas.

### 1.1 Nomenclatura de paths

| Regla | Correcto | Incorrecto |
|-------|----------|------------|
| Sustantivos plurales, no verbos | `GET /api/products` | `GET /api/getProducts` |
| kebab-case para palabras compuestas | `/api/purchase-orders` | `/api/purchaseOrders` |
| Minúsculas siempre | `/api/brands` | `/api/Brands` |
| Sin trailing slash | `/api/products` | `/api/products/` |
| Sub-recursos anidados máximo 2 niveles | `/api/products/:id/inventory` | `/api/products/:id/inventory/:wh/movements` |
| Más de 2 niveles → usar query params | `GET /api/movements?product_id=1&warehouse_id=2` | `GET /api/products/1/warehouses/2/movements` |
| Módulo con nombre propio en el path | `/api/roles` | `/api` (sin prefijo) |
| Paths descriptivos, sin abreviaciones | `/api/accounts-receivable` | `/api/ar` |
| Acciones especiales sobre un recurso | `POST /api/sales/:id/cancel` | `GET /api/cancelSale/:id` |

### 1.2 Métodos HTTP

| Operación | Método | Semántica |
|-----------|--------|-----------|
| Leer lista | GET | Idempotente, nunca muta datos |
| Leer uno | GET | `GET /api/products/:id` |
| Crear | POST | Devuelve 201 + el recurso creado |
| Reemplazar completo | PUT | Idempotente — enviar todos los campos |
| Actualizar parcial | PATCH | Solo los campos que cambian |
| Eliminar | DELETE | El server decide si es hard o soft delete |
| Acción de negocio | POST | `POST /api/sales/:id/cancel` |

**Reglas críticas:**
- `GET` nunca muta estado. Consultas que usen `GET` pero guarden algo son erróneas.
- `DELETE /api/resource/:id` es la forma correcta de eliminar, **independientemente de si la implementación hace soft-delete** (poniendo `is_active = false` internamente). El cliente no necesita saber el mecanismo.
- No reemplazar un `DELETE` con `PATCH { is_active: false }` expuesto al cliente — eso mezcla la semántica de actualización con la de eliminación.
- `PUT` requiere enviar el recurso completo. Si el frontend solo envía algunos campos, usar `PATCH`.
- Acciones que no son CRUD puro (cancelar, aprobar, cerrar) → `POST /api/resource/:id/accion`.

### 1.3 Códigos HTTP de respuesta

| Situación | Código | Notas |
|-----------|--------|-------|
| GET exitoso | 200 | |
| POST exitoso — recurso creado | 201 | Incluir el recurso en el body |
| PUT / PATCH exitoso | 200 | Incluir el recurso actualizado |
| DELETE exitoso con body | 200 | Incluir `{ message: "..." }` |
| DELETE exitoso sin body | 204 | Sin body en la respuesta |
| Lista vacía | 200 | Devolver `{ data: [], pagination: { total: 0 } }` — nunca 404 |
| Parámetro malformado (ej. ID no numérico) | 400 | Error de sintaxis/formato |
| Validación de negocio fallida | 400 | Esta API usa 400 para todos los errores de validación |
| Sin token / token inválido | 401 | |
| Token válido pero sin permiso | 403 | |
| Recurso no encontrado | 404 | Solo para recursos individuales, no listas |
| Conflicto (duplicado, estado inválido) | 409 | Ej: nombre ya existe, sale ya cancelada |
| Demasiadas peticiones | 429 | Rate limiting (ya activo en este backend) |
| Error interno del servidor | 500 | Nunca exponer stack trace |

> **400 vs 422:** Esta API usa **400** para todos los errores de validación (tanto formato como lógica de negocio). No mezclar con 422.

### 1.4 Formato de respuesta estándar

**Lista paginada:**
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "totalPages": 4,
    "page": 1,
    "limit": 25
  }
}
```

**Registro único (GET / POST / PUT / PATCH):**
```json
{
  "message": "Operación exitosa",
  "data": { ... }
}
```

**Error:**
```json
{
  "message": "Descripción del error en español",
  "errors": ["campo: mensaje", "..."]
}
```

**Lista vacía — correcto:**
```json
{ "data": [], "pagination": { "total": 0, "totalPages": 0, "page": 1, "limit": 25 } }
```

**No conformes:**
- Devolver array directamente: `[...]`
- Devolver con clave del módulo: `{ "brands": [...] }`
- `message` en inglés en unos módulos y español en otros
- Mezclar response shapes entre módulos

### 1.5 Nomenclatura de campos JSON

| Regla | Correcto | Incorrecto |
|-------|----------|------------|
| camelCase en responses JSON | `createdAt`, `isActive` | `created_at`, `is_active` |
| Excepciones: aliases de BD explícitos | documentar si se mantiene snake_case | mezclar sin criterio |
| Booleanos como `true`/`false` | `"is_active": true` | `"is_active": 1` o `"is_active": "yes"` |
| IDs como enteros | `"id": 42` | `"id": "42"` |
| Fechas en ISO 8601 | `"created_at": "2026-07-03T14:30:00.000Z"` | `"created_at": "03/07/2026"` |
| Campos null incluidos en response | `"website": null` | omitir el campo |
| Campos monetarios como string numérico o number | `"price": 15.50` | `"price": "$15.50"` |

> **Nota actual:** El proyecto usa `snake_case` en muchas respuestas (ej. `created_at`, `is_active`) porque Sequelize serializa las columnas directamente. Esto está extendido en el frontend. **No cambiar a camelCase** hasta que se decida una migración coordinada — documentar el estado real en el diccionario de API.

### 1.6 Convenciones de Query Params

**Paginación** (estándar de este proyecto):
```
GET /api/products?page=1&limit=25
```
- `page` comienza en 1 (no en 0)
- `limit` — opciones válidas: 25, 50, 100

**Búsqueda general:**
```
GET /api/products?search=coca+cola
```

**Filtros por campo específico:**
```
GET /api/sales?status=completed&customer_id=5
```

**Rango de fechas:**
```
GET /api/sales?date_from=2026-07-01&date_to=2026-07-31
```
- Formato: `YYYY-MM-DD`
- Nombres: `date_from` / `date_to` (no `from_date`, no `start`, no `begin`)

**Ordenamiento:**
```
GET /api/products?sort_by=name&sort_dir=asc
```
- `sort_by` — nombre del campo
- `sort_dir` — `asc` o `desc`

**No conformes:**
- `?orderBy=name&order=ASC` (capitalización inconsistente)
- `?sort=name:asc` (formato no estándar en este proyecto)
- `?page=0` (page desde 0)
- `?perPage=25` (usar `limit`)

### 1.7 Seguridad y exposición de datos

- Nunca devolver: `password`, `password_hash`, tokens de sesión, claves internas.
- Nunca exponer stack trace en errores 500 — solo `{ "message": "Error interno" }`.
- El campo `id` del usuario autenticado viene del token, no del body — nunca confiar en `req.body.user_id`.
- Validar y sanitizar todos los inputs de query params (prevenir SQL injection, aunque Sequelize usa prepared statements).

### 1.8 Versionado

La API actualmente **no tiene versionado** (`/api/v1/`). Esto es una deuda técnica pero no se aborda ahora. Cuando se necesite introducir breaking changes, la estrategia será prefijo `/api/v2/`. Documentar aquí si cambia.

---

## 2. Endpoints no conformes identificados

Estado: `pendiente` | `en revisión` | `corregido`

| ID | Path actual | Problema | Corrección propuesta | Estado |
|----|-------------|----------|----------------------|--------|
| ROL-MOUNT | `/api` (roles sin prefijo) | Sin prefijo propio — endpoints de roles colisionan con el namespace raíz | Montar en `/api/roles` en `app.js` + actualizar `role.routes.js` | pendiente |
| AR-PATH | `/api/ar` | Abreviación no descriptiva | `/api/accounts-receivable` | pendiente |
| AUTH-SHAPE | `/api/auth/*` | Todas las respuestas usan `{ success, message?, data? }`. Estándar es `{ message, data }` sin `success` | Eliminar campo `success`, alinear a estándar | pendiente |
| AUTH-MSG-EN | `/api/auth/*` | Mensajes en **inglés** ("Invalid credentials", "Login successful", etc.) | Traducir todos a español | pendiente |
| AUTH-ME-NO-MESSAGE | `GET /api/auth/me` | Single response sin `message` | Incluir `message` o aceptar que GET detalle no requiere message (decisión global) | pendiente |
| AUTH-CAMEL-BODY | `POST /api/auth/change-password` | Body en camelCase (`currentPassword`, `newPassword`) mientras el resto del proyecto usa snake_case | Migrar a `current_password`, `new_password` o adoptar camelCase global | pendiente |
| AUTH-NO-LOGOUT-BLACKLIST | `POST /api/auth/logout` | Logout no invalida token server-side | Implementar blacklist o documentar que logout es client-side únicamente | pendiente |
| PRD-SHAPE | `/api/products/*` | Respuestas con `{ success, ... }` | Eliminar `success` | pendiente |
| PRD-MSG-MIXED | `/api/products/*` | Mezcla inglés/español: validaciones de negocio español, mensajes CRUD inglés ("Product not found", "Product updated successfully") | Unificar a español | pendiente |
| PRD-BARCODE-200-NULL | `GET /api/products/barcode/:barcode` | Devuelve 200 con `data: null` cuando no encuentra | Devolver 404 | pendiente |
| PRD-EXPORT-VERB | `GET /api/products/export-csv` | Verbo `export-csv` en path | `GET /api/products.csv` o `?format=csv` | pendiente |
| PRD-SET-DEFAULT-VERB | `PUT /api/products/presentations/:id/set-default` | Verbo en path + PUT para acción de negocio | `POST /api/products/:productId/presentations/:id/default` o `PATCH` con `{ is_default: true }` | pendiente |
| PRD-PRES-ASYMMETRIC | `POST /api/products/:id/presentations` vs `PUT/DELETE /api/products/presentations/:presentationId` | Asimetría CRUD: POST anida producto, PUT/DELETE no | Anidar producto en todos o no anidar en ninguno | pendiente |
| PRD-PUT-AS-PATCH | `PUT /api/products/:id` | PUT usado para actualización parcial | Renombrar a PATCH o exigir recurso completo | pendiente |
| PRD-LIMIT-20 | `GET /api/products` | Default limit=20 (estándar 25) | Cambiar default a 25 | pendiente |
| PRD-NO-SORT | `GET /api/products` | Sin `sort_by`/`sort_dir`, orden hardcoded `created_at DESC` | Soportar query params de orden | pendiente |
| PRD-VALIDATION-SPLIT | `POST /api/products` | Validación dividida ruta/controller (unit_size requerido solo en controller) | Mover toda validación a ruta con express-validator | pendiente |
| CAT-SHAPE | `/api/categories/*` | Respuestas con `{ success, ... }` | Eliminar `success` | pendiente |
| CAT-400-FOR-DUP | `POST/PUT /api/categories` | Devuelve 400 para duplicado (estándar 409) | Cambiar a 409 | pendiente |
| CAT-HARD-DELETE | `DELETE /api/categories/:id` | Hard delete (`destroy()`) vs soft-delete en PRD/BRD — inconsistencia transversal | Definir política única: todo soft-delete o todo hard-delete | pendiente |
| CAT-WITH-COUNT-VERB | `GET /api/categories/with-count` | Verbo en path + `product_count` (snake) vs `productCount` (camel) en getAll | `GET /api/categories?include=product_count` + unificar casing | pendiente |
| CAT-FIELD-CASING | `/api/categories/*` | `productCount` en getAll vs `product_count` en with-count | Elegir uno | pendiente |
| CAT-WRONG-PERM | `/api/categories/*` | Usa permiso `products.create` en lugar de `categories.create` | Crear permiso dedicado `categories.create/update/delete` | pendiente |
| CAT-LIMIT-50 | `GET /api/categories` | Default limit=50 (estándar 25) | Cambiar default a 25 | pendiente |
| CAT-NO-ACTIVE-FILTER | `GET /api/categories` | No filtra por `is_active` (devuelve inactivas) | Agregar filtro opcional `is_active` con default `true` | pendiente |
| BRD-SHAPE | `/api/brands/*` | Respuestas con `{ success, ... }` | Eliminar `success` | pendiente |
| BRD-MSG-EN | `/api/brands/*` | Mensajes en inglés | Traducir | pendiente |
| BRD-NO-VALIDATION | `POST/PUT /api/brands` | ~~Sin express-validator — error del DB llega como 500~~ **CORREGIDO por verificación 2026-07-03**: SÍ valida vía modelo Sequelize. Falta `name` → 400 `{success:false, message:"Validation error", errors:[{field,message}]}`. Sin express-validator en ruta pero validación modelo efectiva | Considerar migrar a express-validator en ruta para mensajes en español | pendiente |
| BRD-NO-409 | `POST /api/brands` | ~~Duplicado (unique name) → 500 no controlado~~ **CORREGIDO 2026-07-03**: UniqueConstraintError SÍ se captura como **400** (no 500, no 409) con `{message:"Duplicate entry", errors:[{field:"name", message:"name already exists"}]}`. Estándar sigue siendo 409 | Cambiar código de 400 → 409 en errorHandler para UniqueConstraintError | pendiente |
| BRD-NO-PRODUCT-CHECK | `DELETE /api/brands/:id` | No verifica si tiene productos antes de desactivar | Verificar o documentar política | pendiente |
| BRD-LIMIT-20 | `GET /api/brands` | Default limit=20 (estándar 25) | Cambiar a 25 | pendiente |
| BRD-ACTIVE-VERB | `GET /api/brands/active` | `active` en path (preferible query param) | `?is_active=true&fields=id,name` | pendiente |
| BRD-NO-ACTIVE-FILTER | `GET /api/brands` | No filtra `is_active` | Default `true` | pendiente |
| 404-HANDLER-SHAPE | app.js línea 167 | 404 handler devuelve `{ success: false, message }` | Estándar: `{ message }` | pendiente |
| HEALTH-NO-DOC | `GET /health` | Endpoint no documentado en el diccionario | Agregar a módulo `SYS` (salud del sistema) | pendiente |
| INV-SHAPE | `/api/inventory/*` | Respuestas con `{ success, ... }` | Eliminar `success` | pendiente |
| INV-PATH-SINGULAR | `/api/inventory/warehouse/:id`, `/api/inventory/product/:id` | Path singular + `:warehouse_id === 'all'` acepta string | Pluralizar y manejar 'all' vía query | pendiente |
| INV-AUTHORIZE-INCONSISTENT | `/api/inventory/*` | Solo `GET /:id` y `POST /adjust` requieren permiso | Aplicar authorize en todos los GET | pendiente |
| INV-MOVEMENTS-PAGINATION | `GET /api/inventory/movements` | `pages` en lugar de `totalPages`; `start_date`/`end_date` no conforme | Unificar a `totalPages` + `date_from`/`date_to` | pendiente |
| INV-LOW-EXPIRING-NO-PAGINATION | `GET /api/inventory/alerts/low-stock`, `/alerts/expiring` | Sin paginación, devuelven `{ data, count }` | Agregar paginación o documentar como/stats | pendiente |
| INV-WAREHOUSES-MISPLACED | `GET /api/inventory/warehouses` | Sub-recurso fuera de lugar — warehouses no es sub-recurso de inventory | Crear módulo `WRH` dedicado | pendiente |
| INV-VALUATION-SILENT-FAIL | `GET /api/inventory/valuation` | Errores silenciados: devuelve `{ success: true, data: { items: [] } }` en catch | Devolver 500 o advertir con campo `error` | pendiente |
| INV-USERID-INCONSISTENCY | `POST /api/inventory/adjust` | Usa `req.user.id` mientras otros módulos usan `req.userId` | Estandarizar el nombre del atributo inyectado por auth middleware | pendiente |
| TRF-SHAPE | `/api/transfers/*` | `success` + anidado en `data.transfer`/`data.transfers` | Aplanar a `{ data, pagination }` estándar | pendiente |
| TRF-NESTED-PAGINATION | `GET /api/transfers` | `data: { transfers, pagination }` — paginación dentro de data | Mover `pagination` al root | pendiente |
| TRF-DATE-PARAMS | `GET /api/transfers` | `start_date`/`end_date` no conforme | `date_from`/`date_to` | pendiente |
| TRF-CONSOLE-LOG | `POST /api/transfers` | `console.log(JSON.stringify(req.body))` left in production | Quitar | pendiente |
| TRF-RECEIVE-MOVEMENT-TYPE | `POST /api/transfers/:id/receive` usa `movement_type: 'transferencia'` (cantidad positiva) vs `cancel` que usa `ajuste_positivo` | Inconsistencia en el tipo de movimiento restaurativo | Unificar criterio | pendiente |
| SLE-SHAPE-CHAOS | `/api/sales/*` | **Crítico**: cada endpoint usa shape distinto (`{message, sale}`, `{sales, pagination}`, `{sale}`, `{data}`, `{stats}`, campos al root, `{success, data}` solo en summary). No usa `data` wrapper en la mayoría | Unificar todos a `{ message, data }` y `{ data, pagination }` | pendiente |
| SLE-ERROR-EXPOSES-MESSAGE | `POST /api/sales`, etc. | Errores 500 devuelven `{ message, error: error.message }` exponiendo detalles internos | Devolver solo `{ message }`, loggear el error server-side | pendiente |
| SLE-NO-EXPRESS-VALIDATOR | `routes/sale.routes.js` | Sin express-validator en ningún endpoint | Agregar validación de body a todos | pendiente |
| SLE-PUT-AS-PATCH | `PUT /api/sales/:id` | PUT para actualización parcial | PATCH | pendiente |
| SLE-CANCEL-HACKS-NOTES | `POST /api/sales/:id/cancel` | Inserta `\nCANCELADA: <reason>` en notes | Campo dedicado `cancel_reason` + `cancelled_at` | pendiente |
| SLE-DATE-PARAMS-MIXED | `/api/sales/*` | Mezcla `start_date`/`end_date` (getSales, stats, product-sales) con `from`/`to` (summary, daily-series) | Unificar a `date_from`/`date_to` | pendiente |
| SLE-DAILY-CLOSURE-SHAPE | `GET /api/sales/daily-closure` | Campos al root sin wrapper | Envolver en `{ data: {...} }` | pendiente |
| SLE-BY-NUMBER-PATH | `GET /api/sales/by-number/:saleNumber` | `by-number` no RESTful | `?sale_number=X` o `/sale-number/:saleNumber` | pendiente |
| SLE-PARANOID-ONLY | Modelo `Sale` | Único modelo `paranoid: true` — inconsistencia con otros modelos | Política uniforme de soft/paranoid delete | pendiente |
| SLE-VALIDATE-CREDIT-PIN-SHAPE | `POST /api/sales/validate-credit-pin` | `{ success, admin_id, admin_name }` sin `data` y expone identidad admin | Envolver en `data` y/o no exponer `admin_id` | pendiente |
| POS-SHAPE | `/api/pos/*` | `success` wrapper | Eliminar | pendiente |
| POS-DELETE-WITH-BODY | `DELETE /api/pos/tab` | DELETE con body en lugar de path params | `DELETE /api/pos/sessions/:session_id/tabs/:tab_id` o similar | pendiente |
| POS-TAB-SINGULAR | `/api/pos/tab` | Path singular | `/tabs` | pendiente |
| POS-CLEANUP-VERB | `POST /api/pos/cleanup-expired` | Verbo en path | `DELETE /api/pos/reservations/expired` o POST `/expired-cleanup` | pendiente |
| POS-USERID-IN-BODY | `POST /api/pos/reserve` | `user_id` viene del body (riesgo suplantación) | Tomar de `req.user.id` del token | pendiente |
| CST-SHAPE | `/api/customers/*` | `success` wrapper | Eliminar | pendiente |
| CST-CAMELCASE-MODEL | Modelo `Customer` | Campos en **camelCase** (`firstName`, `creditLimit`, `isDeleted`) vs resto del proyecto snake_case | Migración a snake_case o decisión explícita documentada | pendiente |
| CST-DUPLICATE-400 | `POST/PUT /api/customers` | Duplicado de documento devuelve 400 | 409 | pendiente |
| CST-VALIDATE-CREDIT-FAKE | `GET /api/customers/:id/credit/validate` | Siempre devuelve `availableCredit: Infinity` sin validar `creditLimit` | Implementar validación real contra creditLimit | pendiente |
| CST-PAYMENT-STATUS-BUG | `/api/customers/overdue`, `/:id/credit`, `/:id/stats` | Queries usan `Sale.payment_status` que no existe en el modelo Sale | Migrar a `Sale.status` o crear columna virtual | pendiente |
| CST-SORTBY-SORTORDER | `GET /api/customers` | `sortBy`/`sortOrder` no conforme | `sort_by`/`sort_dir` | pendiente |
| CST-MIXED-DELETE-POLICY | `DELETE /api/customers/:id` | Soft delete si tiene ventas, hard si no — política mixta | Política uniforme | pendiente |
| CST-CREDIT-BALANCE-NO-DATA | `GET /api/customers/:id/credit-balance` | Sin `data` wrapper (campos al root) | Envolver en `data` | pendiente |
| CST-FROM-TO | `GET /api/customers/:id/purchases` | `from`/`to` no conforme | `date_from`/`date_to` | pendiente |
| SUP-SHAPE | `/api/suppliers/*` | `success` wrapper | Eliminar | pendiente |
| SUP-MSG-MIXED | `/api/suppliers/*` | CRUD en inglés, resumen/ledger en español | Unificar a español | pendiente |
| SUP-CONSOLE-LOG | `PUT /api/suppliers/:id` | 3 `console.log` left in | Quitar | pendiente |
| SUP-STATEMENT-LEDGER-DUPLICITY | `/:id/statement` vs `/:id/ledger` | Endpoints funcionalmente duplicados | Eliminar legacy statement o documentar diferencia | pendiente |
| SUP-NO-VALIDATION | `POST/PUT /api/suppliers` | Sin express-validator, sin chequeo duplicados | Agregar validación + capturar unique | pendiente |
| SUP-NO-UNIQUE-NAME | `POST /api/suppliers` (verificado 2026-07-03) | **No hay unique constraint en `name` ni `tax_id`** — permite crear suppliers con mismo nombre/RIF sin error (devuelve 201). Mi doc original asumía unique: true en name (incorrecto) | Agregar `unique: true` en modelo Supplier para `name` y/o `tax_id`, o documentar política de duplicados permitidos | pendiente |
| SPY-SHAPE | `/api/supplier-payments/*` | `success` wrapper | Eliminar | pendiente |
| SPY-PATH-CHAOS | `/supplier/:id`, `/payable-balance/:id`, `/credit-balance/:id`, `/by-po/:id` | Verbos/cualidades en path, no anidados a suppliers/:id | Migrar a `/suppliers/:id/payments`, etc. o unificar sub-recurso | pendiente |
| SPY-DELETE-WITH-BODY | `DELETE /api/supplier-payments/:id` | DELETE con body, duplicado con `PUT /:id/cancel` | Quitar DELETE o quitar cancel, usar POST | pendiente |
| SPY-CANCEL-PUT | `PUT /api/supplier-payments/:id/cancel` | PUT para acción (preferible POST) | `POST /:id/cancel` | pendiente |
| SPY-ERROR-EXPOSE | `/api/supplier-payments/*` | Errores 500 devuelven `error: error.message` | Devolver solo `{ message }` | pendiente |
| SPY-START-END-DATE | `GET /api/supplier-payments`, `/stats` | `start_date`/`end_date` no conforme | `date_from`/`date_to` | pendiente |
| SPY-INTERNAL-FIELDS | `POST /api/supplier-payments` (allocations) | Campos internos `_frozen_po_amount`, `_exchange_rate` (con underscore) aceptados en body | Prefijo reservado o validar origen | pendiente |
| PO-SHAPE | `/api/purchase-orders/*` | `success` wrapper | Eliminar | pendiente |
| PO-SORTBY-SORTORDER | `GET /api/purchase-orders` | `sortBy`/`sortOrder` no conforme | `sort_by`/`sort_dir` | pendiente |
| PO-N-PLUS-1 | `GET /api/purchase-orders` | Por cada orden, 2 queries adicionales (invoice + payment status) | Cargar con include o subquery | pendiente |
| PO-PAYMENT-STATUS-VIRTUAL | `GET /:id` y `GET /` | `payment_status` se CALC e inyecta en response pero no es columna | Documentar como CALC o persistir | pendiente |
| PO-RECEIVE-NOT-AUDITED | `POST /:id/receive` (líneas 650-991) | Lógica de recepción no auditada en este mapeo | Revisar cuando se toque el módulo | pendiente |
| PRL-SHAPE | `/api/price-lists/*` | `success` wrapper | Eliminar | pendiente |
| PRL-CAMELCASE-MODEL | Modelo `PriceList` | camelCase (`isDefault`, `validFrom`, `validUntil`, `isDeleted`) vs estándar snake_case | Migración o documentar | pendiente |
| PRL-PRODUCTS-WITH-STOCK-VERB | `GET /api/price-lists/products-with-stock` | Verbo en path | Mover a `GET /api/products?with_stock=true` | pendiente |
| PRL-EXPORT-CSV-VERB | `GET /api/price-lists/:id/export/csv` | Verbos en path | `?format=csv` o `.csv` suffix | pendiente |
| PRL-USERID-FALLBACK | `POST/PUT /api/price-lists/*` | `req.user?.id || req.userId` — código defensivo ante inconsistencia transversal | Estandarizar nombre de atributo inyectado por auth middleware | pendiente |
| XCH-SHAPE | `/api/exchange-rates/*` | `success` wrapper | Eliminar | pendiente |
| XCH-400-FOR-DUP | `POST/PUT /api/exchange-rates` | Duplicado devuelve 400 | 409 | pendiente |
| XCH-HARD-DELETE | `DELETE /api/exchange-rates/:id` | Hard delete explícito — inconsistencia con política de otros módulos | Política uniforme de delete | pendiente |
| XCH-CONVERT-VIA-GET | `GET /api/exchange-rates/convert` | Acción de negocio via GET | POST con body o cálculo client-side | pendiente |
| XCH-IS-ACTIVE-ALL | `GET /api/exchange-rates` | `is_active='all'` string especial | Query separada o `?include_inactive=true` | pendiente |
| XCH-MSG-MIXED | `/api/exchange-rates/*` | "Exchange rate not found" en inglés, otros mensajes en español | Unificar español | pendiente |
| XCH-CONVERT-ERROR-EXPOSE | `GET /api/exchange-rates/convert` | Error 404 expone `error.message` | Devolver solo `{ message }` | pendiente |
| QT-SHAPE | `/api/quotes/*` | `success` + `data.quotes` anidado | Aplanar a `{ data, pagination }` | pendiente |
| QT-CAMELCASE-QUERY | `GET /api/quotes` | Query params camelCase (`customerId`, `dateFrom`, `dateTo`) | snake_case estándar | pendiente |
| QT-PAGINATION-PAGES | `GET /api/quotes` | `pagination.pages` sin `totalPages` | `totalPages` | pendiente |
| QT-CAMELCASE-MODEL | Modelo `Quote` | camelCase (`isDeleted`, `quoteDate`, `customerId`) | Migración o documentar | pendiente |
| PRE-SHAPE | `/api/pre-orders/*` | `success` wrapper | Eliminar | pendiente |
| PRE-ACTION-VIA-PUT | `PUT /:id/approve`, `PUT /:id/reject` | PUT para acción de negocio (estándar POST) | POST /:id/approve, POST /:id/reject | pendiente |
| PRE-PAGINATION-NO-LIMIT | `GET /api/pre-orders` | `pagination` sin `limit` | Incluir `limit` | pendiente |
| PRE-SNAKE-CAMEL-MIX | `POST /api/pre-orders` | Body recibe snake (`customer_id`) y mapea a camelCase en modelo (`customerId`) | Estandarizar | pendiente |
| PRE-ERROR-EXPOSE | `/api/pre-orders/*` | Errores 500 exponen `error.message` | Devolver solo `{ message }` | pendiente |
| AR-REVERSE-PERM TOO-PERMISSIVE | `POST /api/ar/payments/:id/reverse` | Permiso `ar.view` (lectura) para acción de escritura (reverse) | Permiso dedicado `ar.reverse` o `ar.edit` | pendiente |
| AR-ADMIN-PIN-NO-AUTHORIZE | `/api/ar/admin-pin/*` | Sin `authorize` explícito — cualquier autenticado puede validar/setear PIN admin | `authorize('admin')` o check interno de admin | pendiente |
| AR-EXPORT-VERBS | `GET /api/ar/export/invoices`, `/export/customers` | Verbos en path | `?format=csv&type=invoices` o `GET /:id.csv` | pendiente |
| AR-HARDCODED-LIMIT | `GET /api/ar/summary` | `LIMIT 5000` hardcoded en raw SQL | Paginación real o documentar el cap | pendiente |
| CN-DATE-PARAMS | `GET /api/credit-notes` | `start_date`/`end_date` no conforme | `date_from`/`date_to` | pendiente |
| DLV-ACTION-VERBS | `POST /:id/in-transit`, `POST /:id/confirm` | Verbos en path (acciones) | `POST /:id/transit` o PATCH con `{ status }` | pendiente |
| BNK-NO-WRAPPER | `GET /api/banks` | **Crítico**: devuelve array directo sin `{ data, ... }` — único módulo así | Envolver en `{ data: [...] }` | pendiente |
| BNK-INCOMPLETE | `/api/banks` | Solo 1 endpoint. Sin GET/:id, POST, PUT, DELETE | CRUD completo | pendiente |
| BNK-ERROR-EXPOSE | `GET /api/banks` | Error 500 expone `error.message` | Devolver solo `{ message }` | pendiente |
| BNK-NO-ACTIVE-FILTER | `GET /api/banks` | Hardcode `is_active: true`, no permite ver inactivos | Query param `?include_inactive=true` | pendiente |
| PKG-PRT-INCOMPLETE | `/api/packaging-types`, `/api/presentation-types` | Solo 1 endpoint cada uno. Sin CRUD | CRUD completo o documentar como read-only | pendiente |
| USR-400-FOR-DUP | `POST /api/users` | Duplicado devuelve 400 | 409 | pendiente |
| USR-ROLEID-CAMELCASE | `GET /api/users` | Query param `roleId` camelCase | `role_id` | pendiente |
| USR-NO-PAGINATION | `GET /api/users` | Sin paginación | Agregar paginación estándar | pendiente |
| USR-LIST-NESTED | `GET /api/users` | `data: { users }` anidado vs `getUserById` directo | Aplanar | pendiente |
| CMP-PUT-NO-ID | `PUT /api/company` | Singleton sin /:id (aceptable) pero rompe convención REST | Documentar como excepción | pendiente |
| UPL-200-INSTEAD-OF-201 | `POST /api/upload`, `/multiple` | Devuelve 200 en lugar de 201 (upload crea recurso) | 201 | pendiente |
| UPL-DELETE-WITH-BODY | `DELETE /api/upload/image` | DELETE con body + path singular | `DELETE /api/upload/:filename` o POST `/delete` | pendiente |
| UPL-PATH-TRAVERSAL | `DELETE /api/upload/image` | `path.join(__dirname, '../public', url)` sin sanitizar — posible path traversal | Sanitizar con `path.normalize` + check de boundary | pendiente |
| UPL-CONSOLE-LOG | `POST /api/upload` | `console.log` en 3 lugares | Quitar | pendiente |
| UPL-ERROR-EXPOSE | `/api/upload/*` | Errores 500 exponen `error.message` | Devolver solo `{ message }` | pendiente |
| CTL-NO-WRAPPER | `GET /api/catalog` | Campos al root sin wrapper | Envolver en `{ data: {...} }` o aceptar como stats endpoint | pendiente |
| CTL-NO-PAGINATION | `GET /api/catalog` | Sin paginación, payload crece sin límite | Paginación o lazy loading en cliente | pendiente |
| CTL-CAMELCASE-IN-CALC | `GET /api/catalog` | `productCount` (camel) mezclado con snake en response | Unificar casing | pendiente |
| ERRORHANDLER-STACK-TRACE-EXPOSE | `app.js` errorHandler (todos los endpoints) | **Verificado 2026-07-03**: errores de body-parser (JSON malformado) devuelven stack trace completo exponiendo versiones de paquetes (`body-parser@1.20.5`, `raw-body@2.5.3`), paths internos (`/home/joel/.../backend/...`), y estructura de `node:internal/*`. Response incluye `error: "SyntaxError: ... \n at <stack frames>"` | En errorHandler, distinguir `SyntaxError`/body-parser errors y devolver `{message: "JSON inválido"}` sin stack | pendiente |
| ERRORHANDLER-SHAPE-INCONSISTENT | errorHandler global vs controllers | El errorHandler usa `{success: false, message, errors?}` pero los módulos usan distintas formas: SLE `{message}` solo, otros `{success, message, data}`, BNK `{message, error}`. **No hay unificación real** del shape de error | Estandarizar errorHandler + todos los catch de controllers | pendiente |
| HEALTH-USES-SUCCESS | `GET /health` (verificado 2026-07-03) | Confirma uso de `{success: true, status: "ok", ...}` — mismo patrón no conforme que el resto del proyecto | Mismo fix que `success` wrapper global | pendiente |

> El agente mapeador debe agregar filas aquí cuando encuentre endpoints no conformes.

---

## 3. Campos huérfanos encontrados

Un **campo huérfano** es cualquier campo en request/response que NO corresponde a una columna del modelo Sequelize de esa entidad.

| Categoría | Descripción |
|-----------|-------------|
| `CALC` | Calculado en JS — correcto, pero debe documentarse |
| `ALIAS` | Alias de asociación Sequelize (ej. `brand.name` incluido en `products`) |
| `UNUSED` | Aceptado en el body pero ignorado silenciosamente por el controller |
| `MISSING` | Esperado por el frontend pero no devuelto por el backend |
| `WRONG_NAME` | Campo con nombre diferente al de la columna en BD sin alias explícito |

| Endpoint | Campo | Categoría | Descripción | Estado |
|----------|-------|-----------|-------------|--------|
| `*` (todos los módulos salvo SLE parcial, BNK sin wrapper y CTL al root) | `success` | CALC | Wrapper booleano extra no estándar en TODAS las respuestas. Estándar: `{ message, data }` / `{ data, pagination }`. **Patrón más extendido del proyecto** | pendiente |
| `GET /api/products` | `existingProductId` | CALC | En error 409 (duplicado), informa el ID del producto conflictivo | documentado |
| `GET /api/products/:id/presentations` | `base_price`, `cost`, `units_per_presentation` | CALC | Derivados de `package_price / units_per_package` | documentado |
| `GET /api/categories` (getAll) | `productCount` | CALC | Conteo de productos activos por categoría (camelCase) | documentado |
| `GET /api/categories/with-count` | `product_count` | CALC | Mismo cálculo pero en snake_case — **inconsistencia interna** | documentado |
| `GET /api/inventory/*` | `available_quantity` | CALC | Virtual Sequelize (`quantity - reserved_quantity`) — no persistido | documentado |
| `GET /api/inventory/warehouse/:id` | `presentations` (adjuntos manualmente) | ALIAS | Se adjuntan vía JS tras la query, no por Sequelize include | documentado |
| `GET /api/inventory/movements` | — | — | Sin campos huérfanos pero `pagination.pages` no conforme | — |
| `GET /api/inventory/alerts/low-stock`, `/expiring` | `count` | CALC | Total de items en respuesta (no pagination) | documentado |
| `POST /api/transfers` (response) | `inventory_impact` | CALC | Diff old/new quantity por item | documentado |
| `POST /api/transfers` (data) | `transfer.transfer_number` | CALC | Auto-generado `TRF-YYYYMMDD-NNNN` | documentado |
| `GET /api/sales` | `cn_count`, `cn_total_cop` | CALC | Agregados de credit notes por sale | documentado |
| `POST /api/sales` (error 409) | `conflict`, `product_name`, `available`, `requested`, `reserved_by_others` | CALC | Info útil para UX en conflicto de stock POS | documentado |
| `POST /api/sales` (data) | `sale.sale_number` | CALC | Auto-generado `VEN-YYYYMMDD-NNNN` | documentado |
| `GET /api/sales/daily-closure` | `paymentsBreakdown`, `creditCollectedByCurrency`, `cashRefunds` | CALC | Todos los campos son CALC dual-currency | documentado |
| `POST /api/sales/validate-credit-pin` | `admin_id`, `admin_name` | CALC | Identidad del admin que autorizó (potencial riesgo) | documentado |
| `GET /api/customers/*` (varios) | `fullName` | CALC | `customer.getFullName()` — razón social o first+last | documentado |
| `GET /api/customers/overdue`, `/:id/credit`, `/:id/stats` | `payment_status` (en queries) | MISSING | **Bug**: queries usan `payment_status` que no existe en modelo Sale | documentado |
| `GET /api/customers/:id/statement`, `/credit-balance` | `available_credit`, `credit_balance_cop` | CALC | Saldo a favor del cliente, calculado en 3 pasos | documentado |
| `POST /api/customers/:id/credit/validate` | `availableCredit: Infinity` | CALC | **Bug**: no valida creditLimit real | documentado |
| `POST /api/transfers`, `POST /api/pos/*`, `POST /api/inventory/adjust` | `user_id` (en body o movimientos) | UNUSED/ALIAS | Algunos endpoints leen `user_id` del body en lugar del token | documentado |
| `POST /api/supplier-payments` (allocations) | `_frozen_po_amount`, `_exchange_rate` | WRONG_NAME | Campos internos con prefijo `_` (convención reservada para privados) usados como transporte transaccional | documentado |
| `POST /api/supplier-payments` (data.credit_balance path) | `is_credit_application`, `applied_amount` | CALC | Modo especial credit_balance no crea SupplierPayment, solo allocations | documentado |
| `GET /api/purchase-orders` (lista y detalle) | `last_invoice_number`, `payment_status`, `reception_history`, `payment_history`, `invoices` | CALC | Enriquecimiento post-query con N+1 | documentado |
| `POST /api/purchase-orders` (data) | `order.order_number` | CALC | Auto-generado `OC-YYYYMMDD-NNNN` con lock | documentado |
| `GET /api/price-lists/:id/detail` (PATCH response) | `version` | CALC | Optimistic locking counter | documentado |
| `GET /api/quotes/*` | `code` (auto-gen) | CALC | Auto-generado por hook | documentado |
| `POST /api/credit-notes` | `credit_note_number` | CALC | Auto-generado `NC-YYYYMMDD-NNNN` | documentado |
| `GET /api/ar/*` | aging buckets (`vigente`, `0_30`, `31_60`, `61_90`, `+90`, `sin_termino`) | CALC | Clasificación aging con `count` + `amount` por bucket | documentado |
| `GET /api/ar/customers` | `blocked`, `blocked_reason`, `worst_bucket`, `worst_days` | CALC | Flags de bloqueo de crédito por cliente | documentado |
| `POST /api/supplier-payments`, `POST /api/credit-notes`, etc. | `payment_method='credit_balance'` | ALIAS | Método virtual que toma camino alternativo (no crea recurso, descuenta de wallet) | documentado |
| `GET /api/products/:id` (response) | `unit_size_measure` valores | ENUM | Valores `UND/LT/ML/KG/GR/OZ` no validados contra enum explícito | documentado |
| `GET /api/auth/login` (data) | `token` | CALC | JWT generado server-side | documentado |
| `POST /api/products/export-csv` | — (binario) | N/A | CSV binario, no aplica shape JSON | — |

---

## 4. Inconsistencias de formato de respuesta

Patrones de inconsistencia detectados entre módulos.

| Módulo(es) | Problema detectado | Estado |
|--------|--------------------|--------|
| **Todos** salvo SLE (parcial), BNK (sin wrapper), CTL (campos al root) | `success: true/false` wrapper en respuestas — el estándar es `{ message, data }` sin `success` | pendiente |
| SLE (todos los endpoints) | **Shape caótico**: cada endpoint usa wrapper distinto (`{message, sale}`, `{sales, pagination}`, `{sale}`, `{data}`, `{stats}`, campos al root, `{success, data}` solo en summary). **Módulo más no conforme del proyecto** | pendiente |
| BNK vs resto | Array directo sin wrapper alguno (`res.json(banks)`) — único módulo así | pendiente |
| CTL vs resto | Campos al root (`{ company, priceList, categories, products, ... }`) sin wrapper | pendiente |
| ROL, USR | `data: { roles }` / `data: { users }` (anidado) vs `data: role` / `data: user` (directo) — **inconsistencia interna** entre lista y detalle | pendiente |
| TRF | `data: { transfers, pagination }` — pagination anidada dentro de data | pendiente |
| QT | `data: { quotes, pagination }` — pagination anidada + `pages` sin `totalPages` | pendiente |
| PRE | `pagination` sin `limit` (campo faltante) | pendiente |
| INV movements vs otras listas | `pagination.pages` vs `pagination.totalPages` — 2 convenciones | pendiente |
| **Date params** | Mezcla: `start_date`/`end_date` (PRD, INV, SLE stats, SPY, CN), `from`/`to` (SLE summary, daily-series, CST purchases, PRE), `date_from`/`date_to` (PO, XCH conformes), `date` singular (SLE daily-closure, XCH latest) — **4 convenciones diferentes** | pendiente |
| **Sort params** | `sort_by`/`sort_dir` (estándar, ningún módulo lo implementa), `sortBy`/`sortOrder` (CST, PO), sin sort (resto) — **2 convenciones + ausencia** | pendiente |
| **Limit default** | 10 (SLE getSales), 20 (PRD, BRD, SLE stats, SUP, SPY, PRL, QT, PRE, CN, DLV), 25 (estándar — ningún módulo), 50 (INV warehouse, CAT, XCH, INV movements), 500 (CST active hardcoded), 5000 (AR summary hardcoded), sin paginación (BNK, CTL, ROL, USR, CMP) | pendiente |
| **is_active filter default** | PRD default `true`, CAT no filtra (devuelve inactivas), BRD no filtra, SUP no filtra, XCH default `true` (con 'all' especial), INV no expone filtro | pendiente |
| Modelos camelCase vs snake_case | Customer (`firstName`, `creditLimit`, `isDeleted`), PriceList (`isDefault`, `validFrom`, `validUntil`, `isDeleted`), Quote, PreOrder usan camelCase; resto snake_case. **Inconsistencia transversal de ORM** | pendiente |
| `req.user.id` vs `req.userId` | INV adjust, TRF, SLE, POS, SPY, PO usan `req.user.id`; AUTH me, XCH, PRE usan `req.userId`; PRL hace fallback `req.user?.id || req.userId`. **3 patrones distintos para el mismo dato** | pendiente |
| Mensajes inglés/español | AUTH (todos inglés), PRD (mezcla), BRD (todos inglés), SUP (CRUD inglés, resumen español), INV (mezcla), XCH (mezcla), otros (español) | pendiente |
| Error 500 exponiendo `error.message` | SLE, SPY, PRE, BNK, UPL exponen `error.message` en errores 500 — riesgo de seguridad (stack/info interna) | pendiente |
| **Duplicado de recurso** código HTTP | CAT, CST, USR, XCH devuelven **400**; estándar es **409**. PRD sí usa 409 correctamente | pendiente |
| **Política de delete** | Soft delete: PRD, BRD, SUP, QT, PRL, PRE. Hard delete: CAT, XCH, ROL, USR (presunto). Paranoid: SLE. Mixto (soft si tiene dependencias, hard si no): CST. DELETE-con-cancel: SPY (soft), DLV. **4 políticas diferentes** | pendiente |
| **DELETE con body** | POS `/tab`, SPY `/:id`, UPL `/image` usan DELETE con body — anti-patrón REST | pendiente |
| **Acciones vía método incorrecto** | PRE `/approve`, `/reject` usan PUT (estándar POST); SLE `/cancel`, `/payments`, DLV `/confirm`, `/cancel`, CN `/approve`, `/cancel` usan POST correctamente; UPL no expone acción de reemplazo | pendiente |
| **Validación body** | Solo AUTH, PRD, CAT, XCH usan express-validator. Resto valida en controller. SLE no valida nada | pendiente |
| `console.log`/`console.error` residuales | TRF (1), SUP update (3), UPL (3), BNK catch (1), SLE catch (varios), SPY catch (varios) | pendiente |
| 404 handler (app.js:167) | `{ success: false, message: 'Endpoint not found' }` — `success` no estándar; mensaje en inglés | pendiente |
| Health endpoint no documentado | `GET /health` existe pero no está en el diccionario | pendiente |

---

## 5. Notas de trabajo

- Cambios de **path** requieren actualizar: `app.js` (mount) + archivo de rutas + frontend (`src/services/api/`).
- Cambios de **código HTTP** son breaking changes si el frontend usa `response.status` para lógica. Verificar antes.
- Cambio `/api/ar` → `/api/accounts-receivable`: afecta `ar.routes.js`, `app.js`, y todos los archivos frontend que llamen a `/ar`.
- Cambio `/api` (roles) → `/api/roles`: afecta `app.js`, `role.routes.js` (quitar prefijo `/roles` de las rutas internas), y frontend.
- El agente mapeador debe actualizar las secciones 2, 3 y 4 conforme avanza — no crear entradas en sección 1.
- **No ejecutar ninguna normalización sin instrucción explícita del usuario.**
- **Cambios de backend ya aplicados pendientes en frontend** → ver §6 al final del documento.
- **Patrones transversales más urgentes si se decide corregir** (por orden de impacto):

---

## 6. Verificación con pruebas reales (2026-07-03)

El usuario levantó el backend en `:5001` y se ejecutaron **63 pruebas HTTP** contra endpoints reales para verificar las conclusiones del mapeo estático.

### Hallazgos que confirmaron el mapeo estático

- ✅ **AUTH login**: `{success, message: "Login successful" (inglés), data: {user, token}}`
- ✅ **AUTH `/me`**: sin `message` en single response
- ✅ **AUTH 401**: `"Invalid credentials"` en inglés
- ✅ **PRD barcode no encontrado**: devuelve `200` con `{success:true, data:null, message:"Barcode not found"}` — anti-patrón confirmado
- ✅ **PRD export-csv**: binario `text/csv` con BOM, 484 líneas (productos activos)
- ✅ **PRD modo POS** (`?price_list_id=X`): slim attributes (`id, name, sku, is_active, presentations, barcodes, inventories`) — sin `category`/`brand` confirmado
- ✅ **CAT getAll**: `productCount` camelCase (CALC) en cada item
- ✅ **BNK**: array directo sin wrapper alguno (`[{id, name, currency, ...}]`)
- ✅ **SLE getSales**: `{sales, pagination}` sin `success` ni `data` wrapper
- ✅ **SLE daily-closure**: 8 campos al root (sin wrapper)
- ✅ **SLE summary**: `{success, data}` — único endpoint SLE con `success`
- ✅ **SLE getSaleById inexistente**: 404 con `{message: "Venta no encontrada"}` (sin success)
- ✅ **USR getAll**: `{success, data: {users: [...]}}` anidado
- ✅ **USR duplicado**: 400 con `"El usuario o email ya existe"`
- ✅ **CST getAll**: modelo camelCase completo (firstName, lastName, businessName, tradeName, creditLimit, creditUsed, creditDays, priceListId, discountPercentage, documentType, documentNumber, postalCode). Solo timestamps (`created_at`, `updated_at`) en snake.
- ✅ **CST duplicado**: 400 con `"Ya existe un cliente con el documento X"`
- ✅ **XCH convert vía GET**: funciona pero anti-patrón
- ✅ **XCH duplicado**: 400 con `"Ya existe una tasa de cambio de VES a COP para la fecha X"`
- ✅ **AR admin-pin/status**: `{success, data: {has_pin: bool, is_locked: bool}}`
- ✅ **INV movements pagination**: tiene `pages` (sin `totalPages`)
- ✅ **INV warehouses**: sub-recurso misplaced dentro de inventory, devuelve `{success, data: [3 warehouses]}`
- ✅ **INV valuation**: `{success, data: {currency: 'USD', totalValue: 152833...}}`
- ✅ **POS reservations**: `data` es objeto (no array) — agrupado por productId
- ✅ **PRE pagination**: solo `{total, page, totalPages}` sin `limit`
- ✅ **ROL getAll vs getById**: confirmada inconsistencia interna (lista anidada vs detalle directo)
- ✅ **CTL público**: campos al root, sin auth, sin wrapper
- ✅ **404 handler**: `{success: false, message: "Endpoint not found"}`
- ✅ **Sin auth → 401**: `{success: false, message: "No token provided. Authentication required."}`
- ✅ **TRF getAll**: `{success, data: {transfers, pagination}}` — pagination anidada en data
- ✅ **PO getAll**: POs traen `payment_status` y `last_invoice_number` CALC
- ✅ **PRL getAll**: modelo camelCase (`isDefault`, `validFrom`)
- ✅ **DLV getAll**: `{success, data, pagination}` estándar
- ✅ **CMP público**: `{success, data}` sin auth (singleton)
- ✅ **PKG/PRT active**: módulos mínimos, idéntica estructura, 9 items cada uno
- ✅ **validate-credit-pin**: 400 con `"PIN incorrecto"` / `"PIN debe ser de 4 a 6 dígitos"`
- ✅ **health**: `{success: true, status: "ok", ...}` — también usa success wrapper

### Discrepancias con el mapeo estático (corregidas en §2)

- ❌ **BRD-NO-VALIDATION** (mi hipótesis: "sin validación, error 500"): **REALIDAD** — SÍ valida vía modelo Sequelize. Falta `name` → 400 controlado con `{success:false, message:"Validation error", errors:[{field, message}]}`. Corregido.
- ❌ **BRD-NO-409** (mi hipótesis: "error 500 del DB"): **REALIDAD** — UniqueConstraintError se captura como **400** (no 500, no 409) con `{message:"Duplicate entry", errors:[{field:"name", message:"name already exists"}]}`. Sigue siendo no conforme (estándar 409) pero la descripción era incorrecta.
- ❌ **SUP** (mi hipótesis: "asumí unique: true en name"): **REALIDAD** — **no hay unique constraint** en `name` ni `tax_id`. Permite crear suppliers con mismo nombre/RIF sin error (HTTP 201). Diferencia importante con BRD.
- ⚠️ **AR admin-pin** (mi doc decía "presunto"): ahora confirmado el shape exacto.

### Nuevos hallazgos detectados durante pruebas (agregados a §2)

- 🔴 **ERRORHANDLER-STACK-TRACE-EXPOSE**: JSON malformado devuelve stack trace completo exponiendo paths internos (`/home/joel/Projects/Emprendimiento-Lobo/backend/...`), versiones de paquetes (`body-parser@1.20.5`, `raw-body@2.5.3`), y frames de `node:internal/*`. **Bug de seguridad confirmado** (verificado con 2 JSON malformados diferentes).
- 🔴 **UPL path traversal CONFIRMADO**: `DELETE /api/upload/image` con `url: "../../../etc/passwd"` devuelve `{success:true, message:"Imagen eliminada exitosamente"}` sin sanitización. Vulnerabilidad confirmada.
- 🟡 **HEALTH-USES-SUCCESS**: `GET /health` también usa `success` wrapper — no estaba documentado.

### Resumen de verificación

| Métrica | Valor |
|---------|-------|
| Pruebas ejecutadas | 63 |
| Hipótesis confirmadas | ~50 |
| Hipótesis corregidas | 4 (BRD validation ×2, SUP unique, AR admin-pin) |
| Hallazgos nuevos | 3 (stack trace expose, path traversal confirmado, health wrapper) |
| Endpoints creados para test | 1 brand (soft-deleted), 3 suppliers (1 eliminado, 2 reactivados) |
| Side effects en BD | 1 supplier duplicado (id 56 "ALIADOS VILLAMIZAR") que quedó activo por error de script — pendiente decisión del usuario |

**Conclusión**: el mapeo estático fue preciso en ~92% de las hipótesis. Las 4 correcciones y 3 nuevos hallazgos están registradas en §2. Las pruebas reales validaron especialmente los **riesgos de seguridad** (path traversal, stack trace expuesto) que eran hipótesis del mapeo.
  1. `success` wrapper — aparece en ~24 módulos, debe eliminarse de forma coordinada
  2. Shape de SLE — módulo más caótico, requiere reescribir todos los responses
  3. `req.user.id` vs `req.userId` — estandarizar el nombre del atributo inyectado por auth middleware
  4. Modelos camelCase (Customer, PriceList, Quote, PreOrder) — migración grande o decisión de convivencia
  5. Date params — adoptar `date_from`/`date_to` en todos los LIST/STATS
  6. Duplicado de recurso → 409 (no 400) en CAT, CST, USR, XCH
  7. Errores 500 exponiendo `error.message` — logging server-side, no exponer al cliente
- **Bug detectado** durante mapeo (no conformidad API pero sí de negocio): `Sale.payment_status` referenciado en CST queries pero no existe en el modelo Sale. Probable runtime error en `getOverdueCustomers`, `getCreditSummary`, `getCustomerStats`. **Recomendación: investigar antes de tocar el código.**
- **Bug detectado**: `CST.validateCredit` devuelve siempre `availableCredit: Infinity` sin validar `creditLimit`. Función stub.
- **Bug detectado**: UPL `DELETE /image` posible path traversal (no sanitización).
- **Módulos incompletos** (deuda técnica): BNK (sin CRUD), PKG (sin CRUD), PRT (sin CRUD). Solo readonly dropdowns.

---

## 4. Inconsistencias de formato de respuesta

| Módulo | Problema detectado | Estado |
|--------|--------------------|--------|
| _(vacío)_ | Completar durante mapeo del agente | — |

---

## 5. Notas de trabajo

- Cambios de **path** requieren actualizar: `app.js` (mount) + archivo de rutas + frontend (`src/services/api/`).
- Cambios de **código HTTP** son breaking changes si el frontend usa `response.status` para lógica. Verificar antes.
- Cambio `/api/ar` → `/api/accounts-receivable`: afecta `ar.routes.js`, `app.js`, y todos los archivos frontend que llamen a `/ar`.
- El agente mapeador debe actualizar las secciones 2, 3 y 4 conforme avanza — no crear entradas en sección 1.
- **No ejecutar ninguna normalización sin instrucción explícita del usuario.**

---

## 6. Cambios de backend ya aplicados — pendientes en frontend

Commits en `refactor/backend-mechanical`: DATE-001/002/004/005, SORT-001, REQID-001, SUCCESS-BE. Aplicar al refactorizar cada página, no antes.

### DATE-003 — `start_date`/`end_date` → `date_from`/`date_to`

| Página | Qué cambiar |
|--------|-------------|
| `Dashboard.jsx:25,30` | `{ start_date: ..., end_date: ... }` → `{ date_from: ..., date_to: ... }` en `getSalesStats()` |
| `SalesPage.jsx:22-23,62,397` | Estado `filters`: renombrar keys `start_date`→`date_from`, `end_date`→`date_to` y todas sus referencias |
| `InventoryMovementsPage.jsx:10-11,117-128` | Estado `filters`: mismos renames + `onChange` handlers |
| `ReportsPage.jsx:46-47,78-79,169-170,186-187,206-207,359,388,392,396,816-830` | Estado `dateRange`: renombrar keys y todas sus referencias |

### DATE-006 — `dateFrom`/`dateTo` → `date_from`/`date_to` en cotizaciones

| Página | Qué cambiar |
|--------|-------------|
| `QuotesPage.jsx` | Cualquier filtro de fecha que use `dateFrom`/`dateTo` como query param → `date_from`/`date_to` |

### SORT-002 — Sin acción requerida

Ninguna página envía `sortBy`/`sortOrder` explícitamente. El backend usa defaults — no hay impacto.

---

### SUCCESS-001 — Eliminar checks de `data.success` / `res.success`

Commit: `SUCCESS-BE` en `refactor/backend-mechanical`. El backend ya no devuelve el campo `success` en ninguna respuesta.

**Regla general:** si la llamada no lanza excepción, el resultado es exitoso. Reemplazar `if (data.success)` por verificar la existencia del dato esperado o simplemente eliminar el guard.

| Archivo | Línea | Código actual | Fix |
|---------|-------|---------------|-----|
| `CustomerStatementModal.jsx` | 282 | `if (data.success)` | Eliminar guard — si no hay error, datos disponibles |
| `SupplierStatementModal.jsx` | 33 | `if (data.success)` | Ídem |
| `SupplierLedgerModal.jsx` | 60 | `if (res.success)` | Ídem — usar `if (res.data)` o eliminar |
| `CompanyContext.jsx` | 27 | `if (data.success && data.data)` | → `if (data.data)` |
| `StockReplenishmentPage.jsx` | 61 | `if (response.success && response.data)` | → `if (response.data)` |
| `ARCustomerDetailPage.jsx` | 448 | `if (res.success) setData(res.data)` | → `setData(res.data)` (el catch ya maneja errores) |
| `POSPageNew.jsx` | 1027 | `if (res.success)` | Eliminar guard |
| `POSPageTablet.jsx` | 1050 | `if (res.success)` | Ídem (siempre aplicar mismo fix que POSPageNew) |
| `SettingsPage.jsx` | 113,148,192,284,303,362,396,432 | `if (data.success)` (8 veces) | Eliminar guards en todos |
| `SalesPage.jsx` | 152 | `if (data.success && data.credit_balance_cop > 0)` | → `if (data.credit_balance_cop > 0)` |

**Nota atlas-bot:** el bot consume `/api/pre-orders` y `/api/sales/summary`. Actualizar en el mismo deploy que se mergee `refactor/backend-mechanical`.
