// react-native-map-web-fix.js
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

function log(...args) {
  console.log(chalk.yellow('[react-native-maps]'), ...args);
}

async function reactNativeMaps() {
  try {
    log('📦 Creating web compatibility of react-native-maps using an empty module loaded on web builds');
    const modulePath = path.join(process.cwd(), 'node_modules/react-native-maps');
    
    // Create lib directory if it doesn't exist
    if (!fs.existsSync(path.join(modulePath, 'lib'))) {
      fs.mkdirSync(path.join(modulePath, 'lib'), { recursive: true });
    }
    
    // Write empty module
    fs.writeFileSync(
      path.join(modulePath, 'lib', 'index.web.js'),
      'module.exports = {};'
    );
    
    // Copy type definitions if they exist
    const typesPath = path.join(modulePath, 'lib', 'index.d.ts');
    if (fs.existsSync(typesPath)) {
      fs.copyFileSync(typesPath, path.join(modulePath, 'lib', 'index.web.d.ts'));
    }
    
    // Update package.json
    const pkgPath = path.join(modulePath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkg['react-native'] = 'lib/index.js';
    pkg['main'] = 'lib/index.web.js';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    
    log('✅ script ran successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

reactNativeMaps();