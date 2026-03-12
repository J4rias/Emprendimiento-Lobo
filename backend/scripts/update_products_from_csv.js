const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { sequelize, ProductPresentation, PriceList, PriceListDetail } = require('../models');

async function main() {
  console.log('Starting product update from CSV...');

  try {
    // 1. Connect to DB and ensure models are synced (though in existing app they should be)
    await sequelize.authenticate();
    console.log('Database connection successful.');

    // 2. Find the "Precio Publico" price list
    const priceList = await PriceList.findOne({
      where: {
        name: 'Precio Publico'
      }
    });

    if (!priceList) {
      console.error('Error: PriceList "Precio Publico" not found.');
      process.exit(1);
    }
    console.log(`Found PriceList: ${priceList.name} (ID: ${priceList.id}, Currency: ${priceList.currency})`);

    // Fetch the latest conversion rate from COP to the PriceList base currency
    let copToBaseRate = 1;
    if (priceList.currency !== 'COP') {
      const { ExchangeRate } = require('../models');

      // Helper function to get latest rate
      const getLatestRate = async (from, to) => {
        return await ExchangeRate.findOne({
          where: { from_currency: from, to_currency: to, is_active: true },
          order: [['effective_date', 'DESC'], ['created_at', 'DESC']]
        });
      };

      // Try direct route COP -> USD
      let rateObj = await getLatestRate('COP', priceList.currency);
      if (rateObj) {
        copToBaseRate = parseFloat(rateObj.rate);
      } else {
        // Try reverse direct route USD -> COP
        rateObj = await getLatestRate(priceList.currency, 'COP');
        if (rateObj && parseFloat(rateObj.rate) > 0) {
          copToBaseRate = 1 / parseFloat(rateObj.rate);
        } else {
          // Indirect route: COP -> VES -> USD
          // Because the system typically acts as USD->VES and VES->COP
          const vesToCop = await getLatestRate('VES', 'COP');
          const usdToVes = await getLatestRate('USD', 'VES');

          if (vesToCop && usdToVes && parseFloat(vesToCop.rate) > 0 && parseFloat(usdToVes.rate) > 0) {
            // 1 USD = usdToVes VES
            // 1 VES = vesToCop COP
            // => 1 USD = (usdToVes * vesToCop) COP
            // => 1 COP = 1 / (usdToVes * vesToCop) USD
            copToBaseRate = 1 / (parseFloat(usdToVes.rate) * parseFloat(vesToCop.rate));
            console.log(`Using cross exchange rate: 1 USD = ${parseFloat(usdToVes.rate)} VES, 1 VES = ${parseFloat(vesToCop.rate)} COP => 1 COP = ${copToBaseRate} ${priceList.currency}`);
          } else {
             console.error(`Error: Could not find active exchange rate (direct or crossed through VES) between COP and ${priceList.currency}.`);
             process.exit(1);
          }
        }
      }
    }

    // 3. Read and Parse CSV
    const csvFilePath = path.join(__dirname, '../data.csv');
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    
    const records = parse(fileContent, {
      columns: true, // Use the first row as column names
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Parsed ${records.length} records from CSV.`);

    let updatedPresentations = 0;
    let updatedOrCreatedPrices = 0;
    let errors = 0;

    // 4. Wrap updates in a transaction
    await sequelize.transaction(async (t) => {
      for (const record of records) {
        const presentationId = record['ID Presentación'];
        const productId = record['ID Producto'];
        const unitsPerPackage = parseFloat(record['Unidades por Paquete'] || 1);
        const unitsPerPresentation = parseFloat(record['Unidades por Presentación'] || 1);
        let rawPackageCost = record['Costo por Paquete'] || '0';
        // Replace comma with dot for decimals, and parse
        rawPackageCost = rawPackageCost.replace(/\./g, '').replace(',', '.');
        const packageCost = parseFloat(rawPackageCost);
        let currency = record['Moneda'];
        if (!currency || currency.trim() === '') {
          currency = 'USD'; // Default to USD if empty to avoid truncation/enum errors
        }
        
        let rawPackagePrice = record['Precio de Venta'] || '0';
        rawPackagePrice = rawPackagePrice.replace(/\./g, '').replace(',', '.');
        let packagePriceCop = parseFloat(rawPackagePrice);
        
        // Convert to PriceList base currency
        const packagePrice = packagePriceCop * copToBaseRate;

        // Skip rows without ID Presentación or ID Producto
        if (!presentationId || !productId) {
          continue;
        }

        const unitCost = packageCost / unitsPerPackage;

        try {
          // Update ProductPresentation
          const [presentationAffectedCount] = await ProductPresentation.update({
            units_per_presentation: unitsPerPresentation,
            package_cost: packageCost,
            cost: unitCost,
            purchase_currency: currency
          }, {
            where: { id: presentationId },
            transaction: t
          });

          if (presentationAffectedCount > 0) {
            updatedPresentations++;
          }

          // Upsert PriceListDetail (if we have a selling price)
          if (packagePrice > 0) {
             const unitPrice = packagePrice / unitsPerPackage;
             
             // First check if it exists to update, else create
             const existingPriceDetail = await PriceListDetail.findOne({
               where: {
                 price_list_id: priceList.id,
                 presentation_id: presentationId
               },
               transaction: t
             });

             if (existingPriceDetail) {
               await existingPriceDetail.update({
                 package_price: packagePrice,
                 unit_price: unitPrice,
                 package_cost: packageCost, // Optional: update the cost snapshot here as well
                 unit_cost: unitCost
               }, { transaction: t });
             } else {
               await PriceListDetail.create({
                 price_list_id: priceList.id,
                 product_id: productId,
                 presentation_id: presentationId,
                 package_cost: packageCost,
                 unit_cost: unitCost,
                 package_price: packagePrice,
                 unit_price: unitPrice,
                 margin_percentage: 0 // You might want to calculate margin here if needed
               }, { transaction: t });
             }
             updatedOrCreatedPrices++;
          }
        } catch (err) {
          console.error(`Error processing presentation ID ${presentationId}:`, err.message);
          errors++;
        }
      }
    });

    console.log('Update completed successfully.');
    console.log(`- Presentations updated: ${updatedPresentations}`);
    console.log(`- Prices updated/created: ${updatedOrCreatedPrices}`);
    if (errors > 0) {
      console.log(`- Errors encountered: ${errors}`);
    }

  } catch (error) {
    console.error('An unexpected error occurred:', error);
  } finally {
    await sequelize.close();
  }
}

main();
