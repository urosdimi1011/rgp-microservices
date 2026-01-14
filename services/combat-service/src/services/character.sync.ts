import axios from "axios";
import prisma from "../db/prisma";
import { logger } from "../utils/logging";

const CHARACTER_SERVICE_URL =
  process.env.CHARACTER_SERVICE_URL || "http://localhost:3000⁠";
let currentToken: string | null = null;

export const setCurrentToken = (token: string) => {
  currentToken = token;
  logger.debug("Current token set", {
    tokenLength: token?.length || 0,
    tokenPrefix: token?.substring(0, 10) + "...",
  });
};

export const clearCurrentToken = () => {
  logger.debug("Current token cleared");
  currentToken = null;
};

export const getUserCharacters = async (
  userId: string,
  token?: string
): Promise<any[]> => {
  try {
    logger.info("Fetching user characters", {
      userId,
      tokenAvailable: !!token,
      serviceUrl: CHARACTER_SERVICE_URL,
    });

    const response = await axios.get(
      `${CHARACTER_SERVICE_URL}/api/character/user/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );

    if (response.data.success && response.data.data) {
      logger.info("User characters retrieved successfully", {
        userId,
        characterCount: response.data.data.length,
        responseStatus: response.status,
      });
      return response.data.data;
    }

    logger.warn("No characters found or invalid response", {
      userId,
      responseData: response.data,
    });
    return [];
  } catch (error: any) {
    logger.error("Failed to get user characters", {
      userId,
      error: error.message,
      statusCode: error.response?.status,
      serviceUrl: CHARACTER_SERVICE_URL,
    });
    return [];
  }
};

export const getAuthHeaders = (token?: string): Record<string, string> => {
  const tokenToUse = token || currentToken;
  if (!tokenToUse) {
    logger.warn("No token available for auth headers");
    return {};
  }

  logger.debug("Generated auth headers", {
    tokenLength: tokenToUse.length,
    tokenPrefix: tokenToUse.substring(0, 10) + "...",
  });

  return {
    "Authorization": `Bearer ${tokenToUse}`,
    "Content-Type": "application/json",
    "x-service-key": String(process.env.SERVICE_SECRET_KEY),
  };
};

export const syncAllCharacters = async (token?: string): Promise<number> => {
  try {
    if (!token) {
      logger.info("Background sync in mock mode (no token)");
      return 0;
    }

    logger.info("Starting sync of all characters from active duels");

    const activeDuels = await prisma.duel.findMany({
      where: {
        OR: [{ status: "ACTIVE" }, { status: "PENDING" }],
      },
      select: {
        challengerId: true,
        opponentId: true,
      },
    });

    const characterIds = new Set<string>();
    activeDuels.forEach((duel: any) => {
      characterIds.add(duel.challengerId);
      characterIds.add(duel.opponentId);
    });

    logger.debug("Found characters to sync", {
      duelCount: activeDuels.length,
      characterCount: characterIds.size,
      characterIds: Array.from(characterIds),
    });

    let syncedCount = 0;
    for (const characterId of characterIds) {
      try {
        await syncCharacter(characterId, token);
        syncedCount++;
        logger.debug("Character synced successfully", { characterId });
      } catch (error: any) {
        logger.warn("Failed to sync character", {
          characterId,
          error: error.message,
        });
      }
    }

    logger.info("Character sync completed", {
      syncedCount,
      totalCharacters: characterIds.size,
    });
    return syncedCount;
  } catch (error: any) {
    logger.error("Error syncing all characters", {
      error: error.message,
      stack: error.stack,
    });
    return 0;
  }
};

export const syncCharacter = async (
  characterId: string,
  token?: string
): Promise<any> => {
  try {
    if (!token) {
      logger.debug("Mock sync for character", { characterId });
      return {
        id: characterId,
        name: `Character-${characterId.substring(0, 8)}`,
        health: 100,
        mana: 100,
        strength: 10,
        agility: 10,
        intelligence: 10,
        faith: 10,
        items: [],
      };
    }

    logger.info("Syncing character from Character Service", {
      characterId,
      serviceUrl: CHARACTER_SERVICE_URL,
      serviceKey: process.env.SERVICE_SECRET_KEY,
    });

    const response = await axios.get(
      `${CHARACTER_SERVICE_URL}/api/character/internal/${characterId}`,
      {
        headers: {
          "x-service-key": process.env.SERVICE_SECRET_KEY,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data) {
      const characterData = response.data;
      logger.debug("Character sync successful", {
        characterId,
        characterName: characterData.name,
        responseStatus: response.status,
      });

      cacheCharacter(characterId, characterData);

      return characterData;
    }

    throw new Error("Failed to sync character - no data in response");
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      logger.error(
        "Authentication/Authorization failed during character sync",
        {
          characterId,
          statusCode: error.response?.status,
          error: error.message,
        }
      );
      throw new Error(`Failed to sync character: ${error.message}`);
    }

    logger.error("Failed to sync character", {
      characterId,
      error: error.message,
      statusCode: error.response?.status,
      serviceUrl: CHARACTER_SERVICE_URL,
    });

    throw new Error(`Failed to sync character: ${error.message}`);
  }
};

export const getCharacterWithItems = async (
  characterId: string,
  token?: string
): Promise<any> => {
  try {
    const cachedCharacter = await getCachedCharacter(characterId);
    if (cachedCharacter) {
      logger.debug("Retrieved character from cache", {
        characterId,
        cacheHit: true,
      });
      return cachedCharacter;
    }

    logger.info("Fetching character with items", {
      characterId,
      tokenAvailable: token,
      currentTokenAvailable: currentToken,
    });

    const response = await axios.get(
      `${CHARACTER_SERVICE_URL}/api/character/internal/${characterId}`,
      {
        
        headers: getAuthHeaders(token || String(currentToken)),
        
      }
    );

    if (response.data) {
      logger.debug("Character retrieved successfully", {
        characterId,
        responseStatus: response.status,
        hasData: !!response.data.data,
      });

      cacheCharacter(characterId, response.data.data || response.data);

      return response.data.data || response.data;
    }

    logger.warn("Character not found in response", {
      characterId,
      responseData: response.data,
    });
    throw new Error("Character not found");
  } catch (error: any) {
    logger.error("Failed to get character with items", {
      characterId,
      error: error.message,
      statusCode: error.response?.status,
      serviceUrl: CHARACTER_SERVICE_URL,
    });

    const localCharacter = await getLocalCharacter(characterId);
    if (localCharacter) {
      logger.info("Fell back to local character data", { characterId });
      return localCharacter;
    }

    throw new Error(`Character ${characterId} not found: ${error.message}`);
  }
};

export const updateCharacterHealth = async (
  characterId: string,
  newHealth: number
): Promise<void> => {
  try {
    logger.info("Updating character health", {
      characterId,
      newHealth,
      previousHealth: null, // Dodaj ako imaš
    });

    await axios.put(
      `${CHARACTER_SERVICE_URL}/api/character/${characterId}/health`,
      {
        health: newHealth,
      },
      {
        headers: getAuthHeaders(),
      }
    );

    logger.info("Character health updated successfully", {
      characterId,
      newHealth,
      serviceUrl: CHARACTER_SERVICE_URL,
    });

    // Invalidate cache
    invalidateCharacterCache(characterId);
  } catch (error: any) {
    logger.error("Failed to update character health", {
      characterId,
      newHealth,
      error: error.message,
      statusCode: error.response?.status,
    });
  }
};

export const transferItemBetweenCharacters = async (
  fromCharacterId: string,
  toCharacterId: string,
  itemId: string
): Promise<any> => {
  try {
    logger.info("Transferring item between characters", {
      fromCharacterId,
      toCharacterId,
      itemId,
      serviceUrl: CHARACTER_SERVICE_URL,
    });

    const response = await axios.post(
      `${CHARACTER_SERVICE_URL}/api/items/gift`,
      {
        fromCharacterId,
        toCharacterId,
        itemId,
      },
      {
        headers: getAuthHeaders(),
      }
    );

    if (response.data.success) {
      logger.info("Item transferred successfully", {
        fromCharacterId,
        toCharacterId,
        itemId,
        responseStatus: response.status,
      });
      return response.data.data;
    }

    logger.warn("Item transfer failed - unsuccessful response", {
      fromCharacterId,
      toCharacterId,
      itemId,
      responseData: response.data,
    });

    throw new Error("Failed to transfer item - unsuccessful response");
  } catch (error: any) {
    logger.error("Failed to transfer item", {
      fromCharacterId,
      toCharacterId,
      itemId,
      error: error.message,
      statusCode: error.response?.status,
    });
    throw new Error(`Failed to transfer item: ${error.message}`);
  }
};

export const getCharacterOwner = async (
  characterId: string
): Promise<string> => {
  try {
    logger.debug("Getting character owner", { characterId });

    const character = await getCharacterWithItems(characterId);
    const owner = character.createdBy;

    logger.debug("Character owner retrieved", {
      characterId,
      owner,
      characterName: character.name,
    });

    return owner;
  } catch (error: any) {
    logger.error("Failed to get character owner", {
      characterId,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to get character owner: ${error.message}`);
  }
};

export const getRandomItemFromCharacter = async (
  characterId: string
): Promise<any> => {
  try {
    logger.debug("Getting random item from character", { characterId });

    const character = await getCharacterWithItems(characterId);

    if (!character.items || character.items.length === 0) {
      logger.debug("Character has no items", { characterId });
      return null;
    }

    const randomIndex = Math.floor(Math.random() * character.items.length);
    const selectedItem = character.items[randomIndex];

    logger.debug("Random item selected", {
      characterId,
      itemCount: character.items.length,
      selectedItemId: selectedItem.id,
      selectedItemName: selectedItem.name,
    });

    return selectedItem;
  } catch (error: any) {
    logger.error("Failed to get random item from character", {
      characterId,
      error: error.message,
    });
    return null;
  }
};

async function getLocalCharacter(characterId: string): Promise<any | null> {
  logger.debug("Attempting to get local character (not implemented)", {
    characterId,
  });
  return null;
}

const characterCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export const getCachedCharacter = async (
  characterId: string
): Promise<any | null> => {
  const cached = characterCache.get(characterId);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug("Cache hit for character", {
      characterId,
      cacheAge: Date.now() - cached.timestamp,
    });
    return cached.data;
  }

  if (cached) {
    logger.debug("Cache expired for character", {
      characterId,
      cacheAge: Date.now() - cached.timestamp,
    });
  }

  return null;
};

export const cacheCharacter = (
  characterId: string,
  characterData: any
): void => {
  logger.debug("Caching character data", {
    characterId,
    hasData: !!characterData,
    cacheSize: characterCache.size,
  });

  characterCache.set(characterId, {
    data: characterData,
    timestamp: Date.now(),
  });
};

export const invalidateCharacterCache = (characterId: string): void => {
  logger.debug("Invalidating character cache", { characterId });
  characterCache.delete(characterId);
};

export const getCacheStats = (): any => {
  const stats = {
    size: characterCache.size,
    keys: Array.from(characterCache.keys()),
    entries: Array.from(characterCache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      hasData: !!value.data,
    })),
  };

  logger.debug("Cache statistics", stats);
  return stats;
};
