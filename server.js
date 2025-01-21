// Add this to the top of your server.js
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Configure multer to handle binary data
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Configure CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Add your frontend URL
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Recognition endpoint
app.post('/api/recognize', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Received audio file:', {
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const host = 'identify-eu-west-1.acrcloud.com';
    const accessKey = process.env.ACR_ACCESS_KEY;
    const accessSecret = process.env.ACR_SECRET_KEY;
    const endpoint = '/v1/identify';
    const recordType = req.body.recordType || 'audio';
    
    const currentTime = Math.floor(Date.now() / 1000);
    
    const stringToSign = [
      'POST',
      endpoint,
      accessKey,
      'audio',  // record type should match 'audio' (use req.body.recordType or a fixed 'audio')
      '1',
      currentTime
    ].join('\n');
    
    const signature = crypto
      .createHmac('sha1', accessSecret)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest('base64');
    
    const formData = new FormData();
    formData.append('sample', req.file.buffer, {
      filename: req.file.originalname,  // Dynamically use the original filename from the frontend
      contentType: req.file.mimetype     // Dynamically use the mimetype from the uploaded file
    });
    
    formData.append('access_key', accessKey);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('timestamp', currentTime);
    formData.append('sample_bytes', req.file.size);
    formData.append('record_type', recordType);

    console.log('Sending request to ACRCloud...');
    
    const response = await axios.post(`https://${host}${endpoint}`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('ACRCloud response:', response.data);
    res.json(response.data);
    
  } catch (error) {
    console.error('Recognition error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: error.response?.data?.status?.msg || error.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
