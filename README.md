SVG Slicer
---

![SVG Slicer UI](screenshot.png "SVG Slicer UI")

## Features

- [x] Slice SVG image to small images by group `<svg><g class="group-1"></g><g class="group-2"></g></svg>`
- [x] Fill random color to sliced images: detect largest bounding shape in group and fill with random color
- [x] Save sliced images to png

## DEV

1. Install electron-prebuilt `npm install -g electron-prebuilt gulp`
2. Install required packages `npm install`
3. Run app for dev with livereload `DEV=1 gulp serve`

## Built

1. Install electron packager `npm install -g electron-packager`
2. Built app for windows platform `electron-packager . --platform=win32 --arch=x64,ia32,arm`
3. Built app for linux platform `electron-packager . --platform=linux --arch=x64`
