import React, { useState } from 'react';
import { User, Phone, MapPin, CurrencyCircleDollar } from '@phosphor-icons/react';
import { customerService } from '../services/api/customerService';
import { Input, Select, Alert, Button } from './ui';

interface Customer {
  id: number;
  type: string;
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
                [name]: value as CustomerFormData['type'],
                documentType: newDocType
            }));
            setValidationErrors(prev => ({ ...prev, firstName: null, lastName: null, businessName: null }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value } as CustomerFormData));
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        setError(null);

        try {
            const response = await customerService.create(formData as unknown as Record<string, unknown>);
            onSave(response.data);
        } catch (err: unknown) {
            console.error('Save error:', err);
            let msg = 'Error al guardar el cliente.';
            const axiosErr = err as { response?: { data?: { message?: string; errors?: Array<{ message: string }> } } };
            if (axiosErr.response?.data?.message) msg = axiosErr.response.data.message;
            if (axiosErr.response?.data?.errors && Array.isArray(axiosErr.response.data.errors)) {
                msg = `${msg}: ${axiosErr.response.data.errors.map((e: { message: string }) => e.message).join(', ')}`;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form id="customer-quick-add-form" onSubmit={handleSubmit} className="space-y-4 py-1">
            {error && (
                <Alert key={error} variant="error" dismissible>
                    {error}
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Identificacion */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <User className="h-4 w-4 text-gray-400" />
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Identificación</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Tipo de Cliente" name="type" value={formData.type} onChange={handleChange}>
                            <option value="natural">Natural</option>
                            <option value="juridical">Jurídico</option>
                        </Select>
                        <Select label="Tipo Doc." name="documentType" value={formData.documentType} onChange={handleChange}>
                            {availableDocTypes.map(d => (
                                <option key={d.value} value={d.value}>{d.label.split(' - ')[0]}</option>
                            ))}
                        </Select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Documento <span className="text-red-500">*</span></label>
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
                            <Input label="Nombre *" name="firstName" value={formData.firstName} onChange={handleChange}
                                error={validationErrors.firstName || undefined} placeholder="Ej: Juan" />
                            <Input label="Apellido *" name="lastName" value={formData.lastName} onChange={handleChange}
                                error={validationErrors.lastName || undefined} placeholder="Ej: Pérez" />
                        </div>
                    ) : (
                        <Input label="Razón Social *" name="businessName" value={formData.businessName} onChange={handleChange}
                            error={validationErrors.businessName || undefined} placeholder="Ej: Mi Empresa C.A." />
                    )}
                </div>

                {/* Contacto y Credito Section */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Contacto</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Celular" type="tel" name="mobile" value={formData.mobile} onChange={handleChange}
                            placeholder="04xx-xxx-xxxx" />
                        <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange}
                            placeholder="opcional" />
                    </div>

                    <div className="mt-auto">
                        <div className="flex items-center gap-2 pb-1 border-b border-gray-100 mb-4">
                            <CurrencyCircleDollar className="h-4 w-4 text-gray-400" />
                            <h3 className="text-xs font-semibold text-gray-500 uppercase">Crédito / Descuento</h3>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <Input label="Límite $" type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange}
                                min="0" />
                            <Input label="Días" type="number" name="creditDays" value={formData.creditDays} onChange={handleChange}
                                min="0" />
                            <Input label="Desc. %" type="number" name="discountPercentage" value={formData.discountPercentage} onChange={handleChange}
                                min="0" max="100" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 pb-1 border-b border-gray-100 pt-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-500 uppercase">Dirección</h3>
            </div>
            <Input name="address" value={formData.address} onChange={handleChange}
                placeholder="Calle, Ciudad, Estado..." />

            {/* Only render own footer if used standalone (not embedded in CustomerSearch) */}
            {renderFooter && (
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="secondary" type="button" onClick={onCancel} disabled={loading}>
                        Volver a búsqueda
                    </Button>
                    <Button type="submit" disabled={loading} loading={loading}>
                        Crear y Seleccionar
                    </Button>
                </div>
            )}
        </form>
    );
};

export default CustomerQuickAdd;
