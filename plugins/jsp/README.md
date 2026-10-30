# JSP Syntax

Highlights JavaServer Pages (`.jsp`, `.jspf`) and tag files (`.tag`): directives, scriptlets, declarations, expressions, EL (`${...}`), JSP comments and JSTL or custom tags, together with the HTML, CSS, JavaScript and Java inside them.

Orca shows `.jsp` and `.jspf` files as plain HTML on its own. From Orca 1.4.246, an enabled plugin syntax takes precedence, so while this plugin is on they are highlighted as JSP. Older Orca versions show "Needs Orca 1.4.246".

The JSP TextMate grammar is from [pthorsson/vscode-jsp](https://github.com/pthorsson/vscode-jsp) at commit `fe811b1196530672cae7aa7f774393fb615a21bd` (MIT). It embeds VS Code's MIT-licensed HTML, Java, CSS and JavaScript grammars, which are bundled here; both licenses and the TextMate HTML bundle notice are included. Requested in [Orca issue #9795](https://github.com/stablyai/orca/issues/9795); thanks to [@hwantage](https://github.com/hwantage) ([Orca PR #10858](https://github.com/stablyai/orca/pull/10858)) and [@taehwanis](https://github.com/taehwanis) ([Orca PR #11309](https://github.com/stablyai/orca/pull/11309)) for the first versions.
