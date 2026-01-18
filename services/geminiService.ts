
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";
import { SpriteStyle, AdvancedConfig } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type LogFn = (msg: string) => void;

/**
 * Helper to resize a base64 image client-side with high quality settings.
 * optionally removes background using a flood-fill algorithm from corners.
 */
const resizeImage = (base64Str: string, width: number, height: number, removeBackground: boolean = false): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(base64Str); // Fallback if context fails
        return;
      }
      
      // High quality resizing settings
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw and resize
      ctx.drawImage(img, 0, 0, width, height);

      if (removeBackground) {
        try {
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          
          // Helper to get pixel index
          const getIdx = (x: number, y: number) => (y * width + x) * 4;
          
          // Get background color from top-left (assuming it's background)
          // We sample the very first pixel
          const bgIdx = 0;
          const bgR = data[bgIdx];
          const bgG = data[bgIdx + 1];
          const bgB = data[bgIdx + 2];
          
          // Tolerance for compression artifacts (JPEG/WebP generation artifacts)
          const tolerance = 25;
          
          const isMatch = (r: number, g: number, b: number) => {
              return Math.abs(r - bgR) <= tolerance &&
                     Math.abs(g - bgG) <= tolerance &&
                     Math.abs(b - bgB) <= tolerance;
          }

          // Flood fill queue (Stack implementation for DFS)
          const stack: number[] = [];
          const visited = new Uint8Array(width * height);
          
          // Add corners if they match background
          const corners = [[0,0], [width-1, 0], [0, height-1], [width-1, height-1]];
          for(const [cx, cy] of corners) {
             const idx = getIdx(cx, cy);
             const vPos = cy * width + cx;
             if(isMatch(data[idx], data[idx+1], data[idx+2]) && !visited[vPos]) {
                 stack.push(cx, cy);
                 visited[vPos] = 1;
             }
          }

          while(stack.length > 0) {
              const y = stack.pop()!;
              const x = stack.pop()!;
              
              const idx = getIdx(x, y);
              
              // Set to transparent
              data[idx + 3] = 0;
              
              // Neighbors (4-connectivity)
              const neighbors = [[x+1, y], [x-1, y], [x, y+1], [x, y-1]];
              for(const [nx, ny] of neighbors) {
                  if(nx >= 0 && nx < width && ny >= 0 && ny < height) {
                      const nPos = ny * width + nx;
                      if(visited[nPos] === 0) {
                          const nIdx = getIdx(nx, ny);
                          if(isMatch(data[nIdx], data[nIdx+1], data[nIdx+2])) {
                              visited[nPos] = 1;
                              stack.push(nx, ny);
                          }
                      }
                  }
              }
          }
          
          ctx.putImageData(imageData, 0, 0);
        } catch (e) {
          console.error("Background removal failed", e);
          // Continue without removal if it fails
        }
      }

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(base64Str); // Fallback if loading fails
    img.src = base64Str;
  });
};

/**
 * Step 1: Get visual details about a location using Google Maps Grounding.
 * Uses gemini-2.5-flash as it supports the googleMaps tool.
 */
export const getPlaceDetails = async (locationName: string, log: LogFn): Promise<{ description: string; uri?: string }> => {
  try {
    log(`Starting Maps Grounding for: ${locationName}`);
    // We explicitly ask NOT to mention the address to avoid PII triggers in the subsequent image generation step
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Describe the visual appearance of "${locationName}" in detail suitable for a concept artist. 
      Focus strictly on architectural style, key colors, materials, distinct features, and shape. 
      Do NOT mention the specific address or location name in the description, just describe the physical structure visually.`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    // Extract the Maps URI if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    let mapsUri: string | undefined;

    if (groundingChunks) {
      log(`Received ${groundingChunks.length} grounding chunks.`);
      for (const chunk of groundingChunks) {
         // Check for maps specific URI first (as per guidelines)
         const c = chunk as any;
         if (c.maps?.uri) {
           mapsUri = c.maps.uri;
           break;
         }
         
         // Fallback to checking web URI if it looks like a maps link
         if (chunk.web?.uri && chunk.web.uri.includes('google.com/maps')) {
           mapsUri = chunk.web.uri;
           break;
         }
      }
    }

    const description = response.text || "A detailed architectural structure.";
    log(`Location description generated (${description.length} chars).`);
    
    return {
      description,
      uri: mapsUri
    };
  } catch (error: any) {
    console.error("Maps Grounding Error:", error);
    let msg = error.message || "Failed to retrieve location details.";
    if (msg.includes('SAFETY')) msg = "Blocked by safety settings.";
    if (msg.includes('429')) msg = "Rate limit exceeded (Quota).";
    log(`Error in Maps Grounding: ${msg}`);
    throw new Error(`Maps Grounding: ${msg}`);
  }
};

/**
 * Step 2: Generate a sprite based on the description and configuration.
 * Uses gemini-2.5-flash-image.
 */
export const generateSpriteImage = async (
  locationName: string, 
  visualDescription: string,
  style: SpriteStyle,
  includeBackground: boolean,
  width: number,
  height: number,
  log: LogFn,
  referenceImage?: string,
  advanced?: AdvancedConfig
): Promise<string> => {
  try {
    const stylePrompts: Record<SpriteStyle, string> = {
      'pixel_art': 'Pixel art style, 32-bit game asset, crisp edges, limited palette',
      'isometric_pixel': 'Isometric view, pixel art, retro RPG style, 2.5D, sharp pixel scaling',
      '16_bit': '16-bit SNES era style, rich color palette, pixelated but detailed, retro game aesthetic',
      'vector': 'Clean flat vector art, SVG style, cell shaded, thick outlines, iconographic, mobile game asset',
      'realistic': '3D rendered model, high fidelity, Unreal Engine 5 style, physically based rendering, detailed textures',
      'clay': 'Claymation style, plasticine texture, cute, handmade look, soft lighting, stop-motion aesthetic',
      'chibi': 'Chibi style, cute proportions, big head, expressive, anime aesthetic, kawaii',
      'low_poly': 'Low poly 3D style, flat shaded polygons, retro PS1 aesthetic, geometric, minimal geometry',
      'watercolor': 'Watercolor painting style, artistic, soft edges, paper texture, vibrant organic colors',
      'sketch': 'Hand-drawn sketch style, pencil lines, rough concept art, draft aesthetic',
      'neon_punk': 'Cyberpunk neon style, glowing edges, dark background, futuristic, synthwave palette',
      'flat': 'Flat design style, 2D, minimal shading, clean lines, modern UI icon aesthetic, simple geometry'
    };

    const bgPrompt = includeBackground 
      ? "Include a minimal scenic background related to the subject, contained within the sprite bounds." 
      : "Isolated on a solid pure white background (Hex #FFFFFF). Strictly no background elements, shadows, or noise. Ensure padding around the object.";

    // CRITICAL: Do not use locationName (address) in the image prompt to avoid "PII/Location" safety refusals.
    // Use the sanitized visual description instead.
    let prompt = `
      Generate a high-quality game sprite image.
      
      Subject Description: ${visualDescription.slice(0, 800)}
      
      Art Style: ${stylePrompts[style]}.
      View: Isometric (unless style implies otherwise).
      Background: ${bgPrompt}
      
      Requirements:
      - The object must be centered.
      - Do not include text in the image.
      - High quality, detailed.
      ${!includeBackground ? '- Background must be solid white #FFFFFF for easy removal.' : ''}
    `;

    // Incorporate Advanced Config
    if (advanced) {
      if (advanced.colorPalette) {
        prompt += `\nColor Palette: Use the following colors/theme: ${advanced.colorPalette}.`;
      }
      if (advanced.detailLevel) {
        prompt += `\nDetail Level: ${advanced.detailLevel}.`;
      }
      if (advanced.textureType) {
        prompt += `\nTexture Style: ${advanced.textureType}.`;
      }
    }

    if (referenceImage) {
      prompt += "\n\nUse the provided image as a strong reference for the composition and color palette.";
      log("Using reference image for generation.");
    }

    log(`Generating image with style: ${style}`);

    const parts: any[] = [];
    if (referenceImage) {
      // Clean base64 string if needed
      const base64Data = referenceImage.includes(',') ? referenceImage.split(',')[1] : referenceImage;
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data
        }
      });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts,
      },
      config: {
        temperature: advanced?.temperature ?? 1.0, 
      },
    });

    // Handle cases where candidates might be empty or blocked
    if (!response.candidates || response.candidates.length === 0) {
      log("No candidates returned from API.");
      throw new Error("API returned no candidates. This might be due to safety filters.");
    }

    const candidate = response.candidates[0];
    log(`Response received. Finish reason: ${candidate.finishReason || 'NONE'}`);

    // Check for explicit finish reason failure
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      if (candidate.finishReason === 'SAFETY') {
        throw new Error("Image generation blocked by safety filters.");
      }
    }

    let rawImage = "";
    let refusalText = "";

    // Extract image or text explanation
    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          rawImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        } else if (part.text) {
          refusalText += part.text;
        }
      }
    }
    
    if (!rawImage) {
      if (refusalText) {
        log(`Model refusal text: ${refusalText.slice(0, 100)}...`);
        throw new Error(`Model Refusal: ${refusalText.slice(0, 200)}`);
      }
      throw new Error(`No image data received. Finish Reason: ${candidate.finishReason || 'Unknown'}`);
    }

    log("Image data extracted successfully. Resizing" + (!includeBackground ? " & Removing Background..." : "..."));

    // Resize to requested dimensions and remove background if needed
    const resizedImage = await resizeImage(rawImage, width, height, !includeBackground);
    log("Image processing complete.");
    return resizedImage;

  } catch (error: any) {
    console.error("Image Gen Error:", error);
    let msg = error.message || "Failed to generate sprite.";
    if (msg.includes('SAFETY') || msg.includes('Model Refusal') || msg.includes('Finish Reason')) {
        // keep as is
    } else if (msg.includes('429')) {
        msg = "Image generation quota exceeded.";
    }
    log(`Fatal Error: ${msg}`);
    throw new Error(`Generation: ${msg}`);
  }
};
