const { PriceList } = require('../backend/models');
const { sequelize } = require('../backend/config/database');

async function checkCurrencies() {
  try {
    const counts = await PriceList.findAll({
      attributes: [
        'currency',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { isDeleted: false },
      group: ['currency'],
      raw: true
    });
    
    console.log('Price List Currencies:');
    console.log(JSON.stringify(counts, null, 2));

    const lists = await PriceList.findAll({
        where: { isDeleted: false },
        attributes: ['id', 'name', 'currency'],
        raw: true
    });
    console.log('\nAll Active Price Lists:');
    console.log(JSON.stringify(lists, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCurrencies();
