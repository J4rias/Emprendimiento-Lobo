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
    console.log(`Found PriceList: ${priceList.name} (ID: ${priceList.id})`);

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
        const packagePrice = parseFloat(rawPackagePrice);

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
