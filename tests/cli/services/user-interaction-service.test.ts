/**
 * User Interaction Service Test Suite
 * Tests for the search toggle and user interaction functionality
 */

import {
  UserInteractionService,
  SearchMode,
  PrePromptResult
} from '../../../src/cli/commands/services/user-interaction-service';

// Mock readline
jest.mock('readline', () => ({
  createInterface: jest.fn().mockReturnValue({
    on: jest.fn(),
    close: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn()
  })
}));

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Mock DatabaseConnections
jest.mock('../../../src/config/database-config', () => ({
  DatabaseConnections: jest.fn().mockImplementation(() => ({
    getPostgresConnection: jest.fn().mockRejectedValue(new Error('Mock - no database')),
    getNeo4jConnection: jest.fn().mockRejectedValue(new Error('Mock - no database')),
    closeAll: jest.fn()
  }))
}));

describe('UserInteractionService', () => {
  let service: UserInteractionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserInteractionService();
  });

  describe('search mode toggle', () => {
    it('should default to search enabled', () => {
      expect(service.isSearchEnabled()).toBe(true);
    });

    it('should toggle search mode off', () => {
      service.setSearchMode(false);
      expect(service.isSearchEnabled()).toBe(false);
    });

    it('should toggle search mode on', () => {
      service.setSearchMode(false);
      service.setSearchMode(true);
      expect(service.isSearchEnabled()).toBe(true);
    });

    it('should toggle search mode and return new state', () => {
      // Initially enabled, toggle should return false
      const firstToggle = service.toggleSearchMode();
      expect(firstToggle).toBe(false);
      expect(service.isSearchEnabled()).toBe(false);

      // Now disabled, toggle should return true
      const secondToggle = service.toggleSearchMode();
      expect(secondToggle).toBe(true);
      expect(service.isSearchEnabled()).toBe(true);
    });
  });

  describe('PrePromptResult interface', () => {
    it('should have correct structure for enabled search', () => {
      const result: PrePromptResult = {
        searchEnabled: true,
        prompt: 'test prompt',
        cancelled: false
      };

      expect(result.searchEnabled).toBe(true);
      expect(result.prompt).toBe('test prompt');
      expect(result.cancelled).toBe(false);
    });

    it('should have correct structure for disabled search', () => {
      const result: PrePromptResult = {
        searchEnabled: false,
        prompt: 'another prompt',
        cancelled: false
      };

      expect(result.searchEnabled).toBe(false);
      expect(result.prompt).toBe('another prompt');
      expect(result.cancelled).toBe(false);
    });

    it('should have correct structure for cancelled operation', () => {
      const result: PrePromptResult = {
        searchEnabled: true,
        prompt: '',
        cancelled: true
      };

      expect(result.cancelled).toBe(true);
      expect(result.prompt).toBe('');
    });
  });

  describe('SOLID compliance', () => {
    it('should have search mode methods available', () => {
      expect(typeof service.isSearchEnabled).toBe('function');
      expect(typeof service.setSearchMode).toBe('function');
      expect(typeof service.toggleSearchMode).toBe('function');
    });

    it('should have prompt methods available', () => {
      expect(typeof service.promptWithSearchToggle).toBe('function');
      expect(typeof service.promptWithInlineToggle).toBe('function');
    });

    it('should maintain search mode state consistently', () => {
      // Test state consistency through multiple operations
      service.setSearchMode(true);
      expect(service.isSearchEnabled()).toBe(true);

      service.toggleSearchMode();
      expect(service.isSearchEnabled()).toBe(false);

      service.toggleSearchMode();
      expect(service.isSearchEnabled()).toBe(true);

      service.setSearchMode(false);
      expect(service.isSearchEnabled()).toBe(false);
    });
  });

  describe('SearchMode type', () => {
    it('should accept valid search mode values', () => {
      const enabledMode: SearchMode = 'enabled';
      const disabledMode: SearchMode = 'disabled';

      expect(enabledMode).toBe('enabled');
      expect(disabledMode).toBe('disabled');
    });
  });
});

describe('UserInteractionService Integration', () => {
  let service: UserInteractionService;
  const inquirer = require('inquirer');

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserInteractionService();
  });

  describe('promptWithSearchToggle', () => {
    it('should return result with prompt when user enters a prompt', async () => {
      // Mock the inquirer prompts
      inquirer.prompt
        .mockResolvedValueOnce({ action: 'prompt' })
        .mockResolvedValueOnce({ userPrompt: 'my test prompt' });

      const result = await service.promptWithSearchToggle();

      expect(result.prompt).toBe('my test prompt');
      expect(result.cancelled).toBe(false);
      expect(result.searchEnabled).toBe(true);
    });

    it('should return cancelled result when user cancels', async () => {
      inquirer.prompt.mockResolvedValueOnce({ action: 'cancel' });

      const result = await service.promptWithSearchToggle();

      expect(result.cancelled).toBe(true);
      expect(result.prompt).toBe('');
    });

    it('should toggle search mode and re-prompt when user toggles', async () => {
      // First call - toggle action
      // Second call - prompt action after toggle
      // Third call - get the actual prompt
      inquirer.prompt
        .mockResolvedValueOnce({ action: 'toggle' })
        .mockResolvedValueOnce({ action: 'prompt' })
        .mockResolvedValueOnce({ userPrompt: 'after toggle' });

      const result = await service.promptWithSearchToggle();

      expect(result.searchEnabled).toBe(false); // Toggled from true to false
      expect(result.prompt).toBe('after toggle');
    });

    it('should handle ExitPromptError gracefully', async () => {
      const exitError = new Error('force closed');
      exitError.name = 'ExitPromptError';
      inquirer.prompt.mockRejectedValueOnce(exitError);

      const result = await service.promptWithSearchToggle();

      expect(result.cancelled).toBe(true);
      expect(result.prompt).toBe('');
    });
  });

  describe('promptWithInlineToggle', () => {
    it('should return result with prompt when user enters text', async () => {
      inquirer.prompt.mockResolvedValueOnce({ input: 'inline test prompt' });

      const result = await service.promptWithInlineToggle();

      expect(result.prompt).toBe('inline test prompt');
      expect(result.cancelled).toBe(false);
      expect(result.searchEnabled).toBe(true);
    });

    it('should toggle search mode when user enters "s"', async () => {
      // First call returns 's' to toggle
      // Second call returns the actual prompt
      inquirer.prompt
        .mockResolvedValueOnce({ input: 's' })
        .mockResolvedValueOnce({ input: 'after toggle inline' });

      const result = await service.promptWithInlineToggle();

      expect(result.searchEnabled).toBe(false); // Toggled from true to false
      expect(result.prompt).toBe('after toggle inline');
    });

    it('should handle multiple toggles correctly', async () => {
      // Toggle twice, then enter prompt
      inquirer.prompt
        .mockResolvedValueOnce({ input: 's' })  // Toggle to false
        .mockResolvedValueOnce({ input: 'S' })  // Toggle back to true (uppercase)
        .mockResolvedValueOnce({ input: 'final prompt' });

      const result = await service.promptWithInlineToggle();

      expect(result.searchEnabled).toBe(true); // Toggled twice = back to original
      expect(result.prompt).toBe('final prompt');
    });

    it('should handle ExitPromptError gracefully', async () => {
      const exitError = new Error('force closed');
      exitError.name = 'ExitPromptError';
      inquirer.prompt.mockRejectedValueOnce(exitError);

      const result = await service.promptWithInlineToggle();

      expect(result.cancelled).toBe(true);
      expect(result.prompt).toBe('');
    });
  });
});