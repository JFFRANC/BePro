import type { UserRole } from "./auth";

export interface IUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isFreelancer: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface ICreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isFreelancer: boolean;
}

export interface IUpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
}
