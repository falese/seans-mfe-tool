const { projectStructure, validateSpec } = require('../spec-validator');

describe('spec-validator', () => {
  describe('projectStructure', () => {
    it('should export the expected project structure schema', () => {
      expect(projectStructure).toBeDefined();
      expect(projectStructure).toHaveProperty('shell');
      expect(projectStructure).toHaveProperty('remotes');
      expect(projectStructure).toHaveProperty('apis');
    });

    it('should define shell structure with required properties', () => {
      expect(projectStructure.shell).toHaveProperty('name', 'string');
      expect(projectStructure.shell).toHaveProperty('port', 'number');
      expect(projectStructure.shell).toHaveProperty('type', 'string');
      expect(projectStructure.shell).toHaveProperty('theme');
      expect(projectStructure.shell.theme).toHaveProperty('primaryColor', 'string');
      expect(projectStructure.shell.theme).toHaveProperty('secondaryColor', 'string');
      expect(projectStructure.shell.theme).toHaveProperty('mode', 'string');
    });

    it('should define remotes as an array structure', () => {
      expect(Array.isArray(projectStructure.remotes)).toBe(true);
      expect(projectStructure.remotes.length).toBe(1);
      expect(projectStructure.remotes[0]).toHaveProperty('name', 'string');
      expect(projectStructure.remotes[0]).toHaveProperty('port', 'number');
      expect(projectStructure.remotes[0]).toHaveProperty('exposedComponents');
      expect(projectStructure.remotes[0]).toHaveProperty('routes');
    });

    it('should define apis as an array structure', () => {
      expect(Array.isArray(projectStructure.apis)).toBe(true);
      expect(projectStructure.apis.length).toBe(1);
      expect(projectStructure.apis[0]).toHaveProperty('name', 'string');
      expect(projectStructure.apis[0]).toHaveProperty('port', 'number');
      expect(projectStructure.apis[0]).toHaveProperty('database', 'string');
      expect(projectStructure.apis[0]).toHaveProperty('spec', 'string');
    });
  });

  describe('validateSpec', () => {
    let validSpec;

    beforeEach(() => {
      validSpec = {
        version: '1.0.0',
        name: 'test-project',
        shell: {
          name: 'test-shell',
          port: 3000
        }
      };
    });

    describe('required top-level properties', () => {
      it('should validate a minimal valid spec', () => {
        expect(() => validateSpec(validSpec)).not.toThrow();
        expect(validateSpec(validSpec)).toBe(true);
      });

      it('should throw error when version is missing', () => {
        delete validSpec.version;
        expect(() => validateSpec(validSpec)).toThrow('Missing required property: version');
      });

      it('should throw error when name is missing', () => {
        delete validSpec.name;
        expect(() => validateSpec(validSpec)).toThrow('Missing required property: name');
      });

      it('should throw error when shell is missing', () => {
        delete validSpec.shell;
        expect(() => validateSpec(validSpec)).toThrow('Missing required property: shell');
      });

      it('should throw error when version is null', () => {
        validSpec.version = null;
        expect(() => validateSpec(validSpec)).toThrow('Missing required property: version');
      });

      it('should throw error when name is empty string', () => {
        validSpec.name = '';
        expect(() => validateSpec(validSpec)).toThrow('Missing required property: name');
      });
    });

    describe('shell validation', () => {
      it('should throw error when shell.name is missing', () => {
        delete validSpec.shell.name;
        expect(() => validateSpec(validSpec)).toThrow('Shell must have name and port properties');
      });

      it('should throw error when shell.port is missing', () => {
        delete validSpec.shell.port;
        expect(() => validateSpec(validSpec)).toThrow('Shell must have name and port properties');
      });

      it('should throw error when shell.name is null', () => {
        validSpec.shell.name = null;
        expect(() => validateSpec(validSpec)).toThrow('Shell must have name and port properties');
      });

      it('should throw error when shell.port is null', () => {
        validSpec.shell.port = null;
        expect(() => validateSpec(validSpec)).toThrow('Shell must have name and port properties');
      });

      it('should allow additional shell properties', () => {
        validSpec.shell.type = 'react';
        validSpec.shell.theme = { primaryColor: '#000', secondaryColor: '#fff' };
        expect(() => validateSpec(validSpec)).not.toThrow();
      });
    });

    describe('remotes validation', () => {
      it('should allow spec without remotes', () => {
        expect(() => validateSpec(validSpec)).not.toThrow();
      });

      it('should allow empty remotes array', () => {
        validSpec.remotes = [];
        expect(() => validateSpec(validSpec)).not.toThrow();
      });

      it('should throw error when remotes is not an array', () => {
        validSpec.remotes = { name: 'remote1' };
        expect(() => validateSpec(validSpec)).toThrow('remotes must be an array');
      });

      it('should validate remote with name and port', () => {
        validSpec.remotes = [
          { name: 'remote1', port: 3001 }
        ];
        expect(() => validateSpec(validSpec)).not.toThrow();
      });

      it('should throw error when remote is missing name', () => {
        validSpec.remotes = [
          { port: 3001 }
        ];
        expect(() => validateSpec(validSpec)).toThrow('Each remote must have name and port properties');
      });

      it('should throw error when remote is missing port', () => {
        validSpec.remotes = [
          { name: 'remote1' }
        ];
        expect(() => validateSpec(validSpec)).toThrow('Each remote must have name and port properties');
      });

      it('should throw error when remote.name is null', () => {
        validSpec.remotes = [
          { name: null, port: 3001 }
        ];
        expect(() => validateSpec(validSpec)).toThrow('Each remote must have name and port properties');
      });

      it('should throw error when remote.port is undefined', () => {
        validSpec.remotes = [
          { name: 'remote1', port: undefined }
        ];
        expect(() => validateSpec(validSpec)).toThrow('Each remote must have name and port properties');
      });

      it('should validate multiple remotes', () => {
        validSpec.remotes = [
          { name: 'remote1', port: 3001 },
          { name: 'remote2', port: 3002 }
        ];
        expect(() => validateSpec(validSpec)).not.toThrow();
      });

      it('should throw error when exposedComponents is not an array', () => {
        validSpec.remotes = [
          {
            name: 'remote1',
            port: 3001,
            exposedComponents: 'Component1'
          }
        ];
        expect(() => validateSpec(validSpec)).toThrow('exposedComponents must be an array');
      });

      it('should allow exposedComponents as an array', () => {
        validSpec.remotes = [
          {
            name: 'remote1',
            port: 3001,
            exposedComponents: [
              { name: 'Component1', path: './src/Component1' }
            ]
          }
        ];
        expect(() => validateSpec(validSpec)).not.toThrow();
      });

      it('should throw error when routes is not an array', () => {
        validSpec.remotes = [
          {
            name: 'remote1',
            port: 3001,
            routes: '/dashboard'
          }
        ];
        expect(() => validateSpec(validSpec)).toThrow('routes must be an array');
      });

      it('should allow routes as an array', () => {
        validSpec.remotes = [
          {
            name: 'remote1',
            port: 3001,
            routes: [
              { path: '/dashboard', component: 'Dashboard', exact: true }
            ]
          }
        ];
        expect(() => validateSpec(validSpec)).not.toThrow();
      });

      it('should allow remotes with both exposedComponents and routes', () => {
        validSpec.remotes = [
          {
            name: 'remote1',
            port: 3001,
            exposedComponents: [{ name: 'Comp1', path: './src/Comp1' }],
            routes: [{ path: '/dashboard', component: 'Dashboard' }]
          }
        ];
        expect(() => validateSpec(validSpec)).not.toThrow();
      });
    });

    describe('apis validation', () => {
      it('should allow spec without apis', () => {
        expect(() => validateSpec(validSpec)).not.toThrow();
      });

      it('should allow empty apis array', () => {
        validSpec.apis = [];
        expect(() => validateSpec(validSpec)).not.toThrow();
      });

      it('should throw error when apis is not an array', () => {
        validSpec.apis = { name: 'api1' };
        expect(() => validateSpec(validSpec)).toThrow('apis must be an array');
      });

      it('should validate api with name, port, and database', () => {
        validSpec.apis = [
          { name: 'api1', port: 4000, database: 'mongodb' }
        ];
        expect(() => validateSpec(validSpec)).not.toThrow();
      });

      it('should throw error when api is missing name', () => {
        validSpec.apis = [
          { port: 4000, database: 'mongodb' }
        ];
        expect(() => validateSpec(validSpec)).toThrow('Each API must have name, port, and database properties');
      });

      it('should throw error when api is missing port', () => {
        validSpec.apis = [
          { name: 'api1', database: 'mongodb' }
        ];
        expect(() => validateSpec(validSpec)).toThrow('Each API must have name, port, and database properties');
      });

      it('should throw error when api is missing database', () => {
        validSpec.apis = [
          { name: 'api1', port: 4000 }
        ];
        expect(() => validateSpec(validSpec)).toThrow('Each API must have name, port, and database properties');
      });

      it('should throw error when api.name is null', () => {
        validSpec.apis = [
          { name: null, port: 4000, database: 'mongodb' }
        ];
        expect(() => validateSpec(validSpec)).toThrow('Each API must have name, port, and database properties');
      });

      it('should throw error when api.port is empty string', () => {
        validSpec.apis = [
          { name: 'api1', port: '', database: 'mongodb' }
        ];
        expect(() => validateSpec(validSpec)).toThrow('Each API must have name, port, and database properties');
      });

      it('should throw error when api.database is undefined', () => {
        validSpec.apis = [
          { name: 'api1', port: 4000, database: undefined }
        ];
        expect(() => validateSpec(validSpec)).toThrow('Each API must have name, port, and database properties');
      });

      it('should validate multiple apis', () => {
        validSpec.apis = [
          { name: 'api1', port: 4000, database: 'mongodb' },
          { name: 'api2', port: 4001, database: 'sqlite' }
        ];
        expect(() => validateSpec(validSpec)).not.toThrow();
      });

      it('should throw error when api routes is not an array', () => {
        validSpec.apis = [
          {
            name: 'api1',
            port: 4000,
            database: 'mongodb',
            routes: '/api/users'
          }
        ];
        expect(() => validateSpec(validSpec)).toThrow('API routes must be an array');
      });

      it('should allow api routes as an array', () => {
        validSpec.apis = [
          {
            name: 'api1',
            port: 4000,
            database: 'mongodb',
            routes: [
              { path: '/api/users', methods: ['GET', 'POST'] }
            ]
          }
        ];
        expect(() => validateSpec(validSpec)).not.toThrow();
      });
    });

    describe('complex validation scenarios', () => {
      it('should validate spec with shell, remotes, and apis', () => {
        validSpec.remotes = [
          {
            name: 'remote1',
            port: 3001,
            exposedComponents: [{ name: 'Comp1', path: './Comp1' }]
          }
        ];
        validSpec.apis = [
          { name: 'api1', port: 4000, database: 'mongodb' }
        ];
        expect(() => validateSpec(validSpec)).not.toThrow();
        expect(validateSpec(validSpec)).toBe(true);
      });

      it('should validate spec with multiple remotes and apis', () => {
        validSpec.remotes = [
          { name: 'remote1', port: 3001 },
          { name: 'remote2', port: 3002 },
          { name: 'remote3', port: 3003 }
        ];
        validSpec.apis = [
          { name: 'api1', port: 4000, database: 'mongodb' },
          { name: 'api2', port: 4001, database: 'sqlite' }
        ];
        expect(() => validateSpec(validSpec)).not.toThrow();
      });

      it('should fail fast on first error encountered', () => {
        delete validSpec.version;
        validSpec.shell.name = null;
        validSpec.remotes = 'not-an-array';
        // Should throw on first check (version)
        expect(() => validateSpec(validSpec)).toThrow('Missing required property: version');
      });
    });
  });
});
