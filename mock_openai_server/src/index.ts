import express from 'express';
import { ImageGenerationHandler } from './imageGeneration';

const app = express();
const imageHandler = new ImageGenerationHandler();

app.use(express.json());

// Middleware to log access details
app.use((req, res, next) => {
  if (req.url !== '/health' && req.url !== '/reset') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Add route to reset state for tests
app.post('/reset', (req, res) => {
  imageHandler.reset();
  res.status(200).json({ status: 'ok', message: 'Image counter reset to 0' });
});

// Add route for image generation mock
app.post('/images/generations', (req, res) => {
  try {
    const result = imageHandler.generateImages(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: { message: 'Image generation failed' } });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT ?? 3061;
app.listen(PORT, () => {
  console.log(`Mock OpenAI server is running on port ${PORT}`);
});
