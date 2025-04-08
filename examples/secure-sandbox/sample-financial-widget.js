// enhanced-financial-widget.js
(function() {
  // Initialize widget
  function FinancialWidget(container, config) {
    this.container = container;
    this.config = config || {};
    this.data = null;
    this.eventListeners = [];
    
    // Add reference to widget instance
    container.widget = this;
    
    this.init();
  }
  
  FinancialWidget.prototype = {
    init: function() {
      // Create basic structure
      this.container.innerHTML = `
        <div class="fw-header">Financial Summary</div>
        <div class="fw-balance">Loading account data...</div>
        <div class="fw-transactions"></div>
      `;
      
      // Load data
      this.loadData();
    },
    
    loadData: function() {
      // Use mock API
      window.mockAPI.getAccounts()
        .then(accounts => {
          this.data = {
            accounts: accounts,
            balance: accounts.reduce((sum, account) => sum + account.balance, 0)
          };
          
          return window.mockAPI.getTransactions();
        })
        .then(transactions => {
          this.data.transactions = transactions;
          this.render();
        })
        .catch(error => {
          console.error("Error loading data:", error);
          this.renderError("Failed to load financial data");
        });
    },
    
    render: function() {
      // Render balance
      const balanceEl = this.container.querySelector('.fw-balance');
      balanceEl.innerHTML = `<h2>Current Balance: $${this.data.balance.toFixed(2)}</h2>`;
      
      // Render accounts
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
      
      // Render transactions
      const transEl = this.container.querySelector('.fw-transactions');
      transEl.innerHTML = `
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
      `;
      
      // Add account click handlers
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
    },
    
    renderError: function(message) {
      this.container.innerHTML = `
        <div class="fw-error">
          <h3>Error</h3>
          <p>${message}</p>
        </div>
      `;
    },
    
    handleAccountClick: function(account) {
      alert(`Account selected: ${account.name} - $${account.balance.toFixed(2)}`);
    },
    
    // ======== TEST FUNCTIONS ========
    
    // DOM Security Tests
    testScriptInjection: function() {
      try {
        console.log("Standard widget: Testing script injection");
        const script = document.createElement('script');
        script.textContent = 'alert("Script injected from standard widget")';
        document.body.appendChild(script);
        return true;
      } catch(e) {
        console.error("Standard widget: Script injection test failed", e);
        return false;
      }
    },
    
    testDOMAccess: function() {
      try {
        console.log("Standard widget: Testing DOM access");
        // Try to access DOM outside the container
        const outsideElements = document.querySelectorAll('h1, h2, button');
        console.log(`Standard widget: Found ${outsideElements.length} elements outside container`);
        
        // Try to modify outside elements
        document.body.style.backgroundColor = '#f0f8ff';
        setTimeout(() => {
          document.body.style.backgroundColor = '';
        }, 1000);
        
        return true;
      } catch(e) {
        console.error("Standard widget: DOM access test failed", e);
        return false;
      }
    },
    
    testGlobalEvents: function() {
      try {
        console.log("Standard widget: Testing global events");
        // Add global event listener
        const handler = () => {
          console.log("Standard widget: Global click handler executed");
        };
        document.body.addEventListener('click', handler);
        this.eventListeners.push({ element: document.body, type: 'click', handler });
        
        // Trigger a click event
        setTimeout(() => {
          const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          document.body.dispatchEvent(evt);
        }, 500);
        
        return true;
      } catch(e) {
        console.error("Standard widget: Global events test failed", e);
        return false;
      }
    },
    
    // Data Access Security Tests
    testStorageAccess: function() {
      try {
        console.log("Standard widget: Testing storage access");
        // Try to access localStorage
        localStorage.setItem('standard-widget-test', 'test-value');
        const value = localStorage.getItem('standard-widget-test');
        console.log(`Standard widget: localStorage test - ${value}`);
        
        // Clean up
        localStorage.removeItem('standard-widget-test');
        
        return true;
      } catch(e) {
        console.error("Standard widget: Storage access test failed", e);
        return false;
      }
    },
    
    testStorageLimits: function() {
      try {
        console.log("Standard widget: Testing storage limits");
        // Generate 5MB of data
        const largeString = 'A'.repeat(1024 * 1024 * 5); // 5MB string
        
        try {
          localStorage.setItem('standard-widget-large', largeString);
          console.log("Standard widget: Stored 5MB in localStorage");
          localStorage.removeItem('standard-widget-large');
        } catch (e) {
          console.log("Standard widget: Storage quota exceeded as expected", e);
        }
        
        return true;
      } catch(e) {
        console.error("Standard widget: Storage limits test failed", e);
        return false;
      }
    },
    
    testRestrictedAPIs: function() {
      try {
        console.log("Standard widget: Testing restricted APIs");
        // Try to access various potentially restricted APIs
        
        // Navigator
        console.log(`Standard widget: User Agent - ${navigator.userAgent}`);
        
        // Geolocation API 
        if (navigator.geolocation) {
          console.log("Standard widget: Geolocation API available");
        }
        
        // Notification API
        if (window.Notification) {
          console.log("Standard widget: Notification permission - " + Notification.permission);
        }
        
        return true;
      } catch(e) {
        console.error("Standard widget: Restricted APIs test failed", e);
        return false;
      }
    },
    
    // Network Security Tests
    testFetchAllowed: function() {
      try {
        console.log("Standard widget: Testing fetch to allowed domain");
        // Make a fetch request to an allowed domain
        fetch('https://api.financedata.com/data')
          .then(response => {
            console.log("Standard widget: Fetch to allowed domain succeeded");
          })
          .catch(error => {
            console.log("Standard widget: Fetch to allowed domain failed", error);
          });
        
        return true;
      } catch(e) {
        console.error("Standard widget: Fetch allowed test failed", e);
        return false;
      }
    },
    
    testFetchBlocked: function() {
      try {
        console.log("Standard widget: Testing fetch to blocked domain");
        // Make a fetch request to a potentially blocked domain
        fetch('https://malicious-site.example.com/data')
          .then(response => {
            console.log("Standard widget: Fetch to blocked domain succeeded");
          })
          .catch(error => {
            console.log("Standard widget: Fetch to blocked domain failed", error);
          });
        
        return true;
      } catch(e) {
        console.error("Standard widget: Fetch blocked test failed", e);
        return false;
      }
    },
    
    testFetchRateLimit: function() {
      try {
        console.log("Standard widget: Testing fetch rate limiting");
        // Make multiple API requests rapidly
        const promises = [];
        
        for (let i = 0; i < 20; i++) {
          promises.push(
            window.mockAPI.getTransactions()
              .then(() => console.log(`Standard widget: API request ${i+1} succeeded`))
              .catch(error => console.log(`Standard widget: API request ${i+1} failed:`, error.message))
          );
        }
        
        Promise.all(promises.map(p => p.catch(e => e)))
          .then(() => {
            console.log("Standard widget: Fetch rate limit test completed");
          });
        
        return true;
      } catch(e) {
        console.error("Standard widget: Fetch rate limit test failed", e);
        return false;
      }
    },
    
    // Resource Management Tests
    testCPULimits: function() {
      try {
        console.log("Standard widget: Testing CPU limits");
        // Execute CPU-intensive operation
        const startTime = Date.now();
        
        // Computationally expensive operation
        const result = this._calculatePrimes(100000);
        
        const duration = Date.now() - startTime;
        console.log(`Standard widget: Found ${result.length} primes in ${duration}ms`);
        
        return true;
      } catch(e) {
        console.error("Standard widget: CPU limits test failed", e);
        return false;
      }
    },
    
    _calculatePrimes: function(max) {
      console.log(`Calculating primes up to ${max}...`);
      const sieve = [];
      const primes = [];
      
      for (let i = 2; i <= max; i++) {
        if (!sieve[i]) {
          primes.push(i);
          for (let j = i << 1; j <= max; j += i) {
            sieve[j] = true;
          }
        }
      }
      
      return primes;
    },
    
    testMemoryLimits: function() {
      try {
        console.log("Standard widget: Testing memory limits");
        // Allocate a large amount of memory
        const arrays = [];
        
        for (let i = 0; i < 10; i++) {
          console.log(`Standard widget: Allocating array ${i+1}`);
          arrays.push(new Array(1000000).fill(Math.random()));
        }
        
        console.log(`Standard widget: Allocated ${arrays.length} large arrays`);
        return true;
      } catch(e) {
        console.error("Standard widget: Memory limits test failed", e);
        return false;
      }
    },
    
    testTimeoutLimits: function() {
      try {
        console.log("Standard widget: Testing timeout management");
        // Create many timeouts
        const timeouts = [];
        
        for (let i = 0; i < 50; i++) {
          const timeout = setTimeout(() => {
            console.log(`Standard widget: Timeout ${i+1} executed`);
          }, 1000 + Math.random() * 5000);
          
          timeouts.push(timeout);
        }
        
        console.log(`Standard widget: Created ${timeouts.length} timeouts`);
        
        // Cancel half of them randomly
        timeouts.slice(0, 25).forEach(timeout => {
          clearTimeout(timeout);
        });
        
        console.log("Standard widget: Cleared 25 timeouts");
        
        return true;
      } catch(e) {
        console.error("Standard widget: Timeout management test failed", e);
        return false;
      }
    },
    
    // Communication Tests
    testEventBus: function() {
      try {
        console.log("Standard widget: Testing event communication");
        // Standard widget uses DOM events
        const customEvent = new CustomEvent('widget-event', { 
          detail: { message: 'Hello from standard widget' }
        });
        
        document.addEventListener('widget-event', function(e) {
          console.log("Standard widget: Event received", e.detail);
        }, { once: true });
        
        document.dispatchEvent(customEvent);
        return true;
      } catch(e) {
        console.error("Standard widget: Event bus test failed", e);
        return false;
      }
    },
    
    testPlatformEvents: function() {
      try {
        console.log("Standard widget: Testing platform events");
        // Create and dispatch a custom event
        const event = new CustomEvent('platform-action', {
          detail: { 
            action: 'account-selected',
            accountId: '1001',
            accountName: 'Checking'
          }
        });
        
        document.dispatchEvent(event);
        return true;
      } catch(e) {
        console.error("Standard widget: Platform events test failed", e);
        return false;
      }
    }
  };
  
  // Expose to global scope
  window.FinancialWidget = FinancialWidget;
})();