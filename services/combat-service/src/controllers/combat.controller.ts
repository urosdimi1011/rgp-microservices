import { Request, Response } from 'express';
import { 
  initiateDuel,
  performAttack,
  performCast,
  performHeal,
  getDuelById,
  getUserDuels,
  checkDuelTimeout
} from '../services/combat.service';
import { syncCharacter, setCurrentToken } from '../services/character.sync';
import { logger } from '../utils/logging';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    username: string;
    token?: string;
  };
}

export const challengeCharacter = async (req: AuthRequest, res: Response) => {
  try {
    const { challengerCharacterId, opponentCharacterId } = req.body;
    const userId = req.user!.userId;
    const token = req.user!.token;

    if (!challengerCharacterId || !opponentCharacterId) {
      return res.status(400).json({
        success: false,
        error: 'Both challenger and opponent character IDs are required'
      });
    }

    if (token) {
      setCurrentToken(token);
    }

    const challengerChar = await syncCharacter(challengerCharacterId, token);
    const opponentChar = await syncCharacter(opponentCharacterId, token);

    if (challengerChar.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only initiate duels with your own characters'
      });
    }

    const duel = await initiateDuel(challengerCharacterId, opponentCharacterId, token);
    
    logger.info(`Duel initiated: ${duel.id} between characters ${challengerCharacterId} and ${opponentCharacterId}`);
    
    res.status(201).json({
      success: true,
      data: duel,
      message: 'Duel challenge sent'
    });
  } catch (error: any) {
    logger.error('Challenge error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to initiate duel'
    });
  }
};

export const getDuelStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { duelId } = req.params;
    const duel = await getDuelById(duelId, req.user!.userId);

    await checkDuelTimeout(duelId);
    
    res.json({
      success: true,
      data: duel
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message || 'Duel not found'
    });
  }
};

export const attackAction = async (req: AuthRequest, res: Response) => {
  try {
    const { duelId } = req.params;
    const characterId = req.body.characterId;
        const token = String(req.user!.token);

    const result = await performAttack(duelId, characterId,token);
    
    logger.info(`Attack performed in duel ${duelId} by ${characterId}`);
    
    res.json({
      success: true,
      data: result,
      message: 'Attack successful'
    });
  } catch (error: any) {
    console.error('Attack error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Attack failed'
    });
  }
};

export const castAction = async (req: AuthRequest, res: Response) => {
  try {
    const { duelId } = req.params;
    const characterId = req.body.characterId;
    const token = String(req.user!.token);

    const result = await performCast(duelId, characterId,token);
    
    logger.info(`Cast performed in duel ${duelId} by ${characterId}`);
    
    res.json({
      success: true,
      data: result,
      message: 'Cast successful'
    });
  } catch (error: any) {
    console.error('Cast error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Cast failed'
    });
  }
};

export const healAction = async (req: AuthRequest, res: Response) => {
  try {
    const { duelId } = req.params;
    const characterId = req.body.characterId;
   const token = String(req.user!.token);
    const result = await performHeal(duelId, characterId,token);
    
    logger.info(`Heal performed in duel ${duelId} by ${characterId}`);
    
    res.json({
      success: true,
      data: result,
      message: 'Heal successful'
    });
  } catch (error: any) {
    console.error('Heal error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Heal failed'
    });
  }
};

export const getDuelHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const duels = await getUserDuels(userId);
    
    res.json({
      success: true,
      data: duels,
      count: duels.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch duel history'
    });
  }
};

// export const handleCharacterRegistration = async (req: AuthRequest, res: Response) => {
//   try {
//     const { characterId, characterData } = req.body;
    
//     console.log(`🔄 Syncing newly registered character: ${characterId}`);
    
//     // Snimi karakter lokalno
//     await saveLocalCharacter(characterData);
    
//     res.json({
//       success: true,
//       message: `Character ${characterId} synced successfully`
//     });
//   } catch (error) {
//     console.error('Error syncing character:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to sync character'
//     });
//   }
// };