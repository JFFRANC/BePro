-- 007-candidates-module — paso 1: enum de estados del candidato (FSM de 14 estados, R1 / data-model §4)

CREATE TYPE candidate_status AS ENUM (
  'registered',
  'interview_scheduled',
  'attended',
  'pending',
  'approved',
  'hired',
  'in_guarantee',
  'guarantee_met',
  'rejected',
  'declined',
  'no_show',
  'termination',
  'discarded',
  'replacement'
);
