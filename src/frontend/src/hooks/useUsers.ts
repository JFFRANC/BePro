import { useQuery } from "@tanstack/react-query";
import { userService } from "@/services/userService";

export const USER_KEYS = {
  all: ["users"] as const,
};

export function useUsers() {
  return useQuery({
    queryKey: USER_KEYS.all,
    queryFn: userService.getAll,
  });
}
