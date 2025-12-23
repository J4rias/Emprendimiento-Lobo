# 📸 Instalación del Escáner de Código de Barras con Cámara

## Dependencia Requerida

Para que funcione el escaneo con cámara, necesitas instalar la librería ZXing:

```bash
cd frontend
npm install @zxing/library
```

## ¿Qué hace esta librería?

**@zxing/library** es una librería de código abierto que permite:
- Escanear códigos de barras usando la cámara del dispositivo
- Soporta múltiples formatos: EAN-13, EAN-8, UPC-A, UPC-E, Code 39, Code 93, Code 128, QR Code, etc.
- Funciona en navegadores móviles y de escritorio
- No requiere instalación de apps nativas

## Características del Escáner Implementado

### 🎯 Modos de Escaneo

1. **Modo Cámara** (Por defecto)
   - Usa la cámara trasera del móvil
   - Escaneo automático en tiempo real
   - Vibración al detectar código
   - Overlay visual con marco de enfoque

2. **Modo Manual**
   - Input de texto para escribir código
   - Compatible con escáneres externos Bluetooth/USB
   - Auto-submit al presionar Enter

### 📱 Permisos de Cámara

El navegador solicitará permiso para usar la cámara:
- **Primera vez**: Aparecerá un popup pidiendo permiso
- **Permiso denegado**: Se mostrará mensaje de error con instrucciones
- **Cámara ocupada**: Detecta si otra app está usando la cámara

### ⚡ Características Técnicas

- **Prevención de duplicados**: No escanea el mismo código dos veces en 2 segundos
- **Vibración háptica**: Feedback táctil al escanear (si el dispositivo lo soporta)
- **Auto-cleanup**: Libera la cámara automáticamente al salir
- **Manejo de errores**: Mensajes claros para cada tipo de error

### 🔧 Solución de Problemas

#### "Permiso de cámara denegado"
1. Ve a la configuración del navegador
2. Busca "Permisos del sitio" o "Site Settings"
3. Encuentra tu sitio web
4. Activa el permiso de cámara

#### "La cámara está siendo usada por otra aplicación"
- Cierra otras apps que puedan estar usando la cámara
- Reinicia el navegador

#### "No se encontró ninguna cámara"
- Verifica que tu dispositivo tenga cámara
- Prueba con otro navegador

### 🌐 Compatibilidad

**Navegadores Soportados:**
- ✅ Chrome/Edge (móvil y escritorio)
- ✅ Safari (iOS 11+)
- ✅ Firefox (móvil y escritorio)
- ✅ Samsung Internet
- ⚠️ Opera Mini (limitado)

**Sistemas Operativos:**
- ✅ Android 5.0+
- ✅ iOS 11+
- ✅ Windows 10+
- ✅ macOS 10.13+
- ✅ Linux

### 💡 Consejos de Uso

1. **Iluminación**: Asegúrate de tener buena luz
2. **Distancia**: Mantén el código a 10-20cm de la cámara
3. **Estabilidad**: Mantén el móvil estable al escanear
4. **Enfoque**: Espera a que la cámara enfoque antes de escanear
5. **Limpieza**: Limpia el lente de la cámara si no escanea bien

### 🔒 Seguridad y Privacidad

- La cámara solo se activa en la página de reposición
- No se graban ni guardan imágenes
- El video se procesa localmente en el dispositivo
- La cámara se desactiva automáticamente al salir

## Instalación Completa

```bash
# 1. Navegar al directorio del frontend
cd "c:\Users\j4rias\Desktop\Emprendimiento Lobo\frontend"

# 2. Instalar la dependencia
npm install @zxing/library

# 3. Reiniciar el servidor de desarrollo
npm run dev
```

## Verificación

Después de instalar, verifica que funcione:

1. Abre la aplicación en tu móvil
2. Ve a "Reponer Stock"
3. Debería aparecer el botón "Cámara" activo
4. Al hacer click, el navegador pedirá permiso para la cámara
5. Acepta el permiso
6. Apunta a un código de barras
7. Debería detectarlo automáticamente

## Alternativa sin Cámara

Si no quieres usar la cámara, puedes:
1. Click en el botón "Manual"
2. Usar un escáner Bluetooth/USB externo
3. O escribir el código manualmente

---

**Nota**: La primera vez que uses la cámara, el navegador guardará tu preferencia de permisos para futuras visitas.
