/*
  Warnings:

  - You are about to drop the column `preferredTimeWindow` on the `Request` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Request" DROP COLUMN "preferredTimeWindow",
ADD COLUMN     "preferredWindow1" TEXT,
ADD COLUMN     "preferredWindow2" TEXT;
