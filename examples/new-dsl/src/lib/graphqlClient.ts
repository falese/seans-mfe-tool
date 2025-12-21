// Type-safe GraphQL client - zero external dependencies
// Types are manually defined but could be auto-generated in the future

// GraphQL Types (manually typed for now)
export interface User {
  id: number;
  name: string;
  assignedTo: string;  // Renamed from 'email' by transform
  handle: string;       // Renamed from 'username' by transform
}

export interface Launch {
  mission_name: string;
  launch_date_local: string;
  launch_success: boolean | null;
  rocket: {
    rocket_name: string;
    rocket_type: string;
  };
}

// GraphQL Query Response Types
export interface GetUsersResponse {
  getUsers: User[];
}

export interface GetLaunchesResponse {
  launchesPast: Launch[];
}

// GraphQL Client with type safety
class GraphQLClient {
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(endpoint: string, headers: Record<string, string> = {}) {
    this.endpoint = endpoint;
    this.headers = {
      'Content-Type': 'application/json',
      ...headers,
    };
  }

  async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data as T;
  }
}

// Create client instance
export const graphqlClient = new GraphQLClient('http://localhost:4002/graphql');

// Type-safe query functions
export const getUsers = async (): Promise<User[]> => {
  const data = await graphqlClient.query<GetUsersResponse>(`
    query GetUsers {
      getUsers {
        id
        name
        assignedTo
        handle
      }
    }
  `);
  return data.getUsers || [];
};

export const getLaunches = async (limit: number = 10): Promise<Launch[]> => {
  const data = await graphqlClient.query<GetLaunchesResponse>(
    `
    query GetLaunches($limit: Int) {
      launchesPast(limit: $limit) {
        mission_name
        launch_date_local
        launch_success
        rocket {
          rocket_name
          rocket_type
        }
      }
    }
  `,
    { limit }
  );
  return data.launchesPast || [];
};
