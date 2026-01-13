import { Router } from "express";
import {
  authenticate,
  requireGameMaster,
  requireOwnerOrGameMaster,
} from "../middleware/auth.middleware";
import * as characterController from "../controllers/character.controller";
import prisma from "../db/prisma";
import { handleCombatNotification } from "../controllers/character.controller";

const router = Router();

router.get(
  "/",
  authenticate,
  requireGameMaster,
  characterController.getAllCharacters
);

router.get(
  "/:id",
  authenticate,
  requireOwnerOrGameMaster(async (req: any) => {
    const characterId = parseInt(req.params.id);
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { createdBy: true },
    });

    if (!character) {
      throw new Error("Character not found");
    }

    return character.createdBy;
  }),
  characterController.getCharacterById
);
router.post("/notifications/combat", handleCombatNotification);

router.post("/", authenticate, characterController.createCharacter);

router.get(
  "/user/:userId",
  authenticate,
  // requireOwnerOrGameMaster(async (req: any) => {
  //   const characterId = parseInt(req.params.id);
  //   const character = await prisma.character.findUnique({
  //     where: { id: characterId },
  //     select: { createdBy: true },
  //   });

  //   if (!character) {
  //     throw new Error("Character not found");
  //   }

  //   return character.createdBy;
  // }),
  characterController.getUserCharacters
);

export default router;
