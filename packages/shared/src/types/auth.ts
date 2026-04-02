export type UserRole =
  | "admin"
  | "manager"
  | "account_executive"
  | "recruiter";

export interface ICurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  isFreelancer: boolean;
}

export interface ILoginRequest {
  email: string;
  password: string;
  tenantSlug: string;
}

export interface IAuthResponse {
  accessToken: string;
  expiresAt: string;
  user: ICurrentUser;
}

export interface IAuthMeResponse {
  user: ICurrentUser & {
    tenantName: string;
    tenantSlug: string;
  };
}
