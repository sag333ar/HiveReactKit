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

npm run build:all

git add .
git commit -m "Updated version"
git push origin main

cd dist-app

# Check if pm2 is installed, install if not
if ! command -v pm2 &> /dev/null; then
    echo "pm2 not found, installing globally..."
    npm install -g pm2
fi

pm2 restart hivereactkit

cd ..

echo "Deployment complete"