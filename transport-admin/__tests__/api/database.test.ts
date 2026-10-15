import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Database Operations', () => {
  it('should connect to database', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    expect(result).toBeDefined();
  });

  it('should count vias', async () => {
    const count = await prisma.via.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should count paragens', async () => {
    const count = await prisma.paragem.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should count transportes', async () => {
    const count = await prisma.transporte.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should find vias with paragens', async () => {
    const vias = await prisma.via.findMany({
      include: {
        paragens: true,
      },
      take: 5,
    });
    expect(vias).toBeDefined();
    expect(Array.isArray(vias)).toBe(true);
  });

  it('should find transportes with motoristas', async () => {
    const transportes = await prisma.transporte.findMany({
      include: {
        motorista: true,
      },
      take: 5,
    });
    expect(transportes).toBeDefined();
    expect(Array.isArray(transportes)).toBe(true);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
