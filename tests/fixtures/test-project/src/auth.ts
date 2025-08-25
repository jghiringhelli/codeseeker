export function validateUser(username: string, password: string): boolean {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  if (username.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }
  
  return true;
}

export const API_URL = 'https://api.example.com/auth';
export const TIMEOUT = 5000;