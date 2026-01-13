import { Request, Response } from "express";
import prisma from "../db/prisma";
import {
  getCharacterWithItems,
  updateCharacterHealth,
  transferItemBetweenCharacters,
  getRandomItemFromCharacter,
  syncCharacter,
  getUserCharacters,
} from "./character.sync";
import { v4 as uuidv4 } from "uuid";
import { notifyCharacterService } from "./notification.service";

const DUEL_TIMEOUT_MS = 5 * 60 * 1000;
const TURN_TIMEOUT_MS = 30 * 1000;
const ATTACK_COOLDOWN_MS = 1000;
const CAST_COOLDOWN_MS = 2000;
const HEAL_COOLDOWN_MS = 2000;

interface DuelResult {
  duel: any;
  action: any;
  damage?: number;
  healAmount?: number;
  newHealth: {
    challengerHealth: number;
    opponentHealth: number;
  };
  isFinished: boolean;
  winner?: string | null;
  loser?: string | null;
}

export const checkDuelTimeout = async (duelId: string): Promise<boolean> => {
  const duel = await prisma.duel.findUnique({
    where: { id: duelId },
  });

  if (!duel) return false;

  const now = new Date();
  const duelDuration = now.getTime() - duel.startedAt.getTime();

  if (duelDuration > DUEL_TIMEOUT_MS && duel.status === "ACTIVE") {
    await prisma.duel.update({
      where: { id: duelId },
      data: {
        status: "DRAW",
        finishedAt: now,
        winnerId: null,
        loserId: null,
      },
    });

    console.info(`🤝 Duel ${duelId} ended as DRAW (5min timeout)`);
    return true;
  }

  return false;
};

export const initiateDuel = async (
  challengerUserId: string,
  opponentCharacterId: string,
  token?: string
): Promise<any> => {
  try {
    const challengerCharacters = await getUserCharacters(
      challengerUserId,
      token
    );

    if (challengerCharacters.length === 0) {
      throw new Error("Challenger has no characters");
    }

    const challengerCharacterId = String(challengerCharacters[0].id);

    console.log(`Challenger Character ID: ${challengerCharacterId}`);
    await syncCharacter(challengerCharacterId, token);
    await syncCharacter(opponentCharacterId, token);

    const opponentCharacter = await getCharacterWithItems(
      opponentCharacterId,
      token
    );
    console.log(opponentCharacter);

    const opponentId = String(opponentCharacterId); 
    if (!opponentCharacter) {
      throw new Error("Opponent character not found");
    }

    const existingDuel = await prisma.duel.findFirst({
      where: {
        OR: [
          {
            challengerId: challengerCharacterId,
            status: { in: ["PENDING", "ACTIVE"] },
          },
          {
            opponentId: challengerCharacterId,
            status: { in: ["PENDING", "ACTIVE"] },
          },
          {
            challengerId: opponentId,
            status: { in: ["PENDING", "ACTIVE"] },
          },
          {
            opponentId: opponentId,
            status: { in: ["PENDING", "ACTIVE"] },
          },
        ],
      },
    });

    if (existingDuel) {
      throw new Error("One or both characters are already in a duel");
    }

    if (challengerCharacterId === opponentId) {
      throw new Error("Cannot duel against yourself");
    }

    const duel = await prisma.duel.create({
      data: {
        id: uuidv4(),
        challengerId: challengerCharacterId,
        opponentId: opponentId,
        status: "PENDING",
        startedAt: new Date(),
        challengerHealth: challengerCharacters[0].health,
        opponentHealth: opponentCharacter.health,
        currentTurn: challengerCharacterId,
        lastActionAt: new Date(),
        turnExpiresAt: new Date(Date.now() + TURN_TIMEOUT_MS),
      },
    });

    console.info(
      `Duel ${duel.id} created between ${challengerCharacterId} and ${opponentCharacterId}`
    );
    return duel;
  } catch (error: any) {
    console.error("Error initiating duel:", error);
    throw error;
  }
};

const canPerformAction = (
  lastActionAt: Date | null,
  actionType: string
): boolean => {
  if (!lastActionAt) return true;
  const now = new Date();
  const timeSinceLastAction = now.getTime() - lastActionAt.getTime();

  switch (actionType) {
    case "ATTACK":
      return timeSinceLastAction >= ATTACK_COOLDOWN_MS;
    case "CAST":
      return timeSinceLastAction >= CAST_COOLDOWN_MS;
    case "HEAL":
      return timeSinceLastAction >= HEAL_COOLDOWN_MS;
    default:
      return true;
  }
};

const calculateAttackDamage = (character: any): number => {
  return (character.strength || 0) + (character.agility || 0);
};

const calculateSpellDamage = (character: any): number => {
  return 2 * (character.intelligence || 0);
};

const calculateHealAmount = (character: any): number => {
  return character.faith || 0;
};

export const performAttack = async (
  duelId: string,
  characterId: string
): Promise<DuelResult> => {
  return await performAction(duelId, characterId, "ATTACK");
};

export const performCast = async (
  duelId: string,
  characterId: string
): Promise<DuelResult> => {
  return await performAction(duelId, characterId, "CAST");
};

export const performHeal = async (
  duelId: string,
  characterId: string
): Promise<DuelResult> => {
  return await performAction(duelId, characterId, "HEAL");
};

const performAction = async (
  duelId: string,
  characterId: string,
  actionType: string
): Promise<DuelResult> => {
  await checkDuelTimeout(duelId);

  const duel = await prisma.duel.findUnique({
    where: { id: duelId },
  });

  if (!duel) {
    throw new Error("Duel not found");
  }
  console.log(duelId, characterId, actionType);
  if (duel.status !== "ACTIVE" && duel.status !== "PENDING") {
    throw new Error(`Duel is ${duel.status.toLowerCase()}`);
  }

  if (duel.challengerId !== characterId && duel.opponentId !== characterId) {
    throw new Error("Character is not a participant in this duel");
  }

  if (duel.currentTurn !== characterId) {
    throw new Error("Not your turn");
  }

  if (duel.turnExpiresAt && new Date() > duel.turnExpiresAt) {
    const nextTurn =
      duel.challengerId === characterId ? duel.opponentId : duel.challengerId;
    await prisma.duel.update({
      where: { id: duelId },
      data: {
        currentTurn: nextTurn,
        turnExpiresAt: new Date(Date.now() + TURN_TIMEOUT_MS),
      },
    });
    throw new Error("Turn has expired. Next player's turn.");
  }

  if (!canPerformAction(duel.lastActionAt, actionType)) {
    throw new Error("Action is on cooldown");
  }

  if (duel.status === "PENDING") {
    await prisma.duel.update({
      where: { id: duelId },
      data: { status: "ACTIVE" },
    });
  }

  const targetCharacterId =
    duel.challengerId === characterId ? duel.opponentId : duel.challengerId;

  const character = await getCharacterWithItems(characterId);
  const targetCharacter = await getCharacterWithItems(targetCharacterId);

  if (!character || !targetCharacter) {
    throw new Error("Character data not found");
  }

  let damage = 0;
  let healAmount = 0;
  let newChallengerHealth = duel.challengerHealth;
  let newOpponentHealth = duel.opponentHealth;

  switch (actionType) {
    case "ATTACK":
      damage = calculateAttackDamage(character);
      if (duel.challengerId === characterId) {
        newOpponentHealth = Math.max(0, duel.opponentHealth - damage);
      } else {
        newChallengerHealth = Math.max(0, duel.challengerHealth - damage);
      }
      break;

    case "CAST":
      damage = calculateSpellDamage(character);
      if (duel.challengerId === characterId) {
        newOpponentHealth = Math.max(0, duel.opponentHealth - damage);
      } else {
        newChallengerHealth = Math.max(0, duel.challengerHealth - damage);
      }
      break;

    case "HEAL":
      healAmount = calculateHealAmount(character);
      if (duel.challengerId === characterId) {
        newChallengerHealth = Math.min(
          character.maxHealth || 100,
          duel.challengerHealth + healAmount
        );
      } else {
        newOpponentHealth = Math.min(
          targetCharacter.maxHealth || 100,
          duel.opponentHealth + healAmount
        );
      }
      break;
  }

  const action = await prisma.duelAction.create({
    data: {
      id: uuidv4(),
      duelId,
      characterId,
      action: actionType,
      damage: damage > 0 ? damage : null,
      heal: healAmount > 0 ? healAmount : null,
      timestamp: new Date(),
    },
  });

  if (actionType === "HEAL") {
    if (duel.challengerId === characterId) {
      await updateCharacterHealth(characterId, newChallengerHealth);
    } else {
      await updateCharacterHealth(targetCharacterId, newOpponentHealth);
    }
  } else {
    if (duel.challengerId === characterId) {
      await updateCharacterHealth(targetCharacterId, newOpponentHealth);
    } else {
      await updateCharacterHealth(characterId, newChallengerHealth);
    }
  }

  let isFinished = false;
  let winner = undefined;
  let loser = undefined;
  let finalStatus = duel.status;

  if (newChallengerHealth <= 0 || newOpponentHealth <= 0) {
    isFinished = true;
    finalStatus = "FINISHED";

    if (newChallengerHealth <= 0 && newOpponentHealth <= 0) {
      winner = null;
    } else if (newChallengerHealth <= 0) {
      winner = duel.opponentId;
      loser = duel.challengerId;
    } else {
      winner = duel.challengerId;
      loser = duel.opponentId;
    }

    if (winner && loser) {
      try {
        const itemToTransfer = await getRandomItemFromCharacter(loser);
        if (itemToTransfer) {
          await transferItemBetweenCharacters(loser, winner, itemToTransfer.id);
          await notifyCharacterService({
            type: "ITEM_TRANSFER",
            duelId: duelId,
            winnerId: winner,
            loserId: loser,
            itemId: itemToTransfer.id,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error("Error transferring item after duel:", error);
      }
    }
  }

  const updatedDuel = await prisma.duel.update({
    where: { id: duelId },
    data: {
      challengerHealth: newChallengerHealth,
      opponentHealth: newOpponentHealth,
      status: finalStatus,
      currentTurn: isFinished
        ? null
        : duel.challengerId === characterId
        ? duel.opponentId
        : duel.challengerId,
      lastActionAt: new Date(),
      turnExpiresAt: isFinished ? null : new Date(Date.now() + TURN_TIMEOUT_MS),
      finishedAt: isFinished ? new Date() : null,
      winnerId: winner,
      loserId: loser,
    },
    include: {
      actions: {
        orderBy: { timestamp: "desc" },
        take: 10,
      },
    },
  });

  return {
    duel: updatedDuel,
    action,
    damage: damage > 0 ? damage : undefined,
    healAmount: healAmount > 0 ? healAmount : undefined,
    newHealth: {
      challengerHealth: newChallengerHealth,
      opponentHealth: newOpponentHealth,
    },
    isFinished,
    winner,
    loser,
  };
};

export const getDuelById = async (
  duelId: string,
  userId: string
): Promise<any> => {
  const duel = await prisma.duel.findUnique({
    where: { id: duelId },
    include: {
      actions: {
        orderBy: { timestamp: "asc" },
        take: 50,
      },
    },
  });

  if (!duel) {
    throw new Error("Duel not found");
  }

  const isParticipant =
    duel.challengerId === userId || duel.opponentId === userId;

  if (!isParticipant && userId !== "GameMaster") {
    throw new Error("Not authorized to view this duel");
  }

  return duel;
};

export const getUserDuels = async (userId: string): Promise<any[]> => {
  const userCharacterIds = [userId];

  const duels = await prisma.duel.findMany({
    where: {
      OR: [
        { challengerId: { in: userCharacterIds } },
        { opponentId: { in: userCharacterIds } },
      ],
    },
    include: {
      actions: {
        orderBy: { timestamp: "desc" },
        take: 5,
      },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return duels;
};

export const checkDuelTimeouts = async () => {
  const now = new Date();

  const timedOutDuels = await prisma.duel.findMany({
    where: {
      status: "ACTIVE",
      startedAt: {
        lt: new Date(now.getTime() - DUEL_TIMEOUT_MS),
      },
    },
  });

  for (const duel of timedOutDuels) {
    await prisma.duel.update({
      where: { id: duel.id },
      data: {
        status: "DRAW",
        finishedAt: now,
      },
    });

    console.info(`🤝 Duel ${duel.id} ended as DRAW (5min timeout)`);
  }

  return timedOutDuels.length;
};

setInterval(async () => {
  try {
    const count = await checkDuelTimeouts();
    if (count > 0) {
      console.info(`Checked duel timeouts: ${count} duels ended as DRAW`);
    }
  } catch (error) {
    console.error("Error checking duel timeouts:", error);
  }
}, 60000);
