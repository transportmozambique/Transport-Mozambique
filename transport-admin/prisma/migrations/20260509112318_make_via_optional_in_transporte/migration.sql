-- DropForeignKey
ALTER TABLE "Transporte" DROP CONSTRAINT "Transporte_viaId_fkey";

-- AlterTable
ALTER TABLE "Transporte" ALTER COLUMN "viaId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Transporte" ADD CONSTRAINT "Transporte_viaId_fkey" FOREIGN KEY ("viaId") REFERENCES "Via"("id") ON DELETE SET NULL ON UPDATE CASCADE;
