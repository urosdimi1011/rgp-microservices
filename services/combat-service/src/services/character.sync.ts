import axios from "axios";
import prisma from "../db/prisma";

const CHARACTER_SERVICE_URL =
  process.env.CHARACTER_SERVICE_URL || "http://localhost:3000⁠";
let currentToken: string | null = null;

export const setCurrentToken = (token: string) => {
  currentToken = token;
};
export const clearCurrentToken = () => {
  currentToken = null;
};

export const getUserCharacters = async (
  userId: string,
  token?: string
): Promise<any[]> => {
  try {
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
      console.log(
        `Found ${response.data.data.length} characters for user ${userId}`
      );
      return response.data.data;
    }

    console.warn(`No characters found for user ${userId} or invalid response`);
    return [];
  } catch (error) {
    console.error(`Error getting characters for user ${userId}:`, error);
    return [];
  }
};

export const getAuthHeaders = (token?: string): Record<string, string> => {
  const tokenToUse = token || currentToken;
    console.log("Using token for auth headers:", tokenToUse);
  if (!tokenToUse) {
    console.warn("No token available for auth headers");
    return {};
  }

  return {
    Authorization: `Bearer ${tokenToUse}`,
    "Content-Type": "application/json",
  };
};

export const syncAllCharacters = async (token?: string): Promise<number> => {
  try {
    if (!token) {
      console.log("Background sync (no token - mock mode)");
      return 0;
    }
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

    let syncedCount = 0;
    for (const characterId of characterIds) {
      try {
        await syncCharacter(characterId, token);
        syncedCount++;
      } catch (error) {
        console.warn(`Failed to sync character ${characterId}:`, error);
      }
    }

    console.info(`Synced ${syncedCount} characters from active duels`);
    return syncedCount;
  } catch (error: any) {
    console.error("Error syncing all characters:", error.message);
    return 0;
  }
};

export const syncCharacter = async (
  characterId: string,
  token?: string
): Promise<any> => {
  try {
    if (!token) {
      console.log(`[MOCK SYNC] Character ${characterId}`);
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

    console.log(`Syncing character ${characterId} from Character Service`);
    const response = await axios.get(
      `${CHARACTER_SERVICE_URL}/api/character/${characterId}`,
      {
        headers: getAuthHeaders(token),
      }
    );
    if (response.data) {
      const characterData = response.data.data;
      return characterData;
    }
    throw new Error("Failed to sync character");
  } catch (error: any) {
    if (error.response?.status === 401) {
      clearCurrentToken();
      throw new Error("Authentication failed. Please login again.");
    }
    throw new Error(`Failed to sync character: ${error.message}`);
  }
};

export const getCharacterWithItems = async (
  characterId: string,
  token?: string
): Promise<any> => {
  try {
    const response = await axios.get(
      `${CHARACTER_SERVICE_URL}/api/character/${characterId}`,
      {
        headers: getAuthHeaders(token || String(currentToken)),
      }
    );

    if (response.data.success) {
      return response.data.data;
    }

    throw new Error("Character not found");
  } catch (error: any) {
    console.error(`Error getting character ${characterId}:`, error.message);

    const localCharacter = await getLocalCharacter(characterId);
    if (localCharacter) {
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
    // Ovo je malo komplikovano jer Character Service možda nema direktan endpoint za update health
    // U realnoj aplikaciji, možda imaš neku notifikaciju ili event sistem
    // Za sada, samo log-ujemo

    console.log(`Character ${characterId} health updated to ${newHealth}`);

    await axios.put(
      `${CHARACTER_SERVICE_URL}/api/character/${characterId}/health`,
      {
        health: newHealth,
      },
      {
        headers: getAuthHeaders(),
      }
    );
  } catch (error: any) {
    console.error(
      `Error updating health for character ${characterId}:`,
      error.message
    );
  }
};

export const transferItemBetweenCharacters = async (
  fromCharacterId: string,
  toCharacterId: string,
  itemId: string
): Promise<any> => {
  try {
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
      console.log(
        `Transferred item ${itemId} from ${fromCharacterId} to ${toCharacterId}`
      );
      return response.data.data;
    }

    throw new Error("Failed to transfer item");
  } catch (error: any) {
    console.error(`Error transferring item ${itemId}:`, error.message);
    throw new Error(`Failed to transfer item: ${error.message}`);
  }
};

export const getCharacterOwner = async (
  characterId: string
): Promise<string> => {
  try {
    const character = await getCharacterWithItems(characterId);
    return character.createdBy;
  } catch (error: any) {
    console.error(
      `Error getting owner for character ${characterId}:`,
      error.message
    );
    throw new Error(`Failed to get character owner: ${error.message}`);
  }
};

export const getRandomItemFromCharacter = async (
  characterId: string
): Promise<any> => {
  try {
    const character = await getCharacterWithItems(characterId);

    if (!character.items || character.items.length === 0) {
      return null;
    }

    // Izaberi random item
    const randomIndex = Math.floor(Math.random() * character.items.length);
    return character.items[randomIndex];
  } catch (error: any) {
    console.error(
      `Error getting random item from character ${characterId}:`,
      error.message
    );
    return null;
  }
};

// Helper funkcije za lokalno čuvanje karaktera
async function getLocalCharacter(characterId: string): Promise<any | null> {
  // Ovo implementiraš kad dodaš Prisma model za Character u combat service
  // Za sada vraćamo null
  return null;
}

async function saveLocalCharacter(characterData: any): Promise<void> {
  // Ovo implementiraš kad dodaš Prisma model za Character u combat service
}

// Cache za karaktere (Redis ili memory cache)
const characterCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minuta

export const getCachedCharacter = async (
  characterId: string
): Promise<any | null> => {
  const cached = characterCache.get(characterId);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  return null;
};

export const cacheCharacter = (
  characterId: string,
  characterData: any
): void => {
  characterCache.set(characterId, {
    data: characterData,
    timestamp: Date.now(),
  });
};

export const invalidateCharacterCache = (characterId: string): void => {
  characterCache.delete(characterId);
};
