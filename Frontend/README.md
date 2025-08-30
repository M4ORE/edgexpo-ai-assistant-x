# EdgExpo AI Assistant X

## 🚀 Installation & Setup

### Step 1: Install Node.js
1. Download [Node.js 18.x LTS](https://nodejs.org/) or higher
2. Run the installer with default options
3. Open command prompt and verify installation:
   ```cmd
   node -v
   npm -v
   ```

### Step 2: Clone the Project
Using Git (recommended):
```cmd
git clone https://github.com/M4ORE/edgexpo-ai-assistant-x.git
cd edgexpo-ai-assistant-x/Frontend
```

### Step 3: Install Dependencies
```cmd
npm install
```

### Step 4: Configure Environment Variables
```cmd
# Windows Command Prompt
copy .env.example .env

# Or manually copy .env.example to .env
```
> Default configuration works out of the box. Edit the .env file if customization is needed.

### Step 5: Run the Application

#### Development Mode (Recommended for first-time users)
```cmd
npm run dev
```
The application will start in development mode with hot reload support.

#### Build Production Version
```cmd
# Build Vue frontend assets
npm run build:vue

# Build and package as Windows application
npm run build
```
After packaging, the installer will be available in the `dist_electron` folder.

## 🛠️ Core Technologies

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Desktop Framework** | Electron | 28.1.0 | Cross-platform desktop app |
| **Frontend Framework** | Vue.js | 3.3.0 | Responsive UI |
| **UI Components** | Vuetify | 3.3.0 | Material Design |
| **Build Tool** | Vite | 4.0.0 | Fast bundling |

## 📂 Project Structure

```
edgexpo-ai-assistant-x/Frontend/
│
├── src/                          # Source code directory
│   ├── main.js                   # Electron main process entry
│   ├── assets/                   # Static assets (images, styles)
│   ├── preload/                  # Electron preload scripts
│   └── renderer/                 # Vue frontend application
│       ├── App.vue               # Root component
│       ├── main.js               # Vue entry point
│       ├── components/           # Reusable components
│       ├── composables/          # Composition API logic
│       ├── services/             # API service layer
│       │   ├── AIConversationService.js  # AI conversation
│       │   ├── VoiceRecordingService.js  # Voice recording
│       │   └── BusinessCardService.js    # Business card recognition
│       ├── views/                # Page views
│       ├── router/               # Router configuration
│       └── plugins/              # Vue plugins
│
├── dist/                         # Vue build output
├── dist_electron/                # Electron packaging output
├── .env.example                  # Environment variables template
├── package.json                  # Project configuration
└── vite.config.js                # Vite configuration
```

### Directory Descriptions

| Directory | Description |
|-----------|-------------|
| **src/** | All source code |
| **src/main.js** | Electron main process, handles system operations |
| **src/renderer/** | Vue application, handles UI and business logic |
| **src/renderer/services/** | API calls and external service integrations |
| **dist_electron/** | Packaged Windows installer |

## 📖 Usage Guide

### Basic Operations

1. **Voice Conversation**
   - Click the microphone icon to start recording
   - Speak your question, system automatically recognizes and responds

2. **Business Card Recognition**
   - Click "Business Card Recognition"
   - Upload image or take photo
   - Automatically extracts contact information

3. **AI Assistant**
   - Input text or voice questions
   - View conversation history

### Environment Configuration

Edit the `.env` file to configure APIs:

```env
# API Endpoints
VITE_LOCAL_API_BASE_URL=http://localhost:5000
VITE_REMOTE_API_BASE_URL=https://x.m4ore.com:8451

# Feature Settings
VITE_ENABLE_LOGGING=true
VITE_API_TIMEOUT=60000
```

## ❓ Frequently Asked Questions

**Q: npm install failed?**
- Ensure Node.js version >= 16.0.0
- Try clearing npm cache: `npm cache clean --force`
- Delete node_modules folder and package-lock.json, then retry

**Q: Application won't start, showing blank screen?**
- Check command prompt for error messages
- Ensure .env file exists and is properly formatted
- Try running `npm install` again

**Q: Voice features not working?**
- Windows Settings → Privacy → Microphone → Allow apps to access
- Verify microphone device is working properly

**Q: API connection failed?**
- Check network connection and firewall settings
- Verify API endpoints in .env are correct
- Check if antivirus software is blocking connections

**Q: Build failed (npm run build)?**
- Ensure `npm run build:vue` is executed first
- Check available disk space
- Windows users verify administrator privileges

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 📞 Support

If you have any questions or need support, please:
- Create an issue on GitHub
- Check the FAQ section above
- Review the documentation

## 🙏 Acknowledgments

- Thanks to all open source contributors
- Built with amazing technologies listed in our dependencies
- Special thanks to the Vue.js and Electron communities

---

**Note:** This is an AI-powered desktop application for exhibition and business use. Please ensure you comply with all applicable laws and regulations when using AI features.