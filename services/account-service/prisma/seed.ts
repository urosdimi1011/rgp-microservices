import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany();
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("password123", salt);
  await prisma.user.createMany({
    data: [
      {
        username: "urosdimi",
        email: "uros@gmail.com",
        passwordHash: hashedPassword,
        role: "GameMaster",
      },
      {
        username: "bob",
        email: "bob@gmail.com",
        passwordHash: hashedPassword,
        role: "User",
      },
      {
        username: "charlie",
        email: "charlie@gmail.com",
        passwordHash: hashedPassword,
        role: "User",
      },
      {
        username: "diana",
        email: "diana@gmail.com",
        passwordHash: hashedPassword,
        role: "User",
      },
      {
        username: "gamemaster",
        email: "gm@gmail.com",
        passwordHash: hashedPassword,
        role: "GameMaster",
      },
      {
        username: "admin",
        email: "admin@gmail.com",
        passwordHash: hashedPassword,
        role: "GameMaster",
      },
    ],
  });
  console.log("Seeding completed successfully");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
