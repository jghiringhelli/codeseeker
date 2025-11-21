/**
 * Setup Progress Reporter Service
 * Single Responsibility: Handle all setup UI and progress reporting
 */
import { ISetupReporter, SetupStatus } from './interfaces/setup-interfaces';
export declare class SetupReporter implements ISetupReporter {
    private stepCount;
    displayProgress(step: string, status: 'running' | 'success' | 'error' | 'warning'): void;
    displaySummary(status: SetupStatus, duration: number): void;
    displayErrorHelp(error: Error): void;
    private displayNextSteps;
    private capitalize;
}
//# sourceMappingURL=setup-reporter.d.ts.map