// Suggested content for: creator-verse-backend/api/create-mux-upload.ts
import Mux from '@mux/mux-node';
import type { NextApiRequest, NextApiResponse } from 'next'; // Or use Vercel's native Request/Response if not using Next.js types

// Initialize Mux from environment variables (MUX_TOKEN_ID, MUX_TOKEN_SECRET)
// These must be set in your Vercel project settings for this backend.
let muxClient: Mux;
try {
  muxClient = new Mux();
} catch (error) {
  console.error("Failed to initialize Mux SDK:", error);
}

export default async function handler(
  req: NextApiRequest, // Or Vercel's Request type
  res: NextApiResponse // Or Vercel's Response type
) {
  if (!muxClient) {
    console.error('Mux SDK not initialized.');
    return res.status(500).json({ error: 'Mux SDK not initialized.' });
  }

  if (req.method === 'OPTIONS') {
    // Handle CORS preflight request
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*'); // Allow your frontend origin
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Set CORS headers for the actual request
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');


  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const upload = await muxClient.video.uploads.create({
      cors_origin: process.env.FRONTEND_URL || '*', // Restrict this in production
      new_asset_settings: {
        playback_policy: ['public'],
      },
    });

    if (upload && upload.url && upload.id) {
      return res.status(201).json({
        uploadUrl: upload.url,
        uploadId: upload.id,
      });
    } else {
      console.error('Failed to create MUX upload link. Response:', upload);
      return res.status(500).json({ error: 'Failed to create MUX upload link.', details: upload });
    }
  } catch (error: any) {
    console.error('Error creating MUX upload:', error);
    const muxError = error.errors ? error.errors.join(', ') : (error instanceof Error ? error.message : 'An unexpected error occurred.');
    return res.status(500).json({ error: 'Error creating MUX upload.', details: muxError });
  }
}
