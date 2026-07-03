-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('advertiser');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "userType" "UserType" NOT NULL DEFAULT 'advertiser';

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
