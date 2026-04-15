(function () {
    var GLOBAL_KEY = "__GLOBAL_IMAGE_PRELOAD__";
    var DEFAULT_MANIFEST_URL = "data/preload_images.json";
    var DEFAULT_CONCURRENCY = 12;

    var state = window[GLOBAL_KEY];
    if (!state) {
        state = {
            started: false,
            loading: false,
            activeCount: 0,
            queue: [],
            queuedByUrl: {},
            urlStatus: {},
            total: 0,
            loaded: 0,
            failed: 0,
            _currentResolve: null,
            _currentPromise: null,
            _manifestUrl: DEFAULT_MANIFEST_URL,
            _concurrency: DEFAULT_CONCURRENCY
        };
        window[GLOBAL_KEY] = state;
    }

    function normalizeUrl(url) {
        if (!url) return "";
        try {
            return new URL(url, window.location.href).href;
        } catch (error) {
            return "";
        }
    }

    function getStatus(url) {
        var normalized = normalizeUrl(url);
        return normalized ? state.urlStatus[normalized] : undefined;
    }

    function collectDomImageUrls() {
        var urls = [];
        var images = document.querySelectorAll("img[src]");
        Array.prototype.forEach.call(images, function (image) {
            var src = image.getAttribute("src");
            if (src) urls.push(src);
        });
        return urls;
    }

    function collectDomImageUrlsWhenReady() {
        if (document.readyState === "loading") {
            return new Promise(function (resolve) {
                document.addEventListener("DOMContentLoaded", function () {
                    resolve(collectDomImageUrls());
                }, { once: true });
            });
        }
        return Promise.resolve(collectDomImageUrls());
    }

    function markQueued(url) {
        state.queuedByUrl[url] = true;
        state.urlStatus[url] = "pending";
    }

    function markDone(url, ok) {
        delete state.queuedByUrl[url];
        state.urlStatus[url] = ok ? "ok" : "fail";
        if (ok) {
            state.loaded += 1;
        } else {
            state.failed += 1;
        }
    }

    function enqueueUrls(urls) {
        var list = Array.isArray(urls) ? urls : [];
        list.forEach(function (url) {
            var normalized = normalizeUrl(url);
            if (!normalized) return;
            var status = state.urlStatus[normalized];
            if (status === "ok" || status === "fail" || state.queuedByUrl[normalized]) return;
            markQueued(normalized);
            state.queue.push(normalized);
        });
    }

    function preloadOne(url, onDone) {
        var image = new Image();
        var finished = false;

        function done(ok) {
            if (finished) return;
            finished = true;
            image.onload = null;
            image.onerror = null;
            markDone(url, ok);
            onDone();
        }

        image.decoding = "async";
        image.loading = "eager";
        image.onload = function () { done(true); };
        image.onerror = function () { done(false); };
        image.src = url;
    }

    function maybeResolveCurrent() {
        if (state.loading) return;
        if (!state._currentResolve) return;
        var resolver = state._currentResolve;
        state._currentResolve = null;
        resolver({
            total: state.total,
            loaded: state.loaded,
            failed: state.failed
        });
    }

    function pumpQueue() {
        while (state.activeCount < state._concurrency && state.queue.length > 0) {
            var nextUrl = state.queue.shift();
            state.activeCount += 1;
            preloadOne(nextUrl, function () {
                state.activeCount -= 1;
                if (state.queue.length === 0 && state.activeCount === 0) {
                    state.loading = false;
                    maybeResolveCurrent();
                    return;
                }
                pumpQueue();
            });
        }
    }

    function ensureQueueRunning() {
        if (state.loading) return;
        if (!state.queue.length) {
            maybeResolveCurrent();
            return;
        }
        state.loading = true;
        pumpQueue();
    }

    function runPreload(urls) {
        enqueueUrls(urls);
        state.total = Object.keys(state.urlStatus).length;

        if (!state._currentPromise) {
            state._currentPromise = new Promise(function (resolve) {
                state._currentResolve = resolve;
            }).finally(function () {
                state._currentPromise = null;
            });
        }

        ensureQueueRunning();
        return state._currentPromise;
    }

    function loadManifest(manifestUrl) {
        return fetch(manifestUrl, { cache: "force-cache" })
            .then(function (response) {
                if (!response.ok) throw new Error("manifest_not_found");
                return response.json();
            })
            .then(function (payload) {
                if (Array.isArray(payload)) return payload;
                if (payload && Array.isArray(payload.images)) return payload.images;
                return [];
            });
    }

    function start(options) {
        if (state.started) {
            return state._currentPromise || Promise.resolve({
                total: state.total,
                loaded: state.loaded,
                failed: state.failed
            });
        }

        state.started = true;
        var config = options || {};
        state._manifestUrl = config.manifestUrl || state._manifestUrl || DEFAULT_MANIFEST_URL;
        state._concurrency = Math.max(2, Math.min(24, config.concurrency || state._concurrency || DEFAULT_CONCURRENCY));

        return loadManifest(state._manifestUrl)
            .catch(function () {
                return collectDomImageUrlsWhenReady();
            })
            .then(function (urls) {
                return runPreload(urls);
            });
    }

    function addUrls(urls) {
        return runPreload(urls);
    }

    state.start = start;
    state.addUrls = addUrls;
    state.getStatus = getStatus;
    window.startGlobalImagePreload = start;
    window.addGlobalPreloadUrls = addUrls;

    // Start preloading immediately on first page load.
    start({
        manifestUrl: DEFAULT_MANIFEST_URL,
        concurrency: DEFAULT_CONCURRENCY
    });
})();
