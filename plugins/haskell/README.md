# Haskell Syntax

Highlights Haskell (`.hs`, `.hsig`, `.hs-boot`), Literate Haskell (`.lhs`), Cabal package files (`.cabal`) and Cabal project files (`cabal.project`, `cabal.project.local`, `cabal.project.freeze`).

Orca shows `.hs` files without colours on its own. From Orca 1.4.246, an enabled plugin syntax takes precedence, so while this plugin is on they are highlighted as Haskell. Older Orca versions show "Needs Orca 1.4.246".

The TextMate grammars are from [JustusAdam/language-haskell](https://github.com/JustusAdam/language-haskell) at commit `28d1986362cba0d9d37209c5ab15cd89920201b6`, converted from YAML to JSON. Its BSD 3-Clause license is included. In `.lhs` files, Haskell code blocks are highlighted and the LaTeX around them stays plain. Requested in [Orca issue #25314](https://github.com/stablyai/orca/issues/25314); thanks to [@david-wis](https://github.com/david-wis) for the first version in [Orca PR #25315](https://github.com/stablyai/orca/pull/25315).
