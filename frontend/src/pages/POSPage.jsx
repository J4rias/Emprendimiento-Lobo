import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePOSStore, usePOSSessionId } from '../stores/posStore';
import { usePOSSocket } from '../hooks/usePOSSocket';
import { priceListService } from '../services/api/priceListService';
import { productService } from '../services/api/productService';
import { saleService } from '../services/api/saleService';
import { posReservationService } from '../services/api/posReservationService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import POSTabs from '../components/pos/POSTabs';
import StockConflictAlert from '../components/pos/StockConflictAlert';
import CustomerSearch from '../components/CustomerSearch';
import Modal from '../components/common/Modal';
import {
  Plus, Search, X, AlertCircle, CheckCircle, User,
  Package, Lock, Banknote, CreditCard, Smartphone
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// ============= CONSTANTS =============
const CURRENCIES = [
  { code: 'USD', symbol: '$',    name: 'USD' },
  { code: 'COP', symbol: 'COP$', name: 'COP' },
  { code: 'VES', symbol: 'Bs',   name: 'VES' },
];

const PAYMENT_METHODS = [
  { id: 'cash',     label: 'Efectivo',       icon: Banknote },
  { id: 'card',     label: 'Tarjeta',        icon: CreditCard },
  { id: 'transfer', label: 'Transferencia',  icon: Smartphone },
];

// ============= MAIN COMPONENT =============
const POSPage = () => {
  const { hasPermission, user } = useAuth();
  const sessionId = usePOSSessionId();

  // ============= STORE =============
  const {
    tabs,
    activeTabId,
    otherReservations,
    getAvailableUnits,
    addToCart,
    updateQuantity,
    updateCartItemPrice,
    removeFromCart,
    setTabCustomer,
    closeTab,
  } = usePOSStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const cart = activeTab?.cart || [];
  const customer = activeTab?.customer || null;

  // ============= LOCAL STATE =============
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceLists, setPriceLists] = useState([]);
  const [selectedPriceList, setSelectedPriceList] = useState(null);
  const [priceListDetails, setPriceListDetails] = useState({});
  const [exchangeRates, setExchangeRates] = useState([]);
  const [displayCurrency, setDisplayCurrency] = useState('COP');
  const [loadingProducts, setLoadingProducts] = useState(false);

  // ============= MODAL STATES =============
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showConflictAlert, setShowConflictAlert] = useState(false);
  const [conflictData, setConflictData] = useState(null);
  const [saving, setSaving] = useState(false);

  // ============= CHECKOUT STATE =============
  const [saleType, setSaleType] = useState('cash');
  const [paymentLines, setPaymentLines] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [saleResult, setSaleResult] = useState(null);

  // ============= REFS =============
  const searchInputRef = useRef();

  // ============= CURRENCY HELPERS =============
  const displaySymbol = CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || '$';

  const toDisplay = useCallback(
    (amountUSD) => {
      const rate = calculateEffectiveRate('USD', displayCurrency, exchangeRates);
      return parseFloat(amountUSD || 0) * (rate || 1);
    },
    [displayCurrency, exchangeRates]
  );

  const fromDisplay = useCallback(
    (amountDisplay) => {
      const rate = calculateEffectiveRate('USD', displayCurrency, exchangeRates);
      return parseFloat(amountDisplay || 0) / (rate || 1);
    },
    [displayCurrency, exchangeRates]
  );

  /** Formatea un número ya convertido a la moneda de display */
  const fmt = useCallback(
    (amount) => {
      const n = parseFloat(amount) || 0;
      if (displayCurrency === 'COP') {
        return Math.round(n).toLocaleString('es-CO');
      }
      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    [displayCurrency]
  );

  // ============= WEBSOCKET =============
  usePOSSocket({
    sessionId,
    tabId: activeTabId,
    token: localStorage.getItem('token'),
    isEnabled: true,
  });

  // ============= EFFECTS =============
  useEffect(() => {
    loadPriceLists();
    loadExchangeRates();
  }, []);

  useEffect(() => {
    if (selectedPriceList) loadProducts();
  }, [searchTerm, selectedPriceList]);

  useEffect(() => {
    if (searchInputRef.current) searchInputRef.current.focus();
  }, [activeTabId]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) setShowCheckoutModal(true);
        else toast.error('Agrega productos antes de cobrar');
      }
      if (e.key === 'Escape') {
        setShowCheckoutModal(false);
        setShowResultModal(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart]);

  // ============= LOADERS =============
  const loadPriceLists = async () => {
    try {
      const res = await priceListService.getActive();
      const lists = res.data || [];
      setPriceLists(lists);
      const saved = localStorage.getItem('lastPriceListId');
      const exists = lists.some((l) => l.id === parseInt(saved));
      const def = lists.find((l) => l.isDefault) || lists[0];
      if (saved && exists) selectPriceList(parseInt(saved));
      else if (def) selectPriceList(def.id);
    } catch (e) {
      console.error('Error loading price lists:', e);
      toast.error('Error al cargar listas de precios');
    }
  };

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await productService.getAll({
        search: searchTerm,
        limit: 50,
        is_active: true,
        price_list_id: selectedPriceList || undefined,
      });
      const results = res.products || res.data || [];
      setProducts(results);

      // Auto-add on exact barcode match
      const trimmed = searchTerm.trim();
      if (trimmed && results.length === 1) {
        const product = results[0];
        const match = (product.barcodes || []).some((b) => b.barcode === trimmed);
        if (match) {
          handleAddProduct(product, product.presentations?.[0], 1);
          setSearchTerm('');
        }
      }
    } catch (e) {
      console.error('Error loading products:', e);
      toast.error('Error al cargar productos');
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadExchangeRates = async () => {
    try {
      const res = await exchangeRateService.getLatest();
      setExchangeRates(res.data || []);
    } catch (e) {
      console.error('Error loading exchange rates:', e);
    }
  };

  const selectPriceList = async (listId) => {
    if (!listId) {
      setSelectedPriceList(null);
      setPriceListDetails({});
      localStorage.removeItem('lastPriceListId');
      return;
    }
    try {
      const res = await priceListService.getById(listId);
      const map = {};
      (res.data?.details || []).forEach((d) => {
        map[`${d.product_id}-${d.presentation_id}`] = d;
      });
      setPriceListDetails(map);
      setSelectedPriceList(listId);
      localStorage.setItem('lastPriceListId', listId.toString());
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar detalles de la lista de precios');
    }
  };

  // ============= HELPERS =============
  const getProductStock = useCallback((product) => {
    if (!product.inventories) return 0;
    return product.inventories.reduce((sum, inv) => sum + parseFloat(inv.quantity || 0), 0);
  }, []);

  /**
   * Effective unit price in USD.
   * Respects frozen_price with currency conversion.
   */
  const getEffectivePriceUSD = useCallback(
    (presentation, priceListItem) => {
      if (priceListItem?.is_frozen && priceListItem.frozen_price) {
        const frozenCurrency = priceListItem.frozen_currency || 'USD';
        const rate = calculateEffectiveRate(frozenCurrency, 'USD', exchangeRates);
        return parseFloat(priceListItem.frozen_price) * (rate || 1);
      }
      return parseFloat(priceListItem?.unit_price || presentation.base_price || 0);
    },
    [exchangeRates]
  );

  // ============= CART HANDLERS =============
  const handleAddProduct = async (product, presentation, qty = 1) => {
    if (!presentation) { toast.error('Selecciona una presentación'); return; }
    if (!activeTabId) { toast.error('Abre una pestaña de venta primero'); return; }

    const unitsPerPackage = presentation.units_per_package || 1;
    const units = qty * unitsPerPackage;

    const totalStock = getProductStock(product);
    const available = getAvailableUnits(product.id, totalStock);

    if (available < units) {
      setConflictData({ productName: product.name, requested: units, available, reservedByOthers: totalStock - available });
      setShowConflictAlert(true);
      return;
    }

    try {
      await posReservationService.reserve({
        session_id: sessionId,
        tab_id: activeTabId,
        user_id: user.id,
        product_id: product.id,
        presentation_id: presentation.id,
        units_requested: units,
      });

      const priceListItem = priceListDetails[`${product.id}-${presentation.id}`];
      const priceUSD = getEffectivePriceUSD(presentation, priceListItem);

      addToCart(activeTabId, {
        product_id: product.id,
        presentation_id: presentation.id,
        product_name: product.name,
        product_sku: product.sku,
        presentation_name: presentation.name,
        units_per_package: unitsPerPackage,
        quantity: qty,
        unit_price: priceUSD,
        discount_percent: customer?.discountPercentage || 0,
        tax_percent: 0,
        is_frozen: priceListItem?.is_frozen || false,
        frozen_price: priceListItem?.frozen_price || null,
        frozen_currency: priceListItem?.frozen_currency || null,
      });

      setSearchTerm('');
    } catch (err) {
      if (err.response?.status === 409) {
        setConflictData({
          productName: product.name,
          requested: units,
          available: err.response.data.available || 0,
          reservedByOthers: err.response.data.reserved_by_others || 0,
        });
        setShowConflictAlert(true);
      } else {
        toast.error('Error al reservar producto');
      }
    }
  };

  const handleRemoveItem = async (presentationId) => {
    const item = cart.find((i) => i.presentation_id === presentationId);
    if (!item) return;
    try {
      await posReservationService.releaseItem({
        session_id: sessionId,
        tab_id: activeTabId,
        presentation_id: presentationId,
        units_to_release: item.quantity * item.units_per_package,
      });
    } catch (err) {
      // 404 = reservation doesn't exist server-side (e.g. after page refresh), safe to remove
      if (err.response?.status !== 404) {
        console.error('Error removing item:', err);
        toast.error('Error al remover producto');
        return;
      }
    }
    removeFromCart(activeTabId, presentationId);
  };

  const handleQuantityChange = async (presentationId, newQty) => {
    if (newQty < 1) return;

    const item = cart.find((i) => i.presentation_id === presentationId);
    if (!item) return;

    const newUnits = newQty * item.units_per_package;

    try {
      await posReservationService.reserve({
        session_id: sessionId,
        tab_id: activeTabId,
        user_id: user.id,
        product_id: item.product_id,
        presentation_id: presentationId,
        units_requested: newUnits,
      });
      updateQuantity(activeTabId, presentationId, newQty);
    } catch (err) {
      if (err.response?.status === 409) {
        setConflictData({
          productName: item.product_name,
          requested: newUnits,
          available: err.response.data.available || 0,
          reservedByOthers: err.response.data.reserved_by_others || 0,
        });
        setShowConflictAlert(true);
      } else {
        toast.error('Error al actualizar cantidad');
      }
    }
  };

  const handlePriceChange = (presentationId, newPriceDisplay) => {
    const newPriceUSD = fromDisplay(parseFloat(newPriceDisplay) || 0);
    updateCartItemPrice(activeTabId, presentationId, newPriceUSD);
  };

  // ============= TOTALS =============
  const calculateTotals = useCallback(() => {
    let subtotal = 0;
    let tax = 0;

    cart.forEach((item) => {
      const itemSubtotal = item.unit_price * item.quantity;
      const itemDiscount = itemSubtotal * ((item.discount_percent || 0) / 100);
      const taxable = itemSubtotal - itemDiscount;
      const itemTax = taxable * ((item.tax_percent || 0) / 100);
      subtotal += itemSubtotal;
      tax += itemTax;
    });

    const discount = subtotal * (discountPercent / 100);
    const total = subtotal - discount + tax;

    return { subtotal, discount, tax, total };
  }, [cart, discountPercent]);

  const { subtotal, discount, tax, total } = calculateTotals();

  // ============= CHECKOUT =============
  const handleCompleteSale = async () => {
    if (!selectedPriceList) { toast.error('Selecciona una lista de precios'); return; }
    if (saleType === 'cash' && paymentLines.length === 0) { toast.error('Agrega al menos una forma de pago'); return; }
    if (saleType === 'credit' && !customer) { toast.error('Selecciona un cliente para ventas a crédito'); return; }

    setSaving(true);
    try {
      const result = await saleService.createSale({
        customer_id: customer?.id || null,
        warehouse_id: 1,
        sale_type: saleType,
        session_id: sessionId,
        tab_id: activeTabId,
        exchange_rate: calculateEffectiveRate('USD', 'COP', exchangeRates) || 1,
        payment_lines: saleType === 'cash' ? paymentLines : [],
        items: cart.map((item) => ({
          product_id: item.product_id,
          presentation_id: item.presentation_id,
          quantity: item.quantity,
          is_unit: false,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent,
        })),
        discount_amount: discount,
        notes,
      });

      setSaleResult(result.sale);
      setShowCheckoutModal(false);
      setShowResultModal(true);

      closeTab(activeTabId);
      await posReservationService.releaseTab({ session_id: sessionId, tab_id: activeTabId });

      setSaleType('cash');
      setPaymentLines([]);
      setDiscountPercent(0);
      setNotes('');

      toast.remove();
      toast.success('¡Venta completada!');
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error(`Stock insuficiente: ${err.response.data.product_name}. Disponible: ${err.response.data.available}`);
      } else {
        toast.error(err.response?.data?.message || 'Error al crear la venta');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTabClose = async (tabId) => {
    try {
      await posReservationService.releaseTab({ session_id: sessionId, tab_id: tabId });
    } catch (err) {
      console.error('Error releasing tab reservations:', err);
    }
  };

  // ============= RENDER =============
  if (!hasPermission('sales.create')) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-900">Sin permiso</p>
          <p className="text-gray-600">No tienes permisos para acceder al POS</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Punto de Venta</h1>
            <p className="text-sm text-gray-600">Usuario: {user?.first_name || user?.username}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Selector de moneda */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setDisplayCurrency(c.code)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    displayCurrency === c.code
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {c.code}
                </button>
              ))}
            </div>

            {/* Lista de precios */}
            <select
              value={selectedPriceList || ''}
              onChange={(e) => selectPriceList(e.target.value ? parseInt(e.target.value) : null)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecciona lista de precios</option>
              {priceLists.map((list) => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <POSTabs onTabClose={handleTabClose} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4">

        {/* Products Grid */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Busca por nombre, SKU o código de barras... (F2)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loadingProducts ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Cargando productos...</p>
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priceListDetails={priceListDetails}
                    otherReservations={otherReservations}
                    onAdd={handleAddProduct}
                    toDisplay={toDisplay}
                    displaySymbol={displaySymbol}
                    exchangeRates={exchangeRates}
                    getEffectivePriceUSD={getEffectivePriceUSD}
                    fmt={fmt}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">
                  {selectedPriceList ? 'No hay productos' : 'Selecciona una lista de precios'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="w-80 bg-white rounded-lg shadow flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 bg-blue-50 px-4 py-3 border-b border-gray-200">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">Carrito</h2>
            {cart.length > 0 && (
              <span className="ml-auto bg-blue-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length > 0 ? (
              cart.map((item) => (
                <CartItem
                  key={item.presentation_id}
                  item={item}
                  onQuantityChange={handleQuantityChange}
                  onRemove={handleRemoveItem}
                  onPriceChange={handlePriceChange}
                  toDisplay={toDisplay}
                  displaySymbol={displaySymbol}
                  fmt={fmt}
                />
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Carrito vacío
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="border-t border-gray-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">{displaySymbol} {fmt(toDisplay(subtotal))}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Descuento:</span>
                  <span className="font-semibold text-red-600">-{displaySymbol} {fmt(toDisplay(discount))}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Impuesto:</span>
                  <span className="font-semibold">{displaySymbol} {fmt(toDisplay(tax))}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between text-base font-bold">
                <span>Total:</span>
                <span className="text-green-600">{displaySymbol} {fmt(toDisplay(total))}</span>
              </div>

              <button
                onClick={() => setShowCheckoutModal(true)}
                className="w-full mt-2 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Cobrar (F8)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      <CheckoutModal
        show={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        customer={customer}
        onCustomerSelect={(c) => setTabCustomer(activeTabId, c)}
        saleType={saleType}
        setSaleType={setSaleType}
        paymentLines={paymentLines}
        setPaymentLines={setPaymentLines}
        discountPercent={discountPercent}
        setDiscountPercent={setDiscountPercent}
        notes={notes}
        setNotes={setNotes}
        subtotal={subtotal}
        discount={discount}
        tax={tax}
        total={total}
        onComplete={handleCompleteSale}
        saving={saving}
        exchangeRates={exchangeRates}
        displayCurrency={displayCurrency}
        toDisplay={toDisplay}
        displaySymbol={displaySymbol}
        fmt={fmt}
      />

      <StockConflictAlert
        show={showConflictAlert}
        productName={conflictData?.productName}
        requested={conflictData?.requested}
        available={conflictData?.available}
        reservedByOthers={conflictData?.reservedByOthers}
        onDismiss={() => setShowConflictAlert(false)}
      />

      <SaleResultModal
        show={showResultModal}
        onClose={() => setShowResultModal(false)}
        sale={saleResult}
        toDisplay={toDisplay}
        displaySymbol={displaySymbol}
        fmt={fmt}
      />
    </div>
  );
};

// ============= SUB-COMPONENTS =============

function ProductCard({ product, priceListDetails, otherReservations, onAdd, toDisplay, displaySymbol, exchangeRates, getEffectivePriceUSD, fmt }) {
  const [selectedPresentation, setSelectedPresentation] = useState(product.presentations?.[0]);
  const [quantity, setQuantity] = useState(1);

  if (!selectedPresentation) return null;

  const totalStock = product.inventories?.reduce((s, i) => s + parseFloat(i.quantity || 0), 0) || 0;
  const reservedByOthers = otherReservations[product.id] || 0;
  const available = totalStock - reservedByOthers;

  const priceListItem = priceListDetails[`${product.id}-${selectedPresentation.id}`];
  const isFrozen = !!priceListItem?.is_frozen;
  const priceUSD = getEffectivePriceUSD(selectedPresentation, priceListItem);

  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow flex flex-col">
      <h3 className="font-semibold text-sm text-gray-900 truncate">{product.name}</h3>

      {/* Presentation selector */}
      {product.presentations?.length > 1 ? (
        <select
          value={selectedPresentation.id}
          onChange={(e) => {
            const p = product.presentations.find((p) => p.id === parseInt(e.target.value));
            if (p) setSelectedPresentation(p);
          }}
          className="w-full text-xs border border-gray-200 rounded mt-1 mb-2 py-1 px-1"
        >
          {product.presentations.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-gray-600 mb-2">{selectedPresentation.name}</p>
      )}

      {/* Stock */}
      <div className="text-xs mb-2">
        {available > 0 ? (
          <span className="text-green-600">
            {available.toFixed(0)} disp.
            {reservedByOthers > 0 && (
              <span className="text-amber-600"> ({reservedByOthers.toFixed(0)} reserv.)</span>
            )}
          </span>
        ) : (
          <span className="text-red-600 font-medium">Sin stock</span>
        )}
      </div>

      {/* Price */}
      <div className="flex items-center gap-1 mb-3">
        {isFrozen && <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" title="Precio congelado" />}
        <p className={`font-bold text-base ${isFrozen ? 'text-amber-700' : 'text-gray-900'}`}>
          {displaySymbol} {fmt(toDisplay(priceUSD))}
        </p>
      </div>

      {/* Qty */}
      <div className="flex items-center gap-1 mb-3">
        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-9 px-2 bg-gray-200 rounded text-sm flex-shrink-0 flex items-center justify-center">−</button>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="flex-1 min-w-0 h-9 text-center border border-gray-300 rounded text-sm"
        />
        <button onClick={() => setQuantity(quantity + 1)} className="h-9 px-2 bg-gray-200 rounded text-sm flex-shrink-0 flex items-center justify-center">+</button>
      </div>

      <button
        onClick={() => onAdd(product, selectedPresentation, quantity)}
        disabled={available <= 0}
        className="w-full bg-blue-600 text-white py-2 rounded text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-1"
      >
        <Plus className="w-4 h-4" /> Agregar
      </button>
    </div>
  );
}

function CartItem({ item, onQuantityChange, onRemove, onPriceChange, toDisplay, displaySymbol, fmt }) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');

  const displayPrice = toDisplay(item.unit_price);
  const displayTotal = toDisplay(item.unit_price * item.quantity);

  const startEdit = () => {
    setPriceInput(Math.round(displayPrice * 100) / 100);
    setEditingPrice(true);
  };

  const commitEdit = () => {
    const val = parseFloat(priceInput);
    if (!isNaN(val) && val >= 0) onPriceChange(item.presentation_id, val);
    setEditingPrice(false);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{item.product_name}</p>
          <p className="text-xs text-gray-500">{item.presentation_name}</p>
        </div>
        <button onClick={() => onRemove(item.presentation_id)} className="p-1 hover:bg-red-100 rounded flex-shrink-0">
          <X className="w-4 h-4 text-red-500" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => onQuantityChange(item.presentation_id, item.quantity - 1)} className="h-9 px-2 bg-white border border-gray-300 rounded text-sm flex items-center justify-center">−</button>
        <input
          type="number"
          value={item.quantity}
          onChange={(e) => onQuantityChange(item.presentation_id, parseInt(e.target.value) || 1)}
          className="w-12 h-9 text-center border border-gray-300 rounded text-sm"
        />
        <button onClick={() => onQuantityChange(item.presentation_id, item.quantity + 1)} className="h-9 px-2 bg-white border border-gray-300 rounded text-sm flex items-center justify-center">+</button>
      </div>

      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-1">
          {item.is_frozen && <Lock className="w-3 h-3 text-amber-500" title="Precio congelado" />}
          {editingPrice ? (
            <input
              type="number"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditingPrice(false);
              }}
              className="w-20 border border-blue-400 rounded px-1 text-right text-sm"
              autoFocus
            />
          ) : (
            <button
              onClick={startEdit}
              className="font-medium text-gray-700 hover:text-blue-600 hover:underline"
              title="Clic para editar precio"
            >
              {displaySymbol} {fmt(displayPrice)}
            </button>
          )}
        </div>
        <span className="font-semibold">{displaySymbol} {fmt(displayTotal)}</span>
      </div>
    </div>
  );
}

function CheckoutModal({
  show, onClose, customer, onCustomerSelect, saleType, setSaleType, paymentLines, setPaymentLines,
  discountPercent, setDiscountPercent, notes, setNotes,
  subtotal, discount, tax, total, onComplete, saving,
  exchangeRates, displayCurrency, toDisplay, displaySymbol, fmt,
}) {
  const [newPayCurrency, setNewPayCurrency] = useState(displayCurrency);
  const [newPayMethod, setNewPayMethod] = useState('cash');
  const [newPayAmount, setNewPayAmount] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  if (!show) return null;

  const addPaymentLine = () => {
    const amount = parseFloat(newPayAmount);
    if (!amount || amount <= 0) { toast.error('Ingresa un monto válido'); return; }
    const rate = calculateEffectiveRate('USD', newPayCurrency, exchangeRates) || 1;
    setPaymentLines([...paymentLines, { currency: newPayCurrency, method: newPayMethod, amount, exchange_rate: rate }]);
    setNewPayAmount('');
  };

  const paidUSD = paymentLines.reduce((sum, l) => sum + (l.amount / (l.exchange_rate || 1)), 0);
  const changeUSD = paidUSD - total;
  const totalDisplay = toDisplay(total);
  const paidDisplay = toDisplay(paidUSD);
  const changeDisplay = toDisplay(Math.abs(changeUSD));

  // Formatea un monto en su propia moneda (para líneas de pago)
  const fmtLine = (amount, currency) => {
    const n = parseFloat(amount) || 0;
    if (currency === 'COP') return Math.round(n).toLocaleString('es-CO');
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Modal isOpen={show} onClose={onClose} title="Confirmar Venta">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">

        {/* Resumen */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal:</span><span>{displaySymbol} {fmt(toDisplay(subtotal))}</span></div>
          {discount > 0 && <div className="flex justify-between"><span>Descuento:</span><span className="text-red-600">-{displaySymbol} {fmt(toDisplay(discount))}</span></div>}
          {tax > 0 && <div className="flex justify-between"><span>Impuesto:</span><span>{displaySymbol} {fmt(toDisplay(tax))}</span></div>}
          <div className="border-t pt-1 flex justify-between font-bold text-base">
            <span>Total:</span>
            <span className="text-green-600">{displaySymbol} {fmt(totalDisplay)}</span>
          </div>
        </div>

        {/* Descuento global */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Descuento global (%)</label>
          <input
            type="number" min="0" max="100" value={discountPercent}
            onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>

        {/* Tipo de venta */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Tipo de Venta</label>
          <div className="flex gap-2">
            {[{ id: 'cash', label: 'Contado' }, { id: 'credit', label: 'Crédito' }].map((t) => (
              <button
                key={t.id}
                onClick={() => { setSaleType(t.id); setPaymentLines([]); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${saleType === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cliente (siempre visible, obligatorio para crédito) */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Cliente</label>
          <button
            onClick={() => setShowCustomerSearch(true)}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              customer
                ? 'bg-blue-50 border border-blue-200 text-blue-900 hover:bg-blue-100'
                : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <User className="w-4 h-4" />
            {customer ? `${customer.name || customer.full_name}` : 'Seleccionar cliente'}
          </button>
          {customer && (
            <button
              onClick={() => onCustomerSelect(null)}
              className="mt-1 text-xs text-gray-600 hover:text-gray-900 underline"
            >
              Limpiar selección
            </button>
          )}
        </div>

        {/* Pagos - solo contado */}
        {saleType === 'cash' && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-900">Pagos recibidos</label>

            {paymentLines.length > 0 && (
              <div className="space-y-1">
                {paymentLines.map((line, i) => {
                  const MethodIcon = PAYMENT_METHODS.find((m) => m.id === line.method)?.icon || Banknote;
                  return (
                    <div key={i} className="flex items-center justify-between bg-green-50 rounded px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <MethodIcon className="w-4 h-4 text-green-700" />
                        <span className="font-medium text-green-800">{line.currency} {fmtLine(line.amount, line.currency)}</span>
                        <span className="text-green-600 text-xs">({PAYMENT_METHODS.find(m => m.id === line.method)?.label})</span>
                      </div>
                      <button onClick={() => setPaymentLines(paymentLines.filter((_, j) => j !== i))}>
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Agregar pago */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
              <div className="flex gap-2">
                <select value={newPayMethod} onChange={(e) => setNewPayMethod(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                  {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <select value={newPayCurrency} onChange={(e) => setNewPayCurrency(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="number" value={newPayAmount}
                  onChange={(e) => setNewPayAmount(e.target.value)}
                  placeholder={`Monto en ${newPayCurrency}`}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && addPaymentLine()}
                />
                <button onClick={addPaymentLine} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700">
                  +
                </button>
              </div>
              {/* Botones rápidos */}
              <div className="flex gap-1 flex-wrap">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      const rate = calculateEffectiveRate('USD', c.code, exchangeRates) || 1;
                      setNewPayCurrency(c.code);
                      setNewPayMethod('cash');
                      setNewPayAmount(c.code === 'COP' ? String(Math.round(total * rate)) : (total * rate).toFixed(2));
                    }}
                    className="px-2 py-1 bg-white border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-100"
                  >
                    Total en {c.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumen de pago */}
            {paymentLines.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1 border border-gray-200">
                <div className="flex justify-between"><span>Total:</span><span className="font-semibold">{displaySymbol} {fmt(totalDisplay)}</span></div>
                <div className="flex justify-between"><span>Pagado:</span><span className="font-semibold text-blue-700">{displaySymbol} {fmt(paidDisplay)}</span></div>
                <div className="flex justify-between border-t pt-1">
                  {changeUSD >= 0 ? (
                    <><span className="font-semibold">Vuelto:</span><span className="font-bold text-green-600">{displaySymbol} {fmt(changeDisplay)}</span></>
                  ) : (
                    <><span className="font-semibold text-red-600">Faltante:</span><span className="font-bold text-red-600">{displaySymbol} {fmt(changeDisplay)}</span></>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Crédito */}
        {saleType === 'credit' && (
          <div className={`rounded-lg p-3 text-sm border ${customer ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {customer
              ? <p>Se cargará <strong>{displaySymbol} {fmt(totalDisplay)}</strong> al crédito de <strong>{customer.name || customer.full_name}</strong></p>
              : <p className="font-medium">Selecciona un cliente para ventas a crédito</p>
            }
          </div>
        )}

        {/* Notas */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Notas (opcional)</label>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Observaciones de la venta..."
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-900 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={onComplete}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            {saving ? 'Guardando...' : 'Confirmar Venta'}
          </button>
        </div>
      </div>
    </Modal>

    <CustomerSearch
      isOpen={showCustomerSearch}
      onClose={() => setShowCustomerSearch(false)}
      onSelect={(c) => {
        onCustomerSelect(c);
        setShowCustomerSearch(false);
      }}
    />
  );
}

function SaleResultModal({ show, onClose, sale, toDisplay, displaySymbol, fmt }) {
  if (!show || !sale) return null;

  return (
    <Modal isOpen={show} onClose={onClose} title="Venta Completada">
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <CheckCircle className="w-16 h-16 text-green-600" />
        </div>
        <p className="text-center text-lg font-semibold text-gray-900">¡Venta exitosa!</p>
        <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
          <p><strong>Número:</strong> {sale.sale_number}</p>
          <p><strong>Total:</strong> {displaySymbol} {fmt(toDisplay(parseFloat(sale.total || 0)))}</p>
        </div>
        <button onClick={onClose} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
          Cerrar
        </button>
      </div>
    </Modal>
  );
}

export default POSPage;
