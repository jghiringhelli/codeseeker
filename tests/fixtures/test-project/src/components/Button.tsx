import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary' }) => {
  const primaryColor = '#007bff';
  const secondaryColor = '#6c757d';
  
  return (
    <button 
      style={{ 
        backgroundColor: variant === 'primary' ? primaryColor : secondaryColor,
        padding: '8px 16px',
        border: 'none',
        borderRadius: '4px'
      }}
    >
      {children}
    </button>
  );
};