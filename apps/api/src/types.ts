import type { ICurrentUser } from "@bepro/shared";
import type { Database } from "@bepro/db";

export interface Bindings {
  ENVIRONMENT: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  FILES: R2Bucket;
  PASSWORD_RESET_RATE: KVNamespace;
  RESEND_API_KEY?: string;
  RESEND_FROM_DOMAIN?: string;
  APP_URL: string;
}

export interface Variables {
  user: ICurrentUser;
  tenantId: string;
  db: Database;
}

export type HonoEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
