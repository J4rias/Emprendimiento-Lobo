const ExcelJS = require('exceljs');
const path = require('path');

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Emprendimiento Lobo';
  workbook.created = new Date();

  // ============================================
  // HOJA 1: Productos
  // ============================================
  const productSheet = workbook.addWorksheet('Productos', {
    properties: { tabColor: { argb: '4472C4' } }
  });

  productSheet.columns = [
    { header: 'SKU *', key: 'sku', width: 18 },
    { header: 'Nombre del Producto *', key: 'name', width: 35 },
    { header: 'Descripción', key: 'description', width: 40 },
    { header: 'Categoría (ID) *', key: 'category_id', width: 18 },
    { header: 'Marca (ID)', key: 'brand_id', width: 15 },
    { header: '¿Perecedero? (SI/NO)', key: 'is_perishable', width: 22 },
    { header: '¿Control de Lotes? (SI/NO)', key: 'has_batch_control', width: 28 },
    { header: 'Stock Mínimo', key: 'min_stock', width: 15 },
    { header: 'Stock Máximo', key: 'max_stock', width: 15 },
    { header: 'Punto de Reorden', key: 'reorder_point', width: 18 },
    { header: 'Tamaño Unidad', key: 'unit_size', width: 16 },
    { header: 'Medida (UND/LT/ML/KG/GR/OZ)', key: 'unit_size_measure', width: 30 },
  ];

  // Estilo del encabezado
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  };

  productSheet.getRow(1).height = 30;
  productSheet.getRow(1).eachCell((cell) => {
    cell.font = headerStyle.font;
    cell.fill = headerStyle.fill;
    cell.alignment = headerStyle.alignment;
    cell.border = headerStyle.border;
  });

  // Fila de ejemplo
  productSheet.addRow({
    sku: 'COCA-2L',
    name: 'Coca-Cola 2 Litros',
    description: 'Refresco Coca-Cola presentación 2 litros',
    category_id: 1,
    brand_id: 1,
    is_perishable: 'SI',
    has_batch_control: 'NO',
    min_stock: 10,
    max_stock: 100,
    reorder_point: 20,
    unit_size: 2000,
    unit_size_measure: 'ML'
  });

  // Estilo de ejemplo (fondo amarillo claro)
  const exampleStyle = {
    font: { italic: true, color: { argb: '808080' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } }
  };
  productSheet.getRow(2).eachCell((cell) => {
    cell.font = exampleStyle.font;
    cell.fill = exampleStyle.fill;
  });

  // Validaciones de datos
  for (let row = 3; row <= 500; row++) {
    // SI/NO para perecedero
    productSheet.getCell(`F${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"SI,NO"'],
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Seleccione SI o NO'
    };
    // SI/NO para control de lotes
    productSheet.getCell(`G${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"SI,NO"'],
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Seleccione SI o NO'
    };
    // Medida
    productSheet.getCell(`L${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"UND,LT,ML,KG,GR,OZ,LB,GAL"'],
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Seleccione una medida válida'
    };
  }

  // ============================================
  // HOJA 2: Presentaciones
  // ============================================
  const presentationSheet = workbook.addWorksheet('Presentaciones', {
    properties: { tabColor: { argb: 'ED7D31' } }
  });

  presentationSheet.columns = [
    { header: 'SKU del Producto *', key: 'product_sku', width: 20 },
    { header: 'Nombre Presentación *', key: 'name', width: 35 },
    { header: 'Tipo Empaque (ID)', key: 'packaging_type_id', width: 20 },
    { header: 'Tipo Presentación (ID)', key: 'presentation_type_id', width: 22 },
    { header: 'Unidades por Empaque *', key: 'units_per_package', width: 22 },
    { header: 'Unidades por Presentación *', key: 'units_per_presentation', width: 26 },
    { header: 'Precio Empaque (USD)', key: 'package_price', width: 22 },
    { header: 'Costo Empaque (USD)', key: 'package_cost', width: 22 },
    { header: 'Precio Unitario (USD) *', key: 'base_price', width: 22 },
    { header: 'Costo Unitario (USD) *', key: 'cost', width: 22 },
    { header: 'Moneda de Compra (USD/COP/VES)', key: 'purchase_currency', width: 30 },
    { header: '¿Predeterminada? (SI/NO)', key: 'is_default', width: 24 },
  ];

  presentationSheet.getRow(1).height = 30;
  presentationSheet.getRow(1).eachCell((cell) => {
    cell.font = { ...headerStyle.font };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'ED7D31' } };
    cell.alignment = headerStyle.alignment;
    cell.border = headerStyle.border;
  });

  // Filas de ejemplo
  presentationSheet.addRow({
    product_sku: 'COCA-2L',
    name: 'Bandeja de 6 botellas 2L',
    packaging_type_id: 1,
    presentation_type_id: 1,
    units_per_package: 6,
    units_per_presentation: 6,
    package_price: 8.00,
    package_cost: 6.00,
    base_price: 1.50,
    cost: 1.00,
    purchase_currency: 'USD',
    is_default: 'SI'
  });

  presentationSheet.addRow({
    product_sku: 'COCA-2L',
    name: 'Unidad suelta 2L',
    packaging_type_id: '',
    presentation_type_id: 1,
    units_per_package: 1,
    units_per_presentation: 1,
    package_price: '',
    package_cost: '',
    base_price: 1.50,
    cost: 1.00,
    purchase_currency: 'USD',
    is_default: 'NO'
  });

  // Estilo de ejemplos
  [2, 3].forEach(rowNum => {
    presentationSheet.getRow(rowNum).eachCell((cell) => {
      cell.font = exampleStyle.font;
      cell.fill = exampleStyle.fill;
    });
  });

  // Validaciones
  for (let row = 4; row <= 1000; row++) {
    presentationSheet.getCell(`K${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"USD,COP,VES"'],
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Seleccione USD, COP o VES'
    };
    presentationSheet.getCell(`L${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"SI,NO"'],
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Seleccione SI o NO'
    };
  }

  // ============================================
  // HOJA 3: Instrucciones
  // ============================================
  const instructionsSheet = workbook.addWorksheet('Instrucciones', {
    properties: { tabColor: { argb: '70AD47' } }
  });

  instructionsSheet.columns = [
    { width: 5 },
    { width: 80 }
  ];

  const instructions = [
    ['', ''],
    ['', 'INSTRUCCIONES PARA CARGA MASIVA DE PRODUCTOS'],
    ['', ''],
    ['', 'HOJA "Productos":'],
    ['', '  - Los campos marcados con * son obligatorios'],
    ['', '  - SKU: Código único del producto (ej: COCA-2L, HARINA-1KG)'],
    ['', '  - Categoría (ID): Número de la categoría en el sistema'],
    ['', '  - Marca (ID): Número de la marca en el sistema (opcional)'],
    ['', '  - ¿Perecedero?: SI si el producto tiene fecha de vencimiento'],
    ['', '  - ¿Control de Lotes?: SI si se requiere trazabilidad por lotes'],
    ['', '  - Stock Mínimo: Cantidad mínima antes de alerta'],
    ['', '  - Stock Máximo: Cantidad máxima en almacén'],
    ['', '  - Punto de Reorden: Cantidad en la que se debe reabastecer'],
    ['', '  - Tamaño Unidad: Contenido de la unidad (ej: 500 para 500ml)'],
    ['', '  - Medida: UND, LT, ML, KG, GR, OZ, LB, GAL'],
    ['', ''],
    ['', 'HOJA "Presentaciones":'],
    ['', '  - Cada producto puede tener múltiples presentaciones'],
    ['', '  - SKU del Producto: Debe coincidir con un SKU de la hoja Productos'],
    ['', '  - Unidades por Empaque: Cantidad de unidades en el empaque (ej: 6 botellas)'],
    ['', '  - Unidades por Presentación: Cantidad de unidades base de esta presentación'],
    ['', '  - Precio Empaque: Precio de venta del empaque completo'],
    ['', '  - Costo Empaque: Costo de compra del empaque completo'],
    ['', '  - Precio Unitario: Precio de venta por unidad individual'],
    ['', '  - Costo Unitario: Costo de compra por unidad individual'],
    ['', '  - Moneda de Compra: USD (Dólares), COP (Pesos Col.), VES (Bolívares)'],
    ['', '  - ¿Predeterminada?: SI si es la presentación principal del producto'],
    ['', ''],
    ['', 'NOTAS IMPORTANTES:'],
    ['', '  - La fila 2 (amarilla) es un ejemplo. Elimínela antes de importar.'],
    ['', '  - Cada producto debe tener al menos 1 presentación marcada como predeterminada.'],
    ['', '  - Los IDs de categoría, marca, tipo empaque y tipo presentación deben existir en el sistema.'],
    ['', '  - Los precios y costos deben estar en USD (el sistema convierte automáticamente).'],
  ];

  instructions.forEach((row, idx) => {
    const excelRow = instructionsSheet.addRow(row);
    if (idx === 1) {
      excelRow.getCell(2).font = { bold: true, size: 14, color: { argb: '4472C4' } };
    } else if (idx === 3 || idx === 16 || idx === 28) {
      excelRow.getCell(2).font = { bold: true, size: 12, color: { argb: 'ED7D31' } };
    }
  });

  // Guardar archivo
  const outputPath = path.join(__dirname, '..', 'public', 'plantilla_productos.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Plantilla generada exitosamente en: ${outputPath}`);
}

generateTemplate().catch(console.error);
