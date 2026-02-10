export enum BuildingType {
  TOWN_HALL = 'TOWN_HALL',
  MINE = 'MINE',
  COLLECTOR = 'COLLECTOR',
  BARRACKS = 'BARRACKS',
  CANNON = 'CANNON'
}

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  x: number;
  y: number;
}

export interface GameState {
  gold: number;
  elixir: number;
  troops: number;
  buildings: Building[];
}

export interface CombatResult {
  report: string;
  goldLooted: number;
  elixirLooted: number;
  troopsLost: number;
}

export interface Position {
  x: number;
  y: number;
}
