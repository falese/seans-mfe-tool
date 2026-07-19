'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Create tables
      await queryInterface.createTable('Berths', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        berth_id: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        berth_class: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "light_personnel | medium_freight | heavy_bulk"
          },
        occupied_flag: {
            "type": Sequelize.INTEGER,
            "allowNull": true,
            "comment": "0 or 1 — booleans were added to the schema language after this system shipped"
          },
        max_mass_kg: {
            "type": Sequelize.DECIMAL(10, 2),
            "allowNull": true
          },
        current_docking_id: {
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

      await queryInterface.createTable('Dockings', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        docking_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        berth_id: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        vessel_registry_no: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        eta_utc: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        departed_utc: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        status_code: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "SCHEDULED | APPROACH | DOCKED | DEPARTED | ABORTED"
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

      await queryInterface.createTable('ManifestLines', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        line_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        docking_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        sku: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        description: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        qty: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        declared_mass_kg: {
            "type": Sequelize.DECIMAL(10, 2),
            "allowNull": true
          },
        hazard_class: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "NONE | CRYO | CORROSIVE | RADIOLOGICAL | BIO"
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

      await queryInterface.createTable('Vessels', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        vessel_registry_no: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        vessel_name: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        operator_name: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        max_capacity_kg: {
            "type": Sequelize.DECIMAL(10, 2),
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
        'Vessels',
        'ManifestLines',
        'Dockings',
        'Berths'
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