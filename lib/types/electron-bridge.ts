/**
 * lib/types/electron-bridge.ts
 *
 * The WorkflowOSBridge type is defined here (not in electron/src/preload.ts)
 * so that the web app can import it without pulling in Electron's native modules.
 * electron/src/preload.ts re-exports this type for use in the Electron context.
 */

export type WorkflowOSBridge = {
  /** true when running inside the Electron app */
  isElectron: boolean;

  // Project management
  openProjectDirectory: () => Promise<string | null>;
  getProjectDir: () => Promise<string | null>;
  revealInFinder: () => Promise<void>;
  openMonitor: () => Promise<boolean>;

  // Run log
  listRuns: () => Promise<string[]>;
  readRunLog: (runId: string) => Promise<unknown[] | null>;

  // State
  readState: () => Promise<unknown | null>;

  // Approval management
  listPendingApprovals: () => Promise<Array<{ filePath: string; request: unknown }>>;
  approveAction: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  rejectAction: (filePath: string, reason?: string) => Promise<{ success: boolean; error?: string }>;

  // Auto-updater
  checkUpdate: () => Promise<string>;
  installUpdate: () => Promise<void>;
  getUpdateStatus: () => Promise<{ status: string; progress: number }>;
  onUpdateReady: (cb: () => void) => () => void;

  // .wfos file import
  openWfosFile: (filePath?: string) => Promise<{ base64: string; path: string } | { error: string } | null>;

  // Event listeners
  onProjectDirChanged: (cb: (dir: string) => void) => () => void;
  onRunLogEntries: (cb: (data: { runId: string; entries: unknown[] }) => void) => () => void;
  onStateUpdated: (cb: (state: unknown) => void) => () => void;
  onApprovalPending: (cb: (data: { filePath: string; request: unknown }) => void) => () => void;
  onApprovalGranted: (cb: (data: { filePath: string }) => void) => () => void;
  onApprovalRejected: (cb: (data: { filePath: string; reason?: string }) => void) => () => void;
};
