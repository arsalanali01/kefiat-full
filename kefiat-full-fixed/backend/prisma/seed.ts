import {
  PrismaClient,
  Role,
  Priority,
  PreferredTimeWindow,
  UpdatedByRole,
} from "@prisma/client";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const passwordHash = await bcrypt.hash("password123", saltRounds);

  // Manager user
  await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: {
      name: "Manager One",
      email: "manager@example.com",
      passwordHash,
      role: Role.manager,
    },
  });

  // Tenant user + profile
  const tenant = await prisma.user.upsert({
    where: { email: "tenant@example.com" },
    update: {},
    create: {
      name: "Tenant One",
      email: "tenant@example.com",
      passwordHash,
      role: Role.tenant,
    },
  });

  await prisma.tenantProfile.upsert({
    where: { userId: tenant.id },
    update: {},
    create: {
      userId: tenant.id,
      unitId: 101,
    },
  });

  // Sample requests
  await prisma.request.create({
    data: {
      unit: "101",
      category: "Water leak",
      description: "Water dripping under kitchen sink.",
      phone: "555-123-4567",
      status: "in_queue",
      priority: Priority.high,
      preferredTimeWindow: PreferredTimeWindow.morning,
      accessInstructions: "OK to enter if I am not home.",
      lastUpdatedByRole: UpdatedByRole.tenant,
      tenantId: tenant.id,
    },
  });

  await prisma.request.create({
    data: {
      unit: "101",
      category: "AC",
      description: "AC not cooling properly.",
      phone: "555-123-4567",
      status: "maintenance_requested",
      priority: Priority.normal,
      preferredTimeWindow: PreferredTimeWindow.afternoon,
      accessInstructions: "Please call before coming.",
      lastUpdatedByRole: UpdatedByRole.manager,
      tenantId: tenant.id,
    },
  });

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
