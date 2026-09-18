# Contributing to Nidalplayer

Thank you for your interest in contributing to Nidalplayer! We welcome bug reports, feature suggestions, documentation enhancements, and pull requests.

---

## 🛠️ Development Setup

### Prerequisites
* [Node.js](https://nodejs.org/) v18.0 or higher
* [Git](https://git-scm.com/)

### Getting Started
1. **Fork & Clone** the repository:
   ```bash
   git clone https://github.com/nidal0xp/Nidalplayer.git
   cd Nidalplayer
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment** (Optional):
   ```bash
   cp .env.example .env
   # Add your optional TMDB_API_KEY for local testing
   ```
4. **Launch the development app**:
   ```bash
   npm start
   ```

---

## 🧪 Testing & Validation

Before submitting any Pull Request, ensure that all automated tests pass and syntax validations succeed:

```bash
# Run comprehensive test suite
node tests/test_all.mjs

# Validate syntax
node --check main.js
node --check src/app.js
node --check src/services/tmdbService.js
```

---

## 📋 Contribution Guidelines

1. **No Hardcoded Secrets or Streams**:
   * Never commit personal API keys, passwords, private stream URLs, or copyrighted assets.
   * All test data must use mock endpoints (e.g. `http://stream.example.com`).

2. **Neutral Terminology**:
   * Follow project conventions: describe functionality as *M3U / M3U8, HLS, DASH, streaming media center, video player*.
   * Do not use unauthorized re-broadcasting terminology.

3. **Adhere to the Non-Commercial License**:
   * All contributions must be compatible with the [CC BY-NC-SA 4.0](LICENSE) license.
