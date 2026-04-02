# Módulo: Operaciones

## Estado: Análisis completado
## Prioridad: Alta (Módulo 1 después de Auth)

## Descripción
Módulo principal que reemplaza la operación actual soportada en Google Drive.
Gestiona el ciclo completo de reclutamiento y selección de personal.

## Fuentes analizadas
- `CARTA MUNDI (Respuestas).xlsx` → Hoja "Respuestas de formulario 1" (762 registros)
- `CARTA MUNDI (Respuestas).xlsx` → Hoja "ASISTENCIA A ENTREVISTA INGRESO" (262 registros)
- `CONCENTRADO DE CITAS CARTA MUNDI.xlsx` → Hoja "CONCENTRADO DE CITAS" (86 registros)

## Flujo del proceso actual

```
1. REGISTRO (Formulario Google)
   Reclutador registra candidato con datos básicos + fecha/hora entrevista
   ↓
2. ASISTENCIA A ENTREVISTA (Hoja Excel - Líder)
   Líder marca si el candidato acudió (SI/NO)
   ↓
3. SEGUIMIENTO DE ESTATUS (Hoja Excel - Líder)
   Líder actualiza estatus: PENDIENTE → APTO/NO APTO/DECLINÓ OFERTA/DESCARTADA
   ↓
4. INGRESO (Hoja Excel - Líder)
   Si APTO → Se registra fecha de ingreso
   ↓
5. GARANTÍA (Concentrado - Admin/Líder de líderes)
   Se monitorea si el candidato cumple la garantía (periodo de prueba)
   ↓
6. FACTURACIÓN (Concentrado - Admin)
   Se registra factura, monto, estatus de pago
```

## Datos del formulario de registro (Reclutador/Freelancer)

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| Marca temporal | DateTime | 07/12/2025 11:16:36 p.m. |
| Nombre completo | String | Marlene Abigail Sanchez García |
| Teléfono | String | 81 2311 3267 |
| Fecha de entrevista | Date | 08/12/2025 |
| Hora de entrevista | Time | 11:00:00 |
| Puesto | String | AYUDANTE GENERAL |
| Municipio | String | Apodaca |
| Edad | String | 20 años |
| Nombre del reclutador | String | Mireya Alejo |
| Líder | String | Karina Olivares |
| Turno | String | (opcional) |
| Acuden | String | SI / NO |

## Datos de seguimiento de entrevista (Líder)

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| Fecha entrevista | Date | 09/12/2025 |
| Puesto | String | AYUDANTE GENERAL |
| Planta | String | APODACA |
| Nombre completo | String | Omar Isaac flores Hernández |
| Reclutador | String | Nallely Rodriguez |
| Líder | String | Daniela mendiola |
| Estatus | Enum | INGRESO, APTO, NO APTO, PENDIENTE, etc. |
| Motivo rechazo/pendiente | String | POR EXAMEN MEDICO |
| Ingreso | Date/String | 10/12/2025 o PENDIENTE |
| Fecha garantía | Date/String | 16/12/2025 o PENDIENTE |
| Pago freelance | Enum | PAGADO / PENDIENTE |

## Datos del concentrado (Admin/Líder de líderes)

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| Nombre completo | String | OMAR ISAAC FLORES HERNANDEZ |
| Fecha ingreso | Date | 10/12/2025 |
| Fecha garantía | Date | 16/12/2025 |
| Planta | String | APODACA |
| Estatus | Enum | ACTIVO, BAJA, REPOSICION |
| Fecha de baja | Date | (si aplica) |
| Cumple garantía | Enum | SI, NO, PENDIENTE |
| Facturado | Enum | SI, NO |
| Num factura | String | 9891 |
| Monto | Decimal | 2244.83 |
| IVA 16% | Decimal | 2603.83 |
| Total | Decimal | (calculado) |
| Fecha emisión | Date | (factura) |
| Fecha PP | Date | (programación de pago) |
| Estatus pago | String | |
| Cuenta BePro | String | |
| Comentarios | String | |

## Pipeline de estatus del candidato

### Estatus principales (normalizados)
1. `registered` - Registrado por reclutador (formulario)
2. `interview_scheduled` - Entrevista programada
3. `attended` - Acudió a entrevista
4. `no_show` - No se presentó
5. `pending` - Pendiente de resultado
6. `approved` - Apto
7. `rejected` - No apto (con motivo)
8. `declined` - Declinó oferta (con motivo)
9. `discarded` - Descartado
10. `hired` - Ingresó a la empresa
11. `in_guarantee` - En periodo de garantía
12. `guarantee_met` - Cumplió garantía
13. `guarantee_failed` - No cumplió garantía (baja)
14. `replacement` - En reposición

### Motivos de rechazo/declinación (catálogo)
- Por entrevista (falta de experiencia, mala actitud)
- Por examen médico
- Por investigación laboral
- Por documentación (escolaridad, comprobantes, RFC)
- No se presentó a inducción
- Por salario
- Por horarios/turnos
- Por transporte
- Decisión personal (doping, pareja, etc.)

## Permisos por rol

| Funcionalidad | Admin | Líder de líderes | Líder | Reclutador | Freelancer |
|---------------|-------|-------------------|-------|------------|------------|
| Ver todos los clientes | ✓ | ✓ | ✗ | ✗ | ✗ |
| Ver clientes asignados | ✓ | ✓ | ✓ | ✓ | ✓ |
| Registrar candidatos | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ver candidatos de su equipo | ✓ | ✓ | ✓ | ✗ | ✗ |
| Ver solo sus candidatos | - | - | - | ✓ | ✓ |
| Cambiar estatus | ✓ | ✓ | ✓ | ✗ | ✗ |
| Ver concentrado/facturación | ✓ | ✓ | ✗ | ✗ | ✗ |
| Gestionar facturación | ✓ | ✗ | ✗ | ✗ | ✗ |

## Problemas detectados en los datos actuales
1. **Inconsistencia en nombres**: El mismo líder aparece como "Karina Olivares", "karina Olivares", "KARINA OLIVARES", "Karina Olivarez" → Se resuelve con catálogo de usuarios
2. **Inconsistencia en reclutadores**: Mismo problema de mayúsculas/minúsculas y abreviaciones
3. **Estatus no normalizados**: "DECLINO OFERTA" vs "DECLINÓ OFERTA" → Se resuelve con enum
4. **Motivos de rechazo sin catálogo**: Texto libre causa duplicados → Se resuelve con catálogo + campo libre
5. **Datos de edad como texto**: "20 años" en vez de número → Se almacenará como int

## Estructura de relaciones propuesta

```
Client (empresa cliente)
  ├── tiene muchos → ClientAssignment (asignación líder-reclutadores)
  ├── tiene muchas → JobPosition (vacantes/puestos)
  │     └── tiene muchos → Candidate (candidatos)
  │           ├── registrado por → User (reclutador)
  │           ├── tiene un → InterviewStatus (pipeline)
  │           └── tiene un → Placement (colocación/ingreso)
  │                 └── tiene un → Guarantee (garantía)
  └── tiene muchas → Invoice (facturas)
```
