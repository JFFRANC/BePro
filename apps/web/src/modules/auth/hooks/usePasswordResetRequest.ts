import { useMutation } from "@tanstack/react-query";
import {
  requestPasswordReset,
  type RequestPasswordResetArgs,
  type RequestPasswordResetResponse,
} from "../services/passwordResetService";

export function usePasswordResetRequest() {
  return useMutation<
    RequestPasswordResetResponse,
    unknown,
    RequestPasswordResetArgs
  >({
    mutationFn: requestPasswordReset,
  });
}
