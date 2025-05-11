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

// Read the allowed frontend origin from Vercel Environment Variables
const ALLOWED_FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // --- CORS Handling ---
  const origin = req.headers.origin;
  console.log(`[CORS DEBUG] Request origin header: ${origin}`);
  console.log(`[CORS DEBUG] ALLOWED_FRONTEND_ORIGIN env var: ${ALLOWED_FRONTEND_ORIGIN}`);

  // Set the Access-Control-Allow-Origin header.
  // If the request origin is in our allowed list (or matches the single allowed origin), allow it.
  // Otherwise, we could choose not to set the header, or set it to a default.
  // For simplicity with a single allowed origin from env:
  if (ALLOWED_FRONTEND_ORIGIN && origin === ALLOWED_FRONTEND_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_FRONTEND_ORIGIN);
      console.log(`[CORS DEBUG] Origin ${origin} matched ALLOWED_FRONTEND_ORIGIN. Setting header.`);
  } else {
       // Optionally, handle cases where origin doesn't match.
       // For development, you might allow * temporarily, but in production, it's safer
       // to only allow specific origins or return a CORS error.
       // console.warn(`[CORS WARNING] Origin ${origin} not allowed. ALLOWED_FRONTEND_ORIGIN is ${ALLOWED_FRONTEND_ORIGIN}`);
       // Do not set Access-Control-Allow-Origin header if origin is not allowed.
       // The browser will then block the request.
       // If you need to allow multiple origins dynamically, the logic here would be more complex.
       // For this case, we assume a single allowed origin from the environment variable.
  }


  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Add any other headers your client might send
  res.setHeader('Access-Control-Allow-Credentials', 'true'); // Include if your frontend sends credentials (e.g., cookies, auth headers)

  // Handle PREFLIGHT (OPTIONS) request
  if (req.method === 'OPTIONS') {
    console.log('[CORS DEBUG] Responding to OPTIONS preflight request.');
    // For OPTIONS, we just need to send the CORS headers and a 200 OK response.
    // The browser checks these headers before sending the actual POST request.
    return res.status(200).end();
  }

  // Handle ACTUAL POST request
  if (req.method === 'POST') {
    // Check if the origin is allowed BEFORE processing the request body or calling Mux
     if (ALLOWED_FRONTEND_ORIGIN && origin !== ALLOWED_FRONTEND_ORIGIN) {
         console.warn(`[CORS SECURITY] Blocking POST request from unauthorized origin: ${origin}`);
         // Respond with a 403 Forbidden or similar if origin is not allowed
         return res.status(403).json({ error: 'Forbidden Origin' });
     }


    if (!muxClient) {
      console.error('Mux SDK not initialized. Cannot process POST request. Check MUX_TOKEN_ID and MUX_TOKEN_SECRET environment variables.');
      return res.status(500).json({ error: 'Mux SDK (Server) not initialized.' });
    }

    try {
      const upload = await muxClient.video.uploads.create({
        // Set the cors_origin for Mux itself to accept uploads from your frontend origin
        cors_origin: origin, // Use the actual request origin here for Mux to allow the direct upload from the browser
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
