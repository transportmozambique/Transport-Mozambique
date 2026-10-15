-- CreateTable
CREATE TABLE "Administrador" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Administrador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provincia" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "geoLocation" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "administradorId" TEXT,

    CONSTRAINT "Provincia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cidade" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "localizacao" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "codigoProvinciaString" TEXT NOT NULL,
    "provinciaId" TEXT NOT NULL,

    CONSTRAINT "Cidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Municipio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "endereco" TEXT,
    "contacto1" INTEGER,
    "codigoCidade" TEXT,
    "administradorId" TEXT,
    "provinciaId" TEXT,
    "cidadeId" TEXT,

    CONSTRAINT "Municipio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Via" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#3B82F6',
    "terminalPartida" TEXT NOT NULL,
    "terminalChegada" TEXT NOT NULL,
    "geoLocationPath" TEXT NOT NULL,
    "codigoMunicipio" TEXT NOT NULL,
    "administradorId" TEXT,
    "municipioId" TEXT NOT NULL,

    CONSTRAINT "Via_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paragem" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "geoLocation" TEXT NOT NULL,
    "administradorId" TEXT,

    CONSTRAINT "Paragem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViaParagem" (
    "id" TEXT NOT NULL,
    "codigoParagem" TEXT NOT NULL,
    "codigoVia" TEXT NOT NULL,
    "terminalBoolean" BOOLEAN NOT NULL DEFAULT false,
    "viaId" TEXT NOT NULL,
    "paragemId" TEXT NOT NULL,

    CONSTRAINT "ViaParagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proprietario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "bi" TEXT NOT NULL,
    "nacionalidade" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "endereco" TEXT NOT NULL,
    "contacto1" INTEGER NOT NULL,
    "contacto2" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proprietario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transporte" (
    "id" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "lotacao" INTEGER NOT NULL,
    "codigo" INTEGER NOT NULL,
    "codigoVia" TEXT NOT NULL,
    "currGeoLocation" TEXT,
    "routePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "viaId" TEXT NOT NULL,

    CONSTRAINT "Transporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransporteProprietario" (
    "id" TEXT NOT NULL,
    "codigoTransporte" INTEGER NOT NULL,
    "idProprietario" TEXT NOT NULL,
    "transporteId" TEXT NOT NULL,
    "proprietarioId" TEXT NOT NULL,

    CONSTRAINT "TransporteProprietario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Motorista" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "bi" TEXT NOT NULL,
    "cartaConducao" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3) NOT NULL,
    "endereco" TEXT NOT NULL,
    "foto" TEXT,
    "nacionalidade" TEXT NOT NULL DEFAULT 'Moçambicana',
    "genero" TEXT NOT NULL DEFAULT 'Masculino',
    "estadoCivil" TEXT NOT NULL DEFAULT 'Solteiro',
    "numeroEmergencia" TEXT NOT NULL,
    "contatoEmergencia" TEXT NOT NULL,
    "deficiencia" TEXT,
    "dataEmissaoBI" TIMESTAMP(3) NOT NULL,
    "dataValidadeBI" TIMESTAMP(3) NOT NULL,
    "dataEmissaoCarta" TIMESTAMP(3) NOT NULL,
    "dataValidadeCarta" TIMESTAMP(3) NOT NULL,
    "categoriaCarta" TEXT NOT NULL DEFAULT 'B',
    "experienciaAnos" INTEGER NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "transporteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Motorista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "mISSION" TEXT NOT NULL,
    "geoLocation" TEXT,
    "subscrito" BOOLEAN NOT NULL DEFAULT false,
    "dataSubscricao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MISSION" (
    "id" TEXT NOT NULL,
    "mISSIONUtente" TEXT NOT NULL,
    "codigoParagem" TEXT NOT NULL,
    "geoLocationUtente" TEXT NOT NULL,
    "geoLocationParagem" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "utenteId" TEXT NOT NULL,
    "paragemId" TEXT NOT NULL,

    CONSTRAINT "MISSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoLocation" (
    "id" TEXT NOT NULL,
    "geoLocationTransporte" TEXT NOT NULL,
    "geoDirection" TEXT NOT NULL,
    "codigoTransporte" INTEGER NOT NULL,
    "geoLocationHist1" TEXT,
    "geoLocationHist2" TEXT,
    "geoLocationHist3" TEXT,
    "geoDateTime1" TIMESTAMP(3),
    "geoDateTime2" TIMESTAMP(3),
    "geoDateTime3" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transporteId" TEXT NOT NULL,

    CONSTRAINT "GeoLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Administrador_email_key" ON "Administrador"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Provincia_codigo_key" ON "Provincia"("codigo");

-- CreateIndex
CREATE INDEX "Provincia_administradorId_idx" ON "Provincia"("administradorId");

-- CreateIndex
CREATE UNIQUE INDEX "Cidade_codigo_key" ON "Cidade"("codigo");

-- CreateIndex
CREATE INDEX "Cidade_provinciaId_idx" ON "Cidade"("provinciaId");

-- CreateIndex
CREATE UNIQUE INDEX "Municipio_codigo_key" ON "Municipio"("codigo");

-- CreateIndex
CREATE INDEX "Municipio_administradorId_idx" ON "Municipio"("administradorId");

-- CreateIndex
CREATE INDEX "Municipio_provinciaId_idx" ON "Municipio"("provinciaId");

-- CreateIndex
CREATE INDEX "Municipio_cidadeId_idx" ON "Municipio"("cidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "Via_codigo_key" ON "Via"("codigo");

-- CreateIndex
CREATE INDEX "Via_administradorId_idx" ON "Via"("administradorId");

-- CreateIndex
CREATE INDEX "Via_municipioId_idx" ON "Via"("municipioId");

-- CreateIndex
CREATE UNIQUE INDEX "Paragem_codigo_key" ON "Paragem"("codigo");

-- CreateIndex
CREATE INDEX "Paragem_administradorId_idx" ON "Paragem"("administradorId");

-- CreateIndex
CREATE INDEX "ViaParagem_viaId_idx" ON "ViaParagem"("viaId");

-- CreateIndex
CREATE INDEX "ViaParagem_paragemId_idx" ON "ViaParagem"("paragemId");

-- CreateIndex
CREATE UNIQUE INDEX "ViaParagem_viaId_paragemId_key" ON "ViaParagem"("viaId", "paragemId");

-- CreateIndex
CREATE UNIQUE INDEX "Proprietario_bi_key" ON "Proprietario"("bi");

-- CreateIndex
CREATE UNIQUE INDEX "Transporte_matricula_key" ON "Transporte"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Transporte_codigo_key" ON "Transporte"("codigo");

-- CreateIndex
CREATE INDEX "Transporte_viaId_idx" ON "Transporte"("viaId");

-- CreateIndex
CREATE INDEX "TransporteProprietario_transporteId_idx" ON "TransporteProprietario"("transporteId");

-- CreateIndex
CREATE INDEX "TransporteProprietario_proprietarioId_idx" ON "TransporteProprietario"("proprietarioId");

-- CreateIndex
CREATE UNIQUE INDEX "TransporteProprietario_transporteId_proprietarioId_key" ON "TransporteProprietario"("transporteId", "proprietarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Motorista_bi_key" ON "Motorista"("bi");

-- CreateIndex
CREATE UNIQUE INDEX "Motorista_cartaConducao_key" ON "Motorista"("cartaConducao");

-- CreateIndex
CREATE UNIQUE INDEX "Motorista_email_key" ON "Motorista"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Motorista_transporteId_key" ON "Motorista"("transporteId");

-- CreateIndex
CREATE INDEX "Motorista_transporteId_idx" ON "Motorista"("transporteId");

-- CreateIndex
CREATE UNIQUE INDEX "Utente_email_key" ON "Utente"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Utente_telefone_key" ON "Utente"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "Utente_mISSION_key" ON "Utente"("mISSION");

-- CreateIndex
CREATE INDEX "MISSION_utenteId_idx" ON "MISSION"("utenteId");

-- CreateIndex
CREATE INDEX "MISSION_paragemId_idx" ON "MISSION"("paragemId");

-- CreateIndex
CREATE INDEX "GeoLocation_transporteId_idx" ON "GeoLocation"("transporteId");

-- AddForeignKey
ALTER TABLE "Provincia" ADD CONSTRAINT "Provincia_administradorId_fkey" FOREIGN KEY ("administradorId") REFERENCES "Administrador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cidade" ADD CONSTRAINT "Cidade_provinciaId_fkey" FOREIGN KEY ("provinciaId") REFERENCES "Provincia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Municipio" ADD CONSTRAINT "Municipio_administradorId_fkey" FOREIGN KEY ("administradorId") REFERENCES "Administrador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Municipio" ADD CONSTRAINT "Municipio_provinciaId_fkey" FOREIGN KEY ("provinciaId") REFERENCES "Provincia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Municipio" ADD CONSTRAINT "Municipio_cidadeId_fkey" FOREIGN KEY ("cidadeId") REFERENCES "Cidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Via" ADD CONSTRAINT "Via_administradorId_fkey" FOREIGN KEY ("administradorId") REFERENCES "Administrador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Via" ADD CONSTRAINT "Via_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paragem" ADD CONSTRAINT "Paragem_administradorId_fkey" FOREIGN KEY ("administradorId") REFERENCES "Administrador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViaParagem" ADD CONSTRAINT "ViaParagem_viaId_fkey" FOREIGN KEY ("viaId") REFERENCES "Via"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViaParagem" ADD CONSTRAINT "ViaParagem_paragemId_fkey" FOREIGN KEY ("paragemId") REFERENCES "Paragem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transporte" ADD CONSTRAINT "Transporte_viaId_fkey" FOREIGN KEY ("viaId") REFERENCES "Via"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransporteProprietario" ADD CONSTRAINT "TransporteProprietario_transporteId_fkey" FOREIGN KEY ("transporteId") REFERENCES "Transporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransporteProprietario" ADD CONSTRAINT "TransporteProprietario_proprietarioId_fkey" FOREIGN KEY ("proprietarioId") REFERENCES "Proprietario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motorista" ADD CONSTRAINT "Motorista_transporteId_fkey" FOREIGN KEY ("transporteId") REFERENCES "Transporte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MISSION" ADD CONSTRAINT "MISSION_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "Utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MISSION" ADD CONSTRAINT "MISSION_paragemId_fkey" FOREIGN KEY ("paragemId") REFERENCES "Paragem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoLocation" ADD CONSTRAINT "GeoLocation_transporteId_fkey" FOREIGN KEY ("transporteId") REFERENCES "Transporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
