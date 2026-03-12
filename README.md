# Visual Bug Reporter

A Chrome extension that lets you capture screenshots, annotate them with drawings and text, and submit bug reports directly to a Google Doc — all in one click.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

## Features

- **One-click capture** — screenshot the current tab from the popup
- **Multi-screenshot reports** — add up to 10 screenshots per report
- **Annotation tools** — arrow, rectangle, ellipse, freehand draw, and text overlay
- **Per-screenshot metadata** — title, description, and priority tag (High/Medium/Low) for each screenshot
- **Auto-collected info** — URL, browser, OS, viewport, and timestamp
- **Google Docs integration** — reports are posted as formatted entries with embedded images
- **No backend needed** — uses Google Apps Script (free) + ImgBB (free) for image hosting

## Quick Start

### 1. Install the extension

```bash
git clone https://github.com/YOUR_USERNAME/visual-bug-reporter.git
cd visual-bug-reporter
npm install
npm run build
```

Then load in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `dist/` folder

### 2. Set up Google Apps Script (one-time)

This is how bug reports get posted to your Google Doc. No Google Cloud Console or OAuth setup needed.

1. Go to [script.google.com](https://script.google.com) → **New project**
2. Delete the default code and paste the script below:

<details>
<summary><strong>Click to expand Apps Script code</strong></summary>

```javascript
function authorize() {
  UrlFetchApp.fetch('https://www.google.com')
  var doc = DocumentApp.create('_VBR_auth_test')
  DriveApp.getFileById(doc.getId()).setTrashed(true)
  Logger.log('All permissions granted!')
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents)

  var doc
  if (data.docUrl) {
    var match = data.docUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (match) {
      doc = DocumentApp.openById(match[1])
    }
  }

  if (!doc) {
    var props = PropertiesService.getScriptProperties()
    var docId = props.getProperty('VBR_DOC_ID')
    if (docId) {
      try { doc = DocumentApp.openById(docId) } catch(e) { doc = null }
    }
    if (!doc) {
      doc = DocumentApp.create('Bug Reports — Visual Bug Reporter')
      props.setProperty('VBR_DOC_ID', doc.getId())
    }
  }

  var body = doc.getBody()

  body.appendHorizontalRule()

  var TAG_LABELS = { high: '🔴 High', medium: '🟡 Medium', low: '🔵 Low' }

  for (var i = 0; i < data.screenshots.length; i++) {
    var s = data.screenshots[i]

    var tagPrefix = (s.tag && TAG_LABELS[s.tag]) ? '[' + TAG_LABELS[s.tag] + '] ' : ''
    var screenshotTitle = body.appendParagraph(tagPrefix + s.title)
    screenshotTitle.setHeading(DocumentApp.ParagraphHeading.NORMAL)
    screenshotTitle.editAsText().setBold(true).setFontSize(16).setForegroundColor('#000000')

    if (s.description) {
      var desc = body.appendParagraph(s.description)
      var descText = desc.editAsText()
      descText.setBold(false).setFontSize(12).setForegroundColor('#000000')
      if (s.descriptionLinks && s.descriptionLinks.length) {
        for (var j = 0; j < s.descriptionLinks.length; j++) {
          var link = s.descriptionLinks[j]
          descText.setLinkUrl(link.start, link.end, link.url)
          descText.setForegroundColor(link.start, link.end, '#1155CC')
        }
      }
    }

    if (s.imageUrl) {
      try {
        var imgBlob = UrlFetchApp.fetch(s.imageUrl).getBlob()
        var image = body.appendImage(imgBlob)
        var width = image.getWidth()
        var height = image.getHeight()
        if (width > 680) {
          var ratio = 680 / width
          image.setWidth(680)
          image.setHeight(Math.round(height * ratio))
        }
      } catch(err) {
        var fallback = body.appendParagraph('🔗 ' + s.imageUrl)
        fallback.setLinkUrl(s.imageUrl)
        fallback.setForegroundColor('#1155CC')
      }
    }

    body.appendParagraph('')
  }

  var meta = '🔗 ' + data.url + '\n'
  meta += '💻 ' + data.browser + '  |  🖥 ' + data.os + '  |  📐 ' + data.viewport + '\n'
  meta += 'Reported: ' + data.timestamp
  var footer = body.appendParagraph(meta)
  footer.setForegroundColor('#888888')
  footer.setFontSize(9)

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    docUrl: doc.getUrl()
  })).setMimeType(ContentService.MimeType.JSON)
}
```

</details>

3. **Authorize permissions**: Select `authorize` from the function dropdown → click **Run** → approve all permissions
4. **Deploy**: Deploy → New deployment → **Web app** → Execute as: **Me** → Who has access: **Anyone** → Deploy
5. Copy the **Web App URL**

### 3. Get an ImgBB API key (free)

Screenshots are uploaded to ImgBB so they can be embedded in the Google Doc.

1. Go to [api.imgbb.com](https://api.imgbb.com/) → sign up
2. Copy your API key

### 4. Configure the extension

1. Click the extension icon → **Settings**
2. Paste your **Apps Script URL** and **ImgBB API key**
3. (Optional) Paste a **Google Doc URL** to use an existing doc — or leave blank to auto-create one
4. Click **Save Settings**

## Usage

1. Navigate to the page with the bug
2. Click the extension icon → **Capture Bug**
3. Annotate the screenshot with arrows, rectangles, text, etc.
4. Add a title and description for the screenshot
5. (Optional) Click **+** to add more screenshots from other tabs
6. Click **Next** → set priority tags → **Submit Report**
7. Your report appears in the Google Doc with embedded images

## Tech Stack

- **React 18** + **TypeScript** — UI components
- **Vite 5** + **@crxjs/vite-plugin** — build tooling for Chrome MV3
- **Canvas API** — annotation drawing (no external library)
- **Google Apps Script** — serverless backend for Google Docs
- **ImgBB** — free image hosting for screenshot embeds

## Project Structure

```
src/
├── background/          # Service worker — capture, upload, submit
│   └── index.ts
├── popup/               # Extension popup UI
│   └── Popup.tsx
├── annotation/          # Annotation editor (canvas + form)
│   ├── AnnotationApp.tsx
│   └── components/
│       ├── Canvas/      # Drawing tools, toolbar, undo/redo
│       └── BugForm/     # Review & submit form
├── settings/            # Settings page (API keys)
│   └── Settings.tsx
└── shared/
    ├── api/             # ImgBB upload, Google Docs API
    ├── types/           # TypeScript interfaces
    └── utils/           # Storage, browser info, constants
```

## Development

```bash
npm run dev     # Start Vite dev server with HMR
npm run build   # Production build → dist/
```

After `npm run dev`, load `dist/` as an unpacked extension. Reload the extension after service worker changes.

## License

MIT
