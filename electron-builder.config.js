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
  ],
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
