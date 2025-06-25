# Conventional Commits Guide for EspressoBar

This project uses [Conventional Commits](https://conventionalcommits.org/) for automated semantic versioning and release management.

## Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types and Version Impact

| Type | Version Bump | Example |
|------|--------------|---------|
| `fix:` | **Patch** (1.0.0 → 1.0.1) | `fix: resolve org file parsing error` |
| `feat:` | **Minor** (1.0.0 → 1.1.0) | `feat: add keyboard shortcuts for pin navigation` |
| `feat!:` | **Major** (1.0.0 → 2.0.0) | `feat!: redesign pin storage format` |
| `BREAKING CHANGE:` | **Major** (1.0.0 → 2.0.0) | See breaking change section below |

## Common Types

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Scopes (Optional)

Use scopes to specify what part of the app is affected:

- `feat(ui):` - UI/frontend changes
- `fix(scanner):` - Org file scanning fixes
- `feat(emacs):` - Emacs integration features
- `chore(deps):` - Dependency updates

## Breaking Changes

For major version bumps, use either:

1. **Exclamation mark**: `feat!: remove quick note feature`
2. **Footer**: 
   ```
   feat: update pin storage format
   
   BREAKING CHANGE: Pin storage format has changed. 
   Existing pins will need to be rescanned.
   ```

## Examples

### Patch Release (Bug Fixes)
```bash
git commit -m "fix: prevent crash when org file is empty"
git commit -m "fix(scanner): handle malformed org headlines gracefully"
```

### Minor Release (New Features)
```bash
git commit -m "feat: add dark mode toggle in preferences"
git commit -m "feat(emacs): support custom emacsclient path"
```

### Major Release (Breaking Changes)
```bash
git commit -m "feat!: remove manual pin creation functionality"

# Or with detailed explanation:
git commit -m "feat: redesign preferences interface

BREAKING CHANGE: The preferences interface has been completely 
redesigned. Previous preference files are incompatible."
```

## Tips

1. **Keep it concise**: First line should be ≤ 50 characters
2. **Use imperative mood**: "add feature" not "added feature"
3. **Be specific**: "fix button alignment" vs "fix UI"
4. **One change per commit**: Each commit should represent one logical change

## Release Process

When you push commits to `main`:

1. **CI/CD runs**: Tests and builds for all platforms
2. **semantic-release analyzes**: Determines version from commit messages
3. **Version bumped**: Based on highest impact change
4. **Changelog updated**: Automatically generated from commits
5. **GitHub release created**: With build artifacts attached
6. **package.json updated**: New version committed back

## Quick Reference

| Want to... | Use... | Example |
|------------|--------|---------|
| Fix a bug | `fix:` | `fix: resolve memory leak in scanner` |
| Add feature | `feat:` | `feat: add export pins functionality` |
| Breaking change | `feat!:` or `BREAKING CHANGE:` | `feat!: remove deprecated API` |
| Update docs | `docs:` | `docs: update installation instructions` |
| Refactor code | `refactor:` | `refactor: simplify pin store logic` |

---

For more details, see the [Conventional Commits specification](https://conventionalcommits.org/). 
