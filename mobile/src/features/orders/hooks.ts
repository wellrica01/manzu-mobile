import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dashboardKeys } from '@/features/dashboard/api';
import { payoutKeys } from '@/features/payouts/api';

import { bulkUpdateOrders, fetchOrders, getOrder, orderKeys, updateOrderStatus } from './api';
import type { BulkUpdateOrdersRequest, OrderFilters, OrdersQuery, UpdatableOrderStatus } from './types';

/** Same page size as the web (pagination.limit 20). */
export const ORDERS_PAGE_SIZE = 20;

function toQuery(filters: OrderFilters): OrdersQuery {
  return {
    search: filters.search.trim() || undefined,
    status: filters.status || undefined,
    deliveryMethod: filters.deliveryMethod || undefined,
    date: filters.date || undefined,
  };
}

export function useOrders(filters: OrderFilters) {
  return useInfiniteQuery({
    queryKey: orderKeys.list(filters),
    queryFn: ({ pageParam, signal }) => fetchOrders({ ...toQuery(filters), page: pageParam, limit: ORDERS_PAGE_SIZE }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined),
  });
}

export function useOrder(orderId: number) {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: ({ signal }) => getOrder(orderId, signal),
    enabled: Number.isInteger(orderId) && orderId > 0,
  });
}

function useInvalidateOrderData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      queryClient.invalidateQueries({ queryKey: payoutKeys.all }),
    ]);
}

/**
 * Single-order status change. CANCELLED goes through PATCH /orders/bulk with one id so the
 * reason is stored and unpaid orders are restocked (PLAN D2); other statuses use PATCH /orders/:id.
 */
export function useUpdateOrderStatus() {
  const invalidate = useInvalidateOrderData();
  return useMutation({
    mutationFn: async ({ orderId, status, cancelReason }: { orderId: number; status: UpdatableOrderStatus; cancelReason?: string }) => {
      if (status === 'CANCELLED') {
        const res = await bulkUpdateOrders({ orderIds: [orderId], status, cancelReason });
        const failure = res.results.failed[0];
        if (failure) {
          // Preserve the semantic from the backend message so callers can act on the code,
          // matching the shape apiRequest already throws for single-order PATCH.
          const err = new Error(failure.reason) as Error & { code?: string };
          if (/Cannot move order from/i.test(failure.reason)) err.code = 'INVALID_STATUS_TRANSITION';
          if (/already in .* status/i.test(failure.reason)) err.code = 'STATUS_UNCHANGED';
          throw err;
        }
        return res;
      }
      return updateOrderStatus(orderId, { status });
    },
    onSettled: invalidate,
  });
}

export function useBulkUpdateOrders() {
  const invalidate = useInvalidateOrderData();
  return useMutation({
    mutationFn: (body: BulkUpdateOrdersRequest) => bulkUpdateOrders(body),
    onSettled: invalidate,
  });
}
