module.exports = {
  "win": {
    "target": [
      {
        "target": "portable",
        "arch": [
          "x64",
        ]
      }
    ]
  },
  "mac": {
    "target": [
      {
        "target": "dmg",
        "arch": [
          "universal"
        ]
      }
    ]
  },
  "files": [
    "dist/**/*",
    "electron/**/*"
  ],
  "extraMetadata": {
    "main": "dist/main.js"
  }
}
