export interface R2Client {
  putSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export interface CreateCnicUploadUrlResult {
  uploadUrl: string;
  objectKey: string;
}

export interface GetCnicReadUrlResult {
  readUrl: string;
}

export async function createCnicUploadUrl(
  r2Client: R2Client,
  volunteerId: string,
): Promise<CreateCnicUploadUrlResult> {
  const objectKey = `cnic/${volunteerId}/${crypto.randomUUID()}`;
  const uploadUrl = await r2Client.putSignedUrl(objectKey, 900);
  return { uploadUrl, objectKey };
}

export async function getCnicReadUrl(
  r2Client: R2Client,
  objectKey: string,
): Promise<GetCnicReadUrlResult> {
  const readUrl = await r2Client.getSignedUrl(objectKey, 300);
  return { readUrl };
}
