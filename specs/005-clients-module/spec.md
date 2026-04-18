# Feature Specification: Módulo de Clientes

**Feature Branch**: `005-clients-module`  
**Created**: 2026-04-15  
**Updated**: 2026-04-15  
**Status**: Draft  
**Input**: User description: "005-clients - Client company management module: CRUD for client companies within a tenant, dynamic form configuration (form_config JSON for candidate fields per client), client assignment to account executives, client status tracking, contact directory, job positions, location with map, document management"

## Clarifications

### Session 2026-04-15

- Q: ¿Quién puede gestionar sub-recursos (contactos, puestos, documentos)? → A: Administradores y ejecutivos de cuenta asignados al cliente.
- Q: ¿Un cliente puede tener múltiples documentos del mismo tipo? → A: Sí, los documentos se categorizan por tipo pero se permiten múltiples por categoría.
- Q: ¿Cuál es la regla de unicidad para contactos dentro de un cliente? → A: Correo electrónico único por cliente; la misma persona puede ser contacto en diferentes clientes.
- Q: ¿El mapa debe soportar autocompletado de dirección o solo colocación manual? → A: Autocompletado de dirección con ajuste manual del marcador.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrador crea y gestiona empresas cliente (Priority: P1)

Un administrador necesita registrar nuevas empresas cliente en el sistema para poder asignarles ejecutivos de cuenta y comenzar a reclutar candidatos para ellas. El administrador accede al módulo de clientes, llena el formulario con los datos de la empresa (nombre, información de contacto, dirección) y la guarda. Puede ver la lista completa de clientes, editar su información y desactivarlos cuando ya no son clientes activos.

**Why this priority**: Sin clientes registrados no es posible asignar candidatos ni dar seguimiento a vacantes. Es la operación fundacional del módulo.

**Independent Test**: Se puede probar creando un cliente, verificando que aparece en la lista, editándolo y desactivándolo. Entrega valor inmediato al permitir el catálogo de clientes.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** llena el formulario de creación con nombre "Empresa ABC" e información de contacto, **Then** el cliente se guarda exitosamente y aparece en la lista de clientes.
2. **Given** un cliente existente "Empresa ABC", **When** el administrador edita su dirección, **Then** la información se actualiza y se refleja en la lista.
3. **Given** un cliente activo, **When** el administrador lo desactiva, **Then** el cliente aparece como inactivo y ya no está disponible para nuevas asignaciones.
4. **Given** un administrador, **When** intenta crear un cliente con un nombre que ya existe dentro del mismo tenant, **Then** el sistema muestra un aviso indicando la posible duplicación.

---

### User Story 2 - Administrador configura formulario dinámico por cliente (Priority: P1)

Cada empresa cliente requiere información diferente al registrar candidatos. El administrador configura los campos visibles del formulario de registro de candidatos para cada cliente. Por ejemplo, un cliente puede requerir turno y planta, mientras otro necesita municipio y punto de entrevista. Esta configuración se guarda como parte del perfil del cliente.

**Why this priority**: La configuración dinámica de formularios es el diferenciador clave del sistema respecto a hojas de cálculo. Sin esto, el registro de candidatos no puede adaptarse a cada cliente.

**Independent Test**: Se puede probar configurando el formulario de un cliente (activando/desactivando campos) y verificando que la configuración se guarda y se recupera correctamente.

**Acceptance Scenarios**:

1. **Given** un cliente existente sin configuración personalizada, **When** el administrador accede a su configuración de formulario, **Then** se muestran los campos disponibles con valores predeterminados (todos desactivados).
2. **Given** un cliente, **When** el administrador activa los campos "turno", "planta" y "comentarios", **Then** la configuración se guarda y al volver a acceder se muestran esos campos activados.
3. **Given** un cliente con formulario configurado, **When** se modifica la configuración quitando "planta" y agregando "municipio", **Then** los cambios se persisten correctamente.

---

### User Story 3 - Asignación de ejecutivos de cuenta a clientes (Priority: P2)

El administrador asigna uno o más ejecutivos de cuenta a cada empresa cliente. Cada ejecutivo de cuenta solo puede ver y gestionar los clientes que tiene asignados. Un reclutador se asigna a un cliente y opcionalmente se vincula a un ejecutivo de cuenta específico.

**Why this priority**: La asignación es necesaria para que los ejecutivos de cuenta puedan trabajar con sus clientes y los reclutadores puedan registrar candidatos, pero depende de que los clientes ya existan (US1).

**Independent Test**: Se puede probar asignando un ejecutivo a un cliente, verificando que el ejecutivo ve ese cliente en su lista, y que un ejecutivo no asignado no lo ve.

**Acceptance Scenarios**:

1. **Given** un cliente existente y un ejecutivo de cuenta, **When** el administrador asigna al ejecutivo al cliente, **Then** la asignación aparece en el detalle del cliente y el ejecutivo puede ver ese cliente.
2. **Given** un ejecutivo de cuenta asignado al cliente "Empresa ABC", **When** el ejecutivo consulta su lista de clientes, **Then** solo ve "Empresa ABC" (y otros que tenga asignados), no el catálogo completo.
3. **Given** un reclutador, **When** el administrador lo asigna al cliente "Empresa ABC" bajo el ejecutivo "Juan Pérez", **Then** la relación queda registrada con el vínculo al ejecutivo.
4. **Given** una asignación existente, **When** el administrador la elimina, **Then** el usuario ya no tiene acceso al cliente.

---

### User Story 4 - Visualización filtrada de clientes por rol (Priority: P2)

Cada rol del sistema ve una perspectiva diferente de los clientes. Los administradores y managers ven todos los clientes del tenant. Los ejecutivos de cuenta ven solo sus clientes asignados. Los reclutadores ven solo los clientes donde están asignados.

**Why this priority**: Complementa la asignación (US3) aplicando la visibilidad basada en roles, fundamental para la seguridad del sistema.

**Independent Test**: Se puede probar con usuarios de diferentes roles consultando la lista de clientes y verificando que cada uno ve solo lo que le corresponde.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** consulta la lista de clientes, **Then** ve todos los clientes activos e inactivos del tenant.
2. **Given** un manager autenticado, **When** consulta la lista de clientes, **Then** ve todos los clientes del tenant.
3. **Given** un ejecutivo de cuenta con 2 clientes asignados, **When** consulta la lista de clientes, **Then** solo ve esos 2 clientes.
4. **Given** un reclutador asignado a 1 cliente, **When** consulta la lista de clientes, **Then** solo ve ese cliente.

---

### User Story 5 - Administrador gestiona directorio de contactos del cliente (Priority: P2)

Cada empresa cliente tiene personas de contacto con las que el equipo de reclutamiento interactúa (RRHH, jefes de planta, etc.). Los administradores y ejecutivos de cuenta asignados al cliente pueden agregar, consultar, editar y eliminar contactos del directorio de cada cliente. Cada contacto tiene nombre, teléfono celular y correo electrónico.

**Why this priority**: Los contactos son esenciales para la comunicación diaria con el cliente, pero el módulo base de clientes (US1) funciona sin ellos. Se necesitan antes de comenzar a operar con candidatos.

**Independent Test**: Se puede probar creando un contacto para un cliente, verificándolo en la lista, editándolo y eliminándolo. Entrega valor al centralizar la información de contacto que hoy se maneja en documentos dispersos.

**Acceptance Scenarios**:

1. **Given** un cliente existente, **When** el administrador agrega un contacto con nombre "María López", teléfono "5512345678" y correo "maria@empresa.com", **Then** el contacto aparece en el directorio del cliente.
2. **Given** un ejecutivo de cuenta asignado al cliente, **When** agrega un contacto, **Then** el contacto se crea exitosamente en el directorio del cliente.
3. **Given** un contacto existente, **When** el administrador o ejecutivo asignado edita su teléfono, **Then** el cambio se refleja inmediatamente en el directorio.
4. **Given** un contacto existente, **When** el administrador o ejecutivo asignado lo elimina, **Then** el contacto ya no aparece en el directorio del cliente.
5. **Given** un cliente con 3 contactos, **When** cualquier usuario con acceso al cliente consulta el detalle, **Then** puede ver la lista completa de contactos.
6. **Given** un contacto con correo "maria@empresa.com" ya existente en el cliente, **When** se intenta crear otro contacto con el mismo correo en ese cliente, **Then** el sistema rechaza la creación indicando duplicado.

---

### User Story 6 - Administrador gestiona puestos del cliente (Priority: P2)

Cada empresa cliente recluta para puestos específicos (Ayudante General, Montacarguista, Taladrista, etc.). Los administradores y ejecutivos de cuenta asignados definen los puestos que recluta cada cliente. Estos puestos se utilizarán posteriormente al registrar candidatos para vincularlos a un puesto específico. Ambos roles pueden crear, consultar, editar y eliminar puestos.

**Why this priority**: Los puestos son necesarios para el registro de candidatos (módulo futuro), pero su gestión depende de que el cliente exista (US1). Se incluyen en el módulo de clientes porque son un atributo del cliente.

**Independent Test**: Se puede probar creando puestos para un cliente, verificando la lista, editando un nombre de puesto y eliminando uno. Entrega valor al estandarizar los puestos disponibles por cliente.

**Acceptance Scenarios**:

1. **Given** un cliente existente, **When** el administrador crea el puesto "Ayudante General", **Then** el puesto aparece en la lista de puestos del cliente.
2. **Given** un puesto "Montacarguista" existente, **When** el administrador lo renombra a "Operador de Montacargas", **Then** el cambio se refleja en la lista.
3. **Given** un puesto sin candidatos vinculados, **When** el administrador lo elimina, **Then** el puesto ya no aparece en la lista del cliente.
4. **Given** un cliente con 5 puestos, **When** se consulta el detalle del cliente, **Then** se muestra la lista completa de puestos disponibles.

---

### User Story 7 - Administrador registra ubicación del cliente con mapa (Priority: P3)

El administrador registra la dirección del cliente utilizando un campo con autocompletado de dirección que posiciona automáticamente un marcador en el mapa. El marcador se puede ajustar manualmente si la geocodificación no es exacta. Las coordenadas (latitud y longitud) se guardan junto con la dirección textual. Esto permite a los reclutadores ubicar fácilmente la empresa cliente y planear entrevistas.

**Why this priority**: La ubicación con mapa mejora la experiencia pero no es bloqueante para las operaciones básicas del módulo. La dirección textual (ya incluida en US1) es suficiente inicialmente.

**Independent Test**: Se puede probar registrando una dirección, seleccionando un punto en el mapa y verificando que las coordenadas se guardan y el mapa se muestra correctamente al consultar el cliente.

**Acceptance Scenarios**:

1. **Given** un cliente existente, **When** el administrador escribe una dirección en el campo de autocompletado y selecciona una sugerencia, **Then** el mapa se posiciona automáticamente y se guardan la dirección textual y las coordenadas geográficas.
2. **Given** un marcador posicionado automáticamente, **When** el administrador lo arrastra a otra posición en el mapa, **Then** las coordenadas se actualizan manteniendo la dirección textual.
3. **Given** un cliente con coordenadas guardadas, **When** cualquier usuario con acceso consulta el detalle del cliente, **Then** se muestra la dirección y un mapa con el marcador en la ubicación.
4. **Given** un cliente sin ubicación configurada, **When** se consulta el detalle, **Then** el mapa se muestra vacío (sin marcador) y se permite agregar la ubicación.

---

### User Story 8 - Administrador gestiona documentos del cliente (Priority: P3)

Los administradores y ejecutivos de cuenta asignados pueden cargar documentos asociados a cada cliente: cotizaciones (PDF), pases de entrevista (imagen PNG) y archivos Excel con descripción de puestos. Se permiten múltiples documentos del mismo tipo (por ejemplo, varias cotizaciones). Los documentos se almacenan de forma segura y pueden ser consultados y descargados por los usuarios con acceso al cliente.

**Why this priority**: Los documentos complementan la información del cliente pero no son bloqueantes para las operaciones de reclutamiento. Son una mejora operativa significativa respecto al proceso manual actual.

**Independent Test**: Se puede probar cargando un PDF, una imagen PNG y un archivo Excel, verificando que se almacenan, se pueden consultar y descargar correctamente.

**Acceptance Scenarios**:

1. **Given** un cliente existente, **When** el administrador carga un PDF de cotización de 2 MB, **Then** el documento se almacena exitosamente y aparece en la lista de documentos del cliente.
2. **Given** un cliente existente, **When** el administrador carga una imagen PNG de pase de entrevista, **Then** la imagen se almacena y se puede previsualizar.
3. **Given** un cliente existente, **When** el administrador carga un archivo Excel con descripción de puestos, **Then** el archivo se almacena y puede ser descargado.
4. **Given** un usuario con acceso al cliente, **When** consulta la lista de documentos, **Then** puede ver todos los documentos cargados con su nombre, tipo y fecha de carga.
5. **Given** un administrador, **When** intenta cargar un archivo de 15 MB (excede el límite), **Then** el sistema rechaza la carga con un mensaje explicativo.
6. **Given** un administrador, **When** intenta cargar un archivo .exe, **Then** el sistema rechaza el archivo por tipo no permitido.
7. **Given** un documento existente, **When** el administrador lo elimina, **Then** el documento ya no aparece en la lista ni es descargable.

---

### User Story 9 - Búsqueda y filtrado de clientes (Priority: P3)

Los usuarios necesitan encontrar clientes rápidamente en el catálogo. Pueden buscar por nombre y filtrar por estado (activo/inactivo). La lista soporta paginación para manejar catálogos grandes.

**Why this priority**: Es una mejora de usabilidad que se vuelve crítica conforme crece el catálogo de clientes, pero el sistema funciona sin ella inicialmente.

**Independent Test**: Se puede probar buscando un cliente por nombre parcial y filtrando por estado, verificando que los resultados son correctos y paginados.

**Acceptance Scenarios**:

1. **Given** 15 clientes registrados, **When** el usuario busca "ABC", **Then** solo se muestran los clientes cuyo nombre contiene "ABC".
2. **Given** clientes activos e inactivos, **When** el usuario filtra por "inactivo", **Then** solo aparecen los clientes desactivados.
3. **Given** 25 clientes y un tamaño de página de 10, **When** el usuario navega a la página 2, **Then** se muestran los clientes 11-20.

---

### Edge Cases

- ¿Qué pasa si se intenta desactivar un cliente que tiene candidatos en proceso activo? El cliente se desactiva pero los procesos existentes continúan — solo se impide crear nuevas asignaciones.
- ¿Qué pasa si se elimina la asignación de un ejecutivo que tiene reclutadores vinculados bajo él en ese cliente? Se eliminan también las asignaciones de los reclutadores vinculados a ese ejecutivo en ese cliente.
- ¿Qué pasa si se intenta asignar un usuario inactivo a un cliente? El sistema rechaza la asignación.
- ¿Qué pasa si dos administradores editan el mismo cliente simultáneamente? El último en guardar gana (last-write-wins), comportamiento estándar para esta escala de uso.
- ¿Qué pasa si se intenta crear un contacto con un correo electrónico inválido? El sistema valida el formato y muestra un error antes de guardar.
- ¿Qué pasa si se intenta crear un puesto con un nombre que ya existe en el mismo cliente? El sistema rechaza la creación indicando que el puesto ya existe.
- ¿Qué pasa si se elimina un puesto que ya tiene candidatos vinculados? El puesto se desactiva (soft delete) en lugar de eliminarse, para preservar la referencia histórica.
- ¿Qué pasa si el servicio de mapas no está disponible? Se permite registrar la dirección textual sin seleccionar coordenadas; el mapa se muestra como no disponible temporalmente.
- ¿Qué pasa si se pierde la conexión durante la carga de un documento? La carga falla y se notifica al usuario para reintentarla; no quedan archivos parciales.
- ¿Qué pasa si se carga un archivo que excede el tamaño máximo permitido? El sistema rechaza la carga antes de transferir el archivo completo, mostrando el límite permitido.

## Requirements *(mandatory)*

### Functional Requirements

**CRUD de clientes**
- **FR-001**: El sistema DEBE permitir a los administradores crear empresas cliente con nombre (obligatorio), información de contacto (opcional) y dirección (opcional).
- **FR-002**: El sistema DEBE permitir a los administradores editar los datos de un cliente existente (nombre, contacto, dirección).
- **FR-003**: El sistema DEBE permitir a los administradores desactivar un cliente (soft delete via flag `is_active`).
- **FR-014**: El sistema NO DEBE permitir a managers crear o editar clientes — solo admin puede hacerlo.

**Configuración de formulario**
- **FR-004**: El sistema DEBE almacenar una configuración de formulario (form_config) por cada cliente que define qué campos adicionales son visibles al registrar candidatos para ese cliente.
- **FR-005**: Los campos configurables del formulario son: hora de entrevista, puesto, municipio, edad, turno, planta, punto de entrevista y comentarios.

**Asignaciones y visibilidad**
- **FR-006**: El sistema DEBE permitir a los administradores asignar usuarios (ejecutivos de cuenta y reclutadores) a clientes.
- **FR-007**: Al asignar un reclutador a un cliente, opcionalmente se puede indicar el ejecutivo de cuenta bajo el cual trabaja.
- **FR-008**: El sistema DEBE restringir la visibilidad de clientes según el rol del usuario: admin y manager ven todos; ejecutivo de cuenta ve solo los asignados; reclutador ve solo los asignados.
- **FR-011**: El sistema DEBE impedir la asignación de usuarios inactivos a clientes.

**Directorio de contactos**
- **FR-015**: El sistema DEBE permitir a los administradores y ejecutivos de cuenta asignados crear contactos asociados a un cliente con los campos: nombre del contacto (obligatorio), teléfono celular (obligatorio) y correo electrónico (obligatorio).
- **FR-016**: El sistema DEBE permitir a administradores y ejecutivos de cuenta asignados consultar, editar y eliminar (hard delete) contactos del directorio de un cliente.
- **FR-017**: El sistema DEBE validar el formato del correo electrónico y del teléfono celular al crear o editar un contacto.
- **FR-018**: Los contactos de un cliente DEBEN ser visibles para todos los usuarios que tengan acceso a ese cliente.
- **FR-036**: El sistema NO DEBE permitir crear dos contactos con el mismo correo electrónico dentro del mismo cliente (unicidad por email + cliente dentro del tenant).

**Gestión de puestos**
- **FR-019**: El sistema DEBE permitir a los administradores y ejecutivos de cuenta asignados crear puestos asociados a un cliente con el campo nombre del puesto (obligatorio).
- **FR-020**: El sistema DEBE permitir a administradores y ejecutivos de cuenta asignados consultar, editar y eliminar puestos de un cliente.
- **FR-021**: El sistema NO DEBE permitir crear dos puestos con el mismo nombre dentro del mismo cliente (unicidad por nombre + cliente dentro del tenant).
- **FR-022**: Si un puesto tiene candidatos vinculados, su eliminación DEBE ser un soft delete (desactivación) en lugar de eliminación definitiva.

**Ubicación geográfica**
- **FR-023**: El sistema DEBE permitir registrar la dirección textual del cliente.
- **FR-024**: El sistema DEBE proporcionar un mapa interactivo con autocompletado de dirección para seleccionar la ubicación geográfica del cliente. El marcador resultante DEBE poder ajustarse manualmente.
- **FR-025**: El sistema DEBE almacenar las coordenadas (latitud y longitud) asociadas al cliente.
- **FR-026**: El mapa DEBE mostrar un marcador en la ubicación guardada al consultar el detalle del cliente.
- **FR-027**: Si el servicio de mapas no está disponible, el sistema DEBE permitir registrar solo la dirección textual sin bloquear la operación.

**Gestión de documentos**
- **FR-028**: El sistema DEBE permitir a los administradores y ejecutivos de cuenta asignados cargar documentos asociados a un cliente.
- **FR-029**: Los tipos de documentos permitidos son: cotización (PDF), pase de entrevista (imagen PNG) y archivo Excel con descripción de puestos (.xlsx). Se permiten múltiples documentos del mismo tipo por cliente.
- **FR-030**: El sistema DEBE validar el tipo de archivo antes de aceptar la carga, rechazando formatos no permitidos.
- **FR-031**: El sistema DEBE imponer un límite de tamaño por archivo de 10 MB.
- **FR-032**: Los documentos cargados DEBEN poder ser consultados (listados) y descargados por cualquier usuario con acceso al cliente.
- **FR-033**: Las imágenes PNG (pases de entrevista) DEBEN poder previsualizarse directamente en la interfaz.
- **FR-034**: El sistema DEBE permitir a los administradores y ejecutivos de cuenta asignados eliminar documentos cargados.
- **FR-035**: Cada documento DEBE registrar el nombre original del archivo, el tipo de documento, la fecha de carga y el usuario que lo cargó.

**Transversales**
- **FR-009**: El sistema DEBE soportar búsqueda de clientes por nombre (parcial, case-insensitive) y filtrado por estado (activo/inactivo).
- **FR-010**: El sistema DEBE paginar los resultados de la lista de clientes.
- **FR-012**: El sistema DEBE registrar cada operación (creación, edición, desactivación, asignación, desasignación, carga/eliminación de documentos) en la bitácora de auditoría.
- **FR-013**: Todos los datos de clientes, contactos, puestos y documentos DEBEN estar aislados por tenant (multi-tenancy).

### Key Entities

- **Client (Cliente)**: Empresa cliente que contrata servicios de reclutamiento. Atributos principales: nombre, información de contacto, dirección, coordenadas geográficas (latitud, longitud), configuración de formulario, estado activo/inactivo. Pertenece a un tenant.
- **Client Assignment (Asignación de cliente)**: Relación entre un usuario (ejecutivo de cuenta o reclutador) y un cliente. Opcionalmente vincula al reclutador con un ejecutivo de cuenta. Pertenece a un tenant.
- **Client Contact (Contacto del cliente)**: Persona de contacto asociada a una empresa cliente. Atributos: nombre, teléfono celular, correo electrónico (único por cliente). Pertenece a un cliente y a un tenant.
- **Client Position (Puesto del cliente)**: Puesto que el cliente recluta. Atributo principal: nombre del puesto. Único por nombre dentro de un mismo cliente. Pertenece a un cliente y a un tenant.
- **Client Document (Documento del cliente)**: Archivo asociado a un cliente. Atributos: nombre original, tipo de documento (cotización/pase de entrevista/descripción de puestos), fecha de carga, usuario que lo cargó, referencia al almacenamiento. Pertenece a un cliente y a un tenant.
- **Form Config (Configuración de formulario)**: Estructura que define qué campos adicionales son visibles en el formulario de registro de candidatos para un cliente específico. Es un atributo del cliente, no una entidad independiente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los administradores pueden crear un nuevo cliente completo (datos básicos + contactos + puestos) en menos de 5 minutos.
- **SC-002**: La configuración de formulario de un cliente se puede modificar y guardar en menos de 30 segundos.
- **SC-003**: Los ejecutivos de cuenta ven exclusivamente sus clientes asignados — 0% de visibilidad a clientes no asignados.
- **SC-004**: La lista de clientes con 100+ registros carga en menos de 2 segundos.
- **SC-005**: Cada operación sobre clientes genera un registro de auditoría verificable.
- **SC-006**: Ningún dato de cliente es accesible fuera de su tenant — aislamiento 100%.
- **SC-007**: Los contactos de un cliente se pueden agregar, editar y eliminar en menos de 30 segundos cada operación.
- **SC-008**: Los puestos de un cliente se pueden gestionar sin duplicados — 0% de puestos con nombre repetido en el mismo cliente.
- **SC-009**: La carga de documentos de hasta 10 MB completa exitosamente en menos de 30 segundos.
- **SC-010**: La ubicación seleccionada en el mapa se muestra correctamente al volver a consultar el cliente en el 100% de los casos (cuando el servicio de mapas está disponible).

## Assumptions

- El sistema de autenticación y autorización (módulo auth) ya está implementado y funcional, incluyendo el middleware de resolución de tenant y validación JWT.
- El módulo de usuarios ya está implementado, proporcionando la lista de usuarios disponibles para asignación.
- La configuración de formulario (form_config) almacena solo toggles booleanos de visibilidad para un conjunto fijo de campos. No se requiere soporte para campos completamente personalizados (custom fields) en esta versión.
- Los managers pueden ver todos los clientes pero no pueden crear, editar ni desactivar clientes — solo los administradores tienen permisos de escritura.
- La desactivación de un cliente no afecta los procesos de candidatos ya en curso — solo impide nuevas asignaciones de candidatos a ese cliente.
- No se requiere importación masiva (CSV) de clientes en esta versión; los clientes se crean uno a uno.
- El directorio de contactos almacena personas de contacto de la empresa cliente, no usuarios del sistema. No requieren autenticación.
- Los contactos se eliminan de forma definitiva (hard delete) dado que no contienen PII de candidatos protegidos por LFPDPPP — son contactos comerciales de la empresa cliente.
- El servicio de mapas interactivo se basa en un proveedor de mapas gratuito o de bajo costo, consistente con el presupuesto objetivo de $0-25/mes.
- Los documentos se almacenan en un servicio de almacenamiento de archivos separado de la base de datos.
- El límite de tamaño por archivo es de 10 MB. No se establece un límite máximo de documentos por cliente en esta versión.
- Solo se soportan 3 tipos de documento en esta versión: PDF (cotizaciones), PNG (pases de entrevista) y XLSX (descripción de puestos). Se pueden agregar más tipos en versiones futuras.
- Los puestos del cliente son registros simples (solo nombre). No incluyen descripción detallada, salario o requisitos en esta versión — esa información puede estar en el archivo Excel adjunto.
