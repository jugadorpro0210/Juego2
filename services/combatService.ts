import { GoogleGenAI, Type } from '@google/genai';
import { CombatResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const simulateCombat = async (troops: number): Promise<CombatResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Combat cannot be simulated.");
  }

  const prompt = `
    The player is attacking an enemy goblin village with an army of ${troops} barbarians. 
    Generate a thrilling, 2-sentence battle report describing the clash. 
    Determine the outcome and loot. The enemy defenses vary in strength randomly. 
    Max potential loot is around ${troops * 30} gold and elixir. 
    The more troops used, the higher the chance of securing big loot, but also expect some losses in combat.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are an epic battle narrator for a fantasy strategy base-building game.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            report: {
              type: Type.STRING,
              description: "A short, exciting 2-sentence story about how the battle went."
            },
            goldLooted: {
              type: Type.INTEGER,
              description: "Amount of gold stolen from the enemy. Scale based on troop count."
            },
            elixirLooted: {
              type: Type.INTEGER,
              description: "Amount of elixir stolen from the enemy. Scale based on troop count."
            },
            troopsLost: {
              type: Type.INTEGER,
              description: "Number of troops that died. Must be between 0 and the total troops sent."
            }
          },
          required: ["report", "goldLooted", "elixirLooted", "troopsLost"]
        }
      }
    });

    const resultText = response.text || "{}";
    const resultData = JSON.parse(resultText) as CombatResult;
    
    // Ensure logical bounds just in case the model hallucinates
    return {
      report: resultData.report || "The battle was a blur of chaos!",
      goldLooted: Math.max(0, resultData.goldLooted || 0),
      elixirLooted: Math.max(0, resultData.elixirLooted || 0),
      troopsLost: Math.max(0, Math.min(troops, resultData.troopsLost || 0))
    };

  } catch (error) {
    console.error("Combat simulation failed:", error);
    // Fallback if API fails
    return {
      report: "The battle was simulated offline due to a mystical interference (API error). Your troops fought bravely.",
      goldLooted: troops * 10,
      elixirLooted: troops * 10,
      troopsLost: Math.floor(troops * 0.2)
    };
  }
};
