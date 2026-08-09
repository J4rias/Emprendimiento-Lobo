import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Plus, X } from '@phosphor-icons/react';
import {
  Button, Alert, Card, Modal, ConfirmDialog, ExportCsvAction,
  SearchInput, Select, useTableLimit,
} from '../components/ui';
import { productService } from '../services/api/productService';
import { categoryService } from '../services/api/categoryService';
import { brandService } from '../services/api/brandService';
import { packagingTypeService } from '../services/api/packagingTypeService';
import { presentationTypeService } from '../services/api/presentationTypeService';
import { presentationService } from '../services/api/presentationService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import ProductTable from '../components/products/ProductTable';
import ProductForm from '../components/products/ProductForm';
import ProductViewSheet from '../components/products/ProductViewSheet';
import type { Product, Category, Brand, ExchangeRate, ProductPresentation } from '../types';

interface PresentationFormData {
  id?: number;
  isNew?: boolean;
  name: string;
  packaging_type_id?: string | number | null;
  presentation_type_id?: string | number | null;
  units_per_package: number;
  package_price?: number;
  package_cost?: number;
  purchase_currency?: string;
  is_default?: boolean;
  is_active?: boolean;
  cost?: number;
}

interface ExtendedProduct extends Product {
  unit_size?: string | number;
  unit_size_measure?: string;
  is_perishable?: boolean;
  has_batch_control?: boolean;
  min_stock?: number;
  max_stock?: number;
  reorder_point?: number;
  image_url?: string;
  presentations?: (ProductPresentation & PresentationFormData)[];
}

interface PackagingType {
  id: number;
  name: string;
  [key: string]: unknown;
}

interface PresentationType {
  id: number;
  name: string;
  [key: string]: unknown;
}

interface StockAndValue {
  bultos: number;
  unidades: number;
  totalValueCOP: number;
  unitsPerPackage: number;
}

type ProductDetail = ExtendedProduct;

const EMPTY_FORM = {
  name: '',
  description: '',
  category_id: '',
  barcode: '',
  brand_id: '',
  unit_size: '',
  unit_size_measure: 'UND',
  is_perishable: false,
  has_batch_control: false,
  min_stock: 0,
  max_stock: 0,
  reorder_point: 0,
  is_active: true,
};

const ProductsPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // List / filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useTableLimit();

  // Modal / sheet state
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ExtendedProduct | null>(null);
  const [showViewSheet, setShowViewSheet] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<ProductDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [presentations, setPresentations] = useState<PresentationFormData[]>([]);
  const [imagePreview, setImagePreview] = useState<string | File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Barcode scanner state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  // ─── Queries ─────────────────────────────────────────────────────────────────

  interface ProductsQueryData {
    products: Product[];
    totalPages: number;
    total: number;
  }

  const { data: productsData = {} as ProductsQueryData, isLoading: loading } = useQuery<ProductsQueryData>({
    queryKey: ['products', currentPage, debouncedSearch, categoryFilter, limit],
    queryFn: async () => {
      const data = await productService.getAll({
        page: currentPage,
        search: debouncedSearch,
        category_id: categoryFilter,
        limit,
      });
      return {
        products: data.data || [],
        totalPages: data.pagination?.totalPages || 1,
        total: data.pagination?.total || 0,
      };
    },
  });

  const products = productsData?.products || [];
  const totalPages = productsData?.totalPages || 1;
  const totalCount = productsData?.total || 0;

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      // Sin limit el backend pagina de a 50 y el desplegable quedaría truncado
      const data = await categoryService.getAll({ limit: 1000 });
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ['brands'],
    queryFn: async () => {
      const data = await brandService.getActive();
      return data.data || [];
    },
    staleTime: Infinity,
  });

  const { data: packagingTypes = [] } = useQuery<PackagingType[]>({
    queryKey: ['packaging-types'],
    queryFn: async () => {
      const data = await packagingTypeService.getActive();
      return (data.data || []) as unknown as PackagingType[];
    },
    staleTime: Infinity,
  });

  const { data: presentationTypes = [] } = useQuery<PresentationType[]>({
    queryKey: ['presentation-types'],
    queryFn: async () => {
      const data = await presentationTypeService.getActive();
      return (data.data || []) as unknown as PresentationType[];
    },
    staleTime: Infinity,
  });

  const { data: ratesData } = useQuery<{ data: ExchangeRate[] } | undefined>({
    queryKey: ['exchange-rates'],
    queryFn: () => exchangeRateService.getLatest(),
    staleTime: Infinity,
  });
  const exchangeRates: ExchangeRate[] = ratesData?.data || [];

  // ─── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      setShowModal(true);
      setEditingProduct(null);
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  // ─── Business logic ───────────────────────────────────────────────────────────

  const getEffectiveRate = (from: string, to: string): number => {
    if (!Array.isArray(exchangeRates) || exchangeRates.length === 0 || from === to) return 1;
    const direct = exchangeRates.find((r) => r.from_currency === from && r.to_currency === to);
    if (direct) return parseFloat(String(direct.rate));
    const inverse = exchangeRates.find((r) => r.from_currency === to && r.to_currency === from);
    if (inverse) return 1 / parseFloat(String(inverse.rate));
    const bridge = 'VES';
    if (from !== bridge && to !== bridge) {
      const r1: number = getEffectiveRate(from, bridge);
      const r2: number = getEffectiveRate(bridge, to);
      if (r1 !== 1 && r2 !== 1) return r1 * r2;
    }
    return 1;
  };

  const calculateStockAndValue = (product: ExtendedProduct): StockAndValue => {
    const totalUnits = (product.inventories || []).reduce(
      (sum: number, inv: Record<string, unknown>) => sum + parseFloat(String(inv.quantity || 0)),
      0
    );
    const pkgPresentation: PresentationFormData =
      ((product.presentations || []) as (ProductPresentation & PresentationFormData)[]).find((p: PresentationFormData) => p.is_active && p.units_per_package > 1) ||
      ((product.presentations || []) as (ProductPresentation & PresentationFormData)[]).find((p: PresentationFormData) => p.is_active) ||
      { units_per_package: 1, cost: 0, purchase_currency: 'USD' } as PresentationFormData;

    const unitsPerPackage = pkgPresentation.units_per_package || 1;
    const bultos = Math.floor(totalUnits / unitsPerPackage);
    const unidades = Math.round((totalUnits % unitsPerPackage) * 100) / 100;

    const costPerUnitOriginal = parseFloat(String(pkgPresentation.cost || 0));
    const originalCurrency = pkgPresentation.purchase_currency || 'USD';
    const costPerUnitCOP =
      originalCurrency !== 'COP'
        ? costPerUnitOriginal * getEffectiveRate(originalCurrency, 'COP')
        : costPerUnitOriginal;

    return { bultos, unidades, totalValueCOP: totalUnits * costPerUnitCOP, unitsPerPackage };
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    if (name === 'barcode' && barcodeError) setBarcodeError(null);
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleBarcodeDetected = async (barcode: string) => {
    if (!barcode) return;
    try {
      const data = await productService.searchByBarcode(barcode);
      if (data.data && data.data.id !== editingProduct?.id) {
        setBarcodeError(`El código de barras ya existe en el producto: ${data.data.name}`);
        setShowBarcodeScanner(false);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        return;
      }
      setFormData((prev) => ({ ...prev, barcode }));
      setShowBarcodeScanner(false);
      setScannerError(null);
      setBarcodeError(null);
      if (navigator.vibrate) navigator.vibrate(100);
    } catch {
      setFormData((prev) => ({ ...prev, barcode }));
      setShowBarcodeScanner(false);
      setScannerError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setBarcodeError(null);

    try {
      // Validate required fields
      if (!formData.name?.trim()) {
        setError('El nombre del producto es requerido');
        setSubmitting(false);
        return;
      }
      if (formData.name.trim().length < 2) {
        setError('El nombre debe tener al menos 2 caracteres');
        setSubmitting(false);
        return;
      }
      if (!formData.unit_size || Number(formData.unit_size) <= 0) {
        setError('El tamaño de unidad debe ser mayor a 0');
        setSubmitting(false);
        return;
      }

      // Validate presentations
      if (presentations.length > 0) {
        const invalidQty = presentations.find(
          (p: PresentationFormData) => !p.units_per_package || p.units_per_package <= 0
        );
        if (invalidQty) {
          setError(
            `La presentación "${invalidQty.name || 'sin nombre'}" debe tener una cantidad de unidades mayor a 0`
          );
          setSubmitting(false);
          return;
        }
        const missingType = presentations.find((p: PresentationFormData) => !p.presentation_type_id);
        if (missingType) {
          setError(
            `La presentación "${missingType.name || 'sin nombre'}" debe tener un tipo de unidad seleccionado`
          );
          setSubmitting(false);
          return;
        }
      }

      // Validate stock range
      const minStock = Number(formData.min_stock);
      const maxStock = Number(formData.max_stock);
      if (maxStock > 0 && minStock > 0 && maxStock < minStock) {
        setError('El stock máximo no puede ser menor al stock mínimo');
        setSubmitting(false);
        return;
      }

      // Validate barcode uniqueness
      if (formData.barcode) {
        try {
          const checkData = await productService.searchByBarcode(formData.barcode);
          if (checkData.data && checkData.data.id !== editingProduct?.id) {
            setBarcodeError(`El código de barras ya existe en el producto: ${checkData.data.name}`);
            setSubmitting(false);
            return;
          }
        } catch {
          // No existing product with this barcode — continue
        }
      }

      const submitData = new FormData();
      Object.keys(formData).forEach((key) => {
        const formKey = key as keyof typeof formData;
        if (key === 'description' || (formData[formKey] !== null && formData[formKey] !== '')) {
          submitData.append(key, String(formData[formKey]));
        }
      });
      if (!editingProduct) {
        submitData.append('presentations', JSON.stringify(presentations));
      }
      if (imagePreview) {
        submitData.append('image_url', imagePreview);
      }

      if (editingProduct) {
        await productService.update(editingProduct.id, submitData);
      } else {
        await productService.create(submitData);
      }

      if (editingProduct) {
        await savePresentations(editingProduct.id);
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      handleCloseModal();
      toast.success(editingProduct ? 'Producto actualizado' : 'Producto creado');
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || 'Error al guardar el producto');
    } finally {
      setSubmitting(false);
    }
  };

  const savePresentations = async (productId: number) => {
    const existingIds = (editingProduct?.presentations || []).map((p: PresentationFormData) => p.id).filter((id): id is number => typeof id === 'number');
    const currentIds = presentations.filter((p: PresentationFormData) => p.id).map((p: PresentationFormData) => p.id).filter((id): id is number => typeof id === 'number');

    // Delete removed presentations
    for (const id of existingIds.filter((id: number) => !currentIds.includes(id))) {
      await presentationService.delete(id);
    }

    // Create or update remaining
    for (const pres of presentations) {
      const payload = {
        name: pres.name,
        packaging_type_id: pres.packaging_type_id || null,
        presentation_type_id: pres.presentation_type_id || null,
        units_per_package: pres.units_per_package,
        package_price: pres.package_price || 0,
        package_cost: pres.package_cost || 0,
        purchase_currency: pres.purchase_currency || 'USD',
        is_default: pres.is_default || false,
        is_active: pres.is_active !== undefined ? pres.is_active : true,
      };
      if (pres.isNew || !pres.id) {
        await presentationService.create(productId, payload);
      } else {
        await presentationService.update(pres.id, payload);
        if (pres.is_default) await presentationService.setDefault(pres.id);
      }
    }
  };

  const handleView = (product: ExtendedProduct) => {
    setViewingProduct(product);
    setShowViewSheet(true);
  };

  const handleEdit = (product: ExtendedProduct) => {
    const extProduct = product;
    setEditingProduct(extProduct);
    setFormData({
      name: extProduct.name || '',
      description: extProduct.description || '',
      category_id: String(extProduct.category_id || ''),
      barcode: extProduct.barcodes?.[0]?.barcode || '',
      brand_id: extProduct.brand_id ? String(extProduct.brand_id) : '',
      unit_size: String(extProduct.unit_size || ''),
      unit_size_measure: extProduct.unit_size_measure || 'UND',
      is_perishable: extProduct.is_perishable || false,
      has_batch_control: extProduct.has_batch_control || false,
      min_stock: parseInt(String(extProduct.min_stock)) || 0,
      max_stock: parseInt(String(extProduct.max_stock)) || 0,
      reorder_point: parseInt(String(extProduct.reorder_point)) || 0,
      is_active: extProduct.is_active !== undefined ? extProduct.is_active : true,
    });
    setPresentations((extProduct.presentations || []) as unknown as PresentationFormData[]);
    if (extProduct.image_url) setImagePreview(extProduct.image_url);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setPresentations([]);
    setImagePreview(null);
    setError(null);
    setBarcodeError(null);
    setShowBarcodeScanner(false);
    setScannerError(null);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productService.delete(id),
    onSuccess: () => {
      toast.success('Producto eliminado');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(errorObj?.response?.data?.message || errorObj?.message || 'Error al eliminar producto');
    },
  });

  const handleDelete = (id: number) => setDeleteTarget(id);

  const confirmDelete = () => {
    if (deleteTarget !== null) {
      deleteMutation.mutate(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const blob = await productService.exportCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productos_activos_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Lista de productos exportada');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(errorObj?.response?.data?.message || errorObj?.message || 'No se pudo descargar la lista de productos');
    }
  };

  const activeCategoryName = categories.find(
    (c: Category) => String(c.id) === String(categoryFilter)
  )?.name;

  // ─── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600">Gestión de productos del inventario</p>
        </div>
        <div className="flex gap-2">
          <ExportCsvAction onClick={handleDownloadCSV} title="Exportar CSV" />
          {hasPermission('products.create') && (
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4" />
              Nuevo Producto
            </Button>
          )}
        </div>
      </div>

      {/* Page-level error (only when modal is closed) */}
      {error && !showModal && (
        <Alert key={error} variant="error" title="Error" dismissible>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card variant="flat">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              placeholder="Nombre, SKU o código de barras..."
              value={search}
              onChange={(v: string) => { setSearch(v); setCurrentPage(1); }}
            />
          </div>
          <div className="w-52">
            <Select
              value={categoryFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat: Category) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </Select>
          </div>
          <Button variant="secondary" onClick={() => { setSearch(''); setCategoryFilter(''); setCurrentPage(1); }}>
            Limpiar
          </Button>
        </div>

        {/* Active filter chip */}
        {categoryFilter && activeCategoryName && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Filtro activo:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
              {activeCategoryName}
              <button
                type="button"
                onClick={() => { setCategoryFilter(''); setCurrentPage(1); }}
                className="rounded-full hover:bg-primary-200 hover:text-primary-900 ml-0.5 leading-none"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
      </Card>

      {/* Products Table */}
      <ProductTable
        products={products as any}
        loading={loading}
        calculateStockAndValue={calculateStockAndValue as any}
        hasPermission={hasPermission}
        onView={handleView as any}
        onEdit={handleEdit as any}
        onDelete={handleDelete}
        currentPage={currentPage}
        totalPages={totalPages}
        total={totalCount}
        limit={limit}
        onPageChange={setCurrentPage}
        onLimitChange={(newLimit: number) => { setLimit(newLimit); setCurrentPage(1); }}
      />

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
        size="full"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="product-form"
              loading={submitting}
              disabled={!!barcodeError}
            >
              {editingProduct ? 'Actualizar' : 'Crear Producto'}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSubmit}>
          <ProductForm
            formData={formData}
            onChange={handleChange}
            presentations={presentations as any}
            onPresentationsChange={setPresentations as any}
            imagePreview={imagePreview as string | null}
            onImageChange={setImagePreview}
            showBarcodeScanner={showBarcodeScanner}
            onToggleBarcodeScanner={setShowBarcodeScanner}
            scannerError={scannerError}
            onScannerError={setScannerError}
            barcodeError={barcodeError}
            onBarcodeDetected={handleBarcodeDetected}
            categories={categories}
            brands={brands}
            packagingTypes={packagingTypes}
            presentationTypes={presentationTypes}
            error={error}
          />
        </form>
      </Modal>

      {/* Product View Sheet */}
      <ProductViewSheet
        open={showViewSheet}
        onClose={() => setShowViewSheet(false)}
        product={viewingProduct as any}
        hasPermission={hasPermission}
        onEdit={() => {
          setShowViewSheet(false);
          if (viewingProduct) handleEdit(viewingProduct);
        }}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Eliminar producto"
        description="Esta acción no se puede deshacer. El producto y su historial serán eliminados."
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
};

export default ProductsPage;
