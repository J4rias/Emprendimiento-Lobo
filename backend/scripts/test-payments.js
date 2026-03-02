const { sequelize } = require('../config/database');
const { SalePayment, Sale } = require('../models');

async function run() {
    try {
        console.log('--- ÚLTIMOS PAGOS REGISTRADOS ---');

        const payments = await SalePayment.findAll({
            limit: 5,
            order: [['created_at', 'DESC']],
            include: [{ model: Sale, as: 'sale', attributes: ['sale_number', 'total', 'paid_amount'] }]
        });

        if (payments.length === 0) {
            console.log('Ningún pago encontrado.');
        } else {
            payments.forEach(p => {
                console.log(`Pago ID: ${p.id} | Venta: ${p.sale?.sale_number}`);
                console.log(`Moneda: ${p.currency} | Tasa: ${p.exchange_rate}`);
                console.log(`Monto Original Pagado: ${p.amount} ${p.currency}`);
                console.log(`Equivalente USD (Almacenado internamente): ${(p.amount / p.exchange_rate).toFixed(2)} USD`);
                console.log(`Método: ${p.payment_method}`);
                console.log('---------------------------------');
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

run();
