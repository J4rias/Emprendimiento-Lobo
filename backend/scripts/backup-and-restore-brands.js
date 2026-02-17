const { sequelize } = require('../config/database');
const { Brand } = require('../models');
const fs = require('fs');
const path = require('path');

/**
 * Script para respaldar y restaurar marcas con sus imágenes
 * Uso:
 *   node scripts/backup-and-restore-brands.js backup
 *   node scripts/backup-and-restore-brands.js restore
 */

const BACKUP_FILE = path.join(__dirname, 'brands-backup.json');

async function backupBrands() {
  try {
    console.log('📦 Respaldando marcas...\n');

    const brands = await Brand.findAll({
      raw: true
    });

    if (brands.length === 0) {
      console.log('⚠️  No hay marcas para respaldar');
      return;
    }

    // Guardar respaldo
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(brands, null, 2));

    console.log(`✅ ${brands.length} marcas respaldadas en: ${BACKUP_FILE}`);
    console.log('\nMarcas respaldadas:');
    brands.forEach(brand => {
      console.log(`  - ${brand.name} (${brand.code}) ${brand.image_url ? '🖼️' : ''}`);
    });

  } catch (error) {
    console.error('❌ Error al respaldar marcas:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function restoreBrands() {
  try {
    console.log('♻️  Restaurando marcas...\n');

    // Verificar si existe el archivo de respaldo
    if (!fs.existsSync(BACKUP_FILE)) {
      console.log('⚠️  No se encontró archivo de respaldo');
      return;
    }

    // Leer respaldo
    const brandsBackup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));

    if (brandsBackup.length === 0) {
      console.log('⚠️  El archivo de respaldo está vacío');
      return;
    }

    // Restaurar marcas
    for (const brandData of brandsBackup) {
      // Verificar si la imagen existe
      if (brandData.image_url) {
        const imagePath = path.join(__dirname, '..', 'public', brandData.image_url);
        if (!fs.existsSync(imagePath)) {
          console.log(`⚠️  Imagen no encontrada para ${brandData.name}: ${brandData.image_url}`);
          brandData.image_url = null; // Limpiar referencia si la imagen no existe
        }
      }

      await Brand.create({
        code: brandData.code,
        name: brandData.name,
        description: brandData.description,
        image_url: brandData.image_url,
        status: brandData.status || 'active'
      });

      console.log(`  ✅ ${brandData.name} ${brandData.image_url ? '🖼️' : ''}`);
    }

    console.log(`\n✅ ${brandsBackup.length} marcas restauradas exitosamente`);

  } catch (error) {
    console.error('❌ Error al restaurar marcas:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Ejecutar según el argumento
const command = process.argv[2];

if (command === 'backup') {
  backupBrands()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else if (command === 'restore') {
  restoreBrands()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  console.log('Uso: node scripts/backup-and-restore-brands.js [backup|restore]');
  process.exit(1);
}
