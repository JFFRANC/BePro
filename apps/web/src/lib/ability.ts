import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";
import type { UserRole } from "@bepro/shared";

export type Actions = "manage" | "create" | "read" | "update" | "delete";
export type Subjects = "Dashboard" | "Candidate" | "Client" | "Placement" | "User" | "Audit" | "all";
export type AppAbility = MongoAbility<[Actions, Subjects]>;

interface AbilityUser {
  role: UserRole;
  id: string;
}

export function defineAbilityFor(user: AbilityUser): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  switch (user.role) {
    case "admin":
      can("manage", "all");
      break;
    case "manager":
      can("read", "all");
      can(["create", "update"], ["Candidate", "Placement"]);
      break;
    case "account_executive":
      can("read", ["Dashboard", "Candidate", "Client", "Placement"]);
      can(["create", "update"], ["Candidate", "Placement"]);
      break;
    case "recruiter":
      can("read", ["Dashboard", "Candidate"]);
      can("create", "Candidate");
      break;
  }

  return build();
}
