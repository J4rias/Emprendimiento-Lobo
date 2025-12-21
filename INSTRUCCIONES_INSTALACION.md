# 📦 Instrucciones de Instalación y Despliegue

## Sistema de Gestión Integral para Negocio de Víveres

Este documento proporciona las instrucciones paso a paso para instalar y ejecutar el sistema.

---

## 📋 Prerrequisitos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** v18 o superior → [Descargar](https://nodejs.org/)
- **MySQL** v8.0 o superior → [Descargar](https://dev.mysql.com/downloads/mysql/)
- **Git** (opcional) → [Descargar](https://git-scm.com/)

### Verificar instalaciones:

```bash
node --version    # Debe ser v18+
npm --version     # Debe ser v9+
mysql --version   # Debe ser v8.0+
```

---

## 🗄️ Paso 1: Configurar Base de Datos MySQL

### 1.1 Crear Base de Datos

Abre MySQL desde la terminal o usando una herramienta como MySQL Workbench:

```bash
mysql -u root -p
```

Ejecuta los siguientes comandos SQL:

```sql
-- Crear base de datos
CREATE DATABASE gestion_viveres CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crear usuario (opcional - puedes usar root)
CREATE USER 'viveres_user'@'localhost' IDENTIFIED BY 'tu_password_seguro';

-- Otorgar permisos
GRANT ALL PRIVILEGES ON gestion_viveres.* TO 'viveres_user'@'localhost';
FLUSH PRIVILEGES;

-- Salir
EXIT;
```

**NOTA:** Si usas el usuario `root`, puedes omitir la creación del usuario.

---

## 🔧 Paso 2: Configurar el Backend

### 2.1 Instalar Dependencias

```bash
cd backend
npm install
```

### 2.2 Configurar Variables de Entorno

El archivo `.env` ya está creado en `backend/.env`. Verifica y ajusta las siguientes variables:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=gestion_viveres
DB_USER=root              # Cambia si creaste un usuario diferente
DB_PASSWORD=              # Tu contraseña de MySQL

# JWT (Importante: cambia en producción)
JWT_SECRET=tu_clave_secreta_muy_segura_cambiame_en_produccion_2025

# Server
PORT=5000
NODE_ENV=development
```

**⚠️ IMPORTANTE:**
- Si usas `root` como usuario, deja `DB_USER=root`
- Si MySQL no tiene contraseña, deja `DB_PASSWORD=` vacío
- Si creaste el usuario `viveres_user`, actualiza `DB_USER` y `DB_PASSWORD`

### 2.3 Inicializar la Base de Datos

Este comando creará todas las tablas y datos iniciales:

```bash
npm run init-db
```

Deberías ver una salida similar a:

```
✅ Database initialized successfully!
📝 Login credentials:
   Username: admin
   Password: Admin123!
```

### 2.4 Iniciar el Servidor Backend

```bash
# Modo desarrollo (con auto-reload)
npm run dev

# O modo producción
npm start
```

El servidor debería estar corriendo en: **http://localhost:5000**

Verifica accediendo a: **http://localhost:5000/health**

---

## 🎨 Paso 3: Configurar el Frontend

### 3.1 Abrir Nueva Terminal

Abre una **nueva terminal** (deja el backend corriendo en la anterior).

### 3.2 Instalar Dependencias

```bash
cd frontend
npm install
```

### 3.3 Verificar Variables de Entorno

El archivo `.env` ya está creado en `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Sistema de Gestión de Víveres
VITE_ENABLE_SCANNER=true
```

### 3.4 Iniciar el Servidor Frontend

```bash
npm run dev
```

El frontend debería estar corriendo en: **http://localhost:3000**

---

## 🚀 Paso 4: Acceder al Sistema

### 4.1 Abrir en el Navegador

Abre tu navegador y ve a: **http://localhost:3000**

### 4.2 Iniciar Sesión

Usa las credenciales por defecto:

```
Usuario: admin
Contraseña: Admin123!
```

**⚠️ IMPORTANTE:** Cambia la contraseña del administrador después del primer inicio de sesión.

---

## 📂 Estructura del Proyecto

```
sistema-gestion-viveres/
├── backend/                 # Servidor Node.js/Express
│   ├── config/             # Configuraciones
│   ├── models/             # Modelos de base de datos
│   ├── controllers/        # Controladores
│   ├── routes/             # Rutas de la API
│   ├── middleware/         # Middlewares
│   ├── scripts/            # Scripts de utilidad
│   ├── .env                # Variables de entorno
│   └── server.js           # Punto de entrada
│
├── frontend/               # Cliente React
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── pages/         # Páginas
│   │   ├── services/      # Servicios de API
│   │   ├── context/       # Contextos de React
│   │   └── App.jsx        # Componente principal
│   ├── .env               # Variables de entorno
│   └── package.json
│
└── database/              # Scripts de base de datos
    ├── schema.sql         # Schema completo
    └── seeds/             # Datos iniciales
```

---

## 🔍 Verificar Instalación

### Backend:
- ✅ Health check: http://localhost:5000/health
- ✅ API funcionando
- ✅ Base de datos conectada

### Frontend:
- ✅ Aplicación cargando: http://localhost:3000
- ✅ Página de login visible
- ✅ Puede iniciar sesión

---

## 🛠️ Scripts Disponibles

### Backend (`backend/`)

```bash
npm run dev           # Ejecutar en modo desarrollo (auto-reload)
npm start            # Ejecutar en modo producción
npm run init-db      # Inicializar base de datos
npm test             # Ejecutar tests
```

### Frontend (`frontend/`)

```bash
npm run dev          # Ejecutar en modo desarrollo
npm run build        # Compilar para producción
npm run preview      # Previsualizar build de producción
```

---

## 🐛 Solución de Problemas

### Error: "Cannot connect to MySQL"

**Solución:**
1. Verifica que MySQL esté corriendo
2. Verifica usuario y contraseña en `backend/.env`
3. Verifica que la base de datos existe

```bash
mysql -u root -p
SHOW DATABASES;  # Debe aparecer 'gestion_viveres'
```

### Error: "Port 5000 already in use"

**Solución:**
Cambia el puerto en `backend/.env`:
```env
PORT=5001
```

Y también en `frontend/.env`:
```env
VITE_API_URL=http://localhost:5001/api
```

### Error: "Module not found"

**Solución:**
```bash
# En backend
cd backend
rm -rf node_modules package-lock.json
npm install

# En frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### La página no carga o muestra error 404

**Solución:**
1. Verifica que ambos servidores estén corriendo
2. Backend en http://localhost:5000
3. Frontend en http://localhost:3000
4. Limpia la caché del navegador (Ctrl + Shift + R)

---

## 📊 Próximos Pasos

Una vez instalado el sistema:

1. ✅ **Cambiar contraseña del admin**
   - Ir a Configuración → Cambiar contraseña

2. ✅ **Crear categorías** (ya vienen pre-cargadas)
   - Lácteos, Granos, Aceites, Bebidas, etc.

3. ✅ **Agregar productos**
   - Ir a Productos → Nuevo Producto
   - El SKU se genera automáticamente

4. ✅ **Configurar inventario inicial**
   - Ir a Inventario → Ajustar Stock

5. ✅ **Crear usuarios adicionales**
   - Ir a Usuarios → Nuevo Usuario
   - Asignar roles: Despachador, Cajero, Contador

---

## 📞 Soporte

Si encuentras algún problema:

1. Verifica los logs en la consola del backend
2. Revisa los errores en la consola del navegador (F12)
3. Consulta la documentación del README.md principal

---

## 🔐 Seguridad

**IMPORTANTE para Producción:**

1. Cambia `JWT_SECRET` en `.env` a un valor único y seguro
2. Usa contraseñas fuertes para MySQL
3. Configura HTTPS
4. Cambia todas las contraseñas por defecto
5. Configura firewall y límites de red

---

## ✅ Checklist de Instalación

- [ ] Node.js v18+ instalado
- [ ] MySQL v8.0+ instalado
- [ ] Base de datos `gestion_viveres` creada
- [ ] Dependencias del backend instaladas
- [ ] Variables de entorno del backend configuradas
- [ ] Base de datos inicializada (`npm run init-db`)
- [ ] Backend corriendo en puerto 5000
- [ ] Dependencias del frontend instaladas
- [ ] Frontend corriendo en puerto 3000
- [ ] Login exitoso con credenciales admin
- [ ] Dashboard visible y funcionando

---

**¡Felicitaciones! 🎉 El sistema está listo para usar.**

Fecha: 20 de Diciembre, 2025
