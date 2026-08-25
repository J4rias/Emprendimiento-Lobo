import { useState, useCallback, useRef, useEffect } from 'react';
import { usePOS, CURRENCIES } from '../hooks/usePOS';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { formatCOP } from '../utils/formatUtils';
import { saleService } from '../services/api/saleService';
import POSTabs from '../components/pos/POSTabs';
import StockConflictAlert from '../components/pos/StockConflictAlert';
import CustomerSearch from '../components/CustomerSearch';
import CheckoutModal from '../components/sales/CheckoutModal';
import { Modal, Button, Textarea, ConfirmDialog } from '../components/ui';
import {
  Plus, MagnifyingGlass, X, WarningCircle, CheckCircle, User,
  Package, Lock, Money, CreditCard, DeviceMobile,
  Hash, Printer, Clock, Repeat, CaretDown, CaretUp, UserPlus, CircleNotch, ArrowRight
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { Product, ProductPresentation, Customer, ExchangeRate } from '../types';
import type { CartItem } from '../types/pos';

interface PriceListItem {
  is_frozen?: boolean;
  package_price_usd?: string;
  package_price?: string;
  [key: string]: unknown;
}

interface PriceListDetails {
  [key: string]: PriceListItem;
}

interface ProductCardProps {
  product: Product;
  priceListDetails: PriceListDetails;
  otherReservations: Record<number, number>;
  onAdd: (product: Product, presentation: ProductPresentation, quantity: number) => void;
  toDisplay: (usd: number) => number;
  displayCurrency: string;
  displaySymbol: string;
  exchangeRates: ExchangeRate[];
  getEffectivePriceUSD: (presentation: ProductPresentation, priceListItem?: PriceListItem) => number;
  fmt: (n: number) => string;
}

interface CartItemProps {
  item: CartItem;
  onQuantityChange: (productId: number, presentationId: number | null, sellByUnit: boolean, quantity: number) => void;
  onRemove: (productId: number, presentationId: number | null, sellByUnit: boolean) => void;
  onPriceChange: (productId: number, presentationId: number | null, sellByUnit: boolean, price: number) => void;
  onToggleSellMode: (productId: number, presentationId: number | null, sellByUnit: boolean) => void;
  onDiscountChange: (productId: number, presentationId: number | null, sellByUnit: boolean, discount: number) => void;
  toDisplay: (usd: number) => number;
  displaySymbol: string;
  fmt: (n: number) => string;
  getEffectiveUSDPrice: (item: CartItem) => number;
  hasEditPricePermission: boolean;
  customer: Customer | null;
}

interface SaleResultModalProps {
  show: boolean;
  onClose: () => void;
  sale: Record<string, any> | null;
  toDisplay: (usd: number) => number;
  displaySymbol: string;
  fmt: (n: number) => string;
  onPrint: () => void;
}

// ============= MAIN COMPONENT =============
const POSPage = () => {
  const pos = usePOS() as any;
  const [showSendToCashier, setShowSendToCashier] = useState(false);

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
              <kbd className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-500 text-[10px] ml-2">F8</kbd><span>{pos.canCollectPayment ? 'Cobrar' : 'Enviar a Caja'}</span>
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
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
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
            {pos.tabs.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-center max-w-xs">
                  Abre una venta nueva ("+ Nuevo", arriba) para empezar a agregar productos.
                </p>
              </div>
            ) : pos.loadingProducts ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Cargando productos...</p>
              </div>
            ) : pos.products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {pos.products
                    .filter((product: Product) => {
                      if (pos.isAdmin) return true;
                      const priceField = pos.displayCurrency === 'USD' ? 'package_price_usd' : 'package_price';
                      return (product.presentations || []).some((p: ProductPresentation) => {
                        const detail = pos.priceListDetails[`${product.id}-${p.id}`];
                        return detail && parseFloat(detail[priceField]) > 0;
                      });
                    })
                    .map((product: Product) => (
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
                      {String(pos.customer.documentType || '')}-{String(pos.customer.documentNumber || '')}
                      {Number(pos.customer.discountPercentage || 0) > 0 && <span className="text-green-600 ml-1"> • {String(pos.customer.discountPercentage)}% desc</span>}
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
              pos.cart.map((item: CartItem) => (
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
                            ? (cur.code === 'COP' ? formatCOP(converted) : `${cur.symbol} ${converted.toFixed(2)}`)
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

              {pos.canCollectPayment ? (
                <button
                  onClick={() => pos.setShowCheckoutModal(true)}
                  className="w-full mt-2 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Cobrar (F8)
                </button>
              ) : (
                <button
                  onClick={() => setShowSendToCashier(true)}
                  disabled={pos.cart.length === 0 || pos.saving}
                  className="w-full mt-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-5 h-5" />
                  Enviar a Caja (F8)
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {pos.canCollectPayment && <CheckoutModal
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
        isAdmin={pos.isAdmin}
        mode="create"
        allowCredit={pos.isAdmin || pos.hasPermission('sales.credit')}
      />}

      <ConfirmDialog
        open={showSendToCashier}
        onClose={() => setShowSendToCashier(false)}
        onConfirm={async () => {
          setShowSendToCashier(false);
          await pos.sendToCashier();
        }}
        loading={pos.saving}
        variant="info"
        title="¿Enviar venta a caja?"
        description="Los artículos quedarán reservados. El cajero realizará el cobro e imprimirá el ticket."
        confirmLabel="Enviar a Caja"
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
        onSelect={(c: any) => {
          pos.handleSetCustomer(c);
          pos.setShowCustomerSearch(false);
        }}
        validateCredit={pos.saleType === 'credit' || pos.saleType === 'mixed'}
        saleAmount={parseFloat(String(pos.total))}
        exchangeRates={pos.exchangeRates}
      />
    </div>
  );
};

// ============= SUB-COMPONENTS =============

interface InventoryItem { quantity: number | string; [key: string]: unknown; }

function ProductCard({ product, priceListDetails, otherReservations, onAdd, toDisplay, displayCurrency, displaySymbol, exchangeRates, getEffectivePriceUSD, fmt }: ProductCardProps) {
  const [selectedPresentation, setSelectedPresentation] = useState<ProductPresentation | undefined>(product.presentations?.[0]);
  const [quantity, setQuantity] = useState(1);

  if (!selectedPresentation) return null;

  const totalStock = product.inventories?.reduce((s: number, i: InventoryItem) => s + parseFloat(String(i.quantity || 0)), 0) || 0;
  const unitsPerPkg = parseFloat(String(selectedPresentation.units_per_package)) || 1;
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
          style={{ backgroundColor: '#9CA3AF' }}
          title={product.category.name}
        />
      )}

      <h3 className="font-semibold text-sm text-gray-900 truncate">{product.name}</h3>

      {/* Presentation selector */}
      {product.presentations && product.presentations.length > 1 ? (
        <select
          value={selectedPresentation.id}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const p = product.presentations?.find((p: ProductPresentation) => p.id === parseInt(e.target.value));
            if (p) setSelectedPresentation(p);
          }}
          className="w-full text-xs border border-gray-200 rounded mt-1 mb-2 py-1 px-1"
        >
          {product.presentations.map((p: ProductPresentation) => (
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
        {isFrozen && <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />}
        <p className={`font-bold text-base ${isFrozen ? 'text-amber-700' : 'text-blue-600'}`}>
          {displaySymbol} {fmt(toDisplay(priceUSD))}
        </p>
      </div>
    </div>
  );
}

function CartItem({ item, onQuantityChange, onRemove, onPriceChange, onToggleSellMode, onDiscountChange,
  toDisplay, displaySymbol, fmt, getEffectiveUSDPrice, hasEditPricePermission, customer }: CartItemProps) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');

  const effectiveUSD = getEffectiveUSDPrice(item);
  const displayPrice = toDisplay(effectiveUSD);
  const displayTotal = toDisplay(effectiveUSD * item.quantity * (1 - (item.discount_percent || 0) / 100));
  const hasSurcharge = item.sellByUnit && item.quantity < (item.units_per_package || 1) / 2;

  const startEdit = () => {
    setPriceInput(String(Math.round(displayPrice * 100) / 100));
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
          {item.is_frozen && <Lock className="w-3 h-3 text-amber-500" />}
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
      {(Number(customer?.discountPercentage || 0) > 0 || item.discount_percent > 0) && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Descuento:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              value={item.discount_percent || 0}
              onChange={(e) => onDiscountChange(item.product_id, item.presentation_id, item.sellByUnit || false, parseFloat(e.target.value) || 0)}
              className="w-12 text-right bg-white border border-gray-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-primary-200"
            />
            <span className="text-gray-400">%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SaleResultModal({ show, onClose, sale, toDisplay, displaySymbol, fmt, onPrint }: SaleResultModalProps) {
  if (!show || !sale) return null;

  const isSentToCashier = sale.sentToCashier;

  return (
    <Modal open={show} onClose={onClose} title={isSentToCashier ? 'Enviado a Caja' : 'Venta Completada'}>
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isSentToCashier ? 'bg-blue-100' : 'bg-green-100'}`}>
            {isSentToCashier
              ? <ArrowRight className="w-8 h-8 text-blue-600" />
              : <CheckCircle className="w-8 h-8 text-green-600" />}
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{sale.sale_number}</p>
          <p className="text-sm text-gray-500">
            {isSentToCashier ? 'Venta enviada a caja — pendiente de cobro' : 'Venta registrada exitosamente'}
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Total:</span>
            <span className="font-bold">{displaySymbol} {fmt(toDisplay(parseFloat(sale.total || 0)))}</span>
          </div>
          {!isSentToCashier && sale.changeAmount && parseFloat(sale.changeAmount) > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Cambio:</span>
              <span className="font-bold">{displaySymbol} {fmt(toDisplay(parseFloat(sale.changeAmount)))}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {!isSentToCashier && (
            <Button variant="secondary" className="flex-1" onClick={onPrint}>
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
          )}
          <Button className="flex-1" onClick={onClose}>Nueva Venta</Button>
        </div>
      </div>
    </Modal>
  );
}

function CreditPinModal({ onClose, onValidated }: { onClose: () => void; onValidated: (adminId: number) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError('');
    try {
      const res = await saleService.validateCreditPin(pin);
      onValidated(res.admin_id);
    } catch (err: any) {
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
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-transparent"
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
