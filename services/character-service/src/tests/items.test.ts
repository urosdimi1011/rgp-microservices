import request from 'supertest';
import app from '../index'; 

describe('Items API', () => {
  let token: string; 

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'dimi', password: 'dimi1234' });
    token = res.body.token;
  });

  describe('GET /api/items', () => {
    it('should return all items if user is a Game Master', async () => {
      const res = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('length'); 
    });
  });

  describe('POST /api/items', () => {
    it('should create a new item', async () => {
      const newItem = {
        name: 'Magic Sword',
        description: 'A sword imbued with magical powers',
        bonusStrength: 5,
        bonusAgility: 3,
        bonusIntelligence: 0,
        bonusFaith: 0,
      };

      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .send(newItem);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(newItem.name);
    });
  });
});