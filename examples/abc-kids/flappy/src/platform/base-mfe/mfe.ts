import {
  RemoteMFE,
  type Context,
  type LoadResult,
  type RenderResult,
} from '@seans-mfe-tool/runtime';

import type { PlayGameOutputs, ShowCoverOutputs, GetGameInfoOutputs } from './types';

export class AbcKidsFlappyMFE extends RemoteMFE {
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
      title: 'Flappy Bird',
      description: 'Tap to flap and fly through pipes! Beat your high score.',
      ageMin: 4,
      ageMax: 10,
      controls: ['Tap screen', 'Press Space bar'],
      noCheatCodes: true,
    };
  }
}
