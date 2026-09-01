const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function getLeaderboard(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getLeaderboard',
        operation: '/leaderboard',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const limit = parseInt(req.query.limit, 10) || 10;

      // DEVELOPER-OWNED. The generator scaffolds one CRUD read per resource,
      // which is right for /players and /scores and wrong here: a leaderboard
      // is not a stored row, it is an aggregate over Scores joined to Players.
      // Generated code seeds a file; it does not own it (ADR-082).
      //
      // This is also the query that makes the BFF layer a composition point
      // rather than a passthrough. Any single game's BFF can answer "how did
      // this player do at flappy". Only a query that spans games can answer
      // "who is ahead overall".
      const rows = await db.Score.findAll({
        attributes: [
          'playerId',
          [db.sequelize.fn('MAX', db.sequelize.col('points')), 'bestPoints'],
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'gamesPlayed'],
        ],
        group: ['playerId'],
        order: [[db.sequelize.literal('bestPoints'), 'DESC']],
        limit,
        raw: true,
      });

      const entries = await Promise.all(
        rows.map(async (row) => {
          const player = await db.Player.findByPk(row.playerId);
          // The game that produced the player's best score.
          const best = await db.Score.findOne({
            where: { playerId: row.playerId, points: row.bestPoints },
            order: [['achievedAt', 'DESC']],
          });
          return {
            playerId: row.playerId,
            displayName: player ? player.displayName : 'Unknown player',
            avatar: player ? player.avatar : null,
            bestPoints: Number(row.bestPoints),
            bestGameId: best ? best.gameId : null,
            gamesPlayed: Number(row.gamesPlayed),
          };
        }),
      );

      res.status(200).json(entries);
  
      logger.info('Request successful', { requestId });
    } catch (error) {
      logger.error('Request failed', { 
        requestId, 
        error: error.message 
      });
      next(error);
    }
  }

module.exports = {
  getLeaderboard
};