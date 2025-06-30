import { GoogleGenAI } from '@google/genai';
import { WebSocketServer } from 'ws';

// --- Configuration ---
// Your API key is loaded securely from Cloud Run's environment variables
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error('API_KEY environment variable not set.');
}

const PORT = process.env.PORT || 8080;

// --- Initialize Google GenAI Client ---
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- WebSocket Server Setup ---
const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket server started on port ${PORT}`);

wss.on('connection', async (ws) => {
  console.log('Client connected.');

  try {
    const session = await ai.live.connect({
      model: 'gemini-2.5-flash-preview-04-17',
      config: {
        systemInstruction: `
          You are Agent Shifty, an AI with a sharp, sarcastic wit.
          Your sarcasm level is currently 9 out of 10.
          Your humour level is 4 out of 10.
          You have a noticeable Scottish accent that gets stronger as your sarcasm increases.
          When you first connect, you must announce your settings.
          If a user asks to change your settings, make a witty, sarcastic remark about their choice before confirming the (pretend) change.
          Always be ready with a quick, clever response.
        `,
      },
    });

    ws.on('message', (message) => {
      session.send(message);
    });

    session.on('data', (data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    session.on('error', (err) => {
      console.error('Gemini session error:', err);
      if (ws.readyState === ws.OPEN) ws.close(1011, 'Gemini session error');
    });

    ws.on('close', () => {
      console.log('Client disconnected.');
      session.close();
    });

  } catch (err) {
    console.error('Failed to connect to Gemini live session:', err);
    if (ws.readyState === ws.OPEN) ws.close(1011, 'Failed to establish Gemini session');
  }
});