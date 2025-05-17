// Structure for an MFE project
const projectStructure = {
  shell: {
    name: 'string',
    port: 'number',
    type: 'string',
    theme: {
      primaryColor: 'string',
      secondaryColor: 'string',
      mode: 'string'
    },
    dependencies: 'object',
    layout: 'object'
  },
  remotes: [
    {
      name: 'string',
      port: 'number',
      type: 'string',
      exposedComponents: [
        {
          name: 'string',
          path: 'string'
        }
      ],
      dependencies: 'object',
      routes: [
        {
          path: 'string',
          component: 'string',
          exact: 'boolean'
        }
      ]
    }
  ],
  apis: [
    {
      name: 'string',
      port: 'number',
      type: 'string',
      database: 'string',
      spec: 'string',
      routes: [
        {
          path: 'string',
          methods: ['string']
        }
      ]
    }
  ]
};

// Validates a spec object against the expected structure
function validateSpec(spec) {
  // Required top-level properties
  const requiredProps = ['version', 'name', 'shell'];
  
  for (const prop of requiredProps) {
    if (!spec[prop]) {
      throw new Error(`Missing required property: ${prop}`);
    }
  }
  
  // Shell validation
  if (!spec.shell.name || !spec.shell.port) {
    throw new Error('Shell must have name and port properties');
  }
  
  // Remotes validation
  if (spec.remotes) {
    if (!Array.isArray(spec.remotes)) {
      throw new Error('remotes must be an array');
    }
    
    for (const remote of spec.remotes) {
      if (!remote.name || !remote.port) {
        throw new Error('Each remote must have name and port properties');
      }
      
      if (remote.exposedComponents && !Array.isArray(remote.exposedComponents)) {
        throw new Error('exposedComponents must be an array');
      }
      
      if (remote.routes && !Array.isArray(remote.routes)) {
        throw new Error('routes must be an array');
      }
    }
  }
  
  // APIs validation
  if (spec.apis) {
    if (!Array.isArray(spec.apis)) {
      throw new Error('apis must be an array');
    }
    
    for (const api of spec.apis) {
      if (!api.name || !api.port || !api.database) {
        throw new Error('Each API must have name, port, and database properties');
      }
      
      if (api.routes && !Array.isArray(api.routes)) {
        throw new Error('API routes must be an array');
      }
    }
  }
  
  return true;
}

module.exports = {
  projectStructure,
  validateSpec
};
