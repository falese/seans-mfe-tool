'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Create tables
      await queryInterface.createTable('Modules', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        _module_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        _module_name: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        _deck_zone: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        _module_type: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "HABITAT | LIFE_SUPPORT | DOCKING | CONCOURSE | POWER"
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

      await queryInterface.createTable('Telemetrys', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        _reading_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        _module_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        _metric_kind: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "O2_PARTIAL_PRESSURE | CO2_PPM | TEMP_C | POWER_KW | PRESSURE_KPA"
          },
        _metric_value: {
            "type": Sequelize.DECIMAL(10, 2),
            "allowNull": true
          },
        _recorded_at_utc: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        _alert_level: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "NOMINAL | WATCH | CRITICAL"
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

      await queryInterface.createTable('Crews', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        _crew_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        _crew_member_name: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        _section: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "OPERATIONS | MEDICAL | ENGINEERING | HOSPITALITY"
          },
        _duty_status: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "ON_DUTY | OFF_DUTY | LEAVE"
          },
        _berth_assignment: {
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

      await queryInterface.createTable('Certifications', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        _certification_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        _crew_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        _certification_code: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "EVA | DOCKING_CONTROL | HAZMAT | MEDICAL | FOOD_SAFETY"
          },
        _expires_on_utc: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        _status: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "VALID | EXPIRING | EXPIRED"
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

      await queryInterface.createTable('Passengers', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        _passenger_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        _passenger_name: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        _docking_no: {
            "type": Sequelize.INTEGER,
            "allowNull": true,
            "comment": "The harbormaster's docking_id"
          },
        _cabin_class: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "ECONOMY | BUSINESS | STATEROOM"
          },
        _clearance_status: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "PENDING | CLEARED | FLAGGED"
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

      await queryInterface.createTable('Vendors', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        _vendor_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        _vendor_name: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        _concourse_zone: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        _cuisine_or_category: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        _license_status: {
            "type": Sequelize.TEXT,
            "allowNull": true,
            "comment": "ACTIVE | PROBATION | SUSPENDED"
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

      await queryInterface.createTable('Stalls', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        _stall_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        _vendor_id: {
            "type": Sequelize.INTEGER,
            "allowNull": true
          },
        _concourse_zone: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        _stall_no: {
            "type": Sequelize.TEXT,
            "allowNull": true
          },
        _lease_credits: {
            "type": Sequelize.DECIMAL(10, 2),
            "allowNull": true,
            "comment": "Decimal credits per period — integer cents never made it over the wall from finance"
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
        'Stalls',
        'Vendors',
        'Passengers',
        'Certifications',
        'Crews',
        'Telemetrys',
        'Modules'
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