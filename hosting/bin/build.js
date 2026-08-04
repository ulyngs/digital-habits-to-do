#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const amplifyHosting = path.join(root, '.amplify-hosting');
const computeDefault = path.join(amplifyHosting, 'compute', 'default');
const staticDir = path.join(amplifyHosting, 'static');

function rmrf(target) {
    fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
}

rmrf(amplifyHosting);
fs.mkdirSync(computeDefault, { recursive: true });
fs.mkdirSync(staticDir, { recursive: true });

copyDir(path.join(root, 'src'), computeDefault);
copyDir(path.join(root, 'node_modules'), path.join(computeDefault, 'node_modules'));
copyDir(path.join(root, 'public'), staticDir);
fs.copyFileSync(
    path.join(root, 'deploy-manifest.json'),
    path.join(amplifyHosting, 'deploy-manifest.json')
);
fs.copyFileSync(
    path.join(root, 'package.json'),
    path.join(computeDefault, 'package.json')
);

console.log('Built Amplify Hosting bundle at .amplify-hosting/');
