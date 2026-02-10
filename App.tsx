import React, { useState, useEffect, useCallback } from 'react';
import { GameState, BuildingType, Position, Building, CombatResult } from './types';
import { GRID_SIZE, INITIAL_GOLD, INITIAL_ELIXIR, BUILDINGS_CONFIG, TROOP_COST_ELIXIR, TROOP_TRAIN_AMOUNT } from './constants';
import { simulateCombat } from './services/combatService';
import TopBar from './components/TopBar';
import Toast from './components/Toast';

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    gold: INITIAL_GOLD,
    elixir: INITIAL_ELIXIR,
    troops: 0,
    buildings: [
      { id: 'th-1', type: BuildingType.TOWN_HALL, level: 1, x: Math.floor(GRID_SIZE/2), y: Math.floor(GRID_SIZE/2) }
    ]
  });

  // UI State
  const [selectedCell, setSelectedCell] = useState<Position | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Game Loop: Generate resources based on buildings
  useEffect(() => {
    const interval = setInterval(() => {
      setGameState(prev => {
        let newGold = 0;
        let newElixir = 0;
        
        prev.buildings.forEach(b => {
          if (b.type === BuildingType.MINE) newGold += b.level * 1.5; // 1.5 gold per tick per level
          if (b.type === BuildingType.COLLECTOR) newElixir += b.level * 1.5; // 1.5 elixir per tick per level
        });

        if (newGold === 0 && newElixir === 0) return prev;

        return {
          ...prev,
          gold: prev.gold + newGold,
          elixir: prev.elixir + newElixir
        };
      });
    }, 1000); // 1 tick per second

    return () => clearInterval(interval);
  }, []);

  // Building Placement Logic
  const handleCellClick = (x: number, y: number) => {
    // Only open build menu if cell is empty
    const isOccupied = gameState.buildings.some(b => b.x === x && b.y === y);
    if (!isOccupied) {
      setSelectedCell({ x, y });
    } else {
      // In a more complex game, clicking a building opens upgrade/info menu.
      showToast("Space already occupied!");
    }
  };

  const closeBuildMenu = () => setSelectedCell(null);

  const buildStructure = (type: BuildingType) => {
    if (!selectedCell) return;
    const config = BUILDINGS_CONFIG[type];
    
    setGameState(prev => {
      // Check resources
      if (config.costType === 'gold' && prev.gold < config.costAmount) {
        showToast(`Not enough Gold! Need ${config.costAmount}`);
        return prev;
      }
      if (config.costType === 'elixir' && prev.elixir < config.costAmount) {
        showToast(`Not enough Elixir! Need ${config.costAmount}`);
        return prev;
      }

      // Deduct resources and add building
      const newBuilding: Building = {
        id: `${type}-${Date.now()}`,
        type,
        level: 1,
        x: selectedCell.x,
        y: selectedCell.y
      };

      closeBuildMenu();

      return {
        ...prev,
        gold: config.costType === 'gold' ? prev.gold - config.costAmount : prev.gold,
        elixir: config.costType === 'elixir' ? prev.elixir - config.costAmount : prev.elixir,
        buildings: [...prev.buildings, newBuilding]
      };
    });
  };

  // Troop Training Logic
  const trainTroops = () => {
    const totalCost = TROOP_TRAIN_AMOUNT * TROOP_COST_ELIXIR;
    const hasBarracks = gameState.buildings.some(b => b.type === BuildingType.BARRACKS);

    if (!hasBarracks) {
      showToast("You need a Barracks to train troops!");
      setIsTrainingModalOpen(false);
      return;
    }

    setGameState(prev => {
      if (prev.elixir < totalCost) {
        showToast(`Not enough Elixir! Need ${totalCost} for ${TROOP_TRAIN_AMOUNT} troops.`);
        return prev;
      }
      setIsTrainingModalOpen(false);
      return {
        ...prev,
        elixir: prev.elixir - totalCost,
        troops: prev.troops + TROOP_TRAIN_AMOUNT
      };
    });
  };

  // Combat Logic
  const handleAttack = async () => {
    if (gameState.troops <= 0) {
      showToast("You need troops to attack!");
      return;
    }

    setIsAttacking(true);
    setCombatResult(null);

    const result = await simulateCombat(gameState.troops);
    
    setCombatResult(result);
    setIsAttacking(false);

    setGameState(prev => ({
      ...prev,
      gold: prev.gold + result.goldLooted,
      elixir: prev.elixir + result.elixirLooted,
      troops: Math.max(0, prev.troops - result.troopsLost)
    }));
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 overflow-hidden font-sans">
      <TopBar gold={gameState.gold} elixir={gameState.elixir} troops={gameState.troops} />
      <Toast message={toastMessage} />

      {/* Main Game Area */}
      <div className="flex-1 relative flex items-center justify-center p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-800">
        
        {/* The Village Grid */}
        <div 
          className="bg-emerald-700 p-2 sm:p-4 rounded-xl shadow-2xl shadow-emerald-900/50 border border-emerald-800/50"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            gap: '4px',
            width: '100%',
            maxWidth: '600px',
            aspectRatio: '1 / 1'
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
            const x = index % GRID_SIZE;
            const y = Math.floor(index / GRID_SIZE);
            const building = gameState.buildings.find(b => b.x === x && b.y === y);
            const isSelected = selectedCell?.x === x && selectedCell?.y === y;

            return (
              <div
                key={index}
                onClick={() => handleCellClick(x, y)}
                className={`
                  relative rounded flex items-center justify-center cursor-pointer transition-colors duration-200
                  ${building ? 'bg-emerald-600/80 hover:bg-emerald-500' : 'bg-emerald-800/50 hover:bg-emerald-600/50'}
                  ${isSelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-emerald-700 bg-emerald-500' : ''}
                  border border-emerald-900/30
                `}
              >
                {building && (
                  <span className="text-2xl sm:text-3xl drop-shadow-md select-none transform transition-transform hover:scale-110">
                    {BUILDINGS_CONFIG[building.type].symbol}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-slate-800 border-t border-slate-700 p-4 flex justify-center gap-4 z-10 relative">
        <button
          onClick={() => setIsTrainingModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2"
        >
          <span className="text-xl">⚔️</span>
          <span>Train Troops</span>
        </button>
        <button
          onClick={() => {
            if (gameState.troops === 0) showToast("Train some troops first!");
            else setIsAttacking(true); // Open attack confirmation modal
          }}
          className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2"
        >
          <span className="text-xl">🔥</span>
          <span>Attack</span>
        </button>
      </div>

      {/* --- Modals --- */}

      {/* Build Menu Modal */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeBuildMenu}>
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Construct Building</h2>
              <button onClick={closeBuildMenu} className="text-slate-400 hover:text-white transition-colors">
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.values(BUILDINGS_CONFIG).filter(b => b.type !== BuildingType.TOWN_HALL).map((config) => (
                <button
                  key={config.type}
                  onClick={() => buildStructure(config.type)}
                  className="bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl p-4 flex flex-col items-center gap-2 transition-all active:scale-95 group"
                >
                  <span className="text-4xl group-hover:scale-110 transition-transform">{config.symbol}</span>
                  <span className="font-bold text-slate-200">{config.name}</span>
                  <div className="flex items-center gap-1 bg-slate-800 px-3 py-1 rounded-full text-sm">
                    <span>{config.costType === 'gold' ? '🪙' : '💧'}</span>
                    <span className={config.costType === 'gold' ? 'text-yellow-400' : 'text-fuchsia-400'}>
                      {config.costAmount}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 text-center mt-1">{config.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Train Troops Modal */}
      {isTrainingModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsTrainingModalOpen(false)}>
           <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4">Barracks</h2>
            <div className="text-6xl mb-4">⚔️</div>
            <p className="text-slate-300 mb-6">
              Train a batch of {TROOP_TRAIN_AMOUNT} mighty Barbarians to raid enemy villages!
            </p>
            <button
              onClick={trainTroops}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow flex items-center justify-center gap-3 transition-colors"
            >
              <span>Train {TROOP_TRAIN_AMOUNT}x</span>
              <div className="flex items-center gap-1 bg-blue-800/50 px-2 py-1 rounded">
                <span>💧</span>
                <span className="text-fuchsia-300">{TROOP_TRAIN_AMOUNT * TROOP_COST_ELIXIR}</span>
              </div>
            </button>
            <button 
              onClick={() => setIsTrainingModalOpen(false)}
              className="mt-4 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
           </div>
        </div>
      )}

      {/* Attack Confirmation / Loading / Result Modal */}
      {(isAttacking || combatResult) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => { if(combatResult) setCombatResult(null); }}>
          <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            
            {!combatResult && isAttacking && (
              <div className="text-center py-8">
                <h2 className="text-3xl font-bold text-red-500 mb-4 animate-pulse">Searching for Opponent...</h2>
                <div className="text-6xl mb-6 animate-bounce">⚔️</div>
                <p className="text-slate-300 text-lg">Your {gameState.troops} barbarians are marching into the unknown...</p>
                <button 
                   onClick={() => handleAttack()}
                   className="mt-8 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-full shadow-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all"
                >
                  Start Battle!
                </button>
                <div className="mt-4">
                  <button onClick={() => setIsAttacking(false)} className="text-slate-500 hover:text-white">Retreat</button>
                </div>
              </div>
            )}

            {combatResult && (
              <div className="text-center">
                <h2 className="text-3xl font-bold text-amber-500 mb-2">Battle Report</h2>
                <div className="h-px bg-slate-700 w-full mb-6"></div>
                
                <p className="text-slate-200 text-lg italic mb-8 leading-relaxed">
                  "{combatResult.report}"
                </p>

                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-slate-700 rounded-xl p-3 border border-yellow-500/30 flex flex-col items-center">
                    <span className="text-sm text-slate-400 mb-1">Gold Looted</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xl">🪙</span>
                      <span className="text-yellow-400 font-bold text-xl">+{combatResult.goldLooted}</span>
                    </div>
                  </div>
                  <div className="bg-slate-700 rounded-xl p-3 border border-fuchsia-500/30 flex flex-col items-center">
                    <span className="text-sm text-slate-400 mb-1">Elixir Looted</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xl">💧</span>
                      <span className="text-fuchsia-400 font-bold text-xl">+{combatResult.elixirLooted}</span>
                    </div>
                  </div>
                  <div className="bg-slate-700 rounded-xl p-3 border border-red-500/30 flex flex-col items-center">
                    <span className="text-sm text-slate-400 mb-1">Troops Lost</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xl">🪦</span>
                      <span className="text-red-400 font-bold text-xl">-{combatResult.troopsLost}</span>
                    </div>
                  </div>
                </div>

                <button 
                   onClick={() => setCombatResult(null)}
                   className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow transition-colors text-lg"
                >
                  Return to Village
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
