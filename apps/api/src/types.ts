export interface Bindings {
  ENVIRONMENT: string;
  DATABASE_URL: string;
}

export type HonoEnv = {
  Bindings: Bindings;
};
