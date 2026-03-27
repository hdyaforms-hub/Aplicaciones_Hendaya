-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PMPA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sucursal" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "rbd" INTEGER NOT NULL,
    "licId" INTEGER,
    "programa" TEXT NOT NULL,
    "estrato" TEXT NOT NULL,
    "raceq" INTEGER NOT NULL,
    "servicio" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Colegios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "colut" INTEGER NOT NULL,
    "colRBD" INTEGER NOT NULL,
    "colRBDDV" TEXT NOT NULL,
    "insid" TEXT NOT NULL,
    "institucion" TEXT NOT NULL,
    "sucursal" TEXT NOT NULL,
    "nombreEstablecimiento" TEXT NOT NULL,
    "direccionEstablecimiento" TEXT NOT NULL,
    "comuna" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "IngRacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "fechaSistema" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaIngreso" DATETIME NOT NULL,
    "rbd" INTEGER NOT NULL,
    "licId" INTEGER,
    "nombreEstablecimiento" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "programa" TEXT NOT NULL,
    "estrato" TEXT NOT NULL,
    "desayunoIng" INTEGER NOT NULL,
    "almuerzoIng" INTEGER NOT NULL,
    "onceIng" INTEGER NOT NULL,
    "colacionIng" INTEGER NOT NULL,
    "cenaIng" INTEGER NOT NULL,
    "totalIng" INTEGER NOT NULL,
    "desayunoAsig" INTEGER NOT NULL,
    "almuerzoAsig" INTEGER NOT NULL,
    "onceAsig" INTEGER NOT NULL,
    "colacionAsig" INTEGER NOT NULL,
    "cenaAsig" INTEGER NOT NULL,
    "totalAsig" INTEGER NOT NULL,
    "tasaPreparacion" REAL NOT NULL,
    "observacion" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Productos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "tipoProducto" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "EmailConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'office365',
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ListaCorreo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "para" TEXT NOT NULL,
    "cc" TEXT,
    "sucursalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ListaCorreo_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificacionPantalla" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigoPantalla" TEXT NOT NULL,
    "listaCorreoId" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificacionPantalla_listaCorreoId_fkey" FOREIGN KEY ("listaCorreoId") REFERENCES "ListaCorreo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlantillaCorreo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigoPantalla" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Licitacion" (
    "licId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estado" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SolicitudPan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ut" INTEGER NOT NULL,
    "licId" INTEGER,
    "rbd" INTEGER NOT NULL,
    "nombreSolicitante" TEXT NOT NULL,
    "fechaSolicitud" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solicitud" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fechaGestacion" DATETIME NOT NULL,
    "servicio" TEXT NOT NULL,
    "motivo" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "UT" (
    "codUT" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "licId" INTEGER NOT NULL,
    "estado" INTEGER NOT NULL DEFAULT 1,
    "sucursalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UT_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UT_licId_fkey" FOREIGN KEY ("licId") REFERENCES "Licitacion" ("licId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SolicitudGas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ut" INTEGER NOT NULL,
    "licId" INTEGER,
    "rbd" INTEGER NOT NULL,
    "nombreSolicitante" TEXT NOT NULL,
    "fechaSolicitud" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "distribuidor" TEXT NOT NULL,
    "tipoGas" TEXT NOT NULL,
    "cantidadLitro" REAL NOT NULL,
    "cilindro" TEXT,
    "cantidad" INTEGER,
    "observacion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RetiroSaldoHeader" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folio" TEXT NOT NULL,
    "tipoOperacion" TEXT NOT NULL,
    "rbd" INTEGER NOT NULL,
    "nombreEstablecimiento" TEXT NOT NULL,
    "ut" INTEGER NOT NULL,
    "licId" INTEGER,
    "sucursal" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supervisor" TEXT NOT NULL,
    "nombreAutoriza" TEXT,
    "rutAutoriza" TEXT,
    "firmaBase64" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RetiroSaldoDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "headerId" TEXT NOT NULL,
    "codigoProducto" TEXT NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetiroSaldoDetail_headerId_fkey" FOREIGN KEY ("headerId") REFERENCES "RetiroSaldoHeader" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mat_ConsumoGas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rbd" INTEGER NOT NULL,
    "litros" REAL NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "meses" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FormDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fields" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "formCode" TEXT,
    "formVersion" TEXT,
    "formDate" TEXT,
    "areaId" INTEGER,
    CONSTRAINT "FormDefinition_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Area" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FormSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "startDay" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endDay" INTEGER NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormSchedule_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mat_ConsumoGasHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rbd" INTEGER NOT NULL,
    "litros" REAL NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "meses" TEXT NOT NULL,
    "old_litros" REAL,
    "old_cantidad" INTEGER,
    "old_meses" TEXT,
    "observacion" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sucursal" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono1" TEXT NOT NULL,
    "telefono2" TEXT,
    "telefono3" TEXT,
    "telefono4" TEXT,
    "nombre" TEXT NOT NULL,
    "cumpleano" TEXT,
    "contacto" TEXT,
    "nota" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_SucursalToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_SucursalToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Sucursal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_SucursalToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_UserForms" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_UserForms_A_fkey" FOREIGN KEY ("A") REFERENCES "FormDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_UserForms_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ListaCorreo_nombre_key" ON "ListaCorreo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "NotificacionPantalla_codigoPantalla_listaCorreoId_key" ON "NotificacionPantalla"("codigoPantalla", "listaCorreoId");

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaCorreo_codigoPantalla_key" ON "PlantillaCorreo"("codigoPantalla");

-- CreateIndex
CREATE UNIQUE INDEX "Sucursal_nombre_key" ON "Sucursal"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "RetiroSaldoHeader_folio_key" ON "RetiroSaldoHeader"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "Mat_ConsumoGas_rbd_key" ON "Mat_ConsumoGas"("rbd");

-- CreateIndex
CREATE UNIQUE INDEX "_SucursalToUser_AB_unique" ON "_SucursalToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_SucursalToUser_B_index" ON "_SucursalToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_UserForms_AB_unique" ON "_UserForms"("A", "B");

-- CreateIndex
CREATE INDEX "_UserForms_B_index" ON "_UserForms"("B");
