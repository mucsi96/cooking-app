import express from 'express';
import { ImageGenerationHandler } from './imageGeneration';

const app = express();
const imageHandler = new ImageGenerationHandler();
let failEdits = false;

app.use(express.json({ limit: '20mb' }));

const requests: { operation: string; model: string; quality?: string; photo?: boolean; responseFormat?: unknown }[] = [];
app.get('/requests', (_req, res) => res.json(requests));
app.post('/v1/chat/completions', (req, res) => {
  if (req.body.response_format?.type !== 'json_schema' || req.body.response_format.json_schema?.strict !== true) {
    res.status(400).json({ error: { message: 'A strict structured output schema is required' } });
    return;
  }
  const system = req.body.messages.find((message: any) => message.role === 'system')?.content ?? '';
  const user = req.body.messages.find((message: any) => message.role === 'user');
  requests.push({ operation: 'chat', model: req.body.model,
    responseFormat: req.body.response_format,
    photo: Array.isArray(user?.content) && user.content.some((part: any) => part.type === 'image_url') });
  const text = Array.isArray(user?.content) ? user.content.filter((part: any) => part.type === 'text').map((part: any) => part.text).join('\n') : user?.content ?? '';
  const content = text.includes('FENCED_JSON') ? '```json\n{}\n```'
    : text.includes('INVALID_JSON') ? '{"title":'
    : system.includes('recipe extraction assistant')
    ? JSON.stringify({ title: 'Gulyásleves', description: 'Magyar gulyásleves.', category: 'Leves', servings: 4,
      ingredients: [{ name: 'marhalábszár', amount: 500, unit: 'g' }], steps: ['Főzd puhára a húst.'] })
    : JSON.stringify({ description: 'A photorealistic food photograph of goulash in a rustic bowl, no text.' });
  res.json({ id: 'chatcmpl-test', object: 'chat.completion', created: 1, model: req.body.model,
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }] });
});

// Middleware to log access details
app.use((req, res, next) => {
  if (req.url !== '/health' && req.url !== '/reset') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Add route to reset state for tests
app.post('/reset', (req, res) => {
  failEdits = false;
  imageHandler.reset();
  requests.length = 0;
  res.status(200).json({ status: 'ok', message: 'Image counter reset to 0' });
});

app.post('/image-edit-behavior', (req, res) => {
  failEdits = req.body.fail === true;
  res.json({ status: 'ok' });
});

// Add route for image generation mock
app.post('/v1/images/generations', (req, res) => {
  requests.push({ operation: 'image', model: req.body.model, quality: req.body.quality });
  try {
    const result = imageHandler.generateImages(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: { message: 'Image generation failed' } });
  }
});

// Parse the SDK's actual multipart edit request, requiring a normalized JPEG.
app.post('/v1/images/edits', express.raw({ type: 'multipart/form-data', limit: '20mb' }), async (req, res) => {
  try {
    const form = await new Response(req.body, { headers: { 'Content-Type': req.get('Content-Type')! } }).formData();
    const photo = form.get('image');
    if (!(photo instanceof File) || photo.type !== 'image/jpeg') throw new Error('Missing source JPEG');
    const bytes = new Uint8Array(await photo.arrayBuffer());
    if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('Invalid source JPEG');
    const model = String(form.get('model'));
    const quality = String(form.get('quality'));
    requests.push({ operation: 'edit', model, quality, photo: true });
    if (failEdits) {
      res.status(400).json({ error: { message: 'Image editing failed' } });
      return;
    }
    res.json(imageHandler.generateImages({ model, prompt: String(form.get('prompt')), n: Number(form.get('n') ?? 1) }));
  } catch {
    res.status(400).json({ error: { message: 'A valid multipart photo edit is required' } });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT ?? 3061;
app.listen(PORT, () => {
  console.log(`Mock OpenAI server is running on port ${PORT}`);
});
