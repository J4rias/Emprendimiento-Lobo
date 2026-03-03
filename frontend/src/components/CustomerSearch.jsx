import { useState, useEffect, useRef } from 'react';
import { Search, X, User, AlertCircle, CreditCard, ChevronRight, UserPlus } from 'lucide-react';
import { customerService } from '../services/api/customerService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import Modal from './common/Modal';
import CustomerQuickAdd from './CustomerQuickAdd';

const CustomerSearch = ({ isOpen, onClose, onSelect, validateCredit = false, saleAmount = 0, exchangeRates = [] }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [creditValidation, setCreditValidation] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setIsAdding(false);
      setSearch('');
      setCreditValidation(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen && !isAdding) {
        fetchCustomers();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await customerService.getAll({
        search,
        status: 'active',
        limit: 50
      });
      setCustomers(response.data || []);
    } catch (err) {
      setError('Error al buscar clientes');
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = async (customer) => {
    setError(null);
    setCreditValidation(null);

    if (validateCredit && saleAmount > 0) {
      try {
        // Credits are managed in COP — convert the USD sale amount to COP
        const copRate = calculateEffectiveRate('USD', 'COP', exchangeRates) || 1;
        const saleAmountCOP = Math.round(saleAmount * copRate);

        const validation = await customerService.validateCredit(customer.id, saleAmountCOP);
        const creditData = validation.data || validation;
        setCreditValidation(creditData);

        if (!creditData.hasAvailableCredit) {
          const available = Math.round(parseFloat(creditData.availableCredit || 0));
          setError(
            `El cliente no tiene crédito suficiente. ` +
            `Disponible: COP ${available.toLocaleString('de-DE')}, ` +
            `Requerido: COP ${saleAmountCOP.toLocaleString('de-DE')}`
          );
          return;
        }
      } catch (err) {
        setError('Error al validar el crédito del cliente');
        console.error('Error validating credit:', err);
        return;
      }
    }

    onSelect(customer);
    onClose();
  };

  const getCustomerDisplayName = (customer) => {
    if (customer.type === 'natural') {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Sin nombre';
    }
    return customer.businessName || customer.tradeName || 'Sin nombre';
  };

  const getCustomerDocumentLabel = (customer) => {
    return `${customer.documentType || ''}-${customer.documentNumber || ''}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAdding ? "Nuevo Cliente" : "Seleccionar Cliente"}
      size="lg"
    >
      {/* Shared fixed-height shell: content area + footer */}
      <div className="flex flex-col" style={{ height: '520px' }}>

        {/* ── Scrollable content area (fills remaining space above footer) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isAdding ? (
            <CustomerQuickAdd
              onSave={(newCustomer) => {
                onSelect(newCustomer);
                setIsAdding(false);
                onClose();
              }}
              onCancel={() => setIsAdding(false)}
              renderFooter={false}
            />
          ) : (
            <div className="space-y-4 py-1">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar por nombre, documento o teléfono..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
                />
              </div>

              {/* Error Alert */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                  <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Customer List */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p>Buscando clientes...</p>
                  </div>
                ) : customers.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No se encontraron clientes</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full text-left p-4 hover:bg-blue-50 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                                {getCustomerDisplayName(customer)}
                              </h4>
                              {customer.type === 'juridical' && (
                                <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                                  Empresa
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{getCustomerDocumentLabel(customer)}</p>
                            {customer.phone && (
                              <p className="text-sm text-gray-500">Tel: {customer.phone}</p>
                            )}
                            {customer.creditLimit > 0 && (
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-green-600 flex items-center gap-1">
                                  <CreditCard className="w-3 h-3" />
                                  Crédito: COP {Math.round(parseFloat(customer.creditLimit || 0)).toLocaleString('de-DE')}
                                </span>
                                {customer.discountPercentage > 0 && (
                                  <span className="text-xs text-blue-600">
                                    Desc: {customer.discountPercentage}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Shared Footer (always at the same position) ── */}
        <div className="flex items-center gap-3 pt-4 mt-3 border-t border-gray-200 flex-shrink-0">
          {isAdding ? (
            <>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                ← Volver a búsqueda
              </button>
              <div className="flex-1" />
              <button
                type="submit"
                form="customer-quick-add-form"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm transition-all"
              >
                Crear y Seleccionar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors font-medium text-sm"
              >
                <UserPlus className="w-4 h-4" />
                Nuevo Cliente
              </button>
              <div className="flex-1" />
              <button
                onClick={onClose}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CustomerSearch;
