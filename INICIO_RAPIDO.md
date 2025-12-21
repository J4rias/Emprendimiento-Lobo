# ⚡ Inicio Rápido - Sistema de Gestión de Víveres

## 🚀 Instalación en 5 Minutos

### Prerrequisitos
- ✅ Node.js v18+ instalado
- ✅ MySQL v8.0+ instalado y corriendo

---

## 📋 Paso 1: Base de Datos (1 minuto)

Abre MySQL y ejecuta:

```sql
CREATE DATABASE gestion_viveres CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**Si usas contraseña en MySQL:**
Edita `backend/.env` y actualiza:
```env
DB_PASSWORD=tu_contraseña_aqui
```

---

## 🔧 Paso 2: Backend (2 minutos)

```bash
cd backend
npm install
npm run init-db
npm run dev
```

✅ Deberías ver: `Server running on port 5000`

---

## 🎨 Paso 3: Frontend (2 minutos)

**Abre una NUEVA terminal** y ejecuta:

```bash
cd frontend
npm install
npm run dev
```

✅ Deberías ver: `Local: http://localhost:3000`

---

## 🌐 Paso 4: Acceder (10 segundos)

1. Abre tu navegador en: **http://localhost:3000**

2. Inicia sesión con:
   - **Usuario:** `admin`
   - **Contraseña:** `Admin123!`

---

## ✅ ¡Listo!

El sistema está funcionando. Ahora puedes:

- ✅ Ver el Dashboard
- ✅ Gestionar Inventario
- ✅ Agregar Productos
- ✅ Configurar Depósitos

---

## 🐛 ¿Problemas?

### Error: "Cannot connect to database"
```bash
# Verifica que MySQL está corriendo
mysql -u root -p

# Verifica el usuario y contraseña en backend/.env
```

### Error: "Port already in use"
```bash
# Mata el proceso en el puerto
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:5000 | xargs kill -9
```

### Error: "npm install falla"
```bash
# Limpia caché e intenta de nuevo
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 Más Información

- Ver `INSTRUCCIONES_INSTALACION.md` para guía completa
- Ver `RESUMEN_PROYECTO.md` para detalles del proyecto
- Ver `README.md` para documentación completa

---

**¡Éxito! 🎉**
