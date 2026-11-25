import { supabase } from '../lib/supabase.js';

export function getStoragePath(photoUrl, bucketName) {
  const photo = new URL(photoUrl);
  const probeName = '__storage_path_check__';
  const expectedPhotoUrl = supabase.storage
    .from(bucketName)
    .getPublicUrl(probeName).data.publicUrl;
  const expected = new URL(expectedPhotoUrl);
  const bucketPath = expected.pathname.slice(0, -probeName.length);

  if (photo.origin !== expected.origin || !photo.pathname.startsWith(bucketPath)) {
    throw new Error('Photo URL does not belong to the configured photo bucket.');
  }

  const path = decodeURIComponent(photo.pathname.slice(bucketPath.length));
  if (!path || path.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Photo URL does not contain a valid storage path.');
  }

  return path;
}

export function isMissingStorageObject(error) {
  const code = String(error?.code || '').toLowerCase();
  if (['nosuchkey', 'objectnotfound', 'object_not_found', 'no_such_key'].includes(code)) return true;

  const status = Number(error?.status || error?.statusCode);
  const message = String(error?.message || '').toLowerCase();
  return status === 404
    && /\b(object|file|key)\b/.test(message)
    && /(not found|does not exist|missing)/.test(message);
}
