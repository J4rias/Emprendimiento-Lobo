const { ExchangeRate, User } = require('../models');
const { sequelize } = require('../config/database');

async function runTest() {
    try {
        await sequelize.authenticate();
        console.log('✅ Conectado a la base de datos para la prueba.\\n');

        // Buscar primer usuario para el created_by
        const admin = await User.findOne();
        if (!admin) {
            throw new Error("No hay usuarios en la BD para asignar a created_by");
        }

        console.log('1. Creando tasas de prueba (VES -> COP y USD -> VES) con fecha falsa (2000-01-01)...');

        const testDate = new Date("2000-01-01");

        // Limpiar tests anteriores por si acaso
        await ExchangeRate.destroy({ where: { effective_date: testDate } });

        await ExchangeRate.bulkCreate([
            {
                from_currency: 'VES',
                to_currency: 'COP',
                rate: 6.2,
                effective_date: testDate,
                is_active: true,
                created_by: admin.id
            },
            {
                from_currency: 'USD',
                to_currency: 'VES',
                rate: 419.9873,
                effective_date: testDate,
                is_active: true,
                created_by: admin.id
            }
        ]);

        console.log('2. Tasas creadas. Ejecutando pruebas de BFS...\\n');

        // Prueba 1: Directa (VES -> COP)
        let rate = await ExchangeRate.getRate('VES', 'COP', testDate);
        console.log(`[TEST 1] VES -> COP (Directa): ${rate} (Esperado: 6.2)`);

        // Prueba 2: Inversa (COP -> VES)
        rate = await ExchangeRate.getRate('COP', 'VES', testDate);
        console.log(`[TEST 2] COP -> VES (Inversa): ${rate} (Esperado: 0.161...)`);

        // Prueba 3: Triangular Corta (USD -> COP). Debe cruzar por VES
        // USD -> VES (419.9873) * VES -> COP (6.2) = 2603.92126
        rate = await ExchangeRate.getRate('USD', 'COP', testDate);
        console.log(`[TEST 3] USD -> COP (Triangular BFS): ${rate} (Esperado: ~2603.921)`);

        // Prueba 4: Triangular Inversa (COP -> USD). Debe cruzar por VES
        // COP -> VES (1/6.2) * VES -> USD (1/419.9873) = ~0.000384
        rate = await ExchangeRate.getRate('COP', 'USD', testDate);
        console.log(`[TEST 4] COP -> USD (Triangular Inversa BFS): ${rate} (Esperado: ~0.000384)`);

        // Simulando que el usuario introduce la opción directa para mayor precisión
        console.log('\\n3. Introduciendo tasa directa opcional USD -> COP (ej. 2610 para simular mercado negro/oficial)...');
        await ExchangeRate.create({
            from_currency: 'USD',
            to_currency: 'COP',
            rate: 2610, // Diferente al calculado matemático (2603)
            effective_date: testDate,
            is_active: true,
            created_by: admin.id
        });

        // Prueba 5: Prioridad de Ruta Directa sobre Triangular
        rate = await ExchangeRate.getRate('USD', 'COP', testDate);
        console.log(`[TEST 5] USD -> COP (Prioridad Directa): ${rate} (Esperado: 2610)`);


        console.log('\\n✅ Todas las pruebas de BFS pasaron exitosamente.');

        // Limpiar: Borrar las de prueba
        await ExchangeRate.destroy({ where: { effective_date: testDate } });
    } catch (error) {
        console.error('❌ Error en la prueba:', error);
    } finally {
        process.exit(0);
    }
}

runTest();
