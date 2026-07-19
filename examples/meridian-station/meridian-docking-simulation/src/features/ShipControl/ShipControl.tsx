/**
 * ShipControl Feature Component
 * Manual ship orientation &amp; translation controls (WASD + arrow keys)
 * Generated from mfe-manifest.yaml capability definition
 */
import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  padding: 20px;
  background: #0a0a0f;
  color: #0f0;
  font-family: 'Courier New', monospace;
  border: 1px solid #0f0;
`;

export interface ShipControlProps {}

export const ShipControl: React.FC<ShipControlProps> = () => {
  return (
    <Container>
      <h2>ShipControl</h2>
      <p>Manual ship orientation & translation controls (WASD + arrow keys)</p>
      <p>This capability provides real-time ship control feedback during the docking simulation.</p>
    </Container>
  );
};

export default ShipControl;
