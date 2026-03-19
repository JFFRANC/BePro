# Módulo: Operaciones

## Estado: En análisis
## Prioridad: Alta (Módulo 1 después de Auth)

## Descripción
Módulo principal que reemplaza la operación actual soportada en Google Drive.
Gestiona el ciclo completo de reclutamiento y selección de personal.

## Procesos principales
1. **Gestión de Candidatos** - Registro, búsqueda y seguimiento de candidatos
2. **Gestión de Vacantes** - Vacantes publicadas por empresas cliente
3. **Control de Entrevistas** - Programación, seguimiento y resultado de entrevistas
4. **Colocaciones** - Seguimiento de candidatos colocados en empresas

## Datos identificados (pendiente análisis de archivos Excel)
- Datos del candidato (personales, experiencia, disponibilidad)
- Datos del reclutador asignado
- Fechas y horas de entrevistas
- Empresa cliente y vacante asociada
- Estado del proceso (por definir estados exactos)

## Flujo general
```
Vacante creada → Reclutador busca candidatos → Candidato registrado →
Entrevista programada → Entrevista realizada → Decisión empresa →
Candidato colocado / Candidato rechazado (vuelve a pool)
```

## Pendientes
- [ ] Analizar archivos Excel para mapear campos exactos
- [ ] Definir estados del pipeline de reclutamiento
- [ ] Definir permisos por rol para este módulo
- [ ] Diseñar modelo de datos
