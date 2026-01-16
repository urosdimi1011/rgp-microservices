import { Request, Response } from "express";
import prisma from "../db/prisma";
import {
  getCharacterWithItems,
  transferItemBetweenCharacters,
  getRandomItemFromCharacter,
  syncCharacter,
} from "./character.sync";
import { v4 as uuidv4 } from "uuid";
import { notifyCharacterService } from "./notification.service";
import { logger } from "../utils/logging"; 

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

    logger.info(`Duel ended as DRAW due to timeout`, { 
      duelId,
      duration: `${duelDuration}ms`,
      timeout: `${DUEL_TIMEOUT_MS}ms`
    });
    return true;
  }

  return false;
};

export const initiateDuel = async (
  challengerCharacterId: string,
  opponentCharacterId: string,
  token?: string
): Promise<any> => {
  try {
    checkDuelTimeouts();
    logger.info('Initiating duel', { 
      challengerCharacterId,
      opponentCharacterId,
      tokenAvailable: !!token
    });
    
    const challengerCharacter = await syncCharacter(challengerCharacterId, token);
    const opponentCharacter = await syncCharacter(opponentCharacterId, token);

    if (!challengerCharacter) {
      logger.error('Challenger character not found', { challengerCharacterId }); 
      throw new Error("Challenger character not found");
    }

    if (!opponentCharacter) {
      logger.error('Opponent character not found', { opponentCharacterId }); 
      throw new Error("Opponent character not found");
    }

    logger.debug('Characters loaded', { 
      challengerCharacterId,
      opponentCharacterId,
      challengerHealth: challengerCharacter.health,
      opponentHealth: opponentCharacter.health
    });

    const existingDuel = await prisma.duel.findFirst({
      where: {
        OR: [
          {
            challengerId: challengerCharacterId.toString(),
            status: { in: ["PENDING", "ACTIVE"] },
          },
          {
            opponentId: challengerCharacterId.toString(),
            status: { in: ["PENDING", "ACTIVE"] },
          },
          {
            challengerId: opponentCharacterId.toString(),
            status: { in: ["PENDING", "ACTIVE"] },
          },
          {
            opponentId: opponentCharacterId.toString(),
            status: { in: ["PENDING", "ACTIVE"] },
          },
        ],
      },
    });

    logger.debug('Existing duel check', { 
      existingDuel: !!existingDuel,
      duelId: existingDuel?.id
    });
    
    if (existingDuel) {
      logger.warn('Character already in a duel', {
        challengerCharacterId,
        opponentCharacterId,
        existingDuelId: existingDuel.id
      });
      throw new Error("One or both characters are already in a duel");
    }

    if (challengerCharacterId === opponentCharacterId) {
      logger.warn('Attempted self-duel', { 
        characterId: challengerCharacterId
      });
      throw new Error("Cannot duel against yourself");
    }

    const duel = await prisma.duel.create({
      data: {
        id: uuidv4(),
        challengerId: challengerCharacterId.toString(),
        opponentId: opponentCharacterId.toString(),
        status: "PENDING",
        startedAt: new Date(),
        challengerHealth: challengerCharacter.health,
        opponentHealth: opponentCharacter.health,
        currentTurn: challengerCharacterId.toString(),
        lastActionAt: new Date(),
        turnExpiresAt: new Date(Date.now() + TURN_TIMEOUT_MS),
      },
    });

    logger.info('Duel created successfully', {
      duelId: duel.id,
      challengerId: challengerCharacterId,
      opponentId: opponentCharacterId,
      status: duel.status,
      challengerHealth: duel.challengerHealth,
      opponentHealth: duel.opponentHealth
    });
    
    return duel;
  } catch (error: any) {
    logger.error('Failed to initiate duel', { 
      challengerCharacterId,
      opponentCharacterId,
      error: error.message,
      stack: error.stack
    });
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
  logger.info("truuuuuuuuuuuuu",{
    ...character
  });
  return (character.stats.totalStrength || 0) + (character.stats.totalAgility || 0);
};

const calculateSpellDamage = (character: any): number => {
  return 2 * (character.stats.totalIntelligence || 0);
};

const calculateHealAmount = (character: any): number => {
  return character.stats.totalFaith || 0;
};

export const performAttack = async (
  duelId: string,
  characterId: string,
    token : string
): Promise<DuelResult> => {
  return await performAction(duelId, characterId,token, "ATTACK");
};

export const performCast = async (
  duelId: string,
  characterId: string,
  token : string
): Promise<DuelResult> => {
  return await performAction(duelId, characterId,token, "CAST");
};

export const performHeal = async (
  duelId: string,
  characterId: string,
    token : string
): Promise<DuelResult> => {
  return await performAction(duelId, characterId,token, "HEAL");
};

const performAction = async (
  duelId: string,
  characterId: string,
  token :string,
  actionType: string
): Promise<DuelResult> => {
  logger.info('Performing duel action', {
    duelId,
    characterId,
    actionType
  });
  
  await checkDuelTimeout(duelId);

  const duel = await prisma.duel.findUnique({
    where: { id: duelId },
  });

  if (!duel) {
    logger.error('Duel not found', { duelId });
    throw new Error("Duel not found");
  }
  logger.debug('Duel action parameters', { 
    duelId,
    characterId,
    actionType,
    duelStatus: duel.status
  });
  
  if (duel.status !== "ACTIVE" && duel.status !== "PENDING") {
    logger.warn('Invalid duel status for action', {
      duelId,
      status: duel.status,
      characterId,
      actionType
    });
    throw new Error(`Duel is ${duel.status.toLowerCase()}`);
  }
  logger.debug('Character participation check', { 
    challengerId: duel.challengerId,
    characterId,
    opponentId: duel.opponentId
  });
  
  if (duel.challengerId.toString() !== characterId.toString() && duel.opponentId.toString() !== characterId.toString()) {
    logger.warn('Character not in duel', { 
      duelId,
      characterId,
      challengerId: duel.challengerId,
      opponentId: duel.opponentId
    });
    throw new Error("Character is not a participant in this duel");
  }

  if (duel.currentTurn !== characterId.toString()) {
    logger.warn('Not character\'s turn', { 
      duelId,
      characterId,
      currentTurn: duel.currentTurn
    });
    throw new Error("Not your turn");
  }

  if (duel.turnExpiresAt && new Date() > duel.turnExpiresAt) {
    const nextTurn =
      duel.challengerId.toString() === characterId.toString() ? duel.opponentId : duel.challengerId;
    await prisma.duel.update({
      where: { id: duelId },
      data: {
        currentTurn: nextTurn,
        turnExpiresAt: new Date(Date.now() + TURN_TIMEOUT_MS),
      },
    });
    logger.info('Turn expired, switching to next player', { 
      duelId,
      previousTurn: characterId,
      nextTurn,
      turnExpiredAt: duel.turnExpiresAt
    });
    throw new Error("Turn has expired. Next player's turn.");
  }

  if (!canPerformAction(duel.lastActionAt, actionType)) {
    logger.warn('Action on cooldown', { 
      duelId,
      characterId,
      actionType,
      lastActionAt: duel.lastActionAt
    });
    throw new Error("Action is on cooldown");
  }

  if (duel.status === "PENDING") {
    await prisma.duel.update({
      where: { id: duelId },
      data: { status: "ACTIVE" },
    });
    logger.info('Duel activated from PENDING', { duelId });
  }

  const targetCharacterId =
    duel.challengerId.toString() === characterId.toString() ? duel.opponentId : duel.challengerId;

  logger.debug('Fetching character data', {
    characterId,
    targetCharacterId
  });
  
  const character = await getCharacterWithItems(characterId,token);
  const targetCharacter = await getCharacterWithItems(targetCharacterId,token);

  logger.info(character,targetCharacter);

  if (!character || !targetCharacter) {
    logger.error('Character data not found', {
      characterId,
      targetCharacterId,
      characterFound: !!character,
      targetFound: !!targetCharacter
    });
    throw new Error("Character data not found");
  }

  let damage = 0;
  let healAmount = 0;
  let newChallengerHealth = duel.challengerHealth;
  let newOpponentHealth = duel.opponentHealth;

  switch (actionType) {
    case "ATTACK":
      damage = calculateAttackDamage(character);
      logger.debug('Attack damage calculated', {
        characterId,
        damage,
        strength: character.strength,
        agility: character.agility
      });
      if (duel.challengerId.toString() === characterId.toString()) {
        newOpponentHealth = Math.max(0, duel.opponentHealth - damage);
      } else {
        newChallengerHealth = Math.max(0, duel.challengerHealth - damage);
      }
      break;

    case "CAST":
      damage = calculateSpellDamage(character);
      logger.debug('Spell damage calculated', { 
        characterId,
        damage,
        intelligence: character.intelligence
      });
      if (duel.challengerId.toString() === characterId.toString()) {
        newOpponentHealth = Math.max(0, duel.opponentHealth - damage);
      } else {
        newChallengerHealth = Math.max(0, duel.challengerHealth - damage);
      }
      break;

    case "HEAL":
      healAmount = calculateHealAmount(character);
      logger.debug('Heal amount calculated', { 
        characterId,
        healAmount,
        faith: character.faith
      });
      if (duel.challengerId.toString() === characterId.toString()) {
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

  logger.info('Action effects calculated', {
    duelId,
    actionType,
    damage,
    healAmount,
    newChallengerHealth,
    newOpponentHealth
  });

  const action = await prisma.duelAction.create({
    data: {
      id: uuidv4(),
      duelId,
      characterId: characterId.toString(),
      action: actionType,
      damage: damage > 0 ? damage : null,
      heal: healAmount > 0 ? healAmount : null,
      timestamp: new Date(),
    },
  });

  let isFinished = false;
  let winner = undefined;
  let loser = undefined;
  let finalStatus = duel.status;

  if (newChallengerHealth <= 0 || newOpponentHealth <= 0) {
    isFinished = true;
    finalStatus = "FINISHED";

    if (newChallengerHealth <= 0 && newOpponentHealth <= 0) {
      winner = null;
      logger.info('Duel ended in DRAW (both characters at 0 health)', { 
        duelId,
        challengerHealth: newChallengerHealth,
        opponentHealth: newOpponentHealth
      });
    } else if (newChallengerHealth <= 0) {
      winner = duel.opponentId;
      loser = duel.challengerId;
      logger.info('Duel finished - opponent won', {
        duelId,
        winner: duel.opponentId,
        loser: duel.challengerId,
        challengerHealth: newChallengerHealth,
        opponentHealth: newOpponentHealth
      });
    } else {
      winner = duel.challengerId;
      loser = duel.opponentId;
      logger.info('Duel finished - challenger won', {
        duelId,
        winner: duel.challengerId,
        loser: duel.opponentId,
        challengerHealth: newChallengerHealth,
        opponentHealth: newOpponentHealth
      });
    }

    if (winner && loser) {
      try {
        const itemToTransfer = await getRandomItemFromCharacter(loser);
        if (itemToTransfer) {
          logger.info('Attempting item transfer after duel', {
            duelId,
            winner,
            loser,
            itemId: itemToTransfer.id
          });
          
          await transferItemBetweenCharacters(loser, winner, itemToTransfer.itemId);
          await notifyCharacterService({
            type: "ITEM_TRANSFER",
            duelId: duelId,
            winnerId: winner,
            loserId: loser,
            itemId: itemToTransfer.itemId,
            timestamp: new Date(),
          });
          
          logger.info('Item transfer completed', { 
            duelId,
            winner,
            loser,
            itemId: itemToTransfer.id,
            itemName: itemToTransfer.name
          });
        } else {
          logger.debug('No items to transfer from loser', {
            duelId,
            loser
          });
        }
      } catch (error: any) {
        logger.error('Failed to transfer item after duel', {
          duelId,
          winner,
          loser,
          error: error.message
        });
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
        : duel.challengerId.toString() === characterId.toString()
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

  logger.info('Duel action completed', {
    duelId,
    actionType,
    isFinished,
    winner,
    newChallengerHealth,
    newOpponentHealth,
    damage,
    healAmount
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
  logger.debug('Getting duel by ID', { duelId, userId });
  
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
    logger.warn('Duel not found', { duelId }); 
    throw new Error("Duel not found");
  }

  const isParticipant =
    duel.challengerId === userId || duel.opponentId === userId;

  if (!isParticipant && userId !== "GameMaster") {
    logger.warn('Unauthorized duel access attempt', { 
      duelId,
      userId,
      challengerId: duel.challengerId,
      opponentId: duel.opponentId
    });
    throw new Error("Not authorized to view this duel");
  }

  logger.debug('Duel retrieved successfully', { 
    duelId,
    userId,
    actionCount: duel.actions?.length || 0
  });
  
  return duel;
};

export const getUserDuels = async (userId: string): Promise<any[]> => {
  logger.debug('Getting user duels', { userId });
  
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

  logger.info('User duels retrieved', { 
    userId,
    duelCount: duels.length
  });
  
  return duels;
};

export const checkDuelTimeouts = async () => {
  const now = new Date();
  
  logger.debug('Checking duel timeouts'); 

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

    logger.info('Duel timed out and ended as DRAW', { 
      duelId: duel.id,
      startedAt: duel.startedAt,
      timeoutDuration: `${DUEL_TIMEOUT_MS}ms`
    });
  }

  return timedOutDuels.length;
};

setInterval(async () => {
  try {
    const count = await checkDuelTimeouts();
    if (count > 0) {
      logger.info('Duel timeout check completed', { 
        timedOutDuels: count,
        interval: '60s'
      });
    }
  } catch (error: any) {
    logger.error('Error in duel timeout check interval', { 
      error: error.message,
      stack: error.stack
    });
  }
}, 60000);