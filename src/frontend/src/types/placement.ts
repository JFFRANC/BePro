export type PaymentStatus = "pending" | "paid" | "cancelled";

export interface IPlacementDto {
  id: string;
  candidateId: string;
  candidateFullName: string;
  hireDate: string;
  guaranteeEndDate?: string;
  guaranteeMet?: boolean;
  terminationDate?: string;
  freelancerPaymentStatus: PaymentStatus;
  freelancerPaymentDate?: string;
}

export interface ICreatePlacementRequest {
  candidateId: string;
  hireDate: string;
  guaranteeEndDate?: string;
}

export interface IUpdatePlacementRequest {
  guaranteeEndDate?: string;
  guaranteeMet?: boolean;
  terminationDate?: string;
  freelancerPaymentStatus?: PaymentStatus;
  freelancerPaymentDate?: string;
}
