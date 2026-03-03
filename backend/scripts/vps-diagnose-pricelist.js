/**
 * VPS Diagnostic Script - Price List Error
 * 
 * Este script se usa para rastrear exhaustivamente lo que el backend de producción
 * está procesando al intentar actualizar la lista de precios. Permite saltarse 
 * los errores genéricos de "500 Internal Server Error" del frontend.
 * 
 * Ejecución en VPS: node scripts/vps-diagnose-pricelist.js
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { execSync } = require('child_process');

async function runDiagnostics() {
    console.log('🔍 Iniciando diagnóstico de servidor VPS - Error en Lista de Precios...');

    // 1. Revisar si existen logs de error de node (ej. PM2 o variables de entorno del contenedor Docker)
    console.log('\n--- 1. Revisión de variables y Entorno ---');
    console.log(`Node Environment: ${process.env.NODE_ENV || 'Not Set'}`);

    try {
        const pkg = require('../package.json');
        console.log(`Versión App y dependencias críticas cargadas:`);
        console.log(`- Sequelize: ${pkg.dependencies.sequelize || 'N/A'}`);
    } catch (e) { console.log('No se pudo leer package.json'); }

    // 2. Verificar estructura y permisos del archivo modificado (PriceList.js)
    console.log('\n--- 2. Verificación del Archivo de Modelo Modificado ---');
    try {
        const priceListPath = path.join(__dirname, '../models/PriceList.js');
        const content = fs.readFileSync(priceListPath, 'utf8');
        console.log(`Archivo PriceList.js encontrado. Tamaño: ${content.length} bytes.`);

        // Verificar si la solución del transactor fue implementada en este servidor
        if (content.includes('transaction: options.transaction')) {
            console.log('✅ El código CÍ TIENE el fix del Deadlock (Transaction Fix implementado).');
        } else {
            console.error('❌ ADVERTENCIA: Este servidor tiene código VIEJO en PriceList.js. Falta el paso de transacciones.');
        }
    } catch (err) {
        console.error('No se pudo leer el modelo PriceList.js', err.message);
    }

    // 3. Revisar logs activos de Docker/PM2 para encontrar la excepción del API
    console.log('\n--- 3. Extracción de Últimos Logs de la Aplicación ---');
    console.log('Intentando obtener los últimos errores (últimas 50 líneas)...');
    try {
        // Asumiendo que puede haber un archivo de log local, pm2 logs o en docker se puede inyectar
        // Intentaremos leer logs genéricos generados por el sistema de logs si los hay (ej., winston, morgan)
        console.log('(En un entorno Docker real, el error sale por stdout. Revisa "docker logs empresa1-backend --tail 50")');
    } catch (err) {
        console.log('No se pudieron extraer logs automatizados.');
    }

    // 4. Test simulado interno de la Base de Datos
    console.log('\n--- 4. Test Simulado de Inyección en DB ---');
    try {
        const { sequelize, PriceList } = require('../models');
        await sequelize.authenticate();
        console.log('✅ Conexión a Base de Datos de producción exitosa.');

        // Tratar de forzar un query básico sobre price-lists
        const activeList = await PriceList.findOne({ order: [['id', 'ASC']] });
        if (activeList) {
            console.log(`✅ Se encontró la lista de precios Pk: ${activeList.id}, Code: ${activeList.code}.`);
        } else {
            console.log('⚠️ No hay listas de precios activas.');
        }

    } catch (err) {
        console.error('❌ ERROR de Base de Datos:', err.message);
        if (err.sql) console.error('SQL Fallido:', err.sql);
    }

    console.log('\n✅ Diagnóstico finalizado. Copia estos resultados a la consola para su revisión.');
    process.exit(0);
}

runDiagnostics();
