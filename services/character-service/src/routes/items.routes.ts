import { Router } from 'express';
import * as itemController from '../controllers/item.controller';
import { authenticate, requireGameMaster } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate,requireGameMaster, itemController.getAllItems);

router.get('/:id',authenticate, itemController.getItemById);

router.post('/', authenticate, itemController.createItem);

router.post('/grant', authenticate, itemController.grantItem);
router.post('/gift', authenticate, itemController.giftItem);

export default router;