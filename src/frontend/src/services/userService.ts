import api from "@/lib/axios";
import type { IUserDto, ICreateUserRequest, IUpdateUserRequest } from "@/types/user";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const userService = {
  async getAll(): Promise<IUserDto[]> {
    const res = await api.get<ApiResponse<IUserDto[]>>("/users");
    return res.data.data;
  },

  async getById(id: string): Promise<IUserDto> {
    const res = await api.get<ApiResponse<IUserDto>>(`/users/${id}`);
    return res.data.data;
  },

  async create(data: ICreateUserRequest): Promise<IUserDto> {
    const res = await api.post<ApiResponse<IUserDto>>("/users", data);
    return res.data.data;
  },

  async update(id: string, data: IUpdateUserRequest): Promise<IUserDto> {
    const res = await api.put<ApiResponse<IUserDto>>(`/users/${id}`, data);
    return res.data.data;
  },

  async deactivate(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};
