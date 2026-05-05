// Disable Xcode 15+ User Script Sandboxing on the generated iOS project.
//
// React Native's "Bundle React Native code and images" build phase writes
// `ip.txt` (the dev-server IP file) into the .app bundle. Xcode 15 turned
// User Script Sandboxing on by default, which blocks that write and fails
// the device build with:
//   error: Sandbox: bash(...) deny(1) file-write-create .../Accountibuzz.app/ip.txt
//
// This plugin sets ENABLE_USER_SCRIPT_SANDBOXING = NO on every
// XCBuildConfiguration in the generated pbxproj so the setting survives
// `npx expo prebuild --clean`. No runtime impact — only build-time scripts
// are affected.
//
// Source of issue: https://github.com/expo/expo/issues/27774 (Expo SDK 50+
// device builds on Xcode 15.3+).

const { withXcodeProject } = require('@expo/config-plugins');

const withDisableScriptSandbox = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const buildConfigs = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(buildConfigs)) {
      const entry = buildConfigs[key];
      if (
        entry &&
        typeof entry === 'object' &&
        entry.buildSettings &&
        typeof entry.buildSettings === 'object'
      ) {
        entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return cfg;
  });

module.exports = withDisableScriptSandbox;
