# Change Log

All notable changes to the "doxygen-runner" extension will be documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- Allow users to explicitly set the Doxygen configuration file instead of
  crawling for it

## [1.7.0] - 2020-07-11

### Added

- Allow the specification of package marker files to stop crawling for
  configuration files in package root directories

## [1.9.0] - 2025-01-25

### Added

- Allow specfying to open the generated html files with Live Preview with
  `view_in_live_preview`

### Fixed

- Fixed WebView URI wrapping not handling local files correctly anymore

## [1.10.0] - 2025-02-01

### Added

- Added support for side navigation bar rendering

## [1.11.0] - 2025-03-08

### Fixed

- Reworked file patching to work with multiple doxygen versions. Tested with
  1.9.1 and 1.13.2.

## [1.11.1] - 2025-03-08

### Fixed

- Fixed crawling stopping when hitting the workspace root, resulting in not
  finding top-level Doxyfiles

## [1.11.2] - 2025-03-11

### Fixed

- Fixed handling of Windows-like paths when adapting doxygen output for WebView
  API

## [1.11.3] - 2025-03-11

### Fixed

- Fix race condition due to async file handling during patching
- Tweak crawler to also support nested doc or src directories specifically on
  the top level

## [1.11.4] - 2025-03-15

### Fixed

- Fixed more Windows specific issues when crawling for Doxyfiles

## [1.11.5] - 2025-03-18

### Fixed

- Fixed more Windows specific issues with side menu patching

## [1.11.6] - 2025-08-21

### Fixed

- Using stdin when calling doxygen to support path names on Windows that contain non-ascii characters.
