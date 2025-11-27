/*
  Warnings:

  - The `lastUpdatedByRole` column on the `Request` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Request" DROP COLUMN "lastUpdatedByRole",
ADD COLUMN     "lastUpdatedByRole" TEXT,
ALTER COLUMN "inQueueAt" DROP DEFAULT;
