import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Generate UUID v4 using browser crypto API
 */
const generateUUID = () => {
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

const updateTab = (state, tabId, fn) => {
  if (!tabId) return state;
  return { tabs: state.tabs.map(tab => tab.id === tabId ? fn(tab) : tab) };
};

const matchItem = (item, productId, presentationId, sellByUnit) =>
  item.product_id === productId &&
  item.presentation_id === presentationId &&
  (item.sellByUnit || false) === (sellByUnit || false);

export const usePOSStore = create(
  persist(
    (set, get) => ({
      // ============= TABS =============
      tabs: [],                    // [{ id, name, cart, customer, createdAt }]
      activeTabId: null,

      // ============= RESERVATIONS =============
      // otherReservations tracks units reserved by OTHER sessions/tabs
      // Format: { [product_id]: total_units_reserved_by_others }
      otherReservations: {},

      // ============= TAB ACTIONS =============

      /**
       * Create a new sales tab
       */
      addTab: () => {
        const newTab = {
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

      /**
       * Close and remove a tab
       */
      closeTab: (tabId) => {
        set((state) => {
          const updated = state.tabs.filter(t => t.id !== tabId);
          let activeId = state.activeTabId;

          // If closing active tab, switch to another
          if (activeId === tabId) {
            activeId = updated.length > 0 ? updated[updated.length - 1].id : null;
          }

          return {
            tabs: updated,
            activeTabId: activeId
          };
        });
      },

      /**
       * Set active tab
       */
      setActiveTab: (tabId) => {
        set({ activeTabId: tabId });
      },

      // ============= CART ACTIONS =============

      /**
       * Add item to cart (or update if already exists)
       * Items are keyed by product_id + presentation_id + sellByUnit
       */
      addToCart: (tabId, item) => {
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

      /**
       * Update item unit price in cart (in USD)
       */
      updateCartItemPrice: (tabId, productId, presentationId, sellByUnit, newPriceUSD, frozenUpdate) => {
        set((state) => updateTab(state, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.map((item) =>
            matchItem(item, productId, presentationId, sellByUnit)
              ? { ...item, unit_price: newPriceUSD, ...(frozenUpdate || { is_frozen: false }) }
              : item
          ),
        })));
      },

      /**
       * Update item quantity in cart
       */
      updateQuantity: (tabId, productId, presentationId, sellByUnit, quantity) => {
        set((state) => updateTab(state, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.map((item) =>
            matchItem(item, productId, presentationId, sellByUnit)
              ? { ...item, quantity: Math.max(0, quantity) }
              : item
          ),
        })));
      },

      /**
       * Update discount percent for a cart item
       */
      updateCartItemDiscount: (tabId, productId, presentationId, sellByUnit, discountPercent) => {
        set((state) => updateTab(state, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.map((item) =>
            matchItem(item, productId, presentationId, sellByUnit)
              ? { ...item, discount_percent: discountPercent }
              : item
          ),
        })));
      },

      /**
       * Apply discount to all items in a tab's cart
       */
      applyDiscountToAll: (tabId, discountPercent) => {
        set((state) => updateTab(state, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.map((item) => ({ ...item, discount_percent: discountPercent })),
        })));
      },

      /**
       * Toggle sell mode between package and unit for a cart item
       */
      toggleSellMode: (tabId, productId, presentationId, currentSellByUnit) => {
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
            let newCart;
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

      /**
       * Remove item from cart
       */
      removeFromCart: (tabId, productId, presentationId, sellByUnit) => {
        set((state) => updateTab(state, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.filter((item) => !matchItem(item, productId, presentationId, sellByUnit)),
        })));
      },

      setTabCustomer: (tabId, customer) => {
        set((state) => updateTab(state, tabId, (tab) => ({ ...tab, customer })));
      },

      // ============= RESERVATION ACTIONS =============

      /**
       * Set all current reservations from other sessions
       * Called on client initialization via Socket.io
       */
      setOtherReservations: (data) => {
        set({ otherReservations: data || {} });
      },

      /**
       * Update reservation count for a specific product
       * Called when Socket.io broadcasts reservation:changed event
       */
      updateReservation: (product_id, total_reserved) => {
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

      /**
       * Get available units for a product considering other reservations
       * available = total_units - reserved_by_others
       */
      getAvailableUnits: (product_id, total_units) => {
        const reserved = get().otherReservations[product_id] || 0;
        return Math.max(0, total_units - reserved);
      }
    }),

    {
      name: 'pos-store',
      version: 1,

      // Only persist tabs and activeTabId
      // Don't persist otherReservations (ephemeral, always from server)
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
export const usePOSSessionId = () => {
  let sessionId = localStorage.getItem('pos_session_id');
  if (!sessionId) {
    sessionId = generateUUID();
    localStorage.setItem('pos_session_id', sessionId);
  }
  return sessionId;
};
