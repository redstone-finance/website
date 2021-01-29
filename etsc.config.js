module.exports = {
  outDir: './distserver',
  esbuild: {
    minify: false,
    platform: 'node',
  },
  tsConfigFile: 'custom-tsconfig.json'
};