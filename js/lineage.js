(function () {
    // ===== 衍生谱系页面调参区（中文注释版）=====
    // 说明：
    // 1) 这里的默认值会在初始化时写入页面 CSS 变量，优先改这里即可。
    // 2) 若外部注入 window.LINEAGE_TUNING，会在默认值基础上覆盖。
    var DEFAULT_TUNING = {
        cssVars: {
            "--lineage-stage-width": "min(84vw, 1100px)",             // 左侧图谱区域宽度
            "--lineage-stage-height": "min(84vh, 1100px)",            // 左侧图谱区域高度
            "--lineage-stage-offset-x": "clamp(28px, 3.5vw, 72px)",  // 图谱在左侧容器中的内偏移
            "--lineage-sidebar-width": "min(45vw, 650px)",           // 右侧图录宽度
            "--lineage-pan-x": "-480px",                             // 图谱+图录整体横向平移，正值向右
            "--lineage-pan-y": "0px",                                // 图谱+图录整体纵向平移，正值向下
            "--lineage-nav-safe-top": "130px"                        // 图录避开顶部导航的安全距离
        },
        data: {
            csvPath: "datas/apron_variant.csv",
            imagePath: "datas/imgs/apron/",
            imageExts: [".png", ".jpg", ".jpeg", ".webp"],
            minRenderWidth: 220,
            minRenderHeight: 220,
            loadingPollDelay: 60,
            renderRetryDelay: 120,
            variantLabelMaxLength: 10,
            missingImageSuffix: "（未找到对应图片）"
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
            centerYRatio: 0.52,        // 图谱中心纵向位置比例（越小越靠上）
            typeRingRatio: 0.15,       // 中心到“apron类型层”的半径比例
            variantRingRatio: 0.38,    // 中心到“variant层”的半径比例
            typeStartAngle: -Math.PI / 2,
            variantSpreadMin: Math.PI / 8,
            variantSpreadMax: Math.PI * 0.86,
            variantSpreadStep: Math.PI / 10,
            variantSpreadBase: Math.PI / 10,
            variantRadialOffset: 10    // 变体节点交错起伏量（2.5D层次）
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
        }
    };

    var lineageState = {
        data: null,
        loading: false,
        sidebarReady: false,
        sidebarCards: [],
        pinnedNodeId: "center",
        renderContext: null,
        pendingRenderTimer: null,
        tuning: buildTuning()
    };

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
    function applyCssVars() {
        var container = document.getElementById("lineage-container");
        if (!container) return;
        var cssVars = lineageState.tuning.cssVars;
        Object.keys(cssVars).forEach(function (varName) { container.style.setProperty(varName, String(cssVars[varName])); });
    }

    function cleanText(value) { return value === undefined || value === null ? "" : String(value).trim(); }
    function clamp(min, max, value) { return Math.max(min, Math.min(max, value)); }
    function createElement(tagName, className, textContent) {
        var element = document.createElement(tagName);
        if (className) element.className = className;
        if (textContent !== undefined) element.textContent = textContent;
        return element;
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
        if (!text) return [""];
        if (text.indexOf("——") > -1) {
            var parts = text.split("——");
            if (parts.length >= 2) return [parts[0] + "——", parts.slice(1).join("——")];
        }
        return text.length > 9 ? [text.slice(0, 9), text.slice(9)] : [text];
    }

    function buildImageCandidates(variantNode) {
        var tuning = lineageState.tuning;
        var nameCandidates = [];
        [variantNode.image, variantNode.imageAlias, variantNode.label].forEach(function (name) {
            var cleanName = cleanText(name);
            if (cleanName && nameCandidates.indexOf(cleanName) === -1) {
                nameCandidates.push(cleanName);
            }
        });

        var candidates = [];

        nameCandidates.forEach(function (name) {
            var baseRaw = tuning.data.imagePath + name;
            var baseEncoded = tuning.data.imagePath + encodeURIComponent(name);
            tuning.data.imageExts.forEach(function (ext) {
                candidates.push(baseRaw + ext);
                candidates.push(baseEncoded + ext);
            });
        });

        return candidates;
    }

    function applyImageFallback(imageElement, candidates, index) {
        var tuning = lineageState.tuning;
        if (index >= candidates.length) {
            imageElement.classList.add("is-missing");
            imageElement.alt = imageElement.alt + tuning.data.missingImageSuffix;
            return;
        }
        imageElement.onerror = function () { applyImageFallback(imageElement, candidates, index + 1); };
        imageElement.src = candidates[index];
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

    function buildLineageData(rows) {
        var tuning = lineageState.tuning;
        var typeMap = {};

        rows.forEach(function (row) {
            var typeName = pickRowText(row, ["apron", "aporn", "type", "apron_type", "属性", "类型"]);
            var variantName = pickRowText(row, ["variant", "variant_name", "name", "变体", "变体名"]);
            if (!typeName || !variantName) return;

            var variantMeta = {
                label: variantName,
                introduction: pickRowText(row, ["introduction", "intro", "description", "details", "介绍"]),
                meaning: pickRowText(row, ["meaning", "meanings", "寓意"]),
                buildings: pickRowText(row, ["buildings", "building", "architecture", "建筑", "关联建筑"]),
                image: pickRowText(row, ["image", "img", "photo", "图片"]),
                imageAlias: pickRowText(row, ["image_alias", "image_name", "图片名", "old_variant", "legacy_variant", "原始变体"])
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
                return {
                    id: "type-" + index,
                    label: item.label,
                    level: 1,
                    nodeType: "apron",
                    variants: sortedVariants,
                    count: sortedVariants.length
                };
            });

        var centerNode = { id: "center", label: tuning.text.centerLabel, level: 0, nodeType: "center" };
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
                    imageAlias: variantMeta.imageAlias
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
            centerNode: centerNode,
            typeNodes: typeNodes,
            variantNodes: variantNodes,
            nodes: nodes,
            links: links,
            nodeById: nodeById,
            variantsByType: variantsByType
        };
    }

    function ensureLineageData(callback) {
        var tuning = lineageState.tuning;
        if (lineageState.data) {
            callback(null, lineageState.data);
            return;
        }
        if (lineageState.loading) {
            window.setTimeout(function () { ensureLineageData(callback); }, tuning.data.loadingPollDelay);
            return;
        }

        lineageState.loading = true;
        d3.csv(tuning.data.csvPath, function (error, rows) {
            lineageState.loading = false;
            if (error) {
                callback(error);
                return;
            }
            lineageState.data = buildLineageData(rows || []);
            callback(null, lineageState.data);
        });
    }

    function getNodeRadius(node) {
        var radiusByLevel = lineageState.tuning.visual.nodeRadiusByLevel;
        return radiusByLevel[String(node.level)] || radiusByLevel["2"];
    }

    function computeLayout(data, width, height) {
        var tuning = lineageState.tuning;
        var layout = tuning.layout;
        var visual = tuning.visual;
        var centerX = width * layout.centerXRatio;
        var centerY = height * layout.centerYRatio;
        var baseRadius = Math.min(width, height);
        var typeRingRadius = baseRadius * layout.typeRingRatio;
        var variantRingRadius = baseRadius * layout.variantRingRatio;

        data.centerNode.x = centerX;
        data.centerNode.y = centerY;

        var typeCount = Math.max(1, data.typeNodes.length);
        var typeStep = (Math.PI * 2) / typeCount;

        data.typeNodes.forEach(function (typeNode, typeIndex) {
            var typeAngle = layout.typeStartAngle + typeStep * typeIndex;
            typeNode.angle = typeAngle;
            typeNode.x = centerX + Math.cos(typeAngle) * typeRingRadius;
            typeNode.y = centerY + Math.sin(typeAngle) * typeRingRadius;
        });

        data.typeNodes.forEach(function (typeNode) {
            var variants = data.variantsByType[typeNode.id] || [];
            var count = variants.length;
            var spread = clamp(layout.variantSpreadMin, layout.variantSpreadMax, (count - 1) * layout.variantSpreadStep + layout.variantSpreadBase);

            variants.forEach(function (variantNode, index) {
                var angleOffset = count === 1 ? 0 : (-spread / 2 + (spread * index) / (count - 1));
                var variantAngle = typeNode.angle + angleOffset;
                var radialOffset = index % 2 === 0 ? -layout.variantRadialOffset : layout.variantRadialOffset;
                var variantRadius = variantRingRadius + radialOffset;

                variantNode.angle = variantAngle;
                variantNode.x = centerX + Math.cos(variantAngle) * variantRadius;
                variantNode.y = centerY + Math.sin(variantAngle) * variantRadius;
            });
        });

        data.nodes.forEach(function (node) {
            if (node.level === 0) {
                node.labelX = node.x;
                node.labelY = node.y;
                node.labelAnchor = "middle";
                node.labelLines = [node.label];
                return;
            }

            var angle = Math.atan2(node.y - centerY, node.x - centerX);
            var labelOffset = visual.labelOffsetByLevel[String(node.level)] || visual.labelOffsetByLevel["2"];

            node.labelX = node.x + Math.cos(angle) * labelOffset;
            node.labelY = node.y + Math.sin(angle) * labelOffset;
            node.labelAnchor = node.level === 1 ? "middle" : (Math.cos(angle) >= 0 ? "start" : "end");
            node.labelLines = node.level === 1 ? splitTypeLabel(node.label) : [node.displayLabel || node.label];
        });

        data.layout = {
            width: width,
            height: height,
            centerX: centerX,
            centerY: centerY,
            typeRingRadius: typeRingRadius,
            variantRingRadius: variantRingRadius
        };
    }

    function buildLinkPath(source, target, level) {
        var linkCurve = lineageState.tuning.visual.linkCurve;
        var dx = target.x - source.x;
        var dy = target.y - source.y;
        var distance = Math.sqrt(dx * dx + dy * dy) || 1;
        var normalX = -dy / distance;
        var normalY = dx / distance;
        var midpointX = (source.x + target.x) / 2;
        var midpointY = (source.y + target.y) / 2;
        var bendAmount = level === 1 ? distance * linkCurve.centerBendRatio : distance * linkCurve.variantBendRatio;
        var bendSign = level === 1 ? 1 : (Math.sin(target.angle || 0) >= 0 ? 1 : -1);
        var controlX = midpointX + normalX * bendAmount * bendSign;
        var controlY = midpointY + normalY * bendAmount * bendSign;
        return "M" + source.x + "," + source.y + " Q" + controlX + "," + controlY + " " + target.x + "," + target.y;
    }

    function createOrUpdateSidebar(data) {
        var tuning = lineageState.tuning;
        var gallery = document.getElementById("lineage-gallery");
        if (!gallery) return;

        gallery.innerHTML = "";
        var fragment = document.createDocumentFragment();

        data.variantNodes.forEach(function (variantNode) {
            var card = createElement("article", "lineage-card");
            card.setAttribute("data-variant-id", variantNode.id);
            card.setAttribute("data-type-id", variantNode.parentId);

            var imageWrap = createElement("div", "lineage-card-image-wrap");
            var image = createElement("img", "lineage-card-image");
            image.alt = variantNode.label;
            imageWrap.appendChild(image);

            var body = createElement("div", "lineage-card-body");
            var introductionText = cleanText(variantNode.introduction) || tuning.text.introductionFallback;
            var meaningText = cleanText(variantNode.meaning) || tuning.text.meaningFallback;
            var buildingsText = cleanText(variantNode.buildings) || tuning.text.buildingsFallback;

            body.appendChild(createElement("h3", "lineage-card-title", variantNode.label));
            body.appendChild(createElement("p", "lineage-card-meta", variantNode.parentLabel));
            body.appendChild(createElement("p", "lineage-card-field lineage-card-meaning", tuning.text.meaningPrefix + meaningText));
            body.appendChild(createElement("p", "lineage-card-field lineage-card-buildings", tuning.text.buildingsPrefix + buildingsText));
            body.appendChild(createElement("p", "lineage-card-introduction", introductionText));

            card.appendChild(imageWrap);
            card.appendChild(body);
            fragment.appendChild(card);

            applyImageFallback(image, buildImageCandidates(variantNode), 0);
        });

        gallery.appendChild(fragment);
        lineageState.sidebarCards = Array.prototype.slice.call(gallery.querySelectorAll(".lineage-card"));
        lineageState.sidebarReady = true;
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

        updateSidebarFocus(activeNode);
    }

    function appendLinearGradient(defs, id, stops) {
        var gradient = defs.append("linearGradient")
            .attr("id", id)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");

        stops.forEach(function (stop) {
            gradient.append("stop")
                .attr("offset", stop.offset)
                .attr("stop-color", stop.color);
        });
    }

    function renderRingsAndTrend(svg, data) {
        var tuning = lineageState.tuning;
        var layout = data.layout;
        var trendOffset = tuning.visual.trendOffset;

        var ringLayer = svg.append("g").attr("class", "lineage-rings");
        ringLayer.append("circle").attr("class", "lineage-ring lineage-ring-inner").attr("cx", layout.centerX).attr("cy", layout.centerY).attr("r", layout.typeRingRadius);
        ringLayer.append("circle").attr("class", "lineage-ring lineage-ring-outer").attr("cx", layout.centerX).attr("cy", layout.centerY).attr("r", layout.variantRingRadius);

        var trendData = [
            { x: layout.centerX + trendOffset.center.dx, y: layout.centerY + trendOffset.center.dy, text: tuning.text.trendCenterLabel },
            { x: layout.centerX - layout.typeRingRadius + trendOffset.type.dx, y: layout.centerY - layout.typeRingRadius + trendOffset.type.dy, text: data.typeNodes.length + tuning.text.typeCountSuffix },
            { x: layout.centerX - layout.variantRingRadius + trendOffset.variant.dx, y: layout.centerY - layout.variantRingRadius + trendOffset.variant.dy, text: data.variantNodes.length + tuning.text.variantCountSuffix }
        ];

        ringLayer.selectAll(".lineage-trend-label").data(trendData).enter().append("text")
            .attr("class", "lineage-trend-label")
            .attr("x", function (d) { return d.x; })
            .attr("y", function (d) { return d.y; })
            .text(function (d) { return d.text; });
    }

    function renderLinks(svg, data) {
        var linkCurve = lineageState.tuning.visual.linkCurve;
        var linkLayer = svg.append("g").attr("class", "lineage-links");
        var renderedLinks = data.links.map(function (link) {
            return {
                id: link.id,
                level: link.level,
                source: link.source,
                target: link.target,
                path: buildLinkPath(data.nodeById[link.source], data.nodeById[link.target], link.level)
            };
        });

        var linkShadowSelection = linkLayer.selectAll(".lineage-link-shadow").data(renderedLinks).enter().append("path")
            .attr("class", function (d) { return "lineage-link-shadow lineage-link-level-" + d.level; })
            .attr("d", function (d) { return d.path; })
            .attr("transform", "translate(0," + linkCurve.shadowYOffset + ")");

        var linkSelection = linkLayer.selectAll(".lineage-link").data(renderedLinks).enter().append("path")
            .attr("class", function (d) { return "lineage-link lineage-link-level-" + d.level; })
            .attr("d", function (d) { return d.path; });

        return { linkSelection: linkSelection, linkShadowSelection: linkShadowSelection };
    }

    function nodeAriaLabel(node) {
        if (node.level === 0) return "中心节点：" + node.label;
        if (node.level === 1) return "裙板属性类型：" + node.label;
        return "裙板变体：" + node.label;
    }
    function nodeGradientFill(node) {
        if (node.level === 0) return "url(#lineage-gradient-center)";
        if (node.level === 1) return "url(#lineage-gradient-type)";
        return "url(#lineage-gradient-variant)";
    }

    function renderNodes(svg, data) {
        var visual = lineageState.tuning.visual;
        var nodeLayer = svg.append("g").attr("class", "lineage-nodes");

        var nodeSelection = nodeLayer.selectAll(".lineage-node").data(data.nodes).enter().append("g")
            .attr("class", function (d) { return "lineage-node lineage-node-level-" + d.level; })
            .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("aria-label", nodeAriaLabel);

        nodeSelection.append("ellipse").attr("class", "lineage-node-shadow")
            .attr("cx", 0)
            .attr("cy", function (d) { return getNodeRadius(d) * visual.nodeShadow.cyRatio; })
            .attr("rx", function (d) { return getNodeRadius(d) * visual.nodeShadow.rxRatio; })
            .attr("ry", function (d) { return Math.max(visual.nodeShadow.minRy, getNodeRadius(d) * visual.nodeShadow.ryRatio); });

        nodeSelection.append("circle").attr("class", "lineage-node-halo")
            .attr("r", function (d) { return getNodeRadius(d) + (d.level === 0 ? visual.nodeHaloExtra.center : visual.nodeHaloExtra.other); });

        nodeSelection.append("circle").attr("class", "lineage-node-core").attr("r", getNodeRadius).style("fill", nodeGradientFill);

        nodeSelection.append("circle").attr("class", "lineage-node-specular")
            .attr("cx", function (d) { return getNodeRadius(d) * visual.nodeSpecular.cxRatio; })
            .attr("cy", function (d) { return getNodeRadius(d) * visual.nodeSpecular.cyRatio; })
            .attr("r", function (d) { return Math.max(visual.nodeSpecular.minR, getNodeRadius(d) * visual.nodeSpecular.rRatio); });

        nodeSelection.filter(function (d) { return d.level === 0; }).append("text")
            .attr("class", "lineage-center-text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .text(function (d) { return d.label; });

        return nodeSelection;
    }

    function appendLabelText(labelGroup, node) {
        var visual = lineageState.tuning.visual;
        var text = labelGroup.append("text")
            .attr("class", "lineage-label-text")
            .attr("text-anchor", node.labelAnchor)
            .attr("dominant-baseline", "middle");

        var lines = node.labelLines || [node.label];
        var firstOffsetEm = -((lines.length - 1) * visual.labelFirstLineFactor);

        lines.forEach(function (lineText, index) {
            text.append("tspan").attr("x", 0).attr("dy", index === 0 ? (firstOffsetEm + "em") : (visual.labelLineGapEm + "em")).text(lineText);
        });
    }

    function renderLabels(svg, data) {
        var visual = lineageState.tuning.visual;
        var labelNodes = data.nodes.filter(function (node) { return node.level !== 0; });
        var labelLayer = svg.append("g").attr("class", "lineage-labels");
        var labelSelection = labelLayer.selectAll(".lineage-label").data(labelNodes).enter().append("g")
            .attr("class", function (d) { return "lineage-label lineage-label-level-" + d.level; })
            .attr("transform", function (d) { return "translate(" + d.labelX + "," + d.labelY + ")"; });

        labelSelection.each(function (node) { appendLabelText(d3.select(this), node); });

        labelSelection.each(function () {
            var group = d3.select(this);
            var textNode = group.select("text").node();
            if (!textNode) return;
            var bbox = textNode.getBBox();
            group.insert("rect", "text")
                .attr("class", "lineage-label-bg")
                .attr("x", bbox.x - visual.labelBgPadding.x)
                .attr("y", bbox.y - visual.labelBgPadding.y)
                .attr("width", bbox.width + visual.labelBgPadding.x * 2)
                .attr("height", bbox.height + visual.labelBgPadding.y * 2)
                .attr("rx", visual.labelBgPadding.rx)
                .attr("ry", visual.labelBgPadding.ry);
        });

        return labelSelection;
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

        var defs = svg.append("defs");
        appendLinearGradient(defs, "lineage-gradient-center", lineageState.tuning.gradients.center);
        appendLinearGradient(defs, "lineage-gradient-type", lineageState.tuning.gradients.type);
        appendLinearGradient(defs, "lineage-gradient-variant", lineageState.tuning.gradients.variant);

        renderRingsAndTrend(svg, data);
        var linkSelections = renderLinks(svg, data);
        var nodeSelection = renderNodes(svg, data);
        var labelSelection = renderLabels(svg, data);

        bindInteractions(nodeSelection, svg, data);

        lineageState.renderContext = {
            data: data,
            nodeSelection: nodeSelection,
            labelSelection: labelSelection,
            linkSelection: linkSelections.linkSelection,
            linkShadowSelection: linkSelections.linkShadowSelection
        };

        applyFocus(resolvePinnedNode(data));
    }

    function createApronLineageGraph() {
        var tuning = lineageState.tuning;
        applyCssVars();

        ensureLineageData(function (error, data) {
            if (error) {
                console.error("衍生谱系数据加载失败：", error);
                return;
            }

            if (!lineageState.sidebarReady) createOrUpdateSidebar(data);

            var graphElement = document.getElementById("lineage-graph");
            var container = document.getElementById("lineage-container");
            if (!graphElement || !container) return;

            var hostRect = graphElement.getBoundingClientRect();
            var isActive = container.classList.contains("is-active");
            var tooSmall = hostRect.width < tuning.data.minRenderWidth || hostRect.height < tuning.data.minRenderHeight;

            if (tooSmall) {
                if (isActive) {
                    if (lineageState.pendingRenderTimer) window.clearTimeout(lineageState.pendingRenderTimer);
                    lineageState.pendingRenderTimer = window.setTimeout(function () {
                        lineageState.pendingRenderTimer = null;
                        createApronLineageGraph();
                    }, tuning.data.renderRetryDelay);
                }
                return;
            }

            renderLineageGraph(data, Math.round(hostRect.width), Math.round(hostRect.height));
        });
    }

    window.LINEAGE_TUNING_EFFECTIVE = lineageState.tuning;
    window.create_apron_lineage_graph = createApronLineageGraph;
})();

