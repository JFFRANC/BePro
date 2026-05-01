// 012-client-detail-ux / FR-009 — frozen contract for the nine candidate
// base-form fields. See contracts/shared-base-fields.md and data-model.md.
//
// These nine keys MUST be present in every newly-created candidate's
// `additional_fields` JSONB. The Formulario tab UI renders them as locked
// rows; admin custom fields are appended below. The `formConfig.fields[]`
// PUT endpoint rejects any payload that introduces a key in this set.

export type BaseFieldType = "text" | "date" | "select";

export interface BaseFieldDef {
  key: string;
  label: string;
  type: BaseFieldType;
  required: true;
}

const BASE_FIELDS_RAW: ReadonlyArray<BaseFieldDef> = [
  { key: "fullName", label: "Nombre completo", type: "text", required: true },
  {
    key: "interviewPhone",
    label: "Teléfono de entrevista",
    type: "text",
    required: true,
  },
  {
    key: "interviewDate",
    label: "Fecha de entrevista",
    type: "date",
    required: true,
  },
  {
    key: "interviewTime",
    label: "Horario de entrevista",
    type: "text",
    required: true,
  },
  { key: "positionId", label: "Puesto", type: "select", required: true },
  { key: "state", label: "Estado", type: "text", required: true },
  { key: "municipality", label: "Municipio", type: "text", required: true },
  {
    key: "recruiterName",
    label: "Nombre del reclutador",
    type: "text",
    required: true,
  },
  {
    key: "accountExecutiveName",
    label: "Líder/Ejecutivo de cuenta",
    type: "text",
    required: true,
  },
] as const;

export const BASE_CANDIDATE_FIELDS: ReadonlyArray<BaseFieldDef> = Object.freeze(
  BASE_FIELDS_RAW.map((f) => Object.freeze({ ...f })),
);

export type BaseFieldKey =
  | "fullName"
  | "interviewPhone"
  | "interviewDate"
  | "interviewTime"
  | "positionId"
  | "state"
  | "municipality"
  | "recruiterName"
  | "accountExecutiveName";

export const BASE_FIELD_KEY_SET: ReadonlySet<BaseFieldKey> = new Set(
  BASE_CANDIDATE_FIELDS.map((f) => f.key as BaseFieldKey),
);
