import React, { useState } from 'react';
import { User, Phone, MapPin, CurrencyCircleDollar, WarningCircle, X } from '@phosphor-icons/react';
import { customerService } from '../services/api/customerService';

interface Customer {
  id: number;
  [key: string]: unknown;
}

interface CustomerQuickAddProps {
  onSave: (customer: Customer) => void;
  onCancel: () => void;
  renderFooter?: boolean;
}

interface CustomerFormData {
  type: 'natural' | 'juridical';
  documentType: string;
  documentNumber: string;
  businessName: string;
  tradeName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  city: string;
  state: string;
  creditLimit: number;
  creditDays: number;
  priceListId: number | null;
  discountPercentage: number;
  notes: string;
}

interface DocType {
  value: string;
  label: string;
}

const VE_DOC_TYPES: DocType[] = [
    { value: 'V', label: 'V - Venezolano/a' },
    { value: 'E', label: 'E - Extranjero/a' },
    { value: 'J', label: 'J - Jurídico (RIF empresa)' },
    { value: 'G', label: 'G - Gubernamental' },
    { value: 'P', label: 'P - Pasaporte' },
];

const DOC_TYPES_BY_TYPE: Record<string, string[]> = {
    natural: ['V', 'E', 'P'],
    juridical: ['J', 'G'],
};

const emptyForm = (): CustomerFormData => ({
    type: 'natural',
    documentType: 'V',
    documentNumber: '',
    businessName: '',
    tradeName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mobile: '',
    address: '',
    city: '',
    state: '',
    creditLimit: 0,
    creditDays: 0,
    priceListId: null,
    discountPercentage: 0,
    notes: '',
});

const CustomerQuickAdd: React.FC<CustomerQuickAddProps> = ({ onSave, onCancel, renderFooter = true }) => {
    const [formData, setFormData] = useState<CustomerFormData>(emptyForm());
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string | null>>({});

    const availableDocTypes = VE_DOC_TYPES.filter(d =>
        DOC_TYPES_BY_TYPE[formData.type].includes(d.value)
    );

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};
        if (!formData.documentNumber || !formData.documentNumber.trim()) {
            errors.documentNumber = 'Requerido';
        }
        if (formData.type === 'natural') {
            if (!formData.firstName || !formData.firstName.trim()) errors.firstName = 'Requerido';
            if (!formData.lastName || !formData.lastName.trim()) errors.lastName = 'Requerido';
        } else {
            if (!formData.businessName || !formData.businessName.trim()) errors.businessName = 'Requerido';
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
        const { name, value } = e.target;

        if (validationErrors[name]) {
            setValidationErrors(prev => ({ ...prev, [name]: null }));
        }

        if (name === 'type') {
            const newDocType = value === 'natural' ? 'V' : 'J';
            setFormData(prev => ({
                ...prev,
                [name]: value,
                documentType: newDocType
            }));
            setValidationErrors(prev => ({ ...prev, firstName: null, lastName: null, businessName: null }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const getInputStyle = (fieldName: string): string => {
        const baseStyle = "w-full text-sm border rounded-lg p-2 transition-all outline-none focus:ring-2";
        if (validationErrors[fieldName]) {
            return `${baseStyle} border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200`;
        }
        return `${baseStyle} border-gray-200 bg-gray-50 focus:bg-white focus:border-primary-500 focus:ring-primary-100`;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        setError(null);

        try {
            const response = await customerService.create(formData);
            onSave(response.data);
        } catch (err) {
            console.error('Save error:', err);
            let msg = 'Error al guardar el cliente.';
            if (err.response?.data?.message) msg = err.response.data.message;
            if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
                msg = `${msg}: ${err.response.data.errors.map(e => e.message).join(', ')}`;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form id="customer-quick-add-form" onSubmit={handleSubmit} className="space-y-4 py-1">
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <WarningCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-800 flex-1">{error}</p>
                    <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Identificación */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <User className="h-4 w-4 text-gray-400" />
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Identificación</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Cliente</label>
                            <select name="type" value={formData.type} onChange={handleChange} className={getInputStyle('type')}>
                                <option value="natural">Natural</option>
                                <option value="juridical">Jurídico</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo Doc.</label>
                            <select name="documentType" value={formData.documentType} onChange={handleChange} className={getInputStyle('documentType')}>
                                {availableDocTypes.map(d => (
                                    <option key={d.value} value={d.value}>{d.label.split(' - ')[0]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Documento <span className="text-red-500">*</span></label>
                        <div className="flex">
                            <span className={`inline-flex items-center px-2 border border-r-0 rounded-l-lg text-xs font-bold ${validationErrors.documentNumber ? 'bg-red-50 border-red-400 text-red-600' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                                {formData.documentType}-
                            </span>
                            <input type="text" name="documentNumber" value={formData.documentNumber} onChange={handleChange}
                                className={`flex-1 text-sm border rounded-r-lg p-2 transition-all outline-none focus:ring-2 ${validationErrors.documentNumber ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-primary-500 focus:ring-primary-100'}`}
                                placeholder="Número" />
                        </div>
                        {validationErrors.documentNumber && <p className="text-red-500 text-[10px] mt-1 font-medium">{validationErrors.documentNumber}</p>}
                    </div>

                    {formData.type === 'natural' ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
                                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange}
                                    className={getInputStyle('firstName')} placeholder="Ej: Juan" />
                                {validationErrors.firstName && <p className="text-red-500 text-[10px] mt-1 font-medium">{validationErrors.firstName}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Apellido <span className="text-red-500">*</span></label>
                                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange}
                                    className={getInputStyle('lastName')} placeholder="Ej: Pérez" />
                                {validationErrors.lastName && <p className="text-red-500 text-[10px] mt-1 font-medium">{validationErrors.lastName}</p>}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Razón Social <span className="text-red-500">*</span></label>
                            <input type="text" name="businessName" value={formData.businessName} onChange={handleChange}
                                className={getInputStyle('businessName')} placeholder="Ej: Mi Empresa C.A." />
                            {validationErrors.businessName && <p className="text-red-500 text-[10px] mt-1 font-medium">{validationErrors.businessName}</p>}
                        </div>
                    )}
                </div>

                {/* Contacto y Crédito Section */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Contacto</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Celular</label>
                            <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange}
                                className={getInputStyle('mobile')} placeholder="04xx-xxx-xxxx" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange}
                                className={getInputStyle('email')} placeholder="opcional" />
                        </div>
                    </div>

                    <div className="mt-auto">
                        <div className="flex items-center gap-2 pb-1 border-b border-gray-100 mb-4">
                            <CurrencyCircleDollar className="h-4 w-4 text-gray-400" />
                            <h3 className="text-xs font-semibold text-gray-500 uppercase">Crédito / Descuento</h3>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Límite $</label>
                                <input type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange}
                                    className={getInputStyle('creditLimit')} min="0" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Días</label>
                                <input type="number" name="creditDays" value={formData.creditDays} onChange={handleChange}
                                    className={getInputStyle('creditDays')} min="0" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Desc. %</label>
                                <input type="number" name="discountPercentage" value={formData.discountPercentage} onChange={handleChange}
                                    className={getInputStyle('discountPercentage')} min="0" max="100" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 pb-1 border-b border-gray-100 pt-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-500 uppercase">Dirección</h3>
            </div>
            <input type="text" name="address" value={formData.address} onChange={handleChange}
                className={getInputStyle('address')} placeholder="Calle, Ciudad, Estado..." />

            {/* Only render own footer if used standalone (not embedded in CustomerSearch) */}
            {renderFooter && (
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors" disabled={loading}>
                        Volver a búsqueda
                    </button>
                    <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm transition-all" disabled={loading}>
                        {loading ? 'Guardando...' : 'Crear y Seleccionar'}
                    </button>
                </div>
            )}
        </form>
    );
};

export default CustomerQuickAdd;
