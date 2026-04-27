/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cuando se define, oculta el campo "Organización" en el login y envía este valor como tenantSlug. */
  readonly VITE_LOGIN_TENANT_FIXED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
