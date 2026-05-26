(function () {
    // ===== 衍生谱系页面调参区（中文注释版）=====
    // 说明：
    // 1) 样式类调参（位置、尺寸、间距等）统一在 css/style.css 的 .lineage-container 变量区维护。
    // 2) 这里仅保留数据/布局计算/文案等 JS 配置，不再写入样式变量，避免与 CSS 调参互相覆盖。
    var DEFAULT_TUNING = {
        data: {
            csvPath: "data/apron_variant.csv",
            imagePath: "data/imgs/variant/apron_variant/",
            imageExts: [".png", ".jpg", ".jpeg", ".webp"],
            minRenderWidth: 220,
            minRenderHeight: 220,
            loadingPollDelay: 60,
            renderRetryDelay: 120,
            variantLabelMaxLength: 10,
            missingImageSuffix: "（未找到对应图片）"
        },
        views: {
            apron: {
                csvPath: "data/apron_variant.csv",
                imagePath: "data/imgs/variant/apron_variant/",
                imageExts: [".png", ".jpg", ".jpeg", ".webp"],
                centerLabel: "裙板",
                typeNodeLabelPrefix: "裙板属性类型：",
                variantNodeLabelPrefix: "裙板变体：",
                meaningPrefix: "寓意：",
                meaningFallback: "暂无寓意",
                graphAriaLabel: "裙板衍生谱系图",
                typeKeys: ["apron", "aporn", "type", "apron_type", "属性", "类型"],
                variantKeys: ["variant", "variant_name", "name", "变体", "变体名"],
                introductionKeys: ["introduction", "intro", "description", "details", "介绍"],
                meaningKeys: ["meaning", "meanings", "寓意"],
                buildingsKeys: ["buildings", "building", "architecture", "建筑", "关联建筑"],
                imageKeys: ["image", "img", "photo", "图片"],
                imageAliasKeys: ["image_alias", "image_name", "图片名", "old_variant", "legacy_variant", "原始变体"]
            },
            pattern: {
                csvPath: "data/pattern_variant.csv",
                imagePath: "data/imgs/variant/patterns_variant/",
                imageExts: [".jpg", ".jpeg", ".png", ".webp"],
                centerLabel: "窗棂",
                typeNodeLabelPrefix: "窗棂纹样类型：",
                variantNodeLabelPrefix: "窗棂变体：",
                meaningPrefix: "风格：",
                meaningFallback: "暂无风格",
                graphAriaLabel: "窗棂衍生谱系图",
                gradients: {
                    center: [{ offset: "0%", color: "#fff2ec" }, { offset: "100%", color: "#cf4f3b" }],
                    type: [{ offset: "0%", color: "#f8ddd4" }, { offset: "100%", color: "#b53f2e" }],
                    variant: [{ offset: "0%", color: "#fdebe4" }, { offset: "100%", color: "#d77161" }]
                },
                typeKeys: ["pattern", "type", "pattern_type", "属性", "类型", "母纹样", "纹样类型"],
                variantKeys: ["variant", "variant_name", "name", "变体", "变体名"],
                introductionKeys: ["introduction", "intro", "description", "details", "介绍"],
                meaningKeys: ["style", "meaning", "meanings", "风格", "寓意"],
                buildingsKeys: ["buildings", "building", "architecture", "建筑", "关联建筑"],
                imageKeys: ["image", "img", "photo", "图片"],
                imageAliasKeys: ["image_alias", "image_name", "图片名", "old_variant", "legacy_variant", "原始变体"],
                typePalette: ["#4fa2c2", "#cd4242", "#8a4b2c", "#F6B42B", "#5865B0", "#E47C41", "#BD211B", "#82C3AA"]
            }
        },
        text: {
            centerLabel: "裙板",
            introductionFallback: "暂无介绍",
            meaningFallback: "暂无寓意",
            buildingsFallback: "暂无相关建筑",
            focusPrefix: "当前焦点：",
            allVariantsLabel: "全部变体",
            meaningPrefix: "寓意：",
            buildingsPrefix: "建筑：",
            trendCenterLabel: "1 个中心",
            typeCountSuffix: " 类属性",
            variantCountSuffix: " 个变体"
        },
        layout: {
            centerXRatio: 0.5,        // 图谱中心横向位置比例（越小越靠左）
            centerYRatio: 0.5,        // 图谱中心纵向位置比例（越小越靠上）
            typeRingRatio: 0.15,       // 中心到“apron类型层”的半径比例
            variantRingRatio: 0.3,    // 中心到“variant层”的半径比例
            typeStartAngle: -Math.PI / 2,//起始角度
            variantSpreadMin: Math.PI / 15,//最小展开角度
            variantSpreadMax: Math.PI * 0.95,//最大展开角度
            variantSpreadStep: Math.PI / 15,
            variantSpreadBase: Math.PI / 10,
            variantRadialOffset: 5   // 变体节点交错起伏量（2.5D层次）
        },
        visual: {
            nodeRadiusByLevel: { "0": 38, "1": 22, "2": 12 },
            nodeShadow: { cyRatio: 0.92, rxRatio: 1.06, ryRatio: 0.34, minRy: 5 },
            nodeHaloExtra: { center: 10, other: 7 },
            nodeSpecular: { cxRatio: -0.35, cyRatio: -0.45, rRatio: 0.23, minR: 3 },
            labelOffsetByLevel: { "1": 38, "2": 24 },
            labelFirstLineFactor: 0.56,
            labelLineGapEm: 1.12,
            labelBgPadding: { x: 7, y: 4, rx: 8, ry: 8 },
            linkCurve: { centerBendRatio: 0.02, variantBendRatio: 0.16, shadowYOffset: 3 },
            trendOffset: { center: { dx: -64, dy: -8 }, type: { dx: -14, dy: 10 }, variant: { dx: -16, dy: 14 } }
        },
        gradients: {
            center: [{ offset: "0%", color: "#fff4e0" }, { offset: "100%", color: "#dd9f67" }],
            type: [{ offset: "0%", color: "#f3dfc2" }, { offset: "100%", color: "#c9975f" }],
            variant: [{ offset: "0%", color: "#f9f0e2" }, { offset: "100%", color: "#d5b080" }]
        },
        typePalette: ["#EB5580", "#2C9AC6", "#4FB127", "#F6B42B", "#5865B0", "#E47C41", "#BD211B", "#82C3AA"]
    };

    var lineageState = {
        dataByView: {},
        loadingByView: {},
        sidebarCards: [],
        pinnedNodeId: "center",
        renderContext: null,
        pendingRenderTimer: null,
        activeView: "pattern",
        toggleReady: false,
        previewOverlay: null,
        previewPanel: null,
        previewCardId: "",
        tuning: buildTuning()
    };
    var lineageImageCache = window.__LINEAGE_IMAGE_CACHE__;
    if (!lineageImageCache) {
        lineageImageCache = {
            resolvedByKey: {},
            pendingByKey: {},
            urlStatus: {},
            urlPending: {},
            warmByView: {}
        };
        window.__LINEAGE_IMAGE_CACHE__ = lineageImageCache;
    } else {
        lineageImageCache.resolvedByKey = lineageImageCache.resolvedByKey || {};
        lineageImageCache.pendingByKey = lineageImageCache.pendingByKey || {};
        lineageImageCache.urlStatus = lineageImageCache.urlStatus || {};
        lineageImageCache.urlPending = lineageImageCache.urlPending || {};
        lineageImageCache.warmByView = lineageImageCache.warmByView || {};
    }

    function isPlainObject(value) { return Object.prototype.toString.call(value) === "[object Object]"; }
    function cloneValue(value) {
        if (Array.isArray(value)) return value.slice();
        if (isPlainObject(value)) {
            var cloned = {};
            Object.keys(value).forEach(function (key) { cloned[key] = cloneValue(value[key]); });
            return cloned;
        }
        return value;
    }
    function mergeConfig(baseConfig, overrideConfig) {
        var merged = cloneValue(baseConfig);
        if (!isPlainObject(overrideConfig)) return merged;
        Object.keys(overrideConfig).forEach(function (key) {
            var overrideValue = overrideConfig[key];
            merged[key] = (isPlainObject(overrideValue) && isPlainObject(merged[key]))
                ? mergeConfig(merged[key], overrideValue)
                : cloneValue(overrideValue);
        });
        return merged;
    }
    function buildTuning() { return mergeConfig(DEFAULT_TUNING, window.LINEAGE_TUNING || {}); }

    function cleanText(value) { return value === undefined || value === null ? "" : String(value).trim(); }
    function clamp(min, max, value) { return Math.max(min, Math.min(max, value)); }
    var LINEAGE_PI2 = Math.PI * 2;
    var LINEAGE_PI_HALF = Math.PI / 2;

    function normalizeAngle(angle) {
        var normalized = angle % LINEAGE_PI2;
        return normalized < 0 ? normalized + LINEAGE_PI2 : normalized;
    }

    function isRightSideAngle(angle) {
        var normalized = normalizeAngle(angle);
        return normalized > 0 && normalized < Math.PI;
    }

    function polarX(radius, angle) { return radius * Math.cos(angle - LINEAGE_PI_HALF); }
    function polarY(radius, angle) { return radius * Math.sin(angle - LINEAGE_PI_HALF); }

    function estimateLabelWidth(text, fontSize) {
        var raw = cleanText(text);
        if (!raw) return 0;

        var cjkCount = 0;
        var latinCount = 0;
        for (var index = 0; index < raw.length; index += 1) {
            if (raw.charCodeAt(index) > 255) {
                cjkCount += 1;
            } else {
                latinCount += 1;
            }
        }

        return cjkCount * fontSize * 0.95 + latinCount * fontSize * 0.62;
    }

    function safeSvgTextLength(node, text, fontSize) {
        var measured = 0;
        if (node && typeof node.getComputedTextLength === "function") {
            measured = node.getComputedTextLength();
        }
        if (!isFinite(measured) || measured <= 0) {
            measured = estimateLabelWidth(text, fontSize);
        }
        return measured;
    }

    function createElement(tagName, className, textContent) {
        var element = document.createElement(tagName);
        if (className) element.className = className;
        if (textContent !== undefined) element.textContent = textContent;
        return element;
    }

    function ensureCardPreviewOverlay() {
        if (lineageState.previewOverlay && lineageState.previewPanel) return;

        var overlay = createElement("div", "lineage-preview-overlay");
        overlay.setAttribute("aria-hidden", "true");

        var panel = createElement("div", "lineage-preview-panel");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.setAttribute("aria-label", "衍生图录放大预览");

        overlay.appendChild(panel);
        overlay.addEventListener("click", function () {
            closeCardPreview();
        });

        document.addEventListener("keydown", function (event) {
            if (!event || event.key !== "Escape") return;
            closeCardPreview();
        });

        document.body.appendChild(overlay);
        lineageState.previewOverlay = overlay;
        lineageState.previewPanel = panel;
    }

    function closeCardPreview() {
        if (!lineageState.previewOverlay || !lineageState.previewPanel) return;

        var lineageContainer = document.getElementById("lineage-container");
        if (lineageContainer) lineageContainer.classList.remove("lineage-preview-open");

        lineageState.previewOverlay.classList.remove("is-visible");
        lineageState.previewOverlay.setAttribute("aria-hidden", "true");
        lineageState.previewPanel.innerHTML = "";
        lineageState.previewCardId = "";
    }

    function openCardPreview(cardElement) {
        if (!cardElement) return;
        ensureCardPreviewOverlay();
        if (!lineageState.previewOverlay || !lineageState.previewPanel) return;

        var lineageContainer = document.getElementById("lineage-container");
        if (lineageContainer) lineageContainer.classList.add("lineage-preview-open");

        var previewCard = cardElement.cloneNode(true);
        previewCard.classList.remove("is-hidden");
        previewCard.classList.remove("is-active");
        previewCard.classList.add("lineage-card-preview");

        lineageState.previewPanel.innerHTML = "";
        lineageState.previewPanel.appendChild(previewCard);
        lineageState.previewOverlay.classList.add("is-visible");
        lineageState.previewOverlay.setAttribute("aria-hidden", "false");
        lineageState.previewCardId = cleanText(cardElement.getAttribute("data-variant-id"));
    }

    function toggleCardPreview(cardElement) {
        if (!cardElement) return;
        var cardId = cleanText(cardElement.getAttribute("data-variant-id"));
        var overlayVisible = !!(lineageState.previewOverlay && lineageState.previewOverlay.classList.contains("is-visible"));

        if (overlayVisible && cardId && cardId === lineageState.previewCardId) {
            closeCardPreview();
            return;
        }

        openCardPreview(cardElement);
    }

    function getViewConfig(viewKey) {
        var tuning = lineageState.tuning;
        var views = tuning.views || {};
        var viewConfig = cloneValue(views[viewKey] || {});

        // 兼容旧版仅通过 tuning.data / tuning.text 覆盖裙板数据源的写法
        if (viewKey === "apron") {
            if (!cleanText(viewConfig.csvPath)) viewConfig.csvPath = cleanText(tuning.data.csvPath);
            if (!cleanText(viewConfig.imagePath)) viewConfig.imagePath = cleanText(tuning.data.imagePath);
            if (!cleanText(viewConfig.centerLabel)) viewConfig.centerLabel = cleanText(tuning.text.centerLabel) || "裙板";
            if (!cleanText(viewConfig.meaningPrefix)) viewConfig.meaningPrefix = cleanText(tuning.text.meaningPrefix) || "寓意：";
            if (!cleanText(viewConfig.meaningFallback)) viewConfig.meaningFallback = cleanText(tuning.text.meaningFallback) || "暂无寓意";
            if (!cleanText(viewConfig.graphAriaLabel)) viewConfig.graphAriaLabel = "裙板衍生谱系图";
        }

        return viewConfig;
    }

    function getActiveViewConfig() {
        var views = lineageState.tuning.views || {};
        if (!views[lineageState.activeView]) {
            var firstView = Object.keys(views)[0];
            lineageState.activeView = firstView || "apron";
        }
        return getViewConfig(lineageState.activeView);
    }

    function detectInitialViewFromDom() {
        var activeButton = document.querySelector(".lineage-view-button.is-active[data-lineage-view]");
        if (!activeButton) return;
        var viewKey = cleanText(activeButton.getAttribute("data-lineage-view"));
        if (!viewKey) return;
        var views = lineageState.tuning.views || {};
        if (views[viewKey]) lineageState.activeView = viewKey;
    }

    function updateViewToggleButtons() {
        var buttons = document.querySelectorAll(".lineage-view-button[data-lineage-view]");
        if (!buttons || !buttons.length) return;

        Array.prototype.forEach.call(buttons, function (button) {
            var viewKey = cleanText(button.getAttribute("data-lineage-view"));
            var isActive = viewKey === lineageState.activeView;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
            button.disabled = isActive;
        });
    }

    function updateGraphAriaLabel() {
        var viewConfig = getActiveViewConfig();
        var graphElement = document.getElementById("lineage-graph");
        if (!graphElement) return;

        var ariaLabel = cleanText(viewConfig.graphAriaLabel);
        if (!ariaLabel) {
            var centerLabel = cleanText(viewConfig.centerLabel) || "衍生";
            ariaLabel = centerLabel + "衍生谱系图";
        }

        graphElement.setAttribute("data-lineage-view", lineageState.activeView);
        graphElement.setAttribute("aria-label", ariaLabel);
    }

    function updateMainDescription() {
        var viewConfig = getActiveViewConfig();
        var descriptionElement = document.getElementById("lineage-main-description");
        if (!descriptionElement) return;

        var centerLabel = cleanText(viewConfig.centerLabel) || cleanText(lineageState.tuning.text.centerLabel) || "裙板";
        descriptionElement.textContent = "下图以径向关系图形式，展现" + centerLabel + "基础纹样衍生出各类变体的谱系脉络";
    }

    function bindViewSwitchButtons() {
        if (lineageState.toggleReady) return;

        var switchWrap = document.getElementById("lineage-view-switch");
        if (!switchWrap) return;
        detectInitialViewFromDom();

        var buttons = switchWrap.querySelectorAll(".lineage-view-button[data-lineage-view]");
        if (!buttons || !buttons.length) return;

        Array.prototype.forEach.call(buttons, function (button) {
            button.addEventListener("click", function () {
                var viewKey = cleanText(button.getAttribute("data-lineage-view"));
                if (!viewKey) return;
                setLineageView(viewKey);
            });
        });

        lineageState.toggleReady = true;
        updateViewToggleButtons();
        updateGraphAriaLabel();
        updateMainDescription();
    }

    function setLineageView(viewKey, options) {
        var targetView = cleanText(viewKey);
        if (!targetView) return;

        var views = lineageState.tuning.views || {};
        if (!views[targetView]) return;

        var force = !!(options && options.force);
        if (!force && lineageState.activeView === targetView) return;

        lineageState.activeView = targetView;
        lineageState.pinnedNodeId = "center";
        lineageState.renderContext = null;
        lineageState.sidebarCards = [];
        closeCardPreview();

        updateViewToggleButtons();
        updateGraphAriaLabel();
        updateMainDescription();

        if (options && options.skipRender) return;
        createLineageGraph();
    }

    function toDisplayVariant(parentLabel, variantLabel) {
        var tuning = lineageState.tuning;
        var raw = cleanText(variantLabel);
        var shortLabel = raw;
        if (parentLabel && shortLabel.indexOf(parentLabel) === 0) shortLabel = shortLabel.slice(parentLabel.length);
        shortLabel = shortLabel.replace(/^[—\-–_、，,:：\s]+/, "");
        if (!shortLabel) shortLabel = raw;
        if (shortLabel.length > tuning.data.variantLabelMaxLength) shortLabel = shortLabel.slice(0, tuning.data.variantLabelMaxLength) + "…";
        return shortLabel;
    }

    function splitTypeLabel(label) {
        var text = cleanText(label);
        return text ? [text] : [""];
    }

    function addUniqueName(nameList, name) {
        var cleanName = cleanText(name);
        if (!cleanName) return;
        if (nameList.indexOf(cleanName) > -1) return;
        nameList.push(cleanName);
    }

    function getLineageImageCacheKey(candidates) {
        if (!candidates || !candidates.length) return "__LINEAGE_DEFAULT__";
        return candidates.join("||");
    }

    function flushLineageImageWaiters(waiters, resolvedHref) {
        if (!waiters || !waiters.length) return;
        waiters.forEach(function (callback) { callback(resolvedHref); });
    }

    function getGlobalImagePreloadStatus(href) {
        var globalPreload = window.__GLOBAL_IMAGE_PRELOAD__;
        if (!globalPreload || typeof globalPreload.getStatus !== "function") return "";
        return globalPreload.getStatus(href) || "";
    }

    function probeLineageImageUrl(href, onDone) {
        if (!href) {
            onDone(false);
            return;
        }

        var globalStatus = getGlobalImagePreloadStatus(href);
        if (globalStatus === "ok") {
            lineageImageCache.urlStatus[href] = "ok";
            onDone(true);
            return;
        }
        if (globalStatus === "fail") {
            lineageImageCache.urlStatus[href] = "fail";
            onDone(false);
            return;
        }

        var status = lineageImageCache.urlStatus[href];
        if (status === "ok") {
            onDone(true);
            return;
        }
        if (status === "fail") {
            onDone(false);
            return;
        }

        if (lineageImageCache.urlPending[href]) {
            lineageImageCache.urlPending[href].push(onDone);
            return;
        }

        lineageImageCache.urlPending[href] = [onDone];
        var probeImage = new Image();
        probeImage.decoding = "async";
        probeImage.onload = function () {
            lineageImageCache.urlStatus[href] = "ok";
            var callbacks = lineageImageCache.urlPending[href] || [];
            delete lineageImageCache.urlPending[href];
            callbacks.forEach(function (callback) { callback(true); });
        };
        probeImage.onerror = function () {
            lineageImageCache.urlStatus[href] = "fail";
            var callbacks = lineageImageCache.urlPending[href] || [];
            delete lineageImageCache.urlPending[href];
            callbacks.forEach(function (callback) { callback(false); });
        };
        probeImage.src = href;
    }

    function resolveLineageImageCandidates(candidates, onResolved) {
        var list = candidates && candidates.length ? candidates : [];
        var cacheKey = getLineageImageCacheKey(list);

        if (Object.prototype.hasOwnProperty.call(lineageImageCache.resolvedByKey, cacheKey)) {
            onResolved(lineageImageCache.resolvedByKey[cacheKey]);
            return;
        }
        if (lineageImageCache.pendingByKey[cacheKey]) {
            lineageImageCache.pendingByKey[cacheKey].push(onResolved);
            return;
        }
        lineageImageCache.pendingByKey[cacheKey] = [onResolved];

        function finish(resolvedHref) {
            lineageImageCache.resolvedByKey[cacheKey] = resolvedHref || "";
            var waiters = lineageImageCache.pendingByKey[cacheKey];
            delete lineageImageCache.pendingByKey[cacheKey];
            flushLineageImageWaiters(waiters, lineageImageCache.resolvedByKey[cacheKey]);
        }

        if (!list.length) {
            finish("");
            return;
        }

        function tryCandidate(index) {
            if (index >= list.length) {
                finish("");
                return;
            }
            var href = list[index];
            probeLineageImageUrl(href, function (ok) {
                if (ok) {
                    finish(href);
                    return;
                }
                tryCandidate(index + 1);
            });
        }

        tryCandidate(0);
    }

    function markLineageImageMissing(imageElement) {
        var tuning = lineageState.tuning;
        imageElement.classList.add("is-missing");
        if (imageElement.alt.indexOf(tuning.data.missingImageSuffix) < 0) {
            imageElement.alt = imageElement.alt + tuning.data.missingImageSuffix;
        }
    }

    function collectImageNameCandidates(name) {
        var baseName = cleanText(name);
        if (!baseName) return [];

        var candidates = [];
        addUniqueName(candidates, baseName);

        // 容错：部分窗棂图片文件名省略了“菱花”后缀
        if (/菱花$/.test(baseName)) {
            addUniqueName(candidates, baseName.replace(/菱花$/, ""));
        }

        return candidates;
    }

    function buildImageCandidates(variantNode, customViewConfig) {
        var tuning = lineageState.tuning;
        var viewConfig = customViewConfig || getActiveViewConfig();
        var imagePath = cleanText(viewConfig.imagePath) || cleanText(tuning.data.imagePath);
        var imageExts = viewConfig.imageExts || tuning.data.imageExts;
        var nameCandidates = [];

        [variantNode.image, variantNode.imageAlias, variantNode.label].forEach(function (name) {
            collectImageNameCandidates(name).forEach(function (candidateName) {
                addUniqueName(nameCandidates, candidateName);
            });
        });

        var candidates = [];

        nameCandidates.forEach(function (name) {
            var baseRaw = imagePath + name;
            var baseEncoded = imagePath + encodeURIComponent(name);
            imageExts.forEach(function (ext) {
                candidates.push(baseRaw + ext);
                candidates.push(baseEncoded + ext);
            });
        });

        return candidates;
    }

    function applyImageFallback(imageElement, candidates, index) {
        var list = candidates && candidates.length ? candidates.slice(index || 0) : [];
        var cacheKey = getLineageImageCacheKey(list);

        function setImageSource(href) {
            imageElement.classList.remove("is-missing");
            imageElement.onerror = function () {
                lineageImageCache.urlStatus[href] = "fail";
                loadImmediateCandidate(0);
            };
            imageElement.onload = function () {
                lineageImageCache.urlStatus[href] = "ok";
                lineageImageCache.resolvedByKey[cacheKey] = href;
                imageElement.onload = null;
            };
            imageElement.src = href;
        }

        function loadImmediateCandidate(startIndex) {
            if (!list.length) {
                markLineageImageMissing(imageElement);
                return;
            }

            for (var i = startIndex; i < list.length; i++) {
                var href = list[i];
                if (lineageImageCache.urlStatus[href] === "fail") continue;
                setImageSource(href);
                return;
            }
            markLineageImageMissing(imageElement);
        }

        if (!list.length) {
            markLineageImageMissing(imageElement);
            return;
        }

        if (Object.prototype.hasOwnProperty.call(lineageImageCache.resolvedByKey, cacheKey)) {
            var cachedHref = lineageImageCache.resolvedByKey[cacheKey];
            if (!cachedHref) {
                markLineageImageMissing(imageElement);
                return;
            }
            imageElement.classList.remove("is-missing");
            imageElement.onerror = function () {
                lineageImageCache.urlStatus[cachedHref] = "fail";
                delete lineageImageCache.resolvedByKey[cacheKey];
                loadImmediateCandidate(0);
            };
            imageElement.onload = function () {
                lineageImageCache.urlStatus[cachedHref] = "ok";
                imageElement.onload = null;
            };
            imageElement.src = cachedHref;
            return;
        }

        loadImmediateCandidate(0);
        resolveLineageImageCandidates(list, function (resolvedHref) {
            lineageImageCache.resolvedByKey[cacheKey] = resolvedHref || "";
        });
    }

    function pickRowText(row, keyCandidates) {
        for (var i = 0; i < keyCandidates.length; i++) {
            var value = cleanText(row[keyCandidates[i]]);
            if (value) return value;
        }
        return "";
    }

    function mergeVariantMeta(target, incoming) {
        if (!target.introduction && incoming.introduction) {
            target.introduction = incoming.introduction;
        }

        if (!target.meaning && incoming.meaning) {
            target.meaning = incoming.meaning;
        } else if (target.meaning && incoming.meaning && target.meaning.indexOf(incoming.meaning) === -1) {
            target.meaning = target.meaning + "；" + incoming.meaning;
        }

        if (!target.buildings && incoming.buildings) {
            target.buildings = incoming.buildings;
        } else if (target.buildings && incoming.buildings && target.buildings.indexOf(incoming.buildings) === -1) {
            target.buildings = target.buildings + "、" + incoming.buildings;
        }

        if (!target.image && incoming.image) {
            target.image = incoming.image;
        }
        if (!target.imageAlias && incoming.imageAlias) {
            target.imageAlias = incoming.imageAlias;
        }
    }

    function buildLineageData(rows, viewConfig, viewKey) {
        var typeMap = {};

        var typeKeys = viewConfig.typeKeys || ["type", "属性", "类型"];
        var variantKeys = viewConfig.variantKeys || ["variant", "变体", "变体名"];
        var introKeys = viewConfig.introductionKeys || ["introduction", "intro", "description", "details", "介绍"];
        var meaningKeys = viewConfig.meaningKeys || ["meaning", "meanings", "寓意"];
        var buildingsKeys = viewConfig.buildingsKeys || ["buildings", "building", "architecture", "建筑", "关联建筑"];
        var imageKeys = viewConfig.imageKeys || ["image", "img", "photo", "图片"];
        var imageAliasKeys = viewConfig.imageAliasKeys || ["image_alias", "image_name", "图片名", "old_variant", "legacy_variant", "原始变体"];

        rows.forEach(function (row) {
            var typeName = pickRowText(row, typeKeys);
            var variantName = pickRowText(row, variantKeys);
            if (!typeName || !variantName) return;

            var variantMeta = {
                label: variantName,
                introduction: pickRowText(row, introKeys),
                meaning: pickRowText(row, meaningKeys),
                buildings: pickRowText(row, buildingsKeys),
                image: pickRowText(row, imageKeys),
                imageAlias: pickRowText(row, imageAliasKeys)
            };

            if (!typeMap[typeName]) {
                typeMap[typeName] = { label: typeName, variantsMap: {} };
            }

            if (!typeMap[typeName].variantsMap[variantName]) {
                typeMap[typeName].variantsMap[variantName] = variantMeta;
            } else {
                mergeVariantMeta(typeMap[typeName].variantsMap[variantName], variantMeta);
            }
        });

        var typeNodes = Object.keys(typeMap)
            .map(function (name) {
                var variantList = Object.keys(typeMap[name].variantsMap).map(function (variantKey) {
                    return typeMap[name].variantsMap[variantKey];
                });
                return {
                    label: typeMap[name].label,
                    variants: variantList
                };
            })
            .sort(function (a, b) {
                if (b.variants.length !== a.variants.length) return b.variants.length - a.variants.length;
                return a.label.localeCompare(b.label, "zh-Hans-CN");
            })
            .map(function (item, index) {
                var sortedVariants = item.variants.slice().sort(function (a, b) {
                    return a.label.localeCompare(b.label, "zh-Hans-CN", { numeric: true });
                });
                var palette = viewConfig.typePalette || lineageState.tuning.typePalette || ["#EB5580","#2C9AC6","#4FB127","#F6B42B","#5865B0","#E47C41","#BD211B","#82C3AA"];
                return {
                    id: "type-" + index,
                    label: item.label,
                    level: 1,
                    nodeType: viewKey,
                    variants: sortedVariants,
                    count: sortedVariants.length,
                    color: palette[index % palette.length]/*自主配颜色*/
                };
            });

        var centerLabel = cleanText(viewConfig.centerLabel) || "中心";
        var centerNode = { id: "center", label: centerLabel, level: 0, nodeType: "center" };
        var variantNodes = [];
        var links = [];
        var variantsByType = {};

        typeNodes.forEach(function (typeNode, typeIndex) {
            links.push({ id: "link-center-" + typeNode.id, source: centerNode.id, target: typeNode.id, level: 1 });
            variantsByType[typeNode.id] = [];
            typeNode.variants.forEach(function (variantMeta, variantIndex) {
                var variantNode = {
                    id: "variant-" + typeIndex + "-" + variantIndex,
                    label: variantMeta.label,
                    displayLabel: toDisplayVariant(typeNode.label, variantMeta.label),
                    level: 2,
                    nodeType: "variant",
                    parentId: typeNode.id,
                    parentLabel: typeNode.label,
                    introduction: variantMeta.introduction,
                    meaning: variantMeta.meaning,
                    buildings: variantMeta.buildings,
                    image: variantMeta.image,
                    imageAlias: variantMeta.imageAlias,
                    color: typeNode.color/*颜色*/
                };
                variantNodes.push(variantNode);
                variantsByType[typeNode.id].push(variantNode);
                links.push({ id: "link-" + typeNode.id + "-" + variantNode.id, source: typeNode.id, target: variantNode.id, level: 2 });
            });
        });

        var nodes = [centerNode].concat(typeNodes, variantNodes);
        var nodeById = {};
        nodes.forEach(function (node) { nodeById[node.id] = node; });

        return {
            viewKey: viewKey,
            centerNode: centerNode,
            typeNodes: typeNodes,
            variantNodes: variantNodes,
            nodes: nodes,
            links: links,
            nodeById: nodeById,
            variantsByType: variantsByType
        };
    }

    function warmLineageImageCandidates(data) {
        if (!data || !data.variantNodes || !data.variantNodes.length) return;
        var warmViewConfig = getViewConfig(data.viewKey || lineageState.activeView || "apron");

        var warmSignature = (data.viewKey || lineageState.activeView || "lineage")
            + "|"
            + data.variantNodes.map(function (node) { return node.id; }).join(",");
        if (lineageImageCache.warmByView[warmSignature]) return;
        lineageImageCache.warmByView[warmSignature] = true;

        var candidateGroups = data.variantNodes.map(function (variantNode) {
            return buildImageCandidates(variantNode, warmViewConfig);
        });

        var queueIndex = 0;
        var maxConcurrency = 2;
        function runNext() {
            if (queueIndex >= candidateGroups.length) return;
            var currentCandidates = candidateGroups[queueIndex++];
            resolveLineageImageCandidates(currentCandidates, function () {
                runNext();
            });
        }

        for (var i = 0; i < maxConcurrency; i++) {
            runNext();
        }
    }

    function scheduleLineageImageWarmup(data) {
        if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(function () {
                warmLineageImageCandidates(data);
            }, { timeout: 1800 });
            return;
        }
        window.setTimeout(function () {
            warmLineageImageCandidates(data);
        }, 500);
    }

    function ensureLineageData(viewKey, callback) {
        var tuning = lineageState.tuning;

        if (lineageState.dataByView[viewKey]) {
            scheduleLineageImageWarmup(lineageState.dataByView[viewKey]);
            callback(null, lineageState.dataByView[viewKey]);
            return;
        }
        if (lineageState.loadingByView[viewKey]) {
            window.setTimeout(function () { ensureLineageData(viewKey, callback); }, tuning.data.loadingPollDelay);
            return;
        }

        var viewConfig = getViewConfig(viewKey);
        var csvPath = cleanText(viewConfig.csvPath);
        if (!csvPath) {
            callback(new Error("衍生谱系数据路径未配置"));
            return;
        }

        lineageState.loadingByView[viewKey] = true;
        d3.csv(csvPath, function (error, rows) {
            lineageState.loadingByView[viewKey] = false;
            if (error) {
                callback(error);
                return;
            }
            var builtData = buildLineageData(rows || [], viewConfig, viewKey);
            lineageState.dataByView[viewKey] = builtData;
            scheduleLineageImageWarmup(builtData);
            callback(null, builtData);
        });
    }

    function getNodeRadius(node) {
        var radiusByLevel = lineageState.tuning.visual.nodeRadiusByLevel;
        return radiusByLevel[String(node.level)] || radiusByLevel["2"];
    }

    function computeLayout(data, width, height) {
        var baseRadius = Math.min(width, height);
        var sizeFactor = width / 1600;
        var centerX = width / 2;
        var centerY = height / 2;

        var radialLayout = {
            width: width,
            height: height,
            centerX: centerX,
            centerY: centerY,
            baseRadius: baseRadius,
            sizeFactor: sizeFactor,
            radTypeDonutInner: baseRadius * 0.110,
            radTypeDonutOuter: baseRadius * 0.114,
            radName: baseRadius * 0.125 + 6 * sizeFactor,
            radVariantRingInner: baseRadius * 0.278,
            radVariantRingOuter: baseRadius * 0.286,
            radVariantDot: baseRadius * 0.278,
            radVariantLabel: baseRadius * 0.298,
            radVariantHoverInner: baseRadius * 0.258,
            radVariantHoverOuter: baseRadius * 0.300,
            radLineMin: baseRadius * 0.105,
            radLineMax: baseRadius * 0.190,//转弯处
            radLineLabel: baseRadius * 0.228,
            radCenterHit: baseRadius * 0.09,
            typeDotRadius: Math.max(13, 18 * sizeFactor),//节点大小1
            variantDotRadius: Math.max(9, 13 * sizeFactor),//节点大小2
            typeLabelFontSize:36 * sizeFactor,
            typeLabelSubFontSize: 24 * sizeFactor,
            variantLabelFontSize: 30 * sizeFactor,
            centerTitleFontSize: 55 * sizeFactor,
            guideFontSize:  28 * sizeFactor
        };//衍生谱系图可调参数

        data.centerNode.angle = 0;
        data.centerNode.radialRadius = 0;
        data.centerNode.chartX = 0;
        data.centerNode.chartY = 0;
        data.centerNode.x = centerX;
        data.centerNode.y = centerY;
        data.centerNode.labelLines = [data.centerNode.label];

        var pie = d3.pie()
            .sort(null)
            .value(function (d) { return Math.max(1, d.count || 1); });
        var typeArcs = pie(data.typeNodes);

        typeArcs.forEach(function (arcData, index) {
            var typeNode = data.typeNodes[index];
            var labelLines = splitTypeLabel(typeNode.label);
            var angle = (arcData.endAngle - arcData.startAngle) / 2 + arcData.startAngle;

            typeNode.typeArc = arcData;
            typeNode.angle = angle;
            typeNode.centerAngle = angle;
            typeNode.nameAngle = angle;
            typeNode.radialRadius = radialLayout.radName;
            typeNode.dotNameRadius = radialLayout.radName + estimateLabelWidth(typeNode.label, radialLayout.typeLabelFontSize) + 10 * sizeFactor;
            typeNode.firstName = labelLines[0] || typeNode.label;
            typeNode.lastName = labelLines.length > 1 ? labelLines.slice(1).join("") : "";
            typeNode.labelLines = labelLines;
            typeNode.labelAnchor = isRightSideAngle(angle) ? "start" : "end";
            typeNode.chartX = polarX(typeNode.dotNameRadius, angle);
            typeNode.chartY = polarY(typeNode.dotNameRadius, angle);
            typeNode.x = centerX + typeNode.chartX;
            typeNode.y = centerY + typeNode.chartY;
        });

        var hierarchyRows = [{ id: "lineage-root", parentId: "" }];
        data.typeNodes.forEach(function (typeNode) {
            hierarchyRows.push({ id: typeNode.id, parentId: "lineage-root", node: typeNode });
            (data.variantsByType[typeNode.id] || []).forEach(function (variantNode) {
                hierarchyRows.push({ id: variantNode.id, parentId: typeNode.id, node: variantNode });
            });
        });

        if (hierarchyRows.length > 1) {
            var root = d3.stratify()
                .id(function (d) { return d.id; })
                .parentId(function (d) { return d.parentId || null; })
                (hierarchyRows);
            var cluster = d3.cluster()
                .size([360, radialLayout.radVariantDot])
                .separation(function (a, b) { return a.parent === b.parent ? 1 : 1.3; });
            cluster(root);

            root.descendants().forEach(function (clusterNode) {
                if (!clusterNode.data || !clusterNode.data.node) return;
                if (clusterNode.data.node.level === 1) {
                    clusterNode.data.node.clusterAngle = clusterNode.x * Math.PI / 180;
                }
            });

            var leaves = root.leaves();
            var angleDistance = leaves.length > 1
                ? Math.abs(leaves[1].x - leaves[0].x) * Math.PI / 180
                : LINEAGE_PI2;

            leaves.forEach(function (leaf) {
                var variantNode = leaf.data.node;
                if (!variantNode || variantNode.level !== 2) return;

                var variantAngle = leaf.x * Math.PI / 180;
                variantNode.angle = variantAngle;
                variantNode.centerAngle = variantAngle;
                variantNode.radialRadius = radialLayout.radVariantDot;
                variantNode.startAngle = variantAngle - angleDistance / 2;
                variantNode.endAngle = variantAngle + angleDistance / 2;
                variantNode.labelAnchor = isRightSideAngle(variantAngle) ? "start" : "end";
                variantNode.labelLines = [variantNode.displayLabel || variantNode.label];
                variantNode.chartX = polarX(radialLayout.radVariantDot, variantAngle);
                variantNode.chartY = polarY(radialLayout.radVariantDot, variantAngle);
                variantNode.x = centerX + variantNode.chartX;
                variantNode.y = centerY + variantNode.chartY;
            });
        }

        data.layout = radialLayout;
    }

    function buildRadialConnectionPath(sourceAngle, sourceRadius, targetAngle, targetRadius, layout, level) {
        if (level === 1) {
            return d3.lineRadial()
                .angle(function (d) { return d.angle; })
                .radius(function (d) { return d.radius; })
                .curve(d3.curveLinear)
                ([
                    { angle: sourceAngle || 0, radius: sourceRadius },
                    { angle: targetAngle || 0, radius: targetRadius }
                ]);
        }

        var sourceA = normalizeAngle(sourceAngle || 0);
        var targetA = normalizeAngle(targetAngle || 0);
        var lineData = [];
        var side;
        var da;
        var angleSign;

        if (targetA - sourceA < -Math.PI) {
            side = "cw";
            da = 2 + (targetA - sourceA) / Math.PI;
            angleSign = 1;
        } else if (targetA - sourceA < 0) {
            side = "ccw";
            da = (sourceA - targetA) / Math.PI;
            angleSign = -1;
        } else if (targetA - sourceA < Math.PI) {
            side = "cw";
            da = (targetA - sourceA) / Math.PI;
            angleSign = 1;
        } else {
            side = "ccw";
            da = 2 - (targetA - sourceA) / Math.PI;
            angleSign = -1;
        }

        var curveStart = level === 1 ? layout.radLineMin * 0.76 : layout.radLineMax;
        var curveEnd = level === 1 ? layout.radLineMin : layout.radLineMin;

        var radCurveLine;
        if (level === 1) {
            radCurveLine = curveStart + (curveEnd - curveStart) * da;
        } else {
            // 第二层连线：两侧更贴近内圈文字下方，中间保持更靠外
            var sideT = clamp(0, 1, da / 0.45);
            sideT = Math.pow(sideT, 1.6);//变小向里贴

            var innerCurveRadius = layout.radName + 2 * layout.sizeFactor;
            var outerCurveRadius = layout.radLineMax;

            radCurveLine = outerCurveRadius + (innerCurveRadius - outerCurveRadius) * sideT;
        }
        var startOffset = level === 1 ? 0.012 : (0.015 + 0.055 * sideT);
        var endOffset = level === 1 ? 0.012 : (0.005 + 0.035 * sideT);
        var startAngle = sourceA + angleSign * startOffset * Math.PI;
        var endAngle = targetA - angleSign * endOffset * Math.PI;
        var daInner;

        if (targetA - sourceA < -Math.PI) {
            daInner = LINEAGE_PI2 + (endAngle - startAngle);
        } else if (targetA - sourceA < 0) {
            daInner = startAngle - endAngle;
        } else if (targetA - sourceA < Math.PI) {
            daInner = endAngle - startAngle;
        } else {
            daInner = LINEAGE_PI2 - (endAngle - startAngle);
        }

        lineData.push({ angle: sourceA, radius: sourceRadius });
        lineData.push({ angle: startAngle, radius: radCurveLine });

        var step = 0.06;
        var segmentCount = Math.abs(Math.floor(daInner / step));
        var curveAngle = startAngle;
        var sign = side === "cw" ? 1 : -1;
        for (var index = 0; index < segmentCount; index += 1) {
            curveAngle += (sign * step) % LINEAGE_PI2;
            lineData.push({ angle: curveAngle, radius: radCurveLine });
        }

        lineData.push({ angle: endAngle, radius: radCurveLine });
        lineData.push({ angle: targetA, radius: targetRadius });

        return d3.lineRadial()
            .angle(function (d) { return d.angle; })
            .radius(function (d) { return d.radius; })
            .curve(d3.curveBasis)
            (lineData);
    }


    function createOrUpdateSidebar(data) {
        var tuning = lineageState.tuning;
        var viewConfig = getActiveViewConfig();
        var gallery = document.getElementById("lineage-gallery");
        if (!gallery) return;

        gallery.innerHTML = "";
        var fragment = document.createDocumentFragment();
        var meaningPrefix = cleanText(viewConfig.meaningPrefix) || tuning.text.meaningPrefix;
        var meaningFallback = cleanText(viewConfig.meaningFallback) || tuning.text.meaningFallback;

        data.variantNodes.forEach(function (variantNode) {
            var card = createElement("article", "lineage-card");
            card.setAttribute("data-variant-id", variantNode.id);
            card.setAttribute("data-type-id", variantNode.parentId);
            card.setAttribute("role", "button");
            card.setAttribute("tabindex", 0);
            card.setAttribute("aria-label", "查看“" + variantNode.label + "”图录放大预览");

            card.addEventListener("click", function () {
                toggleCardPreview(card);
            });
            card.addEventListener("keydown", function (event) {
                if (!event) return;
                var key = event.key;
                if (key === "Enter" || key === " " || key === "Spacebar") {
                    event.preventDefault();
                    toggleCardPreview(card);
                }
            });

            var imageWrap = createElement("div", "lineage-card-image-wrap");
            var image = createElement("img", "lineage-card-image");
            image.alt = variantNode.label;
            image.loading = "lazy";
            image.decoding = "async";
            imageWrap.appendChild(image);

            var body = createElement("div", "lineage-card-body");
            var introductionText = cleanText(variantNode.introduction) || tuning.text.introductionFallback;
            var meaningText = cleanText(variantNode.meaning) || meaningFallback;
            var buildingsText = cleanText(variantNode.buildings) || tuning.text.buildingsFallback;

            body.appendChild(createElement("h3", "lineage-card-title", variantNode.label));
            body.appendChild(createElement("p", "lineage-card-meta", variantNode.parentLabel));
            body.appendChild(createElement("p", "lineage-card-field lineage-card-meaning", meaningPrefix + meaningText));
            body.appendChild(createElement("p", "lineage-card-field lineage-card-buildings", tuning.text.buildingsPrefix + buildingsText));
            body.appendChild(createElement("p", "lineage-card-introduction", introductionText));

            card.appendChild(imageWrap);
            card.appendChild(body);
            fragment.appendChild(card);

            applyImageFallback(image, buildImageCandidates(variantNode, viewConfig), 0);
        });

        gallery.appendChild(fragment);
        lineageState.sidebarCards = Array.prototype.slice.call(gallery.querySelectorAll(".lineage-card"));
    }

    function nodeIsRelated(node, focusNode) {
        if (!focusNode || focusNode.level === 0) return true;
        if (focusNode.level === 1) return node.id === "center" || node.id === focusNode.id || node.parentId === focusNode.id;
        if (focusNode.level === 2) return node.id === "center" || node.id === focusNode.parentId || node.id === focusNode.id;
        return true;
    }

    function linkIsRelated(link, focusNode) {
        if (!focusNode || focusNode.level === 0) return true;
        if (focusNode.level === 1) return (link.source === "center" && link.target === focusNode.id) || link.source === focusNode.id;
        if (focusNode.level === 2) return (link.source === focusNode.parentId && link.target === focusNode.id) || (link.source === "center" && link.target === focusNode.parentId);
        return true;
    }

    function setRelationClasses(selection, isRelatedFn, isActiveFn) {
        selection
            .classed("is-dim", function (d) { return !isRelatedFn(d); })
            .classed("is-active", function (d) { return !!isActiveFn(d); });
    }

    function updateSidebarFocus(focusNode) {
        var tuning = lineageState.tuning;
        if (!lineageState.sidebarCards || !lineageState.sidebarCards.length) return;

        var focusTextElement = document.getElementById("lineage-sidebar-focus");
        if (focusTextElement) {
            var focusLabel = (!focusNode || focusNode.level === 0) ? tuning.text.allVariantsLabel : focusNode.label;
            focusTextElement.textContent = tuning.text.focusPrefix + focusLabel;
        }

        lineageState.sidebarCards.forEach(function (card) {
            var variantId = card.getAttribute("data-variant-id");
            var typeId = card.getAttribute("data-type-id");
            var visible = true;
            var active = false;

            if (focusNode && focusNode.level === 1) {
                visible = typeId === focusNode.id;
                active = visible;
            } else if (focusNode && focusNode.level === 2) {
                visible = variantId === focusNode.id;
                active = visible;
            }

            card.classList.toggle("is-hidden", !visible);
            card.classList.toggle("is-active", active);
        });
    }

    function resolvePinnedNode(data) { return data.nodeById[lineageState.pinnedNodeId] || data.centerNode; }

    function updateRadialFocusStyles(context, activeNode) {
        if (!context || !context.data || !context.data.layout) return;

        var layout = context.data.layout;
        context.nodeSelection.each(function (node) {
            var group = d3.select(this);
            var active = node.id === activeNode.id;
            var relatedVariant = node.level === 2 && activeNode.level === 1 && node.parentId === activeNode.id;

            group.select(".lineage-type-hover-circle")
                .style("opacity", active && node.level === 1 ? 1 : 0);

            group.select(".lineage-type-dot")
                .attr("r", layout.typeDotRadius * (active && node.level === 1 ? 1.5 : 1))
                .style("stroke-width", (3 * layout.sizeFactor) * (active && node.level === 1 ? 1.5 : 1));

            group.select(".lineage-variant-dot")
                .attr("r", layout.variantDotRadius * ((active || relatedVariant) ? 1.5 : 1))
                .style("stroke-width", (layout.variantDotRadius * 0.5) * ((active || relatedVariant) ? 1.5 : 1))
                .style("fill", function () {
                    return node.color || "#c4c4c4";
                });
        });

        if (context.linkSelection) {
            context.linkSelection
                .style("opacity", function (link) {
                    if (activeNode.level === 0) return 0.3;//衍生谱系连线默认透明度
                    return linkIsRelated(link, activeNode) ? 1 : 0.25;
                })
                .style("stroke-width", function (link) {
                    var active = linkIsRelated(link, activeNode) && activeNode.level !== 0;
                    var base = link.level === 1
                        ? Math.max(3.2, 5.0 * layout.sizeFactor)
                        : Math.max(3.6, 5.6 * layout.sizeFactor);//谱系图连线粗细
                    return (active ? base * 1.28 : base) + "px";
                });
        }

        if (context.ringSelection) {
            setRelationClasses(
                context.ringSelection,
                function (typeNode) {
                    if (!activeNode || activeNode.level === 0) return true;
                    if (activeNode.level === 1) return typeNode.id === activeNode.id;
                    if (activeNode.level === 2) return typeNode.id === activeNode.parentId;
                    return true;
                },
                function (typeNode) {
                    if (!activeNode) return false;
                    return activeNode.level === 1
                        ? typeNode.id === activeNode.id
                        : activeNode.level === 2 && typeNode.id === activeNode.parentId;
                }
            );
        }

        if (context.guideText && context.guidePath && context.guideArc) {
            var guideAngle = context.data.typeNodes.length ? context.data.typeNodes[0].nameAngle : 0;
            var guideText = "彩色连线展示了类型与变体之间的衍生关系";
            if (activeNode.level === 1) {
                guideAngle = activeNode.nameAngle || activeNode.angle || guideAngle;
                guideText = activeNode.label + "：" + (activeNode.count || 0) + "个变体";
            } else if (activeNode.level === 2) {
                guideAngle = activeNode.centerAngle || activeNode.angle || guideAngle;
                guideText = activeNode.parentLabel + " → " + activeNode.label;
            }
            context.guidePath.attr("d", context.guideArc(guideAngle));
            context.guideText.text(guideText);
        }
    }

    function applyFocus(focusNode) {
        var context = lineageState.renderContext;
        if (!context) return;

        var activeNode = focusNode || resolvePinnedNode(context.data);

        setRelationClasses(
            context.nodeSelection,
            function (node) { return nodeIsRelated(node, activeNode); },
            function (node) { return node.id === activeNode.id; }
        );

        setRelationClasses(
            context.labelSelection,
            function (node) { return nodeIsRelated(node, activeNode); },
            function (node) { return node.id === activeNode.id; }
        );

        setRelationClasses(
            context.linkSelection,
            function (link) { return linkIsRelated(link, activeNode); },
            function (link) { return linkIsRelated(link, activeNode); }
        );

        setRelationClasses(
            context.linkShadowSelection,
            function (link) { return linkIsRelated(link, activeNode); },
            function (link) { return linkIsRelated(link, activeNode); }
        );

        updateRadialFocusStyles(context, activeNode);
        updateSidebarFocus(activeNode);
    }

    function appendLinearGradient(defs, id, stops) {
        var gradient = defs.append("linearGradient")
            .attr("id", id)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");

        (Array.isArray(stops) ? stops : []).forEach(function (stop) {
            gradient.append("stop")
                .attr("offset", stop.offset)
                .attr("stop-color", stop.color);
        });
    }

    function getActiveViewGradients() {
        var baseGradients = isPlainObject(lineageState.tuning.gradients) ? lineageState.tuning.gradients : {};
        var viewConfig = getActiveViewConfig();
        var viewGradients = isPlainObject(viewConfig.gradients) ? viewConfig.gradients : {};
        return mergeConfig(baseGradients, viewGradients);
    }

    function renderRingsAndTrend(chart) {
        return chart.append("g")
            .attr("class", "lineage-ring-layer")
            .selectAll(".lineage-ring-placeholder")
            .data([]);
    }

    function renderLineageGuideLabel(chart, data) {
        var layout = data.layout;
        var guideLayer = chart.append("g").attr("class", "lineage-line-label-group");
        var guidePathId = "lineage-line-label-path";

        function guideArc(angle) {
            var x1 = polarX(layout.radLineLabel, angle + 0.01);
            var y1 = polarY(layout.radLineLabel, angle + 0.01);
            var x2 = polarX(layout.radLineLabel, angle - 0.01);
            var y2 = polarY(layout.radLineLabel, angle - 0.01);
            if (normalizeAngle(angle) > Math.PI / 2 && normalizeAngle(angle) < Math.PI * 1.5) {
                return "M" + x1 + "," + y1 + " A" + layout.radLineLabel + "," + layout.radLineLabel + " 0 1 1 " + x2 + "," + y2;
            }
            return "M" + x2 + "," + y2 + " A" + layout.radLineLabel + "," + layout.radLineLabel + " 0 1 0 " + x1 + "," + y1;
        }

        var initialAngle = data.typeNodes.length ? data.typeNodes[0].nameAngle : 0;
        var guidePath = guideLayer.append("path")
            .attr("class", "lineage-line-label-path")
            .attr("id", guidePathId)
            .attr("d", guideArc(initialAngle))
            .style("fill", "none")
            .style("display", "none");

        var guideText = guideLayer.append("text")
            .attr("class", "lineage-line-label")
            .attr("dy", "0.35em")
            .style("text-anchor", "middle")
            .style("font-size", layout.guideFontSize + "px")
            .append("textPath")
            .attr("xlink:href", "#" + guidePathId)
            .attr("startOffset", "50%")
            .text("彩色连线展示了类型与变体之间的衍生关系");

        return {
            guidePath: guidePath,
            guideText: guideText,
            guideArc: guideArc
        };
    }

    function renderLinks(linkLayer, data) {
        var layout = data.layout;
        var renderedLinks = data.links.map(function (link) {
            var targetNode = data.nodeById[link.target];
            var sourceNode = data.nodeById[link.source];
            var path = "";
            var color = (targetNode && targetNode.color) || (sourceNode && sourceNode.color) || null;

            if (link.level === 1 && targetNode) {
                path = buildRadialConnectionPath(
                    targetNode.nameAngle || targetNode.angle || 0,
                    Math.max(4, layout.radCenterHit * 0.38),
                    targetNode.nameAngle || targetNode.angle || 0,
                    targetNode.dotNameRadius || layout.radName,
                    layout,
                    link.level
                );
            } else if (sourceNode && targetNode) {
                path = buildRadialConnectionPath(
                    sourceNode.nameAngle || sourceNode.angle || 0,
                    sourceNode.dotNameRadius || layout.radName,
                    targetNode.centerAngle || targetNode.angle || 0,
                    targetNode.radialRadius || layout.radVariantDot,
                    layout,
                    link.level
                );
            }

            return {
                id: link.id,
                level: link.level,
                source: link.source,
                target: link.target,
                path: path,
                color: color/*连线颜色*/
            };
        });

        /* CCS-SVG 同款主关系线不再绘制投影，用空选择占位保持接口兼容 */
        var linkShadowSelection = linkLayer.selectAll(".lineage-link-shadow").data([]);

        var linkSelection = linkLayer.selectAll(".lineage-link").data(renderedLinks).enter().append("path")
            .attr("class", function (d) { return "lineage-link lineage-link-level-" + d.level; })
            .attr("d", function (d) { return d.path; })
            .style("stroke", function (d) { return d.color; })
            .style("stroke-width", function (d) {
                return (d.level === 1
                    ? Math.max(3.2, 5.0 * layout.sizeFactor)
                    : Math.max(3.2, 5.0 * layout.sizeFactor)
                ) + "px";
            })
            .style("opacity", 0.7);

        return { linkSelection: linkSelection, linkShadowSelection: linkShadowSelection };
    }

    function nodeAriaLabel(node) {
        var viewConfig = getActiveViewConfig();
        if (node.level === 0) return "中心节点：" + node.label;
        if (node.level === 1) {
            var typePrefix = cleanText(viewConfig.typeNodeLabelPrefix) || "属性类型：";
            return typePrefix + node.label;
        }
        var variantPrefix = cleanText(viewConfig.variantNodeLabelPrefix) || "变体：";
        return variantPrefix + node.label;
    }
    function nodeGradientFill(node) {
        if (node.level === 0) return "url(#lineage-gradient-center)";
        /*if (node.color) return "url(#lineage-gradient-type)";与中心同色*/
        if (node.color) return "url(#lineage-gradient-node-" + node.id + ")";
        return "url(#lineage-gradient-variant)";/*节点颜色*/
    }



    function renderNodes(chart, data) {
        var layout = data.layout;
        var nodeLayer = chart.append("g").attr("class", "lineage-nodes");

        var centerNodeSelection = nodeLayer.selectAll(".lineage-center-node")
            .data([data.centerNode])
            .enter().append("g")
            .attr("class", "lineage-node lineage-node-level-0 lineage-center-node")
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("aria-label", nodeAriaLabel);

        centerNodeSelection.append("circle")
            .attr("class", "lineage-center-hit")
            .attr("r", layout.radCenterHit)
            .style("fill", "transparent")
            .style("pointer-events", "all");

        var centerTitle = cleanText(data.centerNode.label);
        centerNodeSelection.append("text")
            .attr("class", "lineage-center-text lineage-center-title")
            .attr("x", 0)
            .attr("y", 0)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-size", layout.centerTitleFontSize + "px")
            .text(centerTitle);

        var typeNodeSelection = nodeLayer.selectAll(".lineage-type-node")
            .data(data.typeNodes)
            .enter().append("g")
            .attr("class", "lineage-node lineage-node-level-1 lineage-type-node")
            .attr("transform", function (d) { return "translate(" + d.chartX + "," + d.chartY + ")"; })
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("aria-label", nodeAriaLabel);

        typeNodeSelection.append("circle")
            .attr("class", "lineage-hover-circle lineage-type-hover-circle")
            .attr("r", Math.max(24, 44 * layout.sizeFactor))
            .style("fill", function (d) { return d.color; })
            .style("fill-opacity", 0.3)
            .style("opacity", 0);

        typeNodeSelection.append("circle")
            .attr("class", "lineage-node-core lineage-type-dot")
            .attr("r", layout.typeDotRadius)
            .style("fill", function (d) { return d.color; })
            .style("stroke", "white")
            .style("stroke-width", 3 * layout.sizeFactor);

        typeNodeSelection.append("circle")
            .attr("class", "lineage-node-hit")
            .attr("r", Math.max(24, 44 * layout.sizeFactor))//hover命中圈
            .style("fill", "transparent")
            .style("pointer-events", "all");

        var variantNodeSelection = nodeLayer.selectAll(".lineage-variant-node")
            .data(data.variantNodes)
            .enter().append("g")
            .attr("class", "lineage-node lineage-node-level-2 lineage-variant-node")
            .attr("transform", function (d) { return "translate(" + d.chartX + "," + d.chartY + ")"; })
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("aria-label", nodeAriaLabel);

        variantNodeSelection.append("circle")
            .attr("class", "lineage-node-core lineage-variant-dot")
            .attr("r", layout.variantDotRadius)
            .style("fill", function (d) { return d.color || "#c4c4c4"; })
            .style("stroke", "white")
            .style("stroke-width", layout.variantDotRadius * 0.5);

        variantNodeSelection.append("circle")
            .attr("class", "lineage-node-hit")
            .attr("r", Math.max(15, 22 * layout.sizeFactor))//变体节点命中圈
            .style("fill", "transparent")
            .style("pointer-events", "all");

        return nodeLayer.selectAll(".lineage-node");
    }

    function radialTextTransform(angle, radius) {
        return "rotate(" + (angle * 180 / Math.PI - 90) + ")"
            + "translate(" + radius + ")"
            + (isRightSideAngle(angle) ? "" : "rotate(180)");
    }

    function buildReadableArcPath(radius, startAngle, endAngle) {
        var span = Math.max(0.001, Math.abs(endAngle - startAngle));
        var centerAngle = normalizeAngle((startAngle + endAngle) / 2);
        var largeArc = span > Math.PI ? 1 : 0;

        var xStart = polarX(radius, startAngle);
        var yStart = polarY(radius, startAngle);
        var xEnd = polarX(radius, endAngle);
        var yEnd = polarY(radius, endAngle);

        // 这段弧的 endAngle 是靠近节点的一端。
        // 上半圈：路径从 startAngle 到 endAngle，节点端在 100%。
        // 下半圈：路径反向从 endAngle 到 startAngle，节点端在 0%，避免文字倒置。
        if (centerAngle > Math.PI / 2 && centerAngle < Math.PI * 1.5) {
            return {
                path: "M" + xEnd + "," + yEnd +
                    " A" + radius + "," + radius +
                    " 0 " + largeArc + " 0 " + xStart + "," + yStart,
                startOffset: "0%",
                textAnchor: "start"
            };
        }

        return {
            path: "M" + xStart + "," + yStart +
                " A" + radius + "," + radius +
                " 0 " + largeArc + " 1 " + xEnd + "," + yEnd,
            startOffset: "100%",
            textAnchor: "end"
        };
    }

    function buildCounterClockwiseTypeLabelPath(typeNode, radius, text, fontSize, gapAngle, padding) {
        var width = estimateLabelWidth(text, fontSize) + padding;
        var span = Math.max(0.18, Math.min(Math.PI * 0.55, width / Math.max(radius, 1)));

        // endAngle 是靠近节点的位置。
        // startAngle 比 endAngle 更小，所以整段文字位于节点逆时针方向。
        var endAngle = (typeNode.nameAngle || 0) - gapAngle;
        var startAngle = endAngle - span;

        return buildReadableArcPath(radius, startAngle, endAngle);
    }

    function renderLabels(chart, data) {
        var layout = data.layout;
        var labelLayer = chart.append("g").attr("class", "lineage-labels lineage-radial-labels");
        var typeLabelPrimaryRadius = layout.radName + 8 * layout.sizeFactor;
        var typeLabelSecondaryRadius = Math.max(layout.radName - 8 * layout.sizeFactor, layout.typeLabelSubFontSize + 12 * layout.sizeFactor);
        var typeLabelGapAngle = 0.18;//弧线排版文字起点

        data.typeNodes.forEach(function (typeNode) {
            var primaryPath = buildCounterClockwiseTypeLabelPath(
                typeNode,
                typeLabelPrimaryRadius,
                typeNode.firstName,
                layout.typeLabelFontSize,
                typeLabelGapAngle,
                18 * layout.sizeFactor
            );

            var secondaryPath = buildCounterClockwiseTypeLabelPath(
                typeNode,
                typeLabelSecondaryRadius,
                typeNode.lastName,
                layout.typeLabelSubFontSize,
                typeLabelGapAngle + 0.016,
                12 * layout.sizeFactor
            );

            typeNode.primaryLabelPathId = "lineage-type-label-path-" + typeNode.id;
            typeNode.secondaryLabelPathId = "lineage-type-sub-label-path-" + typeNode.id;

            typeNode.primaryLabelPath = primaryPath.path;
            typeNode.primaryLabelStartOffset = primaryPath.startOffset;
            typeNode.primaryLabelTextAnchor = primaryPath.textAnchor;

            typeNode.secondaryLabelPath = secondaryPath.path;
            typeNode.secondaryLabelStartOffset = secondaryPath.startOffset;
            typeNode.secondaryLabelTextAnchor = secondaryPath.textAnchor;
        });

        var typeLabelSelection = labelLayer.selectAll(".lineage-type-label")
            .data(data.typeNodes)
            .enter().append("g")
            .attr("class", "lineage-label lineage-label-level-1 lineage-type-label")
            .style("font-family", "Anime Ace")
            .style("font-weight", "normal");
            

        typeLabelSelection.append("path")
            .attr("class", "lineage-type-label-path lineage-type-name-label-path")
            .attr("id", function (d) { return d.primaryLabelPathId; })
            .attr("d", function (d) { return d.primaryLabelPath; })
            .style("fill", "none")
            .style("display", "none");

        typeLabelSelection.append("text")
            .attr("class", "lineage-label-text lineage-name-label")
            .attr("id", function (d) { return "lineage-name-label-" + d.id; })
            .style("font-size", layout.typeLabelFontSize + "px")
            .style("text-anchor", function (d) { return d.primaryLabelTextAnchor; })
            .append("textPath")
            .attr("xlink:href", function (d) { return "#" + d.primaryLabelPathId; })
            .attr("startOffset", function (d) { return d.primaryLabelStartOffset; })
            .text(function (d) { return d.firstName; });

        typeLabelSelection.append("path")
            .attr("class", "lineage-type-label-path lineage-type-sub-label-path")
            .attr("id", function (d) { return d.secondaryLabelPathId; })
            .attr("d", function (d) { return d.secondaryLabelPath; })
            .style("fill", "none")
            .style("display", "none");

        typeLabelSelection.append("text")
            .attr("class", "lineage-label-text lineage-last-name-label")
            .attr("id", function (d) { return "lineage-last-name-label-" + d.id; })
            .style("font-size", layout.typeLabelSubFontSize + "px")
            .style("text-anchor", function (d) { return d.secondaryLabelTextAnchor; })
            .append("textPath")
            .attr("xlink:href", function (d) { return "#" + d.secondaryLabelPathId; })
            .attr("startOffset", function (d) { return d.secondaryLabelStartOffset; })
            .text(function (d) { return d.lastName; });

        var variantLabelSelection = labelLayer.selectAll(".lineage-variant-label")
            .data(data.variantNodes)
            .enter().append("g")
            .attr("class", "lineage-label lineage-label-level-2 lineage-variant-label")
            .style("text-anchor", function (d) { return isRightSideAngle(d.centerAngle) ? "start" : "end"; });

        variantLabelSelection.append("text")
            .attr("class", "lineage-label-text lineage-card-label")
            .attr("dy", ".35em")
            .attr("transform", function (d) { return radialTextTransform(d.centerAngle, layout.radVariantLabel); })
            .style("font-size", layout.variantLabelFontSize + "px")
            .text(function (d) { return d.displayLabel || d.label; });

        return labelLayer.selectAll(".lineage-label");
    }

    function measureTypeLabelDots(data) {
        var layout = data.layout;
        data.typeNodes.forEach(function (typeNode) {
            var firstNode = document.getElementById("lineage-name-label-" + typeNode.id);
            var lastNode = document.getElementById("lineage-last-name-label-" + typeNode.id);
            var firstWidth = safeSvgTextLength(firstNode, typeNode.firstName, layout.typeLabelFontSize);
            var lastWidth = safeSvgTextLength(lastNode, typeNode.lastName, layout.typeLabelSubFontSize);
            /*var measuredRadius = layout.radName + Math.max(firstWidth, lastWidth) + 6 * layout.sizeFactor;
            var maxRadius = Math.max(layout.radName + 10 * layout.sizeFactor, layout.radVariantDot - 24 * layout.sizeFactor);
            */
            typeNode.dotNameRadius = layout.radName;
            typeNode.chartX = polarX(typeNode.dotNameRadius, typeNode.nameAngle);
            typeNode.chartY = polarY(typeNode.dotNameRadius, typeNode.nameAngle);
            typeNode.x = layout.centerX + typeNode.chartX;
            typeNode.y = layout.centerY + typeNode.chartY;
        });
    }

    function bindInteractions(nodeSelection, svg, data) {
        nodeSelection.on("mouseenter", function (d) { applyFocus(d); });
        nodeSelection.on("mouseleave", function () { applyFocus(resolvePinnedNode(data)); });
        nodeSelection.on("focus", function (d) { applyFocus(d); });
        nodeSelection.on("blur", function () { applyFocus(resolvePinnedNode(data)); });

        nodeSelection.on("keydown", function (d) {
            var event = d3.event;
            if (!event) return;
            var key = event.key;
            if (key === "Enter" || key === " " || key === "Spacebar") {
                event.preventDefault();
                lineageState.pinnedNodeId = d.id;
                applyFocus(d);
            }
        });

        nodeSelection.on("click", function (d) {
            d3.event.stopPropagation();
            lineageState.pinnedNodeId = d.id;
            applyFocus(d);
        });

        svg.on("click", function () {
            lineageState.pinnedNodeId = "center";
            applyFocus(data.centerNode);
        });
    }

    function renderLineageGraph(data, width, height) {
        var graphHost = d3.select("#lineage-graph");
        graphHost.selectAll("*").remove();

        computeLayout(data, width, height);

        var svg = graphHost.append("svg")
            .attr("class", "lineage-svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", "0 0 " + width + " " + height)
            .attr("aria-hidden", "true");

        var activeGradients = getActiveViewGradients();
        var defs = svg.append("defs");
        appendLinearGradient(defs, "lineage-gradient-center", activeGradients.center);
        appendLinearGradient(defs, "lineage-gradient-type", activeGradients.type);
        appendLinearGradient(defs, "lineage-gradient-variant", activeGradients.variant);

        /* 为每个带 color 的节点生成与中心节点同结构的渐变（浅 → 深，上 → 下） */
        data.nodes.forEach(function (node) {
            if (!node.color) return;
            var base = d3.rgb(node.color);
            var light = d3.rgb(
                Math.min(255, base.r + (255 - base.r) * 0.72),
                Math.min(255, base.g + (255 - base.g) * 0.72),
                Math.min(255, base.b + (255 - base.b) * 0.72)
            );
            var dark = base.darker(0.3);
            appendLinearGradient(defs, "lineage-gradient-node-" + node.id, [
                { offset: "0%",   color: light.toString() },
                { offset: "100%", color: dark.toString() }
            ]);
        });


        var chart = svg.append("g")
            .attr("class", "lineage-radial-root")
            .attr("transform", "translate(" + data.layout.centerX + "," + data.layout.centerY + ")");

        var linkLayer = chart.append("g").attr("class", "lineage-links");
        var ringSelection = renderRingsAndTrend(chart);
        var guideLabel = renderLineageGuideLabel(chart, data);
        var labelSelection = renderLabels(chart, data);
        measureTypeLabelDots(data);

        var linkSelections = renderLinks(linkLayer, data);
        var nodeSelection = renderNodes(chart, data);

        bindInteractions(nodeSelection, svg, data);

        lineageState.renderContext = {
            data: data,
            nodeSelection: nodeSelection,
            labelSelection: labelSelection,
            linkSelection: linkSelections.linkSelection,
            linkShadowSelection: linkSelections.linkShadowSelection,
            ringSelection: ringSelection,
            guidePath: guideLabel.guidePath,
            guideText: guideLabel.guideText,
            guideArc: guideLabel.guideArc
        };

        applyFocus(resolvePinnedNode(data));
    }

    function createLineageGraph() {
        var tuning = lineageState.tuning;
        var requestedView = lineageState.activeView;

        bindViewSwitchButtons();
        updateViewToggleButtons();
        updateGraphAriaLabel();

        ensureLineageData(requestedView, function (error, data) {
            if (error) {
                console.error("衍生谱系数据加载失败：", error);
                return;
            }

            // 如果在加载期间切换了 tab，则忽略旧回调
            if (requestedView !== lineageState.activeView) return;

            createOrUpdateSidebar(data);

            var graphElement = document.getElementById("lineage-graph");
            var container = document.getElementById("lineage-container");
            if (!graphElement || !container) return;

            var hostRect = graphElement.getBoundingClientRect();
            var layoutScale = typeof window.APP_LAYOUT_SCALE === "number" && window.APP_LAYOUT_SCALE > 0
                ? window.APP_LAYOUT_SCALE
                : 1;
            var virtualWidth = hostRect.width / layoutScale;
            var virtualHeight = hostRect.height / layoutScale;
            var isActive = container.classList.contains("is-active");
            var tooSmall = virtualWidth < tuning.data.minRenderWidth || virtualHeight < tuning.data.minRenderHeight;

            if (tooSmall) {
                if (isActive) {
                    if (lineageState.pendingRenderTimer) window.clearTimeout(lineageState.pendingRenderTimer);
                    lineageState.pendingRenderTimer = window.setTimeout(function () {
                        lineageState.pendingRenderTimer = null;
                        createLineageGraph();
                    }, tuning.data.renderRetryDelay);
                }
                return;
            }

            renderLineageGraph(data, Math.round(virtualWidth), Math.round(virtualHeight));
        });
    }

    window.LINEAGE_TUNING_EFFECTIVE = lineageState.tuning;
    window.create_apron_lineage_graph = createLineageGraph;
    window.create_lineage_graph = createLineageGraph;
    window.set_lineage_view = function (viewKey) {
        setLineageView(viewKey || lineageState.activeView);
    };
})();
