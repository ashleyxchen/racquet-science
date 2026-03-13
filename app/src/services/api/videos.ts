/**
 * Videos API
 *
 * Handles video upload and retrieval from the backend.
 */

import { Filesystem, Directory } from '@capacitor/filesystem';
import { uploadFile, get, del, getApiConfig } from './client';

export interface VideoUploadResponse {
  session_id: number;
  video_path: string;
  file_size: number;
  duration_ms: number | null;
}

export interface VideoMetadataResponse {
  session_id: number;
  video_path: string;
  file_size: number;
  exists: boolean;
}

/**
 * Upload a video file for a session
 *
 * @param sessionId - The backend session ID
 * @param localVideoPath - Local file path to the video (from VideoRecordingPlugin)
 */
export async function uploadVideo(
  sessionId: number,
  localVideoPath: string
): Promise<VideoUploadResponse> {
  console.log(`[VideoApi] ============ VIDEO UPLOAD START ============`);
  console.log(`[VideoApi] Session ID: ${sessionId}`);
  console.log(`[VideoApi] Local video path: "${localVideoPath}"`);

  // Convert absolute iOS path to relative path for Capacitor Filesystem
  // The native plugin returns: /var/mobile/.../Documents/sessions/{sessionId}/video.mp4
  // We need: sessions/{sessionId}/video.mp4 (relative to Documents)
  let relativePath = localVideoPath;
  if (localVideoPath.includes('/Documents/')) {
    relativePath = localVideoPath.split('/Documents/')[1];
    console.log(`[VideoApi] Path contains /Documents/, converted to relative path: "${relativePath}"`);
  } else {
    console.log(`[VideoApi] Path does NOT contain /Documents/, using as-is: "${relativePath}"`);
  }

  // Read the video file as base64
  console.log(`[VideoApi] Reading file with path: "${relativePath}" from Documents directory...`);
  let fileData;
  try {
    fileData = await Filesystem.readFile({
      path: relativePath,
      directory: Directory.Documents,
    });
    console.log(`[VideoApi] File read success, data length: ${typeof fileData.data === 'string' ? fileData.data.length : 'N/A'} chars`);
  } catch (readError) {
    console.error(`[VideoApi] Failed to read video file:`, readError);
    throw readError;
  }

  // Convert base64 to Blob
  const base64Data = fileData.data as string;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'video/mp4' });

  console.log(`[VideoApi] Video file size: ${blob.size} bytes`);

  // Upload the video - field name must be 'video' to match backend
  console.log(`[VideoApi] Uploading to /api/sessions/${sessionId}/video...`);
  const response = await uploadFile<VideoUploadResponse>(
    `/api/sessions/${sessionId}/video`,
    blob,
    'video'
  );
  console.log(`[VideoApi] ============ VIDEO UPLOAD SUCCESS ============`);
  console.log(`[VideoApi] Response:`, response);
  return response;
}

/**
 * Get video metadata for a session
 */
export async function getVideoMetadata(sessionId: number): Promise<VideoMetadataResponse> {
  return get<VideoMetadataResponse>(`/api/sessions/${sessionId}/video/metadata`);
}

/**
 * Delete video for a session
 */
export async function deleteVideo(sessionId: number): Promise<void> {
  return del<void>(`/api/sessions/${sessionId}/video`);
}

/**
 * Get the streaming URL for a session's video
 */
export function getVideoStreamUrl(sessionId: number): string {
  const config = getApiConfig();
  return `${config.baseUrl}/api/sessions/${sessionId}/video`;
}
