import React, { useEffect, useState } from 'react';
import { getUsers, getLaunches, type User, type Launch } from '../lib/graphqlClient';

/**
 * POC Demo Component - Type-safe GraphQL client without external dependencies
 *
 * This demonstrates:
 * - Type-safe GraphQL queries with manual types
 * - Zero runtime overhead (no RTK, no codegen)
 * - Simple fetch-based approach
 *
 * Future: Could auto-generate types from schema introspection
 */

const UsersDemo: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersData, launchesData] = await Promise.all([getUsers(), getLaunches(5)]);
        setUsers(usersData);
        setLaunches(launchesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading data from BFF...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h3>Error:</h3>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h2>✅ Type-Safe GraphQL Client Working!</h2>

      {/* Users from JSONPlaceholder (with transforms) */}
      <div
        style={{ marginTop: '20px', background: '#e8f5e9', padding: '15px', borderRadius: '8px' }}
      >
        <h3>👥 Users from JSONPlaceholder ({users?.length || 0})</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {users?.slice(0, 3).map((user) => (
            <div key={user.id} style={{ background: '#fff', padding: '10px', borderRadius: '4px' }}>
              <strong>{user.name}</strong>
              <div style={{ fontSize: '14px', color: '#666' }}>
                <div>📧 {user.assignedTo}</div>
                <div>👤 @{user.handle}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Launches from SpaceX GraphQL API */}
      <div
        style={{ marginTop: '20px', background: '#e3f2fd', padding: '15px', borderRadius: '8px' }}
      >
        <h3>🚀 Recent SpaceX Launches ({launches?.length || 0})</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {launches?.map((launch, idx) => (
            <div key={idx} style={{ background: '#fff', padding: '10px', borderRadius: '4px' }}>
              <strong>{launch.mission_name}</strong>
              <div style={{ fontSize: '14px', color: '#666' }}>
                <div>
                  🚀 {launch.rocket.rocket_name} ({launch.rocket.rocket_type})
                </div>
                <div>📅 {new Date(launch.launch_date_local).toLocaleDateString()}</div>
                <div>
                  {launch.launch_success === true
                    ? '✅ Success'
                    : launch.launch_success === false
                      ? '❌ Failed'
                      : '❓ Unknown'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits Demo */}
      <div
        style={{ marginTop: '20px', background: '#fff3cd', padding: '15px', borderRadius: '8px' }}
      >
        <h3>🎯 What This Demonstrates:</h3>
        <ul>
          <li>
            ✅ <strong>Type Safety:</strong> TypeScript knows all field types (User, Launch)
          </li>
          <li>
            ✅ <strong>Transform Validation:</strong> email→assignedTo, username→handle work!
          </li>
          <li>
            ✅ <strong>Multi-Source:</strong> JSONPlaceholder + SpaceX in one query
          </li>
          <li>
            ✅ <strong>Zero Dependencies:</strong> Just fetch + TypeScript
          </li>
          <li>
            ✅ <strong>Simple Client:</strong> 80 lines of reusable code
          </li>
        </ul>
      </div>

      {/* Next Steps */}
      <div
        style={{ marginTop: '20px', background: '#f3e5f5', padding: '15px', borderRadius: '8px' }}
      >
        <h3>📋 Future Enhancements:</h3>
        <ol>
          <li>
            <strong>Auto-generate types</strong> from GraphQL schema introspection
          </li>
          <li>
            <strong>React hooks</strong> with caching (lightweight, no RTK needed)
          </li>
          <li>
            <strong>Code generation</strong> from manifest capabilities
          </li>
          <li>
            <strong>Optimistic updates</strong> for mutations
          </li>
        </ol>
        <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          <strong>Key insight:</strong> We don't need heavy libraries. A simple, typed client is
          enough!
        </p>
      </div>
    </div>
  );
};

export default UsersDemo;
