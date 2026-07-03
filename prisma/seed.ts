// Populates the lookup tables: parishes, categories, subcategories.
// Run with: npm run seed

import { PrismaClient } from "@prisma/client";
import { PARISHES } from "../lib/data/parishes";
import { CATEGORIES } from "../lib/data/categories";

const prisma = new PrismaClient();

async function main() {
  for (const name of PARISHES) {
    await prisma.parish.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const [categoryName, subcats] of Object.entries(CATEGORIES)) {
    const category = await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });

    for (const sub of subcats) {
      await prisma.subcategory.upsert({
        where: { categoryId_name: { categoryId: category.id, name: sub } },
        update: {},
        create: { name: sub, categoryId: category.id },
      });
    }
  }

  console.log("Seed complete: parishes + categories loaded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
