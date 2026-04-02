import type { UserRole } from "@bepro/shared";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
  isFreelancer: boolean;
  iat: number;
  exp: number;
}

export interface AuthResult {
  accessToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: string;
    isFreelancer: boolean;
  };
  refreshToken: string;
}

export interface LoginParams {
  email: string;
  password: string;
  tenantSlug: string;
}
