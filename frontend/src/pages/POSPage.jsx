import { useState, useEffect } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Search, User, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { productService } from '../services/api/productService';
import saleService from '../services/api/saleService';
import { useAuth } from '../context/AuthContext';

const POSPage = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customer, setCustomer] = useState(null);
  const [saleType, setSaleType] = useState('cash');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [searchTerm]);

  const loadProducts = async () => {
    try {
      const data = await productService.getProducts({ 
        search: searchTerm,
        limit: 20,
        is_active: true
      });
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const addToCart = (product) => {
    const presentation = product.presentations?.[0];
    if (!presentation) {
      alert('El producto no tiene presentaciones configuradas');
      return;
    }

    const existingItem = cart.find(
      item => item.product_id === product.id && item.presentation_id === presentation.id
    );

    if (existingItem) {
      updateQuantity(existingItem.product_id, existingItem.presentation_id, existingItem.quantity + 1);
    } else {
      setCart([...cart, {
        product_id: product.id,
        presentation_id: presentation.id,
        product_name: product.name,
        presentation_name: presentation.name,
        quantity: 1,
        unit_price: presentation.sale_price || 0,
        tax_percent: 16,
        discount_percent: 0
      }]);
    }
  };

  const updateQuantity = (productId, presentationId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId, presentationId);
      return;
    }

    setCart(cart.map(item => 
      item.product_id === productId && item.presentation_id === presentationId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId, presentationId) => {
    setCart(cart.filter(
      item => !(item.product_id === productId && item.presentation_id === presentationId)
    ));
  };

  const updateDiscount = (productId, presentationId, discount) => {
    setCart(cart.map(item => 
      item.product_id === productId && item.presentation_id === presentationId
        ? { ...item, discount_percent: parseFloat(discount) || 0 }
        : item
    ));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    cart.forEach(item => {
      const itemSubtotal = item.quantity * item.unit_price;
      const itemDiscount = itemSubtotal * (item.discount_percent / 100);
      const taxableAmount = itemSubtotal - itemDiscount;
      const itemTax = taxableAmount * (item.tax_percent / 100);

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      totalTax += itemTax;
    });

    const total = subtotal - totalDiscount + totalTax;

    return {
      subtotal: subtotal.toFixed(2),
      discount: totalDiscount.toFixed(2),
      tax: totalTax.toFixed(2),
      total: total.toFixed(2)
    };
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    if (saleType === 'cash' && !paidAmount) {
      alert('Ingrese el monto pagado');
      return;
    }

    const totals = calculateTotals();
    const totalAmount = parseFloat(totals.total);
    const paid = parseFloat(paidAmount) || 0;

    if (saleType === 'cash' && paid < totalAmount) {
      alert('El monto pagado es insuficiente');
      return;
    }

    setLoading(true);

    try {
      const saleData = {
        customer_id: customer?.id || null,
        warehouse_id: 1, // TODO: Obtener del usuario o configuración
        sale_type: saleType,
        payment_method: saleType === 'cash' ? paymentMethod : null,
        items: cart.map(item => ({
          product_id: item.product_id,
          presentation_id: item.presentation_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent
        })),
        paid_amount: saleType === 'cash' ? paid : 0,
        notes: ''
      };

      const response = await saleService.createSale(saleData);
      
      alert(`Venta completada exitosamente!\nNúmero: ${response.sale.sale_number}\nTotal: $${totals.total}\nCambio: $${(paid - totalAmount).toFixed(2)}`);
      
      // Limpiar carrito
      setCart([]);
      setPaidAmount('');
      setCustomer(null);
      setShowPaymentModal(false);

    } catch (error) {
      console.error('Error completing sale:', error);
      alert(error.response?.data?.message || 'Error al procesar la venta');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();
  const change = saleType === 'cash' && paidAmount 
    ? (parseFloat(paidAmount) - parseFloat(totals.total)).toFixed(2)
    : '0.00';

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Punto de Venta</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Usuario:</span> {user?.name}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar productos por nombre, SKU o código de barras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-blue-500 transition-all"
                >
                  <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                    <ShoppingCart className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="font-medium text-gray-800 text-sm mb-1 line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">{product.sku}</p>
                  <p className="text-lg font-bold text-blue-600">
                    ${product.presentations?.[0]?.sale_price?.toFixed(2) || '0.00'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Cart Header */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Carrito ({cart.length})
            </h2>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <ShoppingCart className="w-16 h-16 mx-auto mb-3 opacity-50" />
                <p>Carrito vacío</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm text-gray-800">{item.product_name}</h4>
                      <p className="text-xs text-gray-500">{item.presentation_name}</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product_id, item.presentation_id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.presentation_id, item.quantity - 1)}
                        className="w-7 h-7 bg-gray-200 rounded hover:bg-gray-300 flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.presentation_id, item.quantity + 1)}
                        className="w-7 h-7 bg-gray-200 rounded hover:bg-gray-300 flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="font-bold text-blue-600">
                      ${(item.quantity * item.unit_price).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Desc %:</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={item.discount_percent}
                      onChange={(e) => updateDiscount(item.product_id, item.presentation_id, e.target.value)}
                      className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">${totals.subtotal}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Descuento:</span>
              <span className="font-medium text-red-600">-${totals.discount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">IVA:</span>
              <span className="font-medium">${totals.tax}</span>
            </div>
            <div className="flex justify-between text-xl font-bold border-t pt-2">
              <span>Total:</span>
              <span className="text-blue-600">${totals.total}</span>
            </div>
          </div>

          {/* Payment Section */}
          <div className="border-t border-gray-200 p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Venta
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSaleType('cash')}
                  className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                    saleType === 'cash'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Contado
                </button>
                <button
                  onClick={() => setSaleType('credit')}
                  className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                    saleType === 'credit'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Crédito
                </button>
              </div>
            </div>

            {saleType === 'cash' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                        paymentMethod === 'cash'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Banknote className="w-4 h-4 mx-auto mb-1" />
                      Efectivo
                    </button>
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                        paymentMethod === 'card'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 mx-auto mb-1" />
                      Tarjeta
                    </button>
                    <button
                      onClick={() => setPaymentMethod('transfer')}
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                        paymentMethod === 'transfer'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 mx-auto mb-1" />
                      Transfer
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monto Recibido
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-medium"
                  />
                </div>

                {paidAmount && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-green-800">Cambio:</span>
                      <span className="text-xl font-bold text-green-600">
                        ${change >= 0 ? change : '0.00'}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              onClick={handleCompleteSale}
              disabled={cart.length === 0 || loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Procesando...' : 'Completar Venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSPage;
