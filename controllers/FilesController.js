const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class FilesController {
  static async postUpload(req, res) {
    try {
      const token = req.headers['x-token'];
      console.log(`Received request with token: ${token}`);

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      console.log(`Resolved user ID from token: ${userId}`);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, type, parentId = 0, isPublic = false, data } = req.body;
      console.log(`Request body - name: ${name}, type: ${type}, parentId: ${parentId}, isPublic: ${isPublic}`);

      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }

      if (!['folder', 'file', 'image'].includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }

      if (type !== 'folder' && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      const filesCollection = dbClient.db.collection('files');
      if (parentId !== 0) {
        const parentFile = await filesCollection.findOne({ _id: ObjectId(parentId) });
        if (!parentFile) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      const fileDocument = {
        userId,
        name,
        type,
        isPublic,
        parentId,
      };

      if (type === 'folder') {
        await filesCollection.insertOne(fileDocument);
        return res.status(201).json(fileDocument);
      }

      const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(FOLDER_PATH)) {
        fs.mkdirSync(FOLDER_PATH, { recursive: true });
      }

      const localPath = `${FOLDER_PATH}/${uuidv4()}`;
      fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

      fileDocument.localPath = localPath;
      await filesCollection.insertOne(fileDocument);

      return res.status(201).json(fileDocument);
    } catch (error) {
      console.error('Error uploading file:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = FilesController;
