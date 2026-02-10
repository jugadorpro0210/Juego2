import { BuildingType } from './types';

export const GRID_SIZE = 12;

export const INITIAL_GOLD = 500;
export const INITIAL_ELIXIR = 500;

export const TROOP_COST_ELIXIR = 10;
export const TROOP_TRAIN_AMOUNT = 5;

export interface BuildingConfig {
  name: string;
  type: BuildingType;
  symbol: string;
  costType: 'gold' | 'elixir';
  costAmount: number;
  description: string;
}

export const BUILDINGS_CONFIG: Record<BuildingType, BuildingConfig> = {
  [BuildingType.TOWN_HALL]: {
    name: 'Town Hall',
    type: BuildingType.TOWN_HALL,
    symbol: '🏰',
    costType: 'gold',
    costAmount: 1000,
    description: 'The heart of your village.'
  },
  [BuildingType.MINE]: {
    name: 'Gold Mine',
    type: BuildingType.MINE,
    symbol: '⛏️',
    costType: 'elixir',
    costAmount: 100,
    description: 'Produces Gold over time.'
  },
  [BuildingType.COLLECTOR]: {
    name: 'Elixir Collector',
    type: BuildingType.COLLECTOR,
    symbol: '⚗️',
    costType: 'gold',
    costAmount: 100,
    description: 'Produces Elixir over time.'
  },
  [BuildingType.BARRACKS]: {
    name: 'Barracks',
    type: BuildingType.BARRACKS,
    symbol: '⚔️',
    costType: 'gold',
    costAmount: 200,
    description: 'Allows you to train troops.'
  },
  [BuildingType.CANNON]: {
    name: 'Cannon',
    type: BuildingType.CANNON,
    symbol: '💣',
    costType: 'gold',
    costAmount: 250,
    description: 'Defends your village.'
  }
};

export const getUpgradeCost = (baseCost: number, currentLevel: number): number => {
  return Math.floor(baseCost * Math.pow(1.5, currentLevel));
};
