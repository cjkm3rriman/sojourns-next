import { S3Client } from '@aws-sdk/client-s3';

// Cloudflare R2 configuration
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // e.g., https://account-id.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Optional: custom domain for public access
