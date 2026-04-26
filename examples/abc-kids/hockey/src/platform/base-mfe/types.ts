export interface PlayGameInputs {}
export interface PlayGameOutputs {}

export interface ShowCoverInputs {}
export interface ShowCoverOutputs {}

export interface GetGameInfoInputs {}
export interface GetGameInfoOutputs {
  title: string;
  description: string;
  ageMin: number;
  ageMax: number;
  controls: string[];
  noCheatCodes: boolean;
}
