import { useState, useRef, useEffect } from 'react';
import { usePOS, CURRENCIES, PAYMENT_METHODS, METHODS_BY_CURRENCY, getSavedRate, saveRate, COP_TOLERANCE } from '../hooks/usePOS';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { saleService } from '../services/api/saleService';
import POSTabsTablet from '../components/pos/POSTabsTablet';
import StockConflictAlert from '../components/pos/StockConflictAlert';
import CustomerSearch from '../components/CustomerSearch';
import Modal from '../components/common/Modal';
import {
  Search, X, AlertCircle, CheckCircle, User,
  Package, Lock, Banknote, CreditCard, Smartphone,
  Printer, Clock, Repeat, ChevronDown, ChevronUp, UserPlus, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const PAYMENT_ICONS = { cash: Banknote, card: CreditCard, transfer: Smartphone };

// ============= TABLET POS =============
const POSPageTablet = () => {
  const pos = usePOS();

  if (!pos.hasPermission('sales.create')) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900">Sin permiso</p>
          <p className="text-base text-gray-600">No tienes permisos para acceder al POS</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 select-none">
      {/* ===== Header ===== */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">POS</h1>
          <span className="text-sm text-gray-500">{pos.user?.first_name || pos.user?.username}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Currency selector - bigger touch targets */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            {CURRENCIES.filter(c => c.code !== 'VES').map((c) => (
              <button
                key={c.code}
                onClick={() => pos.setDisplayCurrency(c.code)}
                className={`min-w-[48px] min-h-[40px] px-3 text-sm font-semibold transition-colors ${
                  pos.displayCurrency === c.code
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 active:bg-gray-100'
                }`}
              >
                {c.code}
              </button>
            ))}
          </div>

          {/* Clock */}
          <div className="flex items-center gap-1 text-gray-400 text-sm min-w-[60px]">
            <Clock className="w-4 h-4" />
            {pos.currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* ===== Tabs ===== */}
      <POSTabsTablet onTabClose={pos.handleTabClose} />

      {/* ===== Main content ===== */}
      <div className="flex-1 flex overflow-hidden gap-3 p-3">

        {/* === Products panel === */}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={pos.searchInputRef}
                type="text"
                placeholder="Buscar producto, SKU o código de barras..."
                value={pos.searchTerm}
                onChange={(e) => pos.setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {pos.searchTerm && (
                <button
                  onClick={() => pos.setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full active:bg-gray-200"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Products grid */}
          <div
            className="flex-1 overflow-y-auto p-3"
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              if (scrollHeight - scrollTop - clientHeight < 200) pos.loadMoreProducts();
            }}
          >
            {pos.loadingProducts ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-base text-gray-500">Cargando productos...</p>
              </div>
            ) : pos.products.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {pos.products
                    .filter(product => {
                      if (pos.displayCurrency !== 'USD' || pos.isAdmin) return true;
                      return (product.presentations || []).some(p => {
                        const detail = pos.priceListDetails[`${product.id}-${p.id}`];
                        return detail && parseFloat(detail.package_price_usd) > 0;
                      });
                    })
                    .map((product) => (
                    <TabletProductCard
                      key={product.id}
                      product={product}
                      priceListDetails={pos.priceListDetails}
                      otherReservations={pos.otherReservations}
                      onAdd={pos.handleAddProduct}
                      toDisplay={pos.toDisplay}
                      displayCurrency={pos.displayCurrency}
                      displaySymbol={pos.displaySymbol}
                      getEffectivePriceUSD={pos.getEffectivePriceUSD}
                      fmt={pos.fmt}
                    />
                  ))}
                </div>
                {pos.loadingMore && (
                  <p className="text-center text-gray-400 text-sm py-3">Cargando más productos...</p>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-base text-gray-500">
                  No hay productos
                </p>
              </div>
            )}
          </div>
        </div>

        {/* === Cart panel === */}
        <div className="w-[340px] bg-white rounded-xl shadow flex flex-col overflow-hidden shrink-0">
          {/* Cart header */}
          <div className="flex items-center gap-2 bg-blue-50 px-4 py-3 border-b border-gray-200 shrink-0">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-base text-gray-900">Carrito</h2>
            {pos.cart.length > 0 && (
              <span className="ml-auto bg-blue-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                {pos.cart.length}
              </span>
            )}
          </div>

          {/* Customer strip */}
          <div className="px-3 py-2 border-b border-gray-100 shrink-0">
            {pos.customer ? (
              <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-blue-900 truncate">
                      {pos.customer.type === 'natural'
                        ? `${pos.customer.firstName || ''} ${pos.customer.lastName || ''}`.trim()
                        : pos.customer.businessName || pos.customer.tradeName || ''}
                    </p>
                    {pos.customer.discountPercentage > 0 && (
                      <p className="text-xs text-green-600">{pos.customer.discountPercentage}% desc</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={pos.handleClearCustomer}
                  className="p-2 rounded-lg active:bg-blue-100 shrink-0"
                >
                  <X className="w-4 h-4 text-blue-400" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => pos.setShowCustomerSearch(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-lg text-gray-500 active:border-blue-400 active:text-blue-600 text-sm"
              >
                <UserPlus className="w-4 h-4" /> Cliente
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {pos.cart.length > 0 ? (
              pos.cart.map((item) => (
                <TabletCartItem
                  key={`${item.product_id}-${item.presentation_id}-${item.sellByUnit || false}`}
                  item={item}
                  onQuantityChange={pos.handleQuantityChange}
                  onRemove={pos.handleRemoveItem}
                  onPriceChange={pos.handlePriceChange}
                  onToggleSellMode={pos.handleToggleSellMode}
                  onDiscountChange={pos.handleDiscountChange}
                  toDisplay={pos.toDisplay}
                  displaySymbol={pos.displaySymbol}
                  fmt={pos.fmt}
                  getEffectiveUSDPrice={pos.getEffectiveUSDPrice}
                  hasEditPricePermission={pos.hasPermission('sales.edit_price')}
                  customer={pos.customer}
                />
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-base">
                Carrito vacío
              </div>
            )}
          </div>

          {/* Totals + checkout */}
          {pos.cart.length > 0 && (
            <div className="border-t border-gray-200 p-3 space-y-2 shrink-0">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">{pos.displaySymbol} {pos.fmt(pos.toDisplay(pos.subtotal))}</span>
              </div>
              {pos.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Descuento:</span>
                  <span className="font-semibold text-red-600">-{pos.displaySymbol} {pos.fmt(pos.toDisplay(pos.discount))}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-green-600">{pos.displaySymbol} {pos.fmt(pos.toDisplay(pos.total))}</span>
              </div>

              {/* Currency totals toggle */}
              {pos.exchangeRates.length > 0 && pos.total > 0 && (
                <button
                  onClick={() => pos.setShowCurrencyTotals(!pos.showCurrencyTotals)}
                  className="flex items-center gap-1 text-xs text-gray-400 active:text-blue-600 py-1"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  {pos.showCurrencyTotals ? 'Ocultar divisas' : 'Ver en divisas'}
                  {pos.showCurrencyTotals ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}

              {pos.showCurrencyTotals && (
                <div className="bg-slate-50 rounded-lg p-2 space-y-1">
                  {CURRENCIES.filter(c => c.code !== 'USD').map(cur => {
                    const rate = calculateEffectiveRate('USD', cur.code, pos.exchangeRates);
                    const converted = rate !== null ? pos.total * rate : null;
                    return (
                      <div key={cur.code} className="flex justify-between text-sm">
                        <span className="text-gray-500">{cur.code}</span>
                        <span className="font-medium text-gray-700">
                          {converted !== null
                            ? `${cur.symbol} ${cur.code === 'COP' ? Math.round(converted).toLocaleString('es-CO') : converted.toFixed(2)}`
                            : 'Sin tasa'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => pos.setShowCheckoutModal(true)}
                className="w-full mt-1 bg-green-600 text-white py-4 rounded-xl text-lg font-bold active:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-6 h-6" />
                Cobrar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== MODALS ===== */}
      <TabletCheckoutModal
        show={pos.showCheckoutModal}
        onClose={() => pos.setShowCheckoutModal(false)}
        customer={pos.customer}
        onCustomerSelect={pos.handleSetCustomer}
        saleType={pos.saleType}
        paymentLines={pos.paymentLines}
        setPaymentLines={pos.setPaymentLines}
        notes={pos.notes}
        setNotes={pos.setNotes}
        subtotal={pos.subtotal}
        discount={pos.discount}
        tax={pos.tax}
        total={pos.total}
        totalCOP={pos.totalCOP}
        copPerUSD={pos.copPerUSD}
        onComplete={pos.handleCompleteSale}
        saving={pos.saving}
        exchangeRates={pos.exchangeRates}
        displayCurrency={pos.displayCurrency}
        toDisplay={pos.toDisplay}
        displaySymbol={pos.displaySymbol}
        fmt={pos.fmt}
        isAdmin={pos.isAdmin}
      />

      <StockConflictAlert
        show={pos.showConflictAlert}
        productName={pos.conflictData?.productName}
        requested={pos.conflictData?.requested}
        available={pos.conflictData?.available}
        reservedByOthers={pos.conflictData?.reservedByOthers}
        onDismiss={() => pos.setShowConflictAlert(false)}
      />

      {pos.showCreditPinModal && (
        <TabletCreditPinModal
          onClose={() => pos.setShowCreditPinModal(false)}
          onValidated={pos.handleCreditPinValidated}
        />
      )}

      <TabletSaleResultModal
        show={pos.showResultModal}
        onClose={() => pos.setShowResultModal(false)}
        sale={pos.saleResult}
        toDisplay={pos.toDisplay}
        displaySymbol={pos.displaySymbol}
        fmt={pos.fmt}
        onPrint={pos.handlePrint}
      />

      <CustomerSearch
        isOpen={pos.showCustomerSearch}
        onClose={() => pos.setShowCustomerSearch(false)}
        onSelect={(c) => {
          pos.handleSetCustomer(c);
          pos.setShowCustomerSearch(false);
        }}
        validateCredit={pos.saleType === 'credit' || pos.saleType === 'mixed'}
        saleAmount={parseFloat(pos.total)}
        exchangeRates={pos.exchangeRates}
      />
    </div>
  );
};

// ============= TABLET SUB-COMPONENTS =============

function TabletProductCard({ product, priceListDetails, otherReservations, onAdd, toDisplay, displayCurrency, displaySymbol, getEffectivePriceUSD, fmt }) {
  const [selectedPresentation, setSelectedPresentation] = useState(product.presentations?.[0]);

  if (!selectedPresentation) return null;

  const totalStock = product.inventories?.reduce((s, i) => s + parseFloat(i.quantity || 0), 0) || 0;
  const unitsPerPkg = parseFloat(selectedPresentation.units_per_package) || 1;
  const reservedByOthers = otherReservations[product.id] || 0;
  const available = totalStock - reservedByOthers;
  const availablePackages = Math.floor(available / unitsPerPkg);
  const looseUnits = Math.round(available % unitsPerPkg);
  const lowStock = available <= unitsPerPkg * 3;
  const noStock = available <= 0;

  const priceListItem = priceListDetails[`${product.id}-${selectedPresentation.id}`];
  const isFrozen = displayCurrency !== 'USD' && !!priceListItem?.is_frozen;
  const priceUSD = getEffectivePriceUSD(selectedPresentation, priceListItem);

  return (
    <button
      type="button"
      disabled={noStock}
      onClick={() => onAdd(product, selectedPresentation, 1)}
      className={`w-full text-left border-2 rounded-xl p-3 flex flex-col transition-all active:scale-[0.97] ${
        noStock
          ? 'border-gray-200 bg-gray-50 opacity-60'
          : lowStock
            ? 'border-amber-300 bg-white active:bg-amber-50'
            : 'border-gray-200 bg-white active:bg-blue-50'
      }`}
    >
      {/* Category dot + name */}
      <div className="flex items-center gap-1.5 mb-1">
        {product.category && (
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: product.category.color || '#9CA3AF' }}
          />
        )}
        <h3 className="font-semibold text-sm text-gray-900 truncate">{product.name}</h3>
      </div>

      {/* Presentation */}
      {product.presentations?.length > 1 ? (
        <select
          value={selectedPresentation.id}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            const p = product.presentations.find((p) => p.id === parseInt(e.target.value));
            if (p) setSelectedPresentation(p);
          }}
          className="w-full text-sm border border-gray-200 rounded-lg mt-1 mb-2 py-2 px-2 bg-white"
        >
          {product.presentations.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-gray-500 mb-2">{selectedPresentation.name}</p>
      )}

      {/* Stock */}
      <div className="text-sm mb-2">
        {available > 0 ? (
          <span className={`font-medium ${lowStock ? 'text-amber-600' : 'text-green-600'}`}>
            {availablePackages} disp.
            {looseUnits > 0 && <span className="text-gray-400 text-xs"> +{looseUnits}u</span>}
            {reservedByOthers > 0 && (
              <span className="text-amber-600 text-xs"> ({reservedByOthers.toFixed(0)} res.)</span>
            )}
          </span>
        ) : (
          <span className="text-red-500 font-medium">Sin stock</span>
        )}
      </div>

      {/* Price */}
      <div className="flex items-center gap-1 mt-auto">
        {isFrozen && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
        <p className={`font-bold text-base ${isFrozen ? 'text-amber-700' : 'text-blue-600'}`}>
          {displaySymbol} {fmt(toDisplay(priceUSD))}
        </p>
      </div>
    </button>
  );
}

function TabletCartItem({ item, onQuantityChange, onRemove, onPriceChange, onToggleSellMode, onDiscountChange,
  toDisplay, displaySymbol, fmt, getEffectiveUSDPrice, hasEditPricePermission, customer }) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');

  const effectiveUSD = getEffectiveUSDPrice(item);
  const displayPrice = toDisplay(effectiveUSD);
  const displayTotal = toDisplay(effectiveUSD * item.quantity * (1 - (item.discount_percent || 0) / 100));
  const hasSurcharge = item.sellByUnit && item.quantity < (item.units_per_package || 1) / 2;

  const startEdit = () => {
    setPriceInput(Math.round(displayPrice * 100) / 100);
    setEditingPrice(true);
  };

  const commitEdit = () => {
    const val = parseFloat(priceInput);
    if (!isNaN(val) && val >= 0) onPriceChange(item.product_id, item.presentation_id, item.sellByUnit || false, val);
    setEditingPrice(false);
  };

  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
      {/* Row 1: name + remove */}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-gray-900 truncate">{item.product_name}</p>
          <p className="text-xs text-gray-500">{item.presentation_name}</p>
        </div>
        <button
          onClick={() => onRemove(item.product_id, item.presentation_id, item.sellByUnit || false)}
          className="p-2 rounded-lg active:bg-red-100 shrink-0"
        >
          <X className="w-5 h-5 text-red-500" />
        </button>
      </div>

      {/* Row 2: sell mode + quantity */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggleSellMode(item.product_id, item.presentation_id, item.sellByUnit || false)}
          className={`flex items-center gap-1 px-3 min-h-[36px] rounded-lg text-xs font-semibold transition ${
            item.sellByUnit
              ? 'bg-violet-100 text-violet-700 active:bg-violet-200'
              : 'bg-blue-100 text-blue-700 active:bg-blue-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          {item.sellByUnit ? 'Und' : 'Paq'}
        </button>

        {hasSurcharge && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1 font-medium">
            +7%
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => onQuantityChange(item.product_id, item.presentation_id, item.sellByUnit || false, item.quantity - 1)}
            className="w-10 h-10 bg-white border border-gray-300 rounded-lg text-lg flex items-center justify-center active:bg-gray-100 font-bold"
            disabled={item.quantity <= 1}
          >
            −
          </button>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => onQuantityChange(item.product_id, item.presentation_id, item.sellByUnit || false, parseInt(e.target.value) || 1)}
            className="w-12 h-10 text-center border border-gray-300 rounded-lg text-base font-semibold"
          />
          <button
            onClick={() => onQuantityChange(item.product_id, item.presentation_id, item.sellByUnit || false, item.quantity + 1)}
            className="w-10 h-10 bg-white border border-gray-300 rounded-lg text-lg flex items-center justify-center active:bg-gray-100 font-bold"
          >
            +
          </button>
        </div>
      </div>

      {/* Row 3: price + subtotal */}
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-1">
          {item.is_frozen && <Lock className="w-3.5 h-3.5 text-amber-500" />}
          {hasEditPricePermission ? (
            editingPrice ? (
              <input
                type="number"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') setEditingPrice(false);
                }}
                className="w-24 h-9 border-2 border-blue-400 rounded-lg px-2 text-right text-sm"
                autoFocus
              />
            ) : (
              <button
                onClick={startEdit}
                className="font-medium text-gray-700 active:text-blue-600 py-1"
              >
                {displaySymbol} {fmt(displayPrice)}
              </button>
            )
          ) : (
            <span className="text-sm text-gray-500">{displaySymbol} {fmt(displayPrice)} c/u</span>
          )}
        </div>
        <span className="font-bold text-base">{displaySymbol} {fmt(displayTotal)}</span>
      </div>

      {/* Row 4: discount */}
      {(customer?.discountPercentage > 0 || item.discount_percent > 0) && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Descuento:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              value={item.discount_percent || 0}
              onChange={(e) => onDiscountChange(item.product_id, item.presentation_id, item.sellByUnit || false, parseFloat(e.target.value) || 0)}
              className="w-16 h-9 text-right bg-white border border-gray-200 rounded-lg px-2 text-sm"
            />
            <span className="text-gray-400">%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TabletCheckoutModal({
  show, onClose, customer, onCustomerSelect, saleType, paymentLines, setPaymentLines,
  notes, setNotes,
  subtotal, discount, tax, total, totalCOP, copPerUSD,
  onComplete, saving,
  exchangeRates, displayCurrency, toDisplay, displaySymbol, fmt, isAdmin,
}) {
  const getCOPRate = (code) => {
    if (code === displayCurrency) return code === 'COP' ? 1 : (getSavedRate(code, displayCurrency) || calculateEffectiveRate(code, 'COP', exchangeRates) || 1);
    return getSavedRate(code, displayCurrency) || calculateEffectiveRate(code, 'COP', exchangeRates) || 1;
  };

  const isUSD = displayCurrency === 'USD';
  const sSym = isUSD ? '$' : 'COP$';
  const fmtTotal = (usdVal) => isUSD ? usdVal.toFixed(2) : Math.round(usdVal * copPerUSD).toLocaleString('es-CO');
  const fmtCOP = (copVal) => isUSD ? (copVal / copPerUSD).toFixed(2) : Math.round(copVal).toLocaleString('es-CO');

  const [newPayCurrency, setNewPayCurrency] = useState(isUSD ? 'USD' : 'COP');
  const [newPayMethod, setNewPayMethod] = useState('cash');
  const [newPayAmount, setNewPayAmount] = useState('');
  const [newPayRate, setNewPayRate] = useState(() => getCOPRate(isUSD ? 'USD' : 'COP'));
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  useEffect(() => {
    const def = isUSD ? 'USD' : 'COP';
    setNewPayCurrency(def);
    setNewPayMethod('cash');
    setNewPayAmount('');
    if (def === 'COP' && isUSD) {
      setNewPayRate(getSavedRate('COP', 'USD') || copPerUSD);
    } else {
      setNewPayRate(getCOPRate(def));
    }
  }, [displayCurrency]);

  if (!show) return null;

  const getCustomerDisplayName = (c) => {
    if (!c) return null;
    if (c.type === 'natural') return `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Sin nombre';
    return c.businessName || c.tradeName || 'Sin nombre';
  };

  const hasCreditLine = paymentLines.some(l => l.method === 'credit');
  const effectiveCurrency = newPayCurrency;

  const handleCurrencyChange = (code) => {
    setNewPayCurrency(code);
    if (code === 'COP' && isUSD) {
      setNewPayRate(getSavedRate('COP', 'USD') || copPerUSD);
    } else {
      setNewPayRate(getCOPRate(code));
    }
    const allowed = METHODS_BY_CURRENCY[code] || ['cash'];
    if (!allowed.includes(newPayMethod)) setNewPayMethod(allowed[0]);
  };

  const handleMethodChange = (method) => {
    setNewPayMethod(method);
  };

  const addPaymentLine = () => {
    const amount = parseFloat(newPayAmount);
    if (!amount || amount <= 0) { toast.error('Ingresa un monto válido'); return; }
    const copRate = effectiveCurrency === 'COP' ? (isUSD ? (copPerUSD / (parseFloat(newPayRate) || copPerUSD)) : 1) : (parseFloat(newPayRate) || 1);
    if (effectiveCurrency !== displayCurrency) {
      if (effectiveCurrency === 'COP' && isUSD) {
        saveRate('COP', parseFloat(newPayRate), 'USD');
      } else {
        saveRate(effectiveCurrency, copRate, displayCurrency);
      }
    }
    setPaymentLines([...paymentLines, { currency: effectiveCurrency, method: newPayMethod, amount, cop_rate: copRate }]);
    setNewPayAmount('');
  };

  const cashLines = paymentLines.filter(l => l.method !== 'credit');
  const creditCOP = paymentLines.filter(l => l.method === 'credit').reduce((s, l) => s + (l.amount * (parseFloat(l.cop_rate) || 1)), 0);
  const paidCOP = cashLines.reduce((sum, l) => sum + (l.amount * (parseFloat(l.cop_rate) || 1)), 0);
  const effectiveTotalCOP = totalCOP - creditCOP;
  const rawChangeCOP = paidCOP - effectiveTotalCOP;
  const changeCOP = Math.abs(rawChangeCOP) <= COP_TOLERANCE ? 0 : rawChangeCOP;

  const availableMethods = PAYMENT_METHODS.filter(m => (METHODS_BY_CURRENCY[effectiveCurrency] || ['cash']).includes(m.id));

  const fmtLine = (amount, currency) => {
    const n = parseFloat(amount) || 0;
    if (currency === 'COP') return Math.round(n).toLocaleString('es-CO');
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const saleTypeLabel = saleType === 'mixed' ? 'Mixta' : saleType === 'credit' ? 'Crédito' : 'Contado';

  return (
    <>
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">Confirmar Venta</h2>
          {saleType !== 'cash' && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${saleType === 'mixed' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
              {saleTypeLabel}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-2 rounded-lg active:bg-gray-100">
          <X className="w-6 h-6 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: summary + customer + notes */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 border-r border-gray-100">
          <div className="bg-gray-50 p-5 rounded-xl space-y-2 text-base">
            <div className="flex justify-between"><span>Subtotal:</span><span className="font-semibold">{sSym} {fmtTotal(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between"><span>Descuento:</span><span className="text-red-600 font-semibold">-{sSym} {fmtTotal(discount)}</span></div>}
            {tax > 0 && <div className="flex justify-between"><span>Impuesto:</span><span className="font-semibold">{sSym} {fmtTotal(tax)}</span></div>}
            <div className="border-t pt-2 flex justify-between font-bold text-xl">
              <span>Total:</span>
              <span className="text-green-600">{sSym} {fmtTotal(total)}</span>
            </div>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Cliente</label>
            <button
              onClick={() => setShowCustomerSearch(true)}
              className={`w-full px-4 py-3 rounded-xl text-base font-medium flex items-center gap-2 ${
                customer
                  ? 'bg-blue-50 border-2 border-blue-200 text-blue-900 active:bg-blue-100'
                  : 'bg-gray-100 border-2 border-gray-200 text-gray-700 active:bg-gray-200'
              }`}
            >
              <User className="w-5 h-5" />
              {customer ? getCustomerDisplayName(customer) : 'Seleccionar cliente'}
            </button>
            {customer && (
              <button onClick={() => onCustomerSelect(null)} className="mt-1.5 text-sm text-gray-500 active:text-gray-900 underline">
                Limpiar selección
              </button>
            )}
          </div>

          {/* Credit info */}
          {hasCreditLine && (
            <div className={`rounded-xl p-4 text-base border-2 ${customer ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {customer
                ? <p>Se cargará <strong>{sSym} {fmtCOP(creditCOP)}</strong> al crédito de <strong>{getCustomerDisplayName(customer)}</strong></p>
                : <p className="font-medium">Selecciona un cliente para la línea de crédito</p>}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Notas (opcional)</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Observaciones..."
            />
          </div>
        </div>

        {/* Right: payments + action buttons */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6">
          <div className="space-y-4 flex-1">
            <label className="block text-sm font-semibold text-gray-900">Pagos recibidos</label>

            {paymentLines.length > 0 && (
              <div className="space-y-2">
                {paymentLines.map((line, i) => {
                  const isCreditLine = line.method === 'credit';
                  const MethodIcon = isCreditLine ? CreditCard : (PAYMENT_ICONS[line.method] || Banknote);
                  return (
                    <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 text-base ${isCreditLine ? 'bg-amber-50' : 'bg-green-50'}`}>
                      <div className="flex items-center gap-2">
                        <MethodIcon className={`w-5 h-5 ${isCreditLine ? 'text-amber-700' : 'text-green-700'}`} />
                        <span className={`font-semibold ${isCreditLine ? 'text-amber-800' : 'text-green-800'}`}>
                          {line.currency} {fmtLine(line.amount, line.currency)}
                        </span>
                        <span className={`text-sm ${isCreditLine ? 'text-amber-600' : 'text-green-600'}`}>
                          ({isCreditLine ? 'Crédito' : PAYMENT_METHODS.find(m => m.id === line.method)?.label})
                        </span>
                        {!isCreditLine && line.currency !== 'COP' && line.currency !== displayCurrency && (
                          <span className="text-xs text-gray-400">@ {parseFloat(line.cop_rate).toFixed(2)} COP/{line.currency}</span>
                        )}
                      </div>
                      <button onClick={() => setPaymentLines(paymentLines.filter((_, j) => j !== i))} className="p-2 rounded-lg active:bg-red-100">
                        <X className="w-5 h-5 text-red-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add payment */}
            <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="flex gap-2 items-center">
                <select value={newPayCurrency} onChange={(e) => handleCurrencyChange(e.target.value)} className="px-3 py-3 border border-gray-300 rounded-xl text-base bg-white">
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
                <select value={newPayMethod} onChange={(e) => handleMethodChange(e.target.value)} className="flex-1 px-3 py-3 border border-gray-300 rounded-xl text-base bg-white">
                  {availableMethods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                {effectiveCurrency !== displayCurrency && (
                  <>
                    <label className="text-sm text-gray-500 whitespace-nowrap">COP/{effectiveCurrency === 'COP' ? 'USD' : effectiveCurrency}:</label>
                    <input
                      type="number"
                      value={newPayRate}
                      onChange={(e) => setNewPayRate(e.target.value)}
                      readOnly={!isAdmin}
                      className={`w-28 px-3 py-3 border rounded-xl text-base text-right ${isAdmin ? 'border-blue-400 bg-white' : 'border-gray-200 bg-gray-100 text-gray-500'}`}
                      step="0.01"
                    />
                  </>
                )}
              </div>
              {(() => {
                const remainingCOP = effectiveTotalCOP - paidCOP;
                if (remainingCOP <= COP_TOLERANCE) return null;
                let remainingInCurrency, formatted;
                if (effectiveCurrency === 'COP' && isUSD) {
                  const customRate = parseFloat(newPayRate) || copPerUSD;
                  remainingInCurrency = remainingCOP / copPerUSD * customRate;
                  formatted = Math.round(remainingInCurrency).toLocaleString('es-CO');
                } else {
                  const copRate = parseFloat(newPayRate) || 1;
                  remainingInCurrency = remainingCOP / copRate;
                  formatted = effectiveCurrency === 'COP'
                    ? Math.round(remainingInCurrency).toLocaleString('es-CO')
                    : remainingInCurrency.toFixed(2);
                }
                return (
                  <p className="text-base font-semibold text-orange-600">{formatted} {effectiveCurrency} restantes</p>
                );
              })()}
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newPayAmount}
                  onChange={(e) => setNewPayAmount(e.target.value)}
                  placeholder={`Monto en ${effectiveCurrency}`}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base"
                  onKeyDown={(e) => e.key === 'Enter' && addPaymentLine()}
                />
                <button onClick={addPaymentLine} className="w-14 bg-blue-600 text-white rounded-xl text-xl font-bold active:bg-blue-700">
                  +
                </button>
              </div>
              {/* Quick buttons */}
              <div className="flex gap-2 flex-wrap">
                {!hasCreditLine && (() => {
                  const remainingForCredit = effectiveTotalCOP - paidCOP;
                  const hasPartialPayment = paidCOP > 0;
                  return remainingForCredit > 0 ? (
                    <button
                      onClick={() => {
                        if (!customer) { toast.error('Selecciona un cliente para crédito'); return; }
                        const creditLine = isUSD
                          ? { currency: 'USD', method: 'credit', amount: parseFloat((remainingForCredit / copPerUSD).toFixed(2)), cop_rate: copPerUSD }
                          : { currency: 'COP', method: 'credit', amount: Math.round(remainingForCredit), cop_rate: 1 };
                        setPaymentLines([...paymentLines, creditLine]);
                      }}
                      className="flex-1 py-2.5 bg-amber-50 border border-amber-300 text-amber-700 rounded-xl text-sm font-medium active:bg-amber-100"
                    >
                      {hasPartialPayment ? 'Restante a Crédito' : 'Todo a Crédito'}
                    </button>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Payment summary */}
            <div className="bg-gray-50 rounded-xl p-4 text-base space-y-1.5 border border-gray-200">
              <div className="flex justify-between"><span>Total a pagar:</span><span className="font-semibold">{sSym} {fmtCOP(effectiveTotalCOP)}</span></div>
              <div className="flex justify-between"><span>Pagado:</span><span className="font-semibold text-blue-700">{sSym} {fmtCOP(paidCOP)}</span></div>
              <div className="flex justify-between border-t pt-1.5">
                {changeCOP >= 0 ? (
                  <><span className="font-semibold">Vuelto:</span><span className="font-bold text-green-600 text-lg">{sSym} {fmtCOP(changeCOP)}</span></>
                ) : (
                  <><span className="font-semibold text-red-600">Faltante:</span><span className="font-bold text-red-600 text-lg">{sSym} {fmtCOP(Math.abs(changeCOP))}</span></>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-auto pt-4">
            <button onClick={onClose} className="flex-1 px-4 py-4 border-2 border-gray-300 rounded-xl text-base font-semibold text-gray-900 active:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={onComplete}
              disabled={saving}
              className="flex-1 px-4 py-4 bg-green-600 text-white rounded-xl text-base font-bold active:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {saving ? 'Guardando...' : 'Confirmar Venta'}
            </button>
          </div>
        </div>
      </div>
    </div>

    <CustomerSearch
      isOpen={showCustomerSearch}
      onClose={() => setShowCustomerSearch(false)}
      onSelect={(c) => {
        onCustomerSelect(c);
        setShowCustomerSearch(false);
      }}
      validateCredit={saleType === 'credit' || saleType === 'mixed'}
      saleAmount={total}
      exchangeRates={exchangeRates}
    />
    </>
  );
}

function TabletSaleResultModal({ show, onClose, sale, toDisplay, displaySymbol, fmt, onPrint }) {
  if (!show || !sale) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-6 p-8">
        <div className="space-y-6">
          <div className="flex items-center justify-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-800">{sale.sale_number}</p>
            <p className="text-base text-gray-500 mt-1">Venta registrada exitosamente</p>
          </div>
          <div className="bg-gray-50 p-5 rounded-xl space-y-3 text-base">
            <div className="flex justify-between">
              <span className="text-gray-500">Total:</span>
              <span className="font-bold text-lg">{displaySymbol} {fmt(toDisplay(parseFloat(sale.total || 0)))}</span>
            </div>
            {sale.changeAmount && parseFloat(sale.changeAmount) > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Cambio:</span>
                <span className="font-bold text-lg">{displaySymbol} {fmt(toDisplay(parseFloat(sale.changeAmount)))}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onPrint}
              className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-gray-300 rounded-xl text-base text-gray-700 active:bg-gray-50"
            >
              <Printer className="w-5 h-5" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-blue-600 text-white rounded-xl text-base font-bold active:bg-blue-700"
            >
              Nueva Venta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabletCreditPinModal({ onClose, onValidated }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError('');
    try {
      const res = await saleService.validateCreditPin(pin);
      if (res.success) {
        onValidated(res.admin_id);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al validar PIN';
      setError(msg);
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center mb-3">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
            <Lock className="w-7 h-7 text-blue-600" />
          </div>
        </div>

        <h3 className="text-lg font-bold text-center text-gray-900 mb-1">Autorización Requerida</h3>
        <p className="text-sm text-gray-600 mb-5 text-center">
          Un administrador debe ingresar su PIN para autorizar esta venta a crédito.
        </p>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                i < pin.length ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Hidden input */}
        <div className={`relative ${shaking ? 'animate-shake' : ''}`}>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 6) setPin(v); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            maxLength={6}
            className="w-full border border-gray-300 rounded-xl px-4 py-4 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="••••"
            disabled={loading}
            autoFocus
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          )}
        </div>

        {error && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 active:bg-gray-100 font-medium transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4 || loading}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl active:bg-blue-700 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Autorizar'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}

export default POSPageTablet;
