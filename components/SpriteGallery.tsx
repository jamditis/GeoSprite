
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { SpriteAsset, AssetStatus } from '../types';
import { MapPin, Loader2, Download, AlertCircle, RefreshCw, Layers, ExternalLink, ChevronDown, ChevronUp, Copy, Repeat, FileText, Clock } from 'lucide-react';

interface SpriteGalleryProps {
  assets: SpriteAsset[];
  onRetry: (id: string) => void;
  onRetryAll: () => void;
  onDownloadAll: () => void;
  isProcessing: boolean;
  stats: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    analyzing: number;
    generating: number;
  };
  onRemix: (asset: SpriteAsset) => void;
}

export const SpriteGallery: React.FC<SpriteGalleryProps> = ({ 
  assets, 
  onRetry, 
  onRetryAll, 
  onDownloadAll,
  isProcessing,
  stats,
  onRemix
}) => {
  if (assets.length === 0) return null;

  const hasErrors = stats.failed > 0;
  const hasCompleted = stats.completed > 0;

  const handleDownload = (asset: SpriteAsset) => {
    if (!asset.imageUrl) return;
    const link = document.createElement('a');
    link.href = asset.imageUrl;
    
    // Naming logic for single download
    const prefix = asset.config.filenamePrefix || '';
    const safeName = (asset.customName || asset.query).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.download = `${prefix}${safeName}.png`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-12 px-4 pb-20">
      
      {/* Processing Summary */}
      {isProcessing && (
        <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between animate-fade-in">
           <div className="flex items-center gap-4">
             <div className="relative w-10 h-10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
             </div>
             <div>
               <h4 className="text-sm font-bold text-white">Batch Processing Active</h4>
               <p className="text-xs text-zinc-400">
                 Completed: {stats.completed} | Pending: {stats.pending + stats.analyzing + stats.generating} | Failed: {stats.failed}
               </p>
             </div>
           </div>
           <div className="text-right">
              <span className="text-2xl font-mono text-emerald-400">{Math.round((stats.completed / stats.total) * 100)}%</span>
           </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-zinc-400 font-medium flex items-center gap-2">
          Asset Library 
          <span className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-full">{assets.length}</span>
        </h3>

        <div className="flex items-center gap-3">
          {hasErrors && !isProcessing && (
            <button
              onClick={onRetryAll}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-900/30 border border-amber-900/50 rounded-lg hover:bg-amber-900/50 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry Failed ({stats.failed})
            </button>
          )}
          
          {hasCompleted && (
            <button
              onClick={onDownloadAll}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-100 bg-emerald-900/30 border border-emerald-900/50 rounded-lg hover:bg-emerald-900/50 transition-colors"
            >
              <Layers className="w-3 h-3" />
              Download All Zip
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assets.map((asset) => (
          <GalleryItem 
            key={asset.id} 
            asset={asset} 
            onRetry={onRetry} 
            onDownload={handleDownload}
            onRemix={onRemix}
            isProcessingBatch={isProcessing}
          />
        ))}
      </div>
    </div>
  );
};

// Sub-component for individual items to manage local state (like expanding error details)
const GalleryItem: React.FC<{ 
  asset: SpriteAsset, 
  onRetry: (id: string) => void,
  onDownload: (asset: SpriteAsset) => void,
  onRemix: (asset: SpriteAsset) => void,
  isProcessingBatch: boolean
}> = ({ asset, onRetry, onDownload, onRemix, isProcessingBatch }) => {
  const [showLogs, setShowLogs] = useState(false);
  const isActive = asset.status === AssetStatus.ANALYZING || asset.status === AssetStatus.GENERATING;
  const isPending = asset.status === AssetStatus.PENDING;

  // Extract short error message (first line or first sentence)
  const shortError = asset.error ? asset.error.split('\n')[0].split('.')[0] + '.' : 'Unknown error';

  return (
    <div 
      className={`
        group bg-zinc-900 border rounded-xl overflow-hidden transition-all duration-300 relative flex flex-col
        ${isActive ? 'border-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]' : 'border-zinc-800 hover:border-zinc-600'}
        ${isPending && isProcessingBatch ? 'opacity-70' : 'opacity-100'}
      `}
    >
      {/* Active Processing Indicator (Pulsing Top Bar) */}
      {isActive && (
         <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-300 to-emerald-500 animate-gradient-x z-20" />
      )}

      {/* Image Area */}
      <div className="aspect-square bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-zinc-950/50 flex items-center justify-center p-8 relative overflow-hidden shrink-0">
         {asset.status === AssetStatus.COMPLETED && asset.imageUrl ? (
           <div className="relative w-full h-full group/img">
             <img 
               src={asset.imageUrl} 
               alt={asset.query} 
               className="w-full h-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-110"
             />
             {/* Action Overlay */}
             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                <button 
                   onClick={() => onRemix(asset)}
                   className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-lg transform scale-90 hover:scale-100 transition-all"
                >
                   <Repeat className="w-4 h-4" /> Use as Input
                </button>
             </div>
           </div>
         ) : (
           <div className="flex flex-col items-center gap-3 text-zinc-600 w-full px-8">
              {asset.status === AssetStatus.ERROR ? (
                <div className="flex flex-col items-center gap-2 w-full">
                  <AlertCircle className="w-10 h-10 text-red-500/50" />
                  <div className="bg-red-950/30 border border-red-900/50 rounded p-2 w-full text-center">
                     <p className="text-[10px] text-red-300 font-mono break-all mb-2">
                       Failed: {shortError}
                     </p>
                     <button 
                       onClick={() => setShowLogs(true)}
                       className="inline-flex items-center gap-1 text-[10px] text-red-400/80 hover:text-red-300 border-b border-red-400/30 pb-0.5"
                     >
                       <FileText className="w-3 h-3" /> View Full Log
                     </button>
                  </div>

                  <button 
                    onClick={() => onRetry(asset.id)}
                    className="mt-2 flex items-center gap-1 text-xs text-zinc-300 bg-zinc-800 px-3 py-1 rounded-full hover:bg-zinc-700 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : (
                <>
                  {/* Status Icons */}
                  {isActive ? (
                    <div className="relative">
                       <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                       <div className="absolute inset-0 animate-ping opacity-30 rounded-full bg-emerald-400" />
                    </div>
                  ) : isPending ? (
                    <div className="relative">
                      <Clock className="w-10 h-10 text-zinc-700" />
                      {isProcessingBatch && (
                         <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-bounce" />
                      )}
                    </div>
                  ) : (
                     <Loader2 className="w-8 h-8 text-zinc-800" />
                  )}

                  {/* Status Text */}
                  <span className={`text-xs uppercase tracking-wider font-medium text-center transition-colors ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {asset.status === AssetStatus.PENDING && (isProcessingBatch ? 'Waiting in Queue...' : 'Queued')}
                    {asset.status === AssetStatus.ANALYZING && 'Analyzing Location...'}
                    {asset.status === AssetStatus.GENERATING && 'Generating Sprite...'}
                  </span>
                </>
              )}
           </div>
         )}
      </div>

      {/* Info Footer */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/90 backdrop-blur flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div className="overflow-hidden">
            <h4 className="font-bold text-zinc-200 truncate" title={asset.query}>{asset.query}</h4>
            {asset.customName && (
              <p className="text-xs text-emerald-400 font-mono truncate">{asset.customName}</p>
            )}
          </div>
          {asset.status === AssetStatus.COMPLETED && (
            <button 
              onClick={() => onDownload(asset)}
              className="text-zinc-500 hover:text-emerald-400 transition-colors p-1"
              title="Download PNG"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Description from Maps */}
        {asset.description && asset.status !== AssetStatus.ERROR && (
          <p className="text-xs text-zinc-500 line-clamp-2 mb-3 leading-relaxed">
            {asset.description}
          </p>
        )}
        
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          {asset.mapsUri ? (
            <a 
              href={asset.mapsUri} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 rounded-lg text-xs font-bold text-white transition-all transform hover:-translate-y-0.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              View Location
            </a>
          ) : (
             <div className="flex-1" />
          )}

          {/* Logs Button (Always visible if there are logs) */}
          {(asset.logs && asset.logs.length > 0) && (
             <button 
               onClick={() => setShowLogs(true)}
               className="p-2 text-zinc-500 hover:text-zinc-200 transition-colors rounded-lg hover:bg-zinc-800 border border-transparent hover:border-zinc-700"
               title="View Logs"
             >
                <FileText className="w-4 h-4" />
             </button>
          )}
        </div>
      </div>

      {/* Full Logs Overlay */}
      {showLogs && (
         <div className="absolute inset-0 bg-zinc-950 z-50 flex flex-col animate-fade-in">
           <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
             <h4 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
               <FileText className="w-4 h-4" /> Process Log
             </h4>
             <button onClick={() => setShowLogs(false)} className="text-zinc-500 hover:text-white">
               <XIcon className="w-5 h-5" />
             </button>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[10px] text-zinc-400">
             {asset.logs.map((log, i) => (
               <div key={i} className="break-all border-b border-zinc-900/50 pb-1 mb-1 last:border-0">
                 {log}
               </div>
             ))}
             {asset.error && (
               <div className="text-red-400 font-bold mt-2 pt-2 border-t border-red-900/30">
                 ERROR: {asset.error}
               </div>
             )}
           </div>
         </div>
      )}
    </div>
  );
};

// Helper Icon for close button
const XIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M18 6 6 18"/><path d="m6 6 18 18"/>
  </svg>
);
