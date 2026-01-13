import express from 'express';
import dotenv from 'dotenv';
import  authRouter from './routes/auth.routes';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use('/api/auth', authRouter);


app.listen(PORT, () => {
  console.log(`🚀 Account Service running on port ${PORT}`);
});