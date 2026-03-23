import React from 'react';
import { usePOSStore } from '../../stores/posStore';
import { Plus, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

/**
 * POS Tabs Component
 * Allows multiple concurrent sales with tab interface
 * - Max 5 tabs per session
 * - Each tab has its own cart
 * - Confirmation when closing tab with items
 */
export default function POSTabs({ onTabClose = null }) {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } = usePOSStore();

  const MAX_TABS = 5;

  const handleAddTab = () => {
    if (tabs.length >= MAX_TABS) {
      toast.remove();
      toast.error(`Máximo ${MAX_TABS} pestañas abiertas simultáneamente`);
      return;
    }
    addTab();
    toast.remove();
    toast.success('Nueva venta abierta');
  };

  const handleCloseTab = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);

    // If tab has items, ask for confirmation
    if (tab && tab.cart && tab.cart.length > 0) {
      const confirmed = window.confirm(
        `¿Descartar la venta "${tab.name}"? Tiene ${tab.cart.length} producto(s).`
      );
      if (!confirmed) return;
    }

    // Call cleanup callback if provided (to release reservations)
    if (onTabClose) {
      onTabClose(tabId);
    }

    closeTab(tabId);
    toast.remove();
    toast.success('Venta cerrada');
  };

  return (
    <div className="flex items-center gap-2 bg-white border-b border-gray-200 px-4 py-3 overflow-x-auto">
      {/* Tab buttons */}
      <div className="flex gap-1 flex-1 min-w-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded text-sm font-medium
              whitespace-nowrap transition-all
              ${
                activeTabId === tab.id
                  ? 'bg-blue-500 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            <span>{tab.name}</span>

            {/* Badge: number of items in cart */}
            {tab.cart?.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {tab.cart.length}
              </span>
            )}

            {/* Close button */}
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTab(tab.id);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleCloseTab(tab.id); } }}
              className="ml-1 p-0.5 rounded hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
              title="Cerrar pestaña"
            >
              <X className="w-4 h-4" />
            </div>
          </button>
        ))}
      </div>

      {/* Add new tab button */}
      <button
        onClick={handleAddTab}
        disabled={tabs.length >= MAX_TABS}
        className={`
          flex items-center gap-1 px-3 py-2 rounded text-sm font-medium
          transition-all
          ${
            tabs.length >= MAX_TABS
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }
        `}
        title={tabs.length >= MAX_TABS ? `Máximo ${MAX_TABS} pestañas` : 'Nueva venta'}
      >
        <Plus className="w-4 h-4" />
        <span>Nuevo</span>
      </button>

      {/* Info: number of active tabs */}
      <div className="text-xs text-gray-500 font-medium whitespace-nowrap">
        {tabs.length}/{MAX_TABS}
      </div>
    </div>
  );
}
