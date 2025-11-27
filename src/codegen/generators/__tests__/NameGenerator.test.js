const { NameGenerator } = require('../NameGenerator');

describe('NameGenerator', () => {
  describe('toCamelCase', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(NameGenerator.toCamelCase('user-profile')).toBe('userProfile');
    });

    it('should convert snake_case to camelCase', () => {
      expect(NameGenerator.toCamelCase('user_profile')).toBe('userProfile');
    });

    it('should handle PascalCase input', () => {
      expect(NameGenerator.toCamelCase('UserProfile')).toBe('userProfile');
    });

    it('should handle empty string', () => {
      expect(NameGenerator.toCamelCase('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(NameGenerator.toCamelCase(null)).toBe('');
      expect(NameGenerator.toCamelCase(undefined)).toBe('');
    });

    it('should handle special characters', () => {
      expect(NameGenerator.toCamelCase('user@profile#test')).toBe('userProfileTest');
    });

    it('should handle numbers', () => {
      expect(NameGenerator.toCamelCase('user123profile')).toBe('user123profile');
    });
  });

  describe('toPascalCase', () => {
    it('should convert kebab-case to PascalCase', () => {
      expect(NameGenerator.toPascalCase('user-profile')).toBe('UserProfile');
    });

    it('should convert snake_case to PascalCase', () => {
      expect(NameGenerator.toPascalCase('user_profile')).toBe('UserProfile');
    });

    it('should handle camelCase input', () => {
      expect(NameGenerator.toPascalCase('userProfile')).toBe('UserProfile');
    });

    it('should handle empty string', () => {
      expect(NameGenerator.toPascalCase('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(NameGenerator.toPascalCase(null)).toBe('');
      expect(NameGenerator.toPascalCase(undefined)).toBe('');
    });

    it('should handle special characters', () => {
      expect(NameGenerator.toPascalCase('user@profile#test')).toBe('UserProfileTest');
    });

    it('should handle numbers', () => {
      expect(NameGenerator.toPascalCase('user123profile')).toBe('User123profile');
    });
  });

  describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(NameGenerator.toKebabCase('userProfile')).toBe('user-profile');
    });

    it('should convert PascalCase to kebab-case', () => {
      expect(NameGenerator.toKebabCase('UserProfile')).toBe('user-profile');
    });

    it('should handle snake_case input', () => {
      expect(NameGenerator.toKebabCase('user_profile')).toBe('user-profile');
    });

    it('should handle empty string', () => {
      expect(NameGenerator.toKebabCase('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(NameGenerator.toKebabCase(null)).toBe('');
      expect(NameGenerator.toKebabCase(undefined)).toBe('');
    });

    it('should handle special characters', () => {
      expect(NameGenerator.toKebabCase('user@profile#test')).toBe('user-profile-test');
    });

    it('should handle consecutive capitals', () => {
      expect(NameGenerator.toKebabCase('XMLParser')).toBe('xmlparser');
    });
  });

  describe('toSingular', () => {
    it('should convert plural ending in "s" to singular', () => {
      expect(NameGenerator.toSingular('users')).toBe('user');
    });

    it('should convert plural ending in "ies" to singular', () => {
      expect(NameGenerator.toSingular('categories')).toBe('category');
    });

    it('should not modify words ending in "ss"', () => {
      expect(NameGenerator.toSingular('address')).toBe('address');
    });

    it('should handle already singular words', () => {
      expect(NameGenerator.toSingular('user')).toBe('user');
    });

    it('should handle empty string', () => {
      expect(NameGenerator.toSingular('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(NameGenerator.toSingular(null)).toBe('');
      expect(NameGenerator.toSingular(undefined)).toBe('');
    });

    it('should handle edge case with "ies"', () => {
      expect(NameGenerator.toSingular('stories')).toBe('story');
    });
  });

  describe('toPlural', () => {
    it('should convert singular to plural with "s"', () => {
      expect(NameGenerator.toPlural('user')).toBe('users');
    });

    it('should convert singular ending in "y" to "ies"', () => {
      expect(NameGenerator.toPlural('category')).toBe('categories');
    });

    it('should handle words ending in "s"', () => {
      expect(NameGenerator.toPlural('address')).toBe('addresses');
    });

    it('should handle words ending in "sh"', () => {
      expect(NameGenerator.toPlural('dish')).toBe('dishes');
    });

    it('should handle words ending in "ch"', () => {
      expect(NameGenerator.toPlural('church')).toBe('churches');
    });

    it('should handle words ending in "x"', () => {
      expect(NameGenerator.toPlural('box')).toBe('boxes');
    });

    it('should handle empty string', () => {
      expect(NameGenerator.toPlural('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(NameGenerator.toPlural(null)).toBe('');
      expect(NameGenerator.toPlural(undefined)).toBe('');
    });
  });

  describe('toModelName', () => {
    it('should return singular PascalCase for plural resource', () => {
      expect(NameGenerator.toModelName('users')).toBe('User');
    });

    it('should handle resource ending in "ies"', () => {
      expect(NameGenerator.toModelName('categories')).toBe('Category');
    });

    it('should handle kebab-case resource names', () => {
      expect(NameGenerator.toModelName('user-profiles')).toBe('UserProfile');
    });

    it('should handle empty string', () => {
      expect(NameGenerator.toModelName('')).toBe('');
    });

    it('should handle already singular resource', () => {
      expect(NameGenerator.toModelName('user')).toBe('User');
    });
  });

  describe('toMongooseName', () => {
    it('should return plural PascalCase for singular resource', () => {
      expect(NameGenerator.toMongooseName('user')).toBe('Users');
    });

    it('should handle plural resource', () => {
      expect(NameGenerator.toMongooseName('users')).toBe('Users');
    });

    it('should handle resource ending in "y"', () => {
      expect(NameGenerator.toMongooseName('category')).toBe('Categories');
    });

    it('should handle kebab-case resource names', () => {
      expect(NameGenerator.toMongooseName('user-profile')).toBe('UserProfiles');
    });

    it('should handle empty string', () => {
      expect(NameGenerator.toMongooseName('')).toBe('');
    });
  });

  describe('toFileName', () => {
    it('should generate model file name from resource', () => {
      expect(NameGenerator.toFileName('users')).toBe('User.model.js');
    });

    it('should handle singular resource', () => {
      expect(NameGenerator.toFileName('user')).toBe('User.model.js');
    });

    it('should handle kebab-case resource', () => {
      expect(NameGenerator.toFileName('user-profiles')).toBe('UserProfile.model.js');
    });

    it('should handle resource ending in "ies"', () => {
      expect(NameGenerator.toFileName('categories')).toBe('Category.model.js');
    });

    it('should handle empty string', () => {
      expect(NameGenerator.toFileName('')).toBe('.model.js');
    });
  });

  describe('getRouteName', () => {
    it('should extract route name from path', () => {
      expect(NameGenerator.getRouteName('/users')).toBe('users');
    });

    it('should handle path with parameters', () => {
      expect(NameGenerator.getRouteName('/users/{id}')).toBe('users');
    });

    it('should convert camelCase to kebab-case', () => {
      expect(NameGenerator.getRouteName('/userProfiles')).toBe('user-profiles');
    });

    it('should handle nested paths', () => {
      expect(NameGenerator.getRouteName('/users/{id}/posts')).toBe('users');
    });

    it('should handle PascalCase', () => {
      expect(NameGenerator.getRouteName('/UserProfiles')).toBe('user-profiles');
    });
  });

  describe('getControllerName', () => {
    it('should generate controller name from resource', () => {
      expect(NameGenerator.getControllerName('users')).toBe('usersController');
    });

    it('should handle kebab-case resource', () => {
      expect(NameGenerator.getControllerName('user-profiles')).toBe('userProfilesController');
    });

    it('should handle PascalCase resource', () => {
      expect(NameGenerator.getControllerName('UserProfiles')).toBe('userProfilesController');
    });

    it('should handle empty string', () => {
      expect(NameGenerator.getControllerName('')).toBe('Controller');
    });
  });

  describe('normalizePathParams', () => {
    it('should convert OpenAPI params to Express params', () => {
      expect(NameGenerator.normalizePathParams('/users/{id}')).toBe('/users/:id');
    });

    it('should handle multiple parameters', () => {
      expect(NameGenerator.normalizePathParams('/users/{userId}/posts/{postId}')).toBe('/users/:userId/posts/:postId');
    });

    it('should handle path without parameters', () => {
      expect(NameGenerator.normalizePathParams('/users')).toBe('/users');
    });

    it('should handle empty string', () => {
      expect(NameGenerator.normalizePathParams('')).toBe('');
    });

    it('should handle complex parameter names', () => {
      expect(NameGenerator.normalizePathParams('/users/{user_id}')).toBe('/users/:user_id');
    });
  });

  describe('generateControllerMethodName', () => {
    it('should generate GET collection method name', () => {
      expect(NameGenerator.generateControllerMethodName('get', 'users', '/users')).toBe('getAllUsers');
    });

    it('should generate POST collection method name', () => {
      expect(NameGenerator.generateControllerMethodName('post', 'users', '/users')).toBe('createUsers');
    });

    it('should generate GET by ID method name', () => {
      expect(NameGenerator.generateControllerMethodName('get', 'users', '/users/{id}')).toBe('getUsersById');
    });

    it('should generate PUT by ID method name', () => {
      expect(NameGenerator.generateControllerMethodName('put', 'users', '/users/{id}')).toBe('updateUsers');
    });

    it('should generate PATCH by ID method name', () => {
      expect(NameGenerator.generateControllerMethodName('patch', 'users', '/users/{id}')).toBe('patchUsers');
    });

    it('should generate DELETE by ID method name', () => {
      expect(NameGenerator.generateControllerMethodName('delete', 'users', '/users/{id}')).toBe('deleteUsers');
    });

    it('should handle custom HTTP methods for collection', () => {
      expect(NameGenerator.generateControllerMethodName('options', 'users', '/users')).toBe('optionsUsers');
    });

    it('should handle custom HTTP methods with ID', () => {
      expect(NameGenerator.generateControllerMethodName('head', 'users', '/users/{id}')).toBe('headUsersById');
    });
  });

  describe('generateRouteMethodName', () => {
    it('should generate route method name for GET', () => {
      expect(NameGenerator.generateRouteMethodName('get', 'users')).toBe('getUsers');
    });

    it('should generate route method name for POST', () => {
      expect(NameGenerator.generateRouteMethodName('post', 'users')).toBe('postUsers');
    });

    it('should generate route method name for PUT', () => {
      expect(NameGenerator.generateRouteMethodName('put', 'users')).toBe('putUsers');
    });

    it('should generate route method name for DELETE', () => {
      expect(NameGenerator.generateRouteMethodName('delete', 'users')).toBe('deleteUsers');
    });

    it('should handle kebab-case resource names', () => {
      expect(NameGenerator.generateRouteMethodName('get', 'user-profiles')).toBe('getUserProfiles');
    });

    it('should handle uppercase HTTP methods', () => {
      expect(NameGenerator.generateRouteMethodName('GET', 'users')).toBe('getUsers');
    });
  });
});
