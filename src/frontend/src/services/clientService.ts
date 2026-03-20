import api from "@/lib/axios";
import type {
  IClientDto,
  IClientAssignmentDto,
  ICreateClientRequest,
  IUpdateClientRequest,
  IAssignUserRequest,
} from "@/types/client";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const clientService = {
  async getAll(): Promise<IClientDto[]> {
    const res = await api.get<ApiResponse<IClientDto[]>>("/clients");
    return res.data.data;
  },

  async getById(id: string): Promise<IClientDto> {
    const res = await api.get<ApiResponse<IClientDto>>(`/clients/${id}`);
    return res.data.data;
  },

  async create(data: ICreateClientRequest): Promise<IClientDto> {
    const res = await api.post<ApiResponse<IClientDto>>("/clients", data);
    return res.data.data;
  },

  async update(id: string, data: IUpdateClientRequest): Promise<IClientDto> {
    const res = await api.put<ApiResponse<IClientDto>>(`/clients/${id}`, data);
    return res.data.data;
  },

  async getAssignments(clientId: string): Promise<IClientAssignmentDto[]> {
    const res = await api.get<ApiResponse<IClientAssignmentDto[]>>(
      `/clients/${clientId}/assignments`
    );
    return res.data.data;
  },

  async assignUser(
    clientId: string,
    data: IAssignUserRequest
  ): Promise<IClientAssignmentDto> {
    const res = await api.post<ApiResponse<IClientAssignmentDto>>(
      `/clients/${clientId}/assignments`,
      data
    );
    return res.data.data;
  },

  async removeAssignment(clientId: string, userId: string): Promise<void> {
    await api.delete(`/clients/${clientId}/assignments/${userId}`);
  },
};
