import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaFingerprint?: string;
};

const prismaNamespace = Prisma as unknown as Record<string, unknown>;
const schemaFingerprint = Object.values(Prisma.ModelName)
  .map((modelName) => {
    const fields = prismaNamespace[`${modelName}ScalarFieldEnum`];
    return `${modelName}:${fields && typeof fields === "object" ? Object.values(fields).join(",") : ""}`;
  })
  .join("|");

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export function getPrisma() {
  if (
    !globalForPrisma.prisma ||
    globalForPrisma.prismaSchemaFingerprint !== schemaFingerprint
  ) {
    void globalForPrisma.prisma?.$disconnect();
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaSchemaFingerprint = schemaFingerprint;
  }
  return globalForPrisma.prisma;
}
