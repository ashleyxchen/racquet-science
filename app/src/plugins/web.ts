/**
 * Web implementation of VideoRecording plugin
 * (Video recording only works on native iOS)
 */

import { WebPlugin } from '@capacitor/core';
import type { VideoRecordingPlugin } from './VideoRecording';

export class VideoRecordingWeb extends WebPlugin implements VideoRecordingPlugin {
  async startRecording(_options: { sessionId: string }): Promise<{ success: boolean; sessionId: string }> {
    throw this.unimplemented('Video recording is not available on web platform');
  }

  async stopRecording(): Promise<{ videoPath: string; durationMs: number }> {
    throw this.unimplemented('Video recording is not available on web platform');
  }

  async getRecordingStatus(): Promise<{ isRecording: boolean; durationMs: number; sessionId?: string }> {
    return {
      isRecording: false,
      durationMs: 0,
    };
  }

  async checkPermissions(): Promise<{ camera: 'granted' | 'denied'; microphone: 'granted' | 'denied' }> {
    return {
      camera: 'denied',
      microphone: 'denied',
    };
  }

  async requestPermissions(): Promise<{ camera: 'granted' | 'denied'; microphone: 'granted' | 'denied' }> {
    throw this.unimplemented('Permissions not available on web platform');
  }
}
