# Visual Studio Code Z-Specification Workshop Extension

Z-Specification Workshop is an extension for [Visual Studio Code](https://code.visualstudio.com/), aiming to provide all-in-one features and utilities for Z-Notation typesetting with Visual Studio Code. This extension is based on the elegant LaTeX Workshop by James Yu [LaTeX-Workshop (GitHub)](https://github.com/James-Yu/LaTeX-Workshop), [LaTeX-Workshop (VS Code)](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop). His code deserves the most credit!

## Features

- Build Z to PDF automatically on save.
- View PDF on-the-fly (in VS Code or browser).
- Syntax highlighting (colorized code) for `.zed`.
- Outline of the `.zed` file being worked on

## Requirements

- LaTeX distribution in system PATH. For example, [TeX Live](https://www.tug.org/texlive/).
  - Please note [MikTeX](https://miktex.org/) does not ship with SyncTeX. See [this link](http://tex.stackexchange.com/questions/338078/how-to-get-synctex-for-windows-to-allow-atom-pdf-view-to-synch#comment877274_338117) for a possible solution.
- Perl (for `latexmk` to work)
- _Optional_: [Set your LaTeX toolchain](#toolchain) (LaTeX Workshop should just work out of the box for users with `latexmk` installed).

## Usage

- Open a `.zed` file, right click and utilize the features from the context menu.
- Alternatively, VS Code commands are provided in VS Code Command Palette (`ctrl`/`cmd` + `shift` + `P`).

## License

[MIT](https://opensource.org/licenses/MIT)
