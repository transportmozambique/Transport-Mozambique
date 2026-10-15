import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

describe('Authentication API', () => {
  let testAdminId: string;

  beforeAll(async () => {
    // Create test admin
    const hashedPassword = await bcrypt.hash('TestPassword123', 10);
    const admin = await prisma.administrador.create({
      data: {
        nome: 'Test Admin',
        email: 'test@admin.com',
        senha: hashedPassword,
      },
    });
    testAdminId = admin.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.administrador.delete({ where: { id: testAdminId } });
    await prisma.$disconnect();
  });

  it('should hash passwords correctly', async () => {
    const password = 'TestPassword123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const isValid = await bcrypt.compare(password, hashedPassword);
    expect(isValid).toBe(true);
  });

  it('should not match incorrect passwords', async () => {
    const password = 'TestPassword123';
    const wrongPassword = 'WrongPassword';
    const hashedPassword = await bcrypt.hash(password, 10);
    const isValid = await bcrypt.compare(wrongPassword, hashedPassword);
    expect(isValid).toBe(false);
  });

  it('should find admin by email', async () => {
    const admin = await prisma.administrador.findUnique({
      where: { email: 'test@admin.com' },
    });
    expect(admin).not.toBeNull();
    expect(admin?.nome).toBe('Test Admin');
  });
});
