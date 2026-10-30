# Erlang Syntax

Highlights Erlang source (`.erl`), headers (`.hrl`), escripts (`.escript`), application resource files (`.app.src`) and `rebar.config`: module attributes, records, atoms, variables, strings, type specs and documentation attributes.

Orca shows `.erl` and `.hrl` files without colours on its own. From Orca 1.4.246, an enabled plugin syntax takes precedence, so while this plugin is on they are highlighted as Erlang. Older Orca versions show "Needs Orca 1.4.246".

The TextMate grammar is from [erlang-ls/grammar](https://github.com/erlang-ls/grammar) at commit `49f7a9ab6a69a11e097482a1e885e2321cbb1dd7`, converted to JSON. Its Apache 2.0 license is included. Markdown inside `-doc` attributes stays plain.
