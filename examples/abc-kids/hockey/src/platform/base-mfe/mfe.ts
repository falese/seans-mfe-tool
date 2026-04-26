import {
  RemoteMFE,
  type Context,
  type LoadResult,
  type RenderResult,
} from '@seans-mfe-tool/runtime';

import type { PlayGameOutputs, ShowCoverOutputs, GetGameInfoOutputs } from './types';

export class AbcKidsHockeyMFE extends RemoteMFE {
  constructor(manifest: any) {
    super(manifest);
  }

  protected async doLoad(context: Context): Promise<LoadResult> {
    return super.doLoad(context);
  }

  protected async doRender(context: Context): Promise<RenderResult> {
    return super.doRender(context);
  }

  async PlayGame(context: Context): Promise<PlayGameOutputs> {
    return {};
  }

  async ShowCover(context: Context): Promise<ShowCoverOutputs> {
    return {};
  }

  async GetGameInfo(context: Context): Promise<GetGameInfoOutputs> {
    return {
      title: 'Ice Hockey',
      description: 'Move your paddle and score goals against the AI!',
      ageMin: 5,
      ageMax: 12,
      controls: ['Arrow keys to move', 'WASD to move'],
      noCheatCodes: true,
    };
  }
}
