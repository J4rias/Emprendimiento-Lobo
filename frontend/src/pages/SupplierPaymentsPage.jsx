import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supplierPaymentService } from '../services/api/supplierPaymentService';
import { supplierService } from '../services/api/supplierService';
import { purchaseOrderService } from '../services/api/purchaseOrderService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  X,
  DollarSign,
  TrendingUp,
  CreditCard,
  Calendar,
  AlertCircle,
  FileText
} from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';

// Format a raw numericstring to locale string (de-DE: dots as thousands, comma as decimal)
const fmtNum = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const n = parseFloat(String(val).replace(/,/g, '.'));
  if (isNaN(n)) return String(val);
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Strip de-DE formatting back to raw parseable number string
const parseNum = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  // If the string has a comma it's de-DE format: 18.949.998,00
  // → remove dots (thousands seps) and replace comma (decimal) with dot
  if (str.includes(',')) {
    return str.replace(/\./g, '').replace(',', '.');
  }
  // Otherwise it's already a raw number (maybe 18949998 or 18949998.00)
  // Just strip anything that's not a digit or dot
  return str.replace(/[^0-9.]/g, '');
};

const SupplierPaymentsPage = () => {
  const { hasPermission } = useAuth();
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [payableBalanceSummary, setPayableBalanceSummary] = useState(null);
  const [creditBalances, setCreditBalances] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const location = useLocation();

  useEffect(() => {
    if (location.state?.prefillOrder) {
      const order = location.state.prefillOrder;
      setFormData({
        supplier_id: order.supplier_id,
        purchase_order_id: order.id,
        invoice_number: order.last_invoice_number || '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'transfer',
        amount: order.total,
        currency: order.currency,
        exchange_rate: '',
        exchange_rate_from: '',
        exchange_rate_to: '',
        reference: `Pago ${order.order_number.startsWith('OC') ? order.order_number : 'OC ' + order.order_number}`,
        notes: ''
      });
      // Fetch the actual pending balance instead of relying on the raw PO total
      supplierPaymentService.getPayableBalance(order.supplier_id)
        .then(res => {
          const poBalanceData = res.data?.purchase_orders?.find(p => p.id === order.id);
          const trueBalance = poBalanceData && poBalanceData.balance !== undefined
            ? parseFloat(poBalanceData.balance)
            : parseFloat(order.total);

          const rawTotal = trueBalance.toFixed(2);

          setFormData(prev => ({ ...prev, amount: rawTotal }));
          setDisplayAmount(fmtNum(rawTotal));

          setAllocations([{
            purchase_order_id: order.id,
            order_number: order.order_number,
            invoice_number: order.last_invoice_number || '',
            po_total: trueBalance, // holds the balance now
            po_original_total: parseFloat(order.total),
            po_currency: order.currency,
            allocated_amount: rawTotal,
            display_amount: fmtNum(rawTotal)
          }]);
        })
        .catch(err => console.error("Could not fetch prefill PO balance:", err));

      setPrefillLocked(true);
      // Removed the redundant fetchPurchaseOrdersBySupplier call here since we're locked
      // and won't show the dropdown anyway. This also prevents duplicate API calls.

      // If there's any currency mismatch (e.g if order currency is not USD and default form is USD), fetch the system rate immediately
      if (order.currency !== formData.currency) {
        fetchSystemRate(formData.currency);
      }

      setShowCreateModal(true);
    }
  }, [location.state]);

  const [formData, setFormData] = useState({
    supplier_id: '',
    purchase_order_id: '',
    invoice_number: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'transfer',
    amount: '',
    currency: 'USD',
    exchange_rate: '',
    exchange_rate_from: '',
    exchange_rate_to: '',
    reference: '',
    notes: ''
  });
  const [allocations, setAllocations] = useState([]);
  const [displayAmount, setDisplayAmount] = useState(''); // Formatted display of formData.amount
  const [prefillLocked, setPrefillLocked] = useState(false); // Locked when navigating from PO page
  const [rateType, setRateType] = useState('system'); // 'system' or 'custom'
  const [rateFlipped, setRateFlipped] = useState(false); // false = otherCur→payCur, true = payCur→otherCur
  const [systemRate, setSystemRate] = useState(null); // normalized: 1 otherCur = X payCur
  const [loadingRate, setLoadingRate] = useState(false);
  const [userEditedAmount, setUserEditedAmount] = useState(false); // Track if user manually changed the amount

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchPayments();
    fetchStats();
    fetchSuppliers();
  }, [currentPage, debouncedSearch, supplierFilter, paymentMethodFilter]);

  // Auto-allocate when the user types an amount and there's exactly 1 allocation (useful for prefilled POs)
  useEffect(() => {
    if (allocations.length === 1 && formData.amount && parseFloat(formData.amount) > 0 && userEditedAmount) {
      const a = allocations[0];
      const poTotal = a.po_total;
      const poCurrency = a.po_currency;
      const payCurrency = formData.currency;
      let maxPoAmountInPayCurrency = poTotal;

      // Calculate max allowed in payment currency
      if (poCurrency !== payCurrency && formData.exchange_rate && parseFloat(formData.exchange_rate) > 0) {
        const rate = parseFloat(formData.exchange_rate);
        if (formData.exchange_rate_from === poCurrency && formData.exchange_rate_to === payCurrency) {
          maxPoAmountInPayCurrency = poTotal * rate;
        } else if (formData.exchange_rate_from === payCurrency && formData.exchange_rate_to === poCurrency) {
          maxPoAmountInPayCurrency = poTotal / rate;
        } else if (formData.exchange_rate_from === 'USD' && formData.exchange_rate_to === 'VES') {
          if (payCurrency === 'USD') maxPoAmountInPayCurrency = poTotal / rate;
          else maxPoAmountInPayCurrency = poTotal * rate;
        }
      }

      const totalPayment = parseFloat(formData.amount);
      const suggestedAmount = Math.min(maxPoAmountInPayCurrency, totalPayment).toFixed(2);

      // Only update if it's actually different from current allocation, to prevent infinite loops
      if (a.allocated_amount !== suggestedAmount && parseFloat(a.allocated_amount || 0) !== parseFloat(suggestedAmount)) {
        setAllocations([{
          ...a,
          allocated_amount: suggestedAmount,
          display_amount: suggestedAmount && parseFloat(suggestedAmount) > 0 ? fmtNum(suggestedAmount) : ''
        }]);
      }
    }
  }, [formData.amount, userEditedAmount]); // Intentionally not listening to allocations to prevent infinite loops

  useEffect(() => {
    if (supplierFilter) {
      supplierPaymentService.getPayableBalance(supplierFilter)
        .then(res => setPayableBalanceSummary(res.data.summary_by_currency))
        .catch(err => {
          console.error('Error fetching payable balance:', err);
          setPayableBalanceSummary(null);
        });
    } else {
      setPayableBalanceSummary(null);
    }
  }, [supplierFilter]);

  // Fetch system rate when currency changes
  // Fetch and apply system exchange rate using graph-based triangulation (BFS)
  // Supports direct rates AND triangulated (e.g. USD→COP via VES)
  const fetchSystemRate = async (targetCurrency) => {
    setLoadingRate(true);
    try {
      const response = await exchangeRateService.getLatest();
      const rates = response.data || [];

      // targetCurrency is the new payment currency (formData.currency is stale in this closure)
      const payCur = targetCurrency || formData.currency;
      const otherCur = allocations.find(a => a.po_currency !== payCur)?.po_currency;

      if (!otherCur) {
        setLoadingRate(false);
        return;
      }

      // Use BFS triangulation: 1 otherCur = X payCur
      const rate = calculateEffectiveRate(otherCur, payCur, rates);

      if (rate && rate > 0) {
        setSystemRate(rate);
        setRateType('system');
        setFormData(prev => ({
          ...prev,
          exchange_rate: rate.toString(),
          exchange_rate_from: otherCur,
          exchange_rate_to: payCur
        }));

        // Recalculate allocations: otherCur total × rate = payCur amount
        setTimeout(() => {
          setAllocations(prev => {
            if (prev.length === 0) return prev;
            const updated = prev.map(a => {
              if (a.po_currency === payCur) {
                return { ...a, allocated_amount: a.po_total.toFixed(2), display_amount: fmtNum(a.po_total.toFixed(2)) };
              }
              const converted = a.po_total * rate;
              return { ...a, allocated_amount: converted.toFixed(2), display_amount: fmtNum(converted.toFixed(2)) };
            });
            const total = updated.reduce((sum, a) => sum + (parseFloat(a.allocated_amount) || 0), 0);
            if (total > 0) {
              const rawTotal = total.toFixed(2);
              setFormData(prev => ({ ...prev, amount: rawTotal }));
              setDisplayAmount(fmtNum(rawTotal));
            }
            return updated;
          });
        }, 0);
      } else {
        setSystemRate(null);
        setRateType('custom');
      }
    } catch (error) {
      console.error('Error fetching system rate:', error);
      setSystemRate(null);
      setRateType('custom');
    } finally {
      setLoadingRate(false);
    }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await supplierPaymentService.getAll({
        page: currentPage,
        limit: 20,
        search: debouncedSearch,
        supplier_id: supplierFilter || undefined,
        payment_method: paymentMethodFilter || undefined
      });
      setPayments(response.data);
      setTotalPages(response.pagination.totalPages);
      setError(null);
    } catch (err) {
      setError('Error al cargar los pagos');
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await supplierPaymentService.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await supplierService.getActive();
      setSuppliers(response.data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const fetchPurchaseOrdersBySupplier = async (supplierId) => {
    if (!supplierId) {
      setPurchaseOrders([]);
      setCreditBalances(null);
      return;
    }
    try {
      const response = await supplierPaymentService.getPayableBalance(supplierId);
      // The endpoint already filters for 'received' or 'partially_received'
      // We only want to show POs that still have a pending balance
      const receivable = (response.data?.purchase_orders || []).filter(o =>
        parseFloat(o.balance) > 0
      );
      setPurchaseOrders(receivable);

      // Fetch credit balance here
      const credRes = await supplierPaymentService.getCreditBalance(supplierId);
      setCreditBalances(credRes.data);
    } catch (err) {
      console.error('Error fetching purchase orders or credit balances:', err);
      setPurchaseOrders([]);
      setCreditBalances(null);
    }
  };

  const handleSupplierChange = (supplierId) => {
    setFormData(prev => ({ ...prev, supplier_id: supplierId, purchase_order_id: '' }));
    setAllocations([]);
    fetchPurchaseOrdersBySupplier(supplierId);
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        allocations: allocations.length > 0 ? allocations.map(a => ({
          purchase_order_id: a.purchase_order_id,
          invoice_number: a.invoice_number,
          allocated_amount: a.allocated_amount
        })) : undefined
      };
      await supplierPaymentService.create(payload);
      setShowCreateModal(false);
      fetchPayments();
      fetchStats();
      resetForm();
      alert('Pago registrado exitosamente');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al registrar el pago');
    }
  };

  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    try {
      await supplierPaymentService.update(editingPayment.id, formData);
      setShowEditModal(false);
      fetchPayments();
      fetchStats();
      resetForm();
      alert('Pago actualizado exitosamente');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al actualizar el pago');
    }
  };

  const handleDeletePayment = async (id) => {
    if (!window.confirm('¿Anular este pago? El registro se conservará con estado "Cancelado" para auditoría. Esta acción no se puede deshacer.')) return;
    try {
      await supplierPaymentService.delete(id);
      fetchPayments();
      fetchStats();
      alert('Pago anulado exitosamente');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al anular el pago');
    }
  };

  const handleViewPayment = async (payment) => {
    setViewingPayment(payment);
    setShowViewModal(true);
  };

  const handleEditPayment = async (payment) => {
    setEditingPayment(payment);
    setFormData({
      supplier_id: payment.supplier_id,
      purchase_order_id: payment.purchase_order_id || '',
      payment_date: payment.payment_date,
      payment_method: payment.payment_method,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference || '',
      invoice_number: payment.invoice_number || '',
      notes: payment.notes || ''
    });
    await fetchPurchaseOrdersBySupplier(payment.supplier_id);
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      purchase_order_id: '',
      invoice_number: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'transfer',
      amount: '',
      currency: 'USD',
      exchange_rate: '',
      exchange_rate_from: '',
      exchange_rate_to: '',
      reference: '',
      notes: ''
    });
    setAllocations([]);
    setPurchaseOrders([]);
    setEditingPayment(null);
    setPrefillLocked(false);
    setDisplayAmount('');
    setRateFlipped(false);
    setSystemRate(null);
    setRateType('system');
    setUserEditedAmount(false);
    setCreditBalances(null);
  };

  const addAllocation = (po) => {
    if (allocations.find(a => a.purchase_order_id === po.id)) return;
    const poTotal = po.balance !== undefined ? parseFloat(po.balance) : parseFloat(po.total);
    const poOriginalTotal = parseFloat(po.total); // keep original for display if needed
    const poCurrency = po.currency;
    const payCurrency = formData.currency;
    let suggestedAmount = '';

    const currentlyAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.allocated_amount) || 0), 0);
    const totalPayment = parseFloat(formData.amount) || 0;
    const remainingToAllocate = Math.max(0, totalPayment - currentlyAllocated);

    let maxPoAmountInPayCurrency = poTotal;

    // Auto-convert PO balance to payment currency if rate is available
    if (poCurrency !== payCurrency && formData.exchange_rate && parseFloat(formData.exchange_rate) > 0) {
      const rate = parseFloat(formData.exchange_rate);
      if (formData.exchange_rate_from === poCurrency && formData.exchange_rate_to === payCurrency) {
        // 1 PO_cur = rate pay_cur → pay amount = balance * rate
        maxPoAmountInPayCurrency = poTotal * rate;
      } else if (formData.exchange_rate_from === payCurrency && formData.exchange_rate_to === poCurrency) {
        // 1 pay_cur = rate PO_cur → pay amount = balance / rate
        maxPoAmountInPayCurrency = poTotal / rate;
      } else if (formData.exchange_rate_from === 'USD' && formData.exchange_rate_to === 'VES') {
        if (payCurrency === 'USD') maxPoAmountInPayCurrency = poTotal / rate;
        else maxPoAmountInPayCurrency = poTotal * rate;
      }
    }

    if (totalPayment > 0) {
      suggestedAmount = Math.min(maxPoAmountInPayCurrency, remainingToAllocate).toFixed(2);
    } else {
      suggestedAmount = maxPoAmountInPayCurrency.toFixed(2);
    }

    setAllocations(prev => {
      const newAllocations = [...prev, {
        purchase_order_id: po.id,
        order_number: po.order_number,
        invoice_number: po.last_invoice_number || '',
        po_total: poTotal, // Now holds balance
        po_original_total: poOriginalTotal,
        po_currency: poCurrency,
        allocated_amount: suggestedAmount,
        display_amount: suggestedAmount && parseFloat(suggestedAmount) > 0 ? fmtNum(suggestedAmount) : (suggestedAmount === '0.00' ? '' : '')
      }];

      // Auto-sum totalPayment if it was 0
      if (totalPayment === 0 && parseFloat(suggestedAmount) > 0) {
        const newTotal = parseFloat(suggestedAmount).toFixed(2);
        setFormData(f => ({ ...f, amount: newTotal }));
        setDisplayAmount(fmtNum(newTotal));
      }
      return newAllocations;
    });
  };

  const removeAllocation = (poId) => {
    setAllocations(prev => prev.filter(a => a.purchase_order_id !== poId));
  };

  const updateAllocationAmount = (poId, rawValue) => {
    // rawValue can be formatted (typed by user) or plain numeric
    const numeric = parseNum(rawValue);
    setAllocations(prev => prev.map(a =>
      a.purchase_order_id === poId
        ? { ...a, allocated_amount: numeric, display_amount: rawValue }
        : a
    ));
  };

  const updateAllocationInvoice = (poId, invoice) => {
    setAllocations(prev => prev.map(a =>
      a.purchase_order_id === poId ? { ...a, invoice_number: invoice } : a
    ));
  };

  // Recalculate allocation amounts and total when exchange rate changes
  const recalcAllocationsForRate = (newRate, rateFrom, rateTo, currentAllocations) => {
    if (!newRate || parseFloat(newRate) <= 0) return;
    const rate = parseFloat(newRate);

    const updatedAllocations = currentAllocations.map(a => {
      if (a.po_currency === formData.currency) return a; // Same currency, no conversion
      const poTotal = a.po_total;
      let converted;
      if (rateFrom === a.po_currency && rateTo === formData.currency) {
        converted = poTotal * rate;
      } else if (rateFrom === formData.currency && rateTo === a.po_currency) {
        converted = poTotal / rate;
      } else if (rateFrom === 'USD' && rateTo === 'VES') {
        converted = formData.currency === 'USD' ? (poTotal / rate) : (poTotal * rate);
      } else {
        converted = poTotal / rate;
      }
      return { ...a, allocated_amount: converted.toFixed(2), display_amount: fmtNum(converted.toFixed(2)) };
    });

    setAllocations(updatedAllocations);

    // Auto-sum the total payment amount
    const total = updatedAllocations.reduce((sum, a) => sum + (parseFloat(a.allocated_amount) || 0), 0);
    if (total > 0) {
      const rawTotal = total.toFixed(2);
      setFormData(prev => ({ ...prev, amount: rawTotal }));
      setDisplayAmount(fmtNum(rawTotal));
    }
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.allocated_amount) || 0), 0);
  const unallocated = (parseFloat(formData.amount) || 0) - totalAllocated;

  const getPaymentMethodLabel = (method) => {
    const methods = {
      cash: 'Efectivo',
      transfer: 'Transferencia',
      check: 'Cheque',
      card: 'Tarjeta',
      other: 'Otro',
      credit_balance: 'Uso de Saldo a Favor'
    };
    return methods[method] || method;
  };

  const getPaymentMethodBadge = (method) => {
    const config = {
      cash: 'bg-green-100 text-green-700',
      transfer: 'bg-blue-100 text-blue-700',
      check: 'bg-purple-100 text-purple-700',
      card: 'bg-yellow-100 text-yellow-700',
      other: 'bg-gray-100 text-gray-700',
      credit_balance: 'bg-indigo-100 text-indigo-700'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config[method] || config.other}`}>
        {getPaymentMethodLabel(method)}
      </span>
    );
  };

  const columns = [
    {
      header: 'Número',
      accessor: 'payment_number',
      render: (_, payment) => (
        <div>
          <div className="font-medium text-gray-900">{payment.payment_number || 'N/A'}</div>
          <div className="text-xs text-gray-500">{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('es-PE') : 'N/A'}</div>
        </div>
      )
    },
    {
      header: 'Proveedor',
      accessor: 'supplier',
      render: (_, payment) => (
        <div>
          <div className="font-medium text-gray-900">{payment.supplier?.name}</div>
          <div className="text-xs text-gray-500">{payment.supplier?.company_name}</div>
        </div>
      )
    },
    {
      header: 'Orden(es) de Compra',
      accessor: 'allocations',
      render: (_, payment) => {
        const allocs = payment.allocations || [];
        if (allocs.length === 0) {
          return <span className="text-xs text-gray-400">N/A</span>;
        }
        if (allocs.length === 1) {
          return <div className="text-sm text-blue-600">{allocs[0].purchaseOrder?.order_number || 'OC #' + allocs[0].purchase_order_id}</div>;
        }
        const tooltip = allocs.map(a => a.purchaseOrder?.order_number || 'OC #' + a.purchase_order_id).join('\n');
        return (
          <div className="text-sm text-blue-600 cursor-default" title={tooltip}>
            {allocs.length} órdenes
          </div>
        );
      }
    },
    {
      header: 'Estado',
      accessor: 'status',
      render: (_, payment) => {
        const cfg = {
          recorded: 'bg-yellow-100 text-yellow-700',
          confirmed: 'bg-green-100 text-green-700',
          cancelled: 'bg-red-100 text-red-700'
        };
        const labels = { recorded: 'Registrado', confirmed: 'Confirmado', cancelled: 'Cancelado' };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg[payment.status] || 'bg-gray-100 text-gray-700'}`}>
            {labels[payment.status] || payment.status}
          </span>
        );
      }
    },
    {
      header: 'Método',
      accessor: 'payment_method',
      render: (_, payment) => getPaymentMethodBadge(payment.payment_method)
    },
    {
      header: 'Monto',
      accessor: 'amount',
      render: (_, payment) => (
        <div className="text-right">
          <div className="font-medium text-gray-900">{payment.currency || ''} {(parseFloat(payment.amount) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
          {payment.reference && <div className="text-xs text-gray-500">Ref: {payment.reference}</div>}
        </div>
      )
    },
    {
      header: 'Registrado por',
      accessor: 'creator',
      render: (_, payment) => (
        <div className="text-sm text-gray-600">{[payment.creator?.first_name, payment.creator?.last_name].filter(Boolean).join(' ') || payment.creator?.username || 'N/A'}</div>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id',
      render: (_, payment) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewPayment(payment)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
          {hasPermission('supplier_payments.update') && (
            <button
              onClick={() => handleEditPayment(payment)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Editar"
            >
              <Edit className="w-4 h-4 text-yellow-600" />
            </button>
          )}
          {hasPermission('supplier_payments.delete') && (
            <button
              onClick={() => handleDeletePayment(payment.id)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Anular"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pagos a Proveedores</h1>
        <p className="text-gray-600 mt-1">Gestión de pagos realizados a proveedores</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Total Pagos</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total_payments}</p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Total en USD</p>
                <p className="text-2xl font-bold text-green-900">
                  ${stats.total_by_currency?.find(c => c.currency === 'USD')?.total_amount || '0.00'}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Métodos Usados</p>
                <p className="text-2xl font-bold text-purple-900">{stats.payments_by_method?.length || 0}</p>
              </div>
              <CreditCard className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por número de pago o referencia..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Supplier Filter */}
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los proveedores</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>

          {/* Payment Method Filter */}
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los métodos</option>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="check">Cheque</option>
            <option value="card">Tarjeta</option>
            <option value="other">Otro</option>
            <option value="credit_balance">Saldo a Favor</option>
          </select>

          {/* Create Button */}
          {hasPermission('supplier_payments.create') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nuevo Pago
            </button>
          )}
        </div>
      </div>

      {/* Supplier Balance Summary */}
      {supplierFilter && payableBalanceSummary && Object.keys(payableBalanceSummary).length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6 p-4 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Estado de Cuenta del Proveedor
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(payableBalanceSummary).map(([currency, data]) => (
              <div key={currency} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">{currency}</div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Total Facturado:</span>
                  <span className="font-medium text-gray-900">{parseFloat(data.total_ocs).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Total Pagado:</span>
                  <span className="font-medium text-green-600">{parseFloat(data.total_paid).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm mt-2 pt-1 border-t border-gray-300">
                  <span className="font-bold text-gray-700">
                    {parseFloat(data.balance) < 0 ? 'Saldo a Favor:' : 'Saldo Pendiente:'}
                  </span>
                  <span className={`font-bold ${parseFloat(data.balance) < 0 ? 'text-green-600' : 'text-blue-600'}`}>
                    {Math.abs(parseFloat(data.balance)).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={payments}
          loading={loading}
          emptyMessage="No se encontraron pagos"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Registrar Nuevo Pago"
      >
        <form onSubmit={handleCreatePayment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proveedor *
              </label>
              {prefillLocked ? (
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 flex items-center gap-2">
                  <span className="text-gray-400">🔒</span>
                  {suppliers.find(s => s.id === parseInt(formData.supplier_id))?.name || 'Proveedor'}
                </div>
              ) : (
                <select
                  value={formData.supplier_id}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccione un proveedor</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} - {supplier.company_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Pago *
              </label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Método de Pago *
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="transfer">Transferencia</option>
                <option value="cash">Efectivo</option>
                <option value="check">Cheque</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
                {creditBalances && creditBalances[formData.currency] && creditBalances[formData.currency].available_credit > 0 && (
                  <option value="credit_balance">Usar Saldo a Favor</option>
                )}
              </select>
            </div>

            <div>
              <label className="flex justify-between items-end mb-1">
                <span className="block text-sm font-medium text-gray-700">Monto Total del Pago *</span>
                {formData.payment_method === 'credit_balance' && creditBalances?.[formData.currency] && (
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Max: {formData.currency} {creditBalances[formData.currency].available_credit.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={displayAmount}
                onFocus={() => setDisplayAmount(formData.amount)}
                onChange={(e) => {
                  setDisplayAmount(e.target.value);
                  setUserEditedAmount(true);
                  const raw = parseNum(e.target.value);
                  if (raw !== '' && !isNaN(parseFloat(raw))) {
                    setFormData(prev => ({ ...prev, amount: raw }));
                  }
                }}
                onBlur={() => {
                  const raw = parseNum(displayAmount);
                  const num = parseFloat(raw);
                  if (!isNaN(num)) {
                    setFormData(prev => ({ ...prev, amount: num.toFixed(2) }));
                    setDisplayAmount(fmtNum(num.toFixed(2)));
                  } else {
                    setDisplayAmount('');
                  }
                }}
                required
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Moneda del Pago *
              </label>
              <select
                value={formData.currency}
                onChange={(e) => {
                  const newCurrency = e.target.value;
                  setRateFlipped(false);
                  setSystemRate(null);
                  setRateType('system');
                  setFormData(prev => ({ ...prev, currency: newCurrency, exchange_rate: '', exchange_rate_from: '', exchange_rate_to: '' }));

                  // Reset allocations back to their PO currency totals or clear them if cross-currency (waiting for new rate)
                  setAllocations(prevAlloc => {
                    const updated = prevAlloc.map(a => {
                      if (a.po_currency === newCurrency) {
                        return { ...a, allocated_amount: a.po_total.toFixed(2), display_amount: fmtNum(a.po_total.toFixed(2)) };
                      }
                      return { ...a, allocated_amount: '', display_amount: '' }; // Needs new exchange rate
                    });
                    const total = updated.reduce((sum, a) => sum + (parseFloat(a.allocated_amount) || 0), 0);
                    const rawTotal = total > 0 ? total.toFixed(2) : '';
                    setFormData(prev => ({ ...prev, amount: rawTotal }));
                    setDisplayAmount(rawTotal ? fmtNum(rawTotal) : '');
                    return updated;
                  });

                  const hasMismatch = allocations.some(a => a.po_currency !== newCurrency);

                  if (hasMismatch) {
                    setRateType('system');
                    fetchSystemRate(newCurrency);
                  }
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="USD">USD (Dólares)</option>
                <option value="COP">COP (Pesos)</option>
                <option value="VES">VES (Bolívares)</option>
              </select>
            </div>

            {/* Multi-Invoice Allocation Section */}
            {formData.supplier_id && (
              <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                    Distribuir Pago entre Facturas
                  </h4>
                </div>

                {/* Add PO dropdown — hidden when navigating from a specific PO (prefillLocked) */}
                {purchaseOrders.length > 0 && !prefillLocked && (
                  <div className="mb-3">
                    <select
                      onChange={(e) => {
                        const po = purchaseOrders.find(p => p.id === parseInt(e.target.value));
                        if (po) addAllocation(po);
                        e.target.value = '';
                      }}
                      className="w-full px-3 py-2 border border-dashed border-blue-300 rounded-lg bg-blue-50 text-blue-700 text-sm focus:ring-2 focus:ring-blue-500"
                      defaultValue=""
                    >
                      <option value="" disabled>+ Seleccionar Orden de Compra para abonar...</option>
                      {purchaseOrders
                        .filter(po => !allocations.find(a => a.purchase_order_id === po.id))
                        .map(po => (
                          <option key={po.id} value={po.id}>
                            {po.order_number} — Total: {po.currency} {parseFloat(po.total).toLocaleString('de-DE', { minimumFractionDigits: 2 })} | Saldo: {po.currency} {parseFloat(po.balance !== undefined ? po.balance : po.total).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            {po.last_invoice_number ? ` (Fact: ${po.last_invoice_number})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Cross-Currency Rate – appears when ANY allocation has a different currency */}
                {allocations.length > 0 && allocations.some(a => a.po_currency !== formData.currency) && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-3">
                    {(() => {
                      const otherCur = allocations.find(a => a.po_currency !== formData.currency)?.po_currency;
                      // In default direction (not flipped): 1 otherCur = systemRate payCur
                      // In flipped direction: 1 payCur = (1/systemRate) otherCur
                      const fromCur = rateFlipped ? formData.currency : otherCur;
                      const toCur = rateFlipped ? otherCur : formData.currency;
                      const systemRateForDir = systemRate
                        ? (rateFlipped ? (1 / systemRate) : systemRate)
                        : null;

                      const applyRate = (rateStr, from, to) => {
                        setFormData(prev => ({ ...prev, exchange_rate: rateStr, exchange_rate_from: from, exchange_rate_to: to }));
                        if (rateStr) recalcAllocationsForRate(rateStr, from, to, allocations);
                      };

                      return (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-amber-700">
                              💱 Tasa de Cambio ({fromCur} → {toCur})
                            </label>
                            <button
                              type="button"
                              title={`Cambiar a ${rateFlipped ? otherCur + ' → ' + formData.currency : formData.currency + ' → ' + otherCur}`}
                              onClick={() => {
                                const newFlipped = !rateFlipped;
                                setRateFlipped(newFlipped);
                                const newFrom = newFlipped ? formData.currency : otherCur;
                                const newTo = newFlipped ? otherCur : formData.currency;
                                if (rateType === 'system' && systemRate) {
                                  const newRate = newFlipped ? (1 / systemRate) : systemRate;
                                  applyRate(newRate.toString(), newFrom, newTo);
                                } else {
                                  const cur = parseFloat(formData.exchange_rate);
                                  const inv = cur > 0 ? (1 / cur).toString() : '';
                                  applyRate(inv, newFrom, newTo);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 transition-colors font-bold"
                            >
                              ⇄
                            </button>
                          </div>

                          {/* Toggle system vs custom — always visible */}
                          <div className="flex gap-2 mb-3">
                            <button
                              type="button"
                              disabled={!systemRate && !loadingRate}
                              onClick={() => {
                                if (!systemRate) return;
                                setRateType('system');
                                applyRate(systemRateForDir.toString(), fromCur, toCur);
                              }}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${loadingRate
                                ? 'bg-amber-100 text-amber-500 border border-amber-200 cursor-wait'
                                : !systemRate
                                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                  : rateType === 'system'
                                    ? 'bg-amber-600 text-white shadow-sm'
                                    : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-100'
                                }`}
                            >
                              {loadingRate
                                ? '⏳ Cargando tasa...'
                                : systemRateForDir
                                  ? `📊 Tasa del Sistema (${systemRateForDir.toFixed(4)})`
                                  : '📊 Tasa del Sistema (no disponible)'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRateType('custom');
                                setFormData(prev => ({ ...prev, exchange_rate: '', exchange_rate_from: fromCur, exchange_rate_to: toCur }));
                              }}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${rateType === 'custom' || !systemRate ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-100'}`}
                            >
                              ✏️ Tasa Pactada
                            </button>
                          </div>

                          {/* Rate display */}
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 whitespace-nowrap">1 {fromCur} =</span>
                            {rateType === 'system' && systemRate ? (
                              <div className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-lg font-bold text-amber-700 text-center">
                                {loadingRate ? 'Cargando...' : systemRateForDir.toFixed(4)}
                              </div>
                            ) : (
                              <input
                                type="number"
                                step="0.000001"
                                min="0"
                                value={formData.exchange_rate}
                                onChange={(e) => applyRate(e.target.value, fromCur, toCur)}
                                placeholder="Ingrese la tasa"
                                className="flex-1 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent font-bold text-amber-700 text-center"
                              />
                            )}
                            <span className="text-sm text-gray-600">{toCur}</span>
                          </div>
                        </>
                      );
                    })()}

                    {formData.exchange_rate && parseFloat(formData.amount) > 0 && (
                      <p className="mt-2 text-sm text-amber-600">
                        Equivalente: <strong>
                          {(() => {
                            const rate = parseFloat(formData.exchange_rate);
                            const amount = parseFloat(formData.amount);
                            const poCur = allocations.find(a => a.po_currency !== formData.currency)?.po_currency;
                            // If rate is from_PO_to_payment: 1 PO_cur = X payment_cur → PO amount = payment / rate
                            if (formData.exchange_rate_from === poCur) {
                              return `${poCur} ${(amount / rate).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
                            }
                            // If rate is from_payment_to_PO: 1 payment_cur = X PO_cur → PO amount = payment * rate
                            return `${poCur} ${(amount * rate).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
                          })()}
                        </strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Allocations List */}
                {allocations.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {allocations.map((alloc) => {
                      const crossCurrency = alloc.po_currency !== formData.currency;
                      let equivalentInPO = null;
                      if (crossCurrency && formData.exchange_rate && parseFloat(alloc.allocated_amount) > 0) {
                        const rate = parseFloat(formData.exchange_rate);
                        const allocAmt = parseFloat(alloc.allocated_amount);
                        if (formData.exchange_rate_from === alloc.po_currency) {
                          equivalentInPO = allocAmt / rate;
                        } else if (formData.exchange_rate_to === alloc.po_currency) {
                          equivalentInPO = allocAmt * rate;
                        } else {
                          equivalentInPO = allocAmt / rate;
                        }
                      }

                      return (
                        <div key={alloc.purchase_order_id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-gray-800">{alloc.order_number}</div>
                              <div className="text-xs text-gray-500">
                                Saldo: {alloc.po_currency} {alloc.po_total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {alloc.po_original_total ? `(de ${alloc.po_original_total.toLocaleString('de-DE', { minimumFractionDigits: 2 })})` : ''}
                                {crossCurrency && <span className="ml-1 text-amber-500">({alloc.po_currency} ≠ {formData.currency})</span>}
                              </div>
                            </div>
                            {prefillLocked && alloc.invoice_number ? (
                              <div className="w-28 px-2 py-1.5 border border-gray-200 rounded bg-gray-50 text-xs text-gray-600 flex items-center gap-1">
                                <span className="text-gray-400">🔒</span>{alloc.invoice_number}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={alloc.invoice_number}
                                onChange={(e) => updateAllocationInvoice(alloc.purchase_order_id, e.target.value)}
                                placeholder="# Factura"
                                className="w-28 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                              />
                            )}
                            <input
                              type="text"
                              inputMode="decimal"
                              value={alloc.display_amount ?? fmtNum(alloc.allocated_amount)}
                              onFocus={() =>
                                setAllocations(prev => prev.map(a =>
                                  a.purchase_order_id === alloc.purchase_order_id
                                    ? { ...a, display_amount: a.allocated_amount }
                                    : a
                                ))
                              }
                              onChange={(e) => {
                                const raw = parseNum(e.target.value);
                                setAllocations(prev => prev.map(a =>
                                  a.purchase_order_id === alloc.purchase_order_id
                                    ? { ...a, display_amount: e.target.value, allocated_amount: raw }
                                    : a
                                ));
                              }}
                              onBlur={() => {
                                setAllocations(prev => prev.map(a => {
                                  if (a.purchase_order_id !== alloc.purchase_order_id) return a;
                                  const num = parseFloat(a.allocated_amount);
                                  const formatted = !isNaN(num) ? fmtNum(num.toFixed(2)) : '';
                                  const raw = !isNaN(num) ? num.toFixed(2) : '';
                                  return { ...a, display_amount: formatted, allocated_amount: raw };
                                }));
                              }}
                              placeholder="0,00"
                              className="w-36 px-2 py-1.5 border border-gray-300 rounded text-sm font-bold text-right focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-500 w-8">{formData.currency}</span>
                            {!prefillLocked && (
                              <button
                                type="button"
                                onClick={() => removeAllocation(alloc.purchase_order_id)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {crossCurrency && equivalentInPO !== null && (
                            <div className="mt-1 text-xs text-amber-600 pl-1">
                              ≈ {alloc.po_currency} {equivalentInPO.toLocaleString('de-DE', { minimumFractionDigits: 2 })} de {alloc.po_currency} {alloc.po_total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Allocation Summary */}
                {allocations.length > 0 && formData.amount && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total del pago:</span>
                      <span className="font-bold">{formData.currency} {parseFloat(formData.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Distribuido:</span>
                      <span className="font-bold text-green-600">{formData.currency} {totalAllocated.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {/* Overage error */}
                    {/* Overage error */}
                    {unallocated < -0.01 && (
                      <div className="mt-1 pt-1 border-t border-red-300">
                        <div className="flex justify-between">
                          <span className="text-red-700 font-medium">⚠️ Error de distribución:</span>
                          <span className="font-bold text-red-700">{formData.currency} {Math.abs(unallocated).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <p className="text-xs text-red-600 mt-1">
                          El monto distribuido supera el Monto Total del Pago. Debes disminuir lo asignado a las facturas o aumentar el Total del Pago.
                        </p>
                      </div>
                    )}
                    {/* Unallocated info/anticipo */}
                    {unallocated > 0.01 && (
                      <div className="mt-1 pt-1 border-t border-blue-300">
                        <div className="flex justify-between">
                          <span className="text-blue-700 font-medium">✨ Saldo a Favor generado:</span>
                          <span className="font-bold text-blue-700">{formData.currency} {unallocated.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          El Monto Total supera a la distribución. La diferencia quedará registrada automáticamente como anticipo o saldo a favor del proveedor.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {purchaseOrders.length === 0 && formData.supplier_id && (
                  <p className="text-sm text-gray-400 italic">Este proveedor no tiene órdenes recibidas pendientes de pago.</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referencia de Transacción
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Cheque, Transferencia, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                allocations.length === 0 ||
                unallocated < -0.01 ||
                (formData.payment_method === 'credit_balance' && parseFloat(formData.amount) > (creditBalances?.[formData.currency]?.available_credit || 0))
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Registrar Pago
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
        }}
        title="Editar Pago"
      >
        <form onSubmit={handleUpdatePayment} className="space-y-4">
          {/* Monto y moneda — solo lectura en edición */}
          {editingPayment && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-4">
              <div>
                <p className="text-xs text-gray-500">Monto</p>
                <p className="font-bold text-lg text-gray-800">{editingPayment.currency} {parseFloat(editingPayment.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-gray-300 text-xl">|</div>
              <div>
                <p className="text-xs text-gray-500">Número de Pago</p>
                <p className="font-medium text-gray-700">{editingPayment.payment_number}</p>
              </div>
              <span className="ml-auto text-xs text-gray-400 italic">Monto y moneda no editables</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Pago *
              </label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Método de Pago *
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="transfer">Transferencia</option>
                <option value="cash">Efectivo</option>
                <option value="check">Cheque</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referencia
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Número de cheque, referencia de transferencia, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                N° Factura del Proveedor
              </label>
              <input
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="Ej: FAC-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Distribución del pago — solo lectura */}
          {editingPayment?.allocations?.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Distribución del pago</p>
              <div className="space-y-2">
                {editingPayment.allocations.map((alloc) => (
                  <div key={alloc.id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-blue-700">{alloc.purchaseOrder?.order_number || 'OC #' + alloc.purchase_order_id}</span>
                      {alloc.invoice_number && <span className="ml-2 text-gray-500">Fact: {alloc.invoice_number}</span>}
                    </div>
                    <span className="font-semibold text-gray-800">
                      {editingPayment.currency} {parseFloat(alloc.allocated_amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Actualizar Pago
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingPayment(null);
        }}
        title="Detalle del Pago"
      >
        {viewingPayment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Número de Pago</p>
                <p className="font-medium">{viewingPayment.payment_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Estado</p>
                {(() => {
                  const cfg = { recorded: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
                  const labels = { recorded: 'Registrado', confirmed: 'Confirmado', cancelled: 'Cancelado' };
                  return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg[viewingPayment.status] || 'bg-gray-100 text-gray-700'}`}>
                      {labels[viewingPayment.status] || viewingPayment.status}
                    </span>
                  );
                })()}
              </div>
              <div>
                <p className="text-sm text-gray-600">Fecha</p>
                <p className="font-medium">{viewingPayment.payment_date ? new Date(viewingPayment.payment_date).toLocaleDateString('es-ES') : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Proveedor</p>
                <p className="font-medium">{viewingPayment.supplier?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Método de Pago</p>
                <p className="font-medium">{getPaymentMethodLabel(viewingPayment.payment_method)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Monto Total</p>
                <p className="font-bold text-lg">{viewingPayment.currency || ''} {(parseFloat(viewingPayment.amount) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
              </div>
              {viewingPayment.invoice_number && (
                <div>
                  <p className="text-sm text-gray-600">N° Factura</p>
                  <p className="font-medium">{viewingPayment.invoice_number}</p>
                </div>
              )}
              {viewingPayment.reference && (
                <div>
                  <p className="text-sm text-gray-600">Referencia</p>
                  <p className="font-medium">{viewingPayment.reference}</p>
                </div>
              )}
              {viewingPayment.notes && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Notas</p>
                  <p className="font-medium">{viewingPayment.notes}</p>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Registrado por</p>
                <p className="font-medium">{[viewingPayment.creator?.first_name, viewingPayment.creator?.last_name].filter(Boolean).join(' ') || viewingPayment.creator?.username || 'N/A'}</p>
                <p className="text-xs text-gray-500">{viewingPayment.created_at ? new Date(viewingPayment.created_at).toLocaleString('es-ES') : ''}</p>
              </div>
            </div>

            {/* Distribución entre órdenes de compra */}
            {viewingPayment.allocations?.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Distribución del pago</p>
                <div className="space-y-2">
                  {viewingPayment.allocations.map((alloc) => (
                    <div key={alloc.id} className="flex items-start justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-blue-700">{alloc.purchaseOrder?.order_number || 'OC #' + alloc.purchase_order_id}</p>
                        {alloc.invoice_number && <p className="text-xs text-gray-500">Factura: {alloc.invoice_number}</p>}
                        {alloc.purchaseOrder?.currency && alloc.purchaseOrder.currency !== viewingPayment.currency && (
                          <p className="text-xs text-gray-400">
                            ≈ {alloc.purchaseOrder.currency} {parseFloat(alloc.allocated_amount_po_currency).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            {alloc.exchange_rate_used && alloc.exchange_rate_used !== 1 && ` (tasa: ${parseFloat(alloc.exchange_rate_used).toFixed(4)})`}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                        {viewingPayment.currency} {parseFloat(alloc.allocated_amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SupplierPaymentsPage;
