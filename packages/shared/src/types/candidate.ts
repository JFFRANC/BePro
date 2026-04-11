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
  | "termination"
  | "replacement";

export type RejectionCategory =
  | "interview_performance"
  | "salary_expectations"
  | "schedule_incompatibility"
  | "location_distance"
  | "personal_decision"
  | "age_requirements"
  | "experience_level"
  | "documentation_issues"
  | "health_requirements"
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
  accountExecutiveId: string;
  accountExecutiveFullName: string;
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
