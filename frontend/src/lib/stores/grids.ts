import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api';

export interface GridOrder {
  id: string;
  pair: string;
  status: 'active' | 'paused' | 'stopped' | 'completed';
  lowerPrice: number;
  upperPrice: number;
  currentPrice: number;
  gridCount: number;
  totalInvestment: number;
  filledOrders: number;
  unrealizedPnL: number;
  realizedPnL: number;
  createdAt: Date;
  lastActivity: Date;
  strategy: 'arithmetic' | 'geometric' | 'adaptive';
  orders: GridOrderLevel[];
}

export interface GridOrderLevel {
  id: string;
  price: number;
  type: 'buy' | 'sell';
  amount: number;
  filled: boolean;
  filledAt?: Date;
  txHash?: string;
}

export interface GridConfig {
  pair: string;
  lowerPrice: number;
  upperPrice: number;
  gridCount: number;
  investment: number;
  strategy: 'arithmetic' | 'geometric' | 'adaptive';
}

interface GridsState {
  // State
  grids: GridOrder[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  
  // Actions
  fetchGrids: () => Promise<void>;
  createGrid: (config: GridConfig) => Promise<string | null>;
  stopGrid: (gridId: string) => Promise<boolean>;
  pauseGrid: (gridId: string) => Promise<boolean>;
  resumeGrid: (gridId: string) => Promise<boolean>;
  updateGridPrice: (gridId: string, newPrice: number) => void;
  refreshGrid: (gridId: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useGridsStore = create<GridsState>()(
  persist(
    (set, get) => ({
      // Initial state
      grids: [],
      loading: false,
      error: null,
      lastUpdate: null,

      // Actions
      fetchGrids: async () => {
        const state = get();
        if (state.loading) return;

        set({ loading: true, error: null });

        try {
          const gridSummaries = await apiClient.getGrids();
          // Transform GridSummary to GridOrder format
          const grids: GridOrder[] = gridSummaries.map(summary => ({
            id: summary.grid_identity,
            pair: `${summary.token_id}/ERG`, // Approximate pair format
            status: 'active' as const,
            lowerPrice: parseFloat(summary.bid_price),
            upperPrice: parseFloat(summary.ask_price),
            currentPrice: (parseFloat(summary.bid_price) + parseFloat(summary.ask_price)) / 2,
            gridCount: summary.buy_orders + summary.sell_orders,
            totalInvestment: summary.total_erg,
            filledOrders: 0, // Would need additional API call to determine
            unrealizedPnL: summary.profit_erg,
            realizedPnL: 0,
            createdAt: new Date(), // Would need from API
            lastActivity: new Date(),
            strategy: 'arithmetic' as const,
            orders: [], // Would need from grid details API
          }));
          
          set({ 
            grids,
            loading: false,
            lastUpdate: new Date(),
            error: null
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch grids';
          set({ 
            loading: false,
            error: errorMessage 
          });
        }
      },

      createGrid: async (config: GridConfig) => {
        set({ loading: true, error: null });

        try {
          const gridId = await apiClient.createGrid(config);
          
          // Refresh grids to get the new one
          await get().fetchGrids();
          
          set({ loading: false });
          return gridId;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create grid';
          set({ 
            loading: false,
            error: errorMessage 
          });
          return null;
        }
      },

      stopGrid: async (gridId: string) => {
        set({ loading: true, error: null });

        try {
          const success = await apiClient.stopGrid(gridId);
          
          if (success) {
            set((state) => ({
              grids: state.grids.map(grid => 
                grid.id === gridId 
                  ? { ...grid, status: 'stopped' as const }
                  : grid
              ),
              loading: false
            }));
          } else {
            set({ 
              loading: false,
              error: 'Failed to stop grid' 
            });
          }
          
          return success;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to stop grid';
          set({ 
            loading: false,
            error: errorMessage 
          });
          return false;
        }
      },

      pauseGrid: async (gridId: string) => {
        set({ loading: true, error: null });

        try {
          const success = await apiClient.pauseGrid(gridId);
          
          if (success) {
            set((state) => ({
              grids: state.grids.map(grid => 
                grid.id === gridId 
                  ? { ...grid, status: 'paused' as const }
                  : grid
              ),
              loading: false
            }));
          } else {
            set({ 
              loading: false,
              error: 'Failed to pause grid' 
            });
          }
          
          return success;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to pause grid';
          set({ 
            loading: false,
            error: errorMessage 
          });
          return false;
        }
      },

      resumeGrid: async (gridId: string) => {
        set({ loading: true, error: null });

        try {
          const success = await apiClient.resumeGrid(gridId);
          
          if (success) {
            set((state) => ({
              grids: state.grids.map(grid => 
                grid.id === gridId 
                  ? { ...grid, status: 'active' as const }
                  : grid
              ),
              loading: false
            }));
          } else {
            set({ 
              loading: false,
              error: 'Failed to resume grid' 
            });
          }
          
          return success;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to resume grid';
          set({ 
            loading: false,
            error: errorMessage 
          });
          return false;
        }
      },

      updateGridPrice: (gridId: string, newPrice: number) => {
        set((state) => ({
          grids: state.grids.map(grid => 
            grid.id === gridId 
              ? { ...grid, currentPrice: newPrice, lastActivity: new Date() }
              : grid
          )
        }));
      },

      refreshGrid: async (gridId: string) => {
        try {
          const gridDetails = await apiClient.getGridDetails(gridId);
          
          set((state) => ({
            grids: state.grids.map(grid => 
              grid.id === gridId 
                ? { ...grid, ...gridDetails, lastActivity: new Date() }
                : grid
            ),
            error: null
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to refresh grid';
          set({ error: errorMessage });
        }
      },

      setLoading: (loading: boolean) => set({ loading }),

      setError: (error: string | null) => set({ error }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'grids-storage',
      // Only persist non-sensitive grid data
      partialize: (state) => ({
        lastUpdate: state.lastUpdate,
        // Don't persist actual grid data - fetch fresh on load
      }),
      version: 1,
    }
  )
);