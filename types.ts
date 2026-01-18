
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum AssetStatus {
  PENDING = 'PENDING',
  ANALYZING = 'ANALYZING', // Checking Google Maps
  GENERATING = 'GENERATING', // Creating Image
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export type SpriteStyle = 'pixel_art' | 'vector' | 'realistic' | 'clay' | 'chibi' | 'isometric_pixel' | 'low_poly' | '16_bit' | 'watercolor' | 'sketch' | 'neon_punk' | 'flat';

export interface AdvancedConfig {
  colorPalette?: string;
  detailLevel?: 'low' | 'medium' | 'high';
  textureType?: string;
  temperature?: number;
  analysisDelay?: number; // Delay in seconds
}

export interface GenerationConfig {
  style: SpriteStyle;
  includeBackground: boolean;
  filenamePrefix?: string;
  outputWidth: number;
  outputHeight: number;
  advanced?: AdvancedConfig;
}

export interface StylePreset {
  id: string;
  name: string;
  config: GenerationConfig;
}

export interface SpriteAsset {
  id: string;
  query: string; // The location name
  customName?: string; // Optional custom name
  description?: string; // From Google Maps Grounding
  mapsUri?: string; // From Google Maps Grounding
  imageUrl?: string; // The generated sprite
  referenceImage?: string; // Base64 input image for chaining/reference
  status: AssetStatus;
  error?: string;
  logs: string[]; // Detailed processing logs
  config: GenerationConfig; // Store config used for this asset
}

export interface GeneratedSvg {
  id: string;
  content: string;
  prompt: string;
}

export interface ProcessingStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  analyzing: number;
  generating: number;
}
