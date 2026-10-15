import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('CRUD Operations', () => {
  let testProvinciaId: string;
  let testMunicipioId: string;

  beforeAll(async () => {
    // Get existing provincia and municipio for testing
    const provincia = await prisma.provincia.findFirst();
    const municipio = await prisma.municipio.findFirst();
    
    if (provincia) testProvinciaId = provincia.id;
    if (municipio) testMunicipioId = municipio.id;
  });

  describe('Provincia Operations', () => {
    it('should read provincias', async () => {
      const provincias = await prisma.provincia.findMany();
      expect(provincias.length).toBeGreaterThan(0);
    });

    it('should find provincia by id', async () => {
      if (!testProvinciaId) return;
      const provincia = await prisma.provincia.findUnique({
        where: { id: testProvinciaId },
      });
      expect(provincia).not.toBeNull();
    });
  });

  describe('Municipio Operations', () => {
    it('should read municipios', async () => {
      const municipios = await prisma.municipio.findMany();
      expect(municipios.length).toBeGreaterThan(0);
    });

    it('should find municipio with vias', async () => {
      if (!testMunicipioId) return;
      const municipio = await prisma.municipio.findUnique({
        where: { id: testMunicipioId },
        include: { vias: true },
      });
      expect(municipio).not.toBeNull();
    });
  });

  describe('Via Operations', () => {
    it('should read vias', async () => {
      const vias = await prisma.via.findMany({ take: 10 });
      expect(vias.length).toBeGreaterThan(0);
    });

    it('should find via with paragens and transportes', async () => {
      const via = await prisma.via.findFirst({
        include: {
          paragens: true,
          transportes: true,
        },
      });
      expect(via).not.toBeNull();
    });
  });

  describe('Transporte Operations', () => {
    it('should read transportes', async () => {
      const transportes = await prisma.transporte.findMany({ take: 10 });
      expect(transportes.length).toBeGreaterThan(0);
    });

    it('should find transporte with relations', async () => {
      const transporte = await prisma.transporte.findFirst({
        include: {
          motorista: true,
          via: true,
          proprietarios: true,
        },
      });
      expect(transporte).not.toBeNull();
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
