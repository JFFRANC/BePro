import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";
import type { UserRole } from "@bepro/shared";

export type Actions = "manage" | "create" | "read" | "update" | "delete";
// 011-puestos-profile-docs — `Position`, `PositionDocument`, y `Position.history`
// (admin-only Versiones panel).
export type Subjects =
  | "Dashboard"
  | "Candidate"
  | "Client"
  | "Placement"
  | "User"
  | "Audit"
  | "Position"
  | "PositionDocument"
  | "Position.history"
  | "all";
export type AppAbility = MongoAbility<[Actions, Subjects]>;

interface AbilityUser {
  role: UserRole;
  id: string;
}

export function defineAbilityFor(user: AbilityUser): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(
    createMongoAbility,
  );

  switch (user.role) {
    case "admin":
      can("manage", "all");
      // 008-ux-roles-refinements / US2 (FR-CG-001 / FR-CG-002) — only recruiters
      // may create candidates. Admins retain read/update (and reactivate), but
      // the "Nuevo candidato" entry point is hidden via this cannot() rule.
      cannot("create", "Candidate");
      // 011 — admin ve "Versiones" (FR-018)
      can("read", "Position.history");
      break;
    case "manager":
      can("read", "all");
      can("update", ["Candidate", "Placement", "Position", "PositionDocument"]);
      can("create", ["Placement", "Position", "PositionDocument"]);
      // FR-CG-002 — managers cannot create candidates either.
      break;
    case "account_executive":
      can("read", [
        "Dashboard",
        "Candidate",
        "Client",
        "Placement",
        "Position",
        "PositionDocument",
      ]);
      can("update", ["Candidate", "Placement", "Position", "PositionDocument"]);
      can("create", ["Placement", "Position", "PositionDocument"]);
      // FR-CG-002 — AEs cannot create candidates.
      break;
    case "recruiter":
      can("read", ["Dashboard", "Candidate", "Position", "PositionDocument"]);
      can("create", "Candidate");
      break;
  }

  return build();
}
