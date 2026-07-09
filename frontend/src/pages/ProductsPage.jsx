import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Plus, MagnifyingGlass, Funnel, X, FileText } from '@phosphor-icons/react';
import { Button, Alert, Modal, ConfirmDialog, useTableLimit } from '../components/ui';
import { presentationService } from '../services/api/presentationService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import ProductTable from '../components/products/ProductTable';
import ProductForm from '../components/products/ProductForm';
import ProductViewSheet from '../components/products/ProductViewSheet';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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
  const { token, hasPermission } = useAuth();
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
  const [editingProduct, setEditingProduct] = useState(null);
  const [showViewSheet, setShowViewSheet] = useState(false);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form state
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [presentations, setPresentations] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Barcode scanner state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scannerError, setScannerError] = useState(null);
  const [barcodeError, setBarcodeError] = useState(null);

  // ─── Queries ─────────────────────────────────────────────────────────────────

  const { data: productsData = {}, isLoading: loading } = useQuery({
    queryKey: ['products', currentPage, debouncedSearch, categoryFilter, limit],
    queryFn: async () => {
      const response = await fetch(
        `${API_URL}/products?page=${currentPage}&search=${debouncedSearch}&category_id=${categoryFilter}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Error al cargar productos');
      const data = await response.json();
      return {
        products: data.data || [],
        totalPages: data.pagination?.totalPages || 1,
        total: data.pagination?.total || 0,
      };
    },
  });

  const products = productsData.products || [];
  const totalPages = productsData.totalPages || 1;
  const totalCount = productsData.total || 0;

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error al cargar categorías');
      const data = await res.json();
      return data.data || [];
    },
    staleTime: Infinity,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/brands?is_active=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error al cargar marcas');
      const data = await res.json();
      return data.data || [];
    },
    staleTime: Infinity,
  });

  const { data: packagingTypes = [] } = useQuery({
    queryKey: ['packaging-types'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/packaging-types/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error al cargar tipos de empaque');
      const data = await res.json();
      return data.data || [];
    },
    staleTime: Infinity,
  });

  const { data: presentationTypes = [] } = useQuery({
    queryKey: ['presentation-types'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/presentation-types/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error al cargar tipos de presentación');
      const data = await res.json();
      return data.data || [];
    },
    staleTime: Infinity,
  });

  const { data: ratesData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => exchangeRateService.getLatest(),
    staleTime: Infinity,
  });
  const exchangeRates = ratesData?.data || [];

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

  const getEffectiveRate = (from, to) => {
    if (!Array.isArray(exchangeRates) || exchangeRates.length === 0 || from === to) return 1;
    const direct = exchangeRates.find((r) => r.from_currency === from && r.to_currency === to);
    if (direct) return parseFloat(direct.rate);
    const inverse = exchangeRates.find((r) => r.from_currency === to && r.to_currency === from);
    if (inverse) return 1 / parseFloat(inverse.rate);
    const bridge = 'VES';
    if (from !== bridge && to !== bridge) {
      const r1 = getEffectiveRate(from, bridge);
      const r2 = getEffectiveRate(bridge, to);
      if (r1 !== 1 && r2 !== 1) return r1 * r2;
    }
    return 1;
  };

  const calculateStockAndValue = (product) => {
    const totalUnits = (product.inventories || []).reduce(
      (sum, inv) => sum + parseFloat(inv.quantity || 0),
      0
    );
    const pkgPresentation =
      (product.presentations || []).find((p) => p.is_active && p.units_per_package > 1) ||
      (product.presentations || []).find((p) => p.is_active) ||
      { units_per_package: 1, cost: 0, purchase_currency: 'USD' };

    const unitsPerPackage = pkgPresentation.units_per_package || 1;
    const bultos = Math.floor(totalUnits / unitsPerPackage);
    const unidades = Math.round((totalUnits % unitsPerPackage) * 100) / 100;

    const costPerUnitOriginal = parseFloat(pkgPresentation.cost || 0);
    const originalCurrency = pkgPresentation.purchase_currency || 'USD';
    const costPerUnitCOP =
      originalCurrency !== 'COP'
        ? costPerUnitOriginal * getEffectiveRate(originalCurrency, 'COP')
        : costPerUnitOriginal;

    return { bultos, unidades, totalValueCOP: totalUnits * costPerUnitCOP, unitsPerPackage };
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'barcode' && barcodeError) setBarcodeError(null);
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleBarcodeDetected = async (barcode) => {
    if (!barcode) return;
    try {
      const res = await fetch(`${API_URL}/products?barcode=${encodeURIComponent(barcode)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.id !== editingProduct?.id) {
          setBarcodeError(`El código de barras ya existe en el producto: ${data.data.name}`);
          setShowBarcodeScanner(false);
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          return;
        }
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

  const handleSubmit = async (e) => {
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
          (p) => !p.units_per_package || p.units_per_package <= 0
        );
        if (invalidQty) {
          setError(
            `La presentación "${invalidQty.name || 'sin nombre'}" debe tener una cantidad de unidades mayor a 0`
          );
          setSubmitting(false);
          return;
        }
        const missingType = presentations.find((p) => !p.presentation_type_id);
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
        const checkRes = await fetch(
          `${API_URL}/products?barcode=${encodeURIComponent(formData.barcode)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.data && checkData.data.id !== editingProduct?.id) {
            setBarcodeError(`El código de barras ya existe en el producto: ${checkData.data.name}`);
            setSubmitting(false);
            return;
          }
        }
      }

      const url = editingProduct
        ? `${API_URL}/products/${editingProduct.id}`
        : `${API_URL}/products`;

      const submitData = new FormData();
      Object.keys(formData).forEach((key) => {
        if (key === 'description' || (formData[key] !== null && formData[key] !== '')) {
          submitData.append(key, formData[key]);
        }
      });
      if (!editingProduct) {
        submitData.append('presentations', JSON.stringify(presentations));
      }
      if (imagePreview) {
        submitData.append('image_url', imagePreview);
      }

      const res = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: submitData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Error al guardar producto');
      }

      if (editingProduct) {
        await savePresentations(editingProduct.id);
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      handleCloseModal();
      toast.success(editingProduct ? 'Producto actualizado' : 'Producto creado');
    } catch (err) {
      setError(err.message || 'Error al guardar el producto');
    } finally {
      setSubmitting(false);
    }
  };

  const savePresentations = async (productId) => {
    const existingIds = (editingProduct?.presentations || []).map((p) => p.id);
    const currentIds = presentations.filter((p) => p.id).map((p) => p.id);

    // Delete removed presentations
    for (const id of existingIds.filter((id) => !currentIds.includes(id))) {
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

  const handleView = (product) => {
    setViewingProduct(product);
    setShowViewSheet(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      category_id: product.category_id || '',
      barcode: product.barcodes?.[0]?.barcode || '',
      brand_id: product.brand_id ? String(product.brand_id) : '',
      unit_size: product.unit_size || '',
      unit_size_measure: product.unit_size_measure || 'UND',
      is_perishable: product.is_perishable || false,
      has_batch_control: product.has_batch_control || false,
      min_stock: parseInt(product.min_stock) || 0,
      max_stock: parseInt(product.max_stock) || 0,
      reorder_point: parseInt(product.reorder_point) || 0,
      is_active: product.is_active !== undefined ? product.is_active : true,
    });
    setPresentations(product.presentations || []);
    if (product.image_url) setImagePreview(product.image_url);
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
    mutationFn: (id) =>
      fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.message || 'Error al eliminar producto'); });
        return r.json();
      }),
    onSuccess: () => {
      toast.success('Producto eliminado');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast.error(err.message || 'Error al eliminar producto'),
  });

  const handleDelete = (id) => setDeleteTarget(id);

  const confirmDelete = () => {
    deleteMutation.mutate(deleteTarget);
    setDeleteTarget(null);
  };

  const handleDownloadCSV = async () => {
    try {
      const res = await fetch(`${API_URL}/products?format=csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error al exportar productos');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productos_activos_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Lista de productos exportada');
    } catch (err) {
      toast.error(err.message || 'No se pudo descargar la lista de productos');
    }
  };

  const activeCategoryName = categories.find(
    (c) => String(c.id) === String(categoryFilter)
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
          <Button variant="secondary" onClick={handleDownloadCSV} title="Exportar a CSV">
            <FileText className="h-4 w-4 text-red-600" />
            CSV
          </Button>
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
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Nombre, SKU o código de barras..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="input pl-10"
            />
          </div>

          <div className="relative">
            <Funnel className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input pl-10"
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setSearch('');
                setCategoryFilter('');
                setCurrentPage(1);
              }}
            >
              Limpiar Filtros
            </Button>
          </div>
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
                className="hover:text-primary-900 ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Products Table */}
      <ProductTable
        products={products}
        loading={loading}
        calculateStockAndValue={calculateStockAndValue}
        hasPermission={hasPermission}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        currentPage={currentPage}
        totalPages={totalPages}
        total={totalCount}
        limit={limit}
        onPageChange={setCurrentPage}
        onLimitChange={(newLimit) => { setLimit(newLimit); setCurrentPage(1); }}
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
            presentations={presentations}
            onPresentationsChange={setPresentations}
            imagePreview={imagePreview}
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
            editingProduct={editingProduct}
            error={error}
          />
        </form>
      </Modal>

      {/* Product View Sheet */}
      <ProductViewSheet
        open={showViewSheet}
        onClose={() => setShowViewSheet(false)}
        product={viewingProduct}
        hasPermission={hasPermission}
        onEdit={() => {
          setShowViewSheet(false);
          handleEdit(viewingProduct);
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
