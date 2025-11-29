const { MethodGenerator } = require('../generators/MethodGenerator');

describe('MethodGenerator', () => {
  describe('generateControllerMethod', () => {
    it('should generate async function with correct signature', () => {
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        [],
        ''
      );
      
      expect(result).toContain('async function getPetById(req, res, next)');
    });

    it('should extract requestId from req', () => {
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        [],
        ''
      );
      
      expect(result).toContain('const { requestId } = req;');
    });

    it('should wrap logic in try-catch block', () => {
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        [],
        ''
      );
      
      expect(result).toMatch(/try\s*{[\s\S]*}\s*catch\s*\(error\)/);
    });

    it('should call next(error) in catch block', () => {
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        [],
        ''
      );
      
      expect(result).toContain('next(error);');
    });

    it('should log start of request processing', () => {
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        [],
        ''
      );
      
      expect(result).toContain("logger.info('Processing request'");
      expect(result).toContain("controller: 'getPetById'");
      expect(result).toContain("operation: '/pets/{petId}'");
      expect(result).toContain("method: 'get'");
    });

    it('should log request data (params, query, body)', () => {
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        [],
        ''
      );
      
      expect(result).toContain('params: req.params');
      expect(result).toContain('query: req.query');
      expect(result).toContain('body: req.body');
    });

    it('should log successful request completion', () => {
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        [],
        ''
      );
      
      expect(result).toContain("logger.info('Request successful'");
    });

    it('should log error details on failure', () => {
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        [],
        ''
      );
      
      expect(result).toContain("logger.error('Request failed'");
      expect(result).toContain('error: error.message');
    });

    it('should inject validations into try block', () => {
      const validations = [
        'const { petId } = req.params;',
        'const { limit } = req.query;'
      ];
      
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        validations,
        ''
      );
      
      expect(result).toContain('const { petId } = req.params;');
      expect(result).toContain('const { limit } = req.query;');
    });

    it('should place validations before implementation', () => {
      const validations = ['const { petId } = req.params;'];
      const implementation = 'const pet = await Pet.findById(petId);';
      
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        validations,
        implementation
      );
      
      const validationIndex = result.indexOf('const { petId } = req.params;');
      const implementationIndex = result.indexOf('const pet = await Pet.findById(petId);');
      
      expect(validationIndex).toBeLessThan(implementationIndex);
    });

    it('should inject implementation into try block', () => {
      const implementation = `const pet = await Pet.findById(petId);
      if (!pet) {
        return res.status(404).json({ error: 'Pet not found' });
      }
      res.status(200).json(pet);`;
      
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        [],
        implementation
      );
      
      expect(result).toContain('const pet = await Pet.findById(petId);');
      expect(result).toContain("return res.status(404).json({ error: 'Pet not found' });");
      expect(result).toContain('res.status(200).json(pet);');
    });

    it('should place implementation after processing log', () => {
      const implementation = 'const pet = await Pet.findById(petId);';
      
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        [],
        implementation
      );
      
      const logIndex = result.indexOf("logger.info('Processing request'");
      const implementationIndex = result.indexOf('const pet = await Pet.findById(petId);');
      
      expect(logIndex).toBeLessThan(implementationIndex);
    });

    it('should place implementation before success log', () => {
      const implementation = 'const pet = await Pet.findById(petId);';
      
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        [],
        implementation
      );
      
      const implementationIndex = result.indexOf('const pet = await Pet.findById(petId);');
      const successLogIndex = result.indexOf("logger.info('Request successful'");
      
      expect(implementationIndex).toBeLessThan(successLogIndex);
    });

    it('should handle empty validations array', () => {
      const implementation = 'res.status(200).json({ message: "OK" });';
      
      const result = MethodGenerator.generateControllerMethod(
        'healthCheck',
        'get',
        '/health',
        {},
        [],
        implementation
      );
      
      expect(result).toContain('res.status(200).json({ message: "OK" });');
      // Empty validations means no additional variable declarations beyond requestId
      const lines = result.split('\n');
      const constLines = lines.filter(line => line.trim().startsWith('const'));
      expect(constLines).toHaveLength(1); // Only 'const { requestId } = req;'
      expect(constLines[0]).toContain('requestId');
    });

    it('should handle empty implementation string', () => {
      const result = MethodGenerator.generateControllerMethod(
        'notImplemented',
        'post',
        '/future',
        {},
        [],
        ''
      );
      
      expect(result).toContain('async function notImplemented');
      expect(result).toContain('try {');
      expect(result).toContain('catch (error) {');
    });

    it('should handle complex operation with all components', () => {
      const validations = [
        'const { userId } = req.params;',
        'const { includeDetails } = req.query;',
        'const body = req.body;'
      ];
      const implementation = `const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const updatedUser = await User.findByIdAndUpdate(userId, body, { new: true });
      res.status(200).json(updatedUser);`;
      
      const result = MethodGenerator.generateControllerMethod(
        'updateUser',
        'put',
        '/users/{userId}',
        {},
        validations,
        implementation
      );
      
      // Verify structure
      expect(result).toContain('async function updateUser(req, res, next)');
      expect(result).toContain('const { requestId } = req;');
      expect(result).toContain('try {');
      expect(result).toContain('catch (error) {');
      
      // Verify logging
      expect(result).toContain("controller: 'updateUser'");
      expect(result).toContain("operation: '/users/{userId}'");
      expect(result).toContain("method: 'put'");
      
      // Verify validations
      expect(result).toContain('const { userId } = req.params;');
      expect(result).toContain('const { includeDetails } = req.query;');
      expect(result).toContain('const body = req.body;');
      
      // Verify implementation
      expect(result).toContain('const user = await User.findById(userId);');
      expect(result).toContain('const updatedUser = await User.findByIdAndUpdate(userId, body, { new: true });');
    });

    it('should preserve indentation in validations', () => {
      const validations = [
        'const { petId } = req.params;',
        'const { limit } = req.query;'
      ];
      
      const result = MethodGenerator.generateControllerMethod(
        'getPets',
        'get',
        '/pets',
        {},
        validations,
        ''
      );
      
      // Validations should be on separate lines with proper indentation
      expect(result).toMatch(/const { petId } = req\.params;\s+const { limit } = req\.query;/);
    });

    it('should generate valid executable JavaScript', () => {
      const validations = ['const { petId } = req.params;'];
      const implementation = `const pet = await Pet.findById(petId);
      res.status(200).json(pet);`;
      
      const result = MethodGenerator.generateControllerMethod(
        'getPetById',
        'get',
        '/pets/{petId}',
        {},
        validations,
        implementation
      );
      
      // Should not throw syntax error when evaluated (basic check)
      expect(() => {
        // This won't execute, just checks syntax validity
        new Function(result);
      }).not.toThrow();
    });
  });
});
