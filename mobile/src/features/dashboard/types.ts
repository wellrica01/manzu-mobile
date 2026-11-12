// GET /api/pharmacy/dashboard — routes/pharmacy.js spreads getDashboardData() (pharmacy-dashboard.service.js).
// Order.pharmacyAmount / Sale.total / MedicationAvailability.price are Prisma Float(?) → JSON numbers.

export type RecentActivityType = 'ORDER' | 'SALE';

export interface RecentActivity {
  id: number;
  type: RecentActivityType;
  /** Order.name (nullable) for orders; 'POS Sale' for sales. */
  name: string | null;
  /** OrderStatus for orders; uppercased Sale.paymentMethod (CASH/CARD) or 'PAID' for sales. */
  status: string;
  amount?: number | null;
  /** ISO DateTime. */
  time: string;
}

export interface TopSellingMed {
  name: string;
  quantity: number;
  revenue?: number;
  orders: number;
}

export interface LowStockMed {
  name: string;
  form: string | null;
  stock: number | null;
  price: number | null;
}

export interface DashboardResponse {
  message: string;
  ordersToday: number;
  ordersTrend: number;
  posSalesToday: number;
  posSalesTrend: number;
  revenueToday?: number;
  revenueTrend?: number;
  posRevenueToday?: number;
  posRevenueTrend?: number;
  /** Count of CONFIRMED orders (shown as "Pending" on the web). */
  pendingOrders: number;
  processingOrders: number;
  readyOrders: number;
  completedOrders: number;
  /** MedicationAvailability with stock < 10 (includes out of stock). */
  inventoryAlerts: number;
  /** Expiry within the next 30 days. */
  expiringMeds: number;
  /** Last 7 days, top 5 by quantity. */
  topSellingMeds: TopSellingMed[];
  /** Latest 10 orders + sales merged, newest first. */
  recentActivity: RecentActivity[];
  /** 0 < stock < 10, lowest 5. */
  lowStockMeds: LowStockMed[];
}
