
import { mfe1MFE } from './mfe';
import { Context } from 'platform-runtime';

describe('mfe1MFE', () => {
  let mfe: mfe1MFE;
  let manifest: any;
  let context: Context;

  beforeEach(() => {
    manifest = {
  "name": "mfe1",
  "version": "1.0.0",
  "type": "tool",
  "language": "typescript",
  "description": "new MFE using new DSL",
  "owner": "seans-mfe-tool-team",
  "tags": [
    "data-new",
    "dsl",
    "display dsl"
  ],
  "category": "data-awesome",
  "endpoint": "http://localhost:3002",
  "remoteEntry": "http://localhost:3002/remoteEntry.js",
  "discovery": "http://localhost:3002/.well-known/mfe-manifest.yaml",
  "capabilities": [
    {
      "Load": {
        "type": "platform",
        "description": "Initialize the analyzer module"
      }
    },
    {
      "Render": {
        "type": "platform",
        "description": "Render the analyzer UI"
      }
    },
    {
      "HomePage": {
        "type": "domain",
        "description": "provide the MFE as a homepage"
      }
    },
    {
      "IconView": {
        "type": "domain",
        "description": "View this MFE as an icon"
      }
    },
    {
      "CatalogView": {
        "type": "domain",
        "description": "View this MFE as a catalog"
      }
    }
  ],
  "dependencies": {
    "runtime": {
      "react": "^18.2.0",
      "react-dom": "^18.2.0"
    },
    "design-system": {
      "@mui/material": "^5.14.0",
      "@emotion/react": "^11.11.1",
      "@emotion/styled": "^11.11.0"
    }
  },
  "data": {
    "sources": [
      {
        "name": "SpaceXAPI",
        "handler": {
          "type": "graphql",
          "endpoint": "https://spacex-production.up.railway.app/",
          "operationHeaders": {
            "Content-Type": "application/json"
          }
        }
      },
      {
        "name": "JSONPlaceholder",
        "handler": {
          "type": "jsonSchema",
          "endpoint": "https://jsonplaceholder.typicode.com",
          "operations": [
            {
              "field": "getUsers",
              "path": "/users",
              "method": "GET",
              "type": "query",
              "responseSchema": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "integer"
                    },
                    "name": {
                      "type": "string"
                    },
                    "username": {
                      "type": "string"
                    },
                    "email": {
                      "type": "string"
                    },
                    "phone": {
                      "type": "string"
                    },
                    "website": {
                      "type": "string"
                    }
                  }
                }
              }
            },
            {
              "field": "getUser",
              "path": "/users/{args.id}",
              "method": "GET",
              "type": "query"
            },
            {
              "field": "getPosts",
              "path": "/posts",
              "method": "GET",
              "type": "query"
            },
            {
              "field": "createPost",
              "path": "/posts",
              "method": "POST",
              "type": "mutation"
            }
          ]
        },
        "transforms": [
          {
            "type": "rename",
            "rename": {
              "mode": "bare",
              "renames": [
                {
                  "from": {
                    "type": "query_getUsers_items",
                    "field": "email"
                  },
                  "to": {
                    "type": "query_getUsers_items",
                    "field": "assignedTo"
                  }
                },
                {
                  "from": {
                    "type": "query_getUsers_items",
                    "field": "username"
                  },
                  "to": {
                    "type": "query_getUsers_items",
                    "field": "handle"
                  }
                }
              ]
            }
          }
        ]
      },
      {
        "name": "ReqResAPI",
        "handler": {
          "type": "jsonSchema",
          "endpoint": "https://reqres.in/api",
          "operations": [
            {
              "field": "listUsers",
              "path": "/users",
              "method": "GET",
              "type": "query"
            },
            {
              "field": "getUser",
              "path": "/users/{args.id}",
              "method": "GET",
              "type": "query"
            },
            {
              "field": "createUser",
              "path": "/users",
              "method": "POST",
              "type": "mutation"
            }
          ]
        }
      }
    ],
    "serve": {
      "endpoint": "/graphql",
      "playground": true
    }
  }
};
    mfe = new mfe1MFE(manifest);
    context = { timestamp: new Date(), requestId: 'test' };
  });

  it('should instantiate without error', () => {
    expect(mfe).toBeInstanceOf(mfe1MFE);
  });

  
  it('should call load and return stub', async () => {
    const result = await mfe.load(context);
    expect(result).toBeDefined();
  });
  
  it('should call render and return stub', async () => {
    const result = await mfe.render(context);
    expect(result).toBeDefined();
  });
  
  it('should call HomePage and return stub', async () => {
    const result = await mfe.HomePage(context);
    expect(result).toBeDefined();
  });
  
  it('should call IconView and return stub', async () => {
    const result = await mfe.IconView(context);
    expect(result).toBeDefined();
  });
  
  it('should call CatalogView and return stub', async () => {
    const result = await mfe.CatalogView(context);
    expect(result).toBeDefined();
  });
  

  
});
