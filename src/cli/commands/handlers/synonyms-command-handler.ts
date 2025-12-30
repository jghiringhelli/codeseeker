/**
 * Synonyms Command Handler
 * Single Responsibility: Manage search synonyms for better query matching
 *
 * Commands:
 *   synonyms list              - Show all synonyms
 *   synonyms add <term> <synonyms>  - Add a synonym rule (comma-separated)
 *   synonyms remove <term>     - Remove a synonym rule
 *   synonyms import-defaults   - Import default code synonyms
 *   synonyms clear             - Clear all synonyms
 */

import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
import { getStorageManager } from '../../../storage';
import { MiniSearchTextStore } from '../../../storage/embedded/minisearch-text-store';
import { Theme } from '../../ui/theme';

export class SynonymsCommandHandler extends BaseCommandHandler {
  async handle(args: string): Promise<CommandResult> {
    const parts = args.trim().split(/\s+/);
    const subCommand = parts[0]?.toLowerCase() || 'list';
    const restArgs = parts.slice(1).join(' ');

    try {
      const storageManager = await getStorageManager();

      if (storageManager.getMode() !== 'embedded') {
        return {
          success: false,
          message: 'Synonyms are only available in embedded storage mode. Server mode uses PostgreSQL full-text search.'
        };
      }

      // Get the text store from vector store (which wraps MiniSearch)
      const vectorStore = storageManager.getVectorStore();
      const textStore = (vectorStore as any).getTextStore?.() as MiniSearchTextStore | undefined;

      if (!textStore) {
        return {
          success: false,
          message: 'Text store not available. Make sure the project is initialized.'
        };
      }

      const projectId = this.context.currentProject?.projectId;

      switch (subCommand) {
        case 'list':
          return await this.listSynonyms(textStore, projectId);

        case 'add':
          return await this.addSynonym(textStore, restArgs, projectId);

        case 'remove':
          return await this.removeSynonym(textStore, restArgs, projectId);

        case 'import-defaults':
          return await this.importDefaults(textStore, projectId);

        case 'clear':
          return await this.clearSynonyms(textStore, projectId);

        default:
          return {
            success: false,
            message: this.getUsage()
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Synonyms command failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async listSynonyms(textStore: MiniSearchTextStore, projectId?: string): Promise<CommandResult> {
    const synonyms = await textStore.getSynonyms(projectId);

    if (synonyms.length === 0) {
      console.log(Theme.colors.muted('\n📚 No synonyms configured.'));
      console.log(Theme.colors.muted('   Use "synonyms import-defaults" to add common code synonyms.'));
      console.log(Theme.colors.muted('   Use "synonyms add <term> <synonym1,synonym2,...>" to add custom synonyms.\n'));
      return {
        success: true,
        message: 'No synonyms configured'
      };
    }

    console.log(Theme.colors.primary('\n📚 Configured Synonyms:\n'));

    // Group by scope (global vs project-specific)
    const globalSynonyms = synonyms.filter(s => !s.projectId);
    const projectSynonyms = synonyms.filter(s => s.projectId);

    if (globalSynonyms.length > 0) {
      console.log(Theme.colors.success('Global Synonyms:'));
      for (const syn of globalSynonyms) {
        console.log(`  ${Theme.colors.info(syn.term)} → ${syn.synonyms.join(', ')}`);
      }
      console.log();
    }

    if (projectSynonyms.length > 0) {
      console.log(Theme.colors.success('Project Synonyms:'));
      for (const syn of projectSynonyms) {
        console.log(`  ${Theme.colors.info(syn.term)} → ${syn.synonyms.join(', ')}`);
      }
      console.log();
    }

    return {
      success: true,
      message: `Listed ${synonyms.length} synonym rules`,
      data: { synonyms }
    };
  }

  private async addSynonym(textStore: MiniSearchTextStore, args: string, projectId?: string): Promise<CommandResult> {
    // Parse: term synonym1,synonym2,synonym3
    const match = args.match(/^(\S+)\s+(.+)$/);

    if (!match) {
      return {
        success: false,
        message: 'Usage: synonyms add <term> <synonym1,synonym2,...>\n' +
                 'Example: synonyms add handler controller,manager,processor'
      };
    }

    const term = match[1].toLowerCase();
    const synonyms = match[2].split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);

    if (synonyms.length === 0) {
      return {
        success: false,
        message: 'Please provide at least one synonym'
      };
    }

    await textStore.addSynonym(term, synonyms, projectId);

    console.log(Theme.colors.success(`\n✓ Added synonym rule:`));
    console.log(`  ${Theme.colors.info(term)} → ${synonyms.join(', ')}`);
    console.log(Theme.colors.muted(`  Scope: ${projectId ? 'project' : 'global'}\n`));

    return {
      success: true,
      message: `Added synonym: ${term} → ${synonyms.join(', ')}`
    };
  }

  private async removeSynonym(textStore: MiniSearchTextStore, term: string, projectId?: string): Promise<CommandResult> {
    if (!term.trim()) {
      return {
        success: false,
        message: 'Usage: synonyms remove <term>'
      };
    }

    const removed = await textStore.removeSynonym(term.trim().toLowerCase(), projectId);

    if (removed) {
      console.log(Theme.colors.success(`\n✓ Removed synonym rule for "${term}"\n`));
      return {
        success: true,
        message: `Removed synonym for: ${term}`
      };
    } else {
      return {
        success: false,
        message: `No synonym found for: ${term}`
      };
    }
  }

  private async importDefaults(textStore: MiniSearchTextStore, projectId?: string): Promise<CommandResult> {
    const defaults = MiniSearchTextStore.getDefaultCodeSynonyms();

    let count = 0;
    for (const { term, synonyms } of defaults) {
      await textStore.addSynonym(term, synonyms, projectId);
      count++;
    }

    console.log(Theme.colors.success(`\n✓ Imported ${count} default code synonym rules:`));
    console.log(Theme.colors.muted('   Examples:'));
    console.log(Theme.colors.muted('   • function → method, func, procedure, fn'));
    console.log(Theme.colors.muted('   • handler → listener, hook, callback'));
    console.log(Theme.colors.muted('   • database → db, datastore, storage'));
    console.log(Theme.colors.muted('\n   Use "synonyms list" to see all synonyms.\n'));

    return {
      success: true,
      message: `Imported ${count} default synonyms`,
      data: { count }
    };
  }

  private async clearSynonyms(textStore: MiniSearchTextStore, projectId?: string): Promise<CommandResult> {
    await textStore.clearSynonyms(projectId);

    const scope = projectId ? 'project' : 'all';
    console.log(Theme.colors.success(`\n✓ Cleared ${scope} synonyms\n`));

    return {
      success: true,
      message: `Cleared ${scope} synonyms`
    };
  }

  private getUsage(): string {
    return `
📚 Synonyms Command - Manage search synonyms

Usage:
  synonyms list              Show all configured synonyms
  synonyms add <term> <syn>  Add a synonym rule (comma-separated synonyms)
  synonyms remove <term>     Remove a synonym rule
  synonyms import-defaults   Import default code synonyms (handler→controller, etc.)
  synonyms clear             Clear all synonyms

Examples:
  synonyms add handler controller,manager,processor
  synonyms add auth authentication,login,oauth
  synonyms add db database,datastore
  synonyms remove handler

When you search for "handler", the search will also find "controller", "manager", etc.
`;
  }
}