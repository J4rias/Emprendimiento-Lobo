import { useQuery, useMutation, useQueryClient } from 'react-query';
import { arService } from '../services/api/arService';

export const useARSummary = (params?: Record<string, unknown>) => {
  return useQuery(['accounts-receivable', 'summary', params], () => arService.getSummary(params));
};

export const useARCustomers = (params?: Record<string, unknown>) => {
  return useQuery(['accounts-receivable', 'customers', params], () => arService.getCustomers(params));
};

export const useCustomerStatement = (customerId: number) => {
  return useQuery(['accounts-receivable', 'statement', customerId], () => arService.getCustomerStatement(customerId), {
    enabled: !!customerId,
  });
};

export const useReversePayment = () => {
  const queryClient = useQueryClient();
  return useMutation(
    (variables: { paymentId: number; pin: string }) => arService.reversePayment(variables.paymentId, variables.pin),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('accounts-receivable');
      },
    }
  );
};

export const useAdminPinStatus = () => {
  return useQuery(['accounts-receivable', 'admin-pin-status'], arService.getAdminPinStatus);
};

export const useValidateAdminPin = () => {
  return useMutation((pin: string) => arService.validateAdminPin(pin));
};

export const useSetAdminPin = () => {
  const queryClient = useQueryClient();
  return useMutation(
    (pin: string) => arService.setAdminPin(pin),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['accounts-receivable', 'admin-pin-status']);
      },
    }
  );
};