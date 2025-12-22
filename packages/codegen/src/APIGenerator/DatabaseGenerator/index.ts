import { DatabaseGenerator  } from './DatabaseGenerator';
import { BaseGenerator  } from './generators/BaseGenerator';
import { MongoDBGenerator  } from './generators/MongoDBGenerator';
import { SQLiteGenerator  } from './generators/SQLiteGenerator';
import { SeedGenerator  } from './generators/SeedGenerator';
import { MigrationGenerator  } from './generators/MigrationGenerator';
import { MongoSchemaManager  } from './generators/MongoSchemaManager';
import { createLogger  } from '@seans-mfe-tool/logger';

const logger = createLogger({ context: 'codegen:database-index', silent: process.env.NODE_ENV === 'test' });

export {
    DatabaseGenerator,
    BaseGenerator,
    MongoDBGenerator,
    SQLiteGenerator,
    SeedGenerator,
    MigrationGenerator,
    MongoSchemaManager
};
