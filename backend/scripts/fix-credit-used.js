/**
 * Script para diagnosticar y corregir el credit_used de los clientes.
 * 
 * Uso: docker exec -it empresa1-backend node scripts/fix-credit-used.js
 */

const { sequelize } = require('../config/database');

async function run() {
    console.log('🔍 Diagnóstico de crédito de clientes...\n');

    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa.\n');

        // 1. Mostrar estado actual de los clientes con crédito
        const [customers] = await sequelize.query(`
      SELECT id, 
             COALESCE(first_name, business_name) as nombre,
             credit_limit, 
             credit_used, 
             (credit_limit - credit_used) as disponible
      FROM customers 
      WHERE credit_limit > 0 AND deleted_at IS NULL
      ORDER BY id
    `);

        console.log('--- Estado actual de clientes con crédito ---');
        customers.forEach(c => {
            console.log(`  ID: ${c.id} | ${c.nombre} | Límite: ${c.credit_limit} | Usado: ${c.credit_used} | Disponible: ${c.disponible}`);
        });

        // 2. Calcular el credit_used real basado en ventas a crédito pendientes
        console.log('\n--- Calculando credit_used REAL basado en ventas pendientes ---');
        const [realUsage] = await sequelize.query(`
      SELECT s.customer_id, 
             COALESCE(c.first_name, c.business_name) as nombre,
             c.credit_limit,
             c.credit_used as credit_used_actual,
             COALESCE(SUM(s.total), 0) as credit_used_real
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      WHERE s.sale_type = 'credit' 
        AND s.status = 'pending'
      GROUP BY s.customer_id
    `);

        if (realUsage.length === 0) {
            console.log('  No hay ventas a crédito pendientes. El credit_used debería ser 0 para todos.');
        } else {
            realUsage.forEach(r => {
                const diff = parseFloat(r.credit_used_actual) - parseFloat(r.credit_used_real);
                console.log(`  ID: ${r.customer_id} | ${r.nombre} | Usado actual: ${r.credit_used_actual} | Usado real: ${r.credit_used_real} | Diferencia: ${diff.toFixed(2)}`);
            });
        }

        // 3. CORREGIR: Resetear credit_used al valor real
        console.log('\n--- Aplicando corrección ---');

        // Primero, poner a 0 todos los que no tienen ventas pendientes
        const [resetResult] = await sequelize.query(`
      UPDATE customers 
      SET credit_used = 0 
      WHERE id NOT IN (
        SELECT DISTINCT customer_id FROM sales 
        WHERE sale_type = 'credit' AND status = 'pending' AND customer_id IS NOT NULL
      ) AND credit_used > 0
    `);
        console.log(`  ✅ Clientes sin ventas pendientes reseteados a 0: ${resetResult.affectedRows || 0}`);

        // Luego, corregir los que sí tienen ventas pendientes
        if (realUsage.length > 0) {
            for (const r of realUsage) {
                await sequelize.query(`
          UPDATE customers SET credit_used = ? WHERE id = ?
        `, { replacements: [r.credit_used_real, r.customer_id] });
                console.log(`  ✅ Cliente ${r.customer_id} (${r.nombre}): credit_used corregido a ${r.credit_used_real}`);
            }
        }

        // 4. Verificar resultado final
        console.log('\n--- Estado FINAL ---');
        const [final] = await sequelize.query(`
      SELECT id, 
             COALESCE(first_name, business_name) as nombre,
             credit_limit, 
             credit_used, 
             (credit_limit - credit_used) as disponible
      FROM customers 
      WHERE credit_limit > 0 AND deleted_at IS NULL
      ORDER BY id
    `);
        final.forEach(c => {
            console.log(`  ID: ${c.id} | ${c.nombre} | Límite: ${c.credit_limit} | Usado: ${c.credit_used} | Disponible: ${c.disponible}`);
        });

        console.log('\n✅ Corrección completada.');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

run();
