# Meraki Experience

<div align="center">
  <img src="M-E.png" alt="Meraki Experience Logo" width="128" height="128">
</div>

A browser extension for Chrome, Firefox, and Safari (WebExtensions API) that dynamically enhances the experience for Meraki-related pages. The extension provides intelligent tab management, enhanced documentation features, and universal text replacement capabilities.

## ⚠️ Important Notice

**This extension relies heavily on the design and structure of the target websites it operates on. If the structure of these websites changes significantly, the extension code will need to be updated accordingly to maintain functionality.**

### What This Means
- The extension uses DOM selectors and page structure to identify and enhance specific elements
- Website redesigns, layout changes, or structural modifications may break extension features
- Regular maintenance and updates may be required to keep the extension working properly
- Users should report issues when features stop working after website updates

## Features

### 🎯 Smart Tab Management
- **Intelligent Tab Renaming**: Automatically renames tabs based on device information for better organization
- **Flexible Naming Options**: Choose between device names or device model/MAC address for tab titles
- **Seamless Integration**: Works automatically without manual intervention

### 📚 Enhanced Documentation
- **Direct Link Generation**: Copy direct links to specific documentation sections with a single click
- **Improved Navigation**: Enhanced browsing experience for technical documentation
- **Quick Access**: Streamlined access to frequently referenced content

### 🔄 Text Replacement
- **Cross-Platform Support**: Works across multiple platforms and services
- **Smart Content Enhancement**: Automatically enhances content based on context
- **Configurable Features**: Toggle functionality on/off as needed

### 🎨 User Experience
- **Modern Interface**: Clean, intuitive popup interface with toggles for all features
- **Theme Support**: Light and dark mode support for comfortable viewing
- **Minimal Footprint**: Lightweight extension with minimal resource usage

## Setup

1. Clone or download this repository
2. Build or copy the extension files to your browser's extension directory
3. Load the extension:
   - **Chrome:** Go to `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select the `meraki-experience` folder
   - **Firefox:** Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on...", and select the `manifest.json` file
   - **Safari:** Use Safari Extension Builder or Xcode (minimal adjustments may be needed)

## Usage

The extension works automatically once loaded. Use the popup interface to:
- Toggle the extension on/off
- Enable/disable specific features
- Configure tab naming preferences
- Access documentation enhancements

## Permissions

- `activeTab`: To access the current tab for enhancement
- `storage`: To save user preferences
- `tabs`: To listen for tab updates
- `scripting`: To inject content scripts
- `clipboardWrite`: To copy links and content
- `host_permissions`: For accessing relevant domains

## Security

- Only the minimum permissions are requested
- User input is sanitized to prevent XSS/injection
- Content Security Policy restricts external resource loading
- No sensitive page content is accessed or stored

## Development

- Code is modular and commented for maintainability
- TypeScript is recommended for future improvements
- Follows ESLint rules for code quality
- **Website Structure Dependency**: Features are tightly coupled to specific DOM structures and may require updates when target websites change

## Troubleshooting

### Common Issues
- **Features not working**: Check if the target website has been updated recently
- **Extension not loading**: Ensure all files are properly copied and permissions are granted
- **UI not displaying**: Check browser console for errors and verify manifest.json is valid

### Reporting Issues
When reporting issues, please include:
- Browser version and extension version
- Target website URL and page type
- Description of expected vs. actual behavior
- Any error messages from the browser console

## License

MIT
