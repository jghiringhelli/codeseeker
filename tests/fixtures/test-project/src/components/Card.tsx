import React from 'react';

interface CardProps {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children }) => {
  const primaryColor = '#007bff';
  const backgroundColor = '#ffffff';
  
  return (
    <div 
      style={{ 
        backgroundColor,
        padding: '16px',
        border: `1px solid ${primaryColor}`,
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      {children}
    </div>
  );
};