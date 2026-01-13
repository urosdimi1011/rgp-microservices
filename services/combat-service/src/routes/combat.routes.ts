import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  challengeCharacter,
  getDuelStatus,
  attackAction,
  castAction,
  healAction,
  getDuelHistory
} from '../controllers/combat.controller';
import { validateDuelParticipation } from '../middleware/duel.middleware';
const router = Router();

router.post('/challenge', authenticate, challengeCharacter);

router.get('/:duelId', authenticate, getDuelStatus);

router.get('/user/history', authenticate, getDuelHistory);

router.post(
  '/:duelId/attack',
  authenticate,
  validateDuelParticipation,
  attackAction
);

router.post(
  '/:duelId/cast',
  authenticate,
  validateDuelParticipation,
  castAction
);

router.post(
  '/:duelId/heal',
  authenticate,
  validateDuelParticipation,
  healAction
);

export default router;