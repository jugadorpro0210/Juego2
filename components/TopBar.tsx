import React from 'react';

interface TopBarProps {
  gold: number;
  elixir: number;
  troops: number;
}

const TopBar: React.FC<TopBarProps> = ({ gold, elixir, troops }) => {
  return (
    <div className="bg-slate-800 border-b border-slate-700 p-3 flex justify-between items-center shadow-md select-none z-10 relative">
      <div className="text-xl font-bold text-white tracking-wider hidden sm:block">VILLAGE CLASH</div>
      <div className="flex space-x-4 sm:space-x-6">
        <div className="flex items-center bg-slate-700/50 rounded-full px-3 py-1 border border-yellow-500/30 shadow-inner">
          <span className="text-xl mr-2">🪙</span>
          <span className="text-yellow-400 font-bold font-mono">{Math.floor(gold)}</span>
        </div>
        <div className="flex items-center bg-slate-700/50 rounded-full px-3 py-1 border border-fuchsia-500/30 shadow-inner">
          <span className="text-xl mr-2">💧</span>
          <span className="text-fuchsia-400 font-bold font-mono">{Math.floor(elixir)}</span>
        </div>
        <div className="flex items-center bg-slate-700/50 rounded-full px-3 py-1 border border-orange-500/30 shadow-inner">
          <span className="text-xl mr-2">⚔️</span>
          <span className="text-orange-400 font-bold font-mono">{troops}</span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
