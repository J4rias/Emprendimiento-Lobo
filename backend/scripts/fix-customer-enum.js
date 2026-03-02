const { sequelize } = require('../config/database');

async function fixCustomerEnum() {
    try {
        console.log('🚀 Iniciando actualización técnica del ENUM...');

        await sequelize.authenticate();
        console.log('✅ Conexión establecida.');

        // 1. Expandir el ENUM para incluir AMBOS sets (antiguos y nuevos)
        console.log('⏳ Expandiendo ENUM temporalmente...');
        await sequelize.query(`
      ALTER TABLE customers 
      MODIFY COLUMN document_type ENUM('DNI', 'RUC', 'CE', 'PASSPORT', 'OTHER', 'V', 'E', 'J', 'G', 'P') 
      NOT NULL DEFAULT 'V'
    `);

        // 2. Mapear los datos ahora que el ENUM acepta los nuevos valores
        console.log('⏳ Mapeando datos...');
        await sequelize.query("UPDATE customers SET document_type = 'V' WHERE document_type = 'DNI'");
        await sequelize.query("UPDATE customers SET document_type = 'J' WHERE document_type = 'RUC'");
        await sequelize.query("UPDATE customers SET document_type = 'E' WHERE document_type = 'CE'");
        await sequelize.query("UPDATE customers SET document_type = 'P' WHERE document_type = 'PASSPORT'");
        await sequelize.query("UPDATE customers SET document_type = 'V' WHERE document_type NOT IN ('V', 'E', 'J', 'G', 'P')");

        // 3. Reducir el ENUM a solo los valores venezolanos
        console.log('⏳ Limpiando ENUM (eliminando tipos peruanos)...');
        await sequelize.query(`
      ALTER TABLE customers 
      MODIFY COLUMN document_type ENUM('V', 'E', 'J', 'G', 'P') 
      NOT NULL DEFAULT 'V'
    `);

        // 4. País
        console.log('⏳ Ajustando país...');
        await sequelize.query("UPDATE customers SET country = 'Venezuela' WHERE country = 'Perú' OR country IS NULL");
        await sequelize.query(`
      ALTER TABLE customers 
      MODIFY COLUMN country VARCHAR(100) DEFAULT 'Venezuela'
    `);

        console.log('✅ Proceso completado exitosamente.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixCustomerEnum();
