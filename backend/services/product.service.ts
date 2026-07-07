import Product from '../models/Product';
import ProductPresentation from '../models/ProductPresentation';
import Barcode from '../models/Barcode';

// ─── exportProductsCSV ────────────────────────────────────────────────────────

export async function exportProductsCSV(): Promise<string> {
  const products = await Product.findAll({
    where: { is_active: true },
    include: [
      { model: ProductPresentation, as: 'presentations', where: { is_default: true }, required: false },
      { model: Barcode, as: 'barcodes', where: { is_active: true }, required: false }
    ]
  }) as any[];

  let csv = 'ID Producto,SKU,Nombre,Descripcion,Tamano Unidad,Medida Unidad,ID Presentación,Unidades por Paquete,Unidades por Presentación,Costo Paquete,Costo Unitario,Moneda,ID Barcode,Codigo de Barras\n';

  products.forEach((product: any) => {
    const defaultPresentation = product.presentations && product.presentations[0] ? product.presentations[0] : {};
    const barcodes = product.barcodes || [];
    const barcodeIds = barcodes.map((b: any) => b.id).join('; ');
    const barcodeStrings = barcodes.map((b: any) => b.barcode).join('; ');

    const row = [
      product.id, `"${product.sku}"`, `"${product.name}"`,
      `"${(product.description || '').replace(/"/g, '""')}"`,
      product.unit_size, `"${product.unit_size_measure || ''}"`,
      defaultPresentation.id || '', defaultPresentation.units_per_package || '',
      defaultPresentation.units_per_presentation || '', defaultPresentation.package_cost || '',
      defaultPresentation.cost || '', defaultPresentation.purchase_currency || '',
      `"${barcodeIds}"`, `"${barcodeStrings}"`
    ];
    csv += row.join(',') + '\n';
  });

  return '\uFEFF' + csv;
}
