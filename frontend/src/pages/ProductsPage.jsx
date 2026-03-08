import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Filter,
  X,
  AlertCircle,
  Camera,
  Image as ImageIcon,
  HelpCircle,
  Eye,
  Calendar,
  Clock,
  Tag,
  DollarSign,
  Box,
  BarChart,
  Settings,
  Star,
  Download,
  FileText
} from 'lucide-react';
import { BarcodeScannerComponent } from '../components/BarcodeScanner';
import ImageUpload from '../components/common/ImageUpload';
import PresentationManager from '../components/products/PresentationManager';
import { presentationService } from '../services/api/presentationService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { formatMoney } from '../utils/formatUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const API_BASE_URL = API_URL.replace(/\/api$/, '');

const ProductsPage = () => {
  const { token, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [packagingTypes, setPackagingTypes] = useState([]);
  const [presentationTypes, setPresentationTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewMode, setViewMode] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scannerError, setScannerError] = useState(null);
  const [barcodeError, setBarcodeError] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [presentations, setPresentations] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);

  // Fetch exchange rates on load
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const data = await exchangeRateService.getLatest();
        setExchangeRates(data.data || []);
      } catch (err) {
        console.error('Error fetching rates:', err);
      }
    };
    fetchRates();
  }, []);

  const getEffectiveRate = (from, to) => {
    if (!exchangeRates || exchangeRates.length === 0 || from === to) return 1;

    // 1. Try Direct
    const direct = exchangeRates.find(r => r.from_currency === from && r.to_currency === to);
    if (direct) return parseFloat(direct.rate);

    // 2. Try Inverse
    const inverse = exchangeRates.find(r => r.from_currency === to && r.to_currency === from);
    if (inverse) return 1 / parseFloat(inverse.rate);

    // 3. Try 1-step bridge (e.g. from -> VES -> to)
    const bridgeCurrency = 'VES';
    if (from !== bridgeCurrency && to !== bridgeCurrency) {
      const rate1 = getEffectiveRate(from, bridgeCurrency);
      const rate2 = getEffectiveRate(bridgeCurrency, to);
      if (rate1 !== 1 && rate2 !== 1) {
        return rate1 * rate2;
      }
    }

    return 1;
  };

  const calculateStockAndValue = (product) => {
    const totalUnits = (product.inventories || []).reduce((sum, inv) => sum + parseFloat(inv.quantity || 0), 0);

    // Find package presentation (one with units_per_package > 1)
    const pkgPresentation = (product.presentations || []).find(p => p.is_active && p.units_per_package > 1)
      || (product.presentations || []).find(p => p.is_active)
      || { units_per_package: 1, cost: 0, purchase_currency: 'USD' };

    const unitsPerPackage = pkgPresentation.units_per_package || 1;
    const bultos = Math.floor(totalUnits / unitsPerPackage);
    const unidades = Math.round((totalUnits % unitsPerPackage) * 100) / 100;

    // Use cost per unit
    const costPerUnitOriginal = parseFloat(pkgPresentation.cost || 0);
    const originalCurrency = pkgPresentation.purchase_currency || 'USD';

    let costPerUnitCOP = costPerUnitOriginal;
    if (originalCurrency !== 'COP') {
      const rate = getEffectiveRate(originalCurrency, 'COP');
      costPerUnitCOP = costPerUnitOriginal * rate;
    }

    const totalValueCOP = totalUnits * costPerUnitCOP;

    return { bultos, unidades, totalValueCOP, unitsPerPackage };
  };
  const [formData, setFormData] = useState({
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
    is_active: true
  });

  // Debounce search to avoid losing focus
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBrands();
    fetchPackagingTypes();
    fetchPresentationTypes();
  }, [currentPage, debouncedSearch, categoryFilter]);

  // Check if action=new parameter is present
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      setShowModal(true);
      setEditingProduct(null);
      // Remove the action parameter from URL
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al cargar categorías');

      const data = await response.json();
      setCategories(data.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  // Auto-hide error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchBrands = async () => {
    try {
      const response = await fetch(`${API_URL}/brands/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al cargar marcas');

      const data = await response.json();
      setBrands(data.data || []);
    } catch (err) {
      console.error('Error fetching brands:', err);
    }
  };

  const fetchPackagingTypes = async () => {
    try {
      const response = await fetch(`${API_URL}/packaging-types/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al cargar tipos de empaque');

      const data = await response.json();
      setPackagingTypes(data.data || []);
    } catch (err) {
      console.error('Error fetching packaging types:', err);
    }
  };

  const fetchPresentationTypes = async () => {
    try {
      const response = await fetch(`${API_URL}/presentation-types/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al cargar tipos de presentación');

      const data = await response.json();
      setPresentationTypes(data.data || []);
    } catch (err) {
      console.error('Error fetching presentation types:', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(categoryFilter && { category_id: categoryFilter }),
      });

      const response = await fetch(`${API_URL}/products?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al cargar productos');

      const data = await response.json();
      setProducts(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setBarcodeError(null);

    try {
      // Validate presentations (optional but must be valid if present)
      if (presentations.length > 0) {
        const invalidPresentation = presentations.find(p => !p.units_per_package || p.units_per_package <= 0);
        if (invalidPresentation) {
          setError(`La presentación "${invalidPresentation.name || 'sin nombre'}" debe tener una cantidad de unidades mayor a 0`);
          setLoading(false);
          return;
        }

        const missingType = presentations.find(p => !p.presentation_type_id);
        if (missingType) {
          setError(`La presentación "${missingType.name || 'sin nombre'}" debe tener un tipo de unidad seleccionado (Ej: Botella, Bolsa, etc.)`);
          setLoading(false);
          return;
        }
      }

      // Validate barcode if provided
      if (formData.barcode) {
        const checkResponse = await fetch(`${API_URL}/products/barcode/${encodeURIComponent(formData.barcode)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();

          // If barcode exists and it's not the current product being edited
          if (checkData.data && checkData.data.id !== editingProduct?.id) {
            setBarcodeError(`El código de barras ya existe en el producto: ${checkData.data.name}`);
            setLoading(false);
            return;
          }
        }
      }

      const url = editingProduct
        ? `${API_URL}/products/${editingProduct.id}`
        : `${API_URL}/products`;

      const method = editingProduct ? 'PUT' : 'POST';

      const submitData = new FormData();

      // Append all form fields
      Object.keys(formData).forEach(key => {
        // Always include description even if empty, for other fields check if not empty
        if (key === 'description' || (formData[key] !== null && formData[key] !== '')) {
          submitData.append(key, formData[key]);
        }
      });

      // If creating a new product, include all presentations in the request
      if (!editingProduct) {
        submitData.append('presentations', JSON.stringify(presentations));
      }

      // ImageUpload component already uploads the image and returns URL in imagePreview
      // If imagePreview is a full URL (new upload), include it
      if (imagePreview) {
        submitData.append('image_url', imagePreview);
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: submitData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        // If it's a validation error with details, show them nicely
        const errorMsg = errorData.message || 'Error al guardar producto';
        throw new Error(errorMsg);
      }

      const result = await response.json();

      // For updates, we still use the separate savePresentations logic for now
      // to avoid refactoring the entire update flow (which handles deletions/updates separately)
      if (editingProduct) {
        await savePresentations(editingProduct.id);
      }

      await fetchProducts();
      handleCloseModal();
      toast.success(editingProduct ? 'Producto actualizado' : 'Producto creado');
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      // Ensure we extract the error message correctly
      const errorMessage = err.message || 'Error al guardar el producto';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const savePresentations = async (productId) => {
    try {
      // Get existing presentations for the product
      const existingPresentations = editingProduct?.presentations || [];
      const existingIds = existingPresentations.map(p => p.id);
      const currentIds = presentations.filter(p => p.id).map(p => p.id);

      // Delete presentations that were removed
      const toDelete = existingIds.filter(id => !currentIds.includes(id));
      for (const id of toDelete) {
        await presentationService.delete(id);
      }

      // Create or update presentations
      for (const presentation of presentations) {
        if (presentation.isNew || !presentation.id) {
          // Create new presentation
          await presentationService.create(productId, {
            name: presentation.name,
            packaging_type_id: presentation.packaging_type_id || null,
            presentation_type_id: presentation.presentation_type_id || null,
            units_per_package: presentation.units_per_package,
            package_price: presentation.package_price || 0,
            package_cost: presentation.package_cost || 0,
            purchase_currency: presentation.purchase_currency || 'USD',
            is_default: presentation.is_default || false,
            is_active: presentation.is_active !== undefined ? presentation.is_active : true
          });
        } else {
          // Update existing presentation
          await presentationService.update(presentation.id, {
            name: presentation.name,
            packaging_type_id: presentation.packaging_type_id || null,
            presentation_type_id: presentation.presentation_type_id || null,
            units_per_package: presentation.units_per_package,
            package_price: presentation.package_price || 0,
            package_cost: presentation.package_cost || 0,
            purchase_currency: presentation.purchase_currency || 'USD',
            is_active: presentation.is_active !== undefined ? presentation.is_active : true
          });

          // Set as default if needed
          if (presentation.is_default) {
            await presentationService.setDefault(presentation.id);
          }
        }
      }
    } catch (error) {
      // Re-throw the original error to be handled by handleSubmit
      throw error;
    }
  };

  const handleView = (product) => {
    setViewingProduct(product);
    setShowViewModal(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setViewMode(false);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      category_id: product.category_id || '',
      barcode: product.barcodes?.[0]?.barcode || '',
      brand_id: product.brand_id || '',
      unit_size: product.unit_size || '',
      unit_size_measure: product.unit_size_measure || 'UND',
      is_perishable: product.is_perishable || false,
      has_batch_control: product.has_batch_control || false,
      min_stock: parseInt(product.min_stock) || 0,
      max_stock: parseInt(product.max_stock) || 0,
      reorder_point: parseInt(product.reorder_point) || 0,
      is_active: product.is_active !== undefined ? product.is_active : true
    });
    // Set presentations from product
    setPresentations(product.presentations || []);
    // Set image preview if product has an image
    if (product.image_url) {
      setImagePreview(product.image_url);
    }
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar este producto?')) return;

    try {
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar producto');
      }

      await fetchProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setViewMode(false);
    setFormData({
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
      is_active: true
    });
    setPresentations([]);
    setImagePreview(null);
    setError(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Clear barcode error when user modifies the barcode field
    if (name === 'barcode' && barcodeError) {
      setBarcodeError(null);
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleBarcodeDetected = async (barcode) => {
    if (barcode) {
      try {
        // Check if barcode already exists using the barcode endpoint
        const response = await fetch(`${API_URL}/products/barcode/${encodeURIComponent(barcode)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();

          // If barcode exists (data is not null) and it's not the current product being edited
          if (data.data && data.data.id !== editingProduct?.id) {
            setBarcodeError(`El código de barras ya existe en el producto: ${data.data.name}`);
            setShowBarcodeScanner(false);
            // Vibrate error pattern
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
            return;
          }
          // If data.data is null, barcode doesn't exist - continue to set it
        } else {
          // Other errors, log but continue
          console.warn('Unexpected response checking barcode:', response.status);
        }

        // Save scanned code as barcode (SKU is auto-generated by backend)
        setFormData(prev => ({
          ...prev,
          barcode: barcode
        }));
        setShowBarcodeScanner(false);
        setScannerError(null);
        setBarcodeError(null);
        // Vibrate on success
        if (navigator.vibrate) {
          navigator.vibrate(100);
        }
      } catch (err) {
        // Network or other errors - still allow setting the barcode
        setFormData(prev => ({
          ...prev,
          barcode: barcode
        }));
        setShowBarcodeScanner(false);
        setScannerError(null);
      }
    }
  };

  const unitOptions = [
    { value: 'UND', label: 'Unidad' },
    { value: 'KG', label: 'Kilogramo' },
    { value: 'GR', label: 'Gramo' },
    { value: 'LT', label: 'Litro' },
    { value: 'ML', label: 'Mililitro' },
    { value: 'MT', label: 'Metro' },
    { value: 'CM', label: 'Centímetro' },
    { value: 'PACK', label: 'Paquete' },
    { value: 'CAJA', label: 'Caja' },
  ];

  const handleDownloadCSV = async () => {
    try {
      const response = await fetch(`${API_URL}/products/export-csv`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al exportar productos');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productos_activos_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Lista de productos exportada con éxito');
    } catch (err) {
      console.error('Error downloading CSV:', err);
      toast.error('No se pudo descargar la lista de productos');
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600">Gestión de productos del inventario</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadCSV}
            className="btn-secondary flex items-center gap-2"
            title="Exportar productos activos a CSV"
          >
            <FileText className="h-5 w-5 text-red-600" />
            <span>CSV</span>
          </button>
          {hasPermission('products.create') && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* Error Alert - Only show when modal is NOT open */}
      {error && !showModal && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="h-4 w-4 inline mr-1" />
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nombre, SKU o código de barras..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="h-4 w-4 inline mr-1" />
              Categoría
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              disabled={viewMode}
              className="input"
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch('');
                setCategoryFilter('');
                setCurrentPage(1);
              }}
              className="btn-secondary w-full"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="text-center">Stock Actual (Bultos / Unid)</th>
                <th>Estado</th>
                <th className="text-center">Actualizado</th>
                <th className="text-right">Valor Inventario (COP)</th>
                {(hasPermission('products.update') || hasPermission('products.delete')) && (
                  <th className="text-center">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                      <p className="mt-4 text-gray-500 text-sm">Buscando productos...</p>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    No se encontraron productos
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      {product.image_url ? (
                        <img
                          src={`${API_BASE_URL}${product.image_url}`}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded shadow-sm border border-gray-100"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-50 rounded flex items-center justify-center border border-gray-100">
                          <ImageIcon className="h-6 w-6 text-gray-300" />
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 leading-tight">{product.name}</span>
                        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter mt-0.5">{product.sku}</span>
                      </div>
                    </td>
                    <td>
                      {product.category ? (
                        <span
                          className="px-2 py-0.5 text-[10px] rounded-md text-white font-bold uppercase tracking-wider"
                          style={{ backgroundColor: product.category.color || '#6B7280' }}
                        >
                          {product.category.name}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] rounded-md bg-gray-100 text-gray-400 uppercase font-bold">
                          N/A
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      {(() => {
                        const { bultos, unidades, unitsPerPackage } = calculateStockAndValue(product);
                        return (
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-bold text-gray-800">
                              {bultos} <span className="text-[10px] text-gray-500 font-normal uppercase">Bultos</span>
                            </span>
                            {unitsPerPackage > 1 && (
                              <span className="text-[11px] text-gray-500 italic">
                                + {unidades} <span className="text-[9px] uppercase">Unid</span>
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      {product.is_active ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      {product.updated_at ? (
                        <div className="flex flex-col">
                          <span className="text-[11px] font-medium text-gray-700 capitalize">
                            {new Date(product.updated_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(product.updated_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="text-right">
                      {(() => {
                        const { totalValueCOP } = calculateStockAndValue(product);
                        return (
                          <span className="text-sm font-black text-slate-900">
                            {formatMoney(totalValueCOP, '$', 0)}
                            <span className="text-[10px] text-gray-400 ml-1 font-normal">COP</span>
                          </span>
                        );
                      })()}
                    </td>
                    {(hasPermission('products.update') || hasPermission('products.delete')) && (
                      <td className="text-center">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleView(product)}
                            className="text-gray-600 hover:text-gray-900 mr-3"
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {hasPermission('products.update') && product.is_active && (
                            <button
                              onClick={() => handleEdit(product)}
                              className="text-primary-600 hover:text-primary-900 mr-3"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {hasPermission('products.delete') && product.is_active && (
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={handleCloseModal}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Package className="h-6 w-6" />
                    {viewMode ? 'Ver Producto' : (editingProduct ? 'Editar Producto' : 'Nuevo Producto')}
                  </h3>
                  <button
                    onClick={handleCloseModal}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="bg-white px-6 py-6">
                {error && (
                  <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Error al guardar</p>
                      <p className="text-sm">{error}</p>
                    </div>
                    <button
                      onClick={() => setError(null)}
                      type="button"
                      className="ml-auto text-red-600 hover:text-red-800"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column - Image */}
                  <div className="lg:col-span-1 space-y-4">
                    {/* Product Image */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-blue-600" />
                        Imagen del Producto
                      </h3>
                      <ImageUpload
                        value={imagePreview}
                        onChange={setImagePreview}
                        type="products"
                        placeholder="Click para subir imagen"
                        previewSize="w-full h-48"
                        disabled={viewMode}
                      />
                    </div>

                    {/* Barcode Scanner Button - Only on large screens */}
                    {!viewMode && (
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScanner(!showBarcodeScanner)}
                        className="hidden lg:flex w-full items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        title="Escanear código de barras"
                      >
                        <Camera className="w-5 h-5" />
                        Escanear código de barras
                      </button>
                    )}
                  </div>

                  {/* Right Column - Form Fields */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Barcode Scanner */}
                    {showBarcodeScanner && (
                      <div className="bg-gray-50 rounded-lg p-4 border-2 border-blue-200">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <Camera className="w-5 h-5 text-blue-600" />
                            Escanear Código de Barras
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setShowBarcodeScanner(false);
                              setScannerError(null);
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
                                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                                <p className="text-white mb-2">Error al acceder a la cámara</p>
                                <p className="text-gray-400 text-sm mb-4">{scannerError}</p>
                                <button
                                  type="button"
                                  onClick={() => setShowBarcodeScanner(false)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                  Cerrar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <BarcodeScannerComponent
                              onDetected={handleBarcodeDetected}
                              onError={(err) => setScannerError(err)}
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
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Tag className="h-5 w-5 text-blue-600" />
                        Información Básica
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre del Producto *
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            disabled={viewMode}
                            className="input"
                            placeholder="Ej: Aceite de Soya 1L"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Descripción
                          </label>
                          <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows="3"
                            disabled={viewMode}
                            className="input"
                            placeholder="Descripción detallada del producto..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Categoría *
                          </label>
                          <select
                            name="category_id"
                            value={formData.category_id}
                            onChange={handleChange}
                            required
                            disabled={viewMode}
                            className="input"
                          >
                            <option value="">Seleccione una categoría</option>
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
                              onChange={handleChange}
                              disabled={viewMode}
                              className={`input flex-1 ${barcodeError ? 'border-red-500 focus:ring-red-500' : ''}`}
                              placeholder="Ej: 7730969301421"
                            />
                            {!viewMode && (
                              <button
                                type="button"
                                onClick={() => setShowBarcodeScanner(!showBarcodeScanner)}
                                className="lg:hidden px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                title="Escanear código de barras"
                              >
                                <Camera className="w-4 h-4" />
                                Escanear
                              </button>
                            )}
                          </div>
                          {barcodeError && (
                            <div className="mt-2 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm text-red-800 font-medium">Código de barras duplicado</p>
                                <p className="text-sm text-red-700 mt-1">{barcodeError}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setBarcodeError(null)}
                                className="text-red-400 hover:text-red-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Marca
                          </label>
                          <select
                            name="brand_id"
                            value={formData.brand_id}
                            onChange={handleChange}
                            disabled={viewMode}
                            className="input"
                          >
                            <option value="">Seleccione una marca</option>
                            {brands.map((brand) => (
                              <option key={brand.id} value={brand.id}>
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
                              step="0.1"
                              value={formData.unit_size || ''}
                              onChange={handleChange}
                              disabled={viewMode}
                              className="input flex-1"
                              placeholder="Ej: 500"
                              required
                            />
                            <select
                              name="unit_size_measure"
                              value={formData.unit_size_measure}
                              onChange={handleChange}
                              disabled={viewMode}
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
                            Tamaño de cada unidad individual (ej: 500 ML para una botella de 500ml). Este dato se usa en todas las presentaciones del producto.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Presentation Section */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Box className="h-5 w-5 text-blue-600" />
                        Presentaciones del Producto
                      </h3>
                      <PresentationManager
                        presentations={presentations}
                        onChange={setPresentations}
                        readonly={viewMode}
                        packagingTypes={packagingTypes}
                        presentationTypes={presentationTypes}
                        productUnitSize={formData.unit_size}
                        productUnitMeasure={formData.unit_size_measure}
                      />
                    </div>

                    {/* Stock Settings */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <BarChart className="h-5 w-5 text-blue-600" />
                        Configuración de Stock
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Stock Mínimo
                          </label>
                          <input
                            type="number"
                            name="min_stock"
                            value={formData.min_stock}
                            onChange={handleChange}
                            min="0"
                            step="1"
                            disabled={viewMode}
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
                            onChange={handleChange}
                            min="0"
                            step="1"
                            disabled={viewMode}
                            className="input"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Punto de Reorden
                          </label>
                          <input
                            type="number"
                            name="reorder_point"
                            value={formData.reorder_point}
                            onChange={handleChange}
                            min="0"
                            step="1"
                            disabled={viewMode}
                            className="input"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Additional Settings */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Settings className="h-5 w-5 text-blue-600" />
                        Configuración Adicional
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              name="is_perishable"
                              checked={formData.is_perishable}
                              onChange={handleChange}
                              disabled={viewMode}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Producto Perecedero</span>
                          </label>

                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              name="has_batch_control"
                              checked={formData.has_batch_control}
                              onChange={handleChange}
                              disabled={viewMode}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Control por Lote</span>
                          </label>

                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              name="is_active"
                              checked={formData.is_active}
                              onChange={handleChange}
                              disabled={viewMode}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Producto Activo</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 -mx-6 -mb-6 mt-6 flex justify-end gap-3 rounded-b-lg">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {viewMode ? 'Cerrar' : 'Cancelar'}
                  </button>
                  {!viewMode && (
                    <button
                      type="submit"
                      disabled={loading || barcodeError}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Guardando...
                        </>
                      ) : (
                        <>
                          {editingProduct ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          {editingProduct ? 'Actualizar' : 'Crear Producto'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowViewModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Package className="h-6 w-6" />
                    Detalles del Producto
                  </h3>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="bg-white px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column - Image and Basic Info */}
                  <div className="lg:col-span-1 space-y-4">
                    {/* Product Image */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      {viewingProduct.image_url ? (
                        <img
                          src={`${API_BASE_URL}${viewingProduct.image_url}`}
                          alt={viewingProduct.name}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                          <ImageIcon className="h-16 w-16 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <label className="block text-sm font-medium text-gray-500 mb-2">Estado</label>
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${viewingProduct.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {viewingProduct.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Creado
                        </label>
                        <p className="text-sm text-gray-900">
                          {(() => {
                            const date = viewingProduct.createdAt || viewingProduct.created_at;
                            if (!date) return '-';
                            try {
                              return new Date(date).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              });
                            } catch (e) {
                              return '-';
                            }
                          })()}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Actualizado
                        </label>
                        <p className="text-sm text-gray-900">
                          {(() => {
                            const date = viewingProduct.updatedAt || viewingProduct.updated_at;
                            if (!date) return '-';
                            try {
                              return new Date(date).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              });
                            } catch (e) {
                              return '-';
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Details */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Basic Information */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Información Básica
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">SKU</label>
                          <p className="text-sm text-gray-900 font-mono">{viewingProduct.sku}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Código de Barras</label>
                          <p className="text-sm text-gray-900 font-mono">
                            {viewingProduct.barcodes?.[0]?.barcode || '-'}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
                          <p className="text-sm text-gray-900 font-semibold">{viewingProduct.name}</p>
                        </div>
                        {viewingProduct.description && (
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingProduct.description}</p>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
                          {viewingProduct.category ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: viewingProduct.category.color || '#6B7280' }}
                              />
                              <p className="text-sm text-gray-900">{viewingProduct.category.name}</p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-900">-</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Marca</label>
                          <p className="text-sm text-gray-900">{viewingProduct.brand?.name || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Tamaño de Unidad</label>
                          <p className="text-sm text-gray-900">
                            {viewingProduct.unit_size ? `${parseFloat(viewingProduct.unit_size) % 1 === 0 ? parseFloat(viewingProduct.unit_size).toString() : parseFloat(viewingProduct.unit_size).toFixed(1)} ${viewingProduct.unit_size_measure || 'UND'}` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Presentation Information */}
                    {viewingProduct.presentations && viewingProduct.presentations.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Box className="h-4 w-4" />
                          Presentaciones ({viewingProduct.presentations.length})
                        </h4>
                        {viewingProduct.presentations.map((presentation, index) => (
                          <div key={presentation.id || index} className={`space-y-3 ${index > 0 ? 'mt-4 pt-4 border-t border-gray-300' : ''}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-semibold text-gray-900">{presentation.name || 'Sin nombre'}</span>
                              </div>
                              {presentation.is_default && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  <Star className="h-3 w-3 mr-1 fill-current" />
                                  Predeterminada
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de Empaque</label>
                                <p className="text-sm text-gray-900">{presentation.packagingType?.name || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de Presentación</label>
                                <p className="text-sm text-gray-900">{presentation.presentationType?.name || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Unidades por Paquete</label>
                                <p className="text-sm text-gray-900">{presentation.units_per_package}</p>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Moneda de Compra</label>
                                <p className="text-sm text-gray-900">{presentation.purchase_currency || 'USD'}</p>
                              </div>
                            </div>

                            {/* Pricing */}
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <h5 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                Precios
                              </h5>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Precio Paquete</label>
                                  <p className="text-sm text-gray-900 font-semibold">
                                    ${parseFloat(presentation.package_price || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Costo Paquete</label>
                                  <p className="text-sm text-gray-900">
                                    ${parseFloat(presentation.package_cost || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Moneda</label>
                                  <p className="text-sm text-gray-900">{presentation.purchase_currency || 'USD'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Stock Configuration */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <BarChart className="h-4 w-4" />
                        Configuración de Stock
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Mínimo</label>
                          <p className="text-sm text-gray-900">{viewingProduct.min_stock}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Máximo</label>
                          <p className="text-sm text-gray-900">{viewingProduct.max_stock}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Punto de Reorden</label>
                          <p className="text-sm text-gray-900">{viewingProduct.reorder_point}</p>
                        </div>
                      </div>
                    </div>

                    {/* Additional Configuration */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Configuración Adicional
                      </h4>
                      <div className="space-y-2">
                        <label className="flex items-center text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={viewingProduct.is_perishable}
                            disabled
                            className="rounded border-gray-300 text-blue-600 mr-2"
                          />
                          Producto Perecedero
                        </label>
                        <label className="flex items-center text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={viewingProduct.has_batch_control}
                            disabled
                            className="rounded border-gray-300 text-blue-600 mr-2"
                          />
                          Control por Lote
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cerrar
                  </button>
                  {hasPermission('products.update') && viewingProduct.is_active && (
                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        handleEdit(viewingProduct);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
