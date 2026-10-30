# systemd Unit Files

Highlights systemd unit files (`.service`, `.socket`, `.timer`, `.target`, `.path`, `.mount`, `.automount`, `.swap`, `.slice`, `.scope`, `.device`, `.snapshot`), systemd-networkd and related files (`.link`, `.netdev`, `.network`, `.nspawn`, `.dnssd`), and Podman Quadlet files (`.container`, `.volume`, `.kube`): sections, directives, values, specifiers and comments.

The Quadlet `.pod`, `.image` and `.build` extensions are left out because other tools use them too.

The TextMate grammar is `src/syntax/systemd.tmLanguage` from the MIT-licensed [hangxingliu/vscode-systemd](https://github.com/hangxingliu/vscode-systemd) at commit `58c74af71ac05116683d02aac6bdbf466af7ab2a`, converted from plist to JSON without other changes. Its license is in `syntaxes/systemd-LICENSE.txt`.
