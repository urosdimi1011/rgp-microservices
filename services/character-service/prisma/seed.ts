import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const classes = [
    {
      name: "Warrior",
      description:
        "A master of combat, excelling in physical strength and durability. Warriors specialize in melee weapons and heavy armor.",
    },
    {
      name: "Rogue",
      description:
        "A stealthy character specializing in agility, precision, and subterfuge. Rogues excel at sneaking, lockpicking, and critical strikes.",
    },
    {
      name: "Mage",
      description:
        "A wielder of arcane magic, focusing on intelligence and spellcasting. Mages control elemental forces and manipulate reality.",
    },
    {
      name: "Cleric",
      description:
        "A holy warrior with divine powers, relying on faith and healing. Clerics can heal allies and smite enemies with holy magic.",
    },
    {
      name: "Ranger",
      description:
        "A wilderness expert who excels at archery and tracking. Rangers are skilled with bows and have animal companions.",
    },
  ];

  for (const cls of classes) {
    const existingClass = await prisma.class.findUnique({
      where: { name: cls.name },
    });

    if (!existingClass) {
      await prisma.class.create({
        data: cls,
      });
    }
  }
  const items = [
    {
      name: "Iron Sword",
      description:
        "A basic but reliable sword made of iron. Perfect for beginners.",
      bonusStrength: 5,
      bonusAgility: 1,
      bonusIntelligence: 0,
      bonusFaith: 0,
    },
    {
      name: "Steel Greatsword",
      description:
        "A massive two-handed sword that requires great strength to wield.",
      bonusStrength: 12,
      bonusAgility: -2,
      bonusIntelligence: 0,
      bonusFaith: 0,
    },
    {
      name: "Assassin Dagger",
      description:
        "A sharp, lightweight dagger perfect for stealth attacks and critical hits.",
      bonusStrength: 2,
      bonusAgility: 8,
      bonusIntelligence: 1,
      bonusFaith: 0,
    },
    {
      name: "Longbow",
      description: "A finely crafted bow with excellent range and accuracy.",
      bonusStrength: 3,
      bonusAgility: 10,
      bonusIntelligence: 0,
      bonusFaith: 0,
    },
    {
      name: "Wizard Staff",
      description:
        "A staff imbued with magical energy, enhancing spellcasting abilities.",
      bonusStrength: 0,
      bonusAgility: 1,
      bonusIntelligence: 15,
      bonusFaith: 3,
    },
    {
      name: "Holy Scepter",
      description:
        "A sacred scepter that channels divine power for healing and smiting.",
      bonusStrength: 2,
      bonusAgility: 0,
      bonusIntelligence: 3,
      bonusFaith: 12,
    },
    {
      name: "Leather Armor",
      description:
        "Light armor made from tanned animal hides. Provides basic protection.",
      bonusStrength: 1,
      bonusAgility: 5,
      bonusIntelligence: 0,
      bonusFaith: 0,
    },
    {
      name: "Plate Armor",
      description:
        "Heavy armor made of interlocking metal plates. Excellent protection but reduces mobility.",
      bonusStrength: 8,
      bonusAgility: -5,
      bonusIntelligence: 0,
      bonusFaith: 0,
    },
    {
      name: "Mage Robes",
      description:
        "Enchanted robes that enhance magical abilities while providing minimal physical protection.",
      bonusStrength: 0,
      bonusAgility: 2,
      bonusIntelligence: 10,
      bonusFaith: 2,
    },
    {
      name: "Cleric Vestments",
      description:
        "Holy garments that increase faith and provide protection against dark magic.",
      bonusStrength: 1,
      bonusAgility: 1,
      bonusIntelligence: 2,
      bonusFaith: 8,
    },
    {
      name: "Health Potion",
      description: "A magical potion that restores health when consumed.",
      bonusStrength: 0,
      bonusAgility: 0,
      bonusIntelligence: 0,
      bonusFaith: 0,
    },
    {
      name: "Mana Potion",
      description: "A blue potion that restores magical energy.",
      bonusStrength: 0,
      bonusAgility: 0,
      bonusIntelligence: 0,
      bonusFaith: 0,
    },
    {
      name: "Ring of Strength",
      description:
        "A magical ring that increases the wearer physical strength.",
      bonusStrength: 5,
      bonusAgility: 0,
      bonusIntelligence: 0,
      bonusFaith: 0,
    },
    {
      name: "Amulet of Wisdom",
      description:
        "An ancient amulet that enhances intelligence and magical insight.",
      bonusStrength: 0,
      bonusAgility: 0,
      bonusIntelligence: 8,
      bonusFaith: 2,
    },
    {
      name: "Boots of Swiftness",
      description:
        "Enchanted boots that greatly increase movement speed and agility.",
      bonusStrength: 0,
      bonusAgility: 10,
      bonusIntelligence: 0,
      bonusFaith: 0,
    },
    {
      name: "Holy Symbol",
      description:
        "A sacred symbol that strengthens faith and divine connection.",
      bonusStrength: 0,
      bonusAgility: 0,
      bonusIntelligence: 1,
      bonusFaith: 10,
    },
  ];

  for (const item of items) {
    const existingItem = await prisma.item.findUnique({
      where: { name: item.name },
    });

    if (!existingItem) {
      await prisma.item.create({
        data: item,
      });
    }
  }

  const warriorClass = await prisma.class.findUnique({
    where: { name: "Warrior" },
  });
  const mageClass = await prisma.class.findUnique({ where: { name: "Mage" } });

  if (warriorClass && mageClass) {
    const testCharacters = [
      {
        name: "Aragorn",
        health: 150,
        mana: 80,
        baseStrength: 15,
        baseAgility: 12,
        baseIntelligence: 8,
        baseFaith: 10,
        classId: warriorClass.id,
        createdBy: 1,
      },
      {
        name: "Gandalf",
        health: 120,
        mana: 200,
        baseStrength: 10,
        baseAgility: 8,
        baseIntelligence: 18,
        baseFaith: 15,
        classId: mageClass.id,
        createdBy: 1,
      },
      {
        name: "Mika",
        health: 120,
        mana: 200,
        baseStrength: 10,
        baseAgility: 8,
        baseIntelligence: 18,
        baseFaith: 15,
        classId: mageClass.id,
        createdBy: 2,
      },
      {
        name: "Pera",
        health: 120,
        mana: 200,
        baseStrength: 10,
        baseAgility: 8,
        baseIntelligence: 18,
        baseFaith: 15,
        classId: mageClass.id,
        createdBy: 2,
      },
      {
        name: "Zika",
        health: 120,
        mana: 200,
        baseStrength: 10,
        baseAgility: 8,
        baseIntelligence: 18,
        baseFaith: 15,
        classId: mageClass.id,
        createdBy: 3,
      },
      {
        name: "Lika",
        health: 120,
        mana: 200,
        baseStrength: 10,
        baseAgility: 8,
        baseIntelligence: 18,
        baseFaith: 15,
        classId: mageClass.id,
        createdBy: 4,
      },
      {
        name: "Laki",
        health: 120,
        mana: 200,
        baseStrength: 10,
        baseAgility: 8,
        baseIntelligence: 18,
        baseFaith: 15,
        classId: mageClass.id,
        createdBy: 5,
      },
      {
        name: "Jovan",
        health: 120,
        mana: 200,
        baseStrength: 10,
        baseAgility: 8,
        baseIntelligence: 18,
        baseFaith: 15,
        classId: mageClass.id,
        createdBy: 6,
      },
    ];

    for (const char of testCharacters) {
      const existingChar = await prisma.character.findUnique({
        where: { name: char.name },
      });

      if (!existingChar) {
        await prisma.character.create({
          data: char,
        });
      }
    }
  }

  const aragorn = await prisma.character.findUnique({
    where: { name: "Aragorn" },
  });
  const ironSword = await prisma.item.findUnique({
    where: { name: "Iron Sword" },
  });
  const plateArmor = await prisma.item.findUnique({
    where: { name: "Plate Armor" },
  });

  if (aragorn && ironSword) {
    await prisma.characterItem.upsert({
      where: {
        characterId_itemId: {
          characterId: aragorn.id,
          itemId: ironSword.id,
        },
      },
      update: {},
      create: {
        characterId: aragorn.id,
        itemId: ironSword.id,
        quantity: 1,
      },
    });
  }

  if (aragorn && plateArmor) {
    await prisma.characterItem.upsert({
      where: {
        characterId_itemId: {
          characterId: aragorn.id,
          itemId: plateArmor.id,
        },
      },
      update: {},
      create: {
        characterId: aragorn.id,
        itemId: plateArmor.id,
        quantity: 1,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
