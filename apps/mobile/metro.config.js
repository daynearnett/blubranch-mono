const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// TypeScript NodeNext-style imports use `.js` suffixes that resolve to `.ts`
// or `.tsx` source files at compile time. Metro's resolver looks for the
// literal extension on disk; reroute the trailing `.js` to the matching TS
// source so we don't have to strip suffixes in every mobile file. The shim
// only fires for relative paths (so node_modules `.js` files pass through).
const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    (moduleName.startsWith('.') || moduleName.startsWith('/')) &&
    moduleName.endsWith('.js')
  ) {
    for (const replacement of ['.tsx', '.ts']) {
      try {
        const candidate = moduleName.replace(/\.js$/, replacement);
        return context.resolveRequest(context, candidate, platform);
      } catch {
        // fall through to next attempt
      }
    }
  }
  if (baseResolveRequest) return baseResolveRequest(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
