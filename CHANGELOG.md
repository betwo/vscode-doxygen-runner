# Change Log
All notable changes to the "doxygen-runner" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2019-09-07
### Added
- Added a task to find Doxyfiles and generate Doxygen documentation

## [1.3.0] - 2019-09-12
### Changed
- Replaced the dummy task for error pargsing with DiagnosticCollection

## [1.4.0] - 2019-09-14
### Changed
- Changed path handling for support on Windows
- Refresh the web view when regenerating the documentation
- Display doxygen output for better UX with large projects

## [1.4.1] - 2019-09-14
### Changed
- Change to use the multi root workspace API

## [1.5.1] - 2020-01-22
### Fixed
- Issue #1: Clearing cache in case an already processed Doxyfile is renamed

## [1.6.0] - 2020-07-04
### Added
- Allow users to explicitly set the Doxygen configuration file instead of crawling for it