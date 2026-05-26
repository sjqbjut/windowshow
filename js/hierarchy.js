// 等级尊卑页面：金字塔层级 + 热力矩阵 + 小地图联动
(function () {
    "use strict";

    var LEVEL_ORDER = [
        "外朝官署政务区",
        "内廷帝后生活区",
        "后宫嫔妃生活区",
        "御苑游赏休闲区"
    ];

    var LEVEL_AREA_ALIASES = {
        "外朝官署政务区": ["外朝中路", "外朝两翼"],
        "内廷帝后生活区": ["内廷后三宫", "宁寿宫区", "太后太妃宫区", "太后/太妃宫区"],
        "后宫嫔妃生活区": ["内廷东六宫", "内廷西六宫"],
        "御苑游赏休闲区": ["御花园及园林建筑"]
    };

    var LEVEL_AREA_INDEX_FALLBACK = {
        "外朝官署政务区": [0, 1],
        "内廷帝后生活区": [2, 6, 5],
        "后宫嫔妃生活区": [3, 4],
        "御苑游赏休闲区": [7]
    };

    var HOUSE_TYPE_PREFERRED = ["宫门", "后殿", "正殿", "配殿", "耳房", "庑房"];
    var PYRAMID_LABEL_OFFSET_X = 280;// 金字塔层内文本标签相对于层中心的水平偏移，正值表示向右偏移，负值表示向左偏移。
    var PYRAMID_TOP_BASE_VW = 6;//金字塔上底
    var MAP_AREA_PALETTE = [
        "#EB5580", "#2C9AC6", "#4FB127", "#F6B42B", "#5865B0",
        "#E47C41", "#BD211B", "#82C3AA", "#2F2F2F", "#9A8473"
    ];
    var PATTERN_PALETTE = [
        "#d8221b", "#723111", "#f900f9", "#7d1ced", "#1cace6",
        "#6F9B3C", "#03d611", "#fac105", "#82C3AA", "#C07A2B",
        "#5865B0", "#4447a8", "#2B5E7D", "#9F4A24", "#E47C41"
    ];

    var hierarchyState = {
        loading: false,
        waiting: [],
        dataet: null,
        patternVisibility: {},
        miniMap: null,
        rowBridge: null,
        activeLevel: "",
        tooltipElement: null,
        fixedCoordScale: null
    };

    function cleanText(value) {
        return value === undefined || value === null ? "" : String(value).trim();
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalizeBuildingId(value) {
        return cleanText(value).replace(/\s+/g, "");
    }

    function simplifyAreaText(value) {
        return cleanText(value)
            .replace(/[（(][^）)]*[）)]/g, "")
            .replace(/\s*\/\s*/g, "/")
            .trim();
    }

    function normalizeAreaKey(value) {
        return simplifyAreaText(value)
            .replace(/[\/、，,\-\s]/g, "")
            .toLowerCase();
    }

    function normalizeLevelKey(value) {
        return cleanText(value).replace(/\s+/g, "");
    }

    function escapeHtml(text) {
        return cleanText(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function parsePolygonCollection(areaItem) {
        var polygons = [];
        if (Array.isArray(areaItem.polygons)) polygons = polygons.concat(areaItem.polygons);
        if (Array.isArray(areaItem.polygon)) polygons.push(areaItem.polygon);
        return polygons
            .map(function (poly) {
                return (Array.isArray(poly) ? poly : [])
                    .map(function (point) {
                        if (!Array.isArray(point) || point.length < 2) return null;
                        var x = +point[0];
                        var y = +point[1];
                        if (!isFinite(x) || !isFinite(y)) return null;
                        return [x, y];
                    })
                    .filter(function (point) { return point !== null; });
            })
            .filter(function (poly) { return poly.length >= 3; });
    }

    function polygonCollectionToPath(polygons) {
        return polygons.map(function (poly) {
            return "M" + poly.map(function (point) { return point[0] + "," + point[1]; }).join("L") + "Z";
        }).join("");
    }

    function resolveHouseTypes(levelRows) {
        var firstRow = levelRows && levelRows.length ? levelRows[0] : {};
        var keys = Object.keys(firstRow || {});
        var result = [];
        var used = {};

        HOUSE_TYPE_PREFERRED.forEach(function (name) {
            if (keys.indexOf(name) >= 0) {
                result.push(name);
                used[name] = true;
            }
        });

        keys.forEach(function (key) {
            if (!key || used[key]) return;
            if (key === "等级" || key === "区域" || key === "层级" || key === "H1") return;
            result.push(key);
            used[key] = true;
        });

        if (!result.length && keys.indexOf("宫门") >= 0) result.push("宫门");
        if (result.length > 6) result = result.slice(0, 6);
        return result;
    }

    function resolveLevelName(row, houseTypes) {
        var keys = Object.keys(row || {});
        var candidateKeys = ["等级", "区域", "层级", "level", "Level", "H1", "", "\ufeff等级", "\ufeff区域"];
        var i;
        for (i = 0; i < candidateKeys.length; i++) {
            if (Object.prototype.hasOwnProperty.call(row, candidateKeys[i])) {
                var text = cleanText(row[candidateKeys[i]]);
                if (text) return text;
            }
        }

        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (houseTypes.indexOf(key) >= 0) continue;
            var raw = cleanText(row[key]);
            if (raw) return raw;
        }
        return "";
    }

    function parsePatternEntries(rawValue) {
        var text = cleanText(rawValue)
            .replace(/；/g, "，")
            .replace(/;/g, "，");
        if (!text) return [];

        var tokens = text.split(/[，,]/)
            .map(function (item) { return cleanText(item); })
            .filter(function (item) { return !!item; });
        if (!tokens.length) return [];

        var entries = [];
        var missingIndexes = [];
        var knownTotal = 0;

        tokens.forEach(function (token) {
            var matched = token.match(/^(.+?)(?:[（(]\s*([\d.]+)\s*%\s*[）)])?$/);
            var patternName = cleanText(matched && matched[1] ? matched[1] : token);
            if (!patternName) return;

            var parsedPercent = matched && matched[2] !== undefined ? parseFloat(matched[2]) : NaN;
            if (!isFinite(parsedPercent)) {
                entries.push({ pattern: patternName, percentage: null });
                missingIndexes.push(entries.length - 1);
                return;
            }

            parsedPercent = clamp(parsedPercent, 0, 100);
            knownTotal += parsedPercent;
            entries.push({ pattern: patternName, percentage: parsedPercent });
        });

        if (!entries.length) return [];

        if (entries.length === 1 && entries[0].percentage === null) {
            entries[0].percentage = 100;
        }

        if (missingIndexes.length) {
            var remaining = Math.max(0, 100 - knownTotal);
            var average = remaining / missingIndexes.length;
            missingIndexes.forEach(function (index) {
                entries[index].percentage = average;
            });
        }

        var merged = {};
        entries.forEach(function (entry) {
            if (!merged[entry.pattern]) merged[entry.pattern] = 0;
            merged[entry.pattern] += entry.percentage;
        });

        var normalizedEntries = Object.keys(merged).map(function (name) {
            return {
                pattern: name,
                percentage: merged[name]
            };
        });

        var total = d3.sum(normalizedEntries, function (entry) { return entry.percentage; });
        if (total > 100.0001) {
            normalizedEntries.forEach(function (entry) {
                entry.percentage = entry.percentage / total * 100;
            });
        }

        normalizedEntries.sort(function (a, b) {
            return b.percentage - a.percentage;
        });

        return normalizedEntries;
    }

    function builddataet(levelRows, mapLayoutData, buildingTotalData) {
        var houseTypes = resolveHouseTypes(levelRows);
        var rowByLevelKey = {};
        var orderedRows = Array.isArray(levelRows) ? levelRows.slice() : [];

        orderedRows.forEach(function (row, index) {
            var levelName = resolveLevelName(row, houseTypes);
            if (!levelName) return;
            rowByLevelKey[normalizeLevelKey(levelName)] = {
                row: row,
                index: index
            };
        });

        var levels = LEVEL_ORDER.map(function (levelName, index) {
            var matched = rowByLevelKey[normalizeLevelKey(levelName)];
            var row = matched ? matched.row : (orderedRows[index] || {});
            return {
                name: levelName,
                index: index,
                row: row,
                imageUrl: "data/imgs/art_design/" + encodeURIComponent(levelName) + ".jpg"
            };
        });

        var patternOrder = [];
        var patternSeen = {};
        var cellsByKey = {};
        var matrix = [];

        levels.forEach(function (levelItem) {
            houseTypes.forEach(function (houseType, colIndex) {
                var entries = parsePatternEntries(levelItem.row ? levelItem.row[houseType] : "");
                entries.forEach(function (entry) {
                    if (!patternSeen[entry.pattern]) {
                        patternSeen[entry.pattern] = true;
                        patternOrder.push(entry.pattern);
                    }
                });
                var cell = {
                    levelName: levelItem.name,
                    levelIndex: levelItem.index,
                    houseType: houseType,
                    colIndex: colIndex,
                    entries: entries,
                    total: d3.sum(entries, function (entry) { return entry.percentage; })
                };
                matrix.push(cell);
                cellsByKey[levelItem.name + "||" + houseType] = cell;
            });
        });

        var patternColors = {};
        patternOrder.forEach(function (patternName, index) {
            patternColors[patternName] = PATTERN_PALETTE[index % PATTERN_PALETTE.length];
        });

        var mapLayout = mapLayoutData && typeof mapLayoutData === "object" ? mapLayoutData : {};
        var mapImageWidth = +((mapLayout.image && mapLayout.image.width) || 335);
        var mapImageHeight = +((mapLayout.image && mapLayout.image.height) || 551);
        var mapAreas = Array.isArray(mapLayout.areas) ? mapLayout.areas : [];
        var mapBuildings = Array.isArray(mapLayout.buildings) ? mapLayout.buildings : [];

        var areaData = mapAreas
            .map(function (item, index) {
                var areaName = cleanText(item.area);
                var polygons = parsePolygonCollection(item);
                if (!areaName || !polygons.length) return null;
                return {
                    index: index,
                    area: areaName,
                    areaKey: normalizeAreaKey(areaName),
                    polygons: polygons,
                    path: polygonCollectionToPath(polygons)
                };
            })
            .filter(function (item) { return item !== null; });

        var buildingMetaById = {};
        (Array.isArray(buildingTotalData) ? buildingTotalData : []).forEach(function (item) {
            var buildingId = normalizeBuildingId(item && item.building_id);
            if (!buildingId) return;
            buildingMetaById[buildingId] = {
                area: cleanText(item.area),
                building: cleanText(item.building)
            };
        });

        var buildingData = mapBuildings
            .map(function (item) {
                var buildingId = normalizeBuildingId(item && item.building_id);
                var x = +item.x;
                var y = +item.y;
                if (!buildingId || !isFinite(x) || !isFinite(y)) return null;

                var labelDx = 6;
                var labelDy = -6;
                if (Array.isArray(item.label_offset) && item.label_offset.length >= 2) {
                    if (isFinite(+item.label_offset[0])) labelDx = +item.label_offset[0];
                    if (isFinite(+item.label_offset[1])) labelDy = +item.label_offset[1];
                }
                if (isFinite(+item.label_dx)) labelDx = +item.label_dx;
                if (isFinite(+item.label_dy)) labelDy = +item.label_dy;

                var meta = buildingMetaById[buildingId] || {};
                return {
                    buildingId: buildingId,
                    x: x,
                    y: y,
                    labelDx: labelDx,
                    labelDy: labelDy,
                    area: cleanText(meta.area),
                    building: cleanText(meta.building)
                };
            })
            .filter(function (item) { return item !== null; });

        return {
            levels: levels,
            houseTypes: houseTypes,
            matrix: matrix,
            cellsByKey: cellsByKey,
            patterns: patternOrder,
            patternColors: patternColors,
            map: {
                imageWidth: mapImageWidth,
                imageHeight: mapImageHeight,
                areas: areaData,
                buildings: buildingData
            }
        };
    }

    function loadData(callback) {
        if (hierarchyState.dataet) {
            callback(null, hierarchyState.dataet);
            return;
        }

        hierarchyState.waiting.push(callback);
        if (hierarchyState.loading) return;
        hierarchyState.loading = true;

        d3.queue()
            .defer(d3.csv, "data/level.csv")
            .defer(d3.json, "data/map_layout.json")
            .defer(d3.json, "data/fc_building_total.json")
            .await(function (error, levelRows, mapLayoutData, buildingTotalData) {
                hierarchyState.loading = false;
                var callbacks = hierarchyState.waiting.slice();
                hierarchyState.waiting = [];

                if (error) {
                    callbacks.forEach(function (fn) { fn(error); });
                    return;
                }

                hierarchyState.dataet = builddataet(levelRows, mapLayoutData, buildingTotalData);
                callbacks.forEach(function (fn) { fn(null, hierarchyState.dataet); });
            });
    }

    function ensurePatternVisibility(dataet) {
        var nextState = {};
        dataet.patterns.forEach(function (patternName) {
            var current = hierarchyState.patternVisibility[patternName];
            nextState[patternName] = current === undefined ? true : !!current;
        });
        hierarchyState.patternVisibility = nextState;
    }

    function ensurePyramidTitleElement(container) {
        var pyramidPanel = container ? container.querySelector(".hierarchy-pyramid-panel") : null;
        if (!pyramidPanel) return null;

        var titleElement = pyramidPanel.querySelector("#hierarchy-pyramid-title");
        if (!titleElement) {
            titleElement = document.createElement("div");
            titleElement.id = "hierarchy-pyramid-title";
            titleElement.className = "hierarchy-pyramid-title";
            titleElement.setAttribute("aria-hidden", "true");
            titleElement.textContent = "传统建筑等级体系与纹样占比";
            pyramidPanel.insertBefore(titleElement, pyramidPanel.firstChild);
        } else if (!cleanText(titleElement.textContent)) {
            titleElement.textContent = "传统建筑等级体系与纹样占比";
        }

        return titleElement;
    }

    function syncPyramidTitleHeight(container) {
        var titleElement = ensurePyramidTitleElement(container);
        var legendElement = container ? container.querySelector("#hierarchy-legend") : null;
        if (!titleElement || !legendElement) return;

        // 先清空固定高度，确保本次读到的是图例在当前布局下的真实高度。
        titleElement.style.height = "auto";

        var legendRect = legendElement.getBoundingClientRect();
        var legendHeight = legendRect && isFinite(legendRect.height) ? legendRect.height : 0;
        if (legendHeight < 1) return;

        // 让左侧标题带与右侧图例带严格等高，从而保持左右上方留白与视觉基线一致。
        titleElement.style.height = Math.ceil(legendHeight) + "px";
    }

    function computePyramidLayout(container, dataet) {
        var pyramidPanel = container ? container.querySelector(".hierarchy-pyramid-panel") : null;
        var pyramidSvg = container ? container.querySelector("#hierarchy-pyramid") : null;
        if (!pyramidPanel || !pyramidSvg) return null;

        // 金字塔布局只读取自身面板与自身 SVG 的尺寸，不再依赖热力图的任何几何参数。
        var pyramidWidth = pyramidSvg.clientWidth || pyramidPanel.clientWidth;
        var pyramidHeight = pyramidSvg.clientHeight;
        if (pyramidWidth < 40 || pyramidHeight < 40) return null;

        var rowCount = dataet.levels.length || 4;
        var topPadding = 20;
        var bottomPadding = 20;

        // 可绘制主体高度 = SVG 可用高度 - 上下留白，再均分给每个等级层。
        var bodyHeight = Math.max(20, pyramidHeight - topPadding - bottomPadding);
        var rowHeight = bodyHeight / rowCount;

        return {
            pyramidWidth: pyramidWidth,
            pyramidHeight: pyramidHeight,
            rowCount: rowCount,
            tierTop: topPadding,
            tierBottom: topPadding + rowHeight * rowCount,
            rowHeight: rowHeight
        };
    }

    function computeHeatmapLayout(container, dataet) {
        var heatmapPanel = container ? container.querySelector(".hierarchy-heatmap-panel") : null;
        var heatmapSvg = container ? container.querySelector("#hierarchy-heatmap") : null;
        if (!heatmapPanel || !heatmapSvg) return null;

        // 热力矩阵布局只读取自身面板与自身 SVG 的尺寸，完全独立于金字塔坐标。
        var heatmapWidth = heatmapSvg.clientWidth || heatmapPanel.clientWidth;
        var heatmapHeight = heatmapSvg.clientHeight;
        if (heatmapWidth < 40 || heatmapHeight < 40) return null;

        var rowCount = dataet.levels.length || 4;
        var colCount = dataet.houseTypes.length || 1;

        // 四周边距用于放置列标题、网格边界与底部留白。
        var leftPad = 8;
        var rightPad = 10;
        var topPad = 56;
        var bottomPad = 18;

        // 网格主体高度直接由热力图自身可用高度计算，不借用金字塔层高。
        var bodyHeight = Math.max(1, heatmapHeight - topPad - bottomPad);
        var rowHeight = bodyHeight / rowCount;
        var gridLeft = leftPad;
        var gridTop = topPad;
        var gridWidth = Math.max(60, heatmapWidth - leftPad - rightPad);
        var cellWidth = gridWidth / colCount;

        return {
            heatmapWidth: heatmapWidth,
            heatmapHeight: heatmapHeight,
            rowCount: rowCount,
            colCount: colCount,
            gridLeft: gridLeft,
            gridTop: gridTop,
            gridWidth: gridWidth,
            rowHeight: rowHeight,
            cellWidth: cellWidth,
            columnTitleY: gridTop - 18
        };
    }

    function areaFillColor(index) {
        return MAP_AREA_PALETTE[index % MAP_AREA_PALETTE.length];
    }

    function renderMiniMap(dataet) {
        var overlay = d3.select("#hierarchy-mini-map-panel .mini-map-overlay");
        if (overlay.empty()) return;

        var mapData = dataet.map || {};
        var areaData = Array.isArray(mapData.areas) ? mapData.areas : [];
        var buildingData = Array.isArray(mapData.buildings) ? mapData.buildings : [];

        overlay
            .attr("viewBox", "0 0 " + (mapData.imageWidth || 335) + " " + (mapData.imageHeight || 551))
            .attr("preserveAspectRatio", "xMidYMid meet");
        overlay.selectAll("*").remove();

        var caption = d3.select("#hierarchy-mini-map-panel .mini-map-caption");
        var areaGroup = overlay.append("g").attr("class", "mini-map-area-group");
        var markerGroup = overlay.append("g").attr("class", "mini-map-marker-group");

        var areaPath = areaGroup.selectAll(".mini-map-area")
            .data(areaData)
            .enter().append("path")
            .attr("class", "mini-map-area")
            .attr("d", function (item) { return item.path; })
            .style("fill", function (item, index) { return areaFillColor(index); })
            .style("opacity", 0);

        var marker = markerGroup.selectAll(".mini-map-building-dot")
            .data(buildingData)
            .enter().append("circle")
            .attr("class", "mini-map-building-dot")
            .attr("cx", function (item) { return item.x; })
            .attr("cy", function (item) { return item.y; })
            .attr("r", 2.5)
            .style("opacity", 0.45);

        var labelBg = markerGroup.selectAll(".mini-map-building-label-bg")
            .data(buildingData)
            .enter().append("rect")
            .attr("class", "mini-map-building-label-bg")
            .attr("rx", 4)
            .attr("ry", 4)
            .style("opacity", 0);

        var label = markerGroup.selectAll(".mini-map-building-label")
            .data(buildingData)
            .enter().append("text")
            .attr("class", "mini-map-building-label")
            .attr("x", function (item) { return item.x + item.labelDx; })
            .attr("y", function (item) { return item.y + item.labelDy; })
            .text(function (item) { return item.building; })
            .style("opacity", 0);

        function layoutLabelBackgrounds() {
            var nodes = [];
            label.each(function (d, i) { nodes[i] = this; });
            labelBg.each(function (d, i) {
                var node = nodes[i];
                if (!node || typeof node.getBBox !== "function") return;
                var bbox = node.getBBox();
                var padX = 5;
                var padY = 2;
                d3.select(this)
                    .attr("x", bbox.x - padX)
                    .attr("y", bbox.y - padY)
                    .attr("width", Math.max(0, bbox.width + padX * 2))
                    .attr("height", Math.max(0, bbox.height + padY * 2));
            });
        }

        layoutLabelBackgrounds();

        hierarchyState.miniMap = {
            areaData: areaData,
            update: function (options) {
                var opts = options || {};
                var activeAreas = Array.isArray(opts.areas) ? opts.areas : [];
                var activeBuildings = Array.isArray(opts.buildings) ? opts.buildings : [];
                var statusText = cleanText(opts.caption);

                var activeAreaSet = {};
                activeAreas.forEach(function (name) { activeAreaSet[name] = true; });
                var activeBuildingSet = {};
                activeBuildings.forEach(function (id) {
                    var key = normalizeBuildingId(id);
                    if (key) activeBuildingSet[key] = true;
                });

                areaPath.style("opacity", function (item) {
                    return activeAreaSet[item.area] ? 0.5 : 0;
                });

                marker
                    .attr("r", function (item) { return activeBuildingSet[item.buildingId] ? 4 : 2.5; })
                    .style("opacity", function (item) {
                        if (activeBuildingSet[item.buildingId]) return 1;
                        if (!activeBuildings.length) return 0.45;
                        return 0.2;
                    });

                labelBg.style("opacity", function (item) {
                    return activeBuildingSet[item.buildingId] ? 0.96 : 0;
                });

                label
                    .classed("is-active", function (item) { return !!activeBuildingSet[item.buildingId]; })
                    .style("opacity", function (item) {
                        return activeBuildingSet[item.buildingId] ? 1 : 0;
                    });

                if (!caption.empty()) {
                    if (statusText) {
                        caption.text(statusText);
                    } else {
                        caption.text("小地图定位：移动到建筑等级名称或金字塔图片查看对应区域");
                    }
                }
            }
        };

        hierarchyState.miniMap.update();
    }

    function resolveAreasForLevel(levelName) {
        if (!hierarchyState.miniMap || !Array.isArray(hierarchyState.miniMap.areaData)) return [];
        var areaData = hierarchyState.miniMap.areaData;
        var aliases = LEVEL_AREA_ALIASES[levelName] || [];
        var aliasKeys = aliases
            .map(function (name) { return normalizeAreaKey(name); })
            .filter(function (key) { return !!key; });
        var matched = [];
        var used = {};

        areaData.forEach(function (areaItem) {
            var areaKey = areaItem.areaKey || normalizeAreaKey(areaItem.area);
            var matchedAlias = aliasKeys.some(function (aliasKey) {
                if (!aliasKey || !areaKey) return false;
                return areaKey.indexOf(aliasKey) >= 0 || aliasKey.indexOf(areaKey) >= 0;
            });
            if (!matchedAlias) return;
            if (used[areaItem.area]) return;
            used[areaItem.area] = true;
            matched.push(areaItem.area);
        });

        if (matched.length) return matched;

        var fallbackIndexes = LEVEL_AREA_INDEX_FALLBACK[levelName] || [];
        fallbackIndexes.forEach(function (index) {
            if (!areaData[index]) return;
            if (used[areaData[index].area]) return;
            used[areaData[index].area] = true;
            matched.push(areaData[index].area);
        });

        return matched;
    }

    function setActiveLevel(levelName) {
        var targetLevel = cleanText(levelName);
        hierarchyState.activeLevel = targetLevel;

        d3.selectAll("#hierarchy-pyramid .hierarchy-pyramid-tier")
            .classed("is-active", function (item) {
                return !!targetLevel && item.name === targetLevel;
            });

        d3.selectAll("#hierarchy-heatmap .hierarchy-heatmap-row")
            .classed("is-active", function (item) {
                return !!targetLevel && item.levelName === targetLevel;
            });

        if (hierarchyState.rowBridge && typeof hierarchyState.rowBridge.update === "function") {
            hierarchyState.rowBridge.update(targetLevel);
        }

        if (!hierarchyState.miniMap) return;
        if (!targetLevel) {
            hierarchyState.miniMap.update();
            return;
        }

        var areas = resolveAreasForLevel(targetLevel);
        hierarchyState.miniMap.update({
            areas: areas,
            caption: "小地图定位：" + targetLevel + " 对应区域"
        });
    }

    function ensureRowBridgeOverlay(container) {
        var main = container ? container.querySelector(".hierarchy-main") : null;
        if (!main) return null;

        var existing = main.querySelector("#hierarchy-row-bridge");
        if (existing) return d3.select(existing);

        // 连接带覆盖层只承担视觉表达，不参与交互命中，避免影响金字塔与热力矩阵 hover。
        return d3.select(main)
            .insert("svg", ":first-child")
            .attr("id", "hierarchy-row-bridge")
            .attr("class", "hierarchy-row-bridge-overlay")
            .attr("aria-hidden", "true")
            .style("pointer-events", "none");
    }

    function buildRowBridgeGeometry(container, dataet, pyramidLayout, heatmapLayout) {
        var main = container ? container.querySelector(".hierarchy-main") : null;
        var pyramidSvg = container ? container.querySelector("#hierarchy-pyramid") : null;
        var heatmapSvg = container ? container.querySelector("#hierarchy-heatmap") : null;
        if (!main || !pyramidSvg || !heatmapSvg) return null;

        var mainRect = main.getBoundingClientRect();
        var pyramidRect = pyramidSvg.getBoundingClientRect();
        var heatmapRect = heatmapSvg.getBoundingClientRect();

        if (!mainRect.width || !mainRect.height || !pyramidRect.width || !heatmapRect.width) return null;

        var pyramidGeometry = computePyramidTierGeometry(dataet, pyramidLayout);
        var pyramidScaleX = pyramidRect.width / Math.max(1, pyramidLayout.pyramidWidth);
        var pyramidScaleY = pyramidRect.height / Math.max(1, pyramidLayout.pyramidHeight);
        var heatmapScaleX = heatmapRect.width / Math.max(1, heatmapLayout.heatmapWidth);
        var heatmapScaleY = heatmapRect.height / Math.max(1, heatmapLayout.heatmapHeight);
        var heatmapLeftXInMain = heatmapRect.left + heatmapLayout.gridLeft * heatmapScaleX - mainRect.left;

        // 为每个等级行计算“金字塔右边界 -> 热力矩阵左边界”的连接四边形。
        var rows = pyramidGeometry.tierData.map(function (tier, rowIndex) {
            var level = dataet.levels[rowIndex];
            if (!level) return null;

            var pyramidTopX = pyramidRect.left + (pyramidGeometry.centerX + tier.w0) * pyramidScaleX - mainRect.left;
            var pyramidBottomX = pyramidRect.left + (pyramidGeometry.centerX + tier.w1) * pyramidScaleX - mainRect.left;
            var pyramidTopY = pyramidRect.top + tier.y0 * pyramidScaleY - mainRect.top;
            var pyramidBottomY = pyramidRect.top + tier.y1 * pyramidScaleY - mainRect.top;

            var heatmapTopY = heatmapRect.top + (heatmapLayout.gridTop + heatmapLayout.rowHeight * rowIndex) * heatmapScaleY - mainRect.top;
            var heatmapBottomY = heatmapRect.top + (heatmapLayout.gridTop + heatmapLayout.rowHeight * (rowIndex + 1)) * heatmapScaleY - mainRect.top;

            // 上下边界分别贴合两张图自身的当前行高度，确保连接带与行区块对齐。
            var points = [
                [pyramidTopX, pyramidTopY],
                [heatmapLeftXInMain, heatmapTopY],
                [heatmapLeftXInMain, heatmapBottomY],
                [pyramidBottomX, pyramidBottomY]
            ];

            return {
                levelName: level.name,
                points: points
            };
        }).filter(function (item) { return item !== null; });

        return {
            width: Math.max(1, mainRect.width),
            height: Math.max(1, mainRect.height),
            rows: rows
        };
    }

    function renderRowBridge(container, dataet, pyramidLayout, heatmapLayout) {
        var overlay = ensureRowBridgeOverlay(container);
        if (!overlay) {
            hierarchyState.rowBridge = null;
            return;
        }

        var geometry = buildRowBridgeGeometry(container, dataet, pyramidLayout, heatmapLayout);
        if (!geometry) {
            hierarchyState.rowBridge = null;
            return;
        }

        overlay
            .attr("viewBox", "0 0 " + geometry.width + " " + geometry.height)
            .attr("preserveAspectRatio", "none");

        var bands = overlay.selectAll(".hierarchy-row-bridge-band")
            .data(geometry.rows, function (item) { return item.levelName; });

        bands.exit().remove();

        var bandsEnter = bands.enter()
            .append("path")
            .attr("class", "hierarchy-row-bridge-band");

        bands = bandsEnter.merge(bands)
            .attr("d", function (item) {
                return "M" + item.points.map(function (point) {
                    return point[0] + "," + point[1];
                }).join("L") + "Z";
            });

        hierarchyState.rowBridge = {
            update: function (activeLevel) {
                var levelName = cleanText(activeLevel);
                bands.classed("is-active", function (item) {
                    return !!levelName && item.levelName === levelName;
                });
            }
        };

        hierarchyState.rowBridge.update(hierarchyState.activeLevel);
    }

    function computePyramidTierGeometry(dataet, layout) {
        var centerX = layout.pyramidWidth * 0.5;
        var apexY = layout.tierTop;
        var baseY = layout.tierBottom;
        var halfBase = layout.pyramidWidth * 0.43;
        var viewportWidth = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || layout.pyramidWidth;
        var topBaseWidth = viewportWidth * (PYRAMID_TOP_BASE_VW / 100);
        var halfTop = clamp(topBaseWidth * 0.5, 0, halfBase);
        var fullHeight = Math.max(1, baseY - apexY);

        function widthAtY(y) {
            var t = clamp((y - apexY) / fullHeight, 0, 1);
            return halfTop + (halfBase - halfTop) * t;
        }

        // 金字塔坐标预计算：
        // 1) 先根据 y 位置映射出该高度处的半宽；
        // 2) 再为每个等级层生成梯形四个顶点与路径；
        // 3) 渲染阶段仅消费这些几何结果，不再参与坐标推导。
        var tierData = dataet.levels.map(function (levelItem, index) {
            var y0 = apexY + layout.rowHeight * index;
            var y1 = y0 + layout.rowHeight;
            var w0 = widthAtY(y0);
            var w1 = widthAtY(y1);
            return {
                name: levelItem.name,
                imageUrl: levelItem.imageUrl,
                index: index,
                y0: y0,
                y1: y1,
                w0: w0,
                w1: w1,
                path: [
                    "M", centerX - w0, ",", y0,
                    "L", centerX + w0, ",", y0,
                    "L", centerX + w1, ",", y1,
                    "L", centerX - w1, ",", y1,
                    "Z"
                ].join("")
            };
        });

        return {
            centerX: centerX,
            apexY: apexY,
            baseY: baseY,
            halfBase: halfBase,
            halfTop: halfTop,
            tierData: tierData
        };
    }

    function renderPyramid(dataet, layout) {
        var svg = d3.select("#hierarchy-pyramid");
        if (svg.empty()) return;

        svg
            .attr("viewBox", "0 0 " + layout.pyramidWidth + " " + layout.pyramidHeight)
            .attr("preserveAspectRatio", "xMidYMid meet");
        svg.selectAll("*").remove();

        var defs = svg.append("defs");
        var baseGroup = svg.append("g");
        var geometry = computePyramidTierGeometry(dataet, layout);
        var centerX = geometry.centerX;
        var apexY = geometry.apexY;
        var baseY = geometry.baseY;
        var halfBase = geometry.halfBase;
        var halfTop = geometry.halfTop;
        var tierData = geometry.tierData;

        baseGroup.append("line")
            .attr("x1", centerX - halfTop)
            .attr("y1", apexY)
            .attr("x2", centerX - halfBase)
            .attr("y2", baseY)
            .attr("class", "hierarchy-tier-divider");

        baseGroup.append("line")
            .attr("x1", centerX + halfTop)
            .attr("y1", apexY)
            .attr("x2", centerX + halfBase)
            .attr("y2", baseY)
            .attr("class", "hierarchy-tier-divider");

        // 为每一层建立独立裁剪区域，保证层级图片只显示在对应梯形内部。
        tierData.forEach(function (tier) {
            defs.append("clipPath")
                .attr("id", "hierarchy-tier-clip-" + tier.index)
                .append("path")
                .attr("d", tier.path);
        });

        var tierGroup = baseGroup.selectAll(".hierarchy-pyramid-tier")
            .data(tierData)
            .enter().append("g")
            .attr("class", "hierarchy-pyramid-tier")
            .attr("tabindex", 0);

        // 绘制金字塔每层的梯形轮廓。
        tierGroup.append("path")
            .attr("class", "hierarchy-tier-outline")
            .attr("d", function (item) { return item.path; });

        // 将对应层图片铺入梯形区域，并通过 clip-path 裁切到本层范围。
        tierGroup.append("image")
            .attr("class", "hierarchy-tier-image")
            .attr("xlink:href", function (item) { return item.imageUrl; })
            .attr("x", function (item) { return centerX - item.w1 + 2; })
            .attr("y", function (item) { return item.y0 + 2; })
            .attr("width", function (item) { return Math.max(4, item.w1 * 2 - 4); })
            .attr("height", function (item) { return Math.max(4, layout.rowHeight - 4); })
            .attr("preserveAspectRatio", "xMidYMid slice")
            .attr("clip-path", function (item) { return "url(#hierarchy-tier-clip-" + item.index + ")"; });

        // 绘制每层底边分隔线，强化层与层之间的视觉边界。
        tierGroup.append("line")
            .attr("class", "hierarchy-tier-divider")
            .attr("x1", function (item) { return centerX - item.w1; })
            .attr("x2", function (item) { return centerX + item.w1; })
            .attr("y1", function (item) { return item.y1; })
            .attr("y2", function (item) { return item.y1; });

        var labels = tierGroup.append("text")
            .attr("class", "hierarchy-tier-label")
            .attr("x", centerX + PYRAMID_LABEL_OFFSET_X)
            .attr("y", function (item) { return (item.y0 + item.y1) / 2; })
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .text(function (item) { return item.name; });

        labels.each(function () {
            var node = this;
            if (!node || typeof node.getBBox !== "function") return;
            var bbox = node.getBBox();
            d3.select(node.parentNode).insert("rect", "text")
                .attr("class", "hierarchy-tier-label-bg")
                .attr("x", bbox.x - 10)
                .attr("y", bbox.y - 4)
                .attr("width", bbox.width + 20)
                .attr("height", bbox.height + 8)
                .attr("rx", 7)
                .attr("ry", 7);
        });

        tierGroup
            .on("mouseenter", function (item) { setActiveLevel(item.name); })
            .on("mouseleave", function () { setActiveLevel(""); })
            .on("focus", function (item) { setActiveLevel(item.name); })
            .on("blur", function () { setActiveLevel(""); });
    }

    function tintByPercentage(colorHex, percentage) {
        var base = d3.rgb(colorHex || "#8D6A49");
        var amount = clamp(percentage / 100, 0, 1);
        return d3.interpolateRgb("#FFF4E2", base.toString())(0.26 + amount * 0.74);
    }

    function showTooltip(cellData) {
        if (!hierarchyState.tooltipElement) return;

        var tooltip = hierarchyState.tooltipElement;
        var html = "";
        html += "<p class=\"hierarchy-tooltip-title\">" + escapeHtml(cellData.houseType + " / " + cellData.levelName) + "</p>";

        if (!cellData.entries.length) {
            html += "<div class=\"hierarchy-tooltip-empty\">无纹样数据</div>";
        } else {
            cellData.entries.forEach(function (entry) {
                var hidden = hierarchyState.patternVisibility[entry.pattern] === false;
                var suffix = hidden ? "（已隐藏）" : "";
                html += "<div class=\"hierarchy-tooltip-row\"><span>" + escapeHtml(entry.pattern + suffix) +
                    "</span><span>" + entry.percentage.toFixed(1).replace(/\.0$/, "") + "%</span></div>";
            });
        }

        tooltip.innerHTML = html;
        tooltip.classList.add("is-visible");
        tooltip.setAttribute("aria-hidden", "false");
    }

    function resolveLayoutScale() {
        return (typeof window.APP_LAYOUT_SCALE === "number" && window.APP_LAYOUT_SCALE > 0)
            ? window.APP_LAYOUT_SCALE
            : 1;
    }

    function resolveFixedCoordScale() {
        if (hierarchyState.fixedCoordScale && hierarchyState.fixedCoordScale > 0) {
            return hierarchyState.fixedCoordScale;
        }

        var fallbackScale = resolveLayoutScale();
        var body = document.body;
        if (!body) {
            hierarchyState.fixedCoordScale = fallbackScale;
            return hierarchyState.fixedCoordScale;
        }

        // 探测 fixed 坐标基准是否受 body transform 影响。
        var probe = document.createElement("div");
        probe.style.position = "fixed";
        probe.style.left = "100px";
        probe.style.top = "0";
        probe.style.width = "1px";
        probe.style.height = "1px";
        probe.style.opacity = "0";
        probe.style.pointerEvents = "none";
        probe.style.zIndex = "-1";
        body.appendChild(probe);

        var rect = probe.getBoundingClientRect();
        body.removeChild(probe);

        var measuredScale = rect && isFinite(rect.left) ? rect.left / 100 : NaN;
        if (!isFinite(measuredScale) || measuredScale <= 0) {
            measuredScale = fallbackScale;
        }

        if (Math.abs(measuredScale - 1) < 0.02) {
            hierarchyState.fixedCoordScale = 1;
            return hierarchyState.fixedCoordScale;
        }
        if (Math.abs(measuredScale - fallbackScale) < 0.06) {
            hierarchyState.fixedCoordScale = fallbackScale;
            return hierarchyState.fixedCoordScale;
        }

        hierarchyState.fixedCoordScale = Math.max(0.1, Math.min(2, measuredScale));
        return hierarchyState.fixedCoordScale;
    }

    window.addEventListener("app:layout-scale-change", function () {
        hierarchyState.fixedCoordScale = null;
        hideTooltip();
    });

    function moveTooltip() {
        if (!hierarchyState.tooltipElement) return;
        var tooltip = hierarchyState.tooltipElement;
        if (!tooltip.classList.contains("is-visible")) return;
        if (!d3.event) return;

        var coordScale = resolveFixedCoordScale();
        var visualOffset = 14;
        var visualMargin = 10;
        var minVisualMargin = 8;
        var offset = visualOffset / coordScale;
        var margin = visualMargin / coordScale;
        var minMargin = minVisualMargin / coordScale;

        var x = d3.event.clientX / coordScale + offset;
        var y = d3.event.clientY / coordScale + offset;
        var rect = tooltip.getBoundingClientRect();
        var tooltipWidth = rect.width / coordScale;
        var tooltipHeight = rect.height / coordScale;
        var viewportWidth = window.innerWidth / coordScale;
        var viewportHeight = window.innerHeight / coordScale;
        var maxX = viewportWidth - tooltipWidth - margin;
        var maxY = viewportHeight - tooltipHeight - margin;
        if (x > maxX) x = Math.max(minMargin, maxX);
        if (y > maxY) y = Math.max(minMargin, maxY);

        tooltip.style.left = x + "px";
        tooltip.style.top = y + "px";
    }

    function hideTooltip() {
        if (!hierarchyState.tooltipElement) return;
        hierarchyState.tooltipElement.classList.remove("is-visible");
        hierarchyState.tooltipElement.setAttribute("aria-hidden", "true");
    }

    function computeHeatmapGeometry(dataet, layout) {
        var cellPaddingX = 2.5;
        var cellPaddingY = 2.5;

        // 热力矩阵坐标预计算：
        // 1) 先按“等级”生成每一行的 y 位置；
        // 2) 再按“建筑类型”生成每个单元格的 x 位置与内边距盒；
        // 3) 绘制阶段直接消费这些结果，避免在绘制循环中重复推导坐标。
        var rowData = dataet.levels.map(function (levelItem) {
            var rowY = layout.gridTop + layout.rowHeight * levelItem.index;
            var cells = dataet.houseTypes.map(function (houseType, colIndex) {
                var key = levelItem.name + "||" + houseType;
                var cell = dataet.cellsByKey[key] || {
                    levelName: levelItem.name,
                    houseType: houseType,
                    entries: []
                };

                return {
                    levelName: levelItem.name,
                    levelIndex: levelItem.index,
                    houseType: houseType,
                    colIndex: colIndex,
                    entries: cell.entries || [],
                    x: layout.gridLeft + colIndex * layout.cellWidth,
                    innerX: cellPaddingX,
                    innerY: cellPaddingY,
                    innerWidth: Math.max(0, layout.cellWidth - cellPaddingX * 2),
                    innerHeight: Math.max(0, layout.rowHeight - cellPaddingY * 2)
                };
            });

            return {
                levelName: levelItem.name,
                levelIndex: levelItem.index,
                y: rowY,
                cells: cells
            };
        });

        return {
            rowData: rowData
        };
    }

    function renderHeatmap(dataet, layout) {
        var svg = d3.select("#hierarchy-heatmap");
        if (svg.empty()) return;

        svg
            .attr("viewBox", "0 0 " + layout.heatmapWidth + " " + layout.heatmapHeight)
            .attr("preserveAspectRatio", "xMidYMid meet");
        svg.selectAll("*").remove();

        var chart = svg.append("g");
        var colCount = layout.colCount;
        var rowCount = layout.rowCount;
        var heatmapGeometry = computeHeatmapGeometry(dataet, layout);
        var rowData = heatmapGeometry.rowData;

        var colGuides = chart.append("g");
        // 按列绘制纵向网格线，每一条线对应热力矩阵的列边界。
        for (var ci = 0; ci <= colCount; ci++) {
            var x = layout.gridLeft + layout.cellWidth * ci;
            colGuides.append("line")
                .attr("class", "hierarchy-col-guide")
                .attr("x1", x)
                .attr("x2", x)
                .attr("y1", layout.gridTop)
                .attr("y2", layout.gridTop + layout.rowHeight * rowCount);
        }

        var rowGuides = chart.append("g");
        // 按行绘制横向网格线，每一条线对应热力矩阵的行边界。
        for (var ri = 0; ri <= rowCount; ri++) {
            var y = layout.gridTop + layout.rowHeight * ri;
            rowGuides.append("line")
                .attr("class", "hierarchy-row-guide")
                .attr("x1", layout.gridLeft)
                .attr("x2", layout.gridLeft + layout.gridWidth)
                .attr("y1", y)
                .attr("y2", y);
        }

        chart.append("g")
            .selectAll(".hierarchy-col-title")
            .data(dataet.houseTypes)
            .enter().append("text")
            .attr("class", "hierarchy-col-title")
            .attr("x", function (houseType, index) {
                return layout.gridLeft + layout.cellWidth * index + layout.cellWidth / 2;
            })
            .attr("y", layout.columnTitleY)
            .attr("text-anchor", "middle")
            .text(function (houseType) { return houseType; });

        // 为热力矩阵的每一行创建分组，后续在行分组内继续按列放置单元格。
        var rowGroup = chart.append("g")
            .selectAll(".hierarchy-heatmap-row")
            .data(rowData)
            .enter().append("g")
            .attr("class", "hierarchy-heatmap-row")
            .attr("transform", function (row) {
                 return "translate(0," + row.y + ")";
            });

        // 逐行绘制格子：先整理“当前行 x 全部列”的单元格数据。
        rowGroup.each(function (row) {
            var group = d3.select(this);

            // 在当前行内按列创建单元格容器，并定位到各列的 x 坐标。
            var cellGroup = group.selectAll(".hierarchy-cell")
                .data(row.cells)
                .enter().append("g")
                .attr("class", "hierarchy-cell")
                .attr("transform", function (cell) {
                    return "translate(" + cell.x + ",0)";
                });

            // 绘制单元格底板（每行每列的基础格子背景）。
            cellGroup.append("rect")
                .attr("class", "hierarchy-cell-base")
                .attr("x", function (cell) { return cell.innerX; })
                .attr("y", function (cell) { return cell.innerY; })
                .attr("width", function (cell) { return cell.innerWidth; })
                .attr("height", function (cell) { return cell.innerHeight; });

            // 在单元格内部按纹样占比绘制分段色块，并从左到右累积偏移量。
            cellGroup.each(function (cell) {
                var cellInner = d3.select(this);
                var segmentLayer = cellInner.append("g");
                var cellInnerWidth = cell.innerWidth;
                var cursor = cell.innerX;

                cell.entries.forEach(function (entry) {
                    var segmentWidth = cellInnerWidth * clamp(entry.percentage / 100, 0, 1);
                    var isVisible = hierarchyState.patternVisibility[entry.pattern] !== false;
                    segmentLayer.append("rect")
                        .attr("class", "hierarchy-cell-segment")
                        .attr("x", cursor)
                        .attr("y", cell.innerY)
                        .attr("width", Math.max(0, segmentWidth))
                        .attr("height", cell.innerHeight)
                        .style("fill", tintByPercentage(dataet.patternColors[entry.pattern], entry.percentage))
                        .style("opacity", isVisible ? 1 : 0);
                    cursor += segmentWidth;
                });
            });

            cellGroup
                .on("mouseenter", function (cell) {
                    setActiveLevel(cell.levelName);
                    showTooltip(cell);
                    moveTooltip();
                })
                .on("mousemove", function () {
                    moveTooltip();
                })
                .on("mouseleave", function () {
                    hideTooltip();
                    setActiveLevel("");
                });
        });

        if (hierarchyState.activeLevel) {
            setActiveLevel(hierarchyState.activeLevel);
        }
    }

    function renderLegend(dataet, container) {
        var legend = d3.select("#hierarchy-legend");
        if (legend.empty()) return;
        var hostContainer = container || document.getElementById("hierarchy-container");

        var items = legend.selectAll(".hierarchy-legend-item")
            .data(dataet.patterns, function (name) { return name; });

        items.exit().remove();

        var itemsEnter = items.enter()
            .append("button")
            .attr("type", "button")
            .attr("class", "hierarchy-legend-item")
            .on("click", function (patternName) {
                var current = hierarchyState.patternVisibility[patternName] !== false;
                hierarchyState.patternVisibility[patternName] = !current;
                hideTooltip();
                renderLegend(dataet, hostContainer);

                // 图例按钮换行高度可能变化，先同步左侧标题高度，再重算热力矩阵布局并重绘。
                syncPyramidTitleHeight(hostContainer);
                var nextHeatmapLayout = computeHeatmapLayout(hostContainer, dataet);
                if (nextHeatmapLayout) {
                    renderHeatmap(dataet, nextHeatmapLayout);
                }
            });

        itemsEnter.append("span").attr("class", "hierarchy-legend-swatch");
        itemsEnter.append("span").attr("class", "hierarchy-legend-label");

        items = itemsEnter.merge(items);

        items
            .classed("is-disabled", function (patternName) {
                return hierarchyState.patternVisibility[patternName] === false;
            });

        items.select(".hierarchy-legend-swatch")
            .style("background-color", function (patternName) {
                return dataet.patternColors[patternName];
            });

        items.select(".hierarchy-legend-label")
            .text(function (patternName) { return patternName; });
    }

    function renderHierarchyCharts(container, dataet) {
        renderLegend(dataet, container);
        syncPyramidTitleHeight(container);

        var pyramidLayout = computePyramidLayout(container, dataet);
        var heatmapLayout = computeHeatmapLayout(container, dataet);
        if (!pyramidLayout || !heatmapLayout) return false;

        renderMiniMap(dataet);
        renderPyramid(dataet, pyramidLayout);
        renderHeatmap(dataet, heatmapLayout);
        renderRowBridge(container, dataet, pyramidLayout, heatmapLayout);
        setActiveLevel("");
        hideTooltip();
        return true;
    }

    function renderHierarchyPage() {
        var container = document.getElementById("hierarchy-container");
        if (!container) return;
        if (!container.classList.contains("is-active")) return;

        loadData(function (error, dataet) {
            if (error) {
                if (window.console && window.console.error) {
                    window.console.error("[hierarchy] 数据加载失败", error);
                }
                return;
            }

            ensurePatternVisibility(dataet);
            hierarchyState.tooltipElement = document.getElementById("hierarchy-tooltip");
            ensurePyramidTitleElement(container);

            if (renderHierarchyCharts(container, dataet)) return;

            // 页面刚切入时若尺寸尚未稳定，下一帧再尝试一次，避免首次进入渲染尺寸异常。
            window.requestAnimationFrame(function () {
                if (!container.classList.contains("is-active")) return;
                renderHierarchyCharts(container, dataet);
            });
        });
    }

    window.create_level_hierarchy_page = renderHierarchyPage;
})();
