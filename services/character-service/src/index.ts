import express, { Request, Response } from 'express';

import dotenv from 'dotenv';
import characterRoutes from './routes/character.routes';
import itemRoutes from './routes/items.routes';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3002;

app.use('/api/character', characterRoutes);
app.use('/api/items', itemRoutes);

app.listen(PORT, () => {
  console.log(`Character Service running on port ${PORT}`);
  console.log(`Character API: http://localhost:${PORT}/api/character`);
  console.log(`Items API: http://localhost:${PORT}/api/items`);
});

export default app;