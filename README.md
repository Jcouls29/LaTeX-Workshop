# Visual Studio Code Zed Workshop Extension

[![version](https://vsmarketplacebadge.apphb.com/version/James-Yu.latex-workshop.svg)](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop)
[![installs](https://vsmarketplacebadge.apphb.com/installs-short/James-Yu.latex-workshop.svg)](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop)
[![rating](https://vsmarketplacebadge.apphb.com/rating-short/James-Yu.latex-workshop.svg)](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop)
[![license](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://raw.githubusercontent.com/James-Yu/LaTeX-Workshop/master/LICENSE.txt)

[![Average time to resolve an issue](https://isitmaintained.com/badge/resolution/James-Yu/LaTeX-Workshop.svg)](https://github.com/James-Yu/LaTeX-Workshop/issues)
[![Percentage of issues still open](https://isitmaintained.com/badge/open/James-Yu/LaTeX-Workshop.svg)](https://github.com/James-Yu/LaTeX-Workshop/issues)


Zed Workshop is an extension for [Visual Studio Code](https://code.visualstudio.com/), aiming to provide all-in-one features and utilities for Z-Notation typesetting with Visual Studio Code.

## Features

- Build Z to PDF automatically on save.
- View PDF on-the-fly (in VS Code or browser).
- Direct and reverse SyncTeX. Click to jump between location in `.zed` source and PDF and vice versa.
- Syntax highlighting (colorized code) for `.zed`.
- LaTeX log parser, with errors and warnings in LaTeX build automatically reported in VS Code.
- Real-time linting of Zed with ChkTeX to pick up common LaTeX issues as you type.
  - Code Actions (automatic fixes) are offered for many issues found by ChkTeX.

## Requirements

- LaTeX distribution in system PATH. For example, [TeX Live](https://www.tug.org/texlive/).
  - Please note [MikTeX](https://miktex.org/) does not ship with SyncTeX. See [this link](http://tex.stackexchange.com/questions/338078/how-to-get-synctex-for-windows-to-allow-atom-pdf-view-to-synch#comment877274_338117) for a possible solution.
- Perl (for `latexmk` to work)
- _Optional_: [Set your LaTeX toolchain](#toolchain) (LaTeX Workshop should just work out of the box for users with `latexmk` installed).

## Installation

Installing Zed Workshop is simple. You can find it in [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop), or simply run `ext install zed-workshop` in VS Code Quick Open (`ctrl`/`cmd` + `P`).

Alternatively, you can check out this repository and copy it to the VS Code local extensions folder:
- Windows `%USERPROFILE%\.vscode\extensions`
- Mac/Linux `$HOME/.vscode/extensions`

## Usage

- Open a `.zed` file, right click and many features have menu entries there.
  - For a complete list, select `Zed Workshop Actions` entry.
- For reverse SyncTeX from PDF to LaTeX, `ctrl`/`cmd` + left mouse click in the PDF.
- Alternatively, VS Code commands are provided in VS Code Command Palette (`ctrl`/`cmd` + `shift` + `P`).
  - Type `zed workshop` to show all related commands.

## FAQ
### <a name="toolchain"></a>LaTeX toolchain?
LaTeX toolchain refers to a sequence/array of commands which Zed Workshop will execute sequentially when building Z projects. It is set in `File`>`Preferences`>`Settings`>`zed-workshop.zed.toolchain`. This configuration item is an array of objects, which should have a `command` field and an optional `args` array field. The former defines the command that will be invoked in each step of the toolchain, while the latter defines the arguments that will be passed alongside with the command.

By default [`latexmk`](http://personal.psu.edu/jcc8/software/latexmk/) is used. This tool is bundled in most LaTeX distributions, and requires perl to execute. For non-perl users, the following `texify` toolchain from MikTeX may worth a try:
```
"latex-workshop.latex.toolchain": [
  {
    "command": "texify",
    "args": [
      "--synctex",
      "--pdf",
      "--tex-option=\"-interaction=nonstopmode\"",
      "--tex-option=\"-file-line-error\"",
      "%DOC%.tex"
    ]
  }
]
```
LaTeX toolchain must always be defined as a JSON array, even if there is only one command to execute. As you may notice, there is a mystic `%DOC%` in the arguments. Symbols surrounded by `%` are placeholders, which are replaced with its representing string on-the-fly. LaTeX Workshop registers the following placeholders:

| Placeholder | Replaced by             |
| ----------- | ----------------------- |
| `%DOC%`     | The LaTeX root file path and name without `.tex` extension |
| `%DOCFILE%` | The LaTeX root file name without `.tex` extension |
| `%DIR%` | The LaTeX root file path |

Alternatively, you can also set your commands without the placeholder, just like what you may input in a terminal. For the special commands which has problem to deal with absolute 

As most LaTeX compiler accepts root file name without extension, `%DOC%` and `%DOCFILE%` do not include `.tex` extension. Meanwhile, `texify` requires the extension. So in the above toolchain `%DOC%` and `.tex` are concatenated for completeness.

The following is an example of a typical `pdflatex`>`bibtex`>`pdflatex`>`pdflatex` setting.
```
"latex-workshop.latex.toolchain": [
  {
    "command": "pdflatex",
    "args": [
      "-synctex=1",
      "-interaction=nonstopmode",
      "-file-line-error",
      "%DOC%"
    ]
  }, {
    "command": "bibtex",
    "args": [
      "%DOCFILE%"
    ]
  }, {
    "command": "pdflatex",
    "args": [
      "-synctex=1",
      "-interaction=nonstopmode",
      "-file-line-error",
      "%DOC%"
    ]
  }, {
    "command": "pdflatex",
    "args": [
      "-synctex=1",
      "-interaction=nonstopmode",
      "-file-line-error",
      "%DOC%"
    ]
  }
]
```

### Root file?
While it is fine to write all contents in one `.tex` file, it is common to split things up for simplicity. For such LaTeX projects, the file with `\begin{document}` is considered as the root file, which serves as the entry point to the project. LaTeX Workshop intelligently finds the root file when a new document is opened, the active editor is changed, or any LaTeX Workshop command is executed.

To find the root file, LaTeX Workshop will follow the steps below, stopping whenever one is found:
1. **Magic comment** `% !TEX root = relative/or/absolute/path/to/root/file.tex`. If such comments exist in the currently active editor, the referred file is set as root.
2. **Self check** If current active editor contains `\begin{document}`, it is set as root.
3. **Root directory check** LaTeX Workshop iterates through all `.tex` files in the root folder of the workspace. The first one with `\begin{document}` is set as root.

If no root file is found, most of the features in LaTeX Workshop will not work.

### Magic comments?
LaTeX Workshop supports both `% !TEX root` and `% !TEX program` magic comments. The former is used to define the root file, while the latter helps select compiler program.

All `command` in `toolchain` which are empty will be replaced with the program set by `% !TEX program` magic comment in the root file. Suppose there is a line `% !TEX program = xelatex` in the root file, and the toolchain is set as follows:
```
"latex-workshop.latex.toolchain": [
  {
    "command": "",
    "args": [
      "-synctex=1",
      "-interaction=nonstopmode",
      "-file-line-error",
      "%DOC%"
    ]
  }
]
```
Upon building the project, LaTeX Workshop will parse the root file and figure out that `xelatex` should be used. This program will replace the empty `command` in the toolchain. Arguments are untouched.

If the `command` is set empty but no `% !TEX program` magic comment is found, `pdflatex` is used.

### Spell check?
[Code Spellchecker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) did a great job. The following regexps are recommended to be ignored for LaTeX:
```
"cSpell.ignoreRegExpList": [
  "\\\\\\w*(\\[.*?\\])?(\\{.*?\\})?",
  "\\$.+?\\$"
]
```

## License

[MIT](https://opensource.org/licenses/MIT)
