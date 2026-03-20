export type CandidateStatus =
  | "registered"
  | "interview_scheduled"
  | "attended"
  | "no_show"
  | "pending"
  | "approved"
  | "rejected"
  | "declined"
  | "discarded"
  | "hired"
  | "in_guarantee"
  | "guarantee_met"
  | "guarantee_failed"
  | "replacement";

export type RejectionCategory =
  | "interview"
  | "medical_exam"
  | "background_check"
  | "documentation"
  | "no_show"
  | "salary"
  | "schedule"
  | "transportation"
  | "personal_decision"
  | "other";

export interface ICandidateDto {
  id: string;
  fullName: string;
  phone: string;
  interviewDate: string;
  interviewTime?: string;
  position?: string;
  municipality?: string;
  age?: number;
  shift?: string;
  plant?: string;
  interviewPoint?: string;
  comments?: string;
  attended: boolean;
  status: CandidateStatus;
  rejectionCategory?: RejectionCategory;
  rejectionDetails?: string;
  recruiterId: string;
  recruiterFullName: string;
  leaderId: string;
  leaderFullName: string;
  clientId: string;
  clientName: string;
  createdAt: string;
}

export interface ICreateCandidateRequest {
  fullName: string;
  phone: string;
  interviewDate: string;
  clientId: string;
  interviewTime?: string;
  position?: string;
  municipality?: string;
  age?: number;
  shift?: string;
  plant?: string;
  interviewPoint?: string;
  comments?: string;
}

export interface IUpdateCandidateStatusRequest {
  status: CandidateStatus;
  rejectionCategory?: RejectionCategory;
  rejectionDetails?: string;
}
