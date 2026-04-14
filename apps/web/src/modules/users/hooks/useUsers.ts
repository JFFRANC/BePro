import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  importUsers,
  changePassword,
  forceChangePassword,
  resetUserPassword,
  deactivateUser,
  reactivateUser,
} from "../services/userService";
import { useAuthStore } from "@/store/auth-store";

export const USER_KEYS = {
  all: ["users"] as const,
  lists: () => [...USER_KEYS.all, "list"] as const,
  list: (params: Record<string, unknown>) =>
    [...USER_KEYS.lists(), params] as const,
  details: () => [...USER_KEYS.all, "detail"] as const,
  detail: (id: string) => [...USER_KEYS.details(), id] as const,
};

export function useUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
  isFreelancer?: boolean;
}) {
  return useQuery({
    queryKey: USER_KEYS.list(params),
    queryFn: () => listUsers(params),
    staleTime: 30_000,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: USER_KEYS.detail(id),
    queryFn: () => getUserById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string; role?: string; isFreelancer?: boolean }) =>
      updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: USER_KEYS.lists() });
    },
  });
}

export function useForceChangePassword(userId: string) {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      forceChangePassword(userId, data),
    onSuccess: (result) => {
      // API returns IUserDto (no tenantId) — merge with existing user context
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        setAuth(result.accessToken, {
          ...currentUser,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          mustChangePassword: result.user.mustChangePassword,
        });
      }
    },
  });
}

export function useChangePassword(userId: string) {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      changePassword(userId, data),
  });
}

export function useResetPassword(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { newPassword: string }) => resetUserPassword(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.detail(userId) });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.all });
    },
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.all });
    },
  });
}

export function useImportUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importUsers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.lists() });
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.lists() });
    },
  });
}
