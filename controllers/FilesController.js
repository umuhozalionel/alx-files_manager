const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const mime = require('mime-types');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class FilesController {
  // Existing methods: postUpload, getShow, getIndex, putPublish, putUnpublish

  static async getFile(req, res) {
    try {
      const token = req.headers['x-token'];
      console.log(`Received request with token: ${token}`);

      const fileId = req.params.id;
      const filesCollection = dbClient.db.collection('files');
      const file = await filesCollection.findOne({ _id: ObjectId(fileId) });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (!file.isPublic) {
        if (!token) {
          return res.status(404).json({ error: 'Not found' });
        }

        const userId = await redisClient.get(`auth_${token}`);
        if (!userId || file.userId !== userId) {
          return res.status(404).json({ error: 'Not found' });
        }
      }

      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      if (!fs.existsSync(file.localPath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      const mimeType = mime.lookup(file.name);
      res.setHeader('Content-Type', mimeType);
      const fileContent = fs.readFileSync(file.localPath);
      return res.status(200).send(fileContent);
    } catch (error) {
      console.error('Error retrieving file content:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = FilesController;
