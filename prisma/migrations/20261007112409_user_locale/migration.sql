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
    "costSettings" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en'
);
INSERT INTO "new_User" ("billingProvider", "costSettings", "createdAt", "currentPeriodEnd", "email", "id", "name", "passwordHash", "plan", "stripeCustomerId", "subscriptionRef", "subscriptionStatus") SELECT "billingProvider", "costSettings", "createdAt", "currentPeriodEnd", "email", "id", "name", "passwordHash", "plan", "stripeCustomerId", "subscriptionRef", "subscriptionStatus" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_subscriptionRef_key" ON "User"("subscriptionRef");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
