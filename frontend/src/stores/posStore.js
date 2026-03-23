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

/**
 * POS Store - Zustand
 * Manages:
 * - Multiple sales tabs
 * - Cart items within each tab
 * - Real-time reservations from other sessions (updated via WebSocket)
 */
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

      /**
       * Get active tab
       */
      getActiveTab: () => {
        const state = get();
        return state.tabs.find(t => t.id === state.activeTabId);
      },

      // ============= CART ACTIONS =============

      /**
       * Add item to cart (or update if already exists)
       */
      addToCart: (tabId, item) => {
        set((state) => {
          const tabs = state.tabs.map((tab) => {
            if (tab.id === tabId) {
              // Check if item already exists (same product and presentation)
              const existingIndex = tab.cart.findIndex(
                (i) => i.product_id === item.product_id && i.presentation_id === item.presentation_id
              );

              if (existingIndex >= 0) {
                // Update quantity
                const updated = [...tab.cart];
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  quantity: updated[existingIndex].quantity + (item.quantity || 1)
                };
                return { ...tab, cart: updated };
              } else {
                // Add new item
                return { ...tab, cart: [...tab.cart, item] };
              }
            }
            return tab;
          });

          return { tabs };
        });
      },

      /**
       * Update item unit price in cart (in USD)
       */
      updateCartItemPrice: (tabId, presentationId, newPriceUSD) => {
        set((state) => {
          const tabs = state.tabs.map((tab) => {
            if (tab.id === tabId) {
              const cart = tab.cart.map((item) => {
                if (item.presentation_id === presentationId) {
                  return { ...item, unit_price: newPriceUSD, is_frozen: false };
                }
                return item;
              });
              return { ...tab, cart };
            }
            return tab;
          });
          return { tabs };
        });
      },

      /**
       * Update item quantity in cart
       */
      updateQuantity: (tabId, presentationId, quantity) => {
        set((state) => {
          const tabs = state.tabs.map((tab) => {
            if (tab.id === tabId) {
              const cart = tab.cart.map((item) => {
                if (item.presentation_id === presentationId) {
                  return { ...item, quantity: Math.max(0, quantity) };
                }
                return item;
              });
              return { ...tab, cart };
            }
            return tab;
          });

          return { tabs };
        });
      },

      /**
       * Remove item from cart
       */
      removeFromCart: (tabId, presentationId) => {
        set((state) => {
          const tabs = state.tabs.map((tab) => {
            if (tab.id === tabId) {
              return {
                ...tab,
                cart: tab.cart.filter((item) => item.presentation_id !== presentationId)
              };
            }
            return tab;
          });

          return { tabs };
        });
      },

      /**
       * Clear entire cart for a tab
       */
      clearCart: (tabId) => {
        set((state) => {
          const tabs = state.tabs.map((tab) => {
            if (tab.id === tabId) {
              return { ...tab, cart: [] };
            }
            return tab;
          });

          return { tabs };
        });
      },

      /**
       * Update customer for a tab
       */
      setTabCustomer: (tabId, customer) => {
        set((state) => {
          const tabs = state.tabs.map((tab) => {
            if (tab.id === tabId) {
              return { ...tab, customer };
            }
            return tab;
          });

          return { tabs };
        });
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
