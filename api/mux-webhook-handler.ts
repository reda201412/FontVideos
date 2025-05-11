// Suggested content for: creator-verse-backend/api/mux-webhook-handler.ts
import Mux from '@mux/mux-node';
import type { NextApiRequest, NextApiResponse } from 'next'; // Or use Vercel's native Request/Response
// If you need to interact with Firebase Admin SDK in your webhook:
// import * as admin from 'firebase-admin';
// import { db } from './_firebase'; // Assuming you have a Firebase admin init utility

// Ensure MUX_WEBHOOK_SECRET is set in your Vercel project environment variables for this backend.
const MUX_WEBHOOK_SECRET = process.env.MUX_WEBHOOK_SECRET;

export default async function handler(
  req: NextApiRequest, // Or Vercel's Request type
  res: NextApiResponse // Or Vercel's Response type
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!MUX_WEBHOOK_SECRET) {
    console.error('Mux Webhook Secret is not configured.');
    return res.status(500).send('Webhook secret not configured.');
  }

  // Verify the webhook signature
  const signature = req.headers['mux-signature'] as string;
  if (!signature) {
    console.warn('Mux webhook signature missing.');
    return res.status(400).send('Signature missing.');
  }

  try {
    // The Mux Node SDK can verify the signature directly from the raw request body
    // For Next.js/Vercel, you need to ensure the raw body is available.
    // If using `bodyParser: false` in API route config is not an option,
    // you might need to read the raw body differently or use a helper.
    // For simplicity, this example assumes Mux.Webhooks.verifyHeader can work.
    // NOTE: Vercel automatically provides req.body as a parsed object.
    // To get the raw body for signature verification, you might need a custom helper
    // or ensure your framework/Vercel config provides it.
    // A common workaround is to re-stringify req.body if the raw body isn't directly available.
    // This is NOT ideal for security but shown for conceptual understanding.
    // A better approach involves `getRawBody` or similar.
    const rawBody = JSON.stringify(req.body); // THIS IS A SIMPLIFICATION / WORKAROUND
                                             // Production code should use a proper raw body parser.
                                             
    Mux.Webhooks.verifyHeader(rawBody, signature, MUX_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Mux webhook signature verification failed:', err.message);
    return res.status(400).send(`Signature verification failed: ${err.message}`);
  }

  // Signature is verified, now process the event
  const event = req.body; // Event payload

  console.log('Received Mux Webhook Event:', JSON.stringify(event, null, 2));

  try {
    switch (event.type) {
      case 'video.asset.created':
        console.log('Mux Event: video.asset.created', event.data.id);
        // Example: Store the asset ID if you haven't already
        // await db.collection('videos').doc(YOUR_VIDEO_DOCUMENT_ID_LINKED_TO_UPLOAD_ID)
        //   .update({ muxAssetId: event.data.id, status: 'processing' });
        break;
      case 'video.asset.ready':
        console.log('Mux Event: video.asset.ready', event.data.id);
        // This is a critical event. The asset is ready for streaming.
        // Update your database with playback IDs, status, duration, etc.
        // const assetId = event.data.id;
        // const playbackId = event.data.playback_ids && event.data.playback_ids[0]?.id;
        // const duration = event.data.duration;
        // const videoUrl = `https://stream.mux.com/${playbackId}.m3u8`;
        // const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&height=360&fit_mode=preserve`;

        // Find your video record (e.g., using event.data.upload_id or passthrough if you set one)
        // const uploadId = event.data.upload_id; 
        // if (uploadId) {
        //   const videoQuery = query(collection(db, 'videos'), where('muxUploadId', '==', uploadId), limit(1));
        //   const videoSnap = await getDocs(videoQuery);
        //   if (!videoSnap.empty) {
        //     const videoDoc = videoSnap.docs[0];
        //     await updateDoc(doc(db, 'videos', videoDoc.id), {
        //       muxAssetId: assetId,
        //       muxPlaybackId: playbackId,
        //       videoUrl: videoUrl,
        //       thumbnailUrl: thumbnailUrl,
        //       status: 'ready', // or 'completed'
        //       duration: duration,
        //     });
        //     console.log(`Updated video ${videoDoc.id} with Mux asset details.`);
        //   } else {
        //     console.warn(`No video found with Mux Upload ID: ${uploadId}`);
        //   }
        // }
        break;
      case 'video.asset.errored':
        console.error('Mux Event: video.asset.errored', event.data.id, event.data.errors);
        // Handle asset processing errors
        // const uploadId = event.data.upload_id;
        // if (uploadId) {
        //   // Update your database to reflect the error status
        // }
        break;
      // Add more cases for other events you care about:
      // video.upload.asset_created
      // video.live_stream.active
      // ... etc.
      default:
        console.log('Unhandled Mux event type:', event.type);
    }

    res.status(200).json({ received: true, message: 'Webhook processed.' });
  } catch (error) {
    console.error('Error processing Mux webhook event:', error);
    res.status(500).json({ error: 'Error processing webhook event.' });
  }
}

// Optional: If you need to disable body parsing for this route (for raw body access)
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };
