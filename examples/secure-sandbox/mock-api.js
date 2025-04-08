// enhanced-mock-api.js
(function() {
    // Set up mock API and data
    const mockData = {
      accounts: [
        { id: '1001', name: 'Checking', balance: 2540.75 },
        { id: '1002', name: 'Savings', balance: 15750.50 },
        { id: '1003', name: 'Investment', balance: 42680.25 }
      ],
      transactions: [
        { date: '2025-04-05', amount: -120.50, description: 'Grocery Store' },
        { date: '2025-04-03', amount: 1500.00, description: 'Payroll Deposit' },
        { date: '2025-04-01', amount: -58.99, description: 'Online Purchase' },
        { date: '2025-03-29', amount: -85.00, description: 'Restaurant' },
        { date: '2025-03-25', amount: -750.00, description: 'Rent Payment' }
      ],
      // Domain allowlist for fetch operations
      allowedDomains: [
        'api.financedata.com',
        'cdn.financewidgets.com',
        'analytics.experienceengine.com'
      ]
    };
    
    // Mock API response delays (simulating network)
    const RESPONSE_DELAY = 300; // ms
    
    // Set up rate limiting
    const rateLimits = {
      getTransactions: { count: 0, limit: 5, resetTime: Date.now() + 60000 },
      getAccounts: { count: 0, limit: 10, resetTime: Date.now() + 60000 }
    };
    
    function checkRateLimit(endpoint) {
      if (!rateLimits[endpoint]) return true;
      
      const now = Date.now();
      if (now > rateLimits[endpoint].resetTime) {
        rateLimits[endpoint].count = 0;
        rateLimits[endpoint].resetTime = now + 60000;
      }
      
      if (rateLimits[endpoint].count >= rateLimits[endpoint].limit) {
        return false;
      }
      
      rateLimits[endpoint].count++;
      return true;
    }
    
    // Mock API
    window.mockAPI = {
      getAccounts: function() {
        return new Promise((resolve, reject) => {
          if (!checkRateLimit('getAccounts')) {
            setTimeout(() => reject(new Error('Rate limit exceeded')), RESPONSE_DELAY);
            return;
          }
          
          setTimeout(() => resolve([...mockData.accounts]), RESPONSE_DELAY);
        });
      },
      
      getTransactions: function(accountId) {
        return new Promise((resolve, reject) => {
          if (!checkRateLimit('getTransactions')) {
            setTimeout(() => reject(new Error('Rate limit exceeded')), RESPONSE_DELAY);
            return;
          }
          
          setTimeout(() => {
            if (accountId) {
              // Filter transactions by account (for demo purposes, just return first two)
              resolve(mockData.transactions.slice(0, 2));
            } else {
              resolve([...mockData.transactions]);
            }
          }, RESPONSE_DELAY);
        });
      },
      
      // Mock fetch for external domains
      fetch: function(url, options = {}) {
        return new Promise((resolve, reject) => {
          const urlObj = new URL(url);
          
          // Check domain allowlist
          if (!mockData.allowedDomains.includes(urlObj.hostname)) {
            setTimeout(() => reject(new Error('Domain not in allowlist')), RESPONSE_DELAY);
            return;
          }
          
          // Simulate response
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ status: 'success', data: 'Mock API response data' })
            });
          }, RESPONSE_DELAY);
        });
      },
      
      // Check if domain is allowed
      isAllowedDomain: function(url) {
        try {
          const urlObj = new URL(url);
          return mockData.allowedDomains.includes(urlObj.hostname);
        } catch (e) {
          return false;
        }
      }
    };
  })();