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
    const { opponentCharacterId } = req.body;
    const challengerUserId = req.user!.userId;
    const token = req.user!.token;
    if (!opponentCharacterId) {
      return res.status(400).json({
        success: false,
        error: 'Opponent character ID is required'
      });
    }
    if (token) {
      setCurrentToken(token);
    }
    await syncCharacter(opponentCharacterId, token);    
    const duel = await initiateDuel(challengerUserId, opponentCharacterId,token);
    
    console.log(`Duel initiated: ${duel.id} between ${challengerUserId} and ${opponentCharacterId}`);
    
    res.status(201).json({
      success: true,
      data: duel,
      message: 'Duel challenge sent'
    });
  } catch (error: any) {
    console.error('Challenge error:', error);
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
    const characterId = req.user!.userId;
    
    const result = await performAttack(duelId, characterId);
    
    console.log(`Attack performed in duel ${duelId} by ${characterId}`);
    
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
    const characterId = req.user!.userId;
    
    const result = await performCast(duelId, characterId);
    
    console.log(`Cast performed in duel ${duelId} by ${characterId}`);
    
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
    const characterId = req.user!.userId;
    
    const result = await performHeal(duelId, characterId);
    
    console.log(`Heal performed in duel ${duelId} by ${characterId}`);
    
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