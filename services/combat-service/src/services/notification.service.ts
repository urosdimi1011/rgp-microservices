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

export const notifyCharacterService = async (data: NotificationData): Promise<void> => {
  try {
    console.info('📨 Notifying Character Service:', data);
    
    const response = await axios.post(
      `${CHARACTER_SERVICE_URL}/api/character/notifications/combat`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (response.status !== 200) {
      throw new Error('Character Service notification failed');
    }
  } catch (error: any) {
    console.error('❌ Failed to notify Character Service:', error.message);
  }
};

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

export const notifyDuelFinished = async (
  duelId: string
): Promise<void> => {
  await notifyCharacterService({
    type: 'DUEL_FINISHED',
    duelId,
    timestamp: new Date()
  });
};