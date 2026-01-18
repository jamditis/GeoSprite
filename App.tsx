
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo } from 'react';
import { InputSection } from './components/InputSection';
import { SpriteGallery } from './components/SpriteGallery';
import { Header } from './components/Header';
import { getPlaceDetails, generateSpriteImage } from './services/geminiService';
import { SpriteAsset, AssetStatus, GenerationConfig } from './types';
import JSZip from 'jszip';

const BATCH_SIZE = 3;
const DELAY_BETWEEN_REQUESTS_MS = 4000; // Delay to avoid rate limiting for batches

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const App: React.FC = () => {
  const [assets, setAssets] = useState<SpriteAsset[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [remixTarget, setRemixTarget] = useState<{ query: string; image: string } | null>(null);

  const updateAsset = (id: string, updates: Partial<SpriteAsset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const addAssetLog = (id: string, msg: string) => {
    setAssets(prev => prev.map(a => {
      if (a.id === id) {
        return { ...a, logs: [...(a.logs || []), `[${new Date().toLocaleTimeString()}] ${msg}`] };
      }
      return a;
    }));
  };

  const processSingleAsset = async (asset: SpriteAsset) => {
    const currentId = asset.id;
    const currentLocation = asset.query;

    const log = (msg: string) => addAssetLog(currentId, msg);

    try {
      // Step 1: Analyze Location
      updateAsset(currentId, { status: AssetStatus.ANALYZING, error: undefined });
      const details = await getPlaceDetails(currentLocation, log);
      
      updateAsset(currentId, { 
        description: details.description, 
        mapsUri: details.uri 
      });

      // Configurable delay for "Map Analysis" simulation/buffer
      // Default to 2 seconds if not specified
      const analysisDelay = asset.config.advanced?.analysisDelay ?? 2;
      log(`Waiting ${analysisDelay}s for map analysis buffer...`);
      await sleep(analysisDelay * 1000);

      // Step 2: Generate Sprite
      updateAsset(currentId, { status: AssetStatus.GENERATING });
      const imageBase64 = await generateSpriteImage(
        currentLocation, 
        details.description,
        asset.config.style,
        asset.config.includeBackground,
        asset.config.outputWidth,
        asset.config.outputHeight,
        log,
        asset.referenceImage,
        asset.config.advanced
      );
      
      updateAsset(currentId, { 
        imageUrl: imageBase64,
        status: AssetStatus.COMPLETED 
      });
      log("Asset generation completed successfully.");

    } catch (error: any) {
      console.error(`Failed to process ${currentLocation}:`, error);
      updateAsset(currentId, { 
        status: AssetStatus.ERROR,
        error: error.message 
      });
      log(`Failed: ${error.message}`);
    }
  };

  const processQueue = async (itemsToProcess: SpriteAsset[]) => {
    setIsProcessing(true);

    // Process sequentially or in very small batches with delay to respect rate limits
    for (let i = 0; i < itemsToProcess.length; i += BATCH_SIZE) {
      const batch = itemsToProcess.slice(i, i + BATCH_SIZE);
      
      // Execute batch
      await Promise.all(batch.map(asset => processSingleAsset(asset)));
      
      // Delay before next batch if there are more items
      if (i + BATCH_SIZE < itemsToProcess.length) {
         await sleep(DELAY_BETWEEN_REQUESTS_MS);
      }
    }

    setIsProcessing(false);
  };

  const startNewProcessing = async (items: { query: string; name?: string; referenceImage?: string }[], config: GenerationConfig) => {
    const newAssets: SpriteAsset[] = items.map(item => ({
      id: crypto.randomUUID(),
      query: item.query,
      customName: item.name,
      referenceImage: item.referenceImage,
      status: AssetStatus.PENDING,
      config: config,
      logs: ['Initialized in queue.']
    }));

    // Prepend new assets to the list so user sees them immediately
    setAssets(prev => [...newAssets, ...prev]);
    await processQueue(newAssets);
  };

  const handleRetry = async (id: string) => {
    const assetToRetry = assets.find(a => a.id === id);
    if (assetToRetry) {
      // Reset logs for retry
      updateAsset(id, { logs: ['Retrying...'] });
      await processQueue([assetToRetry]);
    }
  };

  const handleRetryAllFailed = async () => {
    const failedAssets = assets.filter(a => a.status === AssetStatus.ERROR);
    if (failedAssets.length > 0) {
      failedAssets.forEach(a => updateAsset(a.id, { logs: ['Retrying...'] }));
      await processQueue(failedAssets);
    }
  };

  const handleRemix = (asset: SpriteAsset) => {
    if (asset.imageUrl) {
      setRemixTarget({ query: asset.query, image: asset.imageUrl });
    }
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const completedAssets = assets.filter(a => a.status === AssetStatus.COMPLETED && a.imageUrl);
    
    if (completedAssets.length === 0) return;

    // Add images to zip
    completedAssets.forEach((asset) => {
      if (asset.imageUrl) {
        // Construct filename
        const prefix = asset.config.filenamePrefix || '';
        const safeName = (asset.customName || asset.query).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const fileName = `${prefix}${safeName}.png`;

        // Remove header data:image/xxx;base64,
        const base64Data = asset.imageUrl.split(',')[1];
        zip.file(fileName, base64Data, { base64: true });
      }
    });

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = "geosprite-assets.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats calculation
  const stats = useMemo(() => {
    return {
      total: assets.length,
      completed: assets.filter(a => a.status === AssetStatus.COMPLETED).length,
      failed: assets.filter(a => a.status === AssetStatus.ERROR).length,
      pending: assets.filter(a => a.status === AssetStatus.PENDING).length,
      analyzing: assets.filter(a => a.status === AssetStatus.ANALYZING).length,
      generating: assets.filter(a => a.status === AssetStatus.GENERATING).length,
    };
  }, [assets]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      <Header />
      <main>
        <InputSection 
          onStartProcessing={startNewProcessing} 
          isProcessing={isProcessing} 
          remixTarget={remixTarget}
        />
        <SpriteGallery 
          assets={assets} 
          onRetry={handleRetry}
          onRetryAll={handleRetryAllFailed}
          onDownloadAll={handleDownloadAll}
          isProcessing={isProcessing}
          stats={stats}
          onRemix={handleRemix}
        />
      </main>
    </div>
  );
};

export default App;
