import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { arService } from '../services/api/arService';

export const useARSummary = (params?: Record<string, unknown>) => {
  return useQuery({ queryKey: ['accounts-receivable', 'summary', params], queryFn: () => arService.getSummary(params) });
};

export const useARCustomers = (params?: Record<string, unknown>) => {
  return useQuery({ queryKey: ['accounts-receivable', 'customers', params], queryFn: () => arService.getCustomers(params) });
};

export const useCustomerStatement = (customerId: number) => {
  return useQuery({ queryKey: ['accounts-receivable', 'statement', customerId], queryFn: () => arService.getCustomerStatement(customerId), enabled: !!customerId, });
};

export const useReversePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (variables: { paymentId: number; pin: string }) => arService.reversePayment(variables.paymentId, variables.pin), onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      }, });
};

export const useAdminPinStatus = () => {
  return useQuery({ queryKey: ['accounts-receivable', 'admin-pin-status'], queryFn: arService.getAdminPinStatus });
};

export const useValidateAdminPin = () => {
  return useMutation({ mutationFn: (pin: string) => arService.validateAdminPin(pin) });
};

export const useSetAdminPin = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (pin: string) => arService.setAdminPin(pin), onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['accounts-receivable', 'admin-pin-status'] });
      }, });
};