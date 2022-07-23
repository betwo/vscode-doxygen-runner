# Generator for Doxygen documentation

[![Licence](https://img.shields.io/github/license/betwo/vscode-doxygen-runner)](https://github.com/betwo/vscode-doxygen-runner)
[![VS Code Marketplace](https://vsmarketplacebadge.apphb.com/version-short/betwo.vscode-doxygen-runner.svg) ![Rating](https://vsmarketplacebadge.apphb.com/rating-short/betwo.vscode-doxygen-runner.svg) ![Downloads](https://vsmarketplacebadge.apphb.com/downloads-short/betwo.vscode-doxygen-runner.svg) ![Installs](https://vsmarketplacebadge.apphb.com/installs-short/betwo.vscode-doxygen-runner.svg)](https://marketplace.visualstudio.com/items?itemName=betwo.vscode-doxygen-runner)

This extension adds helper functionality to work with Doxygen documentation.
It can generate and preview the documentation and help you fix warnings by line-matching error messages.

## Features

* Find a `Doxyfile` relative to the currently open document and generate the documentation for it.
  * This can be overridden by explicitly specifying `doxygen_runner.configuration_file_override`
* Displays the generated HTML pages inside VS code.
  * The generated HTML pages are slightly modifier for VS code to be able to show them interactively
  * Everything but the search dialog should work inside the IDE
  * For other cases, a link to the generated documentation is added at the bottom of the page for opening it in your browser
* Displays warnings and errors with squiggles.
  * All warnings and errors are matched to the line they originated from
  * The IDE shows them as *Problems* in the bottom panel

## Setup / Configuration

The following settings can be modified via your `settings.json` file or in the GUI:

#### Option `doxygen_runner.doxygen_command`

Specifies (as an absolute path) where the `doxygen` executable is installed in the system.

#### Option `doxygen_runner.configuration_file_override`

Although this extension is designed to function in workspaces with multiple packages and Doxygen configurations,
you can force a specific file to be used to generate the documentation.

By setting `doxygen_runner.configuration_file_override` in your settings, e.g. in your workspace's `settings.json` file:
```json
{
    ...
    "doxygen_runner.configuration_file_override": "${workspaceFolder}/some/path/to/your/documentation/Doxyfile",
    ...
}
```
the search for Doxygen configuration files is disabled and this file is always used.

#### Option `doxygen_runner.configuration_filenames`

Specifies (as an array), how your Doxygen configuration files are named. This is only required, if you do not override `doxygen_runner.configuration_file_override`.
If your project uses another naming scheme, overwrite this in your settings.

The default is
```json
[
  "Doxyfile",
  "doxygen.conf"
],
```

#### Option `doxygen_runner.crawler_package_root_marker_files`

The search for a Doxygen configuration file is stopped, once the root of a package is reached. This is determined by checking for the existence of *manifest* files.

The option `crawler_package_root_marker_files` specifies (as an array), how your package manifests are named. This is only required, if you do not override `doxygen_runner.configuration_file_override`.
If your project uses other manifiest files, overwrite this in your settings.

Note: This option can be empty, then the search will only terminate once the workspace root directory is reached.

The default is
```json
[
  "package.xml",
  "package.json",
  "manifest.xml",
  "manifest.json",
  "MANIFEST",
  "MANIFEST.in"
],
```

#### Option `doxygen_runner.view_after_generate`

Specifies whether the `View Doxygen documentation` command should be executed automatically after `Generate Doxygen documentation`.

## Usage: Commands

There are the following commands:

* `Generate Doxygen documentation`: This (re-)generates the Doxygen output when run. Afterwards it will automatically run `View Doxygen documentation` if `doxygen_runner.view_after_generate` is `true`.
* `View Doxygen documentation`: This will show a preview of the generated documentation in a new panel.

## Usage: Crawling mode

By default, this extension *searches* for the correct Doxygen configuration file to use.

The search starts at the currently opened file's directory and will advance to the parent directory until an *unambiguous* configuration file is found.

### Example 1: Assume the following directory structure

```
* root
|
+---+ package_name
    |
    +---+ documentation
    |   |
    |   +--- Doxyfile
    |
    +---+ src
    |   |
    |   +--* some_file.txt
    |
    +---* package.json

```

If any of the files `Doxyfile`, `some_file.txt`, `package.json` is opened, the file `Doxyfile` will be used for generating the documentation.

### Example 2: Assume the following directory structure

```
* root
|
+---+ package1
|   |
|   +---+ documentation
|   |   |
|   |   +--- Doxyfile
|   |
|   +---+ src
|   |   |
|   |   +--* some_file1.txt
|   |
|   +---* package1.json
|
+---+ package2
    |
    +---+ documentation
    |   |
    |   +--- Doxyfile
    |
    +---+ src
    |   |
    |   +--* some_file2.txt
    |
    +---* package2.json

```

If any of the files `package1/documentation/Doxyfile`, `some_file1.txt`, `package1.json` is opened, the file  `package1/documentation/Doxyfile` will be used for generating the documentation.

Else, if any of the files `package2/documentation/Doxyfile`, `some_file2.txt`, `package2.json` is opened, the file  `package2/documentation/Doxyfile` will be used for generating the documentation.


## Usage: Manual Configuration Override

If you only have a single doxygen configuration file, or in case where crawling does not work for you, you can override the search in your configuration by specifying

```json
{
    ...
    "doxygen_runner.configuration_file_override": "${workspaceFolder}/some/path/to/your/documentation/Doxyfile",
    ...
}
```