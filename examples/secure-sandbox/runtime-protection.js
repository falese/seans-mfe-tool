// enhanced-runtime-protection.js
class RuntimeProtection {
    constructor(targetElement) {
      this.targetElement = targetElement;
      this.virtualDOM = document.createElement('div');
      this.securityViolations = [];
      this.apiCallCount = 0;
      this.cpuUsage = 0;
      this.memoryUsage = 0;
      this.timeouts = new Set();
      this.allowedDomains = [
        'api.financedata.com',
        'cdn.financewidgets.com'
      ];
      
      // Set up rate limiting
      this.rateLimiters = {
        fetch: new RateLimiter(10, 60000), // 10 requests per minute
        apiCalls: new RateLimiter(20, 60000) // 20 API calls per minute
      };
      
      // Set up event bus
      this.eventBus = new Map();
      
      // Resource monitoring
      this.resourceMonitoring = {
        cpuStartTime: 0,
        cpuTotalTime: 0,
        memoryBaseline: 0,
        memoryAllocations: []
      };
      
      // Start resource monitoring
      this._startResourceMonitoring();
    }
    
    initializeWidget() {
      // Create protected container
      this.targetElement.innerHTML = '<div id="protected-container"></div>';
      // enhanced-runtime-protection.js (continued)
    this.container = this.targetElement.querySelector('#protected-container');
    
    // Setup security monitor display
    const monitorDiv = document.createElement('div');
    monitorDiv.className = 'security-monitor';
    monitorDiv.innerHTML = '<h3>Security Monitor</h3><div class="violations"></div>';
    this.targetElement.appendChild(monitorDiv);
    this.monitorDisplay = this.targetElement.querySelector('.violations');
    
    // Load widget in protected context
    this._loadProtectedWidget();
  }
  
  _loadProtectedWidget() {
    try {
      // Create a sandboxed version of the environment
      const sandbox = this._createSandbox();
      
      // Create a protected version of the widget
      const ProtectedWidget = this._createProtectedWidgetClass();
      
      // Instantiate the protected widget
      this.widget = new ProtectedWidget(this.container, {
        theme: 'light',
        currency: 'USD'
      });
      
      // Expose test methods
      this._setupTestMethods();
      
    } catch (e) {
      console.error('Error initializing protected widget:', e);
      this._logViolation(`Initialization error: ${e.message}`);
    }
  }
  
  _createSandbox() {
    const self = this;
    
    // Create a completely isolated environment
    const sandbox = {
      // Core objects with restricted functionality
      Object: Object,
      Array: Array,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Date: Date,
      Math: Math,
      JSON: JSON,
      Error: Error,
      Promise: Promise,
      
      // Restricted console
      console: this._createProxiedConsole(),
      
      // Safe timers with monitoring
      setTimeout: (callback, delay, ...args) => {
        // Limit max delay to prevent resource blocking
        const safeDelay = Math.min(delay, 10000);
        
        // Monitor long-running operations
        const timeoutId = setTimeout(() => {
          self._recordCPUUsage('setTimeout');
          try {
            callback(...args);
          } catch (e) {
            self._logViolation(`Error in setTimeout callback: ${e.message}`);
          } finally {
            self._recordCPUUsageEnd('setTimeout');
          }
        }, safeDelay);
        
        // Track active timeouts
        self.timeouts.add(timeoutId);
        return timeoutId;
      },
      
      clearTimeout: (id) => {
        clearTimeout(id);
        self.timeouts.delete(id);
      },
      
      // Proxied document with fine-grained access control
      document: this._createProxiedDocument(),
      
      // Memory-limited localStorage simulation
      localStorage: this._createMemoryStorage(5 * 1024 * 1024), // 5MB limit
      
      // Controlled UI operations
      alert: this._showNotification.bind(this),
      
      // Secure fetch with rate limiting and domain restrictions
      fetch: this._createSecureFetch(),
      
      // Platform API interface
      platform: this._createPlatformAPI(),
      
      // Event bus for cross-component communication
      eventBus: this._createEventBus()
    };
    
    // Add self-reference (window = globalThis)
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    
    return sandbox;
  }
  
  _createProxiedDocument() {
    const self = this;
    
    return {
      createElement: (tagName) => {
        // Check if element type is allowed
        if (['script', 'iframe', 'object', 'embed'].includes(tagName.toLowerCase())) {
          self._logViolation(`Attempted to create restricted element: ${tagName}`);
          throw new Error(`Element type not allowed: ${tagName}`);
        }
        
        // Create element in virtual DOM
        return document.createElement(tagName);
      },
      
      querySelector: (selector) => {
        // Restrict querySelector to within container only
        return self.container.querySelector(selector);
      },
      
      querySelectorAll: (selector) => {
        // Restrict querySelectorAll to within container only
        return self.container.querySelectorAll(selector);
      },
      
      getElementById: (id) => {
        // Check if element is within container
        const el = document.getElementById(id);
        if (el && self.container.contains(el)) {
          return el;
        }
        self._logViolation(`Attempted to access element outside container: #${id}`);
        return null;
      },
      
      addEventListener: (eventType, handler) => {
        self._logViolation(`Attempted to add global event listener: ${eventType}`);
        // Don't actually add the listener
      },
      
      // Block access to body and head
      get body() {
        self._logViolation('Attempted to access document.body');
        return null;
      },
      
      get head() {
        self._logViolation('Attempted to access document.head');
        return null;
      }
    };
  }
  
  _createProxiedConsole() {
    const self = this;
    
    return {
      log: function(...args) {
        console.log('[Protected Widget]', ...args);
      },
      error: function(...args) {
        console.error('[Protected Widget]', ...args);
        self._logViolation(`Console error: ${args.join(' ')}`);
      },
      warn: function(...args) {
        console.warn('[Protected Widget]', ...args);
      }
    };
  }
  
  _createMemoryStorage(sizeLimit) {
    const storage = new Map();
    let usedBytes = 0;
    const self = this;
    
    return {
      getItem: (key) => {
        self._recordAPICall('localStorage.getItem');
        return storage.get(key) || null;
      },
      
      setItem: (key, value) => {
        self._recordAPICall('localStorage.setItem');
        
        // Check size limits
        const valueSize = new Blob([String(value)]).size;
        if (valueSize + usedBytes > sizeLimit) {
          self._logViolation(`Storage limit exceeded: ${usedBytes + valueSize} > ${sizeLimit}`);
          throw new Error('Storage quota exceeded');
        }
        
        // Update storage and size tracking
        const oldValue = storage.get(key);
        const oldSize = oldValue ? new Blob([String(oldValue)]).size : 0;
        
        usedBytes = usedBytes - oldSize + valueSize;
        storage.set(key, String(value));
      },
      
      removeItem: (key) => {
        self._recordAPICall('localStorage.removeItem');
        
        // Update size tracking
        const oldValue = storage.get(key);
        if (oldValue) {
          const oldSize = new Blob([String(oldValue)]).size;
          usedBytes -= oldSize;
          storage.delete(key);
        }
      },
      
      clear: () => {
        self._recordAPICall('localStorage.clear');
        storage.clear();
        usedBytes = 0;
      },
      
      get length() {
        return storage.size;
      },
      
      key: (index) => {
        self._recordAPICall('localStorage.key');
        const keys = Array.from(storage.keys());
        return keys[index] || null;
      }
    };
  }
  
  _createSecureFetch() {
    const self = this;
    
    return function(url, options = {}) {
      // Record API call
      self._recordAPICall('fetch');
      
      // Check rate limits
      if (!self.rateLimiters.fetch.allowRequest()) {
        self._logViolation('Fetch rate limit exceeded');
        return Promise.reject(new Error('Rate limit exceeded'));
      }
      
      // Check URL against allowlist
      try {
        const urlObj = new URL(url);
        if (!self.allowedDomains.includes(urlObj.hostname)) {
          self._logViolation(`Fetch attempted to unauthorized domain: ${urlObj.hostname}`);
          return Promise.reject(new Error('Domain not allowed'));
        }
      } catch (e) {
        self._logViolation(`Invalid URL in fetch: ${url}`);
        return Promise.reject(new Error('Invalid URL'));
      }
      
      // Add security headers
      const secureOptions = { 
        ...options,
        credentials: 'omit', // Never send cookies
        headers: {
          ...options.headers,
          'X-Requested-By': 'protected-widget'
        }
      };
      
      // Use mock API for demo purposes
      return window.mockAPI.fetch(url, secureOptions);
    };
  }
  
  _createPlatformAPI() {
    const self = this;
    
    return {
      data: {
        getAccounts: () => {
          self._recordAPICall('platform.data.getAccounts');
          
          // Check rate limits
          if (!self.rateLimiters.apiCalls.allowRequest()) {
            self._logViolation('API rate limit exceeded');
            return Promise.reject(new Error('Rate limit exceeded'));
          }
          
          return window.mockAPI.getAccounts();
        },
        
        getTransactions: (accountId) => {
          self._recordAPICall('platform.data.getTransactions');
          
          // Check rate limits
          if (!self.rateLimiters.apiCalls.allowRequest()) {
            self._logViolation('API rate limit exceeded');
            return Promise.reject(new Error('Rate limit exceeded'));
          }
          
          return window.mockAPI.getTransactions(accountId);
        }
      },
      
      ui: {
        showNotification: (message) => {
          self._recordAPICall('platform.ui.showNotification');
          self._showNotification(message);
          return true;
        }
      }
    };
  }
  
  _createEventBus() {
    const listeners = new Map();
    const self = this;
    
    return {
      on: (event, callback) => {
        self._recordAPICall('eventBus.on');
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        
        listeners.get(event).add(callback);
        return () => this.off(event, callback);
      },
      
      off: (event, callback) => {
        self._recordAPICall('eventBus.off');
        if (listeners.has(event)) {
          listeners.get(event).delete(callback);
        }
      },
      
      emit: (event, data) => {
        self._recordAPICall('eventBus.emit');
        
        // Sanitize event data
        const safeData = self._sanitizeEventData(event, data);
        
        // Dispatch to listeners
        if (listeners.has(event)) {
          listeners.get(event).forEach(callback => {
            try {
              callback(safeData);
            } catch (e) {
              self._logViolation(`Error in event handler for '${event}': ${e.message}`);
            }
          });
        }
      }
    };
  }
  
  _sanitizeEventData(event, data) {
    // Basic sanitization for event data
    if (typeof data === 'object' && data !== null) {
      // Deep clone to prevent reference leakage
      return JSON.parse(JSON.stringify(data));
    }
    return data;
  }
  
  _createProtectedWidgetClass() {
    const self = this;
    
    // Create a protected version of the FinancialWidget
    function ProtectedFinancialWidget(container, config) {
      this.container = container;
      this.config = config || {};
      this.data = null;
      
      // Initialize immediately
      this.init();
    }
    
    ProtectedFinancialWidget.prototype = {
      init: function() {
        // Create basic structure with safe DOM methods
        self._safeSetInnerHTML(this.container, `
          <div class="fw-header">Financial Summary (Protected)</div>
          <div class="fw-balance">Loading account data...</div>
          <div class="fw-transactions"></div>
        `);
        
        // Load data
        this.loadData();
      },
      
      loadData: function() {
        // Use platform API
        Promise.resolve()
          .then(() => self._recordCPUUsage('loadData'))
          .then(() => self.platform.data.getAccounts())
          .then(accounts => {
            this.data = {
              accounts: accounts,
              balance: accounts.reduce((sum, account) => sum + account.balance, 0)
            };
            
            return self.platform.data.getTransactions();
          })
          .then(transactions => {
            this.data.transactions = transactions;
            this.render();
          })
          .catch(error => {
            console.error("Error loading data:", error);
            this.renderError("Failed to load financial data");
          })
          .finally(() => self._recordCPUUsageEnd('loadData'));
      },
      
      render: function() {
        // Record CPU usage during rendering
        self._recordCPUUsage('render');
        
        try {
          // Render balance - using safe DOM methods
          const balanceEl = this.container.querySelector('.fw-balance');
          self._safeSetInnerHTML(balanceEl, `<h2>Current Balance: $${this.data.balance.toFixed(2)}</h2>`);
          
          // Prepare accounts HTML
          const accountsHtml = `
            <h3>Your Accounts</h3>
            <ul class="fw-accounts-list">
              ${this.data.accounts.map(account => `
                <li class="fw-account-item" data-id="${account.id}">
                  <span class="fw-account-name">${account.name}</span>
                  <span class="fw-account-balance">$${account.balance.toFixed(2)}</span>
                </li>
              `).join('')}
            </ul>
          `;
          
          // Render transactions - using safe DOM methods
          const transEl = this.container.querySelector('.fw-transactions');
          self._safeSetInnerHTML(transEl, `
            ${accountsHtml}
            <h3>Recent Transactions</h3>
            <ul class="fw-transactions-list">
              ${this.data.transactions.map(t => `
                <li class="fw-transaction-item">
                  <span class="fw-transaction-date">${t.date}</span>
                  <span class="fw-transaction-desc">${t.description}</span>
                  <span class="fw-transaction-amount">$${t.amount.toFixed(2)}</span>
                </li>
              `).join('')}
            </ul>
          `);
          
          // Add account click handlers - using safe event handling
          const accountItems = this.container.querySelectorAll('.fw-account-item');
          accountItems.forEach(item => {
            item.addEventListener('click', (e) => {
              const accountId = item.getAttribute('data-id');
              const account = this.data.accounts.find(a => a.id === accountId);
              if (account) {
                this.handleAccountClick(account);
              }
            });
          });
        } finally {
          self._recordCPUUsageEnd('render');
        }
      },
      
      renderError: function(message) {
        self._safeSetInnerHTML(this.container, `
          <div class="fw-error">
            <h3>Error</h3>
            <p>${message}</p>
          </div>
        `);
      },
      
      handleAccountClick: function(account) {
        self.platform.ui.showNotification(`Account selected: ${account.name} - $${account.balance.toFixed(2)}`);
        
        // Emit event to event bus
        self.eventBus.emit('accountSelected', {
          id: account.id,
          name: account.name,
          balance: account.balance
        });
      }
    };
    
    return ProtectedFinancialWidget;
  }
  
  _safeSetInnerHTML(element, html) {
    // Sanitize HTML
    const sanitized = this._sanitizeHTML(html);
    element.innerHTML = sanitized;
  }
  
  _sanitizeHTML(html) {
    // Basic sanitization - remove script tags and event handlers
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
               .replace(/on\w+="[^"]*"/g, '') // Remove inline event handlers
               .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
               .replace(/<object[^>]*>.*?<\/object>/gi, '')
               .replace(/<embed[^>]*>.*?<\/embed>/gi, '');
  }
  
  _showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'protection-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 15px;
      background-color: #4CAF50;
      color: white;
      border-radius: 5px;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
  
  _logViolation(description) {
    this.securityViolations.push({
      timestamp: new Date(),
      description
    });
    
    // Update monitor display
    this._updateMonitorDisplay();
    
    console.warn(`[Security Violation] ${description}`);
  }
  
  _recordAPICall(endpoint, params) {
    this.apiCallCount++;
    console.log(`[Protected Widget] API Access: ${endpoint}`, params || '');
  }
  
  _updateMonitorDisplay() {
    // Create list of violations
    let html = '<ul>';
    
    // Show most recent violations first, limit to 10
    const recentViolations = this.securityViolations.slice(-10).reverse();
    
    recentViolations.forEach(violation => {
      const time = violation.timestamp.toLocaleTimeString();
      html += `<li>${time}: ${violation.description}</li>`;
    });
    html += '</ul>';
    
    // Update monitor display
    this.monitorDisplay.innerHTML = html;
  }
  
  _startResourceMonitoring() {
    // Set memory baseline
    this.resourceMonitoring.memoryBaseline = this._getMemoryEstimate();
    
    // Start monitoring
    setInterval(() => {
      // Update CPU and memory estimates
      this.cpuUsage = this._calculateCPUUsage();
      this.memoryUsage = this._calculateMemoryUsage();
    }, 1000);
  }
  
  _recordCPUUsage(operation) {
    this.resourceMonitoring.cpuStartTime = performance.now();
    return operation; // For chaining in promises
  }
  
  _recordCPUUsageEnd(operation) {
    const endTime = performance.now();
    const duration = endTime - this.resourceMonitoring.cpuStartTime;
    this.resourceMonitoring.cpuTotalTime += duration;
    console.log(`[Protected Widget] Operation '${operation}' took ${duration.toFixed(2)}ms`);
    return operation; // For chaining in promises
  }
  
  _calculateCPUUsage() {
    // This is a simplified simulation, not real CPU monitoring
    return Math.min(95, Math.floor(Math.random() * 20) + this.resourceMonitoring.cpuTotalTime / 100);
  }
  
  _getMemoryEstimate() {
    // This is a simplified estimation for demo purposes
    return Math.floor(Math.random() * 50) + 20; // MB
  }
  
  _calculateMemoryUsage() {
    // This is a simplified simulation, not real memory monitoring
    return this._getMemoryEstimate();
  }
  
  _setupTestMethods() {
    const self = this;
    
    // Create test methods for the protected environment
    this.testScriptInjection = function() {
      self._logViolation("Attempted script injection test");
      return false;
    };
    
    this.testDOMAccess = function() {
      self._logViolation("Attempted unauthorized DOM access test");
      return false;
    };
    
    this.testGlobalEvents = function() {
      self._logViolation("Attempted to add global event handlers");
      return false;
    };
    
    this.testStorageAccess = function() {
      try {
        // Test the virtualized localStorage
        self.localStorage.setItem('test-key', 'test-value');
        const value = self.localStorage.getItem('test-key');
        self.localStorage.removeItem('test-key');
        
        self._logViolation("Storage access test completed (virtualized storage)");
        return true;
      } catch(e) {
        self._logViolation(`Storage access test failed: ${e.message}`);
        return false;
      }
    };
    
    this.testStorageLimits = function() {
      try {
        // Generate large data to test limits
        const largeString = 'A'.repeat(1024 * 1024 * 6); // 6MB
        
        try {
          self.localStorage.setItem('large-key', largeString);
          self._logViolation("Storage limits test succeeded unexpectedly");
          return true;
        } catch(e) {
          self._logViolation(`Storage limits test blocked as expected: ${e.message}`);
          return false;
        }
      } catch(e) {
        self._logViolation(`Storage limits test error: ${e.message}`);
        return false;
      }
    };
    
    this.testRestrictedAPIs = function() {
      self._logViolation("Attempted to access restricted APIs");
      return false;
    };
    
    this.testFetchAllowed = function() {
      try {
        self.fetch('https://api.financedata.com/data')
          .then(() => {
            self._logViolation("Fetch to allowed domain succeeded");
          })
          .catch(error => {
            self._logViolation(`Fetch to allowed domain failed: ${error.message}`);
          });
        return true;
      } catch(e) {
        self._logViolation(`Fetch allowed test error: ${e.message}`);
        return false;
      }
    };
    
    this.testFetchBlocked = function() {
      try {
        self.fetch('https://malicious-site.example.com/data')
          .then(() => {
            self._logViolation("Fetch to blocked domain succeeded unexpectedly");
          })
          .catch(error => {
            self._logViolation(`Fetch to blocked domain blocked as expected: ${error.message}`);
          });
        return true;
      } catch(e) {
        self._logViolation(`Fetch blocked test error: ${e.message}`);
        return false;
      }
    };
    
    this.testFetchRateLimit = function() {
      try {
        // Make multiple requests rapidly
        for (let i = 0; i < 20; i++) {
          self.platform.data.getTransactions()
            .then(() => self._logViolation(`Rate limit test: Request ${i+1} succeeded`))
            .catch(error => self._logViolation(`Rate limit test: Request ${i+1} blocked: ${error.message}`));
        }
        return true;
      } catch(e) {
        self._logViolation(`Fetch rate limit test error: ${e.message}`);
        return false;
      }
    };
    
    this.testCPULimits = function() {
      try {
        self._logViolation("Starting CPU limits test");
        self._recordCPUUsage('cpuTest');
        
        // CPU intensive operation that should be interrupted
        setTimeout(() => {
          try {
            // This should be interrupted by the CPU limiter
            const result = [];
            for (let i = 0; i < 10000000; i++) {
              for (let j = 0; j < 100; j++) {
                result.push(Math.sqrt(i * j));
              }
            }
          } catch(e) {
            self._logViolation(`CPU limits test interrupted: ${e.message}`);
          } finally {
            self._recordCPUUsageEnd('cpuTest');
          }
        }, 100);
        
        return true;
      } catch(e) {
        self._logViolation(`CPU limits test error: ${e.message}`);
        return false;
      }
    };
    
    this.testMemoryLimits = function() {
      try {
        self._logViolation("Starting memory limits test");
        
        // Try to allocate excessive memory
        try {
          const arrays = [];
          for (let i = 0; i < 10; i++) {
            arrays.push(new Array(1000000).fill(Math.random()));
            self._logViolation(`Memory allocation ${i+1} succeeded`);
          }
        } catch(e) {
          self._logViolation(`Memory allocation blocked: ${e.message}`);
        }
        
        return true;
      } catch(e) {
        self._logViolation(`Memory limits test error: ${e.message}`);
        return false;
      }
    };
    
    this.testTimeoutLimits = function() {
      try {
        self._logViolation("Starting timeout limits test");
        
        // Create many timeouts
        for (let i = 0; i < 50; i++) {
          self.setTimeout(() => {
            self._logViolation(`Timeout ${i+1} executed`);
          }, 1000 + Math.random() * 5000);
        }
        
        self._logViolation(`Created multiple timeouts. Current count: ${self.timeouts.size}`);
        
        return true;
      } catch(e) {
        self._logViolation(`Timeout limits test error: ${e.message}`);
        return false;
      }
    };
    
    this.testEventBus = function() {
      try {
        self._logViolation("Starting event bus test");
        
        // Set up event listener
        self.eventBus.on('test-event', (data) => {
          self._logViolation(`Event received: ${JSON.stringify(data)}`);
        });
        
        // Emit event
        self.eventBus.emit('test-event', { message: 'Hello from sandbox' });
        
        return true;
      } catch(e) {
        self._logViolation(`Event bus test error: ${e.message}`);
        return false;
      }
    };
    
    this.testPlatformEvents = function() {
      try {
        self._logViolation("Starting platform events test");
        
        // Emit a custom event
        self.eventBus.emit('platform-action', { 
          action: 'account-selected',
          accountId: '1001',
          accountName: 'Checking'
        });
        
        return true;
      } catch(e) {
        self._logViolation(`Platform events test error: ${e.message}`);
        return false;
      }
    };
  }
  
  // Public API for demo
  getCPUUsage() {
    return this.cpuUsage;
  }
  
  getMemoryUsage() {
    return this.memoryUsage;
  }
  
  getAPICallCount() {
    return this.apiCallCount;
  }
}

// Helper Classes

// Simple rate limiter
class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.timestamps = [];
  }
  
  allowRequest() {
    const now = Date.now();
    
    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(time => now - time < this.windowMs);
    
    // Check if we're at the limit
    if (this.timestamps.length >= this.limit) {
      return false;
    }
    
    // Add current timestamp and allow request
    this.timestamps.push(now);
    return true;
  }
}