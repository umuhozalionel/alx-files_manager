const sha1 = require('sha1');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const { ObjectId } = require('mongodb');

class UsersController {
  static async postNew(req, res) {
    try {
      const { email, password } = req.body;
      console.log(`Received request to create user with email: ${email}`);

      if (!email) {
        console.log('Missing email');
        return res.status(400).json({ error: 'Missing email' });
      }

      if (!password) {
        console.log('Missing password');
        return res.status(400).json({ error: 'Missing password' });
      }

      const usersCollection = dbClient.db.collection('users');
      const userExists = await usersCollection.findOne({ email });
      if (userExists) {
        console.log('Email already exists');
        return res.status(400).json({ error: 'Already exist' });
      }

      const hashedPassword = sha1(password);
      const result = await usersCollection.insertOne({ email, password: hashedPassword });

      console.log('User created successfully');
      return res.status(201).json({ id: result.insertedId, email });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getMe(req, res) {
    try {
      const token = req.headers['x-token'];
      console.log(`Received request to get user info with token: ${token}`);

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const usersCollection = dbClient.db.collection('users');
      const user = await usersCollection.findOne({ _id: ObjectId(userId) });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      return res.status(200).json({ id: user._id, email: user.email });
    } catch (error) {
      console.error('Error retrieving user info:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = UsersController;
