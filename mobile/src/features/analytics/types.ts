export type AnalyticsRange = '7d' | '30d' | '90d' | 'all' | 'custom';

export interface TopMedication {
  name: string;
  count: number;
  revenue: number;
}

export interface DailyRevenue {
  /** Local YYYY-MM-DD, used for sorting. */
  day: string;
  label: string;
  revenue: number;
}

export interface OrderAnalytics {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  uniqueCustomers: number;
  returningCustomers: number;
  retentionRate: number;
  statusCounts: { status: string; count: number }[];
  topMedications: TopMedication[];
  revenueByDay: DailyRevenue[];
}

export interface InventoryHealth {
  totalItems: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
}

/** GET /api/pharmacy/analytics response (backend Task 6 / G8). */
export interface AnalyticsResponse {
  period: { from: string; to: string };
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  uniqueCustomers: number;
  returningCustomers: number;
  retentionRate: number;
  statusCounts: { status: string; count: number }[];
  topMedications: TopMedication[];
  revenueByDay: DailyRevenue[];
  inventoryHealth: InventoryHealth;
}