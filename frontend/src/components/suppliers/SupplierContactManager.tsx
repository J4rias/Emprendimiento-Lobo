import { useState, useEffect } from 'react';
import { Plus, User, Envelope, Phone, Star, Trash, PencilSimple } from '@phosphor-icons/react';

interface Contact {
  id: number | null;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  is_primary: boolean;
  notes: string | null;
  is_active: boolean;
  isNew?: boolean;
}

interface SupplierContactManagerProps {
  contacts?: Contact[];
  onChange: (contacts: Contact[]) => void;
  readonly?: boolean;
}

const SupplierContactManager: React.FC<SupplierContactManagerProps> = ({ contacts = [], onChange, readonly = false }) => {
  const [localContacts, setLocalContacts] = useState<Contact[]>([]);

  useEffect(() => {
    setLocalContacts(contacts);
  }, [contacts]);

  const addContact = (): void => {
    const newContact = {
      id: null,
      name: '',
      position: '',
      email: '',
      phone: '',
      mobile: '',
      is_primary: localContacts.length === 0, // Si es el primero, marcar como principal
      notes: '',
      is_active: true,
      isNew: true
    };
    
    const updatedContacts = [...localContacts, newContact];
    setLocalContacts(updatedContacts);
    onChange(updatedContacts);
  };

  const updateContact = (index: number, field: string, value: string | boolean): void => {
    const updatedContacts = [...localContacts];
    
    // Si se marca como principal, desmarcar los demás
    if (field === 'is_primary' && value === true) {
      updatedContacts.forEach((contact, i) => {
        if (i !== index) {
          contact.is_primary = false;
        }
      });
    }
    
    // Limpiar campos vacíos
    if (field === 'email' || field === 'phone' || field === 'mobile') {
      updatedContacts[index][field] = String(value).trim() || null;
    } else {
      (updatedContacts[index] as unknown as Record<string, unknown>)[field] = value;
    }
    
    setLocalContacts(updatedContacts);
    onChange(updatedContacts);
  };

  const removeContact = (index: number): void => {
    const updatedContacts = localContacts.filter((_, i) => i !== index);
    
    // Si eliminamos el contacto principal, marcar el primero como principal
    if (localContacts[index].is_primary && updatedContacts.length > 0) {
      updatedContacts[0].is_primary = true;
    }
    
    setLocalContacts(updatedContacts);
    onChange(updatedContacts);
  };

  const getPrimaryContact = (): Contact | undefined => {
    return localContacts.find(c => c.is_primary);
  };

  return (
    <div className="space-y-4">
      {/* Contacto Principal */}
      {(() => {
        const primary = getPrimaryContact();
        if (!primary) return null;
        return (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Star className="h-5 w-5 text-primary-600 mr-2" />
              <span className="font-medium text-primary-900">Contacto Principal</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700">{primary.name}</p>
                {primary.position && (
                  <p className="text-xs text-gray-500">{primary.position}</p>
                )}
              </div>
              <div className="text-sm text-gray-600">
                {primary.email && (
                  <div className="flex items-center">
                    <Envelope className="h-3 w-3 mr-1" />
                    {primary.email}
                  </div>
                )}
                {primary.phone && (
                  <div className="flex items-center">
                    <Phone className="h-3 w-3 mr-1" />
                    {primary.phone}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lista de Contactos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">
            Todos los Contactos ({localContacts.length})
          </h4>
          {!readonly && (
            <button
              type="button"
              onClick={addContact}
              className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar Contacto
            </button>
          )}
        </div>

        {localContacts.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            No hay contactos registrados
          </div>
        ) : (
          <div className="space-y-2">
            {localContacts.map((contact, index) => (
              <div
                key={contact.id || `new-${index}`}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      {readonly ? (
                        <span className="text-sm font-medium text-gray-900">
                          {contact.name || 'Sin nombre'}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => updateContact(index, 'name', e.target.value)}
                          placeholder="Nombre del contacto"
                          className="text-sm font-medium text-gray-900 border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none bg-transparent"
                        />
                      )}
                      {contact.is_primary && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                          Principal
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>
                        {readonly ? (
                          contact.position && <p className="text-gray-600">{contact.position}</p>
                        ) : (
                          <input
                            type="text"
                            value={contact.position || ''}
                            onChange={(e) => updateContact(index, 'position', e.target.value)}
                            placeholder="Cargo"
                            className="w-full text-sm text-gray-600 border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none bg-transparent"
                          />
                        )}
                      </div>
                      <div>
                        {readonly ? (
                          contact.email && (
                            <div className="flex items-center text-gray-600">
                              <Envelope className="h-3 w-3 mr-1" />
                              {contact.email}
                            </div>
                          )
                        ) : (
                          <input
                            type="email"
                            value={contact.email || ''}
                            onChange={(e) => updateContact(index, 'email', e.target.value)}
                            placeholder="Email"
                            className="w-full text-sm text-gray-600 border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none bg-transparent"
                          />
                        )}
                      </div>
                      <div>
                        {readonly ? (
                          contact.phone && (
                            <div className="flex items-center text-gray-600">
                              <Phone className="h-3 w-3 mr-1" />
                              {contact.phone}
                            </div>
                          )
                        ) : (
                          <input
                            type="tel"
                            value={contact.phone || ''}
                            onChange={(e) => updateContact(index, 'phone', e.target.value)}
                            placeholder="Teléfono"
                            className="w-full text-sm text-gray-600 border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none bg-transparent"
                          />
                        )}
                      </div>
                      <div>
                        {readonly ? (
                          contact.mobile && <p className="text-gray-600">Móvil: {contact.mobile}</p>
                        ) : (
                          <input
                            type="tel"
                            value={contact.mobile || ''}
                            onChange={(e) => updateContact(index, 'mobile', e.target.value)}
                            placeholder="Móvil"
                            className="w-full text-sm text-gray-600 border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none bg-transparent"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {!readonly && localContacts.length > 1 && (
                    <div className="flex items-center ml-4 space-x-1">
                      {!contact.is_primary && (
                        <button
                          type="button"
                          onClick={() => updateContact(index, 'is_primary', true)}
                          className="p-1 text-gray-400 hover:text-primary-600"
                          title="Marcar como principal"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Eliminar contacto"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
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

export default SupplierContactManager;
