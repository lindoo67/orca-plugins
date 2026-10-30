# Julia Syntax

Highlights Julia (`.jl`) files with the full Julia grammar: parametric types, keywords, docstrings, string interpolation, numbers and operators. It replaces Orca's basic built-in Julia colouring.

From Orca 1.4.246, an enabled plugin syntax takes precedence over the built-in one. Older Orca versions show "Needs Orca 1.4.246".

The TextMate grammar is from [JuliaEditorSupport/atom-language-julia](https://github.com/JuliaEditorSupport/atom-language-julia) at commit `bd82faf12dcedfe8d476e5f886dd8a074e820954`, the grammar VS Code also uses. Its MIT license is included. Code embedded in string macros (for example `py"..."` or `sql"..."`) stays plain. Requested in [Orca issue #19968](https://github.com/stablyai/orca/issues/19968).
