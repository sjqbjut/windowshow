(function () {
    var ORIGIN_WIDTH = 1235;
    var ORIGIN_HEIGHT = 584;

    // 裁剪定位：o1~o5 在 origin.png 中的精确像素位置
    var REGIONS = {
        o1: { x: 457, y: 271, w: 317, h: 286 },
        o2: { x: 698, y: 273, w: 74, h: 282 },
        o3: { x: 700, y: 294, w: 64, h: 135 },
        o4: { x: 698, y: 429, w: 73, h: 24 },
        o5: { x: 700, y: 453, w: 63, h: 60 }
    };

    var COPY = {
        step1: "这里是一面朱红庄严的殿墙",
        step2: "墙的整个开间，被一槽精致的木结构填满。这便是一组四扇并立的隔扇门。",
        step3: "每个隔扇门，都遵循着“天、地、人”的竖向划分。",
        step4a: "这是隔心，其骨架便是繁复的窗棂。窗棂纵横交织，构成各种纹样和图案。",
        step4b: "中间是绦环板，如同一条雅致的腰带。",
        step4c: "最下方是裙板。裙板素面或雕刻，厚重而稳固，沉稳地承载着窗棂的端庄。"
    };

    var STEP_FOCUS_SCALE = 2.28;
    // 打字机速度（毫秒/字）
    var TYPE_SPEED = {
        step1: 60,
        normal: 60,
        detail: 60
    };
    var STEP4_SEQUENCE = [
        { key: "o3", text: COPY.step4a },
        { key: "o4", text: COPY.step4b },
        { key: "o5", text: COPY.step4c }
    ];

    // 动画运行状态：步骤、并发令牌、回放状态
    var state = {
        initialized: false,
        started: false,
        completed: false,
        replayBusy: false,
        mode: "idle",
        runToken: 0,
        focusKey: "",
        focusScale: 1,
        resizeQueued: false,
        step4Index: -1,
        step4Busy: false
    };

    // 页面节点缓存，避免重复查询 DOM
    var dom = {
        container: null,
        stage: null,
        world: null,
        base: null,
        copy: null,
        continueHint: null,
        replay: null,
        replayButtons: {},
        action: null,
        overlays: {}
    };

    function ratioToPercent(value) {
        var percent = value * 100;
        return percent.toFixed(6).replace(/\.?0+$/, "") + "%";
    }

    function applyRegionStyle(layer, region) {
        if (!layer || !region) return;
        layer.style.left = ratioToPercent(region.x / ORIGIN_WIDTH);
        layer.style.top = ratioToPercent(region.y / ORIGIN_HEIGHT);
        layer.style.width = ratioToPercent(region.w / ORIGIN_WIDTH);
        layer.style.height = ratioToPercent(region.h / ORIGIN_HEIGHT);
    }

    function setCopyInstant(text) {
        if (!dom.copy) return;
        dom.copy.textContent = text || "";
    }

    function setContinueHintVisible(visible) {
        if (!dom.continueHint) return;
        var shouldShow = !!visible && state.started && !state.completed;
        dom.continueHint.classList.toggle("is-visible", shouldShow);
        dom.continueHint.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    }

    function wait(ms) {
        return new Promise(function (resolve) {
            window.setTimeout(resolve, ms);
        });
    }

    function currentRunToken() {
        // 每次新流程递增令牌，用于取消旧异步链
        state.runToken += 1;
        return state.runToken;
    }

    function runIsActive(token) {
        return token === state.runToken;
    }

    async function typeCopy(text, token, speed) {
        // 打字机输出：若令牌失效则中断
        if (!dom.copy) return false;
        var raw = text || "";
        var interval = speed || 44;
        dom.copy.textContent = "";
        for (var i = 0; i < raw.length; i += 1) {
            if (!runIsActive(token)) return false;
            dom.copy.textContent += raw.charAt(i);
            await wait(interval);
        }
        return runIsActive(token);
    }

    function setBaseVisible(visible) {
        if (!dom.base) return;
        dom.base.classList.toggle("is-hidden", !visible);
    }

    function setActionVisible(visible) {
        if (!dom.action) return;
        dom.action.classList.toggle("is-visible", !!visible);
    }

    function setReplayVisible(visible) {
        if (!dom.replay) return;
        dom.replay.classList.toggle("is-visible", !!visible);
    }

    function eachOverlay(fn) {
        Object.keys(dom.overlays).forEach(function (key) {
            fn(dom.overlays[key], key);
        });
    }

    function setVisibleLayers(keys) {
        var map = {};
        (keys || []).forEach(function (key) {
            map[key] = true;
        });
        eachOverlay(function (layer, key) {
            var visible = !!map[key];
            layer.classList.toggle("is-visible", visible);
            if (!visible) {
                layer.classList.remove("is-target", "is-auto-highlight", "is-pulse", "is-remind");
                layer.disabled = true;
            }
        });
    }

    function clearLayerHighlights() {
        eachOverlay(function (layer) {
            layer.classList.remove("is-target", "is-auto-highlight", "is-pulse", "is-remind");
            layer.disabled = true;
        });
    }

    function setInteractiveTarget(key, options) {
        // 可点击目标：用于“闪烁提醒并等待点击”
        clearLayerHighlights();
        if (!key || !dom.overlays[key]) return;
        var opts = options || {};
        var layer = dom.overlays[key];
        layer.classList.add("is-target");
        if (opts.pulse) layer.classList.add("is-pulse");
        if (opts.remind) layer.classList.add("is-pulse", "is-remind", "is-auto-highlight");
        layer.disabled = false;
    }

    function setSteadyHighlight(key) {
        // 稳定高亮：用于点击后文字播放期间
        clearLayerHighlights();
        if (!key || !dom.overlays[key]) return;
        var layer = dom.overlays[key];
        layer.classList.add("is-auto-highlight");
        layer.disabled = true;
    }

    function setBlinkHighlight(key) {
        // 闪烁高亮：用于回放态提示
        clearLayerHighlights();
        if (!key || !dom.overlays[key]) return;
        var layer = dom.overlays[key];
        layer.classList.add("is-auto-highlight", "is-pulse", "is-remind");
        layer.disabled = true;
    }

    function setSequenceHighlight(key) {
        setSteadyHighlight(key);
    }

    function applyFocusTransform() {
        // 聚焦镜头：把目标区域移动/缩放到视觉中心
        if (!dom.world || !dom.stage) return;
        var key = state.focusKey;
        var scale = state.focusScale || 1;
        if (!key || !REGIONS[key]) {
            dom.world.style.transform = "translate(0px, 0px) scale(1)";
            return;
        }
        var safeScale = scale > 0 ? scale : 1;

        var region = REGIONS[key];
        // The page uses a global body scale transform, so prefer unscaled layout size.
        var stageW = dom.stage.clientWidth || dom.stage.offsetWidth || 0;
        var stageH = dom.stage.clientHeight || dom.stage.offsetHeight || 0;
        if (!stageW || !stageH) {
            var stageRect = dom.stage.getBoundingClientRect();
            var layoutScale = (typeof window.APP_LAYOUT_SCALE === "number" && window.APP_LAYOUT_SCALE > 0)
                ? window.APP_LAYOUT_SCALE
                : 1;
            stageW = stageRect.width / layoutScale;
            stageH = stageRect.height / layoutScale;
        }
        if (!stageW || !stageH) return;

        var regionCenterX = ((region.x + region.w / 2) / ORIGIN_WIDTH) * stageW;
        var regionCenterY = ((region.y + region.h / 2) / ORIGIN_HEIGHT) * stageH;
        var tx = stageW / 2 - regionCenterX * safeScale;
        var ty = stageH / 2 - regionCenterY * safeScale;
        dom.world.style.transform = "translate(" + tx.toFixed(3) + "px, " + ty.toFixed(3) + "px) scale(" + safeScale + ")";
    }

    function setFocus(key, scale) {
        state.focusKey = key || "";
        state.focusScale = scale || 1;
        applyFocusTransform();
    }

    function resetStepFourState() {
        state.step4Index = -1;
        state.step4Busy = false;
    }

    function setStepOneVisual() {
        // Step1：整体视图 + o1 可点击提醒
        state.mode = "step1";
        state.replayBusy = false;
        resetStepFourState();
        setBaseVisible(true);
        setVisibleLayers(["o1"]);
        setFocus("", 1);
        clearLayerHighlights();
        setContinueHintVisible(false);
        setReplayVisible(false);
        setActionVisible(false);
    }

    function setStepTwoVisual() {
        // Step2：聚焦 o1，准备引导 o2
        state.mode = "step2";
        resetStepFourState();
        setBaseVisible(false);
        setVisibleLayers(["o1", "o2"]);
        setFocus("o1", STEP_FOCUS_SCALE);
        clearLayerHighlights();
        setContinueHintVisible(false);
        setReplayVisible(false);
        setActionVisible(false);
    }

    function setStepThreeVisual() {
        // Step3：聚焦 o2，讲述“天地人”分层
        state.mode = "step3";
        resetStepFourState();
        setBaseVisible(false);
        setVisibleLayers(["o1", "o2"]);
        setFocus("o2", STEP_FOCUS_SCALE);
        clearLayerHighlights();
        setContinueHintVisible(false);
        setReplayVisible(false);
        setActionVisible(false);
    }

    function setStepFourVisual() {
        // Step4：进入 o3/o4/o5 的逐段讲解状态
        state.mode = "step4";
        setBaseVisible(false);
        setVisibleLayers(["o1", "o2", "o3", "o4", "o5"]);
        setFocus("o2", STEP_FOCUS_SCALE);
        clearLayerHighlights();
        setContinueHintVisible(false);
        setReplayVisible(false);
        setActionVisible(false);
    }

    function setCompletedVisual() {
        // 完成态：回到初始展示，显示“再次播放”与跳转按钮
        state.mode = "complete";
        state.completed = true;
        state.replayBusy = false;
        resetStepFourState();
        setBaseVisible(true);
        setVisibleLayers(["o1"]);
        setFocus("", 1);
        clearLayerHighlights();
        setCopyInstant(COPY.step1);
        setContinueHintVisible(false);
        setReplayVisible(true);
        setActionVisible(true);
    }

    async function runStepOne() {
        setStepOneVisual();
        var token = currentRunToken();
        var ok = await typeCopy(COPY.step1, token, TYPE_SPEED.step1);
        if (!ok || !runIsActive(token)) return;
        setInteractiveTarget("o1", { remind: true });
        setContinueHintVisible(true);
    }

    async function runStepTwo() {
        setStepTwoVisual();
        var token = currentRunToken();
        setSteadyHighlight("o1");
        var ok = await typeCopy(COPY.step2, token, TYPE_SPEED.normal);
        if (!ok || !runIsActive(token)) return;
        setInteractiveTarget("o2", { remind: true });
        setContinueHintVisible(true);
    }

    async function runStepThreeAndFour() {
        // Step3 文案结束后，进入 Step4 的点击驱动序列
        setStepThreeVisual();
        var token = currentRunToken();
        setSteadyHighlight("o2");
        var ok = await typeCopy(COPY.step3, token, TYPE_SPEED.normal);
        if (!ok || !runIsActive(token)) return;
        setStepFourVisual();
        state.step4Index = 0;
        state.step4Busy = false;
        setInteractiveTarget(STEP4_SEQUENCE[0].key, { remind: true });
        setContinueHintVisible(true);
    }

    async function handleStepFourClick(key) {
        // Step4：当前高亮点击 -> 打字 -> 切换下一处高亮
        if (state.mode !== "step4" || state.step4Busy) return;
        if (state.step4Index < 0 || state.step4Index >= STEP4_SEQUENCE.length) return;

        var currentItem = STEP4_SEQUENCE[state.step4Index];
        if (!currentItem || key !== currentItem.key) return;

        setContinueHintVisible(false);
        state.step4Busy = true;
        setSteadyHighlight(currentItem.key);

        var token = currentRunToken();
        var ok = await typeCopy(currentItem.text, token, TYPE_SPEED.detail);
        if (!ok || !runIsActive(token)) {
            state.step4Busy = false;
            return;
        }

        state.step4Index += 1;
        state.step4Busy = false;

        if (state.step4Index < STEP4_SEQUENCE.length) {
            setInteractiveTarget(STEP4_SEQUENCE[state.step4Index].key, { remind: true });
            setContinueHintVisible(true);
            return;
        }

        await wait(800);
        if (!runIsActive(token)) return;
        setCompletedVisual();
    }

    async function finalizeReplay(token) {
        // 回放分支统一收尾：停留 0.8s 再回完成态
        await wait(800);
        if (!runIsActive(token)) return;
        setCompletedVisual();
    }

    async function replayDoor() {
        setStepTwoVisual();
        var token = currentRunToken();
        setBlinkHighlight("o2");
        var ok = await typeCopy(COPY.step2, token, TYPE_SPEED.normal);
        if (!ok || !runIsActive(token)) {
            state.replayBusy = false;
            return;
        }
        await wait(800); 
        setStepThreeVisual();
        setBlinkHighlight("o2");
        ok = await typeCopy(COPY.step3, token, TYPE_SPEED.normal);
        if (!ok || !runIsActive(token)) {
            state.replayBusy = false;
            return;
        }

        await finalizeReplay(token);
    }

    async function replayLattice() {
        setStepFourVisual();
        var token = currentRunToken();
        setBlinkHighlight("o3");
        var ok = await typeCopy(COPY.step4a, token, TYPE_SPEED.detail);
        if (!ok || !runIsActive(token)) {
            state.replayBusy = false;
            return;
        }

        await finalizeReplay(token);
    }

    async function replayApron() {
        setStepFourVisual();
        var token = currentRunToken();
        setBlinkHighlight("o5");
        var ok = await typeCopy(COPY.step4c, token, TYPE_SPEED.detail);
        if (!ok || !runIsActive(token)) {
            state.replayBusy = false;
            return;
        }

        await finalizeReplay(token);
    }

    function handleReplayClick(replayKey) {
        // 完成态回放入口：按按钮回放对应片段
        if (state.mode !== "complete" || state.replayBusy) return;

        state.replayBusy = true;
        setActionVisible(false);
        setReplayVisible(false);

        if (replayKey === "door") {
            replayDoor();
            return;
        }
        if (replayKey === "lattice") {
            replayLattice();
            return;
        }
        if (replayKey === "apron") {
            replayApron();
            return;
        }

        state.replayBusy = false;
        setCompletedVisual();
    }

    function onLayerClick(event) {
        // 主流程点击路由：step1(o1) / step2(o2) / step4(序列)
        if (!event || !event.currentTarget) return;
        var layer = event.currentTarget;
        if (!layer.classList.contains("is-visible")) return;

        var key = layer.getAttribute("data-layer");
        if (state.mode === "step1" && key === "o1" && layer.classList.contains("is-target")) {
            setContinueHintVisible(false);
            runStepTwo();
            return;
        }

        if (state.mode === "step2" && key === "o2" && layer.classList.contains("is-target")) {
            setContinueHintVisible(false);
            runStepThreeAndFour();
            return;
        }

        if (state.mode === "step4" && layer.classList.contains("is-target")) {
            handleStepFourClick(key);
        }
    }

    function navigateToChartPage() {
        // 告知首页过渡层：本次跳转需要播放波纹缓冲。
        var evt = new CustomEvent("origin:go-chart", { detail: { withRipple: true } });
        window.dispatchEvent(evt);
    }

    function bindEvents() {
        // 绑定图层点击、回放按钮、跳页按钮与缩放重算
        eachOverlay(function (layer) {
            layer.addEventListener("click", onLayerClick);
        });

        Object.keys(dom.replayButtons).forEach(function (key) {
            var button = dom.replayButtons[key];
            if (!button) return;
            button.addEventListener("click", function () {
                handleReplayClick(key);
            });
        });

        if (dom.action) {
            dom.action.addEventListener("click", function () {
                navigateToChartPage();
            });
        }

        window.addEventListener("resize", function () {
            if (state.resizeQueued) return;
            state.resizeQueued = true;
            window.requestAnimationFrame(function () {
                state.resizeQueued = false;
                applyFocusTransform();
            });
        });
    }

    function buildSceneMarkup(container) {
        // 动态注入“形制溯源”场景结构
        container.innerHTML = [
            '<div class="origin-scene" role="region" aria-label="形制溯源动画演示">',
            '  <div class="origin-stage" id="origin-stage">',
            '    <div class="origin-world" id="origin-world">',
            '      <img class="origin-base" id="origin-base-image" src="datas/imgs/art_design/origin.png" alt="殿墙与隔扇门整体">',
            '      <button type="button" class="origin-layer" data-layer="o1" aria-label="聚焦殿墙中的木构开间"><img src="datas/imgs/art_design/o1.png" alt=""></button>',
            '      <button type="button" class="origin-layer" data-layer="o2" aria-label="聚焦隔扇门扇"><img src="datas/imgs/art_design/o2.png" alt=""></button>',
            '      <button type="button" class="origin-layer" data-layer="o3" aria-label="聚焦格心窗棂"><img src="datas/imgs/art_design/o3.png" alt=""></button>',
            '      <button type="button" class="origin-layer" data-layer="o4" aria-label="聚焦绦环板"><img src="datas/imgs/art_design/o4.png" alt=""></button>',
            '      <button type="button" class="origin-layer" data-layer="o5" aria-label="聚焦裙板"><img src="datas/imgs/art_design/o5.png" alt=""></button>',
            "    </div>",
            "  </div>",
            '  <p class="origin-copy" id="origin-copy" aria-live="polite"></p>',
            '  <p class="origin-continue-hint" id="origin-continue-hint" aria-hidden="true">点击闪烁区域以继续</p>',
            '  <div class="origin-replay" id="origin-replay" aria-label="再次播放控制">',
            '    <span class="origin-replay-label">再次播放</span>',
            '    <button type="button" class="origin-replay-btn" data-replay="door">隔扇门</button>',
            '    <button type="button" class="origin-replay-btn" data-replay="lattice">窗棂</button>',
            '    <button type="button" class="origin-replay-btn" data-replay="apron">裙板</button>',
            "  </div>",
            '  <button type="button" class="origin-action" id="origin-action">探索空间分布</button>',
            "</div>"
        ].join("");
    }

    function cacheDom(container) {
        // 缓存场景节点并回填图层坐标
        dom.container = container;
        dom.stage = container.querySelector("#origin-stage");
        dom.world = container.querySelector("#origin-world");
        dom.base = container.querySelector("#origin-base-image");
        dom.copy = container.querySelector("#origin-copy");
        dom.continueHint = container.querySelector("#origin-continue-hint");
        dom.replay = container.querySelector("#origin-replay");
        dom.action = container.querySelector("#origin-action");
        dom.overlays = {};
        dom.replayButtons = {};

        var replayButtons = container.querySelectorAll(".origin-replay-btn[data-replay]");
        Array.prototype.forEach.call(replayButtons, function (button) {
            var key = button.getAttribute("data-replay");
            if (!key) return;
            dom.replayButtons[key] = button;
        });

        var layers = container.querySelectorAll(".origin-layer[data-layer]");
        Array.prototype.forEach.call(layers, function (layer) {
            var key = layer.getAttribute("data-layer");
            if (!key || !REGIONS[key]) return;
            applyRegionStyle(layer, REGIONS[key]);
            dom.overlays[key] = layer;
        });
    }

    function ensureInitialized() {
        // 首次进入时初始化；后续复用
        if (state.initialized) return true;
        var container = document.getElementById("origin-container");
        if (!container) return false;

        buildSceneMarkup(container);
        cacheDom(container);
        bindEvents();
        setCopyInstant("");
        setContinueHintVisible(false);
        setReplayVisible(false);
        setActionVisible(false);
        state.initialized = true;
        return true;
    }

    function handlePageVisible() {
        if (!ensureInitialized()) return;
        if (state.completed) {
            setCompletedVisual();
            return;
        }

        if (!state.started) {
            state.started = true;
            runStepOne();
            return;
        }

        applyFocusTransform();
    }

    function setOriginPageVisibility(isVisible) {
        // 由外层导航控制“形制溯源”页的显示与启动
        if (!ensureInitialized()) return;
        if (!isVisible) return;
        if (document.body && document.body.classList.contains("landing-active")) return;
        handlePageVisible();
    }

    window.set_origin_page_visibility = setOriginPageVisibility;
})();
