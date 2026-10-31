# VisualCompare Live — Privacy Policy

_Last updated: 2026-10-23_

VisualCompare Live compares two websites side by side inside your browser.

## What we collect
**Nothing.** The extension has no server, no analytics, no ads and no accounts. It never sends any data to the developer or any third party.

## What is stored on your device
Saved with `chrome.storage` and never leaving your browser:
- The last two URLs you compared.
- Your preferences (device size, sync toggles).
- Your site-access choice and the list of sites you excluded.
- The comparison sites approved for the current session (kept in memory only).

Removing the extension deletes all of it.

## What the extension reads
While a comparison is running, the extension reads the pages in the two comparison panes. It uses the layout, scroll position, clicks, hover and typing it finds there to mirror them in the other pane and to compute visual differences. This happens locally. Exported ZIP/PDF reports are created locally and saved only where you choose.

## Permissions and why
| Permission | Why |
| --- | --- |
| `storage` | Remember your URLs, preferences and site-access choice. |
| `activeTab` | The "Use Current Tab" button reads the URL of the tab you are looking at when you click the icon. |
| `scripting` | Register the sync helper script, but only on the sites you approved. |
| `declarativeNetRequest` | Many sites refuse to be shown in a frame (`X-Frame-Options` / CSP `frame-ancestors`). While a Studio tab is open, the extension removes those headers for frames **inside that tab only**, and only for the sites you approved. Your normal browsing is not affected. |
| Optional site access (`http://*/*`, `https://*/*`) | **Not granted at install.** Chrome asks when you click Launch, and only for what you choose in the popup: the two sites you are comparing (default), all sites, or all sites except a list you provide. |

### About "all sites except…"
Chrome cannot grant "everything except X", so this option requests access to all sites. The extension then does not run on, and does not relax headers for, the sites you list. You can revoke access at any time in `chrome://extensions` → Details → Site access.

## Remote code
The extension loads no remote code. All scripts ship inside the package.

## Contact
Open an issue in the project repository.
