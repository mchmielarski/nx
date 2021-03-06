import { affectedApps } from './affected';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const command = process.argv[2];
let apps;
let rest;

try {
  const p = parseFiles();
  rest = p.rest;
  apps = getAffectedApps(p.files);
} catch (e) {
  printError(command);
}

switch (command) {
  case 'apps':
    console.log(apps.join(' '));
    break;
  case 'build':
    build(apps, rest);
    break;
  case 'e2e':
    e2e(apps, rest);
    break;
}

function printError(command: string) {
  console.error(`Pass the SHA range, as follows: npm run ${command}:affected SHA1 SHA2.`);
  console.error(
    `Or pass the list of affected files, as follows: npm run ${command}:affected --files="libs/mylib/index.ts,libs/mylib2/index.ts".`
  );
}

function parseFiles() {
  const args = process.argv.slice(3);
  const dashDashFiles = args.filter(a => a.startsWith('--files='))[0];
  if (dashDashFiles) {
    args.splice(args.indexOf(dashDashFiles), 1);
    return { files: parseDashDashFiles(dashDashFiles), rest: args.join(' ') };
  } else {
    const withoutShahs = args.slice(2);
    return { files: getFilesFromShash(args[0], args[1]), rest: withoutShahs.join(' ') };
  }
}

function parseDashDashFiles(dashDashFiles: string): string[] {
  let f = dashDashFiles.substring(8); // remove --files=
  if (f.startsWith('"') || f.startsWith("'")) {
    f = f.substring(1, f.length - 1);
  }
  return f.split(',').map(f => f.trim());
}

function getFilesFromShash(sha1: string, sha2: string): string[] {
  return execSync(`git diff --name-only ${sha1} ${sha2}`)
    .toString('utf-8')
    .split('\n')
    .map(a => a.trim())
    .filter(a => a.length > 0);
}

export function getAffectedApps(touchedFiles: string[]): string[] {
  const config = JSON.parse(fs.readFileSync('.angular-cli.json', 'utf-8'));
  const projects = (config.apps ? config.apps : []).map(p => {
    return {
      name: p.name,
      isApp: p.root.startsWith('apps/'),
      files: allFilesInDir(path.dirname(p.root))
    };
  });

  return affectedApps(config.project.npmScope, projects, f => fs.readFileSync(f, 'utf-8'), touchedFiles);
}

function allFilesInDir(dirName: string): string[] {
  let res = [];
  fs.readdirSync(dirName).forEach(c => {
    const child = path.join(dirName, c);
    try {
      if (!fs.statSync(child).isDirectory()) {
        res.push(child);
      } else if (fs.statSync(child).isDirectory()) {
        res = [...res, ...allFilesInDir(child)];
      }
    } catch (e) {}
  });
  return res;
}

function build(apps: string[], rest: string) {
  if (apps.length > 0) {
    console.log(`Building ${apps.join(', ')}`);
    apps.forEach(app => {
      execSync(`ng build ${rest} -a=${app}`, { stdio: [0, 1, 2] });
    });
  } else {
    console.log('No apps to build');
  }
}

function e2e(apps: string[], rest: string) {
  if (apps.length > 0) {
    console.log(`Testing ${apps.join(', ')}`);
    apps.forEach(app => {
      execSync(`ng e2e ${rest} -a=${app}`, { stdio: [0, 1, 2] });
    });
  } else {
    console.log('No apps to tst');
  }
}
