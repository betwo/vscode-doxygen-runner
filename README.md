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

Doxygen must be installed in the system and must be invokable with

```bash
doxygen <parameters>
```

or it can be specified in `doxygen_runner.doxygen_command` as an absolute path.

## Usage: Commands

There are the following commands:

* `Generate Doxygen documentation`: This (re-)generates the Doxygen output when run. Afterwards it will automatically run `View Doxygen documentation`.
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