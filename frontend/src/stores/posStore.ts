import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, POSTab, Customer } from '../types/pos';

/**
 * Generate UUID v4 using browser crypto API
 */
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

interface POSStoreState {
  tabs: POSTab[];
  activeTabId: string | null;
  otherReservations: Record<number, number>;

  addTab: () => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  addToCart: (tabId: string, item: CartItem) => void;
  updateCartItemPrice: (tabId: string, productId: number, presentationId: number | null, sellByUnit: boolean, newPriceUSD: number, frozenUpdate?: Partial<CartItem>) => void;
  recalculateCartPrices: (tabId: string, priceMap: Record<string, Partial<CartItem>>) => void;
  updateQuantity: (tabId: string, productId: number, presentationId: number | null, sellByUnit: boolean, quantity: number) => void;
  updateCartItemDiscount: (tabId: string, productId: number, presentationId: number | null, sellByUnit: boolean, discountPercent: number) => void;
  applyDiscountToAll: (tabId: string, discountPercent: number) => void;
  toggleSellMode: (tabId: string, productId: number, presentationId: number | null, currentSellByUnit: boolean) => void;
  removeFromCart: (tabId: string, productId: number, presentationId: number | null, sellByUnit: boolean) => void;
  setTabCustomer: (tabId: string, customer: Customer | null) => void;

  setOtherReservations: (data: Record<number, number>) => void;
  updateReservation: (product_id: number, total_reserved: number) => void;
  getAvailableUnits: (product_id: number, total_units: number) => number;
}

const updateTab = (state: Pick<POSStoreState, 'tabs'>, tabId: string, fn: (tab: POSTab) => POSTab) => {
  if (!tabId) return state;
  return { tabs: state.tabs.map(tab => tab.id === tabId ? fn(tab) : tab) };
};

const matchItem = (item: CartItem, productId: number, presentationId: number | null, sellByUnit: boolean): boolean =>
  item.product_id === productId &&
  item.presentation_id === presentationId &&
  (item.sellByUnit || false) === (sellByUnit || false);

export const usePOSStore = create<POSStoreState>()(
  persist(
    (set, get) => ({
      // ============= TABS =============
      tabs: [],
      activeTabId: null,

      // ============= RESERVATIONS =============
      otherReservations: {},

      // ============= TAB ACTIONS =============

      addTab: () => {
        const newTab: POSTab = {
          id: generateUUID(),
          name: `Venta ${get().tabs.length + 1}`,
          cart: [],
          customer: null,
          createdAt: new Date().toISOString()
        };

        set((state) => {
          const updated = [...state.tabs, newTab];
          return {
            tabs: updated,
            activeTabId: newTab.id
          };
        });

        return newTab.id;
      },

      closeTab: (tabId: string) => {
        set((state) => {
          const updated = state.tabs.filter(t => t.id !== tabId);
          let activeId = state.activeTabId;

          if (activeId === tabId) {
            activeId = updated.length > 0 ? updated[updated.length - 1].id : null;
          }

          return {
            tabs: updated,
            activeTabId: activeId
          };
        });
      },

      setActiveTab: (tabId: string) => {
        set({ activeTabId: tabId });
      },

      // ============= CART ACTIONS =============

      addToCart: (tabId: string, item: CartItem) => {
        set((state) => updateTab(state, tabId, (tab) => {
          const existingIndex = tab.cart.findIndex(
            (i) => matchItem(i, item.product_id, item.presentation_id, item.sellByUnit)
          );

          if (existingIndex >= 0) {
            const updated = [...tab.cart];
            updated[existingIndex] = {
              ...updated[existingIndex],
              quantity: updated[existingIndex].quantity + (item.quantity || 1)
            };
            return { ...tab, cart: updated };
          }
          return { ...tab, cart: [...tab.cart, item] };
        }));
      },

      updateCartItemPrice: (tabId: string, productId: number, presentationId: number | null, sellByUnit: boolean, newPriceUSD: number, frozenUpdate?: Partial<CartItem>) => {
        set((state) => updateTab(state, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.map((item) =>
            matchItem(item, productId, presentationId, sellByUnit)
              ? { ...item, unit_price: newPriceUSD, ...(frozenUpdate || { is_frozen: false }) }
              : item
          ),
        })));
      },

      recalculateCartPrices: (tabId: string, priceMap: Record<string, Partial<CartItem>>) => {
        set((state) => updateTab(state, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.map((item) => {
            const key = `${item.product_id}-${item.presentation_id}-${item.sellByUnit || false}`;
            const update = priceMap[key];
            return update ? { ...item, ...update } : item;
          }),
        })));
      },

      updateQuantity: (tabId: string, productId: number, presentationId: number | null, sellByUnit: boolean, quantity: number) => {
        set((state) => updateTab(state, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.map((item) =>
            matchItem(item, productId, presentationId, sellByUnit)
              ? { ...item, quantity: Math.max(0, quantity) }
              : item
          ),
        })));
      },

      updateCartItemDiscount: (tabId: string, productId: number, presentationId: number | null, sellByUnit: boolean, discountPercent: number) => {
        set((state) => updateTab(state, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.map((item) =>
            matchItem(item, productId, presentationId, sellByUnit)
              ? { ...item, discount_percent: discountPercent }
              : item
          ),
        })));
      },

      applyDiscountToAll: (tabId: string, discountPercent: number) => {
        set((state) => updateTab(state, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.map((item) => ({ ...item, discount_percent: discountPercent })),
        })));
      },

      toggleSellMode: (tabId: string, productId: number, presentationId: number | null, currentSellByUnit: boolean) => {
        set((state) => {
          const tab = state.tabs.find(t => t.id === tabId);
          if (!tab) return state;

          const item = tab.cart.find(i => matchItem(i, productId, presentationId, currentSellByUnit));
          if (!item) return state;

          const targetByUnit = !currentSellByUnit;
          const unitsPerPkg = item.units_per_package || 1;
          const existingOther = tab.cart.find(i => matchItem(i, productId, presentationId, targetByUnit));

          let convertedQty = targetByUnit
            ? 1
            : Math.max(1, Math.floor(item.quantity / unitsPerPkg));
          if (existingOther) convertedQty += existingOther.quantity;

          const newPrice = targetByUnit
            ? (item.unit_price_each || item.unit_price / unitsPerPkg)
            : (item.package_price || item.unit_price * unitsPerPkg);

          return updateTab(state, tabId, (t) => {
            let newCart: CartItem[];
            if (existingOther) {
              newCart = t.cart
                .filter(i => !matchItem(i, productId, presentationId, currentSellByUnit))
                .map(i => matchItem(i, productId, presentationId, targetByUnit)
                  ? { ...i, quantity: convertedQty }
                  : i
                );
            } else {
              newCart = t.cart.map(i =>
                matchItem(i, productId, presentationId, currentSellByUnit)
                  ? { ...i, sellByUnit: targetByUnit, quantity: convertedQty, unit_price: newPrice }
                  : i
              );
            }
            return { ...t, cart: newCart };
          });
        });
      },

      removeFromCart: (tabId: string, productId: number, presentationId: number | null, sellByUnit: boolean) => {
        set((state) => updateTab(state, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.filter((item) => !matchItem(item, productId, presentationId, sellByUnit)),
        })));
      },

      setTabCustomer: (tabId: string, customer: Customer | null) => {
        set((state) => updateTab(state, tabId, (tab) => ({ ...tab, customer })));
      },

      // ============= RESERVATION ACTIONS =============

      setOtherReservations: (data: Record<number, number>) => {
        set({ otherReservations: data || {} });
      },

      updateReservation: (product_id: number, total_reserved: number) => {
        set((state) => {
          const updated = { ...state.otherReservations };
          if (total_reserved > 0) {
            updated[product_id] = total_reserved;
          } else {
            delete updated[product_id];
          }
          return { otherReservations: updated };
        });
      },

      getAvailableUnits: (product_id: number, total_units: number) => {
        const reserved = get().otherReservations[product_id] || 0;
        return Math.max(0, total_units - reserved);
      }
    }),

    {
      name: 'pos-store',
      version: 1,

      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId
      })
    }
  )
);

/**
 * Generate a stable session ID for the POS instance
 * Stored in localStorage, persists across page reloads
 */
export const usePOSSessionId = (): string => {
  let sessionId = localStorage.getItem('pos_session_id');
  if (!sessionId) {
    sessionId = generateUUID();
    localStorage.setItem('pos_session_id', sessionId);
  }
  return sessionId;
};
