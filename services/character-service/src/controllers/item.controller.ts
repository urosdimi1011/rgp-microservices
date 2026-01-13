import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../db/prisma';
import redis from '../config/redis'

const invalidateCharacterCache = async (characterId: number) => {
  const cacheKey = `character:${characterId}`;
  await redis.del(cacheKey);
  console.log(`[CACHE INVALIDATED] Character ${characterId}`);
};

export const getAllItems = async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.item.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        bonusStrength: true,
        bonusAgility: true,
        bonusIntelligence: true,
        bonusFaith: true,
        createdAt: true,
        _count: {
          select: {
            characters: true
          }
        }
      }
    });

    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getItemById = async (req: AuthRequest, res: Response) => {
  try {
    const itemId = parseInt(req.params.id);

    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        characters: {
          include: {
            character: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const bonuses = {
      Strength: item.bonusStrength,
      Agility: item.bonusAgility,
      Intelligence: item.bonusIntelligence,
      Faith: item.bonusFaith
    };

    const highestBonus = Object.entries(bonuses)
      .sort(([, a], [, b]) => b - a)[0];

    const dynamicName = highestBonus[1] > 0 
      ? `${item.name} of ${highestBonus[0]}`
      : item.name;

    res.json({
      id: item.id,
      name: item.name,
      displayName: dynamicName,
      description: item.description,
      bonusStrength: item.bonusStrength,
      bonusAgility: item.bonusAgility,
      bonusIntelligence: item.bonusIntelligence,
      bonusFaith: item.bonusFaith,
      createdAt: item.createdAt,
      ownedBy: item.characters.map((ci: any) => ({
        characterId: ci.character.id,
        characterName: ci.character.name,
        quantity: ci.quantity
      }))
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createItem = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      description,
      bonusStrength,
      bonusAgility,
      bonusIntelligence,
      bonusFaith
    } = req.body;

    // Validacija
    if (!name || !description) {
      return res.status(400).json({ 
        error: 'Name and description are required' 
      });
    }

    // Kreiraj item
    const item = await prisma.item.create({
      data: {
        name,
        description,
        bonusStrength: bonusStrength || 0,
        bonusAgility: bonusAgility || 0,
        bonusIntelligence: bonusIntelligence || 0,
        bonusFaith: bonusFaith || 0
      }
    });

    console.log(`[${new Date().toISOString()}] GameMaster ${req.user!.userId} created item ${item.id}`);

    res.status(201).json(item);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Item with this name already exists' });
    }
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const grantItem = async (req: AuthRequest, res: Response) => {
  try {
    const { characterId, itemId, quantity } = req.body;

    if (!characterId || !itemId) {
      return res.status(400).json({ 
        error: 'characterId and itemId are required' 
      });
    }

    const parsedCharacterId = parseInt(characterId);
    const parsedItemId = parseInt(itemId);
    const parsedQuantity = quantity ? parseInt(quantity) : 1;

    if (isNaN(parsedCharacterId) || isNaN(parsedItemId) || isNaN(parsedQuantity)) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const character = await prisma.character.findUnique({
      where: { id: parsedCharacterId },
      select: { id: true, name: true }
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const item = await prisma.item.findUnique({
      where: { id: parsedItemId },
      select: { id: true, name: true }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const existing = await prisma.characterItem.findUnique({
      where: {
        characterId_itemId: {
          characterId: parsedCharacterId,
          itemId: parsedItemId
        }
      }
    });

    let characterItem;

    if (existing) {
      characterItem = await prisma.characterItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + parsedQuantity
        },
        include: {
          character: {
            select: { id: true, name: true }
          },
          item: {
            select: { id: true, name: true }
          }
        }
      });
    } else {
      characterItem = await prisma.characterItem.create({
        data: {
          characterId: parsedCharacterId,
          itemId: parsedItemId,
          quantity: parsedQuantity
        },
        include: {
          character: {
            select: { id: true, name: true }
          },
          item: {
            select: { id: true, name: true }
          }
        }
      });
    }

    await invalidateCharacterCache(parsedCharacterId);

    console.log(`[${new Date().toISOString()}] GameMaster ${req.user!.userId} granted ${parsedQuantity}x item ${parsedItemId} to character ${parsedCharacterId}`);

    res.status(201).json({
      message: 'Item granted successfully',
      character: characterItem.character,
      item: characterItem.item,
      quantity: characterItem.quantity
    });
  } catch (error) {
    console.error('Error granting item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const giftItem = async (req: AuthRequest, res: Response) => {
  try {
    const { fromCharacterId, toCharacterId, itemId, quantity } = req.body;

    // Validacija
    if (!fromCharacterId || !toCharacterId || !itemId) {
      return res.status(400).json({ 
        error: 'fromCharacterId, toCharacterId, and itemId are required' 
      });
    }

    const parsedFromCharacterId = parseInt(fromCharacterId);
    const parsedToCharacterId = parseInt(toCharacterId);
    const parsedItemId = parseInt(itemId);
    const parsedQuantity = quantity ? parseInt(quantity) : 1;

    if (
      isNaN(parsedFromCharacterId) || 
      isNaN(parsedToCharacterId) || 
      isNaN(parsedItemId) || 
      isNaN(parsedQuantity)
    ) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    if (parsedFromCharacterId === parsedToCharacterId) {
      return res.status(400).json({ error: 'Cannot gift to the same character' });
    }

    const fromCharacter = await prisma.character.findUnique({
      where: { id: parsedFromCharacterId },
      select: { id: true, name: true, createdBy: true }
    });

    if (!fromCharacter) {
      return res.status(404).json({ error: 'Source character not found' });
    }

    if (
      req.user!.role !== 'GameMaster' && 
      fromCharacter.createdBy !== req.user!.userId
    ) {
      return res.status(403).json({ 
        error: 'Forbidden: You can only gift items from your own characters' 
      });
    }

    const toCharacter = await prisma.character.findUnique({
      where: { id: parsedToCharacterId },
      select: { id: true, name: true }
    });

    if (!toCharacter) {
      return res.status(404).json({ error: 'Destination character not found' });
    }

    const sourceItem = await prisma.characterItem.findUnique({
      where: {
        characterId_itemId: {
          characterId: parsedFromCharacterId,
          itemId: parsedItemId
        }
      }
    });

    if (!sourceItem) {
      return res.status(404).json({ 
        error: 'Source character does not have this item' 
      });
    }

    if (sourceItem.quantity < parsedQuantity) {
      return res.status(400).json({ 
        error: `Source character only has ${sourceItem.quantity} of this item` 
      });
    }

    await prisma.$transaction(async (tx: any) => {
      if (sourceItem.quantity === parsedQuantity) {
        await tx.characterItem.delete({
          where: { id: sourceItem.id }
        });
      } else {
        await tx.characterItem.update({
          where: { id: sourceItem.id },
          data: {
            quantity: sourceItem.quantity - parsedQuantity
          }
        });
      }

      const destItem = await tx.characterItem.findUnique({
        where: {
          characterId_itemId: {
            characterId: parsedToCharacterId,
            itemId: parsedItemId
          }
        }
      });

      if (destItem) {
        await tx.characterItem.update({
          where: { id: destItem.id },
          data: {
            quantity: destItem.quantity + parsedQuantity
          }
        });
      } else {
        await tx.characterItem.create({
          data: {
            characterId: parsedToCharacterId,
            itemId: parsedItemId,
            quantity: parsedQuantity
          }
        });
      }
    });

    await invalidateCharacterCache(parsedFromCharacterId);
    await invalidateCharacterCache(parsedToCharacterId);

    console.log(`[${new Date().toISOString()}] User ${req.user!.userId} gifted ${parsedQuantity}x item ${parsedItemId} from character ${parsedFromCharacterId} to ${parsedToCharacterId}`);

    res.json({
      message: 'Item gifted successfully',
      from: fromCharacter.name,
      to: toCharacter.name,
      quantity: parsedQuantity
    });
  } catch (error) {
    console.error('Error gifting item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};