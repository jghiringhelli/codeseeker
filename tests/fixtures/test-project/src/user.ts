export function validateUserData(name: string, email: string): boolean {
  if (!name || !email) {
    throw new Error('Name and email are required');
  }
  
  if (name.length < 3) {
    throw new Error('Name must be at least 3 characters');
  }
  
  return true;
}

export const API_BASE = 'https://api.example.com/users';
export const REQUEST_TIMEOUT = 5000;