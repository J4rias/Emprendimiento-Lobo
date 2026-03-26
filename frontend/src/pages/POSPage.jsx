import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Trash2, Plus, Minus, Search, User, CreditCard,
  Banknote, Smartphone, X, UserPlus, Package, Hash, Printer,
  ChevronDown, ChevronUp, Clock, DollarSign, Repeat, Lock
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

const emptyPaymentLine = () => ({ currency: 'COP', method: 'cash', amount: '' });

// ──────────────────────── COMPONENTS ───────────────────────
const PriceEditor = ({ item, displayCurrency, exchangeRates, updatePrice }) => {
  const [localValue, setLocalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      let displayPrice;
      if (item.is_frozen) {
        // If frozen, start from the frozen price base
        const baseFrozen = item.sellByUnit ? (item.frozen_price / item.units_per_package) : item.frozen_price;
        if (displayCurrency === item.frozen_currency) {
          displayPrice = baseFrozen;
        } else {
          const rate = calculateEffectiveRate(item.frozen_currency, displayCurrency, exchangeRates) || 1;
          displayPrice = baseFrozen * rate;
        }
      } else {
        // Normal item: show unit price when in unit mode, package price otherwise
        const rate = displayCurrency === 'USD' ? 1 : (calculateEffectiveRate('USD', displayCurrency, exchangeRates) || 1);
        const basePrice = item.sellByUnit ? (item.unit_price_each || item.package_price / item.units_per_package) : item.package_price;
        displayPrice = (basePrice || 0) * rate;
      }

      const isCOP = displayCurrency === 'COP';
      setLocalValue(displayPrice ? (isCOP ? Math.round(displayPrice).toString() : displayPrice.toFixed(2)) : '');
    }
  }, [item.package_price, item.frozen_price, item.is_frozen, displayCurrency, exchangeRates, isFocused]);

  const handleChange = (e) => {
    setLocalValue(e.target.value);
    updatePrice(item.product_id, item.presentation_id, item.sellByUnit, e.target.value);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    if (!e.target.value || parseFloat(e.target.value) < 0) {
      let originalUSD = item.sellByUnit ? item.unit_price_each : item.package_price;
      let rate = displayCurrency === 'USD' ? 1 : (calculateEffectiveRate('USD', displayCurrency, exchangeRates) || 1);
      updatePrice(item.product_id, item.presentation_id, item.sellByUnit, originalUSD * rate);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {item.is_frozen && (
        <Lock className="w-3 h-3 text-blue-500" title={`Precio congelado en ${item.frozen_currency}`} />
      )}
      <input
        type="number"
        step="0.01"
        min="0"
        value={localValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        className={`w-24 text-right bg-white border rounded px-1 py-0.5 text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm ${item.is_frozen ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-gray-700 border-blue-200'}`}
        title="Editar precio unitario"
      />
    </div>
  );
};

// ──────────────────────── COMPONENT ────────────────────────
const POSPage = () => {
  const { user, hasPermission } = useAuth();
  const { companySettings } = useCompany();
  const searchInputRef = useRef(null);

  // ──────────────────── NEW FEATURE: UI Currency Masking ────────────────────
  const [displayCurrency, setDisplayCurrency] = useState('COP');


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
  const [selectedPriceListCurrency, setSelectedPriceListCurrency] = useState('USD');
  const [priceListDetails, setPriceListDetails] = useState({});

  // Payment / checkout
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [saleType, setSaleType] = useState('cash');
  const [paymentLines, setPaymentLines] = useState([emptyPaymentLine()]);
  const [activePaymentCurrency, setActivePaymentCurrency] = useState('COP');
  const [loading, setLoading] = useState(false);

  // Post-sale
  const [completedSale, setCompletedSale] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // Exchange rates
  const [exchangeRates, setExchangeRates] = useState([]);
  const [showCurrencyTotals, setShowCurrencyTotals] = useState(false);

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  const queryClient = useQueryClient();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const getEffectiveRate = useCallback((from, to) => {
    return calculateEffectiveRate(from, to, exchangeRates);
  }, [exchangeRates]);

  // Helper for currency formatting with thousands separator (masks to displayCurrency)
  const formatMoney = (amount, forceCurrency = null, item = null) => {
    const targetCurrency = forceCurrency || displayCurrency;
    const currencyDef = CURRENCIES.find(c => c.code === targetCurrency) || CURRENCIES[0];

    let displayAmount = parseFloat(amount || 0);

    if (item && item.is_frozen) {
      const baseFrozen = item.sellByUnit ? (item.frozen_price / item.units_per_package) : item.frozen_price;
      const frozenTotal = baseFrozen * (item.quantity || 1);
      if (targetCurrency === item.frozen_currency) {
        displayAmount = frozenTotal;
      } else {
        const rate = calculateEffectiveRate(item.frozen_currency, targetCurrency, exchangeRates);
        displayAmount = rate !== null ? frozenTotal * rate : frozenTotal;
      }
    } else if (targetCurrency !== 'USD') {
      const rate = calculateEffectiveRate('USD', targetCurrency, exchangeRates);
      displayAmount = rate !== null ? displayAmount * rate : displayAmount;
    }

    // COP doesn't use decimals in practice, round to 0 to avoid jitter like .25
    const isCOP = targetCurrency === 'COP';
    if (isCOP) displayAmount = Math.round(displayAmount);

    return `${currencyDef.symbol} ${displayAmount.toLocaleString('de-DE', {
      minimumFractionDigits: isCOP ? 0 : 2,
      maximumFractionDigits: isCOP ? 0 : 2
    })}`;
  };

  // ──────────────────── EFFECTS ────────────────────
  // Initial Load from LocalStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('pos_cart');
    const savedCustomer = localStorage.getItem('pos_customer');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) { console.error('Error parsing saved cart', e); }
    }
    if (savedCustomer) {
      try {
        setCustomer(JSON.parse(savedCustomer));
      } catch (e) { console.error('Error parsing saved customer', e); }
    }
  }, []);

  // Persist to LocalStorage whenever cart/customer change
  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
    localStorage.setItem('pos_customer', JSON.stringify(customer));
  }, [cart, customer]);

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

  // Debounce searchTerm → debouncedSearch (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch products with cache — staleTime 30s: repeated searches reuse cached data
  const { data: productsQueryData } = useQuery({
    queryKey: ['pos-products', debouncedSearch, selectedPriceList],
    queryFn: () => productService.getAll({
      search: debouncedSearch, limit: 1000, is_active: true,
      price_list_id: selectedPriceList || undefined
    }),
    enabled: !!selectedPriceList,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Sync products state + barcode auto-add when query data changes
  useEffect(() => {
    const results = productsQueryData?.data || [];
    setProducts(results);
    const trimmed = searchTerm.trim();
    if (trimmed && results.length === 1) {
      const product = results[0];
      const match = (product.barcodes || []).some(b => b.barcode === trimmed);
      if (match) { addToCart(product); setSearchTerm(''); }
    }
  }, [productsQueryData]);

  useEffect(() => { loadPriceLists(); }, []);
  useEffect(() => { loadExchangeRates(); }, []);

  useEffect(() => {
    if (customer && customer.discountPercentage > 0) {
      setCart(prev => prev.map(item => ({ ...item, discount_percent: customer.discountPercentage })));
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
      setSelectedPriceListCurrency('USD');
      setPriceListDetails({});
      localStorage.removeItem('lastPriceListId');
      return;
    }
    try {
      const res = await priceListService.getById(listId);
      const data = res.data;
      const map = {};
      (data?.details || []).forEach(d => { map[`${d.product_id}-${d.presentation_id}`] = d; });
      setPriceListDetails(map);
      setSelectedPriceListCurrency(data?.currency || 'USD');

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
    return {
      totalUnits,
      availablePackages: Math.floor(totalUnits / unitsPerPkg),
      looseUnits: totalUnits % unitsPerPkg,
      unitsPerPkg
    };
  };

  const getPrice = (product, presentation) => {
    if (!presentation) return { pkgPrice: 0, unitPrice: 0 };

    const key = `${product.id}-${presentation.id}`;
    const detail = priceListDetails[key];

    let pkgPrice = detail && parseFloat(detail.package_price) > 0 ? parseFloat(detail.package_price) : (parseFloat(presentation.package_price) || 0);
    let unitPrice = detail && parseFloat(detail.unit_price) > 0 ? parseFloat(detail.unit_price) : 0;

    // Use high precision for normalization to avoid rounding jitter later
    // If the price comes from a specific list detail, we use the LIST currency.
    // Otherwise, we fallback to the presentation's purchase currency.
    const sourceCurrency = detail ? selectedPriceListCurrency : (presentation.purchase_currency || 'USD');

    if (sourceCurrency !== 'USD') {
      const rate = calculateEffectiveRate('USD', sourceCurrency, exchangeRates);
      if (rate && rate > 0) {
        pkgPrice = Math.round((pkgPrice / rate) * 1000000) / 1000000;
        unitPrice = Math.round((unitPrice / rate) * 1000000) / 1000000;
      }
    }

    return {
      pkgPrice,
      unitPrice,
      is_frozen: detail?.is_frozen || false,
      frozen_price: detail?.frozen_price,
      frozen_currency: detail?.frozen_currency
    };
  };

  const addToCart = (product) => {
    const pres = product.presentations?.[0];
    if (!pres) { toast.error('Producto sin presentaciones configuradas'); return; }

    const { totalUnits, availablePackages, looseUnits, unitsPerPkg } = getProductStock(product, pres);
    const priceInfo = getPrice(product, pres);
    const { pkgPrice, unitPrice } = priceInfo;

    const targetSellByUnit = availablePackages <= 0 && looseUnits > 0;
    const existing = cart.find(i => i.product_id === product.id && i.presentation_id === pres.id && i.sellByUnit === targetSellByUnit);

    const currentTotalUnitsInCart = cart.filter(i => i.product_id === product.id && i.presentation_id === pres.id)
      .reduce((sum, i) => sum + (i.sellByUnit ? i.quantity : i.quantity * i.units_per_package), 0);

    const unitsToAdd = targetSellByUnit ? 1 : unitsPerPkg;

    if (currentTotalUnitsInCart + unitsToAdd > totalUnits) {
      toast.error(`Stock global insuficiente. Disponibles: ${totalUnits} unidades totales`);
      return;
    }

    if (existing) {
      updateQuantity(existing.product_id, existing.presentation_id, existing.sellByUnit, existing.quantity + 1);
    } else {
      setCart(prev => [...prev, {
        product_id: product.id,
        presentation_id: pres.id,
        product_name: product.name,
        presentation_name: pres.name,
        units_per_package: unitsPerPkg,
        quantity: 1,
        stock_units: totalUnits,
        stock_packages: availablePackages,
        sellByUnit: targetSellByUnit,
        package_price: pkgPrice,
        unit_price_each: unitPrice || (pkgPrice / unitsPerPkg),
        current_price: targetSellByUnit ? (unitPrice || (pkgPrice / unitsPerPkg)) : pkgPrice,
        tax_percent: 0,
        discount_percent: customer?.discountPercentage || 0,
        is_frozen: priceInfo.is_frozen,
        frozen_price: priceInfo.frozen_price,
        frozen_currency: priceInfo.frozen_currency
      }]);
    }
  };

  const toggleSellMode = (productId, presentationId, currentSellByUnit) => {
    const item = cart.find(i => i.product_id === productId && i.presentation_id === presentationId && i.sellByUnit === currentSellByUnit);
    if (!item) return;

    const targetByUnit = !currentSellByUnit;
    const maxTargetQty = targetByUnit ? item.stock_units : item.stock_packages;

    if (!targetByUnit && maxTargetQty <= 0) {
      toast.error('No hay paquetes completos disponibles');
      return;
    }

    setCart(prev => {
      const existingOther = prev.find(i => i.product_id === productId && i.presentation_id === presentationId && i.sellByUnit === targetByUnit);

      // When switching to unit mode reset to 1 (original behavior);
      // when switching to package mode convert proportionally
      let convertedQty = targetByUnit
        ? 1
        : Math.floor(item.quantity / item.units_per_package);

      if (!targetByUnit && convertedQty < 1) {
        convertedQty = 1; // Ensure at least 1 package if they force the conversion
      }

      let finalQty = convertedQty;
      if (existingOther) {
        finalQty += existingOther.quantity;
      }
      finalQty = Math.max(1, Math.min(finalQty, maxTargetQty));

      // Validate global stock with new configuration
      const proposedUnits = targetByUnit ? finalQty : finalQty * item.units_per_package;

      if (proposedUnits > item.stock_units) {
        finalQty = targetByUnit ? item.stock_units : Math.floor(item.stock_units / item.units_per_package);
      }

      if (!existingOther) {
        return prev.map(i => {
          if (i.product_id === productId && i.presentation_id === presentationId && i.sellByUnit === currentSellByUnit) {
            return {
              ...i,
              sellByUnit: targetByUnit,
              quantity: finalQty,
              current_price: targetByUnit ? i.unit_price_each : i.package_price
            };
          }
          return i;
        });
      } else {
        return prev
          .filter(i => !(i.product_id === productId && i.presentation_id === presentationId && i.sellByUnit === currentSellByUnit))
          .map(i => {
            if (i.product_id === productId && i.presentation_id === presentationId && i.sellByUnit === targetByUnit) {
              return { ...i, quantity: finalQty };
            }
            return i;
          });
      }
    });
  };

  const updateQuantity = (productId, presentationId, sellByUnit, newQty) => {
    if (newQty <= 0) { removeFromCart(productId, presentationId, sellByUnit); return; }

    const item = cart.find(i => i.product_id === productId && i.presentation_id === presentationId && i.sellByUnit === sellByUnit);
    if (!item) return;

    const otherItem = cart.find(i => i.product_id === productId && i.presentation_id === presentationId && i.sellByUnit === !sellByUnit);
    const otherUnits = otherItem ? (otherItem.sellByUnit ? otherItem.quantity : otherItem.quantity * otherItem.units_per_package) : 0;

    const proposedUnits = sellByUnit ? newQty : newQty * item.units_per_package;
    if (proposedUnits + otherUnits > item.stock_units) {
      const availableUnitsForThis = item.stock_units - otherUnits;
      const maxAllowedQty = sellByUnit ? availableUnitsForThis : Math.floor(availableUnitsForThis / item.units_per_package);
      toast.error(`Stock insuficiente. Máximo disponible en esta unidad: ${maxAllowedQty}`);
      return;
    }

    setCart(prev => prev.map(i =>
      i.product_id === productId && i.presentation_id === presentationId && i.sellByUnit === sellByUnit ? { ...i, quantity: newQty } : i
    ));
  };

  const removeFromCart = (pid, presId, sellByUnit) => {
    setCart(prev => prev.filter(i => !(i.product_id === pid && i.presentation_id === presId && i.sellByUnit === sellByUnit)));
  };

  const updateDiscount = (pid, presId, sellByUnit, val) => {
    setCart(prev => prev.map(i =>
      i.product_id === pid && i.presentation_id === presId && i.sellByUnit === sellByUnit ? { ...i, discount_percent: parseFloat(val) || 0 } : i
    ));
  };

  const updatePrice = (pid, presId, sellByUnit, newDisplayValue) => {
    let rawVal = parseFloat(newDisplayValue) || 0;

    setCart(prev => prev.map(i => {
      if (i.product_id === pid && i.presentation_id === presId) {
        const unitsPerPkg = i.units_per_package || 1;
        let usdPackagePrice, usdUnitPrice, newFrozenPrice;

        if (i.is_frozen) {
          // If editing a frozen item, we update the frozen_price in its frozen_currency (likely current displayCurrency)
          newFrozenPrice = rawVal;
          const currentFrozenCurrency = displayCurrency;
          
          // Also calculate the equivalent USD for internal consistency (totals/backend)
          const toUSDRate = calculateEffectiveRate(currentFrozenCurrency, 'USD', exchangeRates) || 1;
          usdPackagePrice = Math.round((newFrozenPrice * toUSDRate) * 1000000) / 1000000;
          usdUnitPrice = Math.round((usdPackagePrice / unitsPerPkg) * 1000000) / 1000000;

          return {
            ...i,
            frozen_price: newFrozenPrice,
            frozen_currency: currentFrozenCurrency,
            package_price: usdPackagePrice,
            unit_price_each: usdUnitPrice,
            current_price: i.sellByUnit ? usdUnitPrice : usdPackagePrice
          };
        } else {
          // Normal item: normalize display value to USD first
          let usdVal = rawVal;
          if (displayCurrency !== 'USD') {
            const rate = calculateEffectiveRate('USD', displayCurrency, exchangeRates) || 1;
            usdVal = usdVal / rate;
          }
          
          usdPackagePrice = Math.round(usdVal * 1000000) / 1000000;
          usdUnitPrice = Math.round((usdPackagePrice / unitsPerPkg) * 1000000) / 1000000;

          return {
            ...i,
            package_price: usdPackagePrice,
            unit_price_each: usdUnitPrice,
            current_price: i.sellByUnit ? usdUnitPrice : usdPackagePrice
          };
        }
      }
      return i;
    }));
  };

  const clearCart = () => {
    setCart([]);
    setCustomer(null);
    localStorage.removeItem('pos_cart');
    localStorage.removeItem('pos_customer');
  };

  // ──────────────────── CUSTOMERS ────────────────────
  const handleCustomerSelect = (c) => {
    setCustomer(c);
    if (c.discountPercentage > 0) {
      setCart(prev => prev.map(i => ({ ...i, discount_percent: c.discountPercentage })));
    }
  };

  const handleRemoveCustomer = () => {
    setCustomer(null);
    setCart(prev => prev.map(i => ({ ...i, discount_percent: 0 })));
  };

  const getCustomerDisplayName = () => {
    if (!customer) return '';
    return customer.type === 'natural'
      ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
      : customer.businessName || customer.tradeName || '';
  };

  // ──────────────────── TOTALS ────────────────────
  // +7% surcharge when selling individual units below half the package quantity.
  // Rounds to the nearest 100 COP before converting back to USD.
  const applyUnitSurcharge = (usdUnitPrice, item) => {
    if (!item.sellByUnit || item.quantity >= item.units_per_package / 2) return usdUnitPrice;
    const copRate = calculateEffectiveRate('USD', 'COP', exchangeRates);
    if (!copRate || copRate <= 0) return usdUnitPrice * 1.07;
    const copRounded = Math.round(usdUnitPrice * copRate * 1.07 / 100) * 100;
    return copRounded / copRate;
  };

  const getEffectiveUSDPrice = (item) => {
    if (item.is_frozen) {
      const rate = calculateEffectiveRate(item.frozen_currency, 'USD', exchangeRates);
      const baseFrozen = item.sellByUnit ? (item.frozen_price / item.units_per_package) : item.frozen_price;
      const usdPrice = rate !== null ? baseFrozen * rate : item.current_price;
      return applyUnitSurcharge(usdPrice, item);
    }
    return applyUnitSurcharge(item.current_price, item);
  };

  const calculateItemSubtotal = (item) => {
    const usdPrice = getEffectiveUSDPrice(item);
    const sub = item.quantity * usdPrice;
    const disc = sub * (item.discount_percent / 100);
    return sub - disc;
  };

  const calculateTotals = useCallback(() => {
    let subtotal = 0, totalDiscount = 0;
    cart.forEach(item => {
      const usdPrice = getEffectiveUSDPrice(item);
      const sub = item.quantity * usdPrice;
      const disc = sub * (item.discount_percent / 100);
      subtotal += sub; totalDiscount += disc;
    });
    const finalTotal = subtotal - totalDiscount;
    return {
      subtotal: subtotal,
      discount: totalDiscount,
      tax: 0,
      total: finalTotal,
      totalRaw: finalTotal
    };
  }, [cart]);

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
        exchange_rate: getEffectiveRate('USD', 'COP') || 1,
        payment_lines: paymentLines.map(line => ({
          ...line,
          exchange_rate: getEffectiveRate('USD', line.currency) || 1
        })),
        items: cart.map(item => ({
          product_id: item.product_id,
          presentation_id: item.presentation_id,
          quantity: item.quantity,
          is_unit: item.sellByUnit,
          unit_price: getEffectiveUSDPrice(item),
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent
        })),
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

      toast.success(`¡Venta ${response.sale.sale_number} completada!`);
      clearCart();
      setSaleType('cash');
      setPaymentLines([emptyPaymentLine()]);
      setSearchTerm('');
      setShowCheckoutModal(false);
      setShowResultModal(true);

      // Real-time inventory refresh (invalidate cache to force fresh data)
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });

    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al procesar la venta');
    } finally { setLoading(false); }
  };

  const handlePrintTicket = () => {
    if (completedSale) {
      printSaleTicket(completedSale, companySettings, {
        displayCurrency,
        currencySymbol: CURRENCIES.find(c => c.code === displayCurrency)?.symbol || '$',
        exchangeRate: calculateEffectiveRate('USD', displayCurrency, exchangeRates) || 1
      });
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

          {/* Display Currency Toggle */}
          <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700">
            {CURRENCIES.map(curr => (
              <button
                key={curr.code}
                onClick={() => setDisplayCurrency(curr.code)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${displayCurrency === curr.code
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
              >
                {curr.code}
              </button>
            ))}
          </div>

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
                  const { availablePackages, looseUnits, totalUnits, unitsPerPkg } = getProductStock(product, pres);
                  const priceInfo = getPrice(product, pres);
                  const pkgPrice = priceInfo.pkgPrice;
                  const lowStock = totalUnits <= unitsPerPkg * 3;

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
                        <span className={`text-[10px] font-medium flex flex-col leading-tight ${lowStock ? 'text-amber-600' : 'text-gray-500'}`}>
                          <span>{availablePackages} disp</span>
                          {looseUnits > 0 && <span className="text-[9px] text-gray-400">+{looseUnits} uds</span>}
                        </span>
                        <span className="text-sm font-bold text-blue-600">
                          {formatMoney(pkgPrice, null, priceInfo)}
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
                    <p className="text-[10px] text-blue-600 truncate">{customer.documentType}-{customer.documentNumber}
                      {customer.discountPercentage > 0 && <span className="text-green-600 ml-1"> • {customer.discountPercentage}% desc</span>}
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
                    onClick={() => removeFromCart(item.product_id, item.presentation_id, item.sellByUnit)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Row 2: mode toggle + qty + subtotal */}
                <div className="flex items-center justify-between gap-2">
                  {/* Package/Unit toggle */}
                  <button
                    onClick={() => toggleSellMode(item.product_id, item.presentation_id, item.sellByUnit)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition ${item.sellByUnit
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-blue-100 text-blue-700'
                      }`}
                    title={item.sellByUnit ? `Vendiendo por unidad` : `Vendiendo por paquete (${item.units_per_package} uds)`}
                  >
                    {item.sellByUnit ? <Hash className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                    {item.sellByUnit ? 'Und' : 'Paq'}
                  </button>
                  {item.sellByUnit && item.quantity < item.units_per_package / 2 && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-300 rounded px-1 py-0.5 leading-none" title={`Recargo del 7% por compra menor a ${Math.ceil(item.units_per_package / 2)} unidades`}>
                      +7%
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    {/* Qty Controls */}
                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded p-0.5 shadow-sm mt-1">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.presentation_id, item.sellByUnit, item.quantity - 1)}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product_id, item.presentation_id, item.sellByUnit, parseInt(e.target.value) || 1)}
                        className="w-8 text-center text-xs font-semibold text-gray-800 bg-transparent border-none p-0 focus:ring-0 appearance-none"
                      />
                      <button
                        onClick={() => updateQuantity(item.product_id, item.presentation_id, item.sellByUnit, item.quantity + 1)}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Subtotal & Price Edit */}
                    <div className="flex flex-col items-end border-l border-gray-200 pl-2 ml-1">
                      {hasPermission('sales.edit_price') ? (
                        <div className="flex items-center gap-0.5 mb-1">
                          <span className="text-[10px] text-gray-400 font-medium">
                            {CURRENCIES.find(c => c.code === displayCurrency)?.symbol}
                          </span>
                          <PriceEditor
                            item={item}
                            displayCurrency={displayCurrency}
                            exchangeRates={exchangeRates}
                            updatePrice={updatePrice}
                          />
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-500 mb-1">{formatMoney(item.current_price)} c/u</span>
                      )}
                      <span className="w-32 flex-shrink-0 whitespace-nowrap text-right font-bold text-sm text-gray-900 leading-none">
                        {formatMoney(calculateItemSubtotal(item))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 3: discount (optional) */}
                {(customer?.discountPercentage > 0 || item.discount_percent > 0) && (
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className="text-gray-500">Descuento:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount_percent || 0}
                        onChange={(e) => updateDiscount(item.product_id, item.presentation_id, item.sellByUnit, e.target.value)}
                        className="w-10 text-right bg-white border border-gray-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-gray-400">%</span>
                    </div>
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
                        {converted !== null ? formatMoney(totals.totalRaw, cur.code) : 'Sin tasa'}
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
              Cobrar {formatMoney(totals.totalRaw)}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════ CHECKOUT MODAL ═══════════════ */}
      <Modal isOpen={showCheckoutModal} onClose={() => setShowCheckoutModal(false)} title="Cobrar Venta" size="lg">
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
              Venta a crédito para <strong>{getCustomerDisplayName()}</strong>. Plazo: {customer.creditDays} días.
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

                        // Disable credit balance if not a customer or balance is 0
                        const isCreditBalance = pm.id === 'credit_balance';
                        const disableWallet = isCreditBalance && (!customer || !customer.creditBalance || parseFloat(customer.creditBalance) <= 0);

                        return (
                          <button
                            key={pm.id}
                            type="button"
                            disabled={disableWallet}
                            onClick={() => {
                              if (!disableWallet) {
                                updatePaymentLine(idx, 'method', pm.id);
                                // Auto-fill amount based on credit balance if it's the wallet
                                if (isCreditBalance && customer?.creditBalance) {
                                  const totals = calculateTotals();
                                  const maxNeeded = parseFloat(totals.total) - getTotalPaidUSD();
                                  const maxAvailable = parseFloat(customer.creditBalance); // Balance in USD
                                  const availableInLineCurrency = convertToOtherCurrency(maxAvailable, line.currency) || maxAvailable;
                                  const neededInLineCurrency = convertToOtherCurrency(Math.max(0, maxNeeded), line.currency) || Math.max(0, maxNeeded);

                                  const toApply = Math.min(availableInLineCurrency, neededInLineCurrency);
                                  if (toApply > 0) {
                                    updatePaymentLine(idx, 'amount', toApply.toFixed(2));
                                  }
                                }
                              }
                            }}
                            className={`p-1.5 rounded transition ${line.method === pm.id
                              ? pm.activeClass
                              : disableWallet
                                ? 'text-gray-300 cursor-not-allowed hidden' // hide if no balance to save space
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                              }`}
                            title={pm.label + (isCreditBalance && customer ? ` ($${parseFloat(customer.creditBalance || 0).toFixed(2)})` : '')}
                          >
                            <Icon className="w-4 h-4" />
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
                      onFocus={() => setActivePaymentCurrency(line.currency)}
                      placeholder="0.00"
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm text-right font-medium bg-white focus:ring-2 focus:ring-blue-500"
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

                {/* Breakdown by currency */}
                <div className="pt-1 space-y-1 border-y border-gray-100 py-1.5 my-1">
                  {CURRENCIES.map(curr => {
                    const totalForCurr = paymentLines
                      .filter(l => l.currency === curr.code)
                      .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

                    if (totalForCurr <= 0) return null;

                    return (
                      <div key={curr.code} className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Recibido en {curr.name}:</span>
                        <span className="font-medium text-slate-600">
                          {curr.symbol} {totalForCurr.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total recibido:</span>
                  <span className="font-bold text-gray-800">{formatMoney(getTotalPaidUSD())}</span>
                </div>

                <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5 mt-1.5">
                  {getTotalPaidUSD() >= parseFloat(totals.total) ? (
                    <>
                      <span className="text-green-700 font-medium">Cambio ({activePaymentCurrency}):</span>
                      <span className="text-green-700 font-bold">
                        {formatMoney(Math.max(0, getTotalPaidUSD() - parseFloat(totals.total)), activePaymentCurrency)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-amber-700 font-medium">Faltante ({activePaymentCurrency}):</span>
                      <span className="text-amber-700 font-bold">
                        {formatMoney(parseFloat(totals.total) - getTotalPaidUSD(), activePaymentCurrency)}
                      </span>
                    </>
                  )}
                </div>
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
        exchangeRates={exchangeRates}
      />
    </div>
  );
};

export default POSPage;
