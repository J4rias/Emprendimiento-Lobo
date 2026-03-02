import { useState, useEffect, useRef } from 'react';
import { Search, X, User, AlertCircle, CreditCard, ChevronRight, UserPlus } from 'lucide-react';
import { customerService } from '../services/api/customerService';
import Modal from './common/Modal';
import CustomerQuickAdd from './CustomerQuickAdd';

const CustomerSearch = ({ isOpen, onClose, onSelect, validateCredit = false, saleAmount = 0 }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [creditValidation, setCreditValidation] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      // Focus search input when modal opens
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      // Reset state when modal closes
      setIsAdding(false);
      setSearch('');
      setSelectedCustomer(null);
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
  }, [search, isAdding]);

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
    setSelectedCustomer(customer);
    setCreditValidation(null);
    setError(null);

    // If validation is required and it's a credit sale
    if (validateCredit && saleAmount > 0) {
      try {
        const validation = await customerService.validateCredit(customer.id, saleAmount);
        setCreditValidation(validation);

        if (!validation.has_available_credit) {
          setError(
            `El cliente no tiene crédito suficiente. ` +
            `Disponible: $ ${validation.available_credit?.toFixed(2) || '0.00'}, ` +
            `Requerido: $ ${saleAmount.toFixed(2)}`
          );
        }
      } catch (err) {
        setError('Error al validar el crédito del cliente');
        console.error('Error validating credit:', err);
      }
    }
  };

  const handleConfirm = () => {
    if (!selectedCustomer) {
      setError('Seleccione un cliente');
      return;
    }

    // If credit validation failed, show warning but allow override
    if (validateCredit && creditValidation && !creditValidation.has_available_credit) {
      const confirm = window.confirm(
        'El cliente no tiene crédito suficiente. ¿Desea continuar de todas formas?'
      );
      if (!confirm) return;
    }

    onSelect(selectedCustomer);
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
      <div className="max-w-3xl mx-auto py-2">
        {isAdding ? (
          <CustomerQuickAdd
            onSave={(newCustomer) => {
              onSelect(newCustomer);
              setIsAdding(false);
              onClose();
            }}
            onCancel={() => setIsAdding(false)}
          />
        ) : (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por nombre, documento o teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            {/* Selected Customer Info */}
            {selectedCustomer && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900">{getCustomerDisplayName(selectedCustomer)}</h4>
                    <p className="text-sm text-blue-700">{getCustomerDocumentLabel(selectedCustomer)}</p>
                    {selectedCustomer.email && (
                      <p className="text-sm text-blue-600">{selectedCustomer.email}</p>
                    )}
                    {selectedCustomer.phone && (
                      <p className="text-sm text-blue-600">Tel: {selectedCustomer.phone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Credit Information */}
                {selectedCustomer.creditLimit > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-blue-700">Límite de Crédito:</span>
                        <p className="font-semibold text-blue-900">
                          $ {parseFloat(selectedCustomer.creditLimit || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span className="text-blue-700">Días de Crédito:</span>
                        <p className="font-semibold text-blue-900">
                          {selectedCustomer.creditDays || 0} días
                        </p>
                      </div>
                      {selectedCustomer.discountPercentage > 0 && (
                        <div>
                          <span className="text-blue-700">Descuento:</span>
                          <p className="font-semibold text-green-600">
                            {selectedCustomer.discountPercentage}%
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Credit Validation Result */}
                    {creditValidation && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-blue-700">Crédito Usado:</span>
                            <p className="font-semibold text-blue-900">
                              $ {creditValidation.current_balance?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                          <div>
                            <span className="text-blue-700">Crédito Disponible:</span>
                            <p className={`font-semibold ${creditValidation.has_available_credit ? 'text-green-600' : 'text-red-600'
                              }`}>
                              $ {creditValidation.available_credit?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Customer List */}
            <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
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
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selectedCustomer?.id === customer.id ? 'bg-blue-50' : ''
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">
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
                                Crédito: $ {parseFloat(customer.creditLimit || 0).toFixed(2)}
                              </span>
                              {customer.discountPercentage > 0 && (
                                <span className="text-xs text-blue-600">
                                  Desc: {customer.discountPercentage}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons (Searching) */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors font-medium"
              >
                <UserPlus className="w-4 h-4" />
                Nuevo Cliente
              </button>
              <div className="flex-1" />
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedCustomer}
                className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                Seleccionar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CustomerSearch;
