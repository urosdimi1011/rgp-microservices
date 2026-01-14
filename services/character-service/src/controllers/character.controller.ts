import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../db/prisma';
import redis from '../config/redis';
export interface NotificationData {
  type: 'ITEM_TRANSFER' | 'DUEL_FINISHED';
  duelId: string;
  winnerId?: string;
  loserId?: string;
  itemId?: string;
  timestamp: Date;
}
const calculateCharacterStats = (character: any) => {
  const totalStrength = character.baseStrength + 
    character.items.reduce((sum: number, ci: any) => sum + ci.item.bonusStrength, 0);
  
  const totalAgility = character.baseAgility + 
    character.items.reduce((sum: number, ci: any) => sum + ci.item.bonusAgility, 0);
  
  const totalIntelligence = character.baseIntelligence + 
    character.items.reduce((sum: number, ci: any) => sum + ci.item.bonusIntelligence, 0);
  
  const totalFaith = character.baseFaith + 
    character.items.reduce((sum: number, ci: any) => sum + ci.item.bonusFaith, 0);

  return {
    totalStrength,
    totalAgility,
    totalIntelligence,
    totalFaith
  };
};

export const invalidateCharacterCache = async (characterId: number) => {
  const cacheKey = `character:${characterId}`;
  await redis.del(cacheKey);
  console.log(`[CACHE INVALIDATED] Character ${characterId}`);
};

export const getAllCharacters = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user as any;
    
    console.log(`[${new Date().toISOString()}] GameMaster ${user.userId} pristupa listi karaktera`);

    const characters = await prisma.character.findMany({
      select: {
        id: true,
        name: true,
        health: true,
        mana: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: characters,
      count: characters.length
    });
  } catch (error) {
    console.error('Greška pri dobavljanju karaktera:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getCharacterById = async (req: AuthRequest, res: Response) => {
  try {
    const characterId = parseInt(req.params.id);
    
    if (isNaN(characterId)) {
      return res.status(400).json({ error: 'Invalid character ID' });
    }

    const cacheKey = `character:${characterId}`;
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      const character = JSON.parse(cachedData);
    
      return res.json(character);
    }

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: { 
        class: true, 
        items: { 
          include: { 
            item: true 
          } 
        } 
      }
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const stats = calculateCharacterStats(character);

    const responseData = {
      ...character,
      stats
    };

    await redis.setex(cacheKey, 300, JSON.stringify(responseData));
    console.log(`[CACHE SET] Character ${characterId} cached for 5 minutes`);

    res.json(responseData);
  } catch (error) {
    console.error('Error getting character:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCharacter = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!; 

    const { name, classId, health, mana, baseStrength, baseAgility, baseIntelligence, baseFaith } = req.body;

    if (!name || !classId) {
      return res.status(400).json({ error: 'Name and classId are required' });
    }

    const classExists = await prisma.class.findUnique({ where: { id: classId } });
    if (!classExists) {
      return res.status(400).json({ error: 'Invalid classId' });
    }

    const character = await prisma.character.create({
      data: {
        name,
        classId,
        health: health || 100,
        mana: mana || 100,
        baseStrength: baseStrength || 10,
        baseAgility: baseAgility || 10,
        baseIntelligence: baseIntelligence || 10,
        baseFaith: baseFaith || 10,
        createdBy: user.userId 
      },
      include: { class: true }
    });

    console.log(`[${new Date().toISOString()}] User ${user.userId} created character ${character.id} (${character.name})`);
    
    res.status(201).json(character);
  } catch (error: any) {
    if (error.code === 'P2002') { 
      return res.status(409).json({ error: 'Character name already exists' });
    }
    console.error('Error creating character:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const handleCombatNotification = async (req: AuthRequest, res: Response) => {
  try {
    const notification: NotificationData = req.body;

    switch (notification.type) {
      case 'ITEM_TRANSFER':
        if (notification.winnerId && notification.loserId && notification.itemId) {
          console.log(`Item transfer: ${notification.itemId} from character ${notification.loserId} to ${notification.winnerId}`);
          await transferItemAfterDuel(
            notification.loserId,
            notification.winnerId,
            notification.itemId
          );
        }
        break;
        
      case 'DUEL_FINISHED':
        console.log(`Duel ${notification.duelId} finished`);
        break;
    }
    res.json({
      success: true,
      message: 'Notification processed',
      notification
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to process notification'
    });
  }
};

async function transferItemAfterDuel(fromCharacterId: string, toCharacterId: string, itemId: string) {
  try {
    const fromId = parseInt(fromCharacterId);
    const toId = parseInt(toCharacterId);
    const itemIdNum = parseInt(itemId);

    if (isNaN(fromId) || isNaN(toId) || isNaN(itemIdNum)) {
      console.warn('Invalid IDs in item transfer notification');
      return;
    }

    const characterItem = await prisma.characterItem.findFirst({
      where: {
        characterId: fromId,
        itemId: itemIdNum
      }
    });

    if (!characterItem) {
      console.warn(`Item ${itemId} not found on character ${fromId}`);
      return;
    }

    await prisma.characterItem.update({
      where: { id: characterItem.id },
      data: { characterId: toId }
    });

    await invalidateCharacterCache(fromId);
    await invalidateCharacterCache(toId);

    console.log(`✅ Item ${itemId} successfully transferred from character ${fromId} to ${toId}`);

  } catch (error) {
    console.error('Error transferring item after duel:', error);
  }
}

export const getUserCharacters = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);

    const characters = await prisma.character.findMany({
      where: { createdBy: userId },
      select: {
        id: true,
        name: true,
        health: true,
        mana: true,
        baseStrength: true,
        baseAgility: true,
        baseIntelligence: true,
        baseFaith: true,
        class: {
          select: {
            name: true,
            description: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: characters,
      count: characters.length
    });
    
  } catch (error: any) {
    console.error('Error getting user characters:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
export { calculateCharacterStats };