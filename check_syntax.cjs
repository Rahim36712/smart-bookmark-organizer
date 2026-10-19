const fs = require('fs');
const { execSync } = require('child_process');

function findJs(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = dir + '/' + file;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file !== 'node_modules') results = results.concat(findJs(full));
    } else if (file.endsWith('.js') || file.endsWith('.cjs')) {
      results.push(full);
    }
  }
  return results;
}

const jsFiles = findJs('.');
console.log(`Checking syntax for ${jsFiles.length} JS files...`);
for (const file of jsFiles) {
  try {
    execSync(`node --check "${file}"`);
    console.log(`✓ ${file}`);
  } catch (err) {
    console.error(`✗ Syntax error in ${file}:`, err.message);
    process.exit(1);
  }
}
console.log('All JavaScript files passed syntax check!');
