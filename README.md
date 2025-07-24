# Meraki Experience

A browser extension for Chrome, Firefox, and Safari (WebExtensions API) that dynamically enhances the experience for *.meraki.com/* pages. By default, the tab name reflects the device name extracted from the page content. Optionally, you can enable a toggle to use the device model and MAC address for tab renaming instead.

## Features
- Tabs are renamed based on device name (default) or device model/MAC (optional)
- Toggle to enable a "Copy direct link to this section" button on Meraki documentation pages
- Simple popup UI with toggles for features
- Light and dark mode support
- Minimal permissions and secure code

## Setup
1. Clone or download this repository.
2. Build or copy the extension files to your browser's extension directory.
3. Load the extension:
   - **Chrome:** Go to chrome://extensions, enable Developer Mode, click "Load unpacked", and select the `meraki-experience` folder.
   - **Firefox:** Go to about:debugging#/runtime/this-firefox, click "Load Temporary Add-on...", and select the `manifest.json` file.
   - **Safari:** Use Safari Extension Builder or Xcode (minimal adjustments may be needed).

## Usage
- The extension automatically processes tabs with URLs matching `*.meraki.com/*`.
- By default, tabs are renamed based on the device name.
- The popup UI allows you to:
  - Toggle the extension on/off
  - Enable "Use device model/mac for tabs" to switch to model/MAC-based renaming
  - Enable "Copy link button on docs" to add a button for copying direct links to documentation sections
- More toggles and features coming soon!

## Permissions
- `activeTab`: To access the current tab for enhancement
- `storage`: To save user preferences
- `tabs`: To listen for tab updates
- `host_permissions`: Only for `*://*.meraki.com/*`

## Security
- Only the minimum permissions are requested
- User input in the popup is sanitized to prevent XSS/injection
- Content Security Policy restricts external resource loading
- No sensitive page content is accessed or stored

## Development
- Code is modular and commented for maintainability
- TypeScript is recommended for future improvements
- Follows ESLint rules for code quality

## Credits
- Icon: Derived from `cisco-meraki.jpg` (provided by user)

## License
MIT
