/**
 * Tests for REQ-RUNTIME-002: Shared Context
 * 
 * Validates context creation, lifecycle tracking, and cross-capability flow
 */

import {
  Context,
  UserContext,
  ContextFactory,
  ContextValidator,
} from '../context';

describe('REQ-RUNTIME-002: Shared Context', () => {
  describe('ContextFactory.create', () => {
    it('should create context with required fields', () => {
      const context = ContextFactory.create();
      
      expect(context.requestId).toBeDefined();
      expect(context.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(context.timestamp).toBeInstanceOf(Date);
      expect(context.inputs).toEqual({});
      expect(context.outputs).toEqual({});
      expect(context.retryCount).toBe(0);
    });
    
    it('should create context with user and auth', () => {
      const user: UserContext = {
        id: 'user123',
        username: 'testuser',
        roles: ['admin', 'user'],
        permissions: ['read', 'write'],
      };
      
      const context = ContextFactory.create({
        user,
        jwt: 'fake.jwt.token',
      });
      
      expect(context.user).toEqual(user);
      expect(context.jwt).toBe('fake.jwt.token');
    });
    
    it('should create context with capability and inputs', () => {
      const inputs = { dataUrl: 'http://example.com/data.csv' };
      
      const context = ContextFactory.create({
        capability: 'load',
        inputs,
      });
      
      expect(context.capability).toBe('load');
      expect(context.inputs).toEqual(inputs);
    });
    
    it('should create context with headers and query params', () => {
      const headers = { authorization: 'Bearer token123' };
      const query = { format: 'csv' };
      
      const context = ContextFactory.create({ headers, query });
      
      expect(context.headers).toEqual(headers);
      expect(context.query).toEqual(query);
    });
    
    it('should generate unique request IDs', () => {
      const context1 = ContextFactory.create();
      const context2 = ContextFactory.create();
      
      expect(context1.requestId).not.toBe(context2.requestId);
    });
  });
  
  describe('ContextFactory.cloneForCapability', () => {
    it('should clone context preserving user and auth', () => {
      const user: UserContext = {
        id: 'user123',
        username: 'testuser',
        roles: ['admin'],
      };
      
      const loadContext = ContextFactory.create({
        user,
        jwt: 'token123',
        capability: 'load',
        headers: { 'x-trace-id': 'trace123' },
      });
      
      loadContext.outputs = { container: 'loaded' };
      
      const renderContext = ContextFactory.cloneForCapability(
        loadContext,
        'render',
        { component: 'DataAnalysis' }
      );
      
      // Preserved from source
      expect(renderContext.user).toEqual(user);
      expect(renderContext.jwt).toBe('token123');
      expect(renderContext.headers).toEqual({ 'x-trace-id': 'trace123' });
      
      // New for render
      expect(renderContext.capability).toBe('render');
      expect(renderContext.inputs).toEqual({ component: 'DataAnalysis' });
      expect(renderContext.outputs).toEqual({});
      expect(renderContext.requestId).not.toBe(loadContext.requestId);
      expect(renderContext.phase).toBeUndefined();
      expect(renderContext.retryCount).toBe(0);
      expect(renderContext.error).toBeUndefined();
    });
  });
  
  describe('ContextFactory.setPhase', () => {
    it('should update context phase', () => {
      const context = ContextFactory.create();
      
      ContextFactory.setPhase(context, 'before');
      expect(context.phase).toBe('before');
      
      ContextFactory.setPhase(context, 'main');
      expect(context.phase).toBe('main');
      
      ContextFactory.setPhase(context, 'after');
      expect(context.phase).toBe('after');
    });
  });
  
  describe('ContextFactory.recordError', () => {
    it('should record error and set error phase', () => {
      const context = ContextFactory.create();
      const error = new Error('Load failed');
      
      ContextFactory.recordError(context, error);
      
      expect(context.error).toBe(error);
      expect(context.phase).toBe('error');
    });
  });
  
  describe('ContextFactory.incrementRetry', () => {
    it('should increment retry count', () => {
      const context = ContextFactory.create();
      
      expect(context.retryCount).toBe(0);
      
      ContextFactory.incrementRetry(context);
      expect(context.retryCount).toBe(1);
      
      ContextFactory.incrementRetry(context);
      expect(context.retryCount).toBe(2);
    });
  });
  
  describe('ContextValidator.validate', () => {
    it('should pass validation for valid context', () => {
      const context = ContextFactory.create();
      
      const result = ContextValidator.validate(context, {});
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail if authentication required but missing', () => {
      const context = ContextFactory.create();
      
      const result = ContextValidator.validate(context, {
        requiresAuth: true,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Context missing JWT (authentication required)');
    });
    
    it('should fail if user required but missing', () => {
      const context = ContextFactory.create({ jwt: 'token' });
      
      const result = ContextValidator.validate(context, {
        requiresUser: true,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Context missing user (user context required)');
    });
    
    it('should fail if required inputs missing', () => {
      const context = ContextFactory.create({
        inputs: { dataUrl: 'http://example.com' },
      });
      
      const result = ContextValidator.validate(context, {
        requiredInputs: ['dataUrl', 'format'],
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Context missing required input: format');
    });
    
    it('should pass if all requirements met', () => {
      const user: UserContext = {
        id: 'user123',
        username: 'testuser',
        roles: ['admin'],
      };
      
      const context = ContextFactory.create({
        user,
        jwt: 'token123',
        inputs: { dataUrl: 'http://example.com', format: 'csv' },
      });
      
      const result = ContextValidator.validate(context, {
        requiresAuth: true,
        requiresUser: true,
        requiredInputs: ['dataUrl', 'format'],
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
  
  describe('ContextValidator.validateUserRole', () => {
    it('should fail if no user context', () => {
      const context = ContextFactory.create();
      
      const result = ContextValidator.validateUserRole(context, ['admin']);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No user context');
    });
    
    it('should fail if user missing required role', () => {
      const user: UserContext = {
        id: 'user123',
        username: 'testuser',
        roles: ['user', 'viewer'],
      };
      
      const context = ContextFactory.create({ user });
      
      const result = ContextValidator.validateUserRole(context, ['admin', 'superuser']);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('User missing required role');
      expect(result.error).toContain('Required: [admin, superuser]');
      expect(result.error).toContain('User has: [user, viewer]');
    });
    
    it('should pass if user has one of required roles', () => {
      const user: UserContext = {
        id: 'user123',
        username: 'testuser',
        roles: ['user', 'admin'],
      };
      
      const context = ContextFactory.create({ user });
      
      const result = ContextValidator.validateUserRole(context, ['admin', 'superuser']);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
  
  describe('Context Lifecycle Flow (load → render)', () => {
    it('should maintain user context across load and render', () => {
      // Simulate load capability
      const user: UserContext = {
        id: 'user123',
        username: 'testuser',
        roles: ['admin'],
      };
      
      const loadContext = ContextFactory.create({
        user,
        jwt: 'token123',
        capability: 'load',
        inputs: { mfeEndpoint: 'http://localhost:3002' },
      });
      
      // Simulate load phases
      ContextFactory.setPhase(loadContext, 'before');
      // ... auth handler runs, validates JWT
      
      ContextFactory.setPhase(loadContext, 'main');
      // ... load operation, populate outputs
      loadContext.outputs = {
        container: { init: jest.fn() },
        manifest: { name: 'csv-analyzer' },
        availableComponents: ['DataAnalysis', 'ReportViewer'],
      };
      
      ContextFactory.setPhase(loadContext, 'after');
      // ... telemetry handler runs
      
      // Now render using same context
      const renderContext = ContextFactory.cloneForCapability(
        loadContext,
        'render',
        {
          component: 'DataAnalysis',
          props: { data: [] },
          containerId: 'root',
        }
      );
      
      // User and auth preserved
      expect(renderContext.user).toEqual(user);
      expect(renderContext.jwt).toBe('token123');
      
      // New capability context
      expect(renderContext.capability).toBe('render');
      expect(renderContext.inputs?.component).toBe('DataAnalysis');
      
      // Load outputs still accessible from original context
      expect(loadContext.outputs?.availableComponents).toContain('DataAnalysis');
    });
  });
  
  describe('Context Mutation by Handlers', () => {
    it('should allow handlers to mutate context', () => {
      const context = ContextFactory.create({ capability: 'load' });
      
      // Auth handler adds user
      context.user = {
        id: 'user123',
        username: 'testuser',
        roles: ['admin'],
      };
      
      // Validation handler adds validation results
      context.validation = {
        passed: true,
        errors: [],
      };
      
      // Telemetry handler adds timing
      context.telemetry = {
        startTime: Date.now(),
        events: [],
      };
      
      // All mutations persisted
      expect(context.user).toBeDefined();
      expect(context.validation?.passed).toBe(true);
      expect(context.telemetry?.startTime).toBeDefined();
    });
  });
});
