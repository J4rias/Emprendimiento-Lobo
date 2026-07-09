import { useState, useCallback, useRef, useEffect } from 'react';
import { usePOS, CURRENCIES, PAYMENT_METHODS, METHODS_BY_CURRENCY, getSavedRate, saveRate, COP_TOLERANCE } from '../hooks/usePOS';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { saleService } from '../services/api/saleService';
import { bankService } from '../services/api/bankService';
import POSTabs from '../components/pos/POSTabs';
import StockConflictAlert from '../components/pos/StockConflictAlert';
import CustomerSearch from '../components/CustomerSearch';
import { Modal, Button, Textarea } from '../components/ui';
import {
  Plus, MagnifyingGlass, X, WarningCircle, CheckCircle, User,
  Package, Lock, Money, CreditCard, DeviceMobile,
  Hash, Printer, Clock, Repeat, CaretDown, CaretUp, UserPlus, CircleNotch
} from '@phosphor-icons/react';
import { toast } from 'sonner';

// Icon map for payment methods
const PAYMENT_ICONS = { cash: Money, card: CreditCard, transfer: DeviceMobile, usdt: Hash };

// ============= MAIN COMPONENT =============
const POSPage = () => {
  const pos = usePOS();

  if (!pos.hasPermission('sales.create')) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <WarningCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
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
            <p className="text-sm text-gray-600">Usuario: {pos.user?.first_name || pos.user?.username}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Selector de moneda */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              {CURRENCIES.filter(c => c.code !== 'VES').map((c) => (
                <button
                  key={c.code}
                  onClick={() => pos.setDisplayCurrency(c.code)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    pos.displayCurrency === c.code
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {c.code}
                </button>
              ))}
            </div>

            {/* Clock */}
            <div className="flex items-center gap-1 text-gray-400 text-sm">
              <Clock className="w-4 h-4" />
              {pos.currentTime.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
            </div>

            {/* Shortcuts hint */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-400">
              <kbd className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-500 text-[10px]">F2</kbd><span>Buscar</span>
              <kbd className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-500 text-[10px] ml-2">F8</kbd><span>Cobrar</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <POSTabs onTabClose={pos.handleTabClose} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4">

        {/* Products Grid */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                ref={pos.searchInputRef}
                type="text"
                placeholder="Busca por nombre, SKU o código de barras... (F2)"
                value={pos.searchTerm}
                onChange={(e) => pos.setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {pos.searchTerm && (
                <button
                  onClick={() => pos.setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto p-4"
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              if (scrollHeight - scrollTop - clientHeight < 200) pos.loadMoreProducts();
            }}
          >
            {pos.loadingProducts ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Cargando productos...</p>
              </div>
            ) : pos.products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {pos.products
                    .filter(product => {
                      if (pos.displayCurrency !== 'USD' || pos.isAdmin) return true;
                      return (product.presentations || []).some(p => {
                        const detail = pos.priceListDetails[`${product.id}-${p.id}`];
                        return detail && parseFloat(detail.package_price_usd) > 0;
                      });
                    })
                    .map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      priceListDetails={pos.priceListDetails}
                      otherReservations={pos.otherReservations}
                      onAdd={pos.handleAddProduct}
                      toDisplay={pos.toDisplay}
                      displayCurrency={pos.displayCurrency}
                      displaySymbol={pos.displaySymbol}
                      exchangeRates={pos.exchangeRates}
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
                <p className="text-gray-500">
                  No hay productos
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="w-96 bg-white rounded-lg shadow flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 bg-blue-50 px-4 py-3 border-b border-gray-200">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">Carrito</h2>
            {pos.cart.length > 0 && (
              <span className="ml-auto bg-blue-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                {pos.cart.length}
              </span>
            )}
          </div>

          {/* Customer strip */}
          <div className="px-4 py-2 border-b border-gray-100">
            {pos.customer ? (
              <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-900 truncate">
                      {pos.customer.type === 'natural'
                        ? `${pos.customer.firstName || ''} ${pos.customer.lastName || ''}`.trim()
                        : pos.customer.businessName || pos.customer.tradeName || ''}
                    </p>
                    <p className="text-[10px] text-blue-600 truncate">
                      {pos.customer.documentType}-{pos.customer.documentNumber}
                      {pos.customer.discountPercentage > 0 && <span className="text-green-600 ml-1"> • {pos.customer.discountPercentage}% desc</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={pos.handleClearCustomer}
                  className="text-blue-400 hover:text-blue-700 ml-2 flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => pos.setShowCustomerSearch(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition text-xs"
              >
                <UserPlus className="w-3.5 h-3.5" /> Cliente
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {pos.cart.length > 0 ? (
              pos.cart.map((item) => (
                <CartItem
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
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Carrito vacío
              </div>
            )}
          </div>

          {pos.cart.length > 0 && (
            <div className="border-t border-gray-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">{pos.displaySymbol} {pos.fmt(pos.toDisplay(pos.subtotal))}</span>
              </div>
              {pos.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Descuento:</span>
                  <span className="font-semibold text-red-600">-{pos.displaySymbol} {pos.fmt(pos.toDisplay(pos.discount))}</span>
                </div>
              )}
              {pos.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Impuesto:</span>
                  <span className="font-semibold">{pos.displaySymbol} {pos.fmt(pos.toDisplay(pos.tax))}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between text-base font-bold">
                <span>Total:</span>
                <span className="text-green-600">{pos.displaySymbol} {pos.fmt(pos.toDisplay(pos.total))}</span>
              </div>

              {/* Currency toggle */}
              {pos.exchangeRates.length > 0 && pos.total > 0 && (
                <button
                  onClick={() => pos.setShowCurrencyTotals(!pos.showCurrencyTotals)}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-600 mt-1 transition"
                >
                  <Repeat className="w-3 h-3" />
                  {pos.showCurrencyTotals ? 'Ocultar divisas' : 'Ver en divisas'}
                  {pos.showCurrencyTotals ? <CaretUp className="w-3 h-3" /> : <CaretDown className="w-3 h-3" />}
                </button>
              )}

              {pos.showCurrencyTotals && (
                <div className="mt-1.5 bg-slate-50 rounded p-2 space-y-1">
                  {CURRENCIES.filter(c => c.code !== 'USD').map(cur => {
                    const rate = calculateEffectiveRate('USD', cur.code, pos.exchangeRates);
                    const converted = rate !== null ? pos.total * rate : null;
                    return (
                      <div key={cur.code} className="flex justify-between text-xs">
                        <span className="text-gray-500">{cur.name} ({cur.code})</span>
                        <span className="font-medium text-gray-700">
                          {converted !== null
                            ? `${cur.symbol} ${cur.code === 'COP' ? Math.ceil(converted).toLocaleString('es-VE') : converted.toFixed(2)}`
                            : 'Sin tasa'}
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-[9px] text-gray-400 pt-1 border-t border-gray-200">
                    Tasas del {pos.exchangeRates[0]?.effective_date || 'día'}
                  </p>
                </div>
              )}

              <button
                onClick={() => pos.setShowCheckoutModal(true)}
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
        <CreditPinModal
          onClose={() => pos.setShowCreditPinModal(false)}
          onValidated={pos.handleCreditPinValidated}
        />
      )}

      <SaleResultModal
        show={pos.showResultModal}
        onClose={() => pos.setShowResultModal(false)}
        sale={pos.saleResult}
        toDisplay={pos.toDisplay}
        displaySymbol={pos.displaySymbol}
        fmt={pos.fmt}
        onPrint={pos.handlePrint}
      />

      {/* Customer search from sidebar */}
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

// ============= SUB-COMPONENTS =============

function ProductCard({ product, priceListDetails, otherReservations, onAdd, toDisplay, displayCurrency, displaySymbol, exchangeRates, getEffectivePriceUSD, fmt }) {
  const [selectedPresentation, setSelectedPresentation] = useState(product.presentations?.[0]);
  const [quantity, setQuantity] = useState(1);

  if (!selectedPresentation) return null;

  const totalStock = product.inventories?.reduce((s, i) => s + parseFloat(i.quantity || 0), 0) || 0;
  const unitsPerPkg = parseFloat(selectedPresentation.units_per_package) || 1;
  const reservedByOthers = otherReservations[product.id] || 0;
  const available = totalStock - reservedByOthers;
  const availablePackages = Math.floor(available / unitsPerPkg);
  const looseUnits = Math.round(available % unitsPerPkg);
  const lowStock = available <= unitsPerPkg * 3;

  const priceListItem = priceListDetails[`${product.id}-${selectedPresentation.id}`];
  const isFrozen = displayCurrency !== 'USD' && !!priceListItem?.is_frozen;
  const priceUSD = getEffectivePriceUSD(selectedPresentation, priceListItem);

  return (
    <div className={`border rounded-lg p-3 hover:shadow-md transition-shadow flex flex-col cursor-pointer ${
      lowStock ? 'border-amber-300' : 'border-gray-200'
    }`}
      onClick={() => { onAdd(product, selectedPresentation, quantity); setQuantity(1); }}
    >
      {/* Category dot */}
      {product.category && (
        <div
          className="w-2 h-2 rounded-full mb-1"
          style={{ backgroundColor: product.category.color || '#9CA3AF' }}
          title={product.category.name}
        />
      )}

      <h3 className="font-semibold text-sm text-gray-900 truncate">{product.name}</h3>

      {/* Presentation selector */}
      {product.presentations?.length > 1 ? (
        <select
          value={selectedPresentation.id}
          onClick={(e) => e.stopPropagation()}
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
          <span className={`font-medium ${lowStock ? 'text-amber-600' : 'text-green-600'}`}>
            {availablePackages} disp.
            {looseUnits > 0 && <span className="text-gray-400 text-[10px]"> +{looseUnits} uds</span>}
            {reservedByOthers > 0 && (
              <span className="text-amber-600 text-[10px]"> ({reservedByOthers.toFixed(0)} reserv.)</span>
            )}
          </span>
        ) : (
          <span className="text-red-600 font-medium">Sin stock</span>
        )}
      </div>

      {/* Price */}
      <div className="flex items-center gap-1">
        {isFrozen && <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" title="Precio congelado" />}
        <p className={`font-bold text-base ${isFrozen ? 'text-amber-700' : 'text-blue-600'}`}>
          {displaySymbol} {fmt(toDisplay(priceUSD))}
        </p>
      </div>
    </div>
  );
}

function CartItem({ item, onQuantityChange, onRemove, onPriceChange, onToggleSellMode, onDiscountChange,
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
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      {/* Row 1: name + remove */}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{item.product_name}</p>
          <p className="text-xs text-gray-500">{item.presentation_name}</p>
        </div>
        <button onClick={() => onRemove(item.product_id, item.presentation_id, item.sellByUnit || false)} className="p-1 hover:bg-red-100 rounded flex-shrink-0">
          <X className="w-4 h-4 text-red-500" />
        </button>
      </div>

      {/* Row 2: sell mode toggle + quantity */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggleSellMode(item.product_id, item.presentation_id, item.sellByUnit || false)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
            item.sellByUnit
              ? 'bg-violet-100 text-violet-700'
              : 'bg-blue-100 text-blue-700'
          }`}
          title={item.sellByUnit ? 'Vendiendo por unidad' : `Vendiendo por paquete (${item.units_per_package} uds)`}
        >
          {item.sellByUnit ? <Package className="w-3 h-3" /> : <Package className="w-3 h-3" />}
          {item.sellByUnit ? 'Und' : 'Paq'}
        </button>

        {hasSurcharge && (
          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-300 rounded px-1 py-0.5 leading-none"
            title={`Recargo del 7% por compra menor a ${Math.ceil((item.units_per_package || 1) / 2)} unidades`}>
            +7%
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => onQuantityChange(item.product_id, item.presentation_id, item.sellByUnit || false, item.quantity - 1)}
            className="h-7 px-2 bg-white border border-gray-300 rounded text-sm flex items-center justify-center"
            disabled={item.quantity <= 1}>−</button>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => onQuantityChange(item.product_id, item.presentation_id, item.sellByUnit || false, parseInt(e.target.value) || 1)}
            className="w-10 h-7 text-center border border-gray-300 rounded text-sm"
          />
          <button onClick={() => onQuantityChange(item.product_id, item.presentation_id, item.sellByUnit || false, item.quantity + 1)}
            className="h-7 px-2 bg-white border border-gray-300 rounded text-sm flex items-center justify-center">+</button>
        </div>
      </div>

      {/* Row 3: price + subtotal */}
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-1">
          {item.is_frozen && <Lock className="w-3 h-3 text-amber-500" title="Precio congelado" />}
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
            )
          ) : (
            <span className="text-xs text-gray-500">{displaySymbol} {fmt(displayPrice)} c/u</span>
          )}
        </div>
        <span className="font-semibold">{displaySymbol} {fmt(displayTotal)}</span>
      </div>

      {/* Row 4: discount (if customer has discount or item has discount) */}
      {(customer?.discountPercentage > 0 || item.discount_percent > 0) && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Descuento:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              value={item.discount_percent || 0}
              onChange={(e) => onDiscountChange(item.product_id, item.presentation_id, item.sellByUnit || false, parseFloat(e.target.value) || 0)}
              className="w-12 text-right bg-white border border-gray-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-gray-400">%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckoutModal({
  show, onClose, customer, onCustomerSelect, saleType, paymentLines, setPaymentLines,
  notes, setNotes,
  subtotal, discount, tax, total, totalCOP, copPerUSD,
  onComplete, saving,
  exchangeRates, displayCurrency, toDisplay, displaySymbol, fmt, isAdmin,
}) {
  const getCOPRate = (code) => {
    if (displayCurrency === 'USD' && code === 'USD') return copPerUSD;
    if (code === displayCurrency) return code === 'COP' ? 1 : (getSavedRate(code, displayCurrency) || calculateEffectiveRate(code, 'COP', exchangeRates) || 1);
    return getSavedRate(code, displayCurrency) || calculateEffectiveRate(code, 'COP', exchangeRates) || 1;
  };

  const isUSD = displayCurrency === 'USD';
  const sSym = isUSD ? '$' : 'COP$';
  const fmtTotal = (usdVal) => isUSD ? usdVal.toFixed(2) : Math.ceil(usdVal * copPerUSD).toLocaleString('es-VE');
  const fmtCOP = (copVal) => isUSD ? (copVal / copPerUSD).toFixed(2) : Math.ceil(copVal).toLocaleString('es-VE');

  const [newPayCurrency, setNewPayCurrency] = useState(isUSD ? 'USD' : 'COP');
  const [newPayMethod, setNewPayMethod] = useState('cash');
  const [newPayAmount, setNewPayAmount] = useState('');
  const [newPayRate, setNewPayRate] = useState(() => getCOPRate(isUSD ? 'USD' : 'COP'));
  const [newPayBank, setNewPayBank] = useState('');
  const [changeRate, setChangeRate] = useState(() => getSavedRate('changeRate', 'COP') || Math.round(copPerUSD));
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [banks, setBanks] = useState([]);

  useEffect(() => {
    bankService.getAll().then(setBanks).catch(() => {});
  }, []);

  useEffect(() => {
    const def = isUSD ? 'USD' : 'COP';
    setNewPayCurrency(def);
    setNewPayMethod('cash');
    setNewPayAmount('');
    setNewPayRate(getCOPRate(def));
    setNewPayBank('');
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
    if (isUSD && code !== 'USD') {
      // Foreign currency in USD mode: rate is {code}/USD
      setNewPayRate(getSavedRate(code, 'USD') || calculateEffectiveRate('USD', code, exchangeRates) || 1);
    } else {
      setNewPayRate(getCOPRate(code));
    }
    const allowed = METHODS_BY_CURRENCY[code] || ['cash'];
    if (!allowed.includes(newPayMethod)) setNewPayMethod(allowed[0]);
  };

  const handleMethodChange = (method) => {
    setNewPayMethod(method);
    setNewPayBank('');
    if (method === 'usdt') {
      setNewPayRate(getSavedRate('usdt', 'COP') || copPerUSD);
    } else if (newPayMethod === 'usdt' && method !== 'usdt') {
      // Switching away from USDT — restore normal rate
      handleCurrencyChange(newPayCurrency);
    }
  };

  // Banks filtered by the selected currency
  const filteredBanks = banks.filter(b => b.currency === effectiveCurrency);

  const addPaymentLine = () => {
    const amount = parseFloat(newPayAmount);
    if (!amount || amount <= 0) { toast.error('Ingresa un monto válido'); return; }
    let copRate;
    const isUSDT = newPayMethod === 'usdt';
    if (isUSDT) {
      // USDT: rate input is always COP/USDT, amount is in USDT (≈USD)
      copRate = parseFloat(newPayRate) || copPerUSD;
      saveRate('usdt', copRate, 'COP');
    } else if (isUSD && effectiveCurrency === 'USD') {
      // USD payment in USD mode: use copPerUSD directly to avoid rounding on roundtrip
      copRate = copPerUSD;
    } else if (isUSD && effectiveCurrency !== 'USD') {
      // Foreign currency in USD mode: rate input is {currency}/USD
      copRate = copPerUSD / (parseFloat(newPayRate) || 1);
      saveRate(effectiveCurrency, parseFloat(newPayRate), 'USD');
    } else if (effectiveCurrency === 'COP') {
      copRate = 1;
    } else {
      // Foreign currency in COP mode: rate input is COP/{currency}
      copRate = parseFloat(newPayRate) || 1;
      if (effectiveCurrency !== displayCurrency) saveRate(effectiveCurrency, copRate, 'COP');
    }
    // USDT always treated as USD for backend; never merge USDT lines (different rates)
    const backendCurrency = isUSDT ? 'USD' : effectiveCurrency;
    const displayRate = (isUSD && effectiveCurrency !== 'USD') ? (parseFloat(newPayRate) || 1) : null;
    const existingIdx = (displayRate || isUSDT)
      ? -1  // Never merge cross-currency or USDT payments (they have independent rates)
      : paymentLines.findIndex(l => l.currency === backendCurrency && l.method === newPayMethod);
    const bankId = (newPayMethod === 'transfer' && newPayBank) ? parseInt(newPayBank) : undefined;
    if (existingIdx >= 0) {
      const updated = [...paymentLines];
      updated[existingIdx] = { ...updated[existingIdx], amount: updated[existingIdx].amount + amount, cop_rate: copRate, ...(displayRate && { display_rate: displayRate }) };
      setPaymentLines(updated);
    } else {
      setPaymentLines([...paymentLines, { currency: backendCurrency, method: newPayMethod, amount, cop_rate: copRate, ...(displayRate && { display_rate: displayRate }), ...(bankId && { bank_id: bankId }) }]);
    }
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
    if (currency === 'COP') return Math.ceil(n).toLocaleString('es-VE');
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const saleTypeLabel = saleType === 'mixed' ? 'Mixta' : saleType === 'credit' ? 'Crédito' : 'Contado';

  return (
    <>
    <Modal open={show} onClose={onClose} title="Confirmar Venta">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">

        {/* Resumen */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal:</span><span>{sSym} {fmtTotal(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between"><span>Descuento:</span><span className="text-red-600">-{sSym} {fmtTotal(discount)}</span></div>}
          {tax > 0 && <div className="flex justify-between"><span>Impuesto:</span><span>{sSym} {fmtTotal(tax)}</span></div>}
          <div className="border-t pt-1 flex justify-between font-bold text-base">
            <span>Total:</span>
            <span className="text-green-600">{sSym} {fmtTotal(total)}</span>
          </div>
          {saleType !== 'cash' && (
            <div className="flex justify-end">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${saleType === 'mixed' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
                {saleTypeLabel}
              </span>
            </div>
          )}
        </div>

        {/* Cliente */}
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
            {customer ? getCustomerDisplayName(customer) : 'Seleccionar cliente'}
          </button>
          {customer && (
            <button onClick={() => onCustomerSelect(null)} className="mt-1 text-xs text-gray-600 hover:text-gray-900 underline">
              Limpiar selección
            </button>
          )}
        </div>

        {/* Pagos */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-900">Pagos recibidos</label>

          {paymentLines.length > 0 && (
            <div className="space-y-1">
              {paymentLines.map((line, i) => {
                const isCreditLine = line.method === 'credit';
                const MethodIcon = isCreditLine ? CreditCard : (PAYMENT_ICONS[line.method] || Money);
                return (
                  <div key={i} className={`flex items-center justify-between rounded px-3 py-2 text-sm ${isCreditLine ? 'bg-amber-50' : 'bg-green-50'}`}>
                    <div className="flex items-center gap-2">
                      <MethodIcon className={`w-4 h-4 ${isCreditLine ? 'text-amber-700' : 'text-green-700'}`} />
                      <span className={`font-medium ${isCreditLine ? 'text-amber-800' : 'text-green-800'}`}>
                        {line.currency} {fmtLine(line.amount, line.currency)}
                      </span>
                      <span className={`text-xs ${isCreditLine ? 'text-amber-600' : 'text-green-600'}`}>
                        ({isCreditLine ? 'Crédito' : PAYMENT_METHODS.find(m => m.id === line.method)?.label}{line.bank_id ? ` - ${banks.find(b => b.id === line.bank_id)?.name || ''}` : ''})
                      </span>
                      {!isCreditLine && (line.method === 'usdt' || (line.currency !== displayCurrency && (line.display_rate || (line.currency !== 'COP' && line.cop_rate !== 1)))) && (
                        <span className="text-[10px] text-gray-400">
                          @ {line.method === 'usdt'
                            ? `${Math.ceil(line.cop_rate).toLocaleString('es-VE')} COP/USDT`
                            : line.display_rate
                            ? `${line.currency === 'COP' ? Math.ceil(line.display_rate).toLocaleString('es-VE') : line.display_rate.toFixed(2)} ${line.currency}/USD`
                            : `${parseFloat(line.cop_rate).toFixed(2)} COP/${line.currency}`}
                        </span>
                      )}
                    </div>
                    <button onClick={() => setPaymentLines(paymentLines.filter((_, j) => j !== i))}>
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Credit info */}
          {hasCreditLine && (
            <div className={`rounded-lg p-3 text-sm border ${customer ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {customer
                ? <p>Se cargará <strong>{sSym} {fmtCOP(creditCOP)}</strong> al crédito de <strong>{getCustomerDisplayName(customer)}</strong></p>
                : <p className="font-medium">Selecciona un cliente para la línea de crédito</p>
              }
            </div>
          )}

          {/* Add payment form */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex gap-2 items-center">
              <select value={newPayCurrency} onChange={(e) => handleCurrencyChange(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <select value={newPayMethod} onChange={(e) => handleMethodChange(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                {availableMethods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              {newPayMethod === 'transfer' && filteredBanks.length > 0 && (
                <select value={newPayBank} onChange={(e) => setNewPayBank(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                  <option value="">Banco</option>
                  {filteredBanks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              {(effectiveCurrency !== displayCurrency || newPayMethod === 'usdt') && (
                <>
                  <label className="text-xs text-gray-500 whitespace-nowrap">
                    {newPayMethod === 'usdt' ? 'COP/USDT' : (isUSD ? `${effectiveCurrency}/USD` : `COP/${effectiveCurrency}`)}:
                  </label>
                  <input
                    type="number"
                    value={newPayRate}
                    onChange={(e) => setNewPayRate(e.target.value)}
                    className="w-24 px-2 py-1.5 border border-blue-400 bg-white rounded text-sm text-right"
                    step="0.01"
                  />
                </>
              )}
            </div>
            {(() => {
              const remainingCOP = effectiveTotalCOP - paidCOP;
              if (remainingCOP <= COP_TOLERANCE) return null;
              let remainingInCurrency, formatted;
              if (isUSD && effectiveCurrency === 'USD') {
                remainingInCurrency = remainingCOP / copPerUSD;
              } else if (isUSD && effectiveCurrency !== 'USD') {
                const customRate = parseFloat(newPayRate) || 1;
                remainingInCurrency = (remainingCOP / copPerUSD) * customRate;
              } else {
                const copRate = parseFloat(newPayRate) || 1;
                remainingInCurrency = remainingCOP / copRate;
              }
              formatted = effectiveCurrency === 'USD'
                ? remainingInCurrency.toFixed(2)
                : Math.ceil(remainingInCurrency).toLocaleString('es-VE');
              return (
                <p className="text-sm font-semibold text-orange-600">{formatted} {effectiveCurrency} restantes</p>
              );
            })()}
            <div className="flex gap-2">
              <input
                type="number" value={newPayAmount}
                onChange={(e) => setNewPayAmount(e.target.value)}
                placeholder={`Monto en ${effectiveCurrency}`}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                onKeyDown={(e) => e.key === 'Enter' && addPaymentLine()}
              />
              <button onClick={addPaymentLine} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700">
                +
              </button>
            </div>
            {/* Quick buttons */}
            <div className="flex gap-1 flex-wrap">
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
                    className="px-2 py-1 bg-amber-50 border border-amber-300 text-amber-700 rounded text-xs hover:bg-amber-100"
                  >
                    {hasPartialPayment ? 'Restante a Crédito' : 'Todo a Crédito'}
                  </button>
                ) : null;
              })()}
            </div>
          </div>

          {/* Payment summary */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1 border border-gray-200">
            <div className="flex justify-between"><span>Total a pagar:</span><span className="font-semibold">{sSym} {fmtCOP(effectiveTotalCOP)}</span></div>
            <div className="flex justify-between"><span>Pagado:</span><span className="font-semibold text-blue-700">{sSym} {fmtCOP(paidCOP)}</span></div>
            <div className="flex justify-between border-t pt-1">
              {changeCOP >= 0 ? (
                <><span className="font-semibold">Vuelto:</span><span className="font-bold text-green-600">{sSym} {fmtCOP(changeCOP)}</span></>
              ) : (
                <><span className="font-semibold text-red-600">Faltante:</span><span className="font-bold text-red-600">{sSym} {fmtCOP(Math.abs(changeCOP))}</span></>
              )}
            </div>
            {isUSD && changeCOP > 0 && (() => {
              const changeUSD = changeCOP / copPerUSD;
              const vueltoCOP = Math.round(changeUSD * changeRate);
              return (
                <div className="space-y-1 border-t border-dashed pt-1 mt-1">
                  <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
                    <span className="whitespace-nowrap">Tasa vuelto COP/USD:</span>
                    <input
                      type="number"
                      value={changeRate}
                      onChange={(e) => { const v = parseFloat(e.target.value) || 0; setChangeRate(v); saveRate('changeRate', v, 'COP'); }}
                      className="w-28 px-3 py-1.5 border border-blue-400 rounded text-right text-sm bg-white"
                      step="1"
                    />
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-green-700">
                    <span>Entregar:</span>
                    <span>COP$ {vueltoCOP.toLocaleString('es-VE')}</span>
                  </div>
                </div>
              );
            })()}
            {isUSD && changeCOP <= 0 && paidCOP <= 0 && (
              <p className="text-xs text-blue-600 mt-1">Puedes agregar pagos en COP cambiando la moneda del selector</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Notas (opcional)</label>
          <Textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Observaciones de la venta..."
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="success" className="flex-1" onClick={onComplete} loading={saving}>
            Confirmar Venta
          </Button>
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
      validateCredit={saleType === 'credit' || saleType === 'mixed'}
      saleAmount={total}
      exchangeRates={exchangeRates}
    />
    </>
  );
}

function SaleResultModal({ show, onClose, sale, toDisplay, displaySymbol, fmt, onPrint }) {
  if (!show || !sale) return null;

  return (
    <Modal open={show} onClose={onClose} title="Venta Completada">
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{sale.sale_number}</p>
          <p className="text-sm text-gray-500">Venta registrada exitosamente</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Total:</span>
            <span className="font-bold">{displaySymbol} {fmt(toDisplay(parseFloat(sale.total || 0)))}</span>
          </div>
          {sale.changeAmount && parseFloat(sale.changeAmount) > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Cambio:</span>
              <span className="font-bold">{displaySymbol} {fmt(toDisplay(parseFloat(sale.changeAmount)))}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onPrint}>
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
          <Button className="flex-1" onClick={onClose}>Nueva Venta</Button>
        </div>
      </div>
    </Modal>
  );
}

function CreditPinModal({ onClose, onValidated }) {
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
      onValidated(res.admin_id);
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
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Lock className="w-6 h-6 text-blue-600" />
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
              className={`w-3 h-3 rounded-full border-2 transition-all ${
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
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="••••"
            disabled={loading}
            autoFocus
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
              <CircleNotch className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          )}
        </div>

        {error && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <WarningCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4 || loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <CircleNotch className="w-4 h-4 animate-spin mx-auto" /> : 'Autorizar'}
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

export default POSPage;
