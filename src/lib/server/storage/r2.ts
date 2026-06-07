import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env, r2Configured } from '../env.ts';

let cachedClient: S3Client | null = null;

function client(): S3Client {
	if (!r2Configured()) {
		throw new Error('R2 is not configured (missing R2_ACCOUNT_ID / keys / R2_FEEDBACK_BUCKET)');
	}
	if (cachedClient) return cachedClient;
	cachedClient = new S3Client({
		region: 'auto',
		endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY
		}
	});
	return cachedClient;
}

export async function presignPut(
	key: string,
	contentType: string,
	expiresIn = 600
): Promise<string> {
	const cmd = new PutObjectCommand({
		Bucket: env.R2_FEEDBACK_BUCKET,
		Key: key,
		ContentType: contentType
	});
	return getSignedUrl(client(), cmd, { expiresIn });
}

export async function presignGet(key: string, expiresIn = 3600): Promise<string> {
	const cmd = new GetObjectCommand({
		Bucket: env.R2_FEEDBACK_BUCKET,
		Key: key
	});
	return getSignedUrl(client(), cmd, { expiresIn });
}
