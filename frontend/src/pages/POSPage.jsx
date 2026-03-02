import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShoppingCart, Trash2, Plus, Minus, Search, User, CreditCard,
  Banknote, Smartphone, X, UserPlus, Package, Hash, Printer,
  ChevronDown, ChevronUp, Clock, DollarSign, Repeat
} from 'lucide-react';
import { productService } from '../services/api/productService';
import { saleService } from '../services/api/saleService';
import { priceListService } from '../services/api/priceListService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { toast } from 'react-hot-toast';
import CustomerSearch from '../components/CustomerSearch';
import Modal from '../components/common/Modal';
import { printSaleTicket } from '../components/sales/SaleTicket';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';

// ──────────────────────── CONSTANTS ────────────────────────
const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'Dólar' },
  { code: 'COP', symbol: 'COP', name: 'Peso Col.' },
  { code: 'VES', symbol: 'Bs', name: 'Bolívar' }
];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo', icon: Banknote, activeClass: 'bg-emerald-100 text-emerald-700' },
  { id: 'card', label: 'Tarjeta', icon: CreditCard, activeClass: 'bg-blue-100 text-blue-700' },
  { id: 'transfer', label: 'Transferencia', icon: Smartphone, activeClass: 'bg-violet-100 text-violet-700' }
];

const emptyPaymentLine = () => ({ currency: 'USD', method: 'cash', amount: '' });

// ──────────────────────── COMPONENT ────────────────────────
const POSPage = () => {
  const { user } = useAuth();
  const { companySettings } = useCompany();
  const searchInputRef = useRef(null);

  // Helper for currency formatting with thousands separator
  const formatMoney = (amount, symbol = '$') => {
    return `${symbol} ${parseFloat(amount || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Products & search
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Cart
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // Price lists
  const [priceLists, setPriceLists] = useState([]);
  const [selectedPriceList, setSelectedPriceList] = useState(null);
  const [priceListDetails, setPriceListDetails] = useState({});

  // Payment / checkout
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [saleType, setSaleType] = useState('cash');
  const [paymentLines, setPaymentLines] = useState([emptyPaymentLine()]);
  const [loading, setLoading] = useState(false);

  // Post-sale
  const [completedSale, setCompletedSale] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // Exchange rates
  const [exchangeRates, setExchangeRates] = useState([]);
  const [showCurrencyTotals, setShowCurrencyTotals] = useState(false);

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // ──────────────────── EFFECTS ────────────────────
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const active = document.activeElement;
    if (searchInputRef.current &&
      (!active || active.tagName !== 'INPUT' || active === searchInputRef.current)) {
      searchInputRef.current.focus();
    }
  }, [cart, searchTerm]);

  useEffect(() => {
    if (selectedPriceList) {
      loadProducts();
    }
  }, [searchTerm, selectedPriceList]);
  useEffect(() => { loadPriceLists(); }, []);
  useEffect(() => { loadExchangeRates(); }, []);

  useEffect(() => {
    if (customer && customer.discount_percentage > 0) {
      setCart(prev => prev.map(item => ({ ...item, discount_percent: customer.discount_percentage })));
    }
  }, [customer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === 'F8') { e.preventDefault(); if (cart.length > 0) setShowCheckoutModal(true); }
      if (e.key === 'Escape') {
        setShowCheckoutModal(false);
        setShowResultModal(false);
        setShowCustomerSearch(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart]);

  // ──────────────────── LOADERS ────────────────────
  const loadProducts = async () => {
    try {
      const data = await productService.getAll({
        search: searchTerm, limit: 50, is_active: true,
        price_list_id: selectedPriceList || undefined
      });
      const results = data.products || data.data || [];
      setProducts(results);

      // Auto-add on exact barcode match
      const trimmed = searchTerm.trim();
      if (trimmed && results.length === 1) {
        const product = results[0];
        const match = (product.barcodes || []).some(b => b.barcode === trimmed);
        if (match) { addToCart(product); setSearchTerm(''); }
      }
    } catch (e) { console.error('Error loading products:', e); }
  };

  const loadPriceLists = async () => {
    try {
      const res = await priceListService.getActive();
      const lists = res.data || [];
      setPriceLists(lists);
      const saved = localStorage.getItem('lastPriceListId');
      const exists = lists.some(l => l.id === parseInt(saved));
      const def = lists.find(l => l.isDefault) || lists[0];
      if (saved && exists) selectPriceList(parseInt(saved));
      else if (def) selectPriceList(def.id);
    } catch (e) { console.error(e); }
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
      (res.data?.details || []).forEach(d => { map[`${d.product_id}-${d.presentation_id}`] = d; });
      setPriceListDetails(map);

      // Update this last to trigger loadProducts ONLY AFTER the details are ready
      setSelectedPriceList(listId);
      localStorage.setItem('lastPriceListId', listId.toString());
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar detalles de la lista de precios');
    }
  };

  const loadExchangeRates = async () => {
    try {
      const res = await exchangeRateService.getLatest();
      setExchangeRates(res.data || []);
    } catch (e) { console.error('Exchange rates error:', e); }
  };

  // ──────────────────── CART LOGIC ────────────────────
  const getProductStock = (product, presentation) => {
    const totalUnits = (product.inventories || []).reduce((s, i) => s + parseFloat(i.quantity), 0);
    const unitsPerPkg = parseFloat(presentation?.units_per_package) || 1;
    return { totalUnits, availablePackages: Math.floor(totalUnits / unitsPerPkg), unitsPerPkg };
  };

  const getPrice = (productId, presentationId, presentation) => {
    const key = `${productId}-${presentationId}`;
    const detail = priceListDetails[key];
    const pkgPrice = detail && parseFloat(detail.package_price) > 0 ? parseFloat(detail.package_price) : (presentation?.sale_price || 0);
    const unitPrice = detail && parseFloat(detail.unit_price) > 0 ? parseFloat(detail.unit_price) : 0;
    return { pkgPrice, unitPrice };
  };

  const addToCart = (product) => {
    const pres = product.presentations?.[0];
    if (!pres) { toast.error('Producto sin presentaciones configuradas'); return; }

    const { totalUnits, availablePackages, unitsPerPkg } = getProductStock(product, pres);
    const { pkgPrice, unitPrice } = getPrice(product.id, pres.id, pres);

    const existing = cart.find(i => i.product_id === product.id && i.presentation_id === pres.id);

    if (existing) {
      const maxQty = existing.sellByUnit ? totalUnits : availablePackages;
      if (existing.quantity + 1 > maxQty) {
        toast.error(`Stock insuficiente. Disponibles: ${maxQty}`);
        return;
      }
      updateQuantity(existing.product_id, existing.presentation_id, existing.quantity + 1, maxQty);
    } else {
      if (availablePackages <= 0) { toast.error('Sin stock disponible'); return; }
      setCart(prev => [...prev, {
        product_id: product.id,
        presentation_id: pres.id,
        product_name: product.name,
        presentation_name: pres.name,
        units_per_package: unitsPerPkg,
        quantity: 1,
        stock_units: totalUnits,
        stock_packages: availablePackages,
        sellByUnit: false,
        package_price: pkgPrice,
        unit_price_each: unitPrice || (pkgPrice / unitsPerPkg),
        current_price: pkgPrice,
        tax_percent: 0,
        discount_percent: customer?.discount_percentage || 0
      }]);
    }
  };

  const toggleSellMode = (productId, presentationId) => {
    setCart(prev => prev.map(item => {
      if (item.product_id !== productId || item.presentation_id !== presentationId) return item;
      const nowByUnit = !item.sellByUnit;
      const maxQty = nowByUnit ? item.stock_units : item.stock_packages;
      const newQty = Math.min(item.quantity, maxQty) || 1;
      return {
        ...item,
        sellByUnit: nowByUnit,
        quantity: newQty,
        current_price: nowByUnit ? item.unit_price_each : item.package_price
      };
    }));
  };

  const updateQuantity = (productId, presentationId, newQty, maxStock = null) => {
    if (newQty <= 0) { removeFromCart(productId, presentationId); return; }
    const item = cart.find(i => i.product_id === productId && i.presentation_id === presentationId);
    const available = maxStock !== null ? maxStock : (item?.sellByUnit ? item?.stock_units : item?.stock_packages) || 999999;
    if (newQty > available) { toast.error(`Stock insuficiente. Disponibles: ${available}`); return; }
    setCart(prev => prev.map(i =>
      i.product_id === productId && i.presentation_id === presentationId ? { ...i, quantity: newQty } : i
    ));
  };

  const removeFromCart = (pid, presId) => {
    setCart(prev => prev.filter(i => !(i.product_id === pid && i.presentation_id === presId)));
  };

  const updateDiscount = (pid, presId, val) => {
    setCart(prev => prev.map(i =>
      i.product_id === pid && i.presentation_id === presId ? { ...i, discount_percent: parseFloat(val) || 0 } : i
    ));
  };

  const clearCart = () => { setCart([]); setCustomer(null); };

  // ──────────────────── CUSTOMERS ────────────────────
  const handleCustomerSelect = (c) => {
    setCustomer(c);
    if (c.discount_percentage > 0) {
      setCart(prev => prev.map(i => ({ ...i, discount_percent: c.discount_percentage })));
    }
  };

  const handleRemoveCustomer = () => {
    setCustomer(null);
    setCart(prev => prev.map(i => ({ ...i, discount_percent: 0 })));
  };

  const getCustomerDisplayName = () => {
    if (!customer) return '';
    return customer.type === 'natural'
      ? `${customer.first_name} ${customer.last_name}`
      : customer.business_name || customer.trade_name;
  };

  // ──────────────────── TOTALS ────────────────────
  const calculateTotals = useCallback(() => {
    let subtotal = 0, totalDiscount = 0;
    cart.forEach(item => {
      const sub = item.quantity * item.current_price;
      const disc = sub * (item.discount_percent / 100);
      subtotal += sub; totalDiscount += disc;
    });
    const finalTotal = subtotal - totalDiscount;
    return {
      subtotal: subtotal.toFixed(2),
      discount: totalDiscount.toFixed(2),
      tax: (0).toFixed(2),
      total: finalTotal.toFixed(2),
      totalRaw: finalTotal
    };
  }, [cart]);

  const getEffectiveRate = useCallback((from, to) => {
    return calculateEffectiveRate(from, to, exchangeRates);
  }, [exchangeRates]);

  const convertToOtherCurrency = (usdAmount, targetCurrency) => {
    const rate = getEffectiveRate('USD', targetCurrency);
    return rate !== null ? usdAmount * rate : null;
  };

  const convertPaymentToUSD = (amount, fromCurrency) => {
    const rate = getEffectiveRate(fromCurrency, 'USD');
    return rate !== null ? amount * rate : 0;
  };

  // ──────────────────── PAYMENT LINES ────────────────────
  const addPaymentLine = () => setPaymentLines(prev => [...prev, emptyPaymentLine()]);
  const removePaymentLine = (idx) => setPaymentLines(prev => prev.filter((_, i) => i !== idx));
  const updatePaymentLine = (idx, field, val) => {
    setPaymentLines(prev => prev.map((line, i) => i === idx ? { ...line, [field]: val } : line));
  };

  const getTotalPaidUSD = () => {
    return paymentLines.reduce((sum, line) => {
      const amt = parseFloat(line.amount) || 0;
      return sum + convertPaymentToUSD(amt, line.currency);
    }, 0);
  };

  // ──────────────────── COMPLETE SALE ────────────────────
  const handleCompleteSale = async () => {
    if (cart.length === 0) { toast.error('Carrito vacío'); return; }
    if (saleType === 'credit' && !customer) {
      toast.error('Seleccione un cliente para ventas a crédito');
      setShowCustomerSearch(true); return;
    }

    const totals = calculateTotals();
    const totalAmount = parseFloat(totals.total);
    const paidUSD = getTotalPaidUSD();

    if (saleType === 'cash' && paidUSD < totalAmount - 0.01) {
      toast.error(`Monto insuficiente. Faltan: $ ${(totalAmount - paidUSD).toFixed(2)}`);
      return;
    }

    setLoading(true);
    try {
      const saleData = {
        customer_id: customer?.id || null,
        warehouse_id: 1,
        sale_type: saleType,
        payment_method: paymentLines[0]?.method || 'cash',
        items: cart.map(item => ({
          product_id: item.product_id,
          presentation_id: item.presentation_id,
          quantity: item.sellByUnit ? item.quantity : item.quantity,
          unit_price: item.current_price,
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent
        })),
        paid_amount: saleType === 'cash' ? paidUSD : 0,
        notes: ''
      };

      const response = await saleService.createSale(saleData);
      const changeAmount = saleType === 'cash' ? Math.max(0, paidUSD - totalAmount) : 0;

      setCompletedSale({
        ...response.sale,
        totals,
        changeAmount: changeAmount.toFixed(2),
        paymentLines: [...paymentLines]
      });

      setShowCheckoutModal(false);
      setShowResultModal(true);

      toast.success(`¡Venta ${response.sale.sale_number} completada!`);

      // Clear
      setCart([]);
      setCustomer(null);
      setPaymentLines([emptyPaymentLine()]);
      setSaleType('cash');
      loadProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al procesar la venta');
    } finally { setLoading(false); }
  };

  const handlePrintTicket = () => {
    if (completedSale) {
      printSaleTicket(completedSale, companySettings);
    }
  };

  // ──────────────────── COMPUTED ────────────────────
  const totals = calculateTotals();
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  // ──────────────────── RENDER ────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* ═══════════════ HEADER ═══════════════ */}
      <div className="bg-slate-900 text-white px-5 py-2.5 flex items-center justify-between shadow-lg" style={{ minHeight: 52 }}>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-semibold leading-tight">Punto de Venta</h1>
            <p className="text-[10px] text-slate-400 leading-tight">{user?.name || 'Cajero'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Price list selector */}
          {priceLists.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Lista:</span>
              <select
                value={selectedPriceList || ''}
                onChange={e => selectPriceList(e.target.value ? parseInt(e.target.value) : null)}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {priceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
              </select>
            </div>
          )}

          {/* Clock */}
          <div className="flex items-center gap-1 text-slate-400 text-xs">
            <Clock className="w-3.5 h-3.5" />
            {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </div>

          {/* Shortcuts hint */}
          <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-500">
            <kbd className="bg-slate-800 px-1 rounded text-slate-400">F2</kbd>Buscar
            <kbd className="bg-slate-800 px-1 rounded text-slate-400 ml-2">F8</kbd>Cobrar
          </div>
        </div>
      </div>

      {/* ═══════════════ MAIN AREA ═══════════════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─────── PRODUCTS PANEL (LEFT) ─────── */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden" style={{ minWidth: 0 }}>
          {/* Search */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por nombre, SKU o código de barras..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
            </div>
          </div>

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <ShoppingCart className="w-16 h-16 mb-3 opacity-30" />
                <p className="text-sm">No hay productos disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {products.map(product => {
                  const pres = product.presentations?.[0];
                  const { availablePackages } = getProductStock(product, pres);
                  const { pkgPrice } = getPrice(product.id, pres?.id, pres);
                  const lowStock = availablePackages <= 3;

                  return (
                    <div
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={`bg-white rounded-lg p-2.5 cursor-pointer border transition-all hover:shadow-md hover:border-blue-400 active:scale-[0.97] ${lowStock ? 'border-amber-300' : 'border-gray-100'}`}
                    >
                      {/* Category dot */}
                      {product.category && (
                        <div
                          className="w-2 h-2 rounded-full mb-1"
                          style={{ backgroundColor: product.category.color || '#9CA3AF' }}
                          title={product.category.name}
                        />
                      )}
                      <h3 className="text-xs font-medium text-gray-800 leading-tight line-clamp-2 mb-1" style={{ minHeight: '2rem' }}>
                        {product.name}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-medium ${lowStock ? 'text-amber-600' : 'text-gray-400'}`}>
                          {availablePackages} disp
                        </span>
                        <span className="text-sm font-bold text-blue-600">
                          {formatMoney(pkgPrice)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─────── CART PANEL (RIGHT) ─────── */}
        <div className="w-[440px] xl:w-[480px] bg-white border-l border-gray-200 flex flex-col shadow-sm">
          {/* Cart header */}
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-600" />
              <span className="font-semibold text-sm text-gray-800">Carrito</span>
              {cart.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {cart.length}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-[10px] text-red-500 hover:text-red-700 font-medium">
                Vaciar
              </button>
            )}
          </div>

          {/* Customer strip */}
          <div className="px-4 py-2 border-b border-gray-100">
            {customer ? (
              <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-900 truncate">{getCustomerDisplayName()}</p>
                    <p className="text-[10px] text-blue-600 truncate">{customer.document_type}: {customer.document_number}
                      {customer.discount_percentage > 0 && <span className="text-green-600 ml-1"> • {customer.discount_percentage}% desc</span>}
                    </p>
                  </div>
                </div>
                <button onClick={handleRemoveCustomer} className="text-blue-400 hover:text-blue-700 ml-2 flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomerSearch(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition text-xs"
              >
                <UserPlus className="w-3.5 h-3.5" /> Cliente
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300">
                <ShoppingCart className="w-12 h-12 mb-2 opacity-40" />
                <p className="text-xs">Escanea o selecciona productos</p>
              </div>
            ) : cart.map((item, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 group">
                {/* Row 1: name + remove */}
                <div className="flex items-start justify-between mb-1.5">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-medium text-gray-800 leading-tight truncate">{item.product_name}</h4>
                    <p className="text-[10px] text-gray-400">{item.presentation_name}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product_id, item.presentation_id)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Row 2: mode toggle + qty + subtotal */}
                <div className="flex items-center justify-between gap-2">
                  {/* Package/Unit toggle */}
                  <button
                    onClick={() => toggleSellMode(item.product_id, item.presentation_id)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition ${item.sellByUnit
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-blue-100 text-blue-700'
                      }`}
                    title={item.sellByUnit ? `Vendiendo por unidad` : `Vendiendo por paquete (${item.units_per_package} uds)`}
                  >
                    {item.sellByUnit ? <Hash className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                    {item.sellByUnit ? 'Und' : 'Paq'}
                  </button>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.presentation_id, item.quantity - 1)}
                      className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300 transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.presentation_id, item.quantity + 1)}
                      className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300 transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Price + subtotal */}
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">{formatMoney(item.current_price)} c/u</p>
                    <p className="text-xs font-bold text-gray-800">{formatMoney(item.quantity * item.current_price)}</p>
                  </div>
                </div>

                {/* Discount row (only if customer discount or expanded) */}
                {(item.discount_percent > 0 || (customer && customer.discount_percentage > 0)) && (
                  <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-gray-100">
                    <label className="text-[10px] text-gray-500">Desc:</label>
                    <input
                      type="number" min="0" max="100"
                      value={item.discount_percent}
                      onChange={e => updateDiscount(item.product_id, item.presentation_id, e.target.value)}
                      className="w-12 px-1 py-0.5 text-[10px] border border-gray-200 rounded text-center"
                      disabled={customer && customer.discount_percentage > 0}
                    />
                    <span className="text-[10px] text-gray-400">%</span>
                    {customer && customer.discount_percentage > 0 && (
                      <span className="text-[10px] text-green-600 font-medium">(Cliente)</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ─── TOTALS (sticky bottom) ─── */}
          <div className="border-t border-gray-200 px-4 py-3 bg-white">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Subtotal</span>
                <span>{formatMoney(totals.subtotal)}</span>
              </div>
              {parseFloat(totals.discount) > 0 && (
                <div className="flex justify-between text-xs text-red-500">
                  <span>Descuento</span>
                  <span>- {formatMoney(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-lg border-t border-gray-100 pt-2 mt-1">
                <span className="text-gray-800">Total</span>
                <span className="text-blue-600">{formatMoney(totals.total)}</span>
              </div>
            </div>

            {/* Currency toggle */}
            {exchangeRates.length > 0 && parseFloat(totals.total) > 0 && (
              <button
                onClick={() => setShowCurrencyTotals(!showCurrencyTotals)}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-600 mt-1 transition"
              >
                <Repeat className="w-3 h-3" />
                {showCurrencyTotals ? 'Ocultar divisas' : 'Ver en divisas'}
                {showCurrencyTotals ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}

            {showCurrencyTotals && (
              <div className="mt-1.5 bg-slate-50 rounded p-2 space-y-1">
                {CURRENCIES.filter(c => c.code !== 'USD').map(cur => {
                  const converted = convertToOtherCurrency(totals.totalRaw, cur.code);
                  return (
                    <div key={cur.code} className="flex justify-between text-xs">
                      <span className="text-gray-500">{cur.name} ({cur.code})</span>
                      <span className="font-medium text-gray-700">
                        {converted !== null ? formatMoney(converted, cur.symbol) : 'Sin tasa'}
                      </span>
                    </div>
                  );
                })}
                <p className="text-[9px] text-gray-400 pt-1 border-t border-gray-200">
                  Tasas del {exchangeRates[0]?.effective_date || 'día'}
                </p>
              </div>
            )}

            {/* Checkout button */}
            <button
              onClick={() => setShowCheckoutModal(true)}
              disabled={cart.length === 0}
              className="w-full mt-3 bg-emerald-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Cobrar $ {totals.total}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════ CHECKOUT MODAL ═══════════════ */}
      <Modal isOpen={showCheckoutModal} onClose={() => setShowCheckoutModal(false)} title="Cobrar Venta" size="md">
        <div className="space-y-4">
          {/* Sale Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de Venta</label>
            <div className="grid grid-cols-2 gap-2">
              {['cash', 'credit'].map(type => (
                <button
                  key={type}
                  onClick={() => {
                    setSaleType(type);
                    if (type === 'credit' && !customer) setShowCustomerSearch(true);
                  }}
                  className={`py-2 rounded-lg text-sm font-medium transition ${saleType === type ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {type === 'cash' ? 'Contado' : 'Crédito'}
                </button>
              ))}
            </div>
          </div>

          {saleType === 'credit' && customer && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              Venta a crédito para <strong>{getCustomerDisplayName()}</strong>. Plazo: {customer.credit_days} días.
            </div>
          )}

          {/* Payment Lines (cash only) */}
          {saleType === 'cash' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Pagos Recibidos</label>
                <button onClick={addPaymentLine} className="text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> Agregar pago
                </button>
              </div>

              <div className="space-y-2">
                {paymentLines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    {/* Currency */}
                    <select
                      value={line.currency}
                      onChange={e => updatePaymentLine(idx, 'currency', e.target.value)}
                      className="text-xs border border-gray-200 rounded px-1.5 py-1.5 bg-white w-20"
                    >
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>

                    {/* Method */}
                    <div className="flex gap-1">
                      {PAYMENT_METHODS.map(pm => {
                        const Icon = pm.icon;
                        return (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => updatePaymentLine(idx, 'method', pm.id)}
                            className={`p-1.5 rounded transition ${line.method === pm.id
                              ? pm.activeClass
                              : 'text-gray-400 hover:text-gray-600'
                              }`}
                            title={pm.label}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>

                    {/* Amount */}
                    <input
                      type="number"
                      step="0.01"
                      value={line.amount}
                      onChange={e => updatePaymentLine(idx, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm text-right font-medium bg-white"
                    />

                    {/* Remove line */}
                    {paymentLines.length > 1 && (
                      <button onClick={() => removePaymentLine(idx)} className="text-gray-400 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Payment totals */}
              <div className="mt-3 bg-slate-50 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total a pagar:</span>
                  <span className="font-bold text-gray-800">{formatMoney(totals.total)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total recibido (USD):</span>
                  <span className="font-bold text-gray-800">{formatMoney(getTotalPaidUSD())}</span>
                </div>
                {getTotalPaidUSD() >= parseFloat(totals.total) && (
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5">
                    <span className="text-green-700 font-medium">Cambio:</span>
                    <span className="text-green-700 font-bold">
                      {formatMoney(Math.max(0, getTotalPaidUSD() - parseFloat(totals.total)))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Complete sale button */}
          <button
            onClick={handleCompleteSale}
            disabled={loading || cart.length === 0 || (saleType === 'credit' && !customer)}
            className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-sm"
          >
            {loading ? 'Procesando...' : `Completar Venta — ${formatMoney(totals.total)}`}
          </button>
        </div>
      </Modal>

      {/* ═══════════════ RESULT MODAL ═══════════════ */}
      <Modal isOpen={showResultModal} onClose={() => setShowResultModal(false)} title="Venta Completada" size="sm">
        {completedSale && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <ShoppingCart className="w-8 h-8 text-green-600" />
            </div>

            <div>
              <p className="text-lg font-bold text-gray-800">{completedSale.sale_number}</p>
              <p className="text-sm text-gray-500">Venta registrada exitosamente</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total:</span>
                <span className="font-bold">{formatMoney(completedSale.totals?.total)}</span>
              </div>
              {parseFloat(completedSale.changeAmount) > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Cambio:</span>
                  <span className="font-bold">{formatMoney(completedSale.changeAmount)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePrintTicket}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button
                onClick={() => setShowResultModal(false)}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══════════════ CUSTOMER SEARCH MODAL ═══════════════ */}
      <CustomerSearch
        isOpen={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        onSelect={handleCustomerSelect}
        validateCredit={saleType === 'credit'}
        saleAmount={parseFloat(totals.total)}
      />
    </div>
  );
};

export default POSPage;
