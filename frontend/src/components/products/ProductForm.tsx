import React from 'react';
import { Camera, X, WarningCircle } from '@phosphor-icons/react';
import { Alert } from '../ui';
import ImageUpload from '../common/ImageUpload';
import PresentationManager from './PresentationManager';
import { BarcodeScannerComponent } from '../BarcodeScanner';
import type { Presentation } from './PresentationManager';

interface Category {
  id: number;
  name: string;
}

interface Brand {
  id: number;
  name: string;
}

interface PackagingType {
  id: number;
  name: string;
}

interface PresentationType {
  id: number;
  name: string;
}

interface ProductFormData {
  name: string;
  description: string;
  category_id: string | number;
  barcode: string | null;
  brand_id: string | number;
  unit_size: string | number;
  unit_size_measure: string;
  min_stock: string | number;
  max_stock: string | number;
  reorder_point: string | number;
  is_perishable: boolean;
  has_batch_control: boolean;
  is_active: boolean;
}

interface ProductFormProps {
  formData: ProductFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  presentations: Presentation[];
  onPresentationsChange: (presentations: Presentation[]) => void;
  imagePreview: string | null;
  onImageChange: (file: File | null) => void;
  showBarcodeScanner: boolean;
  onToggleBarcodeScanner: (show: boolean) => void;
  scannerError: string | null;
  onScannerError: (error: string | null) => void;
  barcodeError: string | null;
  onBarcodeDetected: (code: string) => void;
  categories: Category[];
  brands: Brand[];
  packagingTypes: PackagingType[];
  presentationTypes: PresentationType[];
  error: string | null;
}

const ProductForm: React.FC<ProductFormProps> = ({
  formData,
  onChange,
  presentations,
  onPresentationsChange,
  imagePreview,
  onImageChange,
  showBarcodeScanner,
  onToggleBarcodeScanner,
  scannerError,
  onScannerError,
  barcodeError,
  onBarcodeDetected,
  categories,
  brands,
  packagingTypes,
  presentationTypes,
  error,
}) => {
  return (
    <div className="space-y-4">
      {error && (
        <Alert key={error} variant="error" title="Error al guardar">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Image + Scanner */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              Imagen del Producto
            </h3>
            <ImageUpload
              value={imagePreview}
              onChange={onImageChange}
              type="products"
              placeholder="Click para subir imagen"
              previewSize="w-full h-48"
            />
          </div>

          <button
            type="button"
            onClick={() => onToggleBarcodeScanner(!showBarcodeScanner)}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Camera className="w-5 h-5" />
            Escanear código de barras
          </button>
        </div>

        {/* Right Column — Form Fields */}
        <div className="lg:col-span-2 space-y-4">
          {/* Barcode Scanner */}
          {showBarcodeScanner && (
            <div className="bg-gray-50 rounded-lg p-4 border-2 border-primary-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary-600" />
                  Escanear Código de Barras
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    onToggleBarcodeScanner(false);
                    onScannerError(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-black rounded-lg overflow-hidden h-72">
                {scannerError ? (
                  <div className="flex items-center justify-center h-full p-6 text-center">
                    <div>
                      <WarningCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                      <p className="text-white mb-2">Error al acceder a la cámara</p>
                      <p className="text-gray-400 text-sm mb-4">{scannerError}</p>
                      <button
                        type="button"
                        onClick={() => onToggleBarcodeScanner(false)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                ) : (
                  <BarcodeScannerComponent
                    onDetected={onBarcodeDetected}
                    onError={onScannerError}
                  />
                )}
              </div>
              <p className="text-sm text-gray-600 mt-3 text-center">
                Apunta la cámara al código de barras del producto
              </p>
            </div>
          )}

          {/* Basic Info */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Información Básica</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={onChange}
                  required
                  minLength={2}
                  className="input"
                  placeholder="Ej: Aceite de Soya 1L"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={onChange}
                  rows="2"
                  className="input"
                  placeholder="Descripción detallada del producto..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={onChange}
                  className="input"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de barras
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode || ''}
                    onChange={onChange}
                    className={`input flex-1 ${barcodeError ? 'border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="Ej: 7730969301421"
                  />
                  <button
                    type="button"
                    onClick={() => onToggleBarcodeScanner(!showBarcodeScanner)}
                    className="lg:hidden px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-1 text-sm"
                  >
                    <Camera className="w-4 h-4" />
                    Escanear
                  </button>
                </div>
                {barcodeError && (
                  <Alert key={barcodeError} variant="error" title="Código de barras duplicado" className="mt-2">
                    {barcodeError}
                  </Alert>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                <select
                  name="brand_id"
                  value={formData.brand_id}
                  onChange={onChange}
                  className="input"
                >
                  <option value="">Sin marca</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={String(brand.id)}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tamaño de Unidad Individual *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="unit_size"
                    min="0.1"
                    step="0.1"
                    value={formData.unit_size || ''}
                    onChange={onChange}
                    className="input flex-1"
                    placeholder="Ej: 500"
                    required
                  />
                  <select
                    name="unit_size_measure"
                    value={formData.unit_size_measure}
                    onChange={onChange}
                    className="input w-24"
                    required
                  >
                    <option value="UND">UND</option>
                    <option value="LT">LT</option>
                    <option value="ML">ML</option>
                    <option value="KG">KG</option>
                    <option value="GR">GR</option>
                    <option value="OZ">OZ</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Tamaño de cada unidad individual (ej: 500 ML)
                </p>
              </div>
            </div>
          </div>

          {/* Presentations */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Presentaciones del Producto
            </h3>
            <PresentationManager
              presentations={presentations}
              onChange={onPresentationsChange}
              packagingTypes={packagingTypes}
              presentationTypes={presentationTypes}
              productUnitSize={formData.unit_size}
              productUnitMeasure={formData.unit_size_measure}
            />
          </div>

          {/* Stock Settings */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Configuración de Stock</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Mínimo
                </label>
                <input
                  type="number"
                  name="min_stock"
                  value={formData.min_stock}
                  onChange={onChange}
                  min="0"
                  step="1"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Máximo
                </label>
                <input
                  type="number"
                  name="max_stock"
                  value={formData.max_stock}
                  onChange={onChange}
                  min="0"
                  step="1"
                  className="input"
                />
                {Number(formData.max_stock) > 0 &&
                  Number(formData.min_stock) > 0 &&
                  Number(formData.max_stock) < Number(formData.min_stock) && (
                    <p className="text-xs text-red-600 mt-1">
                      El máximo no puede ser menor al mínimo
                    </p>
                  )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Punto de Reorden
                </label>
                <input
                  type="number"
                  name="reorder_point"
                  value={formData.reorder_point}
                  onChange={onChange}
                  min="0"
                  step="1"
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Additional Settings */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Configuración Adicional</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_perishable"
                  checked={formData.is_perishable}
                  onChange={onChange}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Producto Perecedero</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="has_batch_control"
                  checked={formData.has_batch_control}
                  onChange={onChange}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Control por Lote</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={onChange}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Producto Activo</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductForm;
