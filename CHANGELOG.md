# [1.3.0](https://github.com/fullofcaffeine/EspressoBar/compare/v1.2.1...v1.3.0) (2025-06-26)


### Features

* implement org file pinning via #+filetags with visual distinction ([3644610](https://github.com/fullofcaffeine/EspressoBar/commit/3644610c7e7acdae552e6ec7f007b5dbbd889bdb))

## [1.2.1](https://github.com/fullofcaffeine/EspressoBar/compare/v1.2.0...v1.2.1) (2025-06-26)


### Bug Fixes

* make E2E tests more robust for different environments ([3102d48](https://github.com/fullofcaffeine/EspressoBar/commit/3102d480741ceb00838cb8adbd921d21169357e5))

# [1.2.0](https://github.com/fullofcaffeine/EspressoBar/compare/v1.1.0...v1.2.0) (2025-06-26)


### Features

* implement delete pin functionality with comprehensive E2E tests ([8a93398](https://github.com/fullofcaffeine/EspressoBar/commit/8a933987c166d462a3b8ed92ce8679328f5240eb))
* implement delete pin functionality with trashcan icon ([030fd4f](https://github.com/fullofcaffeine/EspressoBar/commit/030fd4f2486cad1193e1dca3887eebb0afe77e04))

# [1.1.0](https://github.com/fullofcaffeine/EspressoBar/compare/v1.0.1...v1.1.0) (2025-06-25)


### Features

* implement drag and drop pin ordering with persistence ([32f2508](https://github.com/fullofcaffeine/EspressoBar/commit/32f2508daeec4b6aac7b113e80b8c31455a1717f))

## [1.0.1](https://github.com/fullofcaffeine/EspressoBar/compare/v1.0.0...v1.0.1) (2025-06-25)


### Bug Fixes

* **ci:** add github-token to artifact download in release workflow ([5bb143a](https://github.com/fullofcaffeine/EspressoBar/commit/5bb143a30a2976872bbe04336ff19102c280c880))
* **ci:** improve artifact download and organization in release workflow ([8ff995d](https://github.com/fullofcaffeine/EspressoBar/commit/8ff995ddb9489b60e63707e854636b0e3ee6a59d))

# 1.0.0 (2025-06-25)


### Bug Fixes

* **ci:** correct repository URLs in package.json and workflow config ([23aca0a](https://github.com/fullofcaffeine/EspressoBar/commit/23aca0ac91f4de96282e452e4d814836d45b3c1f))
* **ci:** ensure release workflow waits for CI/CD pipeline completion ([f97d2cd](https://github.com/fullofcaffeine/EspressoBar/commit/f97d2cd4eb20ab76140f5952750c9614000b464e))
* **ci:** improve release workflow with proper artifact download and debugging ([a6ae319](https://github.com/fullofcaffeine/EspressoBar/commit/a6ae319c494af2b8ed4a78aa557e19af9366ddab))
* **ci:** use more reliable artifact download and improve debugging ([7264ad5](https://github.com/fullofcaffeine/EspressoBar/commit/7264ad59df29244a33b0ddc829458b9bcc23066b))


### Features

* **ci:** implement automated semantic versioning and releases ([b12731c](https://github.com/fullofcaffeine/EspressoBar/commit/b12731c8f8c868d2260f086da35bde8444836060))

# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and uses [Conventional Commits](https://conventionalcommits.org/) for automated versioning.

## [Unreleased]

### Added
- Automated semantic versioning with semantic-release
- Conventional commit message standards for version management
- Automated changelog generation
- GitHub Actions workflow for automated releases
- Multi-platform build artifacts attached to releases

### Changed
- Separated release workflow from main CI/CD pipeline
- Updated CI/CD to focus on testing and building
- Improved release artifact handling

---

*This changelog is automatically maintained by [semantic-release](https://github.com/semantic-release/semantic-release).*
