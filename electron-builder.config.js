module.exports = {
  appId: 'com.AviationI.aviationchecklist',
  productName: 'Aviation Safety Oversight Checklist',
  directories: {
    output: 'dist-portable',
    buildResources: 'resources',
  },
  files: [
    'dist/**/*',
    'electron/main.mjs',
    'electron/preload.cjs',
    'electron/ipc/**/*',
    'electron/utils/**/*',
  ],
  extraResources: [
    {
      from: 'public/images/',
      to: 'assets/images/',
      filter: ['**/*'],
    },
    // Shipped next to the app (not inside app.asar) so a packaged build can seed
    // its writable config with the real API hosts instead of localhost defaults.
    {
      from: 'app.config.json',
      to: 'app.config.json',
    },
  ],
  // Code Signing — uncomment and configure for production builds.
  // Without signing, the .exe will trigger Windows SmartScreen warnings
  // and macOS Gatekeeper will refuse to open the app.
  //
  // Windows: requires a code signing certificate (.pfx or hardware token).
  //   win: {
  //     target: [{ target: 'portable', arch: ['x64'] }],
  //     icon: 'public/images/complianceApp.ico',
  //     certificateFile: 'path/to/cert.pfx',
  //     certificatePassword: process.env.CSC_KEY_PASSWORD,
  //   },
  //
  // macOS: requires an Apple Developer ID certificate.
  //   mac: {
  //     target: [{ target: 'dmg', arch: ['universal'] }],
  //     icon: 'public/images/complianceApp.icns',
  //     hardenedRuntime: true,
  //     gatekeeperAssess: false,
  //     entitlements: 'build/entitlements.mac.plist',
  //     entitlementsInherit: 'build/entitlements.mac.plist',
  //   },
  //   afterSign: 'scripts/notarize.js',
  //
  win: {
    target: [
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],
    icon: 'public/images/complianceApp.ico',
  },
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['universal'],
      },
    ],
    icon: 'public/images/complianceApp.icns',
  },
}
