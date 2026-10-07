// Creates a local demo account: `npm run db:seed`. Never run against production.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const email = "demo@dropio.test";
const password = process.env.DEMO_PASSWORD ?? "dropio-demo-pass";

const db = new PrismaClient();
await db.user.upsert({
  where: { email },
  create: { email, name: "Demo Seller", passwordHash: await bcrypt.hash(password, 12) },
  update: {},
});
console.log(`Demo user ready: ${email}`);
await db.$disconnect();
