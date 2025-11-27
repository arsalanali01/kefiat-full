-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "implementingActionsAt" TIMESTAMP(3),
ADD COLUMN     "inQueueAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "maintenanceRequestedAt" TIMESTAMP(3),
ADD COLUMN     "viewedAt" TIMESTAMP(3);
