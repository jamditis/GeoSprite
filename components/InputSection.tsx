
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileJson, FileText, Play, X, Settings2, Loader2, Info, Plus, Image as ImageIcon, Save, ChevronDown, ChevronUp, Thermometer, Timer, Eraser } from 'lucide-react';
import { SpriteStyle, GenerationConfig, AdvancedConfig, StylePreset } from '../types';

interface InputItem {
  query: string;
  name?: string;
  referenceImage?: string;
}

interface InputSectionProps {
  onStartProcessing: (items: InputItem[], config: GenerationConfig) => void;
  isProcessing: boolean;
  remixTarget?: { query: string; image: string } | null;
}

const DEFAULT_CONFIG: GenerationConfig = {
  style: 'pixel_art',
  includeBackground: false, // Default to transparent (user preference usually)
  filenamePrefix: '',
  outputWidth: 512,
  outputHeight: 512,
  advanced: {
    detailLevel: 'medium',
    colorPalette: '',
    textureType: '',
    temperature: 1.0,
    analysisDelay: 2 // seconds
  }
};

export const InputSection: React.FC<InputSectionProps> = ({ onStartProcessing, isProcessing, remixTarget }) => {
  const [items, setItems] = useState<InputItem[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Manual Entry State
  const [manualQuery, setManualQuery] = useState('');
  const [manualImage, setManualImage] = useState<string | null>(null);
  
  // Configuration State
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG);
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Load from local storage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('geosprite_config');
    const savedPresets = localStorage.getItem('geosprite_presets');
    const savedAutoStart = localStorage.getItem('geosprite_autostart');
    
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        // Ensure default structure if new fields added
        setConfig({
          ...DEFAULT_CONFIG,
          ...parsed,
          advanced: { ...DEFAULT_CONFIG.advanced, ...parsed.advanced }
        });
      } catch (e) { console.error("Failed to load config", e); }
    }
    
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) { console.error("Failed to load presets", e); }
    }

    if (savedAutoStart) {
      setAutoStart(savedAutoStart === 'true');
    }
  }, []);

  // Save config on change
  useEffect(() => {
    localStorage.setItem('geosprite_config', JSON.stringify(config));
  }, [config]);

  // Save presets on change
  useEffect(() => {
    localStorage.setItem('geosprite_presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem('geosprite_autostart', String(autoStart));
  }, [autoStart]);

  // Handle remix target
  useEffect(() => {
    if (remixTarget) {
      setManualQuery(remixTarget.query);
      setManualImage(remixTarget.image);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [remixTarget]);

  const updateConfig = (updates: Partial<GenerationConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateAdvanced = (updates: Partial<AdvancedConfig>) => {
    setConfig(prev => ({ ...prev, advanced: { ...prev.advanced, ...updates } }));
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: StylePreset = {
      id: crypto.randomUUID(),
      name: newPresetName.trim(),
      config: { ...config }
    };
    setPresets(prev => [...prev, newPreset]);
    setNewPresetName('');
  };

  const loadPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setConfig(preset.config);
    }
  };

  const deletePreset = (presetId: string) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
  };

  const parseFile = async (file: File) => {
    setIsParsing(true);
    let foundItems: InputItem[] = [];

    try {
      const text = await file.text();
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.json')) {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          if (json.length > 0 && typeof json[0] === 'string') {
            foundItems = json.map((str: string) => ({ query: str }));
          } else if (json.length > 0 && typeof json[0] === 'object') {
            foundItems = json.map((obj: any) => ({
              query: obj.location || obj.query || obj.address || "",
              name: obj.name || obj.title || obj.id
            })).filter(i => i.query);
          }
        } else if (typeof json === 'object' && json !== null) {
           const arr = json.locations || json.items || json.data;
           if (Array.isArray(arr)) {
             if (arr.length > 0 && typeof arr[0] === 'string') {
               foundItems = arr.map((str: string) => ({ query: str }));
             } else {
               foundItems = arr.map((obj: any) => ({
                  query: obj.location || obj.query || "",
                  name: obj.name || obj.title
               })).filter((i: any) => i.query);
             }
           }
        }
      } else if (lowerName.endsWith('.md') || lowerName.endsWith('.txt')) {
        foundItems = text
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => {
             if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
               return { query: line.replace(/^[-*]|\d+\.\s*/, '').trim() };
             }
             return { query: line };
          })
          .filter(item => item.query.length > 0);
      }
      
      if (foundItems.length > 0) {
        setItems(foundItems);
        setFileName(file.name);
        
        if (autoStart) {
          onStartProcessing(foundItems, config);
        }

      } else {
        alert("No valid locations found in file.");
      }
    } catch (e) {
      console.error("File parse error:", e);
      alert("Failed to parse file.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (files && files[0]) {
      await parseFile(files[0]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setManualImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualSubmit = () => {
    if (!manualQuery.trim()) return;
    onStartProcessing([{
      query: manualQuery,
      referenceImage: manualImage || undefined
    }], config);
    setManualQuery('');
    setManualImage(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing && !isParsing) {
      if (e.type === 'dragenter' || e.type === 'dragover') {
        setDragActive(true);
      } else if (e.type === 'dragleave') {
        setDragActive(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!isProcessing && !isParsing && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const clearSelection = () => {
    setItems([]);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStart = () => {
    onStartProcessing(items, config);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 px-4">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-400 mb-3">
          GeoSprite Studio
        </h2>
        <p className="text-zinc-400 text-lg">
          Upload real-world locations to generate game sprites using Google Maps.
        </p>
      </div>

      <div className="bg-zinc-900/80 border border-zinc-700 rounded-xl p-6 shadow-xl animate-fade-in mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-zinc-300 font-medium text-sm">
             <Settings2 className="w-4 h-4 text-emerald-400" />
             <span>Generation Settings</span>
          </div>
          <button 
             onClick={() => setShowAdvanced(!showAdvanced)}
             className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
          >
             {showAdvanced ? 'Hide Advanced & Presets' : 'Show Advanced & Presets'}
             {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Art Style</label>
            <select 
              value={config.style}
              onChange={(e) => updateConfig({ style: e.target.value as SpriteStyle })}
              disabled={isProcessing}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="pixel_art">Pixel Art</option>
              <option value="isometric_pixel">Isometric Pixel Art</option>
              <option value="16_bit">16-Bit Retro</option>
              <option value="flat">Flat Design</option>
              <option value="vector">Vector Art</option>
              <option value="low_poly">Low Poly</option>
              <option value="realistic">3D Model</option>
              <option value="clay">Claymation</option>
              <option value="chibi">Chibi / Cute</option>
              <option value="watercolor">Watercolor</option>
              <option value="sketch">Sketch / Hand-drawn</option>
              <option value="neon_punk">Neon Punk</option>
            </select>
          </div>

          <div>
             <label className="block text-xs text-zinc-500 mb-1.5 flex justify-between">
               Filename Prefix
               <span className="group relative cursor-help">
                 <Info className="w-3 h-3 text-zinc-600 hover:text-zinc-400" />
                 <span className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-zinc-800 text-zinc-300 text-[10px] rounded shadow-lg hidden group-hover:block border border-zinc-700 z-50">
                   Prefix added to downloaded files.
                 </span>
               </span>
             </label>
             <input 
               type="text"
               value={config.filenamePrefix}
               onChange={(e) => updateConfig({ filenamePrefix: e.target.value })}
               placeholder="e.g. sprite_"
               disabled={isProcessing}
               className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-700"
             />
          </div>
          
          <div className="sm:col-span-2 grid grid-cols-2 gap-4">
            <div>
               <label className="block text-xs text-zinc-500 mb-1.5">Output Width (px)</label>
               <input 
                 type="number"
                 value={config.outputWidth}
                 onChange={(e) => updateConfig({ outputWidth: Math.max(64, parseInt(e.target.value) || 64) })}
                 disabled={isProcessing}
                 className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
               />
            </div>
            <div>
               <label className="block text-xs text-zinc-500 mb-1.5">Output Height (px)</label>
               <input 
                 type="number"
                 value={config.outputHeight}
                 onChange={(e) => updateConfig({ outputHeight: Math.max(64, parseInt(e.target.value) || 64) })}
                 disabled={isProcessing}
                 className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
               />
            </div>
          </div>
        </div>

        {/* Advanced Config Section */}
        {showAdvanced && (
           <div className="mt-6 pt-4 border-t border-zinc-800 animate-fade-in">
              <h4 className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-wider">Advanced Prompts & Parameters</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                 {/* Temperature Slider */}
                 <div>
                    <div className="flex justify-between mb-1.5">
                       <label className="text-xs text-zinc-500 flex items-center gap-1">
                          <Thermometer className="w-3 h-3" />
                          Creativity (Temperature)
                       </label>
                       <span className="text-xs font-mono text-emerald-400">{config.advanced?.temperature?.toFixed(1) || '1.0'}</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={config.advanced?.temperature ?? 1.0}
                      onChange={(e) => updateAdvanced({ temperature: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1">
                       Higher values increase variation and creativity; lower values are more deterministic.
                    </p>
                 </div>

                 {/* Analysis Delay Slider */}
                 <div>
                    <div className="flex justify-between mb-1.5">
                       <label className="text-xs text-zinc-500 flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          Map Analysis Delay
                       </label>
                       <span className="text-xs font-mono text-emerald-400">{config.advanced?.analysisDelay || 2}s</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={config.advanced?.analysisDelay ?? 2}
                      onChange={(e) => updateAdvanced({ analysisDelay: parseInt(e.target.value) })}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1">
                       Wait time between map analysis and generation to allow for data processing buffer.
                    </p>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 border-t border-zinc-800/50 pt-4">
                 <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Color Palette</label>
                    <input 
                       type="text" 
                       value={config.advanced?.colorPalette || ''}
                       onChange={(e) => updateAdvanced({ colorPalette: e.target.value })}
                       placeholder="e.g. pastel, neon cyberpunk, earth tones"
                       className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-700"
                    />
                 </div>
                 <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Texture Style</label>
                    <input 
                       type="text" 
                       value={config.advanced?.textureType || ''}
                       onChange={(e) => updateAdvanced({ textureType: e.target.value })}
                       placeholder="e.g. matte, glossy, grunge, hand-painted"
                       className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-700"
                    />
                 </div>
                 <div className="sm:col-span-2">
                    <label className="block text-xs text-zinc-500 mb-1.5">Detail Level</label>
                    <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-700 rounded-lg p-2">
                       {['low', 'medium', 'high'].map((level) => (
                          <label key={level} className="flex-1 flex items-center justify-center gap-2 cursor-pointer">
                             <input 
                                type="radio" 
                                name="detailLevel"
                                value={level}
                                checked={config.advanced?.detailLevel === level}
                                onChange={(e) => updateAdvanced({ detailLevel: e.target.value as 'low'|'medium'|'high' })}
                                className="text-emerald-500 focus:ring-emerald-500/20 bg-zinc-800 border-zinc-600"
                             />
                             <span className="text-xs capitalize text-zinc-300">{level}</span>
                          </label>
                       ))}
                    </div>
                 </div>
              </div>

              <h4 className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-wider">Presets</h4>
              <div className="flex gap-2 mb-4">
                 <select 
                    onChange={(e) => loadPreset(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                    value=""
                 >
                    <option value="" disabled>Load Saved Preset...</option>
                    {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
                 <div className="flex items-center gap-2 flex-1">
                    <input 
                       type="text" 
                       value={newPresetName}
                       onChange={(e) => setNewPresetName(e.target.value)}
                       placeholder="New preset name..."
                       className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-700"
                    />
                    <button 
                       onClick={savePreset}
                       disabled={!newPresetName.trim()}
                       className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 p-2 rounded-lg border border-emerald-600/30 disabled:opacity-50"
                       title="Save Current Config"
                    >
                       <Save className="w-4 h-4" />
                    </button>
                 </div>
              </div>
              {presets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                   {presets.map(p => (
                      <div key={p.id} className="flex items-center gap-1 bg-zinc-800 text-xs text-zinc-300 px-2 py-1 rounded-md border border-zinc-700">
                         <span>{p.name}</span>
                         <button onClick={() => deletePreset(p.id)} className="text-zinc-500 hover:text-red-400 ml-1"><X className="w-3 h-3" /></button>
                      </div>
                   ))}
                </div>
              )}
           </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-6">
          {/* Transparency Toggle */}
          <div className="flex items-center gap-3 bg-zinc-950/50 p-2 pr-4 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-colors">
            <div className="p-2 bg-zinc-900 rounded-md">
                <Eraser className={`w-4 h-4 ${!config.includeBackground ? 'text-emerald-400' : 'text-zinc-500'}`} />
            </div>
            <div className="flex flex-col">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-zinc-200 font-medium">Transparent Background</span>
                    <button
                        onClick={() => updateConfig({ includeBackground: !config.includeBackground })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${!config.includeBackground ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${!config.includeBackground ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                </div>
                <span className="text-[10px] text-zinc-500">
                    {!config.includeBackground ? 'Artifact removal enabled' : 'Background included'}
                </span>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              disabled={isProcessing}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-blue-500/20"
            />
            <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Auto-start on file upload</span>
          </label>
        </div>
      </div>

      {/* Manual Entry */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
         <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-3">Single Asset / Chain Generation</h4>
         <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
               <input 
                 type="text"
                 value={manualQuery}
                 onChange={(e) => setManualQuery(e.target.value)}
                 placeholder="Enter location or sprite description..."
                 className="w-full h-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
               />
            </div>
            <div className="flex items-center gap-2">
               <input 
                 ref={imageInputRef}
                 type="file" 
                 accept="image/*" 
                 className="hidden" 
                 onChange={handleImageUpload}
               />
               <button 
                 onClick={() => imageInputRef.current?.click()}
                 className={`
                   h-10 px-3 rounded-lg border flex items-center gap-2 text-xs transition-colors
                   ${manualImage ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'}
                 `}
                 title="Upload Reference Icon"
               >
                 <ImageIcon className="w-4 h-4" />
                 {manualImage ? 'Image Set' : 'Icon'}
               </button>
               {manualImage && (
                 <button onClick={() => setManualImage(null)} className="text-zinc-500 hover:text-white">
                   <X className="w-4 h-4" />
                 </button>
               )}
               <button 
                 onClick={handleManualSubmit}
                 disabled={!manualQuery.trim() || isProcessing}
                 className="h-10 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Plus className="w-4 h-4" />
               </button>
            </div>
         </div>
         {manualImage && (
           <div className="mt-2 flex items-center gap-2">
             <img src={manualImage} alt="Ref" className="w-8 h-8 rounded object-cover border border-zinc-700" />
             <span className="text-xs text-zinc-500">Reference image attached</span>
           </div>
         )}
      </div>

      {/* File Upload Area */}
      {!fileName ? (
        <div 
          className={`
            relative border-2 border-dashed rounded-xl p-10 transition-all duration-200 cursor-pointer
            flex flex-col items-center justify-center gap-4 group
            ${dragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500'}
            ${(isProcessing || isParsing) ? 'opacity-50 pointer-events-none' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".json,.md,.txt" 
            className="hidden" 
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="p-4 bg-zinc-800 rounded-full group-hover:scale-110 transition-transform">
            {isParsing ? (
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8 text-emerald-400" />
            )}
          </div>
          <div className="text-center">
            <p className="text-zinc-200 font-medium text-lg">
              {isParsing ? 'Reading file...' : 'Drop file for batch processing'}
            </p>
            <p className="text-zinc-500 text-sm mt-1">Supported: JSON (with optional 'name' field), Markdown, Text</p>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/80 border border-zinc-700 rounded-xl p-6 shadow-xl animate-fade-in">
          {/* File Header */}
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3">
               {fileName.toLowerCase().endsWith('.json') ? <FileJson className="text-amber-400" /> : <FileText className="text-blue-400" />}
               <div>
                 <h3 className="text-zinc-200 font-medium">{fileName}</h3>
                 <p className="text-xs text-zinc-500">{items.length} items</p>
               </div>
             </div>
             {!isProcessing && (
               <button onClick={clearSelection} className="text-zinc-500 hover:text-white transition-colors">
                 <X className="w-5 h-5" />
               </button>
             )}
          </div>
          
          <div className="max-h-24 overflow-y-auto bg-zinc-950/30 rounded-lg p-2 mb-6 border border-zinc-800/50 text-xs text-zinc-500">
             {items.map((item, i) => (
               <div key={i} className="py-0.5 px-1 truncate flex justify-between">
                 <span>{i + 1}. {item.query}</span>
                 {item.name && <span className="text-emerald-500/70 font-mono ml-2">[{item.name}]</span>}
               </div>
             ))}
          </div>

          <button
            onClick={handleStart}
            disabled={isProcessing}
            className={`
              w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-zinc-950 transition-all
              ${isProcessing ? 'bg-zinc-600 cursor-wait' : 'bg-emerald-400 hover:bg-emerald-300 shadow-lg shadow-emerald-500/20 active:scale-[0.98]'}
            `}
          >
            {isProcessing ? 'Processing Queue...' : 'Generate Sprites'}
            {!isProcessing && <Play className="w-4 h-4 fill-current" />}
          </button>
        </div>
      )}
    </div>
  );
};
