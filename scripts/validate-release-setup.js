#!/usr/bin/env node

/**
 * Validation script for semantic-release setup
 * Checks if all required dependencies and configuration are in place
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating semantic-release setup...\n');

const checks = [
  {
    name: 'package.json has semantic-release config',
    check: () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return pkg.release && pkg.release.plugins && pkg.release.branches;
    }
  },
  {
    name: 'semantic-release dependencies installed',
    check: () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const devDeps = pkg.devDependencies || {};
      const requiredDeps = [
        'semantic-release',
        '@semantic-release/changelog',
        '@semantic-release/commit-analyzer',
        '@semantic-release/git',
        '@semantic-release/github',
        '@semantic-release/release-notes-generator'
      ];
      return requiredDeps.every(dep => devDeps[dep]);
    }
  },
  {
    name: 'Release workflow exists',
    check: () => fs.existsSync('.github/workflows/release.yml')
  },
  {
    name: 'CHANGELOG.md exists',
    check: () => fs.existsSync('CHANGELOG.md')
  },
  {
    name: 'CI/CD workflow exists',
    check: () => fs.existsSync('.github/workflows/ci-cd.yml')
  }
];

let allPassed = true;

checks.forEach(({ name, check }) => {
  const passed = check();
  console.log(`${passed ? '✅' : '❌'} ${name}`);
  if (!passed) allPassed = false;
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('🎉 All checks passed! Semantic-release setup is ready.');
  console.log('\n📝 Next steps:');
  console.log('1. Push to main branch with conventional commit messages');
  console.log('2. Releases will be created automatically');
  console.log('3. Use "feat:" for minor, "fix:" for patch, "feat!:" for major');
} else {
  console.log('❌ Some checks failed. Please fix the issues above.');
  process.exit(1);
}

console.log('\n📚 Documentation:');
console.log('- Conventional Commits: https://conventionalcommits.org/');
console.log('- Semantic Release: https://github.com/semantic-release/semantic-release'); 
