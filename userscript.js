// ==UserScript==
// @name        Booru Improver
// @description Makes booru style sites much nicer to view.
// @include     https://rule34.xxx/*s=view*
// @include     https://e621.net/posts/*
// @include     https://gelbooru.com/*s=view*
// @include     https://realbooru.com/*s=view*
// @include     https://booru.allthefallen.moe/posts/*
// ==/UserScript==

(() => {
    "use strict";

    function main() {
        // If we need to wait for the page to finish loading first.
        // await new Promise(resolve => addEventListener("load", resolve));

        const wrapper = (() => {
            const hostname = window.location.hostname;
            switch (hostname) {
                case "rule34.xxx":
                    return new WrapperR();
                case "e621.net":
                    return new WrapperE();
                case "gelbooru.com":
                    return new WrapperG();
                case "realbooru.com":
                    return new WrapperRB();
                case "booru.allthefallen.moe":
                    return new WrapperA();
                default:
                    throw new Error(`Unknown hostname: ${hostname}`);
            }
        })();

        wrapper.applyOriginalImage();
        wrapper.applyCss();
        wrapper.applySpecialFixes();
        wrapper.applyZoomHook();
        wrapper.applyVolume();
    }

    class WrapperBase {
        constructor() {
            this.media = this._getImageElement();
            this._isVideo = false;
            this._needsSpecialFixes = true;

            if (this.media === null) {
                this._isVideo = true;
                this.media = this._getVideoElement();
            }
        }

        applyOriginalImage() {
            if (this._isVideo) return;

            const url = this._tryGetOriginalImageUrl();
            if (!url) return;

            this.media.src = url;
        }

        applyCss() {
            const style = document.createElement("style");
            style.innerText = this._getCss();
            document.head.append(style);
        }

        applyZoomHook() {
            this.media.addEventListener("mousemove", e => {
                const rect = e.target.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 1.5 - 0.25;
                const y = ((e.clientY - rect.top) / rect.height) * 1.5 - 0.25;

                e.target.style.setProperty("--x", `${clamp(x * 100, 0, 100)}%`);
                e.target.style.setProperty("--y", `${clamp(y * 100, 0, 100)}%`);
            });
        }

        applySpecialFixes() {}

        applyVolume() {
            if (!this._isVideo) return;

            this._getVideoPlayerElement().volume = 1;
        }

        _getCss() {
            const mediaSelectors = this._getCssMediaSelectors();
            return `
:root {
  --content-width: 60vw;
  --rest-width: calc(100vw - var(--content-width));
}

body {
  width: var(--rest-width);
}

${mediaSelectors.join(",")} {
  background: black;
  position: fixed;
  right: 0;
  top: 0;
  width: var(--content-width) !important;
  height: 100vh !important;
  max-width: unset !important;
  object-fit: contain;
  image-rendering: high-quality;
}

${mediaSelectors.map(x => x + ":hover:not(:fullscreen)").join(",")} {
    object-fit: cover;
    object-position: var(--x) var(--y);
}

${this._getCssResizeSelector()}
{
    display: none !important;
}
            `;
        }

        _tryGetOriginalImageUrl() {
            throw notImplementedError();
        }

        _getCssMediaSelectors() {
            throw notImplementedError();
        }

        _getCssResizeSelector() {
            throw notImplementedError();
        }

        _getImageElement() {
            throw notImplementedError();
        }

        _getVideoElement() {
            throw notImplementedError();
        }

        _getVideoPlayerElement() {
            if (!this._isVideo) {
                throw new Error("Media is not a video");
            }

            return this.media;
        }
    }

    class WrapperR extends WrapperBase {
        #player;
        #needsSpecialFixes;

        constructor() {
            super();

            if (this._isVideo) {
                this.#needsSpecialFixes = true;
                this.#player = document.getElementById("gelcomVideoPlayer");
            }

            if (this.media === null) {
                const restored = this._tryRestoreRemovedMedia();
                this.media = restored.media;
                this._isVideo = restored.isVideo;
                this.#needsSpecialFixes = false;
            }
        }

        applySpecialFixes() {
            if (!this.#needsSpecialFixes) return;

            const overlay = document.getElementById("fluid_video_wrapper_gelcomVideoPlayer");
            this.media.prepend(this.#player);
            this.#player.id = "gelcomVideoPlayer-modified";
            this.#player.setAttribute("controls", "");
            overlay.style.display = "none";
        }

        _getCssMediaSelectors() {
            return ["#image", "#gelcomVideoPlayer-modified"];
        }

        _getCssResizeSelector() {
            return "#resized_notice";
        }

        _getImageElement() {
            return document.getElementById("image");
        }

        _getVideoElement() {
            return document.getElementById("gelcomVideoContainer");
        }

        _getVideoPlayerElement() {
            return this.#player;
        }

        _tryGetOriginalImageUrl() {
            return document.getElementById("resized_notice")?.firstChild?.href;
        }

        _tryRestoreRemovedMedia() {
            const url = [...document.getElementsByTagName("a")]
              .filter(x => x.innerText === "Original image")[0]?.href;
            const isVideo = [...document.querySelectorAll("li.tag-type-metadata.tag > a:nth-child(2)")]
              .filter(x => x.innerText === "video")[0] !== undefined;

            if (!url) {
                throw new Error("Unable to find removed media source");
            }

            let media;
            if (isVideo) {
                media = document.createElement("video");
                media.id = "image";
                media.src = url;
                media.controls = "";
                media.loop = "";
            } else {
                media = document.createElement("img");
                media.id = "image";
                media.src = url;
            }

            document.body.append(media);

            return { media, isVideo };
        }
    }

    class WrapperE extends WrapperBase {
        applyOriginalImage() {
            super.applyOriginalImage();

            // Prevent image from being downsized by their JS.
            this.media.id = "image-modified";
        }

        _tryGetOriginalImageUrl() {
            return document.getElementById("image-resize-link")?.href;
        }

        _getCss() {
            return super._getCss() + `
body {
  position: absolute;
  left: 0;
  top: 0;
}
            `;
        }

        _getCssMediaSelectors() {
            return ["#image-modified"];
        }

        _getCssResizeSelector() {
            return "#image-resize-notice";
        }

        _getImageElement() {
            return document.getElementById("image");
        }

        _getVideoElement() {
            return this._getImageElement();
        }
    }

    class WrapperG extends WrapperBase {
        _tryGetOriginalImageUrl() {
            return [...document.getElementsByTagName("a")]
              .filter(x => x.innerText === "Original image")[0];
        }

        _getCssMediaSelectors() {
            return ["#image", "#gelcomVideoPlayer"];
        }

        _getCssResizeSelector() {
            return "#resize-link";
        }

        _getImageElement() {
            return document.getElementById("image");
        }

        _getVideoElement() {
            return document.getElementById("gelcomVideoPlayer");
        }
    }

    class WrapperRB extends WrapperBase {
        _tryGetOriginalImageUrl() {
            return null;
        }

        _getCssMediaSelectors() {
            return ["#image", "#gelcomVideoPlayer"];
        }

        _getCssResizeSelector() {
            return "#resize-link";
        }

        _getImageElement() {
            return document.getElementById("image");
        }

        _getVideoElement() {
            return document.getElementById("gelcomVideoPlayer");
        }
    }

    class WrapperA extends WrapperBase {
        applyOriginalImage() {
            super.applyOriginalImage();

            // Prevent image from being downsized by their JS.
            this.media.id = "image-modified";
        }

        _tryGetOriginalImageUrl() {
            return document.getElementById("image-resize-link")?.href;
        }

        _getCss() {
            return super._getCss() + `
body {
  position: absolute;
  left: 0;
  top: 0;
}
            `;
        }

        _getCssMediaSelectors() {
            return ["#image-modified"];
        }

        _getCssResizeSelector() {
            return "#image-resize-notice";
        }

        _getImageElement() {
            return document.getElementById("image");
        }

        _getVideoElement() {
            return this._getImageElement();
        }
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(value, max));
    }

    function notImplementedError() {
        return new Error("Not implemented");
    }

    main();
})();
