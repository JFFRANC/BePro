import api from "@/lib/axios";
import type {
  IPlacementDto,
  ICreatePlacementRequest,
  IUpdatePlacementRequest,
} from "@/types/placement";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const placementService = {
  async getById(id: string): Promise<IPlacementDto> {
    const res = await api.get<ApiResponse<IPlacementDto>>(`/placements/${id}`);
    return res.data.data;
  },

  async getByClient(clientId: string): Promise<IPlacementDto[]> {
    const res = await api.get<ApiResponse<IPlacementDto[]>>(
      `/placements/client/${clientId}`
    );
    return res.data.data;
  },

  async create(data: ICreatePlacementRequest): Promise<IPlacementDto> {
    const res = await api.post<ApiResponse<IPlacementDto>>("/placements", data);
    return res.data.data;
  },

  async update(id: string, data: IUpdatePlacementRequest): Promise<IPlacementDto> {
    const res = await api.put<ApiResponse<IPlacementDto>>(
      `/placements/${id}`,
      data
    );
    return res.data.data;
  },
};
