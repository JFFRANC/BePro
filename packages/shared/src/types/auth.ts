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
  isFreelancer: boolean;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}
