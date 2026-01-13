import { checkDuelTimeouts } from './combat.service';
import { syncAllCharacters } from './character.sync';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minuta
const TIMEOUT_CHECK_INTERVAL_MS = 30 * 1000; // 30 sekundi
const INITIAL_SYNC_DELAY_MS = 10 * 1000; // 10 sekundi

export function startBackgroundJobs() {
 console.log('🚀 Starting combat background jobs');
  
 setInterval(async () => {
    try {
      const timedOutCount = await checkDuelTimeouts();
      if (timedOutCount > 0) {
        console.info(`⏰ Ended ${timedOutCount} duels due to timeout`);
      }
    } catch (error: any) {
      console.error('Timeout check failed:', error.message || error);
    }
  }, TIMEOUT_CHECK_INTERVAL_MS);

   setTimeout(async () => {
    try {
      console.info('Starting initial character sync...');
      await syncAllCharacters();
      console.info('✅ Initial character sync completed');
    } catch (error: any) {
      console.warn('Initial sync failed, will retry later:', error.message || error);
      setTimeout(async () => {
        try {
          await syncAllCharacters();
          console.info('✅ Retry character sync completed');
        } catch (retryError: any) {
          console.error('Retry sync also failed:', retryError.message || retryError);
        }
      }, 60000);
    }
  }, INITIAL_SYNC_DELAY_MS);
}