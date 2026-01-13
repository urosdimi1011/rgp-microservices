import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import combatRoutes from './routes/combat.routes';
import { startBackgroundJobs } from './services/background.jobs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', combatRoutes);

app.listen(PORT, () => {
  console.log(`Combat Service running on port ${PORT}`);
  console.log(`Combat API: http://localhost:${PORT}/api`);
  
  startBackgroundJobs();
});

export default app;