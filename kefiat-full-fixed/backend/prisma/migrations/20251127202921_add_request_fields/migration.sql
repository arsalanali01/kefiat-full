-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'normal', 'high', 'emergency');

-- CreateEnum
CREATE TYPE "PreferredTimeWindow" AS ENUM ('morning', 'afternoon', 'evening', 'anytime');

-- CreateEnum
CREATE TYPE "UpdatedByRole" AS ENUM ('tenant', 'manager', 'system');

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "accessInstructions" TEXT,
ADD COLUMN     "lastUpdatedByRole" "UpdatedByRole" NOT NULL DEFAULT 'system',
ADD COLUMN     "preferredTimeWindow" "PreferredTimeWindow",
ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'normal';
