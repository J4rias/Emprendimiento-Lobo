import { useState } from 'react';
import { User, Phone, MapPin, BadgeDollarSign, AlertCircle, X } from 'lucide-react';
import { customerService } from '../services/api/customerService';

const VE_DOC_TYPES = [
    { value: 'V', label: 'V - Venezolano/a' },
    { value: 'E', label: 'E - Extranjero/a' },
    { value: 'J', label: 'J - Jurídico (RIF empresa)' },
    { value: 'G', label: 'G - Gubernamental' },
    { value: 'P', label: 'P - Pasaporte' },
];

const DOC_TYPES_BY_TYPE = {
    natural: ['V', 'E', 'P'],
    juridical: ['J', 'G'],
};

const emptyForm = () => ({
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

const CustomerQuickAdd = ({ onSave, onCancel }) => {
    const [formData, setFormData] = useState(emptyForm());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const availableDocTypes = VE_DOC_TYPES.filter(d =>
        DOC_TYPES_BY_TYPE[formData.type].includes(d.value)
    );

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'type') {
            const newDocType = value === 'natural' ? 'V' : 'J';
            setFormData(prev => ({
                ...prev,
                [name]: value,
                documentType: newDocType
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
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
                            <select name="type" value={formData.type} onChange={handleChange} className="w-full text-sm border border-gray-300 rounded-lg p-2">
                                <option value="natural">Natural</option>
                                <option value="juridical">Jurídico</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo Doc.</label>
                            <select name="documentType" value={formData.documentType} onChange={handleChange} className="w-full text-sm border border-gray-300 rounded-lg p-2">
                                {availableDocTypes.map(d => (
                                    <option key={d.value} value={d.value}>{d.label.split(' - ')[0]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Documento <span className="text-red-500">*</span></label>
                        <div className="flex">
                            <span className="inline-flex items-center px-2 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-700 text-xs font-bold">
                                {formData.documentType}-
                            </span>
                            <input type="text" name="documentNumber" value={formData.documentNumber} onChange={handleChange}
                                className="flex-1 text-sm border border-gray-300 rounded-r-lg p-2" required placeholder="Número" />
                        </div>
                    </div>

                    {formData.type === 'natural' ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
                                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange}
                                    className="w-full text-sm border border-gray-300 rounded-lg p-2" required placeholder="Ej: Juan" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Apellido <span className="text-red-500">*</span></label>
                                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange}
                                    className="w-full text-sm border border-gray-300 rounded-lg p-2" required placeholder="Ej: Pérez" />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Razón Social <span className="text-red-500">*</span></label>
                            <input type="text" name="businessName" value={formData.businessName} onChange={handleChange}
                                className="w-full text-sm border border-gray-300 rounded-lg p-2" required placeholder="Ej: Mi Empresa C.A." />
                        </div>
                    )}
                </div>

                {/* Contacto y Crédito Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Contacto</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Celular</label>
                            <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange}
                                className="w-full text-sm border border-gray-300 rounded-lg p-2" placeholder="04xx-xxx-xxxx" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange}
                                className="w-full text-sm border border-gray-300 rounded-lg p-2" placeholder="opcional" />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100 pt-2">
                        <BadgeDollarSign className="h-4 w-4 text-gray-400" />
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Crédito / Descuento</h3>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Límite $</label>
                            <input type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange}
                                className="w-full text-sm border border-gray-300 rounded-lg p-2" min="0" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Días</label>
                            <input type="number" name="creditDays" value={formData.creditDays} onChange={handleChange}
                                className="w-full text-sm border border-gray-300 rounded-lg p-2" min="0" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Desc. %</label>
                            <input type="number" name="discountPercentage" value={formData.discountPercentage} onChange={handleChange}
                                className="w-full text-sm border border-gray-300 rounded-lg p-2" min="0" max="100" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 pb-1 border-b border-gray-100 pt-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-500 uppercase">Dirección</h3>
            </div>
            <input type="text" name="address" value={formData.address} onChange={handleChange}
                className="w-full text-sm border border-gray-300 rounded-lg p-2" placeholder="Calle, Ciudad, Estado..." />

            <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50" disabled={loading}>
                    Volver a búsqueda
                </button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm" disabled={loading}>
                    {loading ? 'Guardando...' : 'Crear y Seleccionar'}
                </button>
            </div>
        </form>
    );
};

export default CustomerQuickAdd;
