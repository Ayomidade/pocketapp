const { withProjectBuildGradle, withGradleProperties } = require('expo/config-plugins');

module.exports = function withAndroidKotlinVersion(config) {
  config = withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter((item) => item.key !== 'android.kotlinVersion');
    mod.modResults.push({ type: 'property', key: 'android.kotlinVersion', value: '1.9.25' });
    return mod;
  });

  return withProjectBuildGradle(config, (mod) => {
    mod.modResults.contents = mod.modResults.contents.replace(
      /classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::[^'"]*)?['"]\)/g,
      'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")'
    );
    return mod;
  });
};
