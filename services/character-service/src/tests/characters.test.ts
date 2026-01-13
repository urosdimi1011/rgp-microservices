import request from 'supertest';
import app from '../index'; 

describe('Characters API', () => {
  let token: string; 

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'dimi', password: 'dimi1234' });
    token = res.body.token;
  });

  describe('GET /api/character', () => {
    it('should return all characters if user is a Game Master', async () => {
      const res = await request(app)
        .get('/api/character')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count');
    });
  });

  describe('GET /api/character/:id', () => {
    it('should return character details for valid ID', async () => {
      const characterId = 1;

      const res = await request(app)
        .get(`/api/character/${characterId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', characterId);
    });

    it('should return 404 for invalid character ID', async () => {
      const res = await request(app)
        .get('/api/character/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/character', () => {
    it('should create a new character', async () => {
      const newCharacter = {
        name: 'Hero',
        classId: 1, 
        health: 100,
        mana: 100,
        baseStrength: 10,
        baseAgility: 10,
        baseIntelligence: 10,
        baseFaith: 10,
      };

      const res = await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${token}`)
        .send(newCharacter);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(newCharacter.name);
    });
  });
});