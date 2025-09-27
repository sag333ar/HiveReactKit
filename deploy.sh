git pull

npm i

# Update patch version in package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg.version.split('.');
version[2] = (parseInt(version[2]) + 1).toString();
pkg.version = version.join('.');
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('Updated version to:', pkg.version);
"

npm run build

git add .
git commit -m "Updated version"
git push origin main

cd dist

pm2 restart hivereactkit

cd ..

echo "Deployment complete"