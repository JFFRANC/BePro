import api from "@/lib/axios";
import type {
  ICandidateDto,
  ICreateCandidateRequest,
  IUpdateCandidateStatusRequest,
} from "@/types/candidate";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const candidateService = {
  async getByClient(clientId: string): Promise<ICandidateDto[]> {
    const res = await api.get<ApiResponse<ICandidateDto[]>>(
      `/candidates/client/${clientId}`
    );
    return res.data.data;
  },

  async getMy(): Promise<ICandidateDto[]> {
    const res = await api.get<ApiResponse<ICandidateDto[]>>("/candidates/my");
    return res.data.data;
  },

  async getById(id: string): Promise<ICandidateDto> {
    const res = await api.get<ApiResponse<ICandidateDto>>(`/candidates/${id}`);
    return res.data.data;
  },

  async create(data: ICreateCandidateRequest): Promise<ICandidateDto> {
    const res = await api.post<ApiResponse<ICandidateDto>>("/candidates", data);
    return res.data.data;
  },

  async updateStatus(
    id: string,
    data: IUpdateCandidateStatusRequest
  ): Promise<ICandidateDto> {
    const res = await api.patch<ApiResponse<ICandidateDto>>(
      `/candidates/${id}/status`,
      data
    );
    return res.data.data;
  },
};
