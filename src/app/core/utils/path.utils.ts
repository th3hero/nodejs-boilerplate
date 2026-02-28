/**
 * Path Utilities
 */

let projectRoot: string | null = null;

export const getProjectRoot = (): string => {
    if (!projectRoot) {
        projectRoot = process.cwd();
    }
    return projectRoot;
};
