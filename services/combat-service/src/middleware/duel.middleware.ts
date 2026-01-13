import { Response, NextFunction } from 'express';
import prisma from '../db/prisma';
import { AuthRequest } from './auth.middleware';
import { getCharacterOwner } from '../services/character.sync';

export const validateDuelParticipation = async (
  req: AuthRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const duelId = req.params.duel_id || req.params.duelId;
    const userId = req.user?.userId;

    if (!duelId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Duel ID and user authentication required'
      });
    }

    const duel = await prisma.duel.findUnique({
      where: { id: duelId }
    });

    if (!duel) {
      return res.status(404).json({
        success: false,
        error: 'Duel not found'
      });
    }

    if (duel.status !== 'ACTIVE' && duel.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: `Duel is ${duel.status.toLowerCase()}`
      });
    }

    const challengerOwner = await getCharacterOwner(duel.challengerId);
    const opponentOwner = await getCharacterOwner(duel.opponentId);

    const isChallengerOwner = parseInt(challengerOwner) === userId;
    const isOpponentOwner = parseInt(opponentOwner) === userId;

    if (!isChallengerOwner && !isOpponentOwner) {
      return res.status(403).json({
        success: false,
        error: 'You are not a participant in this duel'
      });
    }

    req.duel = duel;
    req.characterId = isChallengerOwner ? duel.challengerId : duel.opponentId;
    
    next();
  } catch (error: any) {
    console.error('Duel validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate duel participation'
    });
  }
};