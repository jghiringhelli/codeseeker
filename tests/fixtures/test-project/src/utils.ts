import { validateUser } from './auth';
import { validateUserData } from './user';

export function formatError(message: string): string {
  return `Error: ${message}`;
}

export const colors = {
  primary: '#007bff',
  secondary: '#6c757d',
  success: '#28a745',
  danger: '#dc3545'
};