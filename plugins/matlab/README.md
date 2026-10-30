# MATLAB Syntax

Highlights MATLAB code in `.m` files: functions, `arguments` and `classdef` blocks, comments, strings, numbers and operators.

Orca opens `.m` files as Objective-C by default. From Orca 1.4.246, an enabled plugin syntax takes precedence, so while this plugin is on every `.m` file is highlighted as MATLAB, including Objective-C sources. Older Orca versions show "Needs Orca 1.4.246".

The TextMate grammar is from [mathworks/MATLAB-Language-grammar](https://github.com/mathworks/MATLAB-Language-grammar) at commit `98fcc83436704be452e1007c9d8812091c7cfa9f`, converted to JSON. Its BSD 2-Clause license is included. Requested in [Orca issue #10363](https://github.com/stablyai/orca/issues/10363); thanks to [@innocarpe](https://github.com/innocarpe) for the first version in [Orca PR #10371](https://github.com/stablyai/orca/pull/10371).
