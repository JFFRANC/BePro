import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import {
  confirmPasswordReset,
  type ConfirmPasswordResetArgs,
  type ConfirmPasswordResetResponse,
} from "../services/passwordResetService";

export function usePasswordResetConfirm() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<
    ConfirmPasswordResetResponse,
    unknown,
    ConfirmPasswordResetArgs
  >({
    mutationFn: confirmPasswordReset,
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
    },
  });
}
