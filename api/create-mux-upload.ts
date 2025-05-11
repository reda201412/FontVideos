import Mux from '@mux/mux-node';
import type { NextApiRequest, NextApiResponse } from 'next';

// Initialize Mux from environment variables (MUX_TOKEN_ID, MUX_TOKEN_SECRET)
// These must be set in your Vercel project settings for this backend.
let muxClient: Mux | undefined;
try {
  muxClient = new Mux(); // Mux SDK v8+ initializes from process.env.MUX_TOKEN_ID and process.env.MUX_TOKEN_SECRET
} catch (error) {
  console.error("[MUX SDK Init Error] Failed to initialize Mux SDK:", error);
  // If Mux SDK fails to initialize, muxClient will remain undefined.
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // --- CORS Debugging Start ---
  console.log(`[CORS DEBUG] Request received for method: ${req.method} to path: ${req.url}`);
  console.log(`[CORS DEBUG] Request origin header: ${req.headers.origin}`);
  const frontendUrlFromEnv = process.env.FRONTEND_URL;
  console.log(`[CORS DEBUG] process.env.FRONTEND_URL is: ${frontendUrlFromEnv}`);
  // --- CORS Debugging End ---

  const allowedOrigin = frontendUrlFromEnv; // Use the value from environment variable

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  } else {
    // Fallback if FRONTEND_URL is not set - for local testing or as a last resort.
    // Be very careful with '*' in production as it's insecure.
    console.warn("[CORS WARNING] FRONTEND_URL environment variable not set. Defaulting Access-Control-Allow-Origin to '*'. This is insecure for production environments.");
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Add any other headers your client might send
  res.setHeader('Access-Control-Allow-Credentials', 'true'); // Include if your frontend sends credentials (e.g., cookies, auth headers)

  // Handle PREFLIGHT (OPTIONS) request
  if (req.method === 'OPTIONS') {
    console.log('[CORS DEBUG] Responding to OPTIONS preflight request.');
    return res.status(200).end(); // Respond to OPTIONS with 200 OK and the headers above
  }

  // Handle ACTUAL POST request
  if (req.method === 'POST') {
    if (!muxClient) {
      console.error('Mux SDK not initialized. Cannot process POST request. Check MUX_TOKEN_ID and MUX_TOKEN_SECRET environment variables.');
      return res.status(500).json({ error: 'Mux SDK (Server) not initialized.' });
    }

    try {
      const upload = await muxClient.video.uploads.create({
        cors_origin: allowedOrigin || '*', // Mux itself also needs a cors_origin if the upload request comes from a different domain than Mux
        new_asset_settings: {
          playback_policy: ['public'],
        },
      });

      if (upload && upload.url && upload.id) {
        console.log('[MUX API] Successfully created Mux direct upload URL.');
        return res.status(201).json({
          uploadUrl: upload.url,
          uploadId: upload.id,
        });
      } else {
        console.error('[MUX API Error] Failed to create MUX upload link. Mux response:', upload);
        return res.status(500).json({ error: 'Failed to create MUX upload link after Mux API call.', details: upload });
      }
    } catch (error: any) {
      console.error('[MUX API Error] Error creating MUX upload:', error);
      const muxErrorMessage = error.errors ? error.errors.map((e: any) => e.message || e).join(', ') : (error.message || 'An unexpected error occurred with Mux API.');
      return res.status(500).json({ error: 'Error creating MUX upload via Mux API.', details: muxErrorMessage });
    }
  } else {
    // Handle other HTTP methods if not POST or OPTIONS
    console.log(`[API] Method ${req.method} not allowed for this endpoint.`);
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
