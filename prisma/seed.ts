import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const SEED_TENANT_NAME = "Demo Brokerage";
const SEED_EMAIL = process.env.SEED_EMAIL ?? "admin@casefile.local";
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "casefile-dev-password";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  let tenant = await db.tenant.findFirst({ where: { name: SEED_TENANT_NAME } });
  if (!tenant) {
    tenant = await db.tenant.create({
      data: { name: SEED_TENANT_NAME, type: "BROKER" },
    });
    console.log(`Created tenant: ${tenant.name} (${tenant.id})`);
  }

  const existing = await db.user.findUnique({ where: { email: SEED_EMAIL } });
  if (!existing) {
    const user = await db.user.create({
      data: {
        tenantId: tenant.id,
        email: SEED_EMAIL,
        name: "Org Admin",
        passwordHash: await hash(SEED_PASSWORD, 12),
        role: "ORG_ADMIN",
      },
    });
    console.log(`Created user: ${user.email}`);
    console.log(`Password: ${SEED_PASSWORD}`);
    console.log("Change this password before any real use.");
  } else {
    console.log(`User already exists: ${SEED_EMAIL}`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
