import type { CandidateStatus } from "@bepro/shared";

export function statusToBadgeVariant(status: CandidateStatus): string {
  return `status-${status.replace(/_/g, "-")}`;
}

export function badgeVariantToStatus(variant: string): CandidateStatus {
  return variant.replace("status-", "").replace(/-/g, "_") as CandidateStatus;
}
