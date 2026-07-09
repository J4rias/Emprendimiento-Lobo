import { useState, useEffect } from 'react';
import { Plus, Package, Star, Trash, CurrencyDollar } from '@phosphor-icons/react';
import { formatMoney } from '../../utils/formatUtils';

const PresentationManager = ({ presentations = [], onChange, readonly = false, packagingTypes = [], presentationTypes = [], productUnitSize = '', productUnitMeasure = 'UND' }) => {
  const [localPresentations, setLocalPresentations] = useState([]);

  const currencies = [
    { code: 'USD', symbol: '$' },
    { code: 'COP', symbol: '$' },
    { code: 'VES', symbol: 'Bs' }
  ];

  // Generate automatic presentation name
  const generatePresentationName = (unitsPerPackage, packagingTypeId) => {
    if (!productUnitSize || !unitsPerPackage) return '';

    const packagingType = packagingTypes.find(t => t.id === parseInt(packagingTypeId));
    const packagingAbbr = packagingType ? packagingType.name.substring(0, 3).toUpperCase() : 'EMP';

    // Format unit size: show one decimal only if it's not a whole number
    const unitSize = parseFloat(productUnitSize);
    const formattedUnitSize = unitSize % 1 === 0 ? unitSize.toString() : unitSize.toFixed(1);

    return `${formattedUnitSize} ${productUnitMeasure} ${packagingAbbr} x${unitsPerPackage}`;
  };

  useEffect(() => {
    setLocalPresentations(presentations);
  }, [presentations]);

  // Regenerate presentation names when productUnitSize or productUnitMeasure changes
  useEffect(() => {
    if (!productUnitSize || localPresentations.length === 0) return;

    const updatedPresentations = localPresentations.map(presentation => {
      const newName = generatePresentationName(
        presentation.units_per_package,
        presentation.packaging_type_id
      );
      return newName ? { ...presentation, name: newName } : presentation;
    });

    setLocalPresentations(updatedPresentations);
    onChange(updatedPresentations);
     
  }, [productUnitSize, productUnitMeasure]);

  const addPresentation = () => {
    const newPresentation = {
      id: null,
      name: '',
      packaging_type_id: null,
      presentation_type_id: null,
      units_per_package: 1,
      package_price: 0,
      package_cost: 0,
      purchase_currency: 'USD',
      is_default: localPresentations.length === 0, // Si es la primera, marcar como predeterminada
      is_active: true,
      isNew: true
    };

    // Generar nombre inicial
    const initialName = generatePresentationName(newPresentation.units_per_package, newPresentation.packaging_type_id);
    if (initialName) {
      newPresentation.name = initialName;
    } else {
      newPresentation.name = 'Presentación estándar';
    }

    const updatedPresentations = [...localPresentations, newPresentation];
    setLocalPresentations(updatedPresentations);
    onChange(updatedPresentations);
  };

  const updatePresentation = (index, field, value) => {
    const updatedPresentations = [...localPresentations];

    // Si se marca como predeterminada, desmarcar las demás
    if (field === 'is_default' && value === true) {
      updatedPresentations.forEach((presentation, i) => {
        if (i !== index) {
          presentation.is_default = false;
        }
      });
    }

    // Convertir valores numéricos
    if (field === 'units_per_package') {
      updatedPresentations[index][field] = parseInt(value) || 1;
    } else if (field === 'package_price' || field === 'package_cost') {
      updatedPresentations[index][field] = parseFloat(value) || 0;
    } else if (field === 'packaging_type_id' || field === 'presentation_type_id') {
      updatedPresentations[index][field] = value ? parseInt(value) : null;
    } else {
      updatedPresentations[index][field] = value;
    }

    // Auto-generate name when units_per_package or packaging_type_id changes
    if (field === 'units_per_package' || field === 'packaging_type_id') {
      const presentation = updatedPresentations[index];
      const newName = generatePresentationName(
        presentation.units_per_package,
        presentation.packaging_type_id
      );
      if (newName) {
        updatedPresentations[index].name = newName;
      }
    }

    setLocalPresentations(updatedPresentations);
    onChange(updatedPresentations);
  };

  const removePresentation = (index) => {
    if (localPresentations.length === 1) {
      alert('No puedes eliminar la última presentación. Un producto debe tener al menos una presentación.');
      return;
    }

    const updatedPresentations = localPresentations.filter((_, i) => i !== index);

    // Si eliminamos la presentación predeterminada, marcar la primera como predeterminada
    if (localPresentations[index].is_default && updatedPresentations.length > 0) {
      updatedPresentations[0].is_default = true;
    }

    setLocalPresentations(updatedPresentations);
    onChange(updatedPresentations);
  };

  const getDefaultPresentation = () => {
    return localPresentations.find(p => p.is_default);
  };

  const getPackagingTypeName = (id) => {
    const type = packagingTypes.find(t => t.id === parseInt(id));
    return type ? type.name : 'N/A';
  };

  const getPresentationTypeName = (id) => {
    const type = presentationTypes.find(t => t.id === parseInt(id));
    return type ? type.name : 'N/A';
  };

  return (
    <div className="space-y-4">
      {/* Presentación Predeterminada */}
      {getDefaultPresentation() && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Star className="h-5 w-5 text-blue-600 mr-2 fill-current" />
            <span className="font-medium text-blue-900">Presentación Predeterminada</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700">{getDefaultPresentation().name || 'Sin nombre'}</p>
              <p className="text-xs text-gray-500">
                {getDefaultPresentation().units_per_package} unidad(es) por paquete
              </p>
            </div>
            <div className="text-sm text-gray-600">
              {getDefaultPresentation().package_price > 0 && (
                <div className="flex items-center">
                  <CurrencyDollar className="h-3 w-3 mr-1" />
                  Precio: {formatMoney(getDefaultPresentation().package_price, currencies.find(c => c.code === getDefaultPresentation().purchase_currency)?.symbol)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lista de Presentaciones */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">
            Presentaciones del Producto ({localPresentations.length})
          </h4>
          {!readonly && (
            <button
              type="button"
              onClick={addPresentation}
              className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar Presentación
            </button>
          )}
        </div>

        {localPresentations.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg">
            No hay presentaciones registradas. Agrega al menos una presentación.
          </div>
        ) : (
          <div className="space-y-3">
            {localPresentations.map((presentation, index) => (
              <div
                key={presentation.id || `new-${index}`}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center flex-1">
                    <Package className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-900">
                      {presentation.name || 'Sin nombre'}
                    </span>
                    {presentation.is_default && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Predeterminada
                      </span>
                    )}
                  </div>

                  {!readonly && localPresentations.length > 1 && (
                    <div className="flex items-center ml-4 space-x-1">
                      {!presentation.is_default && (
                        <button
                          type="button"
                          onClick={() => updatePresentation(index, 'is_default', true)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Marcar como predeterminada"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removePresentation(index)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Eliminar presentación"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  {/* Tipo de Empaque */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tipo de Empaque</label>
                    {readonly ? (
                      <p className="text-gray-700">{getPackagingTypeName(presentation.packaging_type_id)}</p>
                    ) : (
                      <select
                        value={presentation.packaging_type_id || ''}
                        onChange={(e) => updatePresentation(index, 'packaging_type_id', e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:border-primary-500 focus:outline-none"
                      >
                        <option value="">Sin empaque</option>
                        {packagingTypes.map((type) => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Tipo de Presentación */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tipo de Unidad</label>
                    {readonly ? (
                      <p className="text-gray-700">{getPresentationTypeName(presentation.presentation_type_id)}</p>
                    ) : (
                      <select
                        value={presentation.presentation_type_id || ''}
                        onChange={(e) => updatePresentation(index, 'presentation_type_id', e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:border-primary-500 focus:outline-none"
                      >
                        <option value="">Sin tipo</option>
                        {presentationTypes.map((type) => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Unidades por Paquete */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Unidades por Paquete *</label>
                    {readonly ? (
                      <p className="text-gray-700">{presentation.units_per_package}</p>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={presentation.units_per_package}
                        onChange={(e) => updatePresentation(index, 'units_per_package', e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:border-primary-500 focus:outline-none"
                        required
                      />
                    )}
                  </div>

                  {/* Precio por Paquete */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Precio/Paquete</label>
                    {readonly ? (
                      <p className="text-gray-700">
                        {formatMoney(presentation.package_price, currencies.find(c => c.code === presentation.purchase_currency)?.symbol)}
                      </p>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={presentation.package_price || ''}
                        onChange={(e) => updatePresentation(index, 'package_price', e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:border-primary-500 focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Costo por Paquete */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Costo/Paquete</label>
                    {readonly ? (
                      <p className="text-gray-700">
                        {formatMoney(presentation.package_cost, currencies.find(c => c.code === presentation.purchase_currency)?.symbol)}
                      </p>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={presentation.package_cost || ''}
                        onChange={(e) => updatePresentation(index, 'package_cost', e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:border-primary-500 focus:outline-none"
                      />
                    )}
                    {(parseFloat(presentation.package_cost) > 0 && parseInt(presentation.units_per_package) > 1) && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        Unitario: {formatMoney((parseFloat(presentation.package_cost) / (parseInt(presentation.units_per_package) || 1)), currencies.find(c => c.code === presentation.purchase_currency)?.symbol)}
                      </p>
                    )}
                  </div>

                  {/* Moneda */}
                  <div className="md:col-span-2 lg:col-span-1">
                    <label className="block text-xs text-gray-500 mb-1">Moneda</label>
                    {readonly ? (
                      <p className="text-gray-700">{presentation.purchase_currency}</p>
                    ) : (
                      <select
                        value={presentation.purchase_currency}
                        onChange={(e) => updatePresentation(index, 'purchase_currency', e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:border-primary-500 focus:outline-none"
                      >
                        {currencies.map((curr) => (
                          <option key={curr.code} value={curr.code}>
                            {curr.code} ({curr.symbol})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Estado Activo */}
                  {!readonly && (
                    <div className="flex items-center md:col-span-2 lg:col-span-1">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={presentation.is_active}
                          onChange={(e) => updatePresentation(index, 'is_active', e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-primary-200"
                        />
                        <span className="text-sm text-gray-700">Activa</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PresentationManager;
