'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Create tables
      await queryInterface.createTable('Players', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        display_name: {
            "type": Sequelize.TEXT,
            "allowNull": false
          },
        avatar: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "Emoji or asset key the shell renders"
          },
        created_at: {
            "type": Sequelize.DATE,
            "allowNull": true
          },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      }, { transaction });

      await queryInterface.createTable('NewPlayers', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        display_name: {
            "type": Sequelize.TEXT,
            "allowNull": false
          },
        avatar: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      }, { transaction });

      await queryInterface.createTable('Scores', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        player_id: {
            "type": Sequelize.TEXT,
            "allowNull": false
          },
        game_id: {
            "type": Sequelize.TEXT,
            "allowNull": false,
            "comment": "The MFE that recorded it, e.g. flappy"
          },
        points: {
            "type": Sequelize.INTEGER,
            "allowNull": false
          },
        achieved_at: {
            "type": Sequelize.DATE,
            "allowNull": true
          },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      }, { transaction });

      await queryInterface.createTable('NewScores', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        player_id: {
            "type": Sequelize.TEXT,
            "allowNull": false
          },
        game_id: {
            "type": Sequelize.TEXT,
            "allowNull": false
          },
        points: {
            "type": Sequelize.INTEGER,
            "allowNull": false
          },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      }, { transaction });

      await queryInterface.createTable('LeaderboardEntrys', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        player_id: {
            "type": Sequelize.TEXT,
            "allowNull": false
          },
        display_name: {
            "type": Sequelize.TEXT,
            "allowNull": false
          },
        avatar: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        best_points: {
            "type": Sequelize.INTEGER,
            "allowNull": false
          },
        best_game_id: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        games_played: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      }, { transaction });

      await queryInterface.createTable('Progressions', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        player_id: {
            "type": Sequelize.TEXT,
            "allowNull": false
          },
        game_id: {
            "type": Sequelize.TEXT,
            "allowNull": false
          },
        level: {
            "type": Sequelize.INTEGER,
            "allowNull": false
          },
        stars_earned: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        last_played_at: {
            "type": Sequelize.DATE,
            "allowNull": true
          },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      }, { transaction });

      // Add foreign key constraints
      

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Drop tables in reverse order
      const tables = [
        'Progressions',
        'LeaderboardEntrys',
        'NewScores',
        'Scores',
        'NewPlayers',
        'Players'
      ];

      for (const table of tables) {
        await queryInterface.dropTable(table, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};