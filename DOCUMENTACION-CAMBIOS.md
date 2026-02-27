# Documentación de Cambios — Personalización por Empresa y Despliegue Multi-Empresa

**Fecha:** 2026-02-23
**Versión:** 1.0

---

## Índice

1. [Resumen de cambios](#1-resumen-de-cambios)
2. [Parte 1: Configuración de empresa](#2-parte-1-configuración-de-empresa)
3. [Parte 2: Despliegue Docker multi-empresa](#3-parte-2-despliegue-docker-multi-empresa)
4. [Guía de migración (BD existente)](#4-guía-de-migración-bd-existente)
5. [Guía de despliegue en VPS](#5-guía-de-despliegue-en-vps)
6. [Configuración de NPM (Nginx Proxy Manager)](#6-configuración-de-npm-nginx-proxy-manager)
7. [Mantenimiento y operaciones](#7-mantenimiento-y-operaciones)

---

## 1. Resumen de cambios

Se implementaron dos funcionalidades principales:

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 1 | **Configuración de empresa** | Nombre, dirección, teléfono, email y RIF editable desde el panel de Configuración → tab "Empresa". El nombre se muestra en tiempo real en el Sidebar. |
| 2 | **Despliegue multi-empresa** | Dos instancias del sistema (empresa 1 y empresa 2) con bases de datos completamente separadas, accesibles por subdominios distintos, usando Docker y NPM como proxy. |

### Archivos nuevos

```
backend/
  models/CompanySettings.js                    ← Modelo Sequelize
  controllers/company.controller.js            ← GET y PUT de empresa
  routes/company.routes.js                     ← Rutas /api/company
  migrations/20260223000005-create-company-settings.js
  scripts/run-migration-company-settings.js    ← Script de migración puntual

frontend/src/
  context/CompanyContext.jsx                   ← Proveedor de contexto React

docker-compose.empresa1.yml                   ← Stack Docker empresa 1
docker-compose.empresa2.yml                   ← Stack Docker empresa 2
.env.empresa1                                 ← Variables de entorno empresa 1
.env.empresa2                                 ← Variables de entorno empresa 2
```

### Archivos modificados

```
backend/
  models/index.js          ← Agrega CompanySettings
  app.js                   ← Registra /api/company
  scripts/init-db.js       ← Seed de fila default en company_settings

frontend/src/
  App.jsx                  ← Envuelto con <CompanyProvider>
  pages/SettingsPage.jsx   ← Tab "Empresa" con formulario
  components/common/Sidebar.jsx ← Muestra nombre de empresa

docker-compose.yml         ← Agrega servicio MySQL compartido
```

---

## 2. Parte 1: Configuración de empresa

### 2.1 Qué hace

- La tabla `company_settings` almacena una sola fila con los datos de la empresa:
  - Nombre, dirección, teléfono, email, RIF/NIT, sitio web
- El endpoint `GET /api/company` es **público** (sin autenticación) para que el nombre de empresa cargue incluso antes del login.
- El endpoint `PUT /api/company` requiere el permiso `settings.manage` (solo Administrador).
- El nombre aparece en la parte superior del Sidebar y se actualiza en tiempo real al guardar.

### 2.2 Cómo usar (UI)

1. Iniciar sesión como **Administrador**.
2. Ir a **Configuración** en el menú lateral.
3. Hacer clic en el tab **Empresa**.
4. Editar los campos deseados y presionar **Guardar cambios**.
5. El nombre en el Sidebar se actualiza automáticamente.

### 2.3 Campos disponibles

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| Nombre de la empresa | Se muestra en el Sidebar y en documentos | Sí |
| Dirección | Dirección física | No |
| Teléfono | Teléfono de contacto | No |
| Correo electrónico | Email corporativo | No |
| RIF / NIT / Tax ID | Identificación fiscal | No |
| Sitio web | URL del sitio web | No |

---

## 3. Parte 2: Despliegue Docker multi-empresa

### 3.1 Arquitectura

```
VPS
├── docker-compose.yml          ← Infraestructura compartida
│   ├── NPM  (puertos 80/443/81)
│   └── MySQL 8.0  (lobo-mysql)
│       ├── empresa1_db
│       └── empresa2_db
│
├── docker-compose.empresa1.yml ← Stack empresa 1
│   ├── empresa1-backend        (red privada: empresa1_internal)
│   └── empresa1-frontend       (red privada + proxy_net)
│
└── docker-compose.empresa2.yml ← Stack empresa 2
    ├── empresa2-backend        (red privada: empresa2_internal)
    └── empresa2-frontend       (red privada + proxy_net)
```

**Flujo de red:**

```
Usuario → empresa1.dominio.com
  → NPM (proxy_net) → empresa1-frontend:80
    → nginx local → empresa1-backend:5000 (/api/*)
      → MySQL lobo-mysql → empresa1_db
```

### 3.2 Por qué esta arquitectura funciona

- Cada stack de empresa tiene su **red interna privada** (`empresa1_internal`, `empresa2_internal`). El frontend de empresa 1 solo puede hablar con el backend de empresa 1.
- El `docker/nginx.conf` existente usa `proxy_pass http://backend:5000`. Dentro de la red interna de cada stack, Docker DNS resuelve `backend` al contenedor correcto. **No fue necesario modificar el Dockerfile ni el nginx.conf**.
- El frontend también se conecta a `proxy_net` para que NPM pueda enrutarle tráfico desde el exterior.
- El backend **no** está en `proxy_net`, por lo que no es accesible directamente desde internet (solo a través del nginx del frontend).

### 3.3 Variables de entorno

Los archivos `.env.empresa1` y `.env.empresa2` contienen la configuración específica de cada instancia:

| Variable | Empresa 1 | Empresa 2 |
|----------|-----------|-----------|
| `DB_NAME` | `empresa1_db` | `empresa2_db` |
| `JWT_SECRET` | Secreto único empresa 1 | Secreto único empresa 2 |
| `FRONTEND_URL` | `https://empresa1.dominio.com` | `https://empresa2.dominio.com` |

> **Importante:** Los `JWT_SECRET` deben ser diferentes entre empresas. Un token de empresa 1 no debe ser válido en empresa 2.

---

## 4. Guía de migración (BD existente)

Si ya tienes una base de datos en funcionamiento y quieres agregar la tabla `company_settings` **sin perder datos**:

### Paso 1: Actualizar el código

```bash
# En el servidor o local — obtener los últimos cambios
git pull origin main
```

### Paso 2: Instalar dependencias (si hay nuevas)

```bash
cd backend
npm install
```

### Paso 3: Ejecutar la migración puntual

```bash
node backend/scripts/run-migration-company-settings.js
```

El script:
- Verifica si la tabla `company_settings` ya existe (idempotente, seguro de ejecutar más de una vez)
- Si no existe, crea la tabla y la fila default con nombre `"Mi Empresa"`
- Si ya existe, no hace nada

**Salida esperada:**
```
✅ Tabla company_settings creada con fila default.
```
o si ya existía:
```
ℹ️  La tabla company_settings ya existe. Nada que hacer.
```

### Paso 4: Reiniciar el backend

```bash
# Con PM2:
pm2 restart backend

# Con Docker:
docker restart empresa1-backend
```

### Paso 5: Verificar

```bash
# Probar el endpoint público (sin token):
curl https://empresa1.dominio.com/api/company
# Respuesta esperada: { "success": true, "data": { "name": "Mi Empresa", ... } }
```

---

## 5. Guía de despliegue en VPS

### Prerequisitos

- Docker y Docker Compose instalados en el VPS
- El repositorio clonado en el VPS
- Los archivos `.env.empresa1` y `.env.empresa2` configurados con los valores reales

### Paso 1: Configurar los archivos .env

Editar `.env.empresa1` con los valores de producción:

```env
NODE_ENV=production
PORT=5000

DB_HOST=lobo-mysql
DB_PORT=3306
DB_NAME=empresa1_db
DB_USER=lobo_user
DB_PASSWORD=mi_password_seguro

JWT_SECRET=una_cadena_aleatoria_muy_larga_min_32_caracteres

FRONTEND_URL=https://empresa1.midominio.com
```

Hacer lo mismo para `.env.empresa2` con `empresa2_db` y un `JWT_SECRET` diferente.

**También editar `docker-compose.yml`** para cambiar las contraseñas de MySQL:

```yaml
environment:
  MYSQL_ROOT_PASSWORD: mi_root_password_seguro
  MYSQL_USER: lobo_user
  MYSQL_PASSWORD: mi_password_seguro   # igual al DB_PASSWORD de los .env
```

### Paso 2: Crear la red compartida

```bash
docker network create proxy_net
```

> Este comando solo se ejecuta una vez. Si ya existe la red, Docker lo indicará y puedes ignorar el error.

### Paso 3: Levantar infraestructura compartida (NPM + MySQL)

```bash
docker compose up -d
```

Esperar ~30 segundos para que MySQL esté listo antes de continuar.

### Paso 4: Construir y levantar empresa 1

```bash
# Construir imágenes
docker compose -f docker-compose.empresa1.yml -p empresa1 build

# Levantar
docker compose -f docker-compose.empresa1.yml -p empresa1 up -d

# Inicializar la base de datos (primera vez)
docker exec empresa1-backend node scripts/init-db.js
```

**Credenciales default de acceso al sistema:**
- Usuario: `admin`
- Contraseña: `Admin123!`

> Cambiar la contraseña del admin después del primer login.

### Paso 5: Construir y levantar empresa 2

```bash
docker compose -f docker-compose.empresa2.yml -p empresa2 build
docker compose -f docker-compose.empresa2.yml -p empresa2 up -d
docker exec empresa2-backend node scripts/init-db.js
```

### Paso 6: Configurar cada empresa

Entrar a cada instancia como admin y desde **Configuración → Empresa** actualizar:
- Nombre de la empresa
- Datos de contacto

### Paso 7: Verificar que los contenedores están corriendo

```bash
docker ps
# Deben aparecer: nginx-proxy-manager, lobo-mysql, empresa1-backend, empresa1-frontend, empresa2-backend, empresa2-frontend
```

---

## 6. Configuración de NPM (Nginx Proxy Manager)

### Acceder a NPM

Abrir en el navegador: `http://IP_DEL_VPS:81`

Credenciales default de NPM:
- Email: `admin@example.com`
- Contraseña: `changeme`

> Cambiar las credenciales de NPM en el primer login.

### Crear proxy host para empresa 1

1. Ir a **Proxy Hosts** → **Add Proxy Host**
2. **Domain Names:** `empresa1.midominio.com`
3. **Scheme:** `http`
4. **Forward Hostname / IP:** `empresa1-frontend`
5. **Forward Port:** `80`
6. **Block Common Exploits:** ✓ activado
7. Tab **SSL** → **Request a new SSL certificate** → activar **Force SSL** y **HTTP/2 Support**
8. Guardar

### Crear proxy host para empresa 2

Repetir el mismo proceso con:
- **Domain Names:** `empresa2.midominio.com`
- **Forward Hostname / IP:** `empresa2-frontend`
- **Forward Port:** `80`

### Prerequisito DNS

Los subdominios deben apuntar al IP del VPS antes de solicitar certificados SSL:

```
empresa1.midominio.com  →  A  →  IP_DEL_VPS
empresa2.midominio.com  →  A  →  IP_DEL_VPS
```

---

## 7. Mantenimiento y operaciones

### Ver logs

```bash
# Logs de empresa 1
docker logs empresa1-backend -f
docker logs empresa1-frontend -f

# Logs de MySQL
docker logs lobo-mysql -f
```

### Reiniciar una empresa

```bash
docker compose -f docker-compose.empresa1.yml -p empresa1 restart
```

### Actualizar el código (nueva versión)

```bash
# 1. Obtener cambios
git pull origin main

# 2. Reconstruir imágenes
docker compose -f docker-compose.empresa1.yml -p empresa1 build
docker compose -f docker-compose.empresa2.yml -p empresa2 build

# 3. Reiniciar con nueva imagen
docker compose -f docker-compose.empresa1.yml -p empresa1 up -d
docker compose -f docker-compose.empresa2.yml -p empresa2 up -d

# 4. Ejecutar migraciones pendientes (si las hay)
docker exec empresa1-backend node scripts/run-migration-company-settings.js
docker exec empresa2-backend node scripts/run-migration-company-settings.js
```

### Backup de base de datos

```bash
# Backup empresa 1
docker exec lobo-mysql mysqldump -u root -p empresa1_db > backup_empresa1_$(date +%Y%m%d).sql

# Backup empresa 2
docker exec lobo-mysql mysqldump -u root -p empresa2_db > backup_empresa2_$(date +%Y%m%d).sql
```

### Detener todo

```bash
docker compose -f docker-compose.empresa2.yml -p empresa2 down
docker compose -f docker-compose.empresa1.yml -p empresa1 down
docker compose down
```

### Agregar una tercera empresa

1. Copiar `.env.empresa1` → `.env.empresa3` (cambiar `DB_NAME`, `JWT_SECRET`, `FRONTEND_URL`)
2. Copiar `docker-compose.empresa1.yml` → `docker-compose.empresa3.yml` (cambiar nombres de servicios, contenedores, redes y volúmenes a `empresa3`)
3. Levantar el stack y ejecutar `init-db.js`
4. Crear proxy host en NPM para `empresa3.midominio.com`

---

## Notas de seguridad

- Los archivos `.env.empresa1` y `.env.empresa2` están agregados al `.gitignore` — **nunca subir al repositorio**.
- Cada empresa tiene su propio `JWT_SECRET`, por lo que los tokens de sesión no son intercambiables entre empresas.
- El backend de cada empresa no es accesible directamente desde internet (solo a través del nginx del frontend).
- Usar contraseñas fuertes para MySQL y para el `JWT_SECRET` (mínimo 32 caracteres aleatorios).
- Generar JWT secrets seguros con: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
