# LinkedIn Lead Intelligence Scanner 🔍

An advanced Chrome extension that intelligently scans LinkedIn for specific problems and opportunities. Find people looking for solutions to shipping delays, payment issues, technical problems, customer service complaints, and job opportunities.

## Features ✨

### 🎯 Smart Keyword Matching

- **Fuzzy Matching**: Handles typos and spelling variations
- **Multi-word Phrases**: Matches complex problem descriptions
- **80%+ Similarity Threshold**: Flexible matching for natural language
- **Problem Taxonomy**: Automatically categorizes issues into domains

### 📊 Multiple Scanning Modes

- **Feed Scanning**: Real-time scanning of your LinkedIn feed
- **Global Search**: Search across entire LinkedIn
- **Auto-scroll**: Continuous scanning while scrolling
- **Live Updates**: Results update as you scroll

### 📋 Problem Categories

- **Shipping & Logistics**: Delivery delays, lost packages, customs issues
- **Payment & Billing**: Failed payments, billing disputes, refund problems
- **Technical Issues**: Bugs, errors, system crashes
- **Customer Service**: Poor service, unresponsive support
- **Sales Opportunities**: Hiring, recruitment, job seeking

### 📊 Excel Export

- **Multiple Sheets**: Summary, Detailed Leads, By-Domain
- **Professional Formatting**: Color-coded quality scores
- **Statistics**: Match quality breakdown and domain distribution
- **Timestamp**: Automatic file naming with date/time

### 📈 Smart Data Processing

- **Match Scoring**: 0-100% confidence rating
- **Quality Indicators**: High/Medium/Lower quality classifications
- **Post Previews**: Snippet display in popup for quick review
- **Domain Detection**: Automatic problem categorization

## Installation 🚀

### From Chrome Web Store

Coming soon!

### Manual Installation (Developer Mode)

1. Clone or download this repository
2. Open `chrome://extensions/`
3. Enable **Developer Mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `linkedin-lead-scanner` folder
6. Extension appears in your Chrome toolbar

## Usage 📖

### Basic Workflow

1. **Open LinkedIn** - Navigate to your LinkedIn feed or search results
2. **Enter Keywords** - Type keywords like "shipping problem", "payment", "hiring"
3. **Scan** - Click "Scan feed" or "Search LinkedIn" to start
4. **Review Results** - See matches with quality scores and problem types
5. **Export** - Click "Export to Excel" when ready

### Export Features

- Automatic file naming with timestamp
- 3+ sheets (Summary, Leads, By Domain)
- All data preserved with proper formatting
- Ready for CRM or outreach

### Tips & Tricks

- **Use specific keywords** for better results
- **Check Match Score** (90%+ = high confidence)
- **Filter by domain** using the Generated domain sheets
- **Auto-scroll** for continuous scanning
- **Export frequently** to backup your leads

## Technical Stack 🛠️

- **Chrome Extension API** (Manifest v3)
- **JavaScript (ES6+)** - Core logic
- **XLSX.js** - Excel file generation
- **Chrome Storage API** - Local data persistence

## File Structure 📁

```
linkedin-lead-scanner/
├── manifest.json              # Extension configuration
├── popup.html                 # Popup UI
├── popup.js                   # Popup logic
├── content.js                 # Content script for LinkedIn
├── background.js              # Background service worker
├── init.js                     # XLSX initialization
├── styles.css                 # All styling
├── lib/
│   └── xlsx.full.min.js       # Excel library
├── EXPORT_GUIDE.md            # Export feature guide
├── QUICK_START.md             # Quick start guide
├── TESTING_GUIDE.md           # Testing documentation
└── README.md                  # This file
```

## Key Features Details 🔑

### Problem Domain Taxonomy

```javascript
- shipping: Delivery delays, lost packages, logistics
- payment: Failed payments, billing issues, refunds
- technical: Bugs, errors, crashes, system issues
- customer_service: Poor/slow support, unresponsive
- sales_opportunity: Hiring, recruiting, job seeking
```

### Matching Algorithm

1. **Exact Match** - Direct keyword match (100%)
2. **Flexible Spacing** - Handles extra spaces/punctuation (95%)
3. **Word-by-word Fuzzy** - Individual word matching (85%)
4. **Phrase-level Fuzzy** - Full phrase with 80%+ similarity
5. **Partial Word Match** - Related terms with 85%+ similarity
6. **Problem Domain Matching** - Context-aware detection

## Data Privacy & Security 🔒

- **Local Storage Only** - All data stored locally on your computer
- **No External Servers** - No data transmitted anywhere
- **User Control** - Clear results anytime
- **Manifest v3 Compliant** - Latest security standards
- **CSP Compliant** - No inline scripts or styles

## Permissions 🔐

- `storage` - Store results locally
- `downloads` - Export to Excel
- `scripting` - Inject content scripts
- `tabs` - Tab management
- `host_permissions` - Access LinkedIn pages

## Troubleshooting 🐛

### Export Issues

1. **"No results to export"** → Scan and collect leads first
2. **File won't download** → Check Chrome downloads settings
3. **Excel won't open** → File might be corrupted, try again
4. **XLSX error** → Reload extension (go to chrome://extensions)

### Scanning Issues

1. **No leads found** → Scroll up to load more posts
2. **Missed results** → Try more specific keywords
3. **Popup closes** → Some LinkedIn features reload the page

### Performance

- For 1000+ leads, export in batches
- Use more specific keywords to reduce false positives
- Clear results periodically to maintain performance

## Console Debugging 🔧

Press `F12` and run:

```javascript
// Check XLSX status
typeof XLSX !== "undefined";

// Get lead count
chrome.storage.local.get("linkedinLeadResults", (r) =>
  console.log(r.linkedinLeadResults.length),
);

// Test export
testExport();

// Clear all data
chrome.runtime.sendMessage({ action: "clearResults" });
```

## Contributing 🤝

Contributions welcome! Areas for improvement:

- Additional problem categories
- Better keyword suggestions
- Performance optimizations
- Bug fixes
- Documentation

## Roadmap 🗺️

- [ ] LinkedIn Company Pages scanning
- [ ] Advanced filtering options
- [ ] Bulk messaging templates
- [ ] Lead scoring system
- [ ] Custom keyword profiles
- [ ] Chrome sync for multiple devices
- [ ] CSV export option

## License 📄

MIT License - Feel free to use and modify

## Support 💬

- **Issues** - Report via GitHub Issues
- **Documentation** - See QUICK_START.md and EXPORT_GUIDE.md
- **Testing** - See TESTING_GUIDE.md

## Version History 📝

### v2.0.0 (Feb 2026)

- ✨ Problem domain taxonomy
- ✨ Advanced fuzzy matching
- ✨ Multi-sheet Excel export
- ✨ LinkedIn-wide search
- 🐛 Fixed export crashes
- 🐛 Fixed CSP violations
- 📈 Performance improvements

### v1.0.0 (Initial Release)

- Basic keyword scanning
- Feed post extraction
- Simple Excel export

---

**Made with ❤️ for LinkedIn lead generation**

⭐ Star this project if you find it useful!
