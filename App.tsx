import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { GameState, BuildingType, Position, Building, CombatResult } from './types';
import { GRID_SIZE, INITIAL_GOLD, INITIAL_ELIXIR, BUILDINGS_CONFIG, TROOP_COST_ELIXIR, TROOP_TRAIN_AMOUNT, getUpgradeCost } from './constants';
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
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);

  // Image Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorImage, setEditorImage] = useState<string | null>(null);
  const [editorMimeType, setEditorMimeType] = useState<string | null>(null);
  const [editorPrompt, setEditorPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

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
          if (b.type === BuildingType.MINE) newGold += b.level * 1.5;
          if (b.type === BuildingType.COLLECTOR) newElixir += b.level * 1.5;
        });

        if (newGold === 0 && newElixir === 0) return prev;

        return {
          ...prev,
          gold: prev.gold + newGold,
          elixir: prev.elixir + newElixir
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Building Placement & Selection Logic
  const handleCellClick = (x: number, y: number) => {
    const building = gameState.buildings.find(b => b.x === x && b.y === y);
    if (building) {
      setSelectedBuilding(building);
      setSelectedCell(null);
    } else {
      setSelectedCell({ x, y });
      setSelectedBuilding(null);
    }
  };

  const closeBuildMenu = () => setSelectedCell(null);

  const buildStructure = (type: BuildingType) => {
    if (!selectedCell) return;
    const config = BUILDINGS_CONFIG[type];
    
    setGameState(prev => {
      if (config.costType === 'gold' && prev.gold < config.costAmount) {
        showToast(`Not enough Gold! Need ${config.costAmount}`);
        return prev;
      }
      if (config.costType === 'elixir' && prev.elixir < config.costAmount) {
        showToast(`Not enough Elixir! Need ${config.costAmount}`);
        return prev;
      }

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

  // Upgrade Logic
  const upgradeBuilding = () => {
    if (!selectedBuilding) return;

    const config = BUILDINGS_CONFIG[selectedBuilding.type];
    const cost = getUpgradeCost(config.costAmount, selectedBuilding.level);

    setGameState(prev => {
      const targetBuilding = prev.buildings.find(b => b.id === selectedBuilding.id);
      if (!targetBuilding) return prev;

      if (config.costType === 'gold' && prev.gold < cost) {
        showToast(`Not enough Gold! Need ${cost}`);
        return prev;
      }
      if (config.costType === 'elixir' && prev.elixir < cost) {
        showToast(`Not enough Elixir! Need ${cost}`);
        return prev;
      }

      return {
        ...prev,
        gold: config.costType === 'gold' ? prev.gold - cost : prev.gold,
        elixir: config.costType === 'elixir' ? prev.elixir - cost : prev.elixir,
        buildings: prev.buildings.map(b =>
          b.id === selectedBuilding.id ? { ...b, level: b.level + 1 } : b
        )
      };
    });
    setSelectedBuilding(null);
  };

  // Troop Training Logic
  const getTrainingCapacity = useCallback(() => {
    return gameState.buildings
      .filter(b => b.type === BuildingType.BARRACKS)
      .reduce((sum, b) => sum + (TROOP_TRAIN_AMOUNT * b.level), 0);
  }, [gameState.buildings]);

  const trainTroops = () => {
    const capacity = getTrainingCapacity();
    const totalCost = capacity * TROOP_COST_ELIXIR;

    if (capacity <= 0) {
      showToast("You need a Barracks to train troops!");
      setIsTrainingModalOpen(false);
      return;
    }

    setGameState(prev => {
      if (prev.elixir < totalCost) {
        showToast(`Not enough Elixir! Need ${totalCost} for ${capacity} troops.`);
        return prev;
      }
      setIsTrainingModalOpen(false);
      return {
        ...prev,
        elixir: prev.elixir - totalCost,
        troops: prev.troops + capacity
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

  // Image Editor Handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setEditorImage(base64String);
        setEditorMimeType(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditImage = async () => {
    if (!editorImage || !editorPrompt || !editorMimeType) return;
    setIsEditing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: editorImage,
                mimeType: editorMimeType,
              },
            },
            {
              text: editorPrompt,
            },
          ],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setEditorImage(part.inlineData.data);
          setEditorMimeType(part.inlineData.mimeType || 'image/png');
          break;
        }
      }
    } catch (e) {
      console.error(e);
      showToast("Image editing failed! Check your API key or prompt.");
    } finally {
      setIsEditing(false);
    }
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
            const isBuildingSelected = selectedBuilding?.x === x && selectedBuilding?.y === y;

            return (
              <div
                key={index}
                onClick={() => handleCellClick(x, y)}
                className={`
                  relative rounded flex items-center justify-center cursor-pointer transition-all duration-200
                  ${building ? 'bg-emerald-600/80 hover:bg-emerald-500' : 'bg-emerald-800/50 hover:bg-emerald-600/50'}
                  ${isSelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-emerald-700 bg-emerald-500' : ''}
                  ${isBuildingSelected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-emerald-700 scale-105 z-10' : ''}
                  border border-emerald-900/30
                `}
              >
                {building && (
                  <div className="relative flex items-center justify-center w-full h-full">
                    <span className="text-2xl sm:text-3xl drop-shadow-md select-none transform transition-transform hover:scale-110">
                      {BUILDINGS_CONFIG[building.type].symbol}
                    </span>
                    <div className="absolute -bottom-1 -right-1 bg-black/70 text-white text-[10px] font-bold px-1 rounded">
                      Lvl {building.level}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-slate-800 border-t border-slate-700 p-4 flex flex-wrap justify-center gap-4 z-10 relative">
        <button
          onClick={() => setIsTrainingModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 sm:px-6 rounded-lg shadow-lg border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2"
        >
          <span className="text-xl">⚔️</span>
          <span className="hidden sm:inline">Train Troops</span>
        </button>
        <button
          onClick={() => setIsEditorOpen(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 sm:px-6 rounded-lg shadow-lg border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2"
        >
          <span className="text-xl">🎨</span>
          <span className="hidden sm:inline">Magic Banner</span>
        </button>
        <button
          onClick={() => {
            if (gameState.troops === 0) showToast("Train some troops first!");
            else setIsAttacking(true);
          }}
          className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 sm:px-6 rounded-lg shadow-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2"
        >
          <span className="text-xl">🔥</span>
          <span className="hidden sm:inline">Attack</span>
        </button>
      </div>

      {/* --- Modals --- */}

      {/* Build Menu Modal */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeBuildMenu}>
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Construct Building</h2>
              <button onClick={closeBuildMenu} className="text-slate-400 hover:text-white transition-colors">✕</button>
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

      {/* Upgrade Menu Modal */}
      {selectedBuilding && (() => {
        const config = BUILDINGS_CONFIG[selectedBuilding.type];
        const upgradeCost = getUpgradeCost(config.costAmount, selectedBuilding.level);
        const nextLevel = selectedBuilding.level + 1;

        let benefits = '';
        if (selectedBuilding.type === BuildingType.MINE || selectedBuilding.type === BuildingType.COLLECTOR) {
          benefits = `Production: ${selectedBuilding.level * 1.5}/s ➔ ${nextLevel * 1.5}/s`;
        } else if (selectedBuilding.type === BuildingType.BARRACKS) {
          benefits = `Capacity: ${selectedBuilding.level * TROOP_TRAIN_AMOUNT} ➔ ${nextLevel * TROOP_TRAIN_AMOUNT}`;
        } else if (selectedBuilding.type === BuildingType.CANNON) {
          benefits = `Defense Level: ${selectedBuilding.level} ➔ ${nextLevel}`;
        } else {
          benefits = `Level ${selectedBuilding.level} ➔ ${nextLevel}`;
        }

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedBuilding(null)}>
            <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700 shadow-2xl flex flex-col items-center" onClick={e => e.stopPropagation()}>
              <span className="text-6xl mb-2">{config.symbol}</span>
              <h2 className="text-2xl font-bold text-white mb-1">{config.name}</h2>
              <p className="text-slate-400 mb-4">Current Level: <span className="text-white font-bold">{selectedBuilding.level}</span></p>
              
              <div className="bg-slate-700/50 w-full p-3 rounded-lg border border-slate-600 mb-6 text-center">
                <p className="text-emerald-400 font-semibold">{benefits}</p>
              </div>

              <button
                onClick={upgradeBuilding}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors mb-3"
              >
                <span>Upgrade</span>
                <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded">
                  <span>{config.costType === 'gold' ? '🪙' : '💧'}</span>
                  <span className={config.costType === 'gold' ? 'text-yellow-300' : 'text-fuchsia-300'}>
                    {upgradeCost}
                  </span>
                </div>
              </button>
              <button 
                onClick={() => setSelectedBuilding(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {/* Train Troops Modal */}
      {isTrainingModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsTrainingModalOpen(false)}>
           <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4">Barracks</h2>
            <div className="text-6xl mb-4">⚔️</div>
            
            {getTrainingCapacity() > 0 ? (
              <>
                <p className="text-slate-300 mb-6">
                  Train a batch of <span className="font-bold text-white">{getTrainingCapacity()}</span> mighty Barbarians to raid enemy villages!
                </p>
                <button
                  onClick={trainTroops}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow flex items-center justify-center gap-3 transition-colors"
                >
                  <span>Train {getTrainingCapacity()}x</span>
                  <div className="flex items-center gap-1 bg-blue-800/50 px-2 py-1 rounded">
                    <span>💧</span>
                    <span className="text-fuchsia-300">{getTrainingCapacity() * TROOP_COST_ELIXIR}</span>
                  </div>
                </button>
              </>
            ) : (
              <p className="text-red-400 mb-6 font-semibold">You need to build a Barracks first!</p>
            )}

            <button 
              onClick={() => setIsTrainingModalOpen(false)}
              className="mt-4 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
           </div>
        </div>
      )}

      {/* Magic Image Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setIsEditorOpen(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 max-w-xl w-full border border-slate-700 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2"><span className="text-purple-400">✨</span> Magic Banner Editor</h2>
              <button onClick={() => setIsEditorOpen(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <p className="text-slate-400 mb-4 text-sm">Design a legendary banner for your village! Upload an image and use text prompts to edit it with Gemini 2.5 Flash Image.</p>

            {!editorImage ? (
              <div className="border-2 border-dashed border-slate-600 rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-700/50 transition-colors">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="banner-upload" />
                <label htmlFor="banner-upload" className="cursor-pointer flex flex-col items-center w-full h-full">
                  <span className="text-5xl mb-4">📸</span>
                  <span className="text-slate-200 font-semibold text-lg">Upload an image to start editing</span>
                  <span className="text-slate-500 mt-2">Supports PNG, JPG</span>
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="relative rounded-xl overflow-hidden bg-black/50 flex items-center justify-center border border-slate-600 min-h-[250px] max-h-[400px]">
                  <img src={`data:${editorMimeType};base64,${editorImage}`} alt="Banner" className="max-w-full max-h-full object-contain" />
                  {isEditing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin text-purple-500 text-5xl">🪄</div>
                        <span className="text-white font-semibold animate-pulse">Casting spell...</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editorPrompt}
                    onChange={(e) => setEditorPrompt(e.target.value)}
                    placeholder="e.g., Add a retro filter, make it look like a cartoon..."
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    disabled={isEditing}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditImage();
                    }}
                  />
                  <button
                    onClick={handleEditImage}
                    disabled={isEditing || !editorPrompt}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow transition-colors whitespace-nowrap"
                  >
                    Generate
                  </button>
                </div>
                <button
                  onClick={() => { setEditorImage(null); setEditorMimeType(null); setEditorPrompt(''); }}
                  className="text-sm text-slate-400 hover:text-red-400 self-end"
                >
                  Clear Image
                </button>
              </div>
            )}
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
