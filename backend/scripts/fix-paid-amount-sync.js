/**
 * Script para sincronizar paid_amount en ventas a partir de los pagos registrados.
 *
 * Problema: El campo paid_amount está desincronizado en ventas antiguas porque solo
 * el endpoint addPayment lo actualiza. Pagos registrados históricamente no actualizaron
 * este campo, causando que el botón "Pagar" en Kardex aparezca en facturas ya pagadas.
 *
 * Solución: Recalcular paid_amount sumando todos los SalePayment para cada venta,
 * aplicando la fórmula: amount / exchange_rate (convierte a USD).
 *
 * Uso:
 *   - DRY RUN:     DRY_RUN=1 node scripts/fix-paid-amount-sync.js
 *   - REAL:        docker exec -it empresa1-backend node scripts/fix-paid-amount-sync.js
 *
 * Fases:
 *   1. Diagnóstico: Mostrar ventas desincronizadas (paid_amount en BD != pagos reales)
 *   2. Corrección: UPDATE cada venta con el paid_amount correcto y status correcto
 *   3. Verificación: Confirmar que no quedan desincronizaciones
 */

const { sequelize } = require('../config/database');

const DRY_RUN = process.env.DRY_RUN === '1';

async function run() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 SINCRONIZACIÓN DE paid_amount EN VENTAS');
  console.log('='.repeat(80) + '\n');

  if (DRY_RUN) {
    console.log('⚠️  MODO DRY-RUN: Se mostrarán los cambios pero NO se ejecutarán.\n');
  }

  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos exitosa.\n');

    // ============================================================
    // FASE 1: DIAGNÓSTICO
    // ============================================================
    console.log('--- FASE 1: DIAGNÓSTICO ---\n');

    const [mismatchedSales] = await sequelize.query(`
      SELECT
        s.id,
        s.sale_number,
        s.total,
        s.paid_amount AS stored_paid_amount,
        s.status,
        COALESCE(
          SUM(sp.amount / NULLIF(COALESCE(sp.exchange_rate, 1), 0)),
          0
        ) AS real_paid_amount,
        ABS(
          COALESCE(
            SUM(sp.amount / NULLIF(COALESCE(sp.exchange_rate, 1), 0)),
            0
          ) - s.paid_amount
        ) AS difference
      FROM sales s
      LEFT JOIN sale_payments sp ON sp.sale_id = s.id
      WHERE s.status NOT IN ('cancelled')
      GROUP BY s.id, s.sale_number, s.total, s.paid_amount, s.status
      HAVING ABS(
        COALESCE(
          SUM(sp.amount / NULLIF(COALESCE(sp.exchange_rate, 1), 0)),
          0
        ) - s.paid_amount
      ) > 0.01
      ORDER BY s.id
    `);

    console.log(`📊 Total de ventas desincronizadas: ${mismatchedSales.length}\n`);

    if (mismatchedSales.length === 0) {
      console.log('✅ No hay desincronizaciones. El sistema está sincronizado.\n');
      console.log('='.repeat(80));
      console.log('✅ COMPLETADO');
      console.log('='.repeat(80) + '\n');
      await sequelize.close();
      process.exit(0);
    }

    // Mostrar detalles de cada desincronización
    console.log('📋 Ventas a corregir:\n');
    let totalDifference = 0;
    mismatchedSales.forEach((sale) => {
      const stored = parseFloat(sale.stored_paid_amount || 0);
      const real = parseFloat(sale.real_paid_amount || 0);
      const diff = parseFloat(sale.difference || 0);
      totalDifference += diff;

      const newStatus = real >= parseFloat(sale.total) - 0.01 ? 'completed' : 'pending';
      const statusChange = sale.status !== newStatus ? ` | status: ${sale.status} → ${newStatus}` : '';

      console.log(
        `  • ${sale.sale_number.padEnd(20)} | ` +
        `stored: ${stored.toFixed(2).padStart(10)} USD → ` +
        `real: ${real.toFixed(2).padStart(10)} USD | ` +
        `diff: ${diff.toFixed(2).padStart(8)} USD${statusChange}`
      );
    });

    console.log(`\n💰 Diferencia total: ${totalDifference.toFixed(2)} USD\n`);

    // ============================================================
    // FASE 2: CORRECCIÓN
    // ============================================================
    if (!DRY_RUN) {
      console.log('--- FASE 2: CORRECCIÓN ---\n');

      let correctedCount = 0;
      for (const sale of mismatchedSales) {
        const realPaidAmount = parseFloat(sale.real_paid_amount || 0);
        const totalAmount = parseFloat(sale.total);
        const newStatus = realPaidAmount >= totalAmount - 0.01 ? 'completed' : 'pending';

        try {
          await sequelize.query(
            `
            UPDATE sales
            SET paid_amount = ?,
                status = ?
            WHERE id = ?
            `,
            {
              replacements: [realPaidAmount, newStatus, sale.id],
              type: sequelize.QueryTypes.UPDATE
            }
          );

          correctedCount++;
          const stored = parseFloat(sale.stored_paid_amount || 0);
          const statusChange = sale.status !== newStatus ? ` | ${sale.status} → ${newStatus}` : '';

          console.log(
            `  ✅ ${sale.sale_number.padEnd(20)} | ` +
            `${stored.toFixed(2).padStart(10)} → ${realPaidAmount.toFixed(2).padStart(10)} USD${statusChange}`
          );
        } catch (err) {
          console.error(`  ❌ Error al corregir ${sale.sale_number}:`, err.message);
        }
      }

      console.log(`\n✅ Total corregidas: ${correctedCount} ventas\n`);
    } else {
      console.log('--- FASE 2: CORRECCIÓN (DRY-RUN) ---\n');
      console.log(`  ℹ️  Se actualizarían ${mismatchedSales.length} ventas (modo dry-run)\n`);
    }

    // ============================================================
    // FASE 3: VERIFICACIÓN
    // ============================================================
    if (!DRY_RUN) {
      console.log('--- FASE 3: VERIFICACIÓN POST-CORRECCIÓN ---\n');

      const [remainingMismatches] = await sequelize.query(`
        SELECT COUNT(*) as remaining_count
        FROM (
          SELECT
            s.id,
            ABS(
              COALESCE(
                SUM(sp.amount / NULLIF(COALESCE(sp.exchange_rate, 1), 0)),
                0
              ) - s.paid_amount
            ) AS difference
          FROM sales s
          LEFT JOIN sale_payments sp ON sp.sale_id = s.id
          WHERE s.status NOT IN ('cancelled')
          GROUP BY s.id, s.paid_amount
          HAVING ABS(
            COALESCE(
              SUM(sp.amount / NULLIF(COALESCE(sp.exchange_rate, 1), 0)),
              0
            ) - s.paid_amount
          ) > 0.01
        ) mismatches
      `);

      const remaining = parseInt(remainingMismatches[0].remaining_count || 0);

      if (remaining === 0) {
        console.log('✅ Verificación exitosa: 0 desincronizaciones restantes\n');
      } else {
        console.log(`⚠️  Aún hay ${remaining} desincronizaciones restantes.\n`);
      }
    }

    // ============================================================
    // RESUMEN FINAL
    // ============================================================
    console.log('='.repeat(80));
    if (DRY_RUN) {
      console.log('📋 RESUMEN (DRY-RUN)');
      console.log(`   Ventas a corregir: ${mismatchedSales.length}`);
      console.log(`   Diferencia total: ${totalDifference.toFixed(2)} USD`);
      console.log('\n   Para ejecutar la corrección real, omite DRY_RUN:');
      console.log('   docker exec -it empresa1-backend node scripts/fix-paid-amount-sync.js');
    } else {
      console.log('✅ SINCRONIZACIÓN COMPLETADA');
      console.log(`   Ventas corregidas: ${mismatchedSales.length}`);
      console.log(`   Diferencia total resuelta: ${totalDifference.toFixed(2)} USD`);
    }
    console.log('='.repeat(80) + '\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

run();
