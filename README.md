# Notes Vault

<p align="center">
  <img src="https://img.shields.io/badge/Electron-29.0.1-blue?style=for-the-badge&logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.2.2-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
</p>

A powerful, privacy-focused notes application built with Electron, React, and TypeScript. Features markdown support, task management, encrypted notes, and seamless Git backup.

## ✨ Features

- 📝 **Markdown Editor** - Full markdown support with live preview
- 🔐 **Encrypted Notes** - XOR encryption for sensitive notes
- 📋 **Task Management** - Infinite nested subtasks with drag & drop
- 🔄 **Routines Tracking** - Daily/weekly/monthly habits with streak tracking
- 🎨 **Excalidraw Integration** - Built-in drawing and diagramming
- 🔍 **Quick Capture** - Global hotkey for instant note access
- 🌐 **Webhook Support** - n8n integration for automation
- 💾 **Git Backup** - Automatic version control for your notes
- 🌙 **Dark Theme** - Obsidian-inspired dark interface
- 🖼️ **Image Support** - Paste images directly from clipboard

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Git
- Linux (tested on Arch with Hyprland)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/notes-vault.git
cd notes-vault

# Install dependencies
npm install

# Run in development
npm run dev

# Build for Linux
npm run build:linux
```

### System-wide Installation (Linux)

```bash
# After building
sudo cp "dist/Notes Vault-1.0.0.AppImage" /opt/notes-vault.AppImage
sudo chmod +x /opt/notes-vault.AppImage

# Create desktop entry for app launchers
cat > ~/.local/share/applications/notes-vault.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Notes Vault
Comment=Your personal notes vault
Exec=/opt/notes-vault.AppImage
Icon=notes-vault
Terminal=false
Categories=Utility;TextEditor;
StartupNotify=false
EOF

# Enable autostart
mkdir -p ~/.config/autostart
cp ~/.local/share/applications/notes-vault.desktop ~/.config/autostart/
sed -i 's|Exec=/opt/notes-vault.AppImage|Exec=/opt/notes-vault.AppImage --hidden|' ~/.config/autostart/notes-vault.desktop
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Super + Numpad+` | Quick capture / Search |
| `Ctrl + S` | Save note |
| `Ctrl + E` | Toggle preview |
| `Ctrl + K` | Search notes |
| `Esc` | Exit zen mode |

## 🔧 Configuration

### Hyprland Integration
Add to `~/.config/hypr/hyprland.conf`:

```bash
# Quick search keybind
bind = SUPER, kp_add, exec, echo "toggle-search" > /tmp/notes-vault-trigger

# Autostart
exec-once = /opt/notes-vault.AppImage --hidden
```

### Webhook Setup
1. Start your search with `:` to trigger webhook mode
2. Example: `:restart nginx` sends "restart nginx" to your configured webhook
3. Default webhook URL: `http://n8n.zakrom.com:5678/webhook/input`

## 📁 Project Structure

```
notes-vault/
├── electron/           # Electron main process
│   ├── main.js        # Main process entry
│   └── preload.js     # Preload script
├── src/               # React application
│   ├── components/    # React components
│   ├── store/         # Zustand state management
│   └── App.tsx        # Main React component
├── dist/              # Build output
└── prod/              # Production releases
```

## 🏗️ Architecture

- **Frontend**: React 18 with TypeScript
- **State Management**: Zustand with persistence
- **Editor**: CodeMirror 6 with markdown support
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Desktop**: Electron 29
- **Drawing**: Excalidraw integration

## 🔒 Security

- Notes are stored locally in your file system
- Encrypted notes use XOR encryption with password
- No cloud sync - your data stays on your device
- Git backup is optional and user-controlled

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- UI inspired by [Obsidian](https://obsidian.md/)
- Icons from [Lucide](https://lucide.dev/)
- Drawing support by [Excalidraw](https://excalidraw.com/)

## 📧 Contact

Mail - mustafabuyer@gmail.com

Project Link: [https://github.com/yourusername/notes-vault](https://github.com/mustafabuyer/zenh-notes)

---

<p align="center">Made with ❤️ using Electron and React</p>
