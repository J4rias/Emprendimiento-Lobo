# Atlas ERP — Reglas de UI/UX y Patrones de Diseño

> **Regla de trabajo:** Antes de refactorizar cualquier página, consultar con el usuario.
> Este documento es la fuente de verdad. Toda página nueva o refactorizada debe cumplirlo.
> Si se descubre un patrón nuevo que funciona bien, se añade aquí.

---

## 1. Design Tokens

Los tokens están definidos en `src/index.css` como variables CSS. Usar siempre las clases de Tailwind que los usan (`primary-600`, `gray-200`, etc.) o los tokens directamente — nunca valores hexadecimales hardcodeados en JSX.

### Colores de estado
| Estado   | Background          | Border              | Text                |
|----------|---------------------|---------------------|---------------------|
| error    | `red-50`            | `red-200`           | `red-700`/`red-900` |
| warning  | `amber-50`          | `amber-200`         | `amber-700`         |
| success  | `green-50`          | `green-200`         | `green-700`         |
| info     | `blue-50`           | `blue-200`          | `blue-700`          |

### Colores de divisas (Atlas-específico)
```
USD  → text-green-700 / bg-green-50
COP  → text-amber-700 / bg-amber-50
VES  → text-violet-700 / bg-violet-50
USDT → text-cyan-700  / bg-cyan-50
```

### Radio de bordes
| Elemento       | Clase Tailwind  |
|----------------|-----------------|
| Badges         | `rounded`       |
| Botones/inputs | `rounded-md`    |
| Cards/paneles  | `rounded-lg`    |
| Modales/sheets | `rounded-xl`    |
| Chips/pills    | `rounded-full`  |

---

## 2. Anatomía de Página Estándar

Todo página de listado sigue este orden vertical con `space-y-6`:

```jsx
<div className="space-y-6">
  {/* 1. Header */}
  <div className="flex justify-between items-center">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Título</h1>
      <p className="text-gray-600">Subtítulo descriptivo</p>
    </div>
    {hasPermission('resource.create') && (
      <Button onClick={() => setShowModal(true)}>
        <Plus className="h-4 w-4" />
        Nueva X
      </Button>
    )}
  </div>

  {/* 2. Alert de error de carga (solo errores fetch, NO mutaciones) */}
  {fetchError && (
    <Alert variant="error" title="Error" dismissible>
      {fetchError.message}
    </Alert>
  )}

  {/* 3. Filtros */}
  <Card variant="flat">
    <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." />
    {/* o DateRangeFilter, o ambos */}
  </Card>

  {/* 4. Contenido principal */}
  <Card variant="flat" className="overflow-hidden">
    <Table columns={columns} data={data} loading={isLoading} emptyIcon={...} emptyTitle="..." />
    <Pagination ... />
  </Card>

  {/* 5. Modales y diálogos al final */}
  <Modal ... />
  <ConfirmDialog ... />
</div>
```

### Variantes de layout

**Grid de tarjetas** (ej. CategoriesPage): en lugar del contenedor Table, usar grid sin overflow-hidden:
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {data.map(item => <ItemCard key={item.id} ... />)}
</div>
```

**Página de detalle / form complejo**: puede omitir el SearchInput; sigue siendo `space-y-6`.

---

## 3. Inventario de Componentes UI

Todos los componentes están en `src/components/ui/` y se exportan desde `src/components/ui/index.js`.

### 3.1 Button

```jsx
import { Button } from '../components/ui'

// Variantes disponibles
<Button variant="primary">    // default — acciones principales
<Button variant="secondary">  // acciones secundarias, cancelar
<Button variant="ghost">      // acciones terciarias, iconos en tabla
<Button variant="danger">     // eliminar definitivo
<Button variant="danger-outline"> // eliminar con más contexto visual
<Button variant="success">    // confirmar, aprobar
<Button variant="link">       // navegación inline

// Tamaños
<Button size="sm">     // h-8  (32px) — chips, filtros compactos
<Button size="md">     // h-9  (36px) — default
<Button size="lg">     // h-10 (40px) — llamadas a acción principales
<Button size="icon">   // h-9 w-9 (36px) — iconos solos, tablet mínimo
<Button size="icon-sm">// h-8 w-8 (32px) — acciones en filas de tabla

// Con loading
<Button loading={submitting}>Guardar</Button>
```

**Reglas:**
- **NUNCA usar `<button>` HTML crudo.** Siempre `<Button>` del ui/.
- Para botones en filas de tabla: `variant="ghost" size="icon-sm"`.
- Para eliminar en tabla: agregar `className="text-red-500 hover:text-red-700 hover:bg-red-50"`.
- `active:` states están definidos en el componente — no sobreescribir.
- El tamaño mínimo aceptable en tablet es `size="icon"` (36px). Para botones críticos, `size="lg"` (40px).

### 3.2 Badge

```jsx
<Badge variant="success">Activo</Badge>
<Badge variant="error">Inactivo</Badge>
<Badge variant="warning">Pendiente</Badge>
<Badge variant="info">En proceso</Badge>
<Badge variant="gray">Borrador</Badge>
```

**Reglas:**
- Siempre usar Badge para estados binarios/enumerados — nunca span hardcodeado.
- Estados booleanos: `is_active` → `success`/`error`.

### 3.3 Alert

```jsx
// Error persistente de carga (fetch)
<Alert variant="error" title="Error" dismissible>
  {error}
</Alert>

// Info con auto-cierre (casos especiales)
<Alert variant="info" autoClose={5000}>
  Datos sincronizados correctamente
</Alert>
```

**Reglas:**
- Solo para errores de **carga/fetch** — son persistentes para que el usuario sepa qué falló.
- Errores de **mutación** (create/update/delete) → `toast.error()` siempre.
- Posición: inmediatamente después del header, antes de los filtros.
- Un solo Alert por página — no apilar múltiples.

### 3.4 Card

```jsx
<Card>              // p-6 shadow-sm — panel principal con sombra
<Card variant="compact">  // p-4 shadow-sm — panel compacto con sombra
<Card variant="flat">     // p-4 sin sombra — filtros, contenedores secundarios
<Card variant="flat" className="overflow-hidden">  // contenedor de tabla
```

**Reglas:**
- `variant="flat"` para secciones de filtros — no necesitan sombra.
- `variant="flat" className="overflow-hidden"` para contenedores de tabla (bordes redondeados no se recortan sin overflow-hidden).
- `variant="default"` o `variant="compact"` para paneles destacados (dashboard, summary cards).
- **NO usar** la clase CSS legacy `.card`.

### 3.5 Input

```jsx
<Input
  label="Nombre *"
  value={formData.name}
  onChange={(e) => handleChange(e)}
  error={errors.name}
  helper="Máximo 50 caracteres"
  required
/>
```

**Reglas:**
- Usar `Input` del ui/ para todos los campos de formulario en modales y páginas.
- `label` es opcional pero recomendado (genera `htmlFor` automático).
- `error` activa el estado de error visual + mensaje.
- **NO usar** la clase CSS legacy `.input` en JSX nuevo.

### 3.6 SearchInput

```jsx
const [search, setSearch] = useState('');

<SearchInput
  value={search}
  onChange={setSearch}   // recibe string, no evento
  placeholder="Buscar productos..."
  debounceMs={300}       // default 300ms
/>
```

**Reglas:**
- Reemplaza el patrón `<input className="input">` + debounce manual.
- El padre maneja un solo estado string: el valor ya debounced.
- Para resetear desde un botón "Limpiar filtros": `setSearch('')` — el componente detecta el cambio externo sin re-disparar onChange.
- Siempre usar en lugar de raw `<input type="text">` para búsquedas.

### 3.7 DateRangeFilter

```jsx
import { DateRangeFilter, getDefaultDateRange } from '../components/ui'

const [dateRange, setDateRange] = useState(getDefaultDateRange()); // mes actual

<DateRangeFilter
  value={dateRange}
  onChange={setDateRange}
  showPresets        // chips de Hoy / Esta semana / Este mes / Últimos 30 días
  defaultDays={30}   // para getDefaultDateRange(30) — últimos 30 días por defecto
/>
```

**Reglas:**
- Usar para cualquier filtro de rango de fechas.
- `getDefaultDateRange()` = mes actual; `getDefaultDateRange(N)` = últimos N días.
- Incluir `showPresets` en páginas de reportes; omitir en filtros simples.

### 3.8 Table

```jsx
const columns = [
  { header: 'Producto', accessor: 'name', sortable: true },
  { header: 'Precio', accessor: 'price', render: (row) => `$${row.price}`, className: 'text-right' },
  { header: 'Estado', render: (row) => <Badge ...>{row.status}</Badge> },
  { header: 'Acciones', render: (row) => <ActionButtons row={row} />, className: 'text-right' },
];

// Con sort controlado (persiste entre páginas)
const [sortBy, setSortBy] = useState('name');
const [sortDir, setSortDir] = useState('asc');

<Table
  columns={columns}
  data={products}
  loading={isLoading}
  emptyIcon={Package}
  emptyTitle="No hay productos"
  emptyDescription="Crea tu primer producto"
  emptyAction={<Button onClick={...}>Nuevo</Button>}
  sortBy={sortBy}
  sortDir={sortDir}
  onSort={(field, dir) => { setSortBy(field); setSortDir(dir); setCurrentPage(1); }}
/>
```

**Reglas:**
- Reemplaza raw `<table className="table">` y `DataTable` (legacy).
- Sort controlado: estado en el padre para que persista al cambiar página.
- `accessor` para datos directos, `render` para celdas complejas — pueden combinarse.
- Para columna de acciones: `className: 'text-right'`, sin `sortable`.
- **NO usar** la clase CSS legacy `.table`.

### 3.9 Pagination + useTableLimit

```jsx
import { Pagination, useTableLimit } from '../components/ui'

const [currentPage, setCurrentPage] = useState(1);
const [limit, setLimit] = useTableLimit(); // persiste en localStorage, default 25

// En la query
queryKey: ['resource', currentPage, search, limit]
queryFn: () => api.get('/resource', { params: { page: currentPage, limit, search } })

// En el JSX
<Pagination
  page={currentPage}
  totalPages={totalPages}
  total={total}
  limit={limit}
  onPageChange={setCurrentPage}
  onLimitChange={(newLimit) => { setLimit(newLimit); setCurrentPage(1); }}
/>
```

**Reglas:**
- Siempre usar `useTableLimit()` — nunca `useState(25)` para el limit.
- La paginación va dentro del mismo Card que la tabla, después de ella.
- Al cambiar limit: resetear page a 1.

### 3.10 Modal

```jsx
<Modal
  open={showModal}
  onClose={handleCloseModal}
  title="Nueva Venta"
  size="lg"          // sm | md | lg | xl
  footer={
    <>
      <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
      <Button type="submit" form="sale-form" loading={submitting}>Guardar</Button>
    </>
  }
>
  <form id="sale-form" onSubmit={handleSubmit} className="space-y-4">
    {/* campos */}
  </form>
</Modal>
```

**Reglas:**
- Botones de acción siempre en el `footer` prop (no dentro del form body).
- El Button submit usa `form="form-id"` para conectar con el form sin anidación.
- Alternativa válida (páginas simples): botones submit dentro del form, sin `footer` prop.
- `onClose` debe limpiar estado del form y el `editingX`.
- Tamaños: `sm` (confirmaciones), `md` (forms simples), `lg` (forms complejos), `xl` (editores).

### 3.11 ConfirmDialog

```jsx
<ConfirmDialog
  open={!!deleteTargetId}
  onClose={() => setDeleteTargetId(null)}
  onConfirm={confirmDelete}
  title="Eliminar producto"
  description="Esta acción no se puede deshacer."
  confirmLabel="Eliminar"
  variant="danger"
/>
```

**Reglas:**
- Siempre usar para acciones destructivas — nunca `window.confirm()`.
- `variant="danger"` para eliminar; `variant="warning"` para acciones reversibles.
- La descripción siempre menciona consecuencias.

### 3.12 EmptyState

```jsx
<EmptyState
  icon={Package}
  title="No hay productos"
  description="Crea tu primer producto para comenzar"
  action={hasPermission('products.create') ? (
    <Button onClick={() => setShowModal(true)}>
      <Plus className="h-4 w-4" />
      Nuevo Producto
    </Button>
  ) : undefined}
/>
```

**Reglas:**
- Siempre mostrar cuando `data.length === 0 && !loading`.
- Si hay búsqueda activa: description = "Intenta con otra búsqueda", sin `action`.
- Si no hay búsqueda: mostrar el CTA para crear.
- El componente Table ya incluye EmptyState — no duplicar.

---

## 4. Data Fetching (React Query v5)

```jsx
const { data, isLoading, error } = useQuery({
  queryKey: ['resource', currentPage, search, limit],
  queryFn: () => api.get('/resource', { params: { page: currentPage, limit, search } }).then(r => r.data),
  keepPreviousData: true,
  staleTime: 30_000,
});

const resources = data?.data || [];
const totalPages = data?.pagination?.totalPages || 1;
const total = data?.pagination?.total || 0;
```

**Reglas:**
- `keepPreviousData: true` en todas las listas paginadas (evita parpadeo al cambiar página).
- `staleTime: 30_000` (30s) como default — ajustar para datos muy volátiles.
- `queryKey` siempre incluye todos los parámetros que afectan el resultado.
- Invalidar con `queryClient.invalidateQueries({ queryKey: ['resource'] })` tras mutaciones.

---

## 5. Manejo de Errores

| Tipo de error       | Componente        | Razón                                      |
|---------------------|-------------------|--------------------------------------------|
| Fetch / load error  | `<Alert>`         | Persistente — el usuario necesita saber qué falló al cargar |
| Mutation error      | `toast.error()`   | Auto-dismiss 3s — acción puntual           |
| Mutation success    | `toast.success()` | Auto-dismiss 3s                            |

```jsx
// FETCH ERROR — persistente en estado local
const [error, setError] = useState(null);
// ...en el catch del fetch:
setError(err.message);
// En JSX:
{error && <Alert variant="error" title="Error" dismissible>{error}</Alert>}

// MUTATION ERROR — toast
try {
  await api.post('/resource', data);
  toast.success('Recurso creado');
  queryClient.invalidateQueries({ queryKey: ['resource'] });
} catch (err) {
  toast.error(err.response?.data?.message || 'Error al guardar');
}
```

**NO hacer:**
- `toast.error()` para errores de carga inicial (el usuario puede no verlo si tarda).
- `<Alert>` para errores de mutación (no se auto-oculta, acumula mensajes).
- `setError(null)` al abrir modal (el error de carga de lista no debe limpiarse al abrir modal).

---

## 6. Formularios

### 6.0 Antes de construir un formulario: consultar el diccionario de API

**Siempre** consultar `docs/api-dictionary.md` antes de implementar un formulario de crear/editar. El objetivo es que las validaciones del frontend sean consistentes con las del backend.

**Cómo usar el diccionario:**
1. Buscar el endpoint por TAG (ej. `BRD:CRT` para crear marca).
2. Leer la tabla **Body** → identifica qué campos acepta, cuáles son requeridos, y qué validaciones aplica el backend.
3. Leer la tabla **Errores conocidos** → asegúrate de manejar los códigos 409 (duplicado), 400 (validación), etc.
4. Verificar **Campos huérfanos** → si el backend devuelve campos no en BD, no usarlos como base para validaciones.

**Reglas de alineación frontend ↔ backend:**

| Regla | Razón |
|-------|-------|
| Si el backend marca un campo como `required`, el frontend también debe validarlo | Evitar round-trip al servidor para errores predecibles |
| Si el backend tiene `maxLen N`, el frontend debe usar el mismo N (o menor) | Nunca mostrar un mensaje de éxito del frontend que el backend rechace |
| Si el backend valida con regex (ej. código alfanumérico), replicar en el frontend | Feedback inmediato al usuario |
| Si el backend devuelve 409 (conflicto), manejarlo explícitamente con `toast.error()` | El frontend no puede pre-validar duplicados |
| No validar en el frontend lo que requiere consultar la BD (unicidad, existencia) | Eso es responsabilidad del backend |

**Si el diccionario aún no tiene mapeado el endpoint (dice "TODO"):**
- Leer directamente el route y controller del backend antes de implementar.
- Completar la entrada del diccionario después de implementar.

---

### 6.1 Capacidades de validación de los componentes

`Input`, `Textarea` y `Select` son **pasivos** — no validan solos. Solo muestran lo que tú les pasas:

| Prop      | Tipo     | Efecto visual                                    |
|-----------|----------|--------------------------------------------------|
| `error`   | `string` | Borde rojo + ícono Warning + mensaje bajo el campo |
| `helper`  | `string` | Texto gris bajo el campo (solo cuando no hay error) |
| `label`   | `string` | Label encima con `htmlFor` automático            |
| `required`| `bool`   | Solo atributo HTML — validación mínima del browser, no suficiente |

La lógica de validación vive en el componente padre.

---

### 6.2 Patrón de validación estándar

```jsx
// 1. Estado: formData + errors separados
const [formData, setFormData] = useState({ name: '', code: '', price: '' });
const [errors, setErrors] = useState({});
const [submitting, setSubmitting] = useState(false);

// 2. Función validate() → devuelve objeto con los errores encontrados
const validate = () => {
  const e = {};
  if (!formData.name.trim())              e.name = 'El nombre es obligatorio';
  if (formData.name.trim().length < 2)    e.name = 'Mínimo 2 caracteres';
  if (!formData.code.trim())              e.code = 'El código es obligatorio';
  if (!formData.price || formData.price <= 0) e.price = 'Debe ser mayor a 0';
  return e;
};

// 3. handleChange limpia el error del campo modificado
const handleChange = (e) => {
  const { name, value, type, checked } = e.target;
  setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
};

// 4. handleSubmit — validar antes de enviar
const handleSubmit = async (e) => {
  e.preventDefault();
  const validationErrors = validate();
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;            // detener — no llamar a la API
  }
  setSubmitting(true);
  try {
    await api.post('/resource', formData);
    toast.success('Guardado correctamente');
    queryClient.invalidateQueries({ queryKey: ['resource'] });
    handleCloseModal();
  } catch (err) {
    toast.error(err.response?.data?.message || 'Error al guardar');
  } finally {
    setSubmitting(false);
  }
};

// 5. handleCloseModal — limpiar form Y errores
const handleCloseModal = () => {
  setShowModal(false);
  setEditingItem(null);
  setFormData({ name: '', code: '', price: '' });
  setErrors({});
};
```

**Reglas:**
- Validar **solo al submit** — no en tiempo real mientras escribe (excepto campos con formato estricto como código de barras).
- `handleChange` limpia el error del campo que se modifica — el usuario ve feedback inmediato al corregir.
- `validate()` devuelve objeto vacío `{}` si todo está bien — `Object.keys(e).length === 0` es la comprobación.
- Nunca bloquear el botón "Guardar" mientras se submits, usar `loading={submitting}` en el Button en su lugar.
- `setErrors({})` en `handleCloseModal` — no cargar errores de una sesión anterior al reabrir el modal.

---

### 6.3 Campos obligatorios vs opcionales

**Marca visual:**
- Obligatorio: asterisco `*` en el label → `<Input label="Nombre *" ...>`
- Opcional: sin asterisco, y agregar `helper="Opcional"` si hay ambigüedad

**Campos obligatorios en todos los formularios:**
- Cualquier campo que sea `NOT NULL` sin default en la BD
- Identificadores únicos: nombre, código, SKU
- Claves foráneas de selección: categoría, proveedor, almacén

**Campos siempre opcionales en este proyecto:**
- `description`, `notes` — texto libre de apoyo
- `website`, `logo_url` — datos complementarios de marcas/proveedores
- `email`, `phone` — datos de contacto de clientes/proveedores (si no se requieren para AR)
- `barcode` — código de barras de productos

---

### 6.4 Reglas de validación por tipo de dato

| Tipo               | Validación mínima                                         | Mensaje sugerido                         |
|--------------------|-----------------------------------------------------------|------------------------------------------|
| Nombre / texto     | `trim().length >= 2`                                      | "Mínimo 2 caracteres"                    |
| Código (categ.)    | `trim().length >= 1`, solo alfanumérico, `<= 10 chars`    | "Código inválido (máx. 10 caracteres)"   |
| SKU / referencia   | `trim().length >= 1`                                      | "El SKU es obligatorio"                  |
| Precio / monto     | `parseFloat(v) > 0`                                       | "Debe ser un valor mayor a 0"            |
| Cantidad           | `parseFloat(v) >= 1`, entero si `!is_unit`                | "La cantidad debe ser al menos 1"        |
| Tasa de cambio     | `parseFloat(v) > 0`                                       | "La tasa debe ser mayor a 0"             |
| URL (website)      | solo si no está vacío: `URL` constructor no lanza          | "URL inválida (ej: https://ejemplo.com)" |
| Email              | solo si no está vacío: `/\S+@\S+\.\S+/.test(v)`           | "Email inválido"                         |
| Fecha              | `!!v` (el input date no devuelve vacío fácilmente)         | "La fecha es obligatoria"                |
| Select requerido   | `v !== '' && v !== null && v !== undefined`                | "Debes seleccionar una opción"           |
| Checkbox           | Si es un "acepto términos": `checked === true`            | "Debes aceptar para continuar"           |

**Snippet para validar URL opcional:**
```js
if (formData.website?.trim()) {
  try { new URL(formData.website); }
  catch { e.website = 'URL inválida (ej: https://ejemplo.com)'; }
}
```

**Snippet para validar número:**
```js
const price = parseFloat(formData.price);
if (!formData.price || isNaN(price) || price <= 0) {
  e.price = 'Debe ser un valor mayor a 0';
}
```

---

### 6.5 Estructura JSX de los campos

**Campo de texto obligatorio:**
```jsx
<Input
  label="Nombre *"
  name="name"
  value={formData.name}
  onChange={handleChange}
  error={errors.name}
  placeholder="Ej: Coca-Cola 2L"
/>
```

**Campo de texto opcional con hint:**
```jsx
<Input
  label="Sitio Web"
  name="website"
  type="url"
  value={formData.website}
  onChange={handleChange}
  error={errors.website}
  helper="Opcional — ej: https://ejemplo.com"
  placeholder="https://ejemplo.com"
/>
```

**Select obligatorio:**
```jsx
<Select
  label="Categoría *"
  name="category_id"
  value={formData.category_id}
  onChange={handleChange}
  error={errors.category_id}
>
  <option value="">Seleccionar categoría...</option>
  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
</Select>
```

**Textarea opcional:**
```jsx
<Textarea
  label="Descripción"
  name="description"
  value={formData.description}
  onChange={handleChange}
  rows={3}
  helper="Opcional"
/>
```

**Textarea con límite:**
```jsx
<Textarea
  label="Notas"
  name="notes"
  value={formData.notes}
  onChange={handleChange}
  rows={3}
  maxLength={500}
  helper={`${formData.notes.length}/500 caracteres`}
  error={errors.notes}
/>
```

**Checkbox:**
```jsx
<label className="flex items-center gap-2">
  <input
    type="checkbox"
    name="is_active"
    checked={formData.is_active}
    onChange={handleChange}
    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
  />
  <span className="text-sm text-gray-700">Activo</span>
</label>
```

**Color picker:**
```jsx
<div className="grid grid-cols-5 gap-2">
  {colorOptions.map((color) => (
    <button
      key={color}
      type="button"
      onClick={() => setFormData(prev => ({ ...prev, color }))}
      className={`h-10 rounded-lg border-2 transition-all ${
        formData.color === color
          ? 'border-gray-900 scale-110'
          : 'border-gray-300 hover:border-gray-400'
      }`}
      style={{ backgroundColor: color }}
    />
  ))}
</div>
```

---

### 6.6 Reglas generales de formulario

- Spacing: `space-y-4` entre campos en modales, `space-y-6` en formularios de página completa.
- Labels siempre encima del input — nunca usar solo `placeholder` como hint.
- El `placeholder` es un ejemplo de valor, no una instrucción (`"Ej: Coca-Cola 2L"`, no `"Escribe el nombre"`).
- `handleChange` estándar (limpia el error del campo al cambiar):
  ```js
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
  };
  ```
- Botón submit: `<Button type="submit" form="form-id" loading={submitting}>` — nunca `disabled` solo porque no hay cambios.
- Grids de 2 columnas en modal para campos relacionados: `<div className="grid grid-cols-2 gap-4">`.
- Limpiar siempre `formData` Y `errors` en `handleCloseModal`.

---

## 7. Tipografía

| Elemento               | Clases Tailwind                                    |
|------------------------|-----------------------------------------------------|
| Título de página       | `text-2xl font-bold text-gray-900`                  |
| Subtítulo de página    | `text-gray-600`                                     |
| Título de sección      | `text-lg font-semibold text-gray-900`               |
| Label de campo (form)  | `block text-sm font-medium text-gray-700 mb-1`      |
| Label vista (read-only)| `block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1` |
| Texto de body          | `text-sm text-gray-900`                             |
| Texto secundario       | `text-sm text-gray-600`                             |
| Texto muted            | `text-sm text-gray-500`                             |
| Texto micro / hint     | `text-xs text-gray-500`                             |
| Monospace (ej. código, precio) | `font-mono`                               |

---

## 8. Espaciado y Contenedores

### Espaciado vertical entre secciones
- **Entre secciones de página:** `space-y-6`
- **Entre campos en modal/form:** `space-y-4`
- **Entre elementos inline:** `gap-2` (h3-tipo), `gap-4` (campos grid)
- **Entre botones en footer:** `gap-3`

### Contenedores estándar

| Uso                        | Componente/clase                                               |
|----------------------------|----------------------------------------------------------------|
| Panel principal (destacado)| `<Card>` (p-6 shadow-sm)                                       |
| Panel compacto             | `<Card variant="compact">` (p-4 shadow-sm)                     |
| Sección de filtros         | `<Card variant="flat">` (p-4, sin sombra)                      |
| Contenedor de tabla        | `<Card variant="flat" className="overflow-hidden">`            |
| Grid de tarjetas           | `<div className="grid grid-cols-... gap-4">`                   |
| Tarjeta de item en grid    | `<div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">` |

### Columnas de grids responsive
```
grid-cols-1 md:grid-cols-2            → 2 columnas
grid-cols-1 md:grid-cols-2 lg:grid-cols-3      → 3 col
grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4  → 4 col (CategoriesPage)
grid-cols-2 gap-4                     → 2 col dentro de modal
```

---

## 9. UX en Tablet Android (Redmi Pad 2)

El dispositivo principal de operación es una tablet Android con pantalla táctil. Todas las interacciones deben funcionar con touch.

### Tamaños mínimos de toque
| Caso de uso             | Tamaño mínimo   | Componente                |
|-------------------------|-----------------|---------------------------|
| Botón de fila de tabla  | 32px (`icon-sm`)| `<Button size="icon-sm">` |
| Botón de acción normal  | 36px (`icon`)   | `<Button size="icon">`    |
| Botón CTA / primario    | 40px (`lg`)     | `<Button size="lg">`      |
| Botón de paginación     | 40px            | Manejado en Pagination    |
| Input de texto          | 36px (h-9)      | Input component           |

### Feedback táctil
- Todo elemento interactivo debe tener estado `active:` visible.
- El componente `Button` ya lo tiene en todas sus variantes — no sobreescribir con clases que lo eliminen.
- Para elementos no-Button que sean tocables (tarjetas, toggles): añadir `active:bg-gray-50` o similar.

### Inputs táctiles
- Inputs de búsqueda: usar `<SearchInput>` que incluye `inputMode="search"`, `autoCorrect="off"`, `autoCapitalize="off"`.
- Inputs numéricos: agregar `inputMode="decimal"` o `inputMode="numeric"`.
- Evitar `placeholder` largo que se trunque — preferir labels.

### Hover no es touch
- **No depender de hover para información crítica** — en tablet no existe hover antes del tap.
- Tooltips (title=""): OK para información secundaria, pero no para acciones obligatorias.
- Estados hover de botones: mantener para web, pero la lógica debe funcionar sin hover.

### Overflow y scroll
- Tablas anchas: siempre envolver en `<div className="overflow-x-auto">` dentro del Card.
- Evitar `whitespace-nowrap` en columnas de texto largo (usar `max-w-xs truncate` o dejar que haga wrap).
- Modal: Radix Dialog maneja scroll automáticamente — no añadir overflow manual al body del modal.

---

## 10. Permisos y Control de Acceso

```jsx
const { hasPermission } = useAuth();

// Botón de crear — solo si tiene permiso
{hasPermission('products.create') && (
  <Button onClick={() => setShowModal(true)}>
    <Plus className="h-4 w-4" />
    Nuevo Producto
  </Button>
)}

// Columna de acciones en tabla — condicional
{hasPermission('products.edit') && (
  <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(row)}>
    <Edit2 className="h-4 w-4" />
  </Button>
)}
```

**Reglas:**
- Siempre verificar permisos para CREATE, UPDATE, DELETE.
- READ generalmente no necesita verificación si la ruta está protegida.
- No mostrar botones que el usuario no puede usar — omitir, no deshabilitar.

---

## 11. Formateo de Números y Monedas

```js
// USD — 2 decimales fijos
const formatUSD = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

// COP — sin decimales, con separadores de miles
const formatCOP = (n) => Math.ceil(parseFloat(n || 0)).toLocaleString('es-CO');

// VES — sin decimales, con separadores de miles
const formatVES = (n) => Math.ceil(parseFloat(n || 0)).toLocaleString('es-VE');

// Fechas
const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
```

**Reglas:**
- Solo USD usa `.toFixed(2)`.
- COP y VES siempre `Math.ceil()` + `.toLocaleString()` — **nunca** decimales.
- Fechas de DB con zona horaria: usar `'T00:00:00'` appended para evitar desfase de día.
  ```js
  new Date(date + 'T00:00:00').toLocaleDateString('es-VE')
  ```

---

## 12. Patrones Legacy — NO USAR en Código Nuevo

Estos patrones existen en código antiguo. **No replicar. Migrar en cada refactor.**

| ❌ Legacy                              | ✅ Reemplazar con                           |
|----------------------------------------|---------------------------------------------|
| `<div className="card">`               | `<Card>` / `<Card variant="flat">`          |
| `<div className="card overflow-hidden">`| `<Card variant="flat" className="overflow-hidden">` |
| `<input className="input">`            | `<Input>` o `<SearchInput>`                 |
| `<table className="table">` raw        | `<Table columns={...} data={...} />`        |
| `<button>` HTML crudo                  | `<Button>`                                  |
| `DataTable` (legacy component)         | `<Table>`                                   |
| `useState` + `useEffect` para debounce | `<SearchInput>`                             |
| `useState` + manual date range         | `<DateRangeFilter>`                         |
| `useState(25)` para limit de tabla     | `useTableLimit()`                           |
| `toast.error()` con duración != 3s    | `toast.error()` (usa 3s del Toaster global) |
| `.btn`, `.btn-primary`, `.btn-secondary`| `<Button variant="...">`                   |

---

## 13. Checklist para Nueva Página / Refactor

Antes de dar por terminada una página, verificar:

### Estructura
- [ ] Root: `<div className="space-y-6">`
- [ ] Header con título `text-2xl font-bold` + subtítulo + Button de crear (con guard de permiso)
- [ ] Alert de error de fetch (si la página carga datos)
- [ ] Filtros en `<Card variant="flat">`
- [ ] Contenido en `<Card variant="flat" className="overflow-hidden">`
- [ ] Pagination con `useTableLimit()`

### Componentes
- [ ] Búsqueda usa `<SearchInput>` — no raw input
- [ ] Tabla usa `<Table>` — no raw table ni DataTable
- [ ] Todos los botones usan `<Button>` — ningún raw `<button>`
- [ ] Estados usan `<Badge>` — no spans hardcodeados
- [ ] Errores de mutación usan `toast.error()` — no Alert
- [ ] Acciones destructivas usan `<ConfirmDialog>`
- [ ] Empty state usa `<EmptyState>` (o el de Table) con CTA si aplica

### Formularios
- [ ] Inputs usan `<Input>` del ui/ — no `className="input"`
- [ ] Selects usan `<Select>` del ui/; Textareas usan `<Textarea>` del ui/
- [ ] Form tiene `id` único; Button submit tiene `form="id"` y `loading={submitting}`
- [ ] `handleChange` limpia el error del campo al modificarlo
- [ ] `validate()` definida y llamada en `handleSubmit` antes de la llamada a API
- [ ] Campos obligatorios marcados con `*` en el label y con `error={errors.campo}`
- [ ] Campos opcionales con `helper="Opcional"` si hay ambigüedad
- [ ] `handleCloseModal` limpia `formData` Y `errors`
- [ ] Permisos verificados en cada acción

### Tablet UX
- [ ] Ningún botón es raw `<button>` (sin `active:` state)
- [ ] Botones de tabla tienen al menos 32px (icon-sm)
- [ ] Inputs no se truncan ni desbordan en pantalla de 10"
- [ ] No hay interacciones hover-only sin alternativa táctil

### API y datos
- [ ] Endpoint consultado en `docs/api-dictionary.md` antes de construir el formulario
- [ ] Validaciones frontend alineadas con las del backend (mismos campos requeridos, mismas longitudes)
- [ ] Errores 409 (duplicado) y 404 (no encontrado) manejados explícitamente
- [ ] Si el endpoint no está estándar (verbo en path, path no plural, etc.) → registrarlo en `docs/endpoint-normalization.md`
- [ ] useQuery con `keepPreviousData: true` y `staleTime: 30_000`
- [ ] queryKey incluye todos los parámetros de filtro
- [ ] Invalidación correcta tras mutaciones
- [ ] `useTableLimit()` usado para el limit

---

## 14. Páginas Refactorizadas (estado actual)

| Página             | Estado     | Notas                                              |
|--------------------|------------|----------------------------------------------------|
| CategoriesPage     | ✅ Parcial  | SearchInput y Table pendientes de migrar           |
| BrandsPage         | ✅ Parcial  | SearchInput, Card y Table pendientes de migrar     |
| ExchangeRatesPage  | ✅ Parcial  | Filtro fecha usa Card legacy; tabla raw            |
| ProductsPage       | ✅ Parcial  | useTableLimit aplicado; tabla pendiente            |
| UsersPage          | ⬜ Pendiente| DataTable, raw input, bg-white/shadow manual       |
| SettingsPage       | ⬜ Pendiente| Formularios complejos, modal patterns              |
| SupplierPaymentsPage| ⬜ Pendiente| Fase 4 Bloque 3                                   |

> Las páginas "parciales" funcionan correctamente pero mezclan patrones legacy con nuevos. Se migrarán en el próximo ciclo de refactor de cada página.
