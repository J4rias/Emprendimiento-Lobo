import { useShallow } from 'zustand/react/shallow';
import { usePOSStore } from '../../stores/posStore';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * POS Tabs - Tablet version
 * Bigger touch targets (min 48px), clearer active state
 */
export default function POSTabsTablet({ onTabClose = null }) {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } = usePOSStore(
    useShallow(s => ({
      tabs: s.tabs, activeTabId: s.activeTabId,
      addTab: s.addTab, closeTab: s.closeTab, setActiveTab: s.setActiveTab,
    }))
  );

  const MAX_TABS = 5;

  const handleAddTab = () => {
    if (tabs.length >= MAX_TABS) {
      toast.dismiss();
      toast.error(`Máximo ${MAX_TABS} pestañas`);
      return;
    }
    addTab();
    toast.dismiss();
    toast.success('Nueva venta abierta');
  };

  const handleCloseTab = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);

    if (tab && tab.cart && tab.cart.length > 0) {
      const confirmed = window.confirm(
        `¿Descartar la venta "${tab.name}"? Tiene ${tab.cart.length} producto(s).`
      );
      if (!confirmed) return;
    }

    if (onTabClose) onTabClose(tabId);
    closeTab(tabId);
    toast.dismiss();
    toast.success('Venta cerrada');
  };

  return (
    <div className="flex items-center gap-2 bg-white border-b border-gray-200 px-3 py-2 overflow-x-auto shrink-0">
      <div className="flex gap-2 flex-1 min-w-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 min-h-[44px] rounded-lg text-sm font-semibold
              whitespace-nowrap transition-all
              ${activeTabId === tab.id
                ? 'bg-blue-500 text-white shadow'
                : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }
            `}
          >
            <span>{tab.name}</span>

            {tab.cart?.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {tab.cart.length}
              </span>
            )}

            <div
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleCloseTab(tab.id); } }}
              className="p-1.5 rounded-lg hover:bg-red-500 hover:text-white active:bg-red-600 transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handleAddTab}
        disabled={tabs.length >= MAX_TABS}
        className={`
          flex items-center gap-1 px-4 min-h-[44px] rounded-lg text-sm font-semibold
          ${tabs.length >= MAX_TABS
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-green-100 text-green-700 active:bg-green-200'
          }
        `}
        title={tabs.length >= MAX_TABS ? `Máximo ${MAX_TABS}` : 'Nueva venta'}
      >
        <Plus className="w-5 h-5" />
        <span>Nuevo</span>
      </button>

      <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
        {tabs.length}/{MAX_TABS}
      </div>
    </div>
  );
}
