const XLSX = require('xlsx');
const path = require('path');

// Leer el archivo Excel
const filePath = path.join(__dirname, '../../LISTA DE PRECIOS.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('=== INFORMACIÓN DEL ARCHIVO EXCEL ===\n');
console.log('Hojas disponibles:', workbook.SheetNames);
console.log('');

// Procesar cada hoja
workbook.SheetNames.forEach((sheetName) => {
  console.log(`\n=== HOJA: ${sheetName} ===\n`);

  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  // Mostrar las primeras 20 filas
  console.log('Primeras 20 filas:');
  data.slice(0, 20).forEach((row, index) => {
    console.log(`Fila ${index + 1}:`, row);
  });

  console.log(`\nTotal de filas: ${data.length}`);

  // Mostrar estructura de columnas (primera fila como encabezados)
  if (data.length > 0) {
    console.log('\nEncabezados detectados:', data[0]);
  }

  // Convertir a JSON con encabezados
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  console.log(`\nTotal de registros (sin encabezado): ${jsonData.length}`);

  if (jsonData.length > 0) {
    console.log('\nEjemplo de primer registro:');
    console.log(JSON.stringify(jsonData[0], null, 2));

    // Analizar tipos de datos
    console.log('\nAnálisis de columnas:');
    const columns = Object.keys(jsonData[0]);
    columns.forEach((col) => {
      const values = jsonData.map((row) => row[col]).filter((val) => val !== '' && val !== null && val !== undefined);
      const types = [...new Set(values.map((val) => typeof val))];
      console.log(`  - ${col}: ${types.join(', ')} (${values.length} valores no vacíos)`);
    });
  }
});
