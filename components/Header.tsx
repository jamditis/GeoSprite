
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Box, Map } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="w-full py-6 px-4 border-b border-white/10 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-lg shadow-lg shadow-emerald-500/20">
            <Box className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">GeoSprite Studio</h1>
            <p className="text-xs text-zinc-400 font-medium flex items-center gap-1">
              <Map className="w-3 h-3 text-blue-400" />
              Powered by Google Maps & Gemini
            </p>
          </div>
        </div>
        <a 
          href="https://ai.google.dev/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hidden sm:block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Documentation
        </a>
      </div>
    </header>
  );
};
