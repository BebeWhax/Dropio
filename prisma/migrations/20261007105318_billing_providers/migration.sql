/*
  Warnings:

  - You are about to drop the column `stripeSubscriptionId` on the `User` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerRef" TEXT,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillingSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "billingProvider" TEXT,
    "subscriptionRef" TEXT,
    "stripeCustomerId" TEXT,
    "currentPeriodEnd" DATETIME,
    "costSettings" TEXT
);
INSERT INTO "new_User" ("costSettings", "createdAt", "currentPeriodEnd", "email", "id", "name", "passwordHash", "plan", "stripeCustomerId", "subscriptionStatus") SELECT "costSettings", "createdAt", "currentPeriodEnd", "email", "id", "name", "passwordHash", "plan", "stripeCustomerId", "subscriptionStatus" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_subscriptionRef_key" ON "User"("subscriptionRef");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_providerRef_key" ON "BillingSubscription"("providerRef");

-- CreateIndex
CREATE INDEX "BillingSubscription_userId_idx" ON "BillingSubscription"("userId");
