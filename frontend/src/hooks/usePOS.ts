import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { printSaleTicket } from '../components/sales/SaleTicket';
import { useShallow } from 'zustand/react/shallow';
import { usePOSStore, usePOSSessionId } from '../stores/posStore';
import { usePOSSocket } from './usePOSSocket';
import { priceListService } from '../services/api/priceListService';
import { productService } from '../services/api/productService';
import { saleService } from '../services/api/saleService';
import { posReservationService } from '../services/api/posReservationService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { toast } from 'sonner';
import { convertPaymentLinesToBackend, adjustPaymentLinesForChange } from '../utils/paymentUtils';
import type { PaymentLine } from '../utils/paymentUtils';

// ============= CONSTANTS =============
export const CURRENCIES = [
  { code: 'USD', symbol: '$',    name: 'USD' },
  { code: 'COP', symbol: 'COP$', name: 'COP' },
  { code: 'VES', symbol: 'Bs',   name: 'VES' },
];

export const PAYMENT_METHODS = [
  { id: 'cash',     label: 'Efectivo' },
  { id: 'card',     label: 'Punto de venta' },
  { id: 'transfer', label: 'Transferencia' },
  { id: 'usdt',     label: 'USDT' },
];

export const METHODS_BY_CURRENCY = {
  COP: ['cash', 'transfer'],
  VES: ['cash', 'card', 'transfer'],
  USD: ['cash', 'transfer', 'usdt'],
};

// Tolerancia de redondeo para diferencias de conversión multi-moneda
export const COP_TOLERANCE = 40;

const POS_RATES_PREFIX = 'pos_custom_rates_';
export const getSavedRate = (currency: string, mode = 'COP'): number | null => {
  try {
    return JSON.parse(localStorage.getItem(POS_RATES_PREFIX + mode) || 'null')?.[currency]
      || JSON.parse(localStorage.getItem('pos_custom_rates') || 'null')?.[currency]
      || null;
  } catch { return null; }
};
export const saveRate = (currency: string, rate: number, mode = 'COP') => {
  try {
    const key = POS_RATES_PREFIX + mode;
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    saved[currency] = rate;
    localStorage.setItem(key, JSON.stringify(saved));
  } catch { /* ignore */ }
};

// ============= HOOK =============
export function usePOS() {
  const { hasPermission, user } = useAuth();
  const { companySettings } = useCompany();
  const sessionId = usePOSSessionId();

  // ============= STORE =============
  const {
    tabs, activeTabId, otherReservations, getAvailableUnits,
    addToCart, updateQuantity, updateCartItemPrice, updateCartItemDiscount,
    applyDiscountToAll, toggleSellMode, removeFromCart,
    setTabCustomer, closeTab, recalculateCartPrices,
  } = usePOSStore(useShallow(s => ({
    tabs: s.tabs, activeTabId: s.activeTabId,
    otherReservations: s.otherReservations, getAvailableUnits: s.getAvailableUnits,
    addToCart: s.addToCart, updateQuantity: s.updateQuantity,
    updateCartItemPrice: s.updateCartItemPrice, updateCartItemDiscount: s.updateCartItemDiscount,
    applyDiscountToAll: s.applyDiscountToAll, toggleSellMode: s.toggleSellMode,
    removeFromCart: s.removeFromCart, setTabCustomer: s.setTabCustomer, closeTab: s.closeTab,
    recalculateCartPrices: s.recalculateCartPrices,
  })));

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const cart = activeTab?.cart || [];
  const customer = activeTab?.customer || null;

  // ============= LOCAL STATE =============
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [selectedPriceList, setSelectedPriceList] = useState<number | null>(null);
  const [selectedPriceListCurrency, setSelectedPriceListCurrency] = useState('USD');
  const [priceListDetails, setPriceListDetails] = useState<Record<string, any>>({});
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);
  const [displayCurrency, _setDisplayCurrency] = useState(() => localStorage.getItem('pos_display_currency') || 'COP');
  const setDisplayCurrency = useCallback((c: string) => { localStorage.setItem('pos_display_currency', c); _setDisplayCurrency(c); }, []);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // ============= MODAL STATES =============
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showConflictAlert, setShowConflictAlert] = useState(false);
  const [showCurrencyTotals, setShowCurrencyTotals] = useState(false);
  const [showCreditPinModal, setShowCreditPinModal] = useState(false);

  const isAdmin = hasPermission('settings.manage');
  const [conflictData, setConflictData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // ============= CHECKOUT STATE =============
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [notes, setNotes] = useState('');
  const [saleResult, setSaleResult] = useState<any>(null);

  // Derive saleType from payment lines
  const hasCreditLine = paymentLines.some(l => l.method === 'credit');
  const hasCashLines = paymentLines.some(l => l.method !== 'credit');
  const saleType = hasCreditLine && hasCashLines ? 'mixed' : hasCreditLine ? 'credit' : 'cash';

  // ============= CLOCK =============
  const [currentTime, setCurrentTime] = useState(new Date());

  // ============= REFS =============
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ============= CURRENCY HELPERS =============
  const displaySymbol = CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || '$';

  const toDisplay = useCallback(
    (amountUSD: number | string) => {
      const rate = calculateEffectiveRate('USD', displayCurrency, exchangeRates);
      return parseFloat(amountUSD || 0) * (rate || 1);
    },
    [displayCurrency, exchangeRates]
  );

  const fromDisplay = useCallback(
    (amountDisplay: number | string) => {
      const rate = calculateEffectiveRate('USD', displayCurrency, exchangeRates);
      return parseFloat(amountDisplay || 0) / (rate || 1);
    },
    [displayCurrency, exchangeRates]
  );

  const fmt = useCallback(
    (amount: number | string) => {
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

  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Debounce search term (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (selectedPriceList) loadProducts();
  }, [debouncedSearch, selectedPriceList]);

  useEffect(() => {
    if (searchInputRef.current) searchInputRef.current.focus();
  }, [activeTabId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length === 0) { toast.error('Agrega productos antes de continuar'); return; }
        if (canCollectPayment) setShowCheckoutModal(true);
        // Vendedor: F8 is handled by the page component (confirm dialog)
      }
      if (e.key === 'Escape') {
        setShowCheckoutModal(false);
        setShowResultModal(false);
        setShowCustomerSearch(false);
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

  const PRODUCTS_PER_PAGE = 20;

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      setProductPage(1);
      const res = await productService.getAll({
        search: debouncedSearch,
        page: 1,
        limit: PRODUCTS_PER_PAGE,
        is_active: true,
        price_list_id: selectedPriceList || undefined,
      });
      const results = res.products || res.data || [];
      setProducts(results);
      setHasMoreProducts(res.pagination ? res.pagination.page < res.pagination.totalPages : false);

      // Auto-add on exact barcode match
      const trimmed = debouncedSearch.trim();
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

  const loadMoreProducts = async () => {
    if (loadingMore || !hasMoreProducts) return;
    try {
      setLoadingMore(true);
      const nextPage = productPage + 1;
      const res = await productService.getAll({
        search: debouncedSearch,
        page: nextPage,
        limit: PRODUCTS_PER_PAGE,
        is_active: true,
        price_list_id: selectedPriceList || undefined,
      });
      const results = res.products || res.data || [];
      setProducts((prev) => {
        const existingIds = new Set(prev.map((p: any) => p.id));
        const newOnly = results.filter((p: any) => !existingIds.has(p.id));
        return [...prev, ...newOnly];
      });
      setProductPage(nextPage);
      setHasMoreProducts(res.pagination ? res.pagination.page < res.pagination.totalPages : false);
    } catch (e) {
      console.error('Error loading more products:', e);
    } finally {
      setLoadingMore(false);
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

  const selectPriceList = async (listId: number | null) => {
    if (!listId) {
      setSelectedPriceList(null);
      setPriceListDetails({});
      localStorage.removeItem('lastPriceListId');
      return;
    }
    try {
      const res = await priceListService.getById(listId);
      const data = res.data;
      const map = {};
      (data?.details || []).forEach((d) => {
        map[`${d.product_id}-${d.presentation_id}`] = d;
      });
      setPriceListDetails(map);
      setSelectedPriceListCurrency(data?.currency || 'USD');
      setSelectedPriceList(listId);
      localStorage.setItem('lastPriceListId', listId.toString());
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar detalles de la lista de precios');
    }
  };

  // ============= PRICE HELPERS =============
  const getProductStock = useCallback((product: any) => {
    if (!product.inventories) return 0;
    return product.inventories.reduce((sum, inv) => sum + parseFloat(inv.quantity || 0), 0);
  }, []);

  const getPrice = useCallback(
    (product: any, presentation: any) => {
      if (!presentation) return { pkgPrice: 0, unitPrice: 0 };

      const key = `${product.id}-${presentation.id}`;
      const detail = priceListDetails[key];

      // Modo USD directo: usar package_price_usd sin conversión
      if (displayCurrency === 'USD' && detail) {
        const usdPrice = parseFloat(detail.package_price_usd) || 0;
        const unitsPerPkg = parseFloat(presentation.units_per_package) || 1;
        return {
          pkgPrice: usdPrice,
          unitPrice: usdPrice / unitsPerPkg,
          is_frozen: false,
          frozen_price: null,
          frozen_currency: null
        };
      }

      let pkgPrice = detail && parseFloat(detail.package_price) > 0
        ? parseFloat(detail.package_price)
        : (parseFloat(presentation.package_price) || 0);
      let unitPrice = detail && parseFloat(detail.unit_price) > 0
        ? parseFloat(detail.unit_price)
        : 0;

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
    },
    [priceListDetails, selectedPriceListCurrency, exchangeRates, displayCurrency]
  );

  const getEffectivePriceUSD = useCallback(
    (presentation: any, priceListItem: any) => {
      // Modo USD directo: usar package_price_usd sin conversión
      if (displayCurrency === 'USD' && priceListItem) {
        return parseFloat(priceListItem.package_price_usd) || 0;
      }

      if (priceListItem?.is_frozen && priceListItem.frozen_price) {
        const frozenCurrency = priceListItem.frozen_currency || 'USD';
        const rate = calculateEffectiveRate(frozenCurrency, 'USD', exchangeRates);
        return parseFloat(priceListItem.frozen_price) * (rate || 1);
      }

      let price = parseFloat(priceListItem?.package_price || priceListItem?.unit_price || presentation.base_price || 0);
      const sourceCurrency = priceListItem ? selectedPriceListCurrency : (presentation.purchase_currency || 'USD');
      if (sourceCurrency !== 'USD') {
        const rate = calculateEffectiveRate('USD', sourceCurrency, exchangeRates);
        if (rate && rate > 0) {
          price = Math.round((price / rate) * 1000000) / 1000000;
        }
      }
      return price;
    },
    [exchangeRates, selectedPriceListCurrency, displayCurrency]
  );

  // ============= RECALCULATE CART ON CURRENCY SWITCH =============
  useEffect(() => {
    if (!activeTabId || cart.length === 0) return;

    const priceMap = {};
    cart.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      if (!product) return;
      const presentation = product.presentations?.find(pr => pr.id === item.presentation_id);
      if (!presentation) return;

      const priceInfo = getPrice(product, presentation);
      if (priceInfo.pkgPrice <= 0) return; // skip if no price available in this mode

      const unitsPerPkg = parseFloat(presentation.units_per_package) || 1;
      const unitPriceEach = priceInfo.unitPrice || (priceInfo.pkgPrice / unitsPerPkg);
      const newUnitPrice = item.sellByUnit ? unitPriceEach : priceInfo.pkgPrice;

      const key = `${item.product_id}-${item.presentation_id}-${item.sellByUnit || false}`;
      priceMap[key] = {
        unit_price: newUnitPrice,
        package_price: priceInfo.pkgPrice,
        unit_price_each: unitPriceEach,
        is_frozen: priceInfo.is_frozen,
        frozen_price: priceInfo.frozen_price || null,
        frozen_currency: priceInfo.frozen_currency || null,
      };
    });

    if (Object.keys(priceMap).length > 0) {
      recalculateCartPrices(activeTabId, priceMap);
    }
  }, [displayCurrency]);  

  // ============= STOCK HELPERS =============
  const getProductStockDetails = useCallback((product: any, presentation: any) => {
    const totalUnits = (product.inventories || []).reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
    const unitsPerPkg = parseFloat(presentation?.units_per_package) || 1;
    return {
      totalUnits,
      availablePackages: Math.floor(totalUnits / unitsPerPkg),
      looseUnits: totalUnits % unitsPerPkg,
      unitsPerPkg
    };
  }, []);

  // ============= CART HANDLERS =============
  const handleAddProduct = async (product: any, presentation: any, qty = 1, forceSellByUnit: boolean | null = null) => {
    if (!presentation) { toast.error('Selecciona una presentación'); return; }
    if (!activeTabId) { toast.error('Abre una pestaña de venta primero'); return; }

    const unitsPerPackage = presentation.units_per_package || 1;
    const totalStock = getProductStock(product);
    const available = getAvailableUnits(product.id, totalStock);
    const { availablePackages, looseUnits } = getProductStockDetails(product, presentation);

    const sellByUnit = forceSellByUnit !== null
      ? forceSellByUnit
      : (availablePackages <= 0 && looseUnits > 0);

    const units = sellByUnit ? qty : qty * unitsPerPackage;

    const currentUnitsInCart = cart
      .filter(i => i.product_id === product.id && i.presentation_id === presentation.id)
      .reduce((sum, i) => sum + (i.sellByUnit ? i.quantity : i.quantity * i.units_per_package), 0);

    if (currentUnitsInCart + units > available) {
      setConflictData({ productName: product.name, requested: currentUnitsInCart + units, available, reservedByOthers: totalStock - available });
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
        units_requested: currentUnitsInCart + units,
      });

      const priceInfo = getPrice(product, presentation);
      const { pkgPrice, unitPrice: unitPriceFromList } = priceInfo;
      const unitPriceEach = unitPriceFromList || (pkgPrice / unitsPerPackage);

      addToCart(activeTabId, {
        product_id: product.id,
        presentation_id: presentation.id,
        product_name: product.name,
        product_sku: product.sku,
        presentation_name: presentation.name,
        units_per_package: unitsPerPackage,
        quantity: qty,
        sellByUnit,
        package_price: pkgPrice,
        unit_price_each: unitPriceEach,
        unit_price: sellByUnit ? unitPriceEach : pkgPrice,
        stock_units: totalStock,
        discount_percent: customer?.discountPercentage || 0,
        tax_percent: 0,
        is_frozen: priceInfo.is_frozen,
        frozen_price: priceInfo.frozen_price || null,
        frozen_currency: priceInfo.frozen_currency || null,
      });
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictData({
          productName: product.name,
          requested: currentUnitsInCart + units,
          available: err.response.data.available || 0,
          reservedByOthers: err.response.data.reserved_by_others || 0,
        });
        setShowConflictAlert(true);
      } else {
        toast.error('Error al reservar producto');
      }
    }
  };

  const handleRemoveItem = async (productId: number, presentationId: number, sellByUnit: boolean) => {
    const item = cart.find((i) =>
      i.product_id === productId &&
      i.presentation_id === presentationId &&
      (i.sellByUnit || false) === (sellByUnit || false)
    );
    if (!item) return;

    const unitsToRelease = sellByUnit ? item.quantity : item.quantity * item.units_per_package;

    const otherUnits = cart
      .filter(i => i.product_id === productId && i.presentation_id === presentationId &&
        !((i.sellByUnit || false) === (sellByUnit || false)))
      .reduce((sum, i) => sum + (i.sellByUnit ? i.quantity : i.quantity * i.units_per_package), 0);

    try {
      if (otherUnits > 0) {
        await posReservationService.reserve({
          session_id: sessionId,
          tab_id: activeTabId,
          user_id: user.id,
          product_id: productId,
          presentation_id: presentationId,
          units_requested: otherUnits,
        });
      } else {
        await posReservationService.releaseItem({
          session_id: sessionId,
          tab_id: activeTabId,
          presentation_id: presentationId,
          units_to_release: unitsToRelease,
        });
      }
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Error removing item:', err);
        toast.error('Error al remover producto');
        return;
      }
    }
    removeFromCart(activeTabId, productId, presentationId, sellByUnit);
  };

  const handleQuantityChange = async (productId: number, presentationId: number, sellByUnit: boolean, newQty: number) => {
    if (newQty < 1) return;

    const item = cart.find((i) =>
      i.product_id === productId &&
      i.presentation_id === presentationId &&
      (i.sellByUnit || false) === (sellByUnit || false)
    );
    if (!item) return;

    const newUnitsForThis = sellByUnit ? newQty : newQty * item.units_per_package;

    const otherUnits = cart
      .filter(i => i.product_id === productId && i.presentation_id === presentationId &&
        !((i.sellByUnit || false) === (sellByUnit || false)))
      .reduce((sum, i) => sum + (i.sellByUnit ? i.quantity : i.quantity * i.units_per_package), 0);

    const totalUnitsRequested = newUnitsForThis + otherUnits;

    try {
      await posReservationService.reserve({
        session_id: sessionId,
        tab_id: activeTabId,
        user_id: user.id,
        product_id: productId,
        presentation_id: presentationId,
        units_requested: totalUnitsRequested,
      });
      updateQuantity(activeTabId, productId, presentationId, sellByUnit, newQty);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictData({
          productName: item.product_name,
          requested: totalUnitsRequested,
          available: err.response.data.available || 0,
          reservedByOthers: err.response.data.reserved_by_others || 0,
        });
        setShowConflictAlert(true);
      } else {
        toast.error('Error al actualizar cantidad');
      }
    }
  };

  const handleToggleSellMode = async (productId: number, presentationId: number, currentSellByUnit: boolean) => {
    const item = cart.find(i =>
      i.product_id === productId &&
      i.presentation_id === presentationId &&
      (i.sellByUnit || false) === currentSellByUnit
    );
    if (!item) return;

    const targetByUnit = !currentSellByUnit;
    if (!targetByUnit && (item.stock_units || 0) < item.units_per_package) {
      toast.error('No hay paquetes completos disponibles');
      return;
    }

    toggleSellMode(activeTabId, productId, presentationId, currentSellByUnit);
  };

  const handlePriceChange = (productId: number, presentationId: number, sellByUnit: boolean, newPriceDisplay: number | string) => {
    const rawVal = parseFloat(newPriceDisplay) || 0;

    const item = cart.find(i =>
      i.product_id === productId &&
      i.presentation_id === presentationId &&
      (i.sellByUnit || false) === (sellByUnit || false)
    );

    if (item?.is_frozen) {
      const toUSDRate = calculateEffectiveRate(displayCurrency, 'USD', exchangeRates) || 1;
      const usdPrice = rawVal * toUSDRate;
      updateCartItemPrice(activeTabId, productId, presentationId, sellByUnit, usdPrice, {
        is_frozen: true,
        frozen_price: rawVal,
        frozen_currency: displayCurrency,
      });
    } else {
      const newPriceUSD = fromDisplay(rawVal);
      updateCartItemPrice(activeTabId, productId, presentationId, sellByUnit, newPriceUSD);
    }
  };

  const handleDiscountChange = (productId: number, presentationId: number, sellByUnit: boolean, val: number) => {
    updateCartItemDiscount(activeTabId, productId, presentationId, sellByUnit, val);
  };

  const handleSetCustomer = (c: any) => {
    setTabCustomer(activeTabId, c);
    if (c && c.discountPercentage > 0) {
      applyDiscountToAll(activeTabId, c.discountPercentage);
    }
  };

  const handleClearCustomer = () => {
    setTabCustomer(activeTabId, null);
    applyDiscountToAll(activeTabId, 0);
  };

  // ============= SURCHARGE & EFFECTIVE PRICE =============
  const applyUnitSurcharge = useCallback((usdUnitPrice: number, item: any) => {
    if (!item.sellByUnit || item.quantity >= (item.units_per_package || 1) / 2) return usdUnitPrice;
    const copRate = calculateEffectiveRate('USD', 'COP', exchangeRates);
    if (!copRate || copRate <= 0) return usdUnitPrice * 1.07;
    const copRounded = Math.round(usdUnitPrice * copRate * 1.07 / 100) * 100;
    return copRounded / copRate;
  }, [exchangeRates]);

  const getEffectiveUSDPrice = useCallback((item: any) => {
    if (item.is_frozen && item.frozen_price) {
      const rate = calculateEffectiveRate(item.frozen_currency || 'USD', 'USD', exchangeRates);
      const baseFrozen = item.sellByUnit
        ? (parseFloat(item.frozen_price) / (item.units_per_package || 1))
        : parseFloat(item.frozen_price);
      const usdPrice = rate !== null ? baseFrozen * rate : item.unit_price;
      return applyUnitSurcharge(usdPrice, item);
    }
    return applyUnitSurcharge(item.unit_price, item);
  }, [exchangeRates, applyUnitSurcharge]);

  // ============= TOTALS =============
  const calculateTotals = useCallback(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let tax = 0;

    cart.forEach((item) => {
      const usdPrice = getEffectiveUSDPrice(item);
      const itemSubtotal = usdPrice * item.quantity;
      const itemDiscount = itemSubtotal * ((item.discount_percent || 0) / 100);
      const taxable = itemSubtotal - itemDiscount;
      const itemTax = taxable * ((item.tax_percent || 0) / 100);
      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      tax += itemTax;
    });

    const total = subtotal - totalDiscount + tax;

    return { subtotal, discount: totalDiscount, tax, total };
  }, [cart, getEffectiveUSDPrice]);

  const { subtotal, discount, tax, total } = calculateTotals();

  // ============= COP DERIVED VALUES =============
  const copPerUSD = calculateEffectiveRate('USD', 'COP', exchangeRates) || 1;
  const totalCOP = total * copPerUSD;

  // ============= CHECKOUT =============
  const performSale = async (authorizedBy: number | null) => {
    setSaving(true);
    try {
      // Adjust payment lines for change (vuelto) using shared utility
      const { adjustedLines, changeAmount } = saleType === 'cash'
        ? adjustPaymentLinesForChange(paymentLines, totalCOP, copPerUSD, displayCurrency, COP_TOLERANCE)
        : { adjustedLines: paymentLines, changeCOP: 0, changeAmount: '0.00' };

      const result = await saleService.createSale({
        customer_id: customer?.id || null,
        warehouse_id: 1,
        sale_type: saleType,
        currency_mode: displayCurrency === 'USD' ? 'USD' : 'COP',
        session_id: sessionId,
        tab_id: activeTabId,
        exchange_rate: calculateEffectiveRate('USD', 'COP', exchangeRates) || 1,
        payment_lines: convertPaymentLinesToBackend(adjustedLines, exchangeRates),
        authorized_by: (saleType === 'credit' || saleType === 'mixed') ? authorizedBy : null,
        items: cart.map((item) => ({
          product_id: item.product_id,
          presentation_id: item.presentation_id,
          quantity: item.quantity,
          is_unit: item.sellByUnit || false,
          unit_price: getEffectiveUSDPrice(item),
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent,
        })),
        notes,
      });

      setSaleResult({ ...result.data, totals: { subtotal, discount, tax, total }, changeAmount });
      setShowCheckoutModal(false);
      setShowResultModal(true);

      closeTab(activeTabId);
      await posReservationService.releaseTab({ session_id: sessionId, tab_id: activeTabId });

      setPaymentLines([]);
      setNotes('');

      toast.dismiss();
      toast.success('¡Venta completada!');
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error(`Stock insuficiente: ${err.response.data.product_name}. Disponible: ${err.response.data.available}`);
      } else {
        toast.error(err.response?.data?.message || 'Error al crear la venta');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteSale = async () => {
    if (!selectedPriceList) { toast.error('Selecciona una lista de precios'); return; }
    if (paymentLines.length === 0) { toast.error('Agrega al menos una forma de pago'); return; }
    if ((saleType === 'credit' || saleType === 'mixed') && !customer) {
      toast.error('Selecciona un cliente para ventas a crédito');
      return;
    }

    if (saleType === 'credit') {
      const creditCOP = paymentLines
        .filter(l => l.method === 'credit')
        .reduce((sum, l) => sum + (l.amount * (parseFloat(l.cop_rate) || 1)), 0);
      if (creditCOP < totalCOP - COP_TOLERANCE) {
        const faltante = displayCurrency === 'USD'
          ? `$ ${((totalCOP - creditCOP) / copPerUSD).toFixed(2)}`
          : `COP$ ${Math.round(totalCOP - creditCOP).toLocaleString('es-CO')}`;
        toast.error(`Monto a crédito insuficiente. Faltan: ${faltante}`);
        return;
      }
    }

    if (saleType === 'cash' || saleType === 'mixed') {
      const cashPaidCOP = paymentLines
        .filter(l => l.method !== 'credit')
        .reduce((sum, l) => sum + (l.amount * (parseFloat(l.cop_rate) || 1)), 0);
      const creditCOP = paymentLines
        .filter(l => l.method === 'credit')
        .reduce((sum, l) => sum + (l.amount * (parseFloat(l.cop_rate) || 1)), 0);
      const expectedCashCOP = totalCOP - creditCOP;
      if (saleType === 'cash' && cashPaidCOP < totalCOP - COP_TOLERANCE) {
        const faltante = displayCurrency === 'USD'
          ? `$ ${((totalCOP - cashPaidCOP) / copPerUSD).toFixed(2)}`
          : `COP$ ${Math.round(totalCOP - cashPaidCOP).toLocaleString('es-CO')}`;
        toast.error(`Monto insuficiente. Faltan: ${faltante}`);
        return;
      }
      if (saleType === 'mixed' && cashPaidCOP < expectedCashCOP - COP_TOLERANCE) {
        const faltante = displayCurrency === 'USD'
          ? `$ ${((expectedCashCOP - cashPaidCOP) / copPerUSD).toFixed(2)}`
          : `COP$ ${Math.round(expectedCashCOP - cashPaidCOP).toLocaleString('es-CO')}`;
        toast.error(`Monto en efectivo insuficiente. Faltan: ${faltante}`);
        return;
      }
    }

    // Credit/mixed sales: non-admin users need PIN authorization
    if ((saleType === 'credit' || saleType === 'mixed') && !isAdmin) {
      setShowCreditPinModal(true);
      return;
    }

    // Admin or cash sale — proceed directly
    await performSale(isAdmin ? user.id : null);
  };

  const handleCreditPinValidated = async (adminId: number) => {
    setShowCreditPinModal(false);
    await performSale(adminId);
  };

  const canCollectPayment = hasPermission('sales.collect');

  const sendToCashier = async () => {
    if (!selectedPriceList) { toast.error('Selecciona una lista de precios'); return; }
    if (cart.length === 0) { toast.error('Agrega al menos un producto'); return; }

    setSaving(true);
    try {
      const result = await saleService.createSale({
        customer_id: customer?.id || null,
        warehouse_id: 1,
        sale_type: 'pos_pending',
        currency_mode: displayCurrency === 'USD' ? 'USD' : 'COP',
        session_id: sessionId,
        tab_id: activeTabId,
        exchange_rate: calculateEffectiveRate('USD', 'COP', exchangeRates) || 1,
        payment_lines: [],
        items: cart.map((item) => ({
          product_id: item.product_id,
          presentation_id: item.presentation_id,
          quantity: item.quantity,
          is_unit: item.sellByUnit || false,
          unit_price: getEffectiveUSDPrice(item),
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent,
        })),
        notes,
      });

      setSaleResult({ ...result.data, totals: { subtotal, discount, tax, total }, sentToCashier: true });
      setShowResultModal(true);

      closeTab(activeTabId);
      await posReservationService.releaseTab({ session_id: sessionId, tab_id: activeTabId });

      setNotes('');
      toast.dismiss();
      toast.success('Venta enviada a caja');
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error(`Stock insuficiente: ${err.response.data.product_name}. Disponible: ${err.response.data.available}`);
      } else {
        toast.error(err.response?.data?.message || 'Error al enviar a caja');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTabClose = async (tabId: string) => {
    try {
      await posReservationService.releaseTab({ session_id: sessionId, tab_id: tabId });
    } catch (err: any) {
      console.error('Error releasing tab reservations:', err);
    }
  };

  const handlePrint = () => {
    if (saleResult) {
      printSaleTicket(saleResult, companySettings, {
        displayCurrency,
        currencySymbol: displaySymbol,
        exchangeRate: calculateEffectiveRate('USD', displayCurrency, exchangeRates) || 1
      });
    }
  };

  // ============= RETURN =============
  return {
    // Auth & permissions
    user,
    hasPermission,
    companySettings,

    // Products
    products,
    loadingProducts,
    loadingMore,
    hasMoreProducts,
    loadMoreProducts,
    searchTerm,
    setSearchTerm,
    searchInputRef,

    // Price lists
    priceLists,
    selectedPriceList,
    selectPriceList,
    priceListDetails,

    // Currency
    displayCurrency,
    setDisplayCurrency,
    displaySymbol,
    exchangeRates,
    toDisplay,
    fromDisplay,
    fmt,

    // Tabs & cart
    tabs,
    activeTabId,
    activeTab,
    cart,
    customer,

    // Other reservations (for ProductCard)
    otherReservations,

    // Cart handlers
    handleAddProduct,
    handleRemoveItem,
    handleQuantityChange,
    handleToggleSellMode,
    handlePriceChange,
    handleDiscountChange,
    handleSetCustomer,
    handleClearCustomer,

    // Price helpers (for ProductCard / CartItem)
    getEffectivePriceUSD,
    getEffectiveUSDPrice,

    // Checkout
    saleType,
    isAdmin,
    paymentLines,
    setPaymentLines,
    notes,
    setNotes,
    subtotal,
    discount,
    tax,
    total,
    totalCOP,
    copPerUSD,
    handleCompleteSale,
    sendToCashier,
    canCollectPayment,
    saving,

    // Sale result
    saleResult,
    handlePrint,

    // Tab management
    handleTabClose,

    // Modal states
    showCheckoutModal,
    setShowCheckoutModal,
    showResultModal,
    setShowResultModal,
    showCustomerSearch,
    setShowCustomerSearch,
    showConflictAlert,
    setShowConflictAlert,
    showCurrencyTotals,
    setShowCurrencyTotals,
    showCreditPinModal,
    setShowCreditPinModal,
    handleCreditPinValidated,
    conflictData,

    // Clock
    currentTime,
  };
}
