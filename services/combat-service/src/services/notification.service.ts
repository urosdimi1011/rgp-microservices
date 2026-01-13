import axios from 'axios';

const CHARACTER_SERVICE_URL = process.env.CHARACTER_SERVICE_URL || 'http://character-service:3001';

export interface NotificationData {
  type: 'ITEM_TRANSFER' | 'DUEL_FINISHED';
  duelId: string;
  winnerId?: string;
  loserId?: string;
  itemId?: string;
  timestamp: Date;
}

/**
 * Obaveštava Character Service o rezultatu duela
 */
export const notifyCharacterService = async (data: NotificationData): Promise<void> => {
  try {
    // Za sada samo log-ujemo jer možda Character Service nema notifikacioni endpoint
    console.info('📨 Notifying Character Service:', data);
    
    // U realnoj implementaciji bi izgledalo ovako:
    const response = await axios.post(
      `${CHARACTER_SERVICE_URL}/api/character/notifications/combat`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          // Dodaj JWT token ako je potreban
        }
      }
    );
    
    if (response.status !== 200) {
      throw new Error('Character Service notification failed');
    }
    
    // logger.info('✅ Character Service notified successfully');
    
  } catch (error: any) {
    console.error('❌ Failed to notify Character Service:', error.message);
    // Ne bacamo grešku dalje jer ne želimo da prekinemo duel zbog neuspele notifikacije
  }
};

/**
 * Specijalizovana funkcija za transfer itema
 */
export const notifyItemTransfer = async (
  duelId: string,
  winnerId: string,
  loserId: string,
  itemId: string
): Promise<void> => {
  await notifyCharacterService({
    type: 'ITEM_TRANSFER',
    duelId,
    winnerId,
    loserId,
    itemId,
    timestamp: new Date()
  });
};

/**
 * Funkcija za obaveštenje o završetku duela (draw)
 */
export const notifyDuelFinished = async (
  duelId: string
): Promise<void> => {
  await notifyCharacterService({
    type: 'DUEL_FINISHED',
    duelId,
    timestamp: new Date()
  });
};