
// 主渲染流程：
// 1) 根据当前视口宽度计算响应式几何参数；
// 2) 加载并规整数据，生成各图层可直接使用的视图模型；
// 3) 构建 SVG 静态层（环形、标签、悬浮命中区、注释）；
// 4) 使用 Canvas 绘制高频变化的连线以提升性能；
// 5) 绑定悬浮交互，切换连线子集与中心预览图。
//
// 术语说明（沿用原始代码命名）：
// - chapter   => 建筑
// - character => 纹样
function create_CCS_chart() {

    ////////////////////////////////////////////////////////////// 
    ////////////////// Set-up sizes of the page //////////////////
    ////////////////////////////////////////////////////////////// 
    
    var container = d3.select("#chart");
    var chart_container = d3.select("#chart-container");
    var mini_map_debug_mode = /(?:^|[?&])mapDebug=1(?:&|$)/.test(window.location.search);
    var building_info_field_defs = [
        { key: "area", label: "区域" },
        { key: "architecture", label: "建筑" },
        { key: "time", label: "时代" },
        { key: "pattern", label: "纹样" },
        { key: "introduction_details", label: "详细介绍" }
    ];
    var pattern_info_field_defs = [
        { key: "type", label: "纹样" },
        { key: "populartime", label: "流行年代" },
        { key: "meanings", label: "寓意" },
        { key: "intruductions", label: "详细介绍" }
    ];

    // 信息栏中需要占整行显示的长文本字段（建筑/纹样共用）。
    function is_sidebar_long_text_field(field_key) {
        return field_key === "introduction_details" || field_key === "intruductions";
    }

    // Ensure mini-map shell exists once; overlay content is rebuilt per render.
    var mini_map_panel = chart_container.select("#mini-map-panel");
    if (mini_map_panel.empty()) {
        mini_map_panel = chart_container.append("div")
            .attr("id", "mini-map-panel")
            .attr("class", "mini-map-panel");

        var mini_map_frame = mini_map_panel.append("div")
            .attr("class", "mini-map-frame");

        mini_map_frame.append("img")
            .attr("class", "mini-map-image")
            .attr("src", "datas/imgs/map/map.png")
            .attr("alt", "故宫建筑分区小地图");

        mini_map_frame.append("svg")
            .attr("class", "mini-map-overlay")
            .attr("aria-hidden", "true");

        mini_map_panel.append("div")
            .attr("class", "mini-map-caption")
            .text("小地图定位：移动到建筑或区域查看对应位置");
    }
    mini_map_panel.classed("mini-map-debug", mini_map_debug_mode);

    // 建筑详情侧边栏容器（点击建筑后显示）。
    var building_info_panel = chart_container.select("#building-info-panel");
    if (building_info_panel.empty()) {
        building_info_panel = chart_container.append("aside")
            .attr("id", "building-info-panel")
            .attr("class", "building-info-panel")
            .attr("aria-hidden", "true");

        var building_info_inner = building_info_panel.append("div")
            .attr("class", "building-info-inner");
        var building_info_header = building_info_inner.append("div")
            .attr("class", "building-info-header");

        building_info_header.append("div")
            .attr("class", "building-info-title")
            .text("建筑介绍");
        building_info_header.append("button")
            .attr("type", "button")
            .attr("class", "building-info-close")
            .attr("aria-label", "关闭建筑介绍")
            .text("×");

        var building_info_grid = building_info_inner.append("div")
            .attr("class", "building-info-grid");
        var building_info_row = building_info_grid.selectAll(".building-info-row")
            .data(building_info_field_defs)
            .enter().append("div")
            .attr("class", function (d) {
                return "building-info-row" + (is_sidebar_long_text_field(d.key) ? " is-introduction" : "");
            });

        building_info_row.append("div")
            .attr("class", "building-info-key")
            .text(function (d) { return d.label; });
        building_info_row.append("div")
            .attr("class", "building-info-value")
            .attr("data-field", function (d) { return d.key; })
            .text("—");

        // “其他”纹样的二级选择区：默认隐藏，仅在点击“其他”时显示。
        var building_info_extra = building_info_inner.append("div")
            .attr("class", "building-info-extra");
        building_info_extra.append("div")
            .attr("class", "building-info-extra-title")
            .text("其他 / 纹样种类");
        building_info_extra.append("div")
            .attr("class", "building-info-extra-list");
    }
    building_info_panel
        .classed("is-visible", false)
        .attr("aria-hidden", "true");
    building_info_panel.selectAll(".building-info-value").text("—");
    chart_container.classed("building-info-visible", false);
    var building_info_title = building_info_panel.select(".building-info-title");
    var building_info_close_button = building_info_panel.select(".building-info-close");
    var building_info_grid = building_info_panel.select(".building-info-grid");
    var building_info_extra = building_info_panel.select(".building-info-extra");
    if (building_info_extra.empty()) {
        var building_info_inner_fallback = building_info_panel.select(".building-info-inner");
        building_info_extra = building_info_inner_fallback.append("div")
            .attr("class", "building-info-extra");
        building_info_extra.append("div")
            .attr("class", "building-info-extra-title")
            .text("其他 / 纹样种类");
        building_info_extra.append("div")
            .attr("class", "building-info-extra-list");
    }
    var building_info_extra_title = building_info_panel.select(".building-info-extra-title");
    var building_info_extra_list = building_info_panel.select(".building-info-extra-list");
    building_info_extra.classed("is-visible", false);

    // 区域介绍栏（悬浮区域/建筑时显示）。
    var area_info_panel = chart_container.select("#area-info-panel");
    if (area_info_panel.empty()) {
        area_info_panel = chart_container.append("aside")
            .attr("id", "area-info-panel")
            .attr("class", "area-info-panel")
            .attr("aria-hidden", "true");

        var area_info_inner = area_info_panel.append("div")
            .attr("class", "area-info-inner");
        area_info_inner.append("div")
            .attr("class", "area-info-badge")
            .text("区域介绍");
        area_info_inner.append("h3")
            .attr("class", "area-info-title")
            .text("区域");
        area_info_inner.append("p")
            .attr("class", "area-info-description")
            .text("移动到区域或建筑图标查看介绍");
    }
    area_info_panel
        .classed("is-visible", false)
        .attr("aria-hidden", "true");
    var area_info_badge = area_info_panel.select(".area-info-badge");
    var area_info_title = area_info_panel.select(".area-info-title");
    var area_info_description = area_info_panel.select(".area-info-description");

    // 纹样 -> 区域分布扇形图（悬浮/锁定纹样时显示）。
    var pattern_area_panel = chart_container.select("#pattern-area-panel");
    if (pattern_area_panel.empty()) {
        pattern_area_panel = chart_container.append("aside")
            .attr("id", "pattern-area-panel")
            .attr("class", "area-info-panel pattern-area-panel")
            .attr("aria-hidden", "true");

        var pattern_area_inner = pattern_area_panel.append("div")
            .attr("class", "pattern-area-inner");
        pattern_area_inner.append("div")
            .attr("class", "pattern-area-title")
            .text("纹样区域分布");
        var pattern_area_svg = pattern_area_inner.append("svg")
            .attr("class", "pattern-area-svg")
            .attr("viewBox", "0 0 220 180")
            .attr("aria-hidden", "true");
        var pattern_area_root = pattern_area_svg.append("g")
            .attr("class", "pattern-area-root")
            .attr("transform", "translate(110,92)");
        pattern_area_root.append("circle")
            .attr("class", "pattern-area-bg-ring")
            .attr("r", 90);//扇形白色背景半径
        pattern_area_root.append("circle")
            .attr("class", "pattern-area-hole")
            .attr("r", 40);//扇形内空白区域半径
        pattern_area_root.append("g").attr("class", "pattern-area-slices");
        pattern_area_root.append("g").attr("class", "pattern-area-labels");
        pattern_area_root.append("text")//中心纹样名文本
            .attr("class", "pattern-area-center")
            .attr("text-anchor", "middle")
            .text("纹样");
        pattern_area_inner.append("div")
            .attr("class", "pattern-area-legend");
    }
    pattern_area_panel
        .classed("is-visible", false)
        .attr("aria-hidden", "true");
    var pattern_area_slices_group = pattern_area_panel.select(".pattern-area-slices");
    var pattern_area_labels_group = pattern_area_panel.select(".pattern-area-labels");
    var pattern_area_center_text = pattern_area_panel.select(".pattern-area-center");
    var pattern_area_legend = pattern_area_panel.select(".pattern-area-legend");
    pattern_area_slices_group.selectAll(".pattern-area-slice").remove();
    pattern_area_labels_group.selectAll(".pattern-area-label").remove();
    pattern_area_center_text.text("纹样");
    pattern_area_legend.selectAll(".pattern-area-legend-item").remove();

    // Remove the previous chart before re-rendering
    container.selectAll("svg, canvas").remove();
    container.style("height", null);
    document.body.style.width = null;

    var base_width = 1600;
    var layout_scale = typeof window.APP_LAYOUT_SCALE === "number" && window.APP_LAYOUT_SCALE > 0
        ? window.APP_LAYOUT_SCALE
        : 1;
    var virtual_inner_width = window.innerWidth / layout_scale;
    var virtual_inner_height = window.innerHeight / layout_scale;
    var ww = virtual_inner_width;
    // Keep the visualization responsive while focusing on the chart only
    var width = Math.round(Math.min(base_width, Math.max(320, ww * 0.96)));
    var height = width;
    var size_factor = width / base_width;

    // ===== 右侧信息栏常用调参区（推荐优先改这里） =====
    var building_info_outer_ring_ratio = 0.4;   // 最外圈半径比例（与 rad_card_label 保持一致时建议 0.4）
    var building_info_side_gap_ratio = 0.16;    // 右侧可用区两侧留白比例（0.15 = 两端各留 15%）
    var building_info_height_ratio = 0.65;      // 信息栏高度占视口比例
    var building_info_min_height = 220;         // 信息栏最小高度
    var building_info_max_height = 650;         // 信息栏最大高度
    var building_info_font_scale = 1.8;           // 字体整体倍率（例如 1.15 / 1.25）

    // ===== 左下角区域介绍栏调参区 =====
    // 以下变量可直接用于调节区域介绍栏的尺寸/位置/字号倍率。
    var area_info_width = Math.round(Math.max(236, Math.min(400, ww * 0.35)));
    var area_info_min_height = Math.round(Math.max(116, Math.min(148, virtual_inner_height * 0.16)));
    var area_info_max_height = Math.round(Math.max(area_info_min_height + 28, Math.min(500, virtual_inner_height * 0.45)));
    var area_info_left = 40;
    var area_info_bottom = 200;
    var area_info_font_scale = 1.6;

    // 信息栏简化规则：
    // 1) 可用区 = 外圈最右点 到 页面最右边；
    // 2) 两端各留 side_gap_ratio 比例空隙，中间放信息栏。
    var outer_ring_right = width * building_info_outer_ring_ratio;
    var right_space_span = Math.max(0, ww / 2 - outer_ring_right);
    var side_gap = right_space_span * building_info_side_gap_ratio;
    var building_info_width = Math.round(Math.max(0, right_space_span - side_gap * 2));
    var building_info_left_offset = Math.round(outer_ring_right + side_gap);
    var building_info_height = Math.round(
        Math.max(building_info_min_height, Math.min(building_info_max_height, virtual_inner_height * building_info_height_ratio))
    );
    // 这 4 个 CSS 变量对应位置/尺寸/字体：
    // --building-info-width / --building-info-left-offset / --building-info-height / --building-info-font-scale
    chart_container
        .style("--building-info-width", building_info_width + "px")
        .style("--building-info-left-offset", building_info_left_offset + "px")
        .style("--building-info-height", building_info_height + "px")
        .style("--building-info-font-scale", building_info_font_scale)
        .style("--area-info-width", area_info_width + "px")
        .style("--area-info-min-height", area_info_min_height + "px")
        .style("--area-info-max-height", area_info_max_height + "px")
        .style("--area-info-left", area_info_left + "px")
        .style("--area-info-bottom", area_info_bottom + "px")
        .style("--area-info-font-scale", area_info_font_scale);

    area_info_badge.text("区域介绍");
    area_info_title.text("区域");
    area_info_description.text("移动到区域或建筑图标查看介绍");

    container.style("height", height + "px");

    document.querySelector("html").style.setProperty("--annotation-title-font-size", Math.min(14, 15 * size_factor) + "px");
    document.querySelector("html").style.setProperty("--annotation-label-font-size", Math.min(14, 15 * size_factor) + "px");

    ////////////////////////////////////////////////////////////// 
    //////////////////// Create SVG & Canvas /////////////////////
    ////////////////////////////////////////////////////////////// 

    //Canvas
    var canvas = container.append("canvas").attr("id", "canvas-target")
    var ctx = canvas.node().getContext("2d");
    crispyCanvas(canvas, ctx, 2);
    ctx.translate(width/2,height/2);
    //General canvas settings
    ctx.globalCompositeOperation = "multiply";
    ctx.lineCap = "round";
    ctx.lineWidth = 3 * size_factor;

    //SVG container
    var svg = container.append("svg")
        .attr("id","CCS-SVG")
        .attr("width", width)
        .attr("height", height);

    var chart = svg.append("g")
        .attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")");

    var defs = chart.append("defs");

    //////////////////////////////////////////////////////////////
    //////////////// Initialize helpers and scales ///////////////
    //////////////////////////////////////////////////////////////

    var num_chapters = 0,
        num_volume = 0;
    var pi2 = 2*Math.PI,
        pi1_2 = Math.PI/2;

    var cover_alpha = 0.3;
    var simulation;
    var remove_text_timer;

    var color_sakura = "#EB5580",
        color_syaoran = "#4fb127";

    //Has a mouseover just happened
    var mouse_over_in_action = false;

    //Radii at which the different parts of the visual should be created
    var rad_card_label = width * 0.4, //capture card text on the outside
        rad_cover_outer = width * 0.395, //outside of the hidden cover hover
        rad_cover_inner = width * 0.350, //inside of the hidden cover hover
        //rad_volume_donut_outer = width * 0.427, //outer radius of the volume donut
        //rad_volume_donut_inner = width * 0.425, //inner radius of the volume donut
        rad_color = width * 0.378, //彩色图标圆心所处圆的半径 (slightly outward to make room for area labels)
        rad_area_label = width * 0.344, //area圈文字排版半径
        rad_chapter_outer = width * 0.3499, //outside of the hidden chapter hover
        rad_chapter_donut_outer = width * 0.330, //outer radius of the chapter donut
        rad_chapter_donut_inner = width * 0.32, //inner radius of the chapter donut
        rad_chapter_inner = width * 0.30, //outside of the hidden chapter hover
        rad_dot_color = width * 0.32, //chapter dot
        rad_line_max = 0.31,
        rad_line_min = 0.215,
        rad_line_label = width * 0.29, //textual label that explains the hovers
        rad_donut_inner = width * 0.15, //inner radius of the character donut
        rad_donut_outer = width * 0.158, //outer radius of the character donut
        rad_name = rad_donut_outer + 8 * size_factor, //padding between character donut and start of the character name
        rad_image = rad_donut_inner - 4 * size_factor; //radius of the central image shown on hover
        rad_relation = rad_donut_inner - 8 * size_factor; //padding between character donut and inner lines

    //Radius scale for the color circles
    var radius_scale = d3.scaleSqrt()
        .domain([0, 1])
        .range([0, 20]);

    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////// Create groups ///////////////////////////////
    ///////////////////////////////////////////////////////////////////////////


    ///////////////////////////////////////////////////////////////////////////
    //////////////////////////// Read in the data /////////////////////////////
    ///////////////////////////////////////////////////////////////////////////

    // 数据来源：
    // - pattern_total：纹样元数据
    // - building_per_pattern：建筑与纹样的多对多关系
    // - building_total：建筑元数据
    d3.queue()
        .defer(d3.json, "datas/fc_pattern_total.json")
        .defer(d3.json, "datas/fc_building_per_pattern.json")
        .defer(d3.json, "datas/fc_building_total.json")
        .defer(d3.json, "datas/map_layout.json")
        .defer(d3.csv, "datas/buildings.csv")
        .defer(d3.csv, "datas/patterns.csv")
        .defer(d3.csv, "datas/area_introduction.csv")
        .await(draw);

    function draw(error, pattern_total_data, building_per_pattern_data, building_total_data, map_layout_data, buildings_csv_data, patterns_csv_data, area_intro_csv_data) {

        if (error) throw error;

        function cleanText(value) {
            return value === undefined || value === null ? "" : String(value).trim();
        }

        function normalizePatternText(value) {
            return cleanText(value)
                .replace(/，/g, ",")
                .split(",")
                .map(cleanText)
                .filter(function (token) { return token.length > 0; })
                .join("、");
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

        function pickFirstText(values) {
            for (var i = 0; i < values.length; i++) {
                var text = cleanText(values[i]);
                if (text) return text;
            }
            return "";
        }

        function normalizeBuildingId(value) {
            var text = cleanText(value);
            if (!text) return "";
            if (/^\d+_\d+$/.test(text)) return text;
            if (/^\d+$/.test(text) && text.length >= 2) {
                return text.slice(0, 1) + "_" + text.slice(1);
            }
            return text;
        }

        function getBuildingIdSortTuple(value) {
            var id = normalizeBuildingId(value);
            var matches = id.match(/^(\d+)_(\d+)$/);
            if (matches) {
                return { major: +matches[1], minor: +matches[2], raw: id };
            }
            if (/^\d+$/.test(id)) {
                return { major: +id, minor: 0, raw: id };
            }
            return { major: Number.MAX_SAFE_INTEGER, minor: Number.MAX_SAFE_INTEGER, raw: id };
        }

        function compareBuildingIds(a, b) {
            var ka = getBuildingIdSortTuple(a);
            var kb = getBuildingIdSortTuple(b);
            if (ka.major !== kb.major) return ka.major - kb.major;
            if (ka.minor !== kb.minor) return ka.minor - kb.minor;
            if (ka.raw < kb.raw) return -1;
            if (ka.raw > kb.raw) return 1;
            return 0;
        }

        // 根据字段定义重建信息栏行结构（建筑/纹样共用同一套 DOM）。
        function render_info_sidebar_schema(field_defs, title_text) {
            building_info_title.text(title_text || "建筑介绍");
            building_info_close_button.attr("aria-label", "关闭" + (title_text || "介绍"));

            var info_rows = building_info_grid.selectAll(".building-info-row")
                .data(field_defs, function (d) { return d.key; });

            info_rows.exit().remove();

            var info_rows_enter = info_rows.enter()
                .append("div");
            info_rows_enter.append("div").attr("class", "building-info-key");
            info_rows_enter.append("div").attr("class", "building-info-value");

            var merged_rows = info_rows_enter.merge(info_rows)
                .attr("class", function (d) {
                    return "building-info-row" + (is_sidebar_long_text_field(d.key) ? " is-introduction" : "");
                });

            merged_rows.select(".building-info-key")
                .text(function (d) { return d.label; });
            merged_rows.select(".building-info-value")
                .attr("data-field", function (d) { return d.key; })
                .text("—");
        }

        function fill_info_sidebar_values(field_defs, sidebar_data, title_text) {
            render_info_sidebar_schema(field_defs, title_text);
            field_defs.forEach(function (field) {
                var value = cleanText(sidebar_data[field.key]);
                building_info_panel.select('[data-field="' + field.key + '"]').text(value || "—");
            });
        }

        function hide_other_pattern_selector() {
            building_info_extra.classed("is-visible", false);
            building_info_extra_list.selectAll(".building-info-extra-item").remove();
        }

        // “其他”节点下的二级纹样选择列表（多层展示入口）。
        function render_other_pattern_selector(pattern_types, active_type) {
            var types = Array.isArray(pattern_types) ? pattern_types : [];
            if (!types.length) {
                hide_other_pattern_selector();
                return;
            }

            building_info_extra.classed("is-visible", true);
            building_info_extra_title.text("其他 / 纹样种类（点击查看）");

            var selector_items = building_info_extra_list.selectAll(".building-info-extra-item")
                .data(types, function (d) { return d; });

            selector_items.exit().remove();

            var selector_items_enter = selector_items.enter()
                .append("button")
                .attr("type", "button")
                .attr("class", "building-info-extra-item")
                .on("click", function (d) {
                    if (d3.event) {
                        d3.event.preventDefault();
                        d3.event.stopPropagation();
                    }
                    select_other_pattern_type(d);
                });

            selector_items_enter.merge(selector_items)
                .classed("is-active", function (d) { return d === active_type; })
                .text(function (d) { return d; });
        }

        // 统计每个纹样被多少建筑使用，用于：
        // - 单次出现纹样合并到“其他”
        // - 计算内圈纹样环的扇区大小
        var pattern_usage_count = {};
        building_per_pattern_data.forEach(function (d) {
            var pattern_type = cleanText(d.type);
            if (!pattern_type) return;
            pattern_usage_count[pattern_type] = (pattern_usage_count[pattern_type] || 0) + 1;
        });

        var singleton_pattern_types = {};
        // 仅出现一次的纹样统一合并到“其他”，
        // 避免环上出现大量过小扇区导致难以阅读。
        Object.keys(pattern_usage_count).forEach(function (type) {
            if (pattern_usage_count[type] === 1) {
                singleton_pattern_types[type] = true;
            }
        });

        var visible_pattern_data = pattern_total_data.slice()
            .sort(function (a, b) { return (+a.pattern) - (+b.pattern); })
            .filter(function (d) { return !singleton_pattern_types[cleanText(d.type)]; });

        var pattern_palette = d3.scaleOrdinal()
            .domain(visible_pattern_data.map(function (d) { return +d.pattern; }))
            .range(["#cd4242", "#f9c314", "#E47C41", "#8a4b2c", "#4fa2c2", "#c885c8", "#b2c382", "#64b753","#a17fc7"]);//纹样颜色列表，按 pattern 字段顺序分配颜色

        var area_palette = [
            "#EB5580", "#2C9AC6", "#4FB127", "#F6B42B", "#5865B0",
            "#E47C41", "#BD211B", "#82C3AA", "#2F2F2F", "#9A8473"
        ];//颜色列表，按区域顺序分配颜色，超过部分会循环使用

        var building_area_names = [];
        var area_seen = {};
        building_total_data.forEach(function (d) {
            if (!area_seen[d.area]) {
                area_seen[d.area] = true;
                building_area_names.push(d.area);
            }
        });
        var building_area_index = {};
        building_area_names.forEach(function (area, index) {
            building_area_index[area] = index + 1;
        });
        var area_color = d3.scaleOrdinal().domain(building_area_names).range(area_palette);

        // 外圈数据模型（建筑）。
        // volume 是区域索引，用于按区域聚类建筑。
        var chapter_total_data = building_total_data
            .map(function (d) {
                var chapter_id = normalizeBuildingId(d.building_id);
                if (!chapter_id) return null;
                return {
                    chapter: chapter_id,
                    volume: building_area_index[d.area] || 1,
                    card_captured: d.building,
                    popular_time: d.time,
                    introduction: d.introduction,
                    patterns: Array.isArray(d.patterns) ? d.patterns.slice() : [],
                    meaning: d.area,
                    area: d.area
                };
            })
            .filter(function (d) { return d !== null; })
            .sort(function (a, b) { return compareBuildingIds(a.chapter, b.chapter); });
        num_chapters = chapter_total_data.length;
        num_volume = d3.max(chapter_total_data, function (d) { return d.volume; }) || 0;

        var default_area_intro_text = "该区域介绍暂未收录。";
        var area_intro_rows = Array.isArray(area_intro_csv_data) ? area_intro_csv_data : [];
        var area_intro_by_key = {};
        area_intro_rows.forEach(function (row) {
            var area_name = pickFirstText([row["区域"], row["\ufeff区域"], row.area, row.Area, row["area"]]);
            var introduction_text = pickFirstText([row["介绍"], row.introduction, row.description, row.desc]);
            var area_key = normalizeAreaKey(area_name);
            if (!area_key) return;
            area_intro_by_key[area_key] = {
                area: area_name,
                introduction: introduction_text
            };
        });

        var area_intro_data_by_area = {};
        building_area_names.forEach(function (area_name) {
            var area_key = normalizeAreaKey(area_name);
            var intro_meta = area_intro_by_key[area_key];
            area_intro_data_by_area[area_name] = {
                area: pickFirstText([intro_meta && intro_meta.area, simplifyAreaText(area_name), area_name]),
                introduction: pickFirstText([intro_meta && intro_meta.introduction, default_area_intro_text])
            };
        });

        function resolve_area_intro_data(area_name) {
            var normalized_area = cleanText(area_name);
            if (!normalized_area) {
                return {
                    area: "区域",
                    introduction: default_area_intro_text
                };
            }

            if (area_intro_data_by_area[normalized_area]) {
                return area_intro_data_by_area[normalized_area];
            }

            var by_key = area_intro_by_key[normalizeAreaKey(normalized_area)];
            if (by_key) {
                return {
                    area: pickFirstText([by_key.area, simplifyAreaText(normalized_area), normalized_area]),
                    introduction: pickFirstText([by_key.introduction, default_area_intro_text])
                };
            }

            return {
                area: pickFirstText([simplifyAreaText(normalized_area), normalized_area]),
                introduction: default_area_intro_text
            };
        }

        var csv_rows = Array.isArray(buildings_csv_data) ? buildings_csv_data : [];
        var building_csv_by_id = {};
        var building_csv_by_name = {};
        csv_rows.forEach(function (row) {
            var chapter_id = normalizeBuildingId(row.building_id || row.label);
            var architecture_name = cleanText(row.architecture);
            if (chapter_id) {
                building_csv_by_id[chapter_id] = row;
            }
            if (architecture_name) {
                building_csv_by_name[architecture_name] = row;
            }
        });

        var building_sidebar_data_by_chapter = {};
        chapter_total_data.forEach(function (chapter_meta) {
            var csv_row = building_csv_by_id[chapter_meta.chapter] || building_csv_by_name[chapter_meta.card_captured] || {};
            var pattern_text = normalizePatternText(csv_row.pattern);
            if (!pattern_text && chapter_meta.patterns.length) {
                pattern_text = chapter_meta.patterns.map(cleanText).filter(function (token) { return !!token; }).join("、");
            }

            building_sidebar_data_by_chapter[chapter_meta.chapter] = {
                area: pickFirstText([csv_row.area, chapter_meta.area]),
                architecture: pickFirstText([csv_row.architecture, chapter_meta.card_captured]),
                time: pickFirstText([csv_row.time, chapter_meta.popular_time]),
                pattern: pickFirstText([pattern_text]),
                introduction_details: pickFirstText([
                    csv_row.introduction_details,
                    csv_row.introduction,
                    chapter_meta.introduction
                ])
            };
        });
        var pattern_sidebar_data_by_type = {};
        var pattern_csv_rows = Array.isArray(patterns_csv_data) ? patterns_csv_data : [];
        pattern_csv_rows.forEach(function (row) {
            var pattern_type = cleanText(row.type);
            if (!pattern_type) return;

            pattern_sidebar_data_by_type[pattern_type] = {
                type: pickFirstText([row.type]),
                populartime: pickFirstText([row.populartime, row.popular_time]),
                intruductions: pickFirstText([row.intruductions, row.introduction, row.introductions]),
                meanings: pickFirstText([row.meanings, row.meaning])
            };
        });

        var info_focus_locked = false;
        var locked_focus_type = "";
        var locked_chapter_id = null;
        var locked_pattern_name = "";
        var locked_other_pattern_type = "";

        var chapter_area_by_id = {};
        var area_chapters_map = {};
        chapter_total_data.forEach(function (d) {
            chapter_area_by_id[d.chapter] = d.area;
            if (!area_chapters_map[d.area]) area_chapters_map[d.area] = [];
            area_chapters_map[d.area].push(d.chapter);
        });

        ///////////////////////////////////////////////////////////////////////////
        //////////////////////////// Build mini-map layer //////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        var map_layout = map_layout_data && typeof map_layout_data === "object" ? map_layout_data : {};
        var map_image_width = +((map_layout.image && map_layout.image.width) || 335);
        var map_image_height = +((map_layout.image && map_layout.image.height) || 551);
        var map_layout_areas = Array.isArray(map_layout.areas) ? map_layout.areas : [];
        var map_layout_buildings = Array.isArray(map_layout.buildings) ? map_layout.buildings : [];

        var mini_map_overlay = d3.select("#mini-map-panel .mini-map-overlay")
            .attr("viewBox", "0 0 " + map_image_width + " " + map_image_height)
            .attr("preserveAspectRatio", "xMidYMid meet");
        mini_map_overlay.selectAll("*").remove();
        mini_map_overlay.on("click", null);

        var mini_map_caption = d3.select("#mini-map-panel .mini-map-caption");
        if (mini_map_debug_mode) {
            mini_map_overlay.on("click", function () {
                if (d3.event) d3.event.stopPropagation();
                var point = d3.mouse(this);
                var x = Math.round(point[0]);
                var y = Math.round(point[1]);
                mini_map_caption.text("调试坐标 x:" + x + " y:" + y + "（写入 datas/map_layout.json）");
                if (window.console && window.console.log) {
                    window.console.log("[mini-map-debug] x=" + x + ", y=" + y);
                }
            });
        }

        function parsePolygonCollection(area_item) {
            var polygons = [];
            if (Array.isArray(area_item.polygons)) {
                polygons = polygons.concat(area_item.polygons);
            }
            if (Array.isArray(area_item.polygon)) {
                polygons.push(area_item.polygon);
            }
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
            var segments = polygons.map(function (poly) {
                return "M" + poly.map(function (point) { return point[0] + "," + point[1]; }).join("L") + "Z";
            });
            return segments.join("");
        }

        var mini_map_area_data = map_layout_areas
            .map(function (area_item) {
                var area_name = cleanText(area_item.area);
                var polygons = parsePolygonCollection(area_item);
                if (!area_name || !polygons.length) return null;
                return {
                    area: area_name,
                    polygons: polygons,
                    path: polygonCollectionToPath(polygons)
                };
            })
            .filter(function (d) { return d !== null; });

        var chapter_meta_by_id_for_map = {};
        chapter_total_data.forEach(function (d) {
            chapter_meta_by_id_for_map[d.chapter] = d;
        });

        var mini_map_building_data = map_layout_buildings
            .map(function (item) {
                var chapter_id = normalizeBuildingId(item.building_id);
                var x = +item.x;
                var y = +item.y;
                if (!chapter_id || !isFinite(x) || !isFinite(y)) return null;
                var meta = chapter_meta_by_id_for_map[chapter_id];
                if (!meta) return null;
                var label_dx = 6;
                var label_dy = -6;
                if (Array.isArray(item.label_offset) && item.label_offset.length >= 2) {
                    if (isFinite(+item.label_offset[0])) label_dx = +item.label_offset[0];
                    if (isFinite(+item.label_offset[1])) label_dy = +item.label_offset[1];
                }
                if (isFinite(+item.label_dx)) label_dx = +item.label_dx;
                if (isFinite(+item.label_dy)) label_dy = +item.label_dy;
                return {
                    building_id: chapter_id,
                    x: x,
                    y: y,
                    area: meta.area,
                    building: meta.card_captured,
                    label_dx: label_dx,
                    label_dy: label_dy
                };
            })
            .filter(function (d) { return d !== null; });

        var mini_map_area_group = mini_map_overlay.append("g").attr("class", "mini-map-area-group");
        var mini_map_marker_group = mini_map_overlay.append("g").attr("class", "mini-map-marker-group");

        var mini_map_area_path = mini_map_area_group.selectAll(".mini-map-area")
            .data(mini_map_area_data)
            .enter().append("path")
            .attr("class", "mini-map-area")
            .attr("d", function (d) { return d.path; })
            .style("fill", function (d) { return area_color(d.area) || "#2f2f2f"; })
            .style("opacity", 0);

        var mini_map_marker = mini_map_marker_group.selectAll(".mini-map-building-dot")
            .data(mini_map_building_data)
            .enter().append("circle")
            .attr("class", "mini-map-building-dot")
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })
            .attr("r", 2.5)
            .style("opacity", 0.45);

        var mini_map_label_bg = mini_map_marker_group.selectAll(".mini-map-building-label-bg")
            .data(mini_map_building_data)
            .enter().append("rect")
            .attr("class", "mini-map-building-label-bg")
            .attr("rx", 4)
            .attr("ry", 4)
            .style("opacity", 0);

        var mini_map_label = mini_map_marker_group.selectAll(".mini-map-building-label")
            .data(mini_map_building_data)
            .enter().append("text")
            .attr("class", "mini-map-building-label")
            .attr("x", function (d) { return d.x + d.label_dx; })
            .attr("y", function (d) { return d.y + d.label_dy; })
            .style("opacity", 0)
            .text(function (d) { return d.building; });

        function layout_mini_map_label_backgrounds() {
            var label_nodes = [];
            mini_map_label.each(function (d, i) {
                label_nodes[i] = this;
            });
            mini_map_label_bg.each(function (d, i) {
                var label_node = label_nodes[i];
                if (!label_node || typeof label_node.getBBox !== "function") return;
                var bbox = label_node.getBBox();
                var pad_x = 5;
                var pad_y = 2;
                d3.select(this)
                    .attr("x", bbox.x - pad_x)
                    .attr("y", bbox.y - pad_y)
                    .attr("width", Math.max(0, bbox.width + pad_x * 2))
                    .attr("height", Math.max(0, bbox.height + pad_y * 2));
            });
        }

        function update_mini_map(options) {
            var opts = options || {};
            var active_buildings = Array.isArray(opts.buildings) ? opts.buildings : [];
            var active_areas = Array.isArray(opts.areas) ? opts.areas : [];
            var status_text = cleanText(opts.caption);

            var active_building_set = {};
            active_buildings.forEach(function (chapter_id) {
                var chapter_key = normalizeBuildingId(chapter_id);
                if (chapter_key) {
                    active_building_set[chapter_key] = true;
                }
            });
            var active_area_set = {};
            active_areas.forEach(function (area_name) {
                active_area_set[area_name] = true;
            });

            mini_map_area_path
                .style("opacity", function (d) { return active_area_set[d.area] ? 0.5 : 0; });/*地图area框显示透明度*/

            mini_map_marker
                .attr("r", function (d) { return active_building_set[d.building_id] ? 4 : 2.5; })
                .style("opacity", function (d) {
                    if (active_building_set[d.building_id]) return 1;
                    if (!active_buildings.length) return 0.45;
                    return 0.2;
                });

            layout_mini_map_label_backgrounds();

            mini_map_label_bg
                .style("opacity", function (d) { return active_building_set[d.building_id] ? 0.96 : 0; });

            mini_map_label
                .classed("is-active", function (d) { return !!active_building_set[d.building_id]; })
                .style("opacity", function (d) { return active_building_set[d.building_id] ? 1 : 0; });

            if (mini_map_caption.empty()) return;
            if (!mini_map_building_data.length) {
                mini_map_caption.text("小地图定位：请在 datas/map_layout.json 补充建筑坐标");
                return;
            }
            if (status_text) {
                mini_map_caption.text(status_text);
            } else {
                mini_map_caption.text("小地图定位：移动到建筑或区域查看对应位置");
            }
        }

        update_mini_map();

        // 连线数据模型（纹样 -> 建筑）。
        // 单次出现纹样会被重映射到聚合节点“其他”。
        var character_data = building_per_pattern_data.map(function (d) {
            var source_type = cleanText(d.type);
            return {
                chapter: normalizeBuildingId(d.building_id),
                character: singleton_pattern_types[source_type] ? "其他" : source_type
            };
        }).filter(function (d) {
            return !!d.chapter && !!d.character;
        });
        var source_pattern_chapters_map = {};
        building_per_pattern_data.forEach(function (d) {
            var source_type = cleanText(d.type);
            var chapter_id = normalizeBuildingId(d.building_id);
            if (!source_type || !chapter_id) return;
            if (!source_pattern_chapters_map[source_type]) {
                source_pattern_chapters_map[source_type] = [];
            }
            source_pattern_chapters_map[source_type].push(chapter_id);
        });
        var cover_data = character_data.slice();

        var display_pattern_usage_count = {};
        character_data.forEach(function (d) {
            display_pattern_usage_count[d.character] = (display_pattern_usage_count[d.character] || 0) + 1;
        });

        // 内圈数据模型（纹样），用于环形扇区和名称标签。
        var character_total_data = visible_pattern_data
            .map(function (d) {
                return {
                    character: d.type,
                    full_name: d.type,
                    first_name: d.type,
                    last_name: "",
                    num_chapters: display_pattern_usage_count[d.type] || 0,
                    color: pattern_palette(+d.pattern),
                    type: d.popular_time,
                    area: "纹样",
                    time: d.popular_time,
                    introduction: d.introduction,
                    meaning: d.meaning,
                    pattern_id: +d.pattern
                };
            });

        if (singleton_pattern_types && Object.keys(singleton_pattern_types).length > 0) {
            character_total_data.push({
                character: "其他",
                full_name: "其他",
                first_name: "其他",
                last_name: "",
                num_chapters: display_pattern_usage_count["其他"] || 0,
                color: "#9A9A9A",
                type: "其他",
                area: "纹样",
                time: "其他",
                introduction: "只对应一个建筑的纹样已合并展示",
                meaning: "聚合展示",
                pattern_id: null
            });
        }

        // 补齐纹样信息栏兜底字段（即使 patterns.csv 某行缺失，也能从总表回填）。
        pattern_total_data.forEach(function (d) {
            var pattern_type = cleanText(d.type);
            if (!pattern_type) return;
            var current = pattern_sidebar_data_by_type[pattern_type] || {};
            pattern_sidebar_data_by_type[pattern_type] = {
                type: pickFirstText([current.type, d.type]),
                populartime: pickFirstText([current.populartime, current.popular_time, d.popular_time]),
                intruductions: pickFirstText([current.intruductions, current.introduction, d.introduction]),
                meanings: pickFirstText([current.meanings, current.meaning, d.meaning])
            };
        });

        // 预留：内圈纹样之间关系线（当前未启用）。
        var relation_data = [];

        // 中心预览图的兜底图与候选表。
        // 每个建筑/纹样对应一组候选 URL，按扩展名依次重试，失败再回退。
        var default_center_image = "img/white-square.jpg";
        var chapter_image_candidates = {};
        var pattern_image_candidates = {};
        var singleton_pattern_names = pattern_total_data.slice()
            .sort(function (a, b) { return (+a.pattern) - (+b.pattern); })
            .map(function (d) { return cleanText(d.type); })
            .filter(function (type) { return !!singleton_pattern_types[type]; });
        var merged_other_pattern_types = singleton_pattern_names.filter(function (type) { return !!cleanText(type); });
        var building_image_extensions = [".jpg", ".jpeg", ".png", ".webp"];
        var pattern_image_extensions = [".jpg", ".jpeg", ".png", ".webp"];
        chapter_total_data.forEach(function (d) {
            var building_name_encoded = encodeURIComponent(d.card_captured);
            chapter_image_candidates[d.chapter] = building_image_extensions.map(function (ext) {
                return "datas/imgs/buildings_img/" + building_name_encoded + ext;
            });
        });
        pattern_total_data.forEach(function (d) {
            var pattern_type = cleanText(d.type);
            if (!pattern_type) return;
            var pattern_name_encoded = encodeURIComponent(pattern_type);
            var candidates = pattern_image_extensions.map(function (ext) {
                return "datas/imgs/patterns_img/" + pattern_name_encoded + ext;
            });
            if (d.pattern !== undefined && d.pattern !== null) {
                candidates = candidates.concat(pattern_image_extensions.map(function (ext) {
                    return "datas/imgs/patterns_img/" + d.pattern + ext;
                }));
            }
            pattern_image_candidates[pattern_type] = candidates;
        });
        // 颜色点数据：每个建筑拆成三档权重颜色。
        // 后续通过力导向把颜色点聚拢到该建筑对应角度附近。
        var color_data = [];
        chapter_total_data.forEach(function (d) {
            var base = d3.rgb(area_color(d.area));
            color_data.push({ chapter: d.chapter, percentage: 0.55, color: base.toString() });
            color_data.push({ chapter: d.chapter, percentage: 0.30, color: base.brighter(0.8).toString() });
            color_data.push({ chapter: d.chapter, percentage: 0.15, color: base.darker(0.8).toString() });
        });

        // 构建层级节点：
        // ROOT -> 区域 -> 建筑，然后使用 d3.cluster 计算角度位置。
        var chapter_hierarchy_data = [{
            name: "FORBIDDEN_CITY_BUILDINGS",
            parent: "",
            num: null
        }];
        building_area_names.forEach(function (area, index) {
            chapter_hierarchy_data.push({
                name: "area_" + (index + 1),
                parent: "FORBIDDEN_CITY_BUILDINGS",
                num: null,
                area: area
            });
        });
        chapter_total_data.forEach(function (d) {
            chapter_hierarchy_data.push({
                name: "building_" + d.chapter,
                parent: "area_" + (building_area_index[d.area] || 1),
                num: d.chapter,
                type: d.card_captured
            });
        });

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// Calculate chapter locations /////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var hierarchy_root_name = chapter_hierarchy_data.length ? chapter_hierarchy_data[0].name : "ROOT";
        var valid_chapter_ids = {};
        chapter_total_data.forEach(function (d) {
            valid_chapter_ids[d.chapter] = true;
        });
        chapter_hierarchy_data = chapter_hierarchy_data.filter(function (d) {
            return d.name === hierarchy_root_name || d.num === null || !!valid_chapter_ids[normalizeBuildingId(d.num)];
        });
        //Based on typical hierarchical clustering example
        var root = d3.stratify()
            .id(function (d) { return d.name; })
            .parentId(function (d) { return d.parent; })
            (chapter_hierarchy_data);
        var cluster = d3.cluster()
            .size([360, rad_dot_color])
            .separation(function separation(a, b) {
                return a.parent == b.parent ? 1 : 1.3;
            });
        cluster(root);
        var chapter_location_data = root.leaves()
        chapter_location_data.forEach(function (d, i) {
            d.chapter = normalizeBuildingId(d.data.num);
            d.centerAngle = d.x * Math.PI / 180;
        });
        var chapterById = {};
        chapter_location_data.forEach(function (d) {
            chapterById[d.chapter] = d;
        });

        //The distance between two chapters that belong to the same volume
        var chapter_angle_distance = chapter_location_data.length > 1
            ? chapter_location_data[1].centerAngle - chapter_location_data[0].centerAngle
            : pi2;

        //Add some useful metrics to the chapter data
        chapter_location_data.forEach(function (d, i) {
            d.startAngle = d.centerAngle - chapter_angle_distance / 2;
            d.endAngle = d.centerAngle + chapter_angle_distance / 2;
        })

        // 按区域构建连续弧段，使每个区域都有完整环段与独立文字路径。
        var chapter_meta_by_id = {};
        chapter_total_data.forEach(function (d) {
            chapter_meta_by_id[d.chapter] = d;
        });
        var area_ring_data = [];
        chapter_location_data
            .slice()
            .sort(function (a, b) { return a.centerAngle - b.centerAngle; })
            .forEach(function (d) {
                var meta = chapter_meta_by_id[d.chapter] || {};
                var area_name = meta.area || "";
                if (!area_ring_data.length || area_ring_data[area_ring_data.length - 1].area !== area_name) {
                    area_ring_data.push({
                        area: area_name,
                        startAngle: d.startAngle,
                        endAngle: d.endAngle
                    });
                } else {
                    area_ring_data[area_ring_data.length - 1].endAngle = d.endAngle;
                }
            });
        // Merge first/last segment when the same area spans the 0-degree boundary.
        if (area_ring_data.length > 1 && area_ring_data[0].area === area_ring_data[area_ring_data.length - 1].area) {
            area_ring_data[0].startAngle = area_ring_data[area_ring_data.length - 1].startAngle;
            area_ring_data.pop();
        }
        var area_label_font_size = 20 * size_factor;//area名称字体大小
        var area_label_data = area_ring_data.map(function (d, i) {
            var span = d.endAngle - d.startAngle;
            if (span < 0) span += pi2;
            var pad = Math.min(0.08, span * 0.22);
            var label_span = span - 2 * pad;
            var label_start = (d.startAngle + pad + pi2) % pi2;
            var label_end = (label_start + label_span) % pi2;
            var center_angle = d.startAngle + span / 2;
            if (center_angle >= pi2) center_angle -= pi2;
            return {
                area: d.area,
                color: area_color(d.area),
                startAngle: label_start,
                endAngle: label_end,
                centerAngle: center_angle,
                span: label_span,
                path_id: "area-name-path-" + i
            };
        }).filter(function (d) { return !!d.area && d.span > 0.12; });
        // 每个区域仅保留一条标签，避免跨 0 度时重复渲染。
        var area_label_seen = {};
        area_label_data = area_label_data.filter(function (d) {
            if (area_label_seen[d.area]) return false;
            area_label_seen[d.area] = true;
            return true;
        });

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// Final data prep /////////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        character_total_data.forEach(function (d) {
            d.num_chapters = +d.num_chapters;
        })//forEach
        var character_names = character_total_data.map(function(d) { return d.character; });

        //Sort cover data according to characters from total
        function sortCharacter(a, b) { return character_names.indexOf(a.character) - character_names.indexOf(b.character); }
        cover_data.sort(sortCharacter);
        character_data.sort(sortCharacter);

        color_data = color_data.filter(function (d) { return !!chapterById[d.chapter]; })
        color_data.forEach(function (d) {
            d.radius = radius_scale(d.percentage);

            //The center of gravity for this datapoint
            d.focusX = rad_color * Math.cos(chapterById[d.chapter].centerAngle - pi1_2);
            d.focusY = rad_color * Math.sin(chapterById[d.chapter].centerAngle - pi1_2);
            //Add a bit of random to not get weird placement behavior in the simulation
            d.x = d.focusX + random();
            d.y = d.focusY + random();
        })//forEach

        ///////////////////////////////////////////////////////////////////////////
        /////////////////////////// Run force simulation //////////////////////////
        ///////////////////////////////////////////////////////////////////////////
        // 力导向目标：在不重叠的前提下，让颜色点围绕其建筑焦点分布。
        
        simulation = d3.forceSimulation(color_data)
            .force("x", d3.forceX().x(function (d) { return d.focusX; }).strength(0.05))
            .force("y", d3.forceY().y(function (d) { return d.focusY; }).strength(0.05))
            .force("collide", d3.forceCollide(function (d) { return (d.radius * 1 + 2.5) * size_factor; }).strength(0))
            .on("tick", tick)
            .on("end", simulation_end)
            .alphaMin(.2)
            //.stop();

        //Run the simulation "manually"
        //for (var i = 0; i < 300; ++i) simulation.tick();

        // 碰撞力由弱到强平滑提升，避免初始瞬间“炸开”。
        var t = d3.timer(function (elapsed) {
            var dt = elapsed / 3000;
            simulation.force("collide").strength(Math.pow(dt, 2) * 0.7);
            if (dt >= 1.0) t.stop();
        });

        function tick(e) {
            color_circle
                .attr("cx", function (d) { return d.x; })
                .attr("cy", function (d) { return d.y; })
        }//function tick

        //When the simulation is done, run this function
        function simulation_end() {
            //Create the CMYK halftones
            color_circle.style("fill", function (d, i) { return "url(#pattern-total-" + i + ")"; })
        }//function simulation_end

        // 历史调试钩子：用于手动微调颜色点布局时导出位置。
        data_save = color_data;

        //////////////////////////////////////////////////////////////
        /////////////// Create circle for cover image ////////////////
        //////////////////////////////////////////////////////////////

        //Adding images of the characters
        var image_radius = rad_image;
        var image_group = defs.append("g").attr("class", "image-group");
        //Had to add img width otherwise it wouldn't work in Safari & Firefox
        //http://stackoverflow.com/questions/36390962/svg-image-tag-not-working-in-safari-and-firefox
        var cover_image = image_group.append("pattern")
            .attr("id", "cover-image")
            .attr("class", "cover-image")
            .attr("patternUnits", "objectBoundingBox")
            .attr("height", "100%")
            .attr("width", "100%")
            .append("image")
            .attr("xlink:href", default_center_image)
            .attr("height", 2 * image_radius)
            .attr("width", 2 * image_radius);
        var cover_image_under = image_group.append("pattern")
            .attr("id", "cover-image-under")
            .attr("class", "cover-image cover-image-under")
            .attr("patternUnits", "objectBoundingBox")
            .attr("height", "100%")
            .attr("width", "100%")
            .append("image")
            .attr("xlink:href", default_center_image)
            .attr("height", 2 * image_radius)
            .attr("width", 2 * image_radius);

        var center_image_request_id = { top: 0, under: 0 };

        function get_cover_image_by_layer(layer_name) {
            return layer_name === "under" ? cover_image_under : cover_image;
        }

        function promote_under_cover_to_top() {
            center_image_request_id.top += 1;
            cover_image
                .on("error", null)
                .attr("xlink:href", cover_image_under.attr("xlink:href") || default_center_image);
        }

        function show_center_image_from_candidates_on_layer(candidates, layer_name) {
            // 使用递增请求 id 避免异步竞态：
            // 快速切换悬浮目标时，旧回调会被自动忽略。
            var layer_key = layer_name === "under" ? "under" : "top";
            var target_image = get_cover_image_by_layer(layer_key);
            if (!target_image) return;

            center_image_request_id[layer_key] += 1;
            var request_id = center_image_request_id[layer_key];

            function set_default_layer_image() {
                target_image.on("error", null).attr("xlink:href", default_center_image);
            }

            function load_candidate(index) {
                if (request_id !== center_image_request_id[layer_key]) return;
                if (index >= candidates.length) {
                    set_default_layer_image();
                    return;
                }
                target_image
                    .on("error", function () { load_candidate(index + 1); })
                    .attr("xlink:href", candidates[index]);
            }

            if (!candidates.length) {
                set_default_layer_image();
                return;
            }
            load_candidate(0);
        }

        function show_default_center_image() {
            show_center_image_from_candidates_on_layer([], "top");
            show_center_image_from_candidates_on_layer([], "under");
        }

        function show_center_image_from_candidates(candidates) {
            show_center_image_from_candidates_on_layer(candidates, "top");
        }
        function show_center_image_for_chapter(chapter_id) {
            show_center_image_from_candidates(chapter_image_candidates[chapter_id] || []);
        }
        function show_center_image_for_pattern(pattern_name) {
            show_center_image_from_candidates(pattern_image_candidates[pattern_name] || []);
        }

        // "其他" slideshow timing (seconds) can be adjusted here.
        var merged_pattern_show_seconds = 0.5;//展示秒数
        var merged_pattern_fade_seconds = 0.5;//淡入淡出秒数
        var merged_pattern_cycle_timer = null;
        var merged_pattern_cycle_index = 0;

        function stop_merged_pattern_cycle() {
            if (merged_pattern_cycle_timer) {
                clearTimeout(merged_pattern_cycle_timer);
                merged_pattern_cycle_timer = null;
            }
            if (cover_circle_under) {
                var under_visible = parseFloat(cover_circle_under.style("opacity") || "0") > 0.01
                    && cover_circle_under.style("fill") !== "none";
                if (under_visible) {
                    promote_under_cover_to_top();
                }
            }

            if (cover_circle) {
                cover_circle
                    .interrupt()
                    .style("fill", "url(#cover-image)")
                    .style("opacity", 1);
            }
            if (cover_circle_under) {
                cover_circle_under
                    .interrupt()
                    .style("opacity", 0)
                    .style("fill", "none");
            }
        }

        function start_merged_pattern_cycle() {
            // “其他”节点会循环播放被合并纹样的图片，
            // 避免只展示单一占位图而丢失信息。
            stop_merged_pattern_cycle();

            if (!singleton_pattern_names.length) {
                show_default_center_image();
                return;
            }

            var show_ms = Math.max(400, merged_pattern_show_seconds * 1000);
            var fade_ms = Math.max(120, merged_pattern_fade_seconds * 1000);
            merged_pattern_cycle_index = 0;

            function schedule_next_transition() {
                if (singleton_pattern_names.length <= 1) return;
                merged_pattern_cycle_timer = setTimeout(function () {
                    var next_index = (merged_pattern_cycle_index + 1) % singleton_pattern_names.length;
                    var next_pattern = singleton_pattern_names[next_index];

                    show_center_image_from_candidates_on_layer(pattern_image_candidates[next_pattern] || [], "under");

                    if (cover_circle_under) {
                        cover_circle_under
                            .style("fill", "url(#cover-image-under)")
                            .interrupt()
                            .style("opacity", 1);
                    }
                    if (!cover_circle) {
                        merged_pattern_cycle_index = next_index;
                        schedule_next_transition();
                        return;
                    }

                    // 前一张淡出时，后一张已在底层可见，避免出现白底空窗。
                    cover_circle
                        .interrupt()
                        .transition()
                        .duration(fade_ms)
                        .style("opacity", 0)
                        .on("end", function () {
                            // 固定由上层执行淡出，避免隔次切换出现硬切。
                            promote_under_cover_to_top();
                            cover_circle.style("fill", "url(#cover-image)").style("opacity", 1);
                            if (cover_circle_under) {
                                cover_circle_under.style("opacity", 0).style("fill", "none");
                            }
                            merged_pattern_cycle_index = next_index;
                            schedule_next_transition();
                        });
                }, show_ms);
            }

            var initial_pattern = singleton_pattern_names[merged_pattern_cycle_index];
            show_center_image_from_candidates_on_layer(pattern_image_candidates[initial_pattern] || [], "top");
            if (cover_circle) {
                cover_circle
                    .style("fill", "url(#cover-image)")
                    .interrupt()
                    .style("opacity", 1);
            }
            if (cover_circle_under) {
                cover_circle_under
                    .interrupt()
                    .style("opacity", 0)
                    .style("fill", "none");
            }
            schedule_next_transition();
        }

        ///////////////////////////////////////////////////////////////////////////
        /////////////////////// Create character donut chart //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        //Arc command for the character donut chart
        var arc = d3.arc()
            .outerRadius(rad_donut_outer)
            .innerRadius(rad_donut_inner)
            .padAngle(0.01)
            .cornerRadius((rad_donut_outer - rad_donut_inner) / 2 * 1)
        //Pie function to calculate sizes of donut slices
        var pie = d3.pie()
            .sort(null)
            .value(function (d) { return d.num_chapters; });

        var arcs = pie(character_total_data);
        arcs.forEach(function(d,i) {
            d.character = character_total_data[i].character;
            d.centerAngle = (d.endAngle - d.startAngle) / 2 + d.startAngle;
        });

        //Create the donut slices per character (and the number of chapters they appeared in)
        var donut_group = chart.append("g").attr("class", "donut-group");
        var slice = donut_group.selectAll(".arc")
            .data(arcs)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc)
            .style("fill", function (d) { return d.data.color; });

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// Create name labels //////////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var hover_circle_group = chart.append("g").attr("class", "hover-circle-group");
        var name_group = chart.append("g").attr("class", "name-group");

        //Create a group per character
        // 标签朝向辅助：
        // 右半侧保持正向，左半侧旋转 180 度保证可读性。
        function isRightSideAngle(angle) {
            return angle > 0 && angle < Math.PI;
        }

        var names = name_group.selectAll(".name")
            .data(arcs)
            .enter().append("g")
            .attr("class", "name")
            .style("text-anchor", function (d) { return isRightSideAngle(d.centerAngle) ? "start" : "end"; })
            .style("font-family", "Anime Ace")
            
        //Add the big "main" name
        names.append("text")
            .attr("class", "name-label")
            .attr("id", function (d, i) { return "name-label-" + i; })
            .attr("dy", ".35em")
            .attr("transform", function (d, i) {
                //If there is a last name, move the first a bit upward
                if(character_total_data[i].last_name !== "") {
                    var finalAngle = d.centerAngle + (isRightSideAngle(d.centerAngle) ? -0.02 : 0.02);
                } else {
                    var finalAngle = d.centerAngle;
                }//else
                return "rotate(" + (finalAngle * 180 / Math.PI - 90) + ")"
                    + "translate(" + rad_name + ")"
                    + (isRightSideAngle(finalAngle) ? "" : "rotate(180)");
            })
            .style("font-size", (22*size_factor)+"px")//内圈纹样名字体大小
            .text(function (d, i) { return character_total_data[i].first_name; });

        //Add the smaller last name (if available) below
        names.append("text")
            .attr("class", "last-name-label")
            .attr("id", function (d, i) { return "last-name-label-" + i; })
            .attr("dy", ".35em")
            .attr("transform", function (d, i) {
                //If there is a last name, move the last a bit downward
                if(character_total_data[i].last_name !== "") {
                    var finalAngle = d.centerAngle + (isRightSideAngle(d.centerAngle) ? 0.03 : -0.03);
                } else {
                    var finalAngle = d.centerAngle;
                }//else
                return "rotate(" + (finalAngle * 180 / Math.PI - 90) + ")"
                    + "translate(" + rad_name + ")"
                    + (isRightSideAngle(finalAngle) ? "" : "rotate(180)");
            })
            .style("font-size", (20*size_factor)+"px")
            .text(function (d, i) { return character_total_data[i].last_name; });

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// Create name dots ////////////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        // 纹样名 -> 数据对象的快速索引，供连线与悬浮逻辑复用。
        var characterByName = {};
        function estimate_label_width(text, font_size) {
            // getComputedTextLength 在隐藏容器中可能返回 0，这里提供保守估算兜底。
            var raw = (text || "").toString();
            if (!raw) return 0;
            var cjk_count = 0;
            var latin_count = 0;
            for (var idx = 0; idx < raw.length; idx += 1) {
                var code = raw.charCodeAt(idx);
                if (code > 255) {
                    cjk_count += 1;
                } else {
                    latin_count += 1;
                }
            }
            return cjk_count * font_size * 0.95 + latin_count * font_size * 0.62;
        }

        function safe_text_length(node, text, font_size) {
            var measured = 0;
            if (node && typeof node.getComputedTextLength === "function") {
                measured = node.getComputedTextLength();
            }
            if (!isFinite(measured) || measured <= 0) {
                measured = estimate_label_width(text, font_size);
            }
            return measured;
        }
        //Color of the dot behind the name can be the type
        character_total_data.forEach(function (d, i) {
            var first_node = document.getElementById('name-label-' + i);
            var last_node = document.getElementById('last-name-label-' + i);
            var text_width_first = safe_text_length(first_node, character_total_data[i].first_name, 22 * size_factor);
            var text_width_last = safe_text_length(last_node, character_total_data[i].last_name, 20 * size_factor);
            d.dot_name_rad = rad_name + Math.max(text_width_first, text_width_last) + 10;
            d.name_angle = (arcs[i].endAngle - arcs[i].startAngle) / 2 + arcs[i].startAngle;

            characterByName[d.character] = d;
        })//forEach

        //Create hover circle that shows when you hover over a character
        var rad_hover_circle = 35 * size_factor;
        var hover_circle = hover_circle_group.selectAll(".hover-circle")
            .data(character_total_data)
            .enter().append("circle")
            .attr("class", "hover-circle")
            .attr("cx", function (d) { return d.dot_name_rad * Math.cos(d.name_angle - pi1_2); })
            .attr("cy", function (d) { return d.dot_name_rad * Math.sin(d.name_angle - pi1_2); })
            .attr("r", rad_hover_circle)
            .style("fill", function (d) { return d.color; })
            .style("fill-opacity", 0.3)
            .style("opacity", 0);

        //Add a circle at the end of each name of each character
        var name_dot_group = chart.append("g").attr("class", "name-dot-group");
        var name_dot = name_dot_group.selectAll(".type-dot")
            .data(character_total_data)
            .enter().append("circle")
            .attr("class", "type-dot")
            .attr("cx", function (d) { return d.dot_name_rad * Math.cos(d.name_angle - pi1_2); })
            .attr("cy", function (d) { return d.dot_name_rad * Math.sin(d.name_angle - pi1_2); })
            .attr("r", 6 * size_factor)
            .style("fill", function (d) { return d.color; })
            .style("stroke", "white")
            .style("stroke-width", 3 * size_factor);

        var center_explore_title_font_size = Math.max(22, 40 * size_factor);//空间分布标题大小

        var center_explore_group = chart.append("g")
            .attr("class", "center-explore-group")

            center_explore_group.append("text")
            .attr("class", "center-explore-title")
            .attr("x", 0)
            .attr("y", -25 * size_factor)
            .attr("text-anchor", "middle")
            .style("font-size", center_explore_title_font_size + "px")
            .text("故宫窗棂空间分布");

            center_explore_group.append("text")
            .attr("class", "center-explore-title")
            .attr("x", 0)
            .attr("y", 38 * size_factor)
            .attr("text-anchor", "middle")
            .style("font-size", center_explore_title_font_size + "px")
            .text("纹样・建筑・区域");


        ///////////////////////////////////////////////////////////////////////////
        ////////////////////////// Create inner relations /////////////////////////
        /////////////////////////////////////////////////////////////////////////// 
        var pull_scale = d3.scaleLinear()
            .domain([2 * rad_relation, 0])
            .range([0.7, 2.3]);
        var stroke_relation = d3.scaleOrdinal()
            .domain(["same_pattern"])
            .range([4])
            .unknown(3);

        var relation_group = chart.append("g").attr("class", "relation-group");

        //Create the lines in between the characters that have some sort of relation
        var relation_lines = relation_group.selectAll(".relation-path")
            .data(relation_data)
            .enter().append("path")
            .attr("class", "relation-path")
            .style("fill", "none")
            .style("stroke", function (d) { return d.pattern_color || "#bbbbbb"; })
            .style("stroke-width", function (d) { return stroke_relation(d.type) * size_factor; })
            .style("stroke-linecap", "round")
            .style("mix-blend-mode", "multiply")
            .style("opacity", 0.7)
            .attr("d", create_relation_lines);

        function create_relation_lines(d) {
            // 在两个纹样节点之间绘制弧线。
            // sweep_flag 选择更优方向，尽量减少视觉交叉。
            var source_a = characterByName[d.source].name_angle,
                target_a = characterByName[d.target].name_angle;
            var x1 = rad_relation * Math.cos(source_a - pi1_2),
                y1 = rad_relation * Math.sin(source_a - pi1_2),
                x2 = rad_relation * Math.cos(target_a - pi1_2),
                y2 = rad_relation * Math.sin(target_a - pi1_2);
            d.x = (x1 + x2) / 2;
            d.y = (y1 + y2) / 2;
            var dx = x2 - x1,
                dy = y2 - y1,
                dr = Math.sqrt(dx * dx + dy * dy);
            var curve = dr * 1 / pull_scale(dr);

            //Get the angles to determine the optimum sweep flag
            var delta_angle = (target_a - source_a) / Math.PI;
            var sweep_flag = 0;
            if ((delta_angle > -1 && delta_angle <= 0) || (delta_angle > 1 && delta_angle <= 2))
                sweep_flag = 1;

            return "M" + x1 + "," + y1 + " A" + curve + "," + curve + " 0 0 " + sweep_flag + " " + x2 + "," + y2;
        }//function create_relation_lines

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////// Create inner relation hover areas ///////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var relation_hover_group = chart.append("g").attr("class", "relation-hover-group");
        var relation_hover_lines = relation_hover_group.selectAll(".relation-hover-path")
            .data(relation_data)
            .enter().append("path")
            .attr("class", "relation-hover-path")
            .style("fill", "none")
            .style("stroke", "white")
            .style("stroke-width", 16 * size_factor)
            .style("opacity", 0)
            // .style("pointer-events", "all")
            .attr("d", create_relation_lines)
            .on("mouseover", mouse_over_relation)
            .on("mouseout", mouse_out)

        //Call and create the textual part of the annotations
        var annotation_relation_group = chart.append("g").attr("class", "annotation-relation-group");

        function mouse_over_relation(d,i) {
            if (info_focus_locked) return;
            d3.event.stopPropagation();
            mouse_over_in_action = true;

            clearTimeout(remove_text_timer);

            //Only show the hovered relationship
            relation_lines.filter(function(c,j) { return j !== i; })
                .style("opacity", 0.05);

            //Set up the annotation
            var annotations_relationship = [
                {
                    note: {
                        label: d.note,
                        title: formatRelationType(d.type),
                        wrap: 150*size_factor,
                    },
                    relation_type: d.type,
                    x: +d.x * size_factor,
                    y: +d.y * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                }
            ];

            //Set-up the annotation maker
            var makeAnnotationsRelationship = d3.annotation()
                // .editMode(true)
                .type(d3.annotationLabel)
                .annotations(annotations_relationship);
            annotation_relation_group.call(makeAnnotationsRelationship);

            //Update a few stylings
            annotation_relation_group.selectAll(".note-line, .connector")
                .style("stroke", "none");
            annotation_relation_group.select(".annotation-note-title")
                .style("fill", d.pattern_color || "#9e9e9e");
            
        }//function mouse_over_relation

        ///////////////////////////////////////////////////////////////////////////
        //////////////////////// Create cover chapter circle //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        //Add a circle at the center that will show the cover image on hover
        var cover_circle_group = chart.append("g").attr("class", "cover-circle-group");
        var cover_circle_under = cover_circle_group.append("circle")
            .attr("class", "cover-circle cover-circle-under")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", rad_image)
            .style("fill", "none")
            .style("opacity", 0);
        var cover_circle = cover_circle_group.append("circle")
            .attr("class", "cover-circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", rad_image)
            .style("fill", "none");

        ///////////////////////////////////////////////////////////////////////////
        ////////////////////// Create hidden name hover areas /////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var arc_character_hover = d3.arc()
            .outerRadius(function(d,i) { return character_total_data[i].dot_name_rad + rad_hover_circle; })
            .innerRadius(rad_donut_inner)

        //Create the donut slices per character (and the number of chapters they appeared in)
        var character_hover_group = chart.append("g").attr("class", "character-hover-group");
        var character_hover = character_hover_group.selectAll(".character-hover-arc")
            .data(arcs)
            .enter().append("path")
            .attr("class", "character-hover-arc")
            .attr("d", arc_character_hover)
            .style("fill", "none")
            .style("pointer-events", "all")
            .style("cursor", "pointer")
            .on("mouseover", mouse_over_character)
            .on("click", function (d) {
                d3.event.stopPropagation();
                toggle_pattern_focus(d);
            })
            .on("mouseout", mouse_out);

        function apply_pattern_focus(d) {
            if (!d || !d.character || !characterByName[d.character]) return;
            mouse_over_in_action = true;

            stop_merged_pattern_cycle();
            hide_area_info_panel();
            show_pattern_area_panel(d.character, locked_other_pattern_type);

            // 每次切换纹样前先重置高亮状态，避免多次点击后残留旧透明度/旧选中圈。
            var should_emphasize_selected_pattern = info_focus_locked && locked_focus_type === "pattern";
            if (should_emphasize_selected_pattern) {
                names.style("opacity", 0.24);
                name_dot.style("opacity", 0.2);
                names.filter(function (c) { return c.character === d.character; })
                    .style("opacity", 1);
                name_dot.filter(function (c) { return c.character === d.character; })
                    .style("opacity", 1);
            } else {
                names.style("opacity", null);
                name_dot.style("opacity", null);
            }

            hover_circle.style("opacity", 0);
            chapter_hover_slice.style("fill", "none").style("stroke", "none");
            chapter_number.style("fill", null);
            chapter_dot
                .attr("r", chapter_dot_rad)
                .style("stroke-width", chapter_dot_rad * 0.5)
                .style("fill", "#c4c4c4");
            color_hover_circle.style("opacity", 0);
            relation_lines.style("opacity", 0.7);
            annotation_relation_group.selectAll(".annotation").remove();

            // 仅绘制当前纹样相关连线。
            ctx.clearRect(-width/2, -height/2, width, height);
            ctx.globalAlpha = 0.8;
            create_lines("character", character_data.filter(function(c,j) {return c.character === d.character; }) );

            //Update label path
            line_label_path.attr("d", label_arc(characterByName[d.character].name_angle));
            //Update the label text
            clearTimeout(remove_text_timer);
            line_label.text("多建筑共用窗棂纹样：" + d.character);

            // 交叉高亮与该纹样关联的外圈建筑。
            var char_chapters = character_data
                .filter(function(c) { return c.character === d.character; })
                .map(function(c) { return c.chapter; });
            var char_areas = [];
            char_chapters.forEach(function (chapter_id) {
                var area_name = chapter_area_by_id[chapter_id];
                if (area_name && char_areas.indexOf(area_name) < 0) {
                    char_areas.push(area_name);
                }
            });
            var char_color = characterByName[d.character].color;
            chapter_hover_slice.filter(function(c,j) { return char_chapters.indexOf(c.chapter) >= 0; })
                .style("fill", char_color)
                .style("stroke", char_color);
            chapter_number.filter(function(c,j) { return char_chapters.indexOf(c.chapter) >= 0; })
                .style("fill", "white");
            chapter_dot.filter(function(c,j) { return char_chapters.indexOf(c.chapter) >= 0; })
                .attr("r", chapter_dot_rad * 1.5)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", char_color);

            //Show the character image in the center.
            if (d.character === "其他") {
                start_merged_pattern_cycle();
            } else {
                show_center_image_for_pattern(d.character);
                cover_circle.style("fill", "url(#cover-image)").style("opacity", 1);
            }

            //Show the hover circle
            hover_circle.filter(function(c) { return d.character === c.character; })
                .style("opacity", 1);

            update_mini_map({
                buildings: char_chapters,
                areas: char_areas,
                caption: "纹样关联建筑：" + d.character
            });
        }

        function mouse_over_character(d) {
            if (info_focus_locked) return;
            d3.event.stopPropagation();
            apply_pattern_focus(d);
        }//function mouse_over_character

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// Create chapter donut chart //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        //Create groups in right order
        var chapter_group = chart.append("g").attr("class", "chapter-group");
        var donut_chapter_group = chapter_group.append("g").attr("class", "donut-chapter-group");
        var chapter_area_name_group = chapter_group.append("g").attr("class", "chapter-area-name-group");
        var chapter_dot_group = chapter_group.append("g").attr("class", "chapter-dot-group");
        var donut_chapter_hover_group = chapter_group.append("g").attr("class", "donut-chapter_hover-group");
        var chapter_num_group = chapter_group.append("g").attr("class", "chapter-number-group");

        //Arc command for the chapter number donut chart
        var arc_chapter = d3.arc()
            .outerRadius(rad_chapter_donut_outer)
            .innerRadius(rad_chapter_donut_inner)
            .padAngle(0.01)
            .cornerRadius((rad_chapter_donut_outer - rad_chapter_donut_inner) / 2)

        //Create the donut slices per character (and the number of chapters they appeared in)
        var chapter_slice = donut_chapter_group.selectAll(".arc")
            .data(area_ring_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter)
            .style("fill", function (d) { return area_color(d.area); })
            .style("stroke", "white")
            .style("stroke-width", 1 * size_factor);

        defs.selectAll(".area-name-path")
            .data(area_label_data)
            .enter().append("path")
            .attr("class", "area-name-path")
            .attr("id", function (d) { return d.path_id; })
            .attr("d", function (d) {
                var reverse = !(d.centerAngle > 0 && d.centerAngle < Math.PI);
                var from_angle = reverse ? d.endAngle : d.startAngle;
                var to_angle = reverse ? d.startAngle : d.endAngle;
                var x1 = rad_area_label * Math.cos(from_angle - pi1_2),
                    y1 = rad_area_label * Math.sin(from_angle - pi1_2);
                var x2 = rad_area_label * Math.cos(to_angle - pi1_2),
                    y2 = rad_area_label * Math.sin(to_angle - pi1_2);
                var large_arc = d.span > Math.PI ? 1 : 0;
                var sweep = reverse ? 0 : 1;
                return "M" + x1 + "," + y1 + " A" + rad_area_label + "," + rad_area_label + " 0 " + large_arc + " " + sweep + " " + x2 + "," + y2;
            });

        chapter_area_name_group
            .style("pointer-events", "none")
            .selectAll(".chapter-area-name")
            .data(area_label_data)
            .enter().append("text")
            .attr("class", "chapter-area-name")
            .style("fill", function (d) { return d.color; })
            .style("font-size", area_label_font_size + "px")
            .style("font-family", "\"Noto Sans SC\", \"Microsoft YaHei\", \"PingFang SC\", sans-serif")
            .style("font-weight", 600)
            .append("textPath")
            .attr("xlink:href", function (d) { return "#" + d.path_id; })
            .attr("startOffset", "50%")
            .style("text-anchor", "middle")
            .text(function (d) { return d.area; });
        //Create the donut slices per character (and the number of chapters they appeared in)
        var chapter_hover_slice = donut_chapter_hover_group.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", 1.5 * size_factor);

        //The text is placed in the center of each donut slice
        var rad_chapter_donut_half = ((rad_chapter_donut_outer - rad_chapter_donut_inner) / 2 + rad_chapter_donut_inner);
                
        //Add chapter number text
        var chapter_number = chapter_num_group.selectAll(".chapter-number")
            .data(chapter_location_data)
            .enter().append("text")
            .attr("class", "chapter-number")
            .style("text-anchor", "middle")
            .attr("dy", ".35em")
            .attr("transform", function (d, i) {
                var angle = d.centerAngle * 180 / Math.PI - 90;
                return "rotate(" + angle + ")translate(" + rad_chapter_donut_half + ")" +
                    // (d.centerAngle > 0 & d.centerAngle < Math.PI ? "" : "rotate(180)")
                    "rotate(" + -angle + ")";
            })
            .style("font-size", (9*size_factor) + "px")
            .text("");

        //Add a circle at the inside of each chapter slice
        var chapter_dot_rad = 3.5 * size_factor;
        var chapter_dot = chapter_dot_group.selectAll(".chapter-dot")
            .data(chapter_location_data)
            .enter().append("circle")
            .attr("class", "chapter-dot")
            .attr("cx", function (d) { return rad_dot_color * Math.cos(d.centerAngle - pi1_2); })
            .attr("cy", function (d) { return rad_dot_color * Math.sin(d.centerAngle - pi1_2); })
            .attr("r", chapter_dot_rad)
            .style("fill", "#c4c4c4")
            .style("stroke", "white")
            .style("stroke-width", chapter_dot_rad * 0.5)
            .style("cursor", "pointer")
            .on("click", function (d) {
                d3.event.stopPropagation();
                toggle_chapter_focus(d, false, "chapter");
            });

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////// Create hidden chapter hover areas ///////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var arc_chapter_hover = d3.arc()
            .outerRadius(rad_chapter_outer)
            .innerRadius(rad_chapter_inner);

        //Create the donut slices per chapter
        var chapter_hover_group = chart.append("g").attr("class", "chapter-hover-group");
        var chapter_hover = chapter_hover_group.selectAll(".chapter-hover-arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "chapter-hover-arc")
            .attr("d", arc_chapter_hover)
            .style("fill", "none")
            .style("pointer-events", "all")
            .style("cursor", "pointer")
            .on("mouseover", mouse_over_chapter)
            .on("click", function (d) {
                d3.event.stopPropagation();
                toggle_chapter_focus(d, false, "chapter");
            })
            .on("mouseout", mouse_out);

        var arc_area_hover = d3.arc()
            .outerRadius(rad_chapter_outer + 10 * size_factor)
            .innerRadius(rad_chapter_outer + 2 * size_factor);

        var area_hover_group = chart.append("g").attr("class", "area-hover-group");
        var area_hover = area_hover_group.selectAll(".area-hover-arc")
            .data(area_ring_data)
            .enter().append("path")
            .attr("class", "area-hover-arc")
            .attr("d", arc_area_hover)
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("mouseover", mouse_over_area)
            .on("mouseout", mouse_out);

        function hide_area_info_panel() {
            area_info_panel
                .classed("is-visible", false)
                .attr("aria-hidden", "true");
        }

        function show_area_info_panel(area_name, accent_color) {
            var area_intro_data = resolve_area_intro_data(area_name);
            var area_rgb = d3.rgb(accent_color || area_color(area_name) || "#9A8473");

            area_info_title.text(area_intro_data.area || "区域");
            area_info_description.text(area_intro_data.introduction || default_area_intro_text);
            area_info_panel
                .style("--area-info-accent-rgb", area_rgb.r + "," + area_rgb.g + "," + area_rgb.b)
                .classed("is-visible", true)
                .attr("aria-hidden", "false");
        }
// 左下角纹样扇形分布图样式
        function hide_pattern_area_panel() {
            pattern_area_panel
                .classed("is-visible", false)
                .attr("aria-hidden", "true");
        }

        function unique_list(values) {
            var value_set = {};
            var list = [];
            (Array.isArray(values) ? values : []).forEach(function (value) {
                var text = cleanText(value);
                if (!text || value_set[text]) return;
                value_set[text] = true;
                list.push(text);
            });
            return list;
        }

        function build_pattern_center_lines(pattern_name) {
            var text = cleanText(pattern_name) || "纹样";
            if (text.length <= 4) return [text];
            if (text.length <= 8) return [text.slice(0, 4), text.slice(4)];
            return [text.slice(0, 4), text.slice(4, 8)];
        }

        function truncate_area_label(area_name) {
            var label = simplifyAreaText(area_name);
            if (label.length <= 6) return label;
            return label.slice(0, 6) + "…";
        }

        function get_pattern_distribution_state(pattern_name, preferred_other_type) {
            var normalized_pattern = cleanText(pattern_name);
            var display_pattern_name = normalized_pattern || "纹样";
            var chapter_ids = [];

            if (!normalized_pattern) {
                chapter_ids = [];
            } else if (normalized_pattern === "其他") {
                var selected_type = cleanText(preferred_other_type);
                if (!selected_type) {
                    selected_type = resolve_other_pattern_type(locked_other_pattern_type);
                }
                if (selected_type) {
                    display_pattern_name = selected_type;
                    chapter_ids = source_pattern_chapters_map[selected_type] || [];
                } else {
                    chapter_ids = character_data
                        .filter(function (item) { return item.character === "其他"; })
                        .map(function (item) { return item.chapter; });
                    display_pattern_name = "其他（聚合）";
                }
            } else {
                chapter_ids = character_data
                    .filter(function (item) { return item.character === normalized_pattern; })
                    .map(function (item) { return item.chapter; });
            }

            chapter_ids = unique_list(chapter_ids);

            var area_counter = {};
            chapter_ids.forEach(function (chapter_id) {
                var area_name = chapter_area_by_id[chapter_id];
                if (!area_name) return;
                area_counter[area_name] = (area_counter[area_name] || 0) + 1;
            });

            var distribution = building_area_names
                .filter(function (area_name) { return !!area_counter[area_name]; })
                .map(function (area_name) {
                    return {
                        area: area_name,
                        area_label: simplifyAreaText(area_name),
                        value: area_counter[area_name],
                        color: area_color(area_name) || "#9A8473"
                    };
                });

            return {
                pattern_name: display_pattern_name,
                total: chapter_ids.length,
                segments: distribution
            };
        }

        function show_pattern_area_panel(pattern_name, preferred_other_type) {
            var distribution_state = get_pattern_distribution_state(pattern_name, preferred_other_type);
            var segments = distribution_state.segments;
            var total_count = distribution_state.total;
            var sorted_segments = segments.slice().sort(function (a, b) { return b.value - a.value; });
            var fallback_color = d3.rgb("#9A8473");
            var accent_color = sorted_segments.length ? d3.rgb(sorted_segments[0].color) : fallback_color;
            pattern_area_panel
                .style("--area-info-accent-rgb", accent_color.r + "," + accent_color.g + "," + accent_color.b)
                .classed("is-visible", true)
                .attr("aria-hidden", "false");

            var pie_generator = d3.pie()
                .sort(null)
                .padAngle(segments.length > 1 ? 0.016 : 0)
                .value(function (d) { return d.value; });
            var pie_source = segments.length ? segments : [{ area: "暂无数据", area_label: "暂无", value: 1, color: "#D4CABD" }];
            var pie_data = pie_generator(pie_source);
            var arc_generator = d3.arc().innerRadius(45).outerRadius(85).cornerRadius(6);//左下角扇形内外圈半径和圆角
            var label_arc_generator = d3.arc().innerRadius(52).outerRadius(52);

            var slice_paths = pattern_area_slices_group.selectAll(".pattern-area-slice")
                .data(pie_data, function (d) { return d.data.area; });

            slice_paths.exit().remove();

            slice_paths.enter()//每个扇形的样式
                .append("path")
                .attr("class", "pattern-area-slice")
                .merge(slice_paths)
                .attr("d", arc_generator)
                .style("fill", function (d) {
                    return d3.interpolateLab(d.data.color, "#f6efe2")(0.14);
                })
                .style("opacity", 0.7) 
                .style("stroke", "rgba(255,255,255,0.9)")
                .style("stroke-width", 1.3)
                .style("stroke-linejoin", "round");

            var label_data = pie_data.filter(function (d) {
                return (d.endAngle - d.startAngle) >= 0.5 && !!d.data.area_label;
            });
            var slice_labels = pattern_area_labels_group.selectAll(".pattern-area-label")
                .data(label_data, function (d) { return d.data.area; });
            slice_labels.exit().remove();
            slice_labels.enter()
                .append("text")
                .attr("class", "pattern-area-label")
                .merge(slice_labels)
                .attr("transform", function (d) {
                    var pos = label_arc_generator.centroid(d);
                    return "translate(" + pos[0] + "," + pos[1] + ")";
                })
                .text(function (d) { return truncate_area_label(d.data.area_label || d.data.area); });

            var center_lines = build_pattern_center_lines(distribution_state.pattern_name);
            var line_offsets = center_lines.length === 1 ? [0.35] : (center_lines.length === 2 ? [-0.2, 1.2] : [-0.85, 1, 1]);
            pattern_area_center_text.text("");
            var center_tspans = pattern_area_center_text.selectAll("tspan")
                .data(center_lines);
            center_tspans.exit().remove();
            center_tspans.enter()
                .append("tspan")
                .merge(center_tspans)
                .attr("x", 0)
                .attr("dy", function (d, i) { return line_offsets[i] + "em"; })
                .text(function (d) { return d; });

            var legend_items = pattern_area_legend.selectAll(".pattern-area-legend-item")
                .data(sorted_segments, function (d) { return d.area; });
            legend_items.exit().remove();
            var legend_enter = legend_items.enter()
                .append("div")
                .attr("class", "pattern-area-legend-item");
            legend_enter.append("span").attr("class", "pattern-area-legend-swatch");
            legend_enter.append("span").attr("class", "pattern-area-legend-text");
            legend_enter.merge(legend_items).select(".pattern-area-legend-swatch")
                .style("background-color", function (d) { return d.color; });
            legend_enter.merge(legend_items).select(".pattern-area-legend-text")
                .text(function (d) {
                    var ratio = total_count > 0 ? Math.round(d.value * 100 / total_count) : 0;
                    return d.area_label + " " + ratio + "%";
                });

            if (!sorted_segments.length) {
                var empty_legend = pattern_area_legend.selectAll(".pattern-area-legend-item")
                    .data([{ area: "empty", area_label: "暂无关联建筑", value: 0, color: "#D4CABD" }]);
                var empty_enter = empty_legend.enter().append("div").attr("class", "pattern-area-legend-item");
                empty_enter.append("span").attr("class", "pattern-area-legend-swatch");
                empty_enter.append("span").attr("class", "pattern-area-legend-text");
                empty_enter.merge(empty_legend).select(".pattern-area-legend-swatch").style("background-color", "#D4CABD");
                empty_enter.merge(empty_legend).select(".pattern-area-legend-text").text("暂无关联建筑");
            }
        }

        function update_building_info_sidebar(chapter_id) {
            var sidebar_data = building_sidebar_data_by_chapter[chapter_id] || {};
            fill_info_sidebar_values(building_info_field_defs, sidebar_data, "建筑介绍");
            hide_other_pattern_selector();
        }

        function resolve_other_pattern_type(preferred_type) {
            if (!merged_other_pattern_types.length) return "";
            if (preferred_type && merged_other_pattern_types.indexOf(preferred_type) >= 0) {
                return preferred_type;
            }
            return merged_other_pattern_types[0];
        }

        function select_other_pattern_type(pattern_type) {
            if (!(info_focus_locked && locked_focus_type === "pattern" && locked_pattern_name === "其他")) return;
            var resolved_type = resolve_other_pattern_type(pattern_type);
            if (!resolved_type) return;

            locked_other_pattern_type = resolved_type;
            update_pattern_info_sidebar("其他", resolved_type);
            show_pattern_area_panel("其他", resolved_type);

            // 选中具体种类后，中心图固定到该纹样，避免继续自动轮播。
            stop_merged_pattern_cycle();
            show_center_image_for_pattern(resolved_type);
            cover_circle.style("fill", "url(#cover-image)").style("opacity", 1);
        }

        function update_pattern_info_sidebar(pattern_name, preferred_other_type) {
            if (pattern_name === "其他") {
                var selected_other_type = resolve_other_pattern_type(preferred_other_type || locked_other_pattern_type);
                locked_other_pattern_type = selected_other_type;
                var selected_sidebar_data = selected_other_type ? (pattern_sidebar_data_by_type[selected_other_type] || {}) : {};

                fill_info_sidebar_values(pattern_info_field_defs, {
                    type: pickFirstText([selected_other_type, "其他"]),
                    populartime: pickFirstText([selected_sidebar_data.populartime, selected_sidebar_data.popular_time, "—"]),
                    intruductions: pickFirstText([
                        selected_sidebar_data.intruductions,
                        selected_sidebar_data.introduction,
                        "该节点聚合了仅对应一个建筑的纹样，请在下方选择具体纹样种类查看。"
                    ]),
                    meanings: pickFirstText([selected_sidebar_data.meanings, selected_sidebar_data.meaning, "—"])
                }, "纹样介绍");

                render_other_pattern_selector(merged_other_pattern_types, selected_other_type);
                return;
            }

            locked_other_pattern_type = "";
            var sidebar_data = pattern_sidebar_data_by_type[pattern_name] || {};
            var pattern_meta = characterByName[pattern_name] || {};
            fill_info_sidebar_values(pattern_info_field_defs, {
                type: pickFirstText([sidebar_data.type, pattern_name]),
                populartime: pickFirstText([sidebar_data.populartime, sidebar_data.popular_time, pattern_meta.time]),
                intruductions: pickFirstText([sidebar_data.intruductions, sidebar_data.introduction, pattern_meta.introduction]),
                meanings: pickFirstText([sidebar_data.meanings, sidebar_data.meaning, pattern_meta.meaning])
            }, "纹样介绍");
            hide_other_pattern_selector();
        }

        function show_info_sidebar_panel() {
            chart_container.classed("building-info-visible", true);
            building_info_panel
                .classed("is-visible", true)
                .attr("aria-hidden", "false");
            var info_grid_node = building_info_grid.node();
            if (info_grid_node) info_grid_node.scrollTop = 0;
        }

        function show_building_info_sidebar(chapter_id) {
            update_building_info_sidebar(chapter_id);
            show_info_sidebar_panel();
        }

        function show_pattern_info_sidebar(pattern_name, preferred_other_type) {
            update_pattern_info_sidebar(pattern_name, preferred_other_type);
            show_info_sidebar_panel();
        }

        function hide_building_info_sidebar() {
            chart_container.classed("building-info-visible", false);
            building_info_panel
                .classed("is-visible", false)
                .attr("aria-hidden", "true");
            hide_other_pattern_selector();
        }

        function apply_chapter_focus(d, show_cover_ring, line_mode) {
            var current_line_mode = line_mode === "character" ? "character" : "chapter";
            var current_link_data = current_line_mode === "character" ? cover_data : character_data;
            mouse_over_in_action = true;
            stop_merged_pattern_cycle();
            hide_pattern_area_panel();

            ctx.clearRect(-width / 2, -height / 2, width, height);
            ctx.lineWidth = 4 * size_factor;
            ctx.globalAlpha = 1;
            create_lines(current_line_mode, current_link_data.filter(function (c) { return c.chapter === d.chapter; }));

            line_label_path.attr("d", label_arc(d.centerAngle));
            clearTimeout(remove_text_timer);
            line_label.text("采用窗棂纹样的建筑：" + d.data.type);

            var chapter_patterns = current_link_data
                .filter(function (c) { return c.chapter === d.chapter; })
                .map(function (c) { return c.character; });

            names.style("opacity", null);
            name_dot.style("opacity", null);
            names.filter(function (c) { return chapter_patterns.indexOf(c.character) < 0; })
                .style("opacity", 0.2);
            name_dot.filter(function (c) { return chapter_patterns.indexOf(c.character) < 0; })
                .style("opacity", 0.2);

            chapter_hover_slice.style("fill", "none").style("stroke", "none");
            chapter_hover_slice.style("stroke-width", 1.5 * size_factor);
            chapter_number.style("fill", null);
            chapter_dot
                .attr("r", chapter_dot_rad)
                .style("stroke-width", chapter_dot_rad * 0.5)
                .style("fill", "#c4c4c4");

            var active_chapter_slice = chapter_hover_slice
                .filter(function (c) { return c.chapter === d.chapter; });
            if (show_cover_ring) {
                active_chapter_slice
                    .style("fill", "none")
                    .style("stroke", color_sakura)
                    .style("stroke-width", chapter_dot_rad * 0.5 * 1.5);
            } else {
                active_chapter_slice
                    .style("fill", color_sakura)
                    .style("stroke", color_sakura);
                chapter_number
                    .filter(function (c) { return c.chapter === d.chapter; })
                    .style("fill", "white");
            }
            chapter_dot
                .filter(function (c) { return c.chapter === d.chapter; })
                .attr("r", chapter_dot_rad * 1.5)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", color_sakura);

            show_center_image_for_chapter(d.chapter);
            cover_circle.style("fill", "url(#cover-image)").style("opacity", 1);

            hover_circle.style("opacity", 0);
            if (show_cover_ring) {
                color_hover_circle
                    .attr("cx", rad_color * Math.cos(d.centerAngle - pi1_2))
                    .attr("cy", rad_color * Math.sin(d.centerAngle - pi1_2))
                    .style("opacity", 1);
            } else {
                color_hover_circle.style("opacity", 0);
            }

            relation_lines.style("opacity", 0.7);
            annotation_relation_group.selectAll(".annotation").remove();

            var chapter_area_name = chapter_area_by_id[d.chapter];
            show_area_info_panel(chapter_area_name, chapter_area_name ? area_color(chapter_area_name) : null);

            update_mini_map({
                buildings: [d.chapter],
                areas: chapter_area_name ? [chapter_area_name] : [],
                caption: "建筑定位：" + d.data.type
            });
        }

        function lock_chapter_focus(d, show_cover_ring, line_mode) {
            info_focus_locked = true;
            locked_focus_type = "chapter";
            locked_chapter_id = normalizeBuildingId(d.chapter);
            locked_pattern_name = "";
            locked_other_pattern_type = "";
            apply_chapter_focus(d, show_cover_ring, line_mode);
            show_building_info_sidebar(d.chapter);
        }

        function lock_pattern_focus(d) {
            if (!d || !d.character) return;
            info_focus_locked = true;
            locked_focus_type = "pattern";
            locked_pattern_name = d.character;
            locked_chapter_id = null;
            locked_other_pattern_type = d.character === "其他"
                ? resolve_other_pattern_type(locked_other_pattern_type)
                : "";
            apply_pattern_focus(d);
            show_pattern_info_sidebar(d.character, locked_other_pattern_type);
            if (d.character === "其他" && locked_other_pattern_type) {
                select_other_pattern_type(locked_other_pattern_type);
            }
        }

        function unlock_info_focus() {
            info_focus_locked = false;
            locked_focus_type = "";
            locked_chapter_id = null;
            locked_pattern_name = "";
            locked_other_pattern_type = "";
            reset_to_default_view();
        }

        function toggle_chapter_focus(d, show_cover_ring, line_mode) {
            var chapter_id = d ? normalizeBuildingId(d.chapter) : "";
            if (!chapter_id) return;
            if (info_focus_locked && locked_focus_type === "chapter" && locked_chapter_id === chapter_id) {
                unlock_info_focus();
                return;
            }
            lock_chapter_focus(d, show_cover_ring, line_mode);
        }

        function toggle_pattern_focus(d) {
            if (!d || !d.character) return;
            if (info_focus_locked && locked_focus_type === "pattern" && locked_pattern_name === d.character) {
                unlock_info_focus();
                return;
            }
            lock_pattern_focus(d);
        }

        building_info_panel.on("click", function () {
            if (d3.event) d3.event.stopPropagation();
        });

        building_info_close_button.on("click", function () {
            if (d3.event) {
                d3.event.preventDefault();
                d3.event.stopPropagation();
            }
            if (!info_focus_locked) {
                hide_building_info_sidebar();
                return;
            }
            unlock_info_focus();
        });

        function mouse_over_area(d) {
            if (info_focus_locked) return;
            d3.event.stopPropagation();
            mouse_over_in_action = true;
            stop_merged_pattern_cycle();
            hide_pattern_area_panel();

            var area_chapters = area_chapters_map[d.area] ? area_chapters_map[d.area].slice() : [];
            var current_area_color = area_color(d.area);
            var area_center_angle = (d.startAngle + d.endAngle) / 2;

            ctx.clearRect(-width / 2, -height / 2, width, height);
            ctx.lineWidth = 4 * size_factor;
            ctx.globalAlpha = 0.95;
            create_lines("chapter", character_data.filter(function (c) { return area_chapters.indexOf(c.chapter) >= 0; }));

            line_label_path.attr("d", label_arc(area_center_angle));
            clearTimeout(remove_text_timer);
            line_label.text("区域建筑分布：" + d.area);

            chapter_hover_slice
                .filter(function (c) { return area_chapters.indexOf(c.chapter) >= 0; })
                .style("fill", current_area_color)
                .style("stroke", current_area_color);
            chapter_number
                .filter(function (c) { return area_chapters.indexOf(c.chapter) >= 0; })
                .style("fill", "white");
            chapter_dot
                .filter(function (c) { return area_chapters.indexOf(c.chapter) >= 0; })
                .attr("r", chapter_dot_rad * 1.5)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", current_area_color);

            names.style("opacity", null);
            name_dot.style("opacity", null);
            cover_circle.style("fill", "none");
            hover_circle.style("opacity", 0);
            color_hover_circle.style("opacity", 0);
            show_default_center_image();
            show_area_info_panel(d.area, current_area_color);

            update_mini_map({
                buildings: area_chapters,
                areas: [d.area],
                caption: "区域定位：" + d.area
            });
        }//function mouse_over_area

        // 悬浮建筑扇区：仅显示该建筑与纹样的连线。
        function mouse_over_chapter(d,i) {
            if (info_focus_locked) return;
            d3.event.stopPropagation();
            apply_chapter_focus(d, false, "chapter");
        }//function mouse_over_chapter

        //////////////////////////////////////////////////////////////
        ///////////////////// Create CMYK patterns ///////////////////
        //////////////////////////////////////////////////////////////

        //Patterns based on http://blockbuilder.org/veltman/50a350e86de82278ffb2df248499d3e2
        var radius_color_max = 2 * size_factor;
        var radius_color = d3.scaleSqrt().range([0, radius_color_max]);

        var ccs_colors = color_data.map(function (d) { return d.color; }),
            cmyk_colors = ["yellow", "magenta", "cyan", "black"],
            rotation = [0, -15, 15, 45];

        //Loop over the different colors in the palette
        for (var j = 0; j < ccs_colors.length; j++) {
            //Get the radius transformations for this color
            var CMYK = rgbToCMYK(d3.rgb(ccs_colors[j]));

            //Create 4 patterns, C-Y-M-K, together forming the color
            defs.selectAll(".pattern-sub")
                .data(cmyk_colors)
                .enter().append("pattern")
                .attr("id", function (d) { return "pattern-sub-" + d + "-" + j; })
                .attr("patternUnits", "userSpaceOnUse")
                .attr("patternTransform", function (d, i) { return "rotate(" + rotation[i] + ")"; })
                .attr("width", 2 * radius_color_max)
                .attr("height", 2 * radius_color_max)
                .append("circle")
                .attr("fill", Object)
                .attr("cx", radius_color_max)
                .attr("cy", radius_color_max)
                .attr("r", function (d) { return Math.max(0.001, radius_color(CMYK[d])); });

            //Nest the CMYK patterns into a larger pattern
            var patterns = defs.append("pattern")
                .attr("id", "pattern-total-" + j)
                .attr("patternUnits", "userSpaceOnUse")
                .attr("width", radius_color_max * 31)
                .attr("height", radius_color_max * 31)

            //Append white background
            patterns.append("rect")
                .attr("width", width)
                .attr("height", height)
                .attr("x", 0)
                .attr("y", 0)
                .style("fill","white")

            //Add the CMYK patterns
            patterns
                .selectAll(".dots")
                .data(cmyk_colors)
                .enter().append("rect")
                .attr("class", "dots")
                .attr("width", width)
                .attr("height", height)
                .attr("x", 0)
                .attr("y", 0)
                .style("mix-blend-mode", "multiply")
                .attr("fill", function (d, i) { return "url(#pattern-sub-" + cmyk_colors[i] + "-" + j + ")"; })
        }//for j

        ///////////////////////////////////////////////////////////////////////////
        /////////////////////////// Create color circles //////////////////////////
        ///////////////////////////////////////////////////////////////////////////    
        //The colored circles right after the character names
        var color_group = chart.append("g").attr("class", "color-group");
        var color_circle = color_group.selectAll(".color-circle")
            .data(color_data)
            .enter().append("circle")
            .attr("class", "color-circle")
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })
            .attr("r", function (d) { return d.radius * size_factor; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.color; })
            .style("stroke-width", 3 * size_factor)
            // .call(d3.drag()
            //     .on('start', dragstarted)
            //     .on('drag', dragged)
            //     .on('end', dragended)
            // );

        ///////////////////////////////////////////////////////////////////////////
        //////////////////////// Create hover color circle ////////////////////////
        ///////////////////////////////////////////////////////////////////////////  

        //The stroked circle around the color circles that appears on a hover
        var color_circle_hover_group = chart.append("g").attr("class", "color-circle-hover-group");
        var color_hover_circle = color_circle_hover_group
            // .selectAll(".color-hover-circle")
            // .data(chapter_location_data)
            // .enter()
            .append("circle")
            .attr("class", "color-hover-circle")
            // .attr("cx", function (d) { return rad_color * Math.cos(d.centerAngle - pi1_2); })
            // .attr("cy", function (d) { return rad_color * Math.sin(d.centerAngle - pi1_2); })
            .attr("r",  36 * size_factor)
            .style("fill", "none")
            .style("stroke", color_sakura)
            .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
            .style("opacity", 0);

        ///////////////////////////////////////////////////////////////////////////
        ////////////////////// Create hidden cover hover areas ////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var arc_cover_hover = d3.arc()
            .outerRadius(rad_cover_outer)
            .innerRadius(rad_cover_inner);

        //Create the donut slices per chapter
        var cover_hover_group = chart.append("g").attr("class", "cover-hover-group");
        var cover_hover = cover_hover_group.selectAll(".cover-hover-arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "cover-hover-arc")
            .attr("d", arc_cover_hover)
            .style("fill", "none")
            .style("pointer-events", "all")
            .style("cursor", "pointer")
            .on("mouseover", mouse_over_cover)
            .on("click", function (d) {
                d3.event.stopPropagation();
                toggle_chapter_focus(d, true, "character");
            })
            .on("mouseout", mouse_out);

        // 悬浮封面环逻辑与建筑悬浮类似，额外显示颜色点聚焦圈。
        function mouse_over_cover(d,i) {
            if (info_focus_locked) return;
            d3.event.stopPropagation();
            apply_chapter_focus(d, true, "character");
        }//function mouse_over_cover

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// General mouse out function //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        container.on("mouseout", mouse_out);
        // 点击图表容器中的“无反馈区域”时，统一关闭当前信息栏锁定状态。
        chart_container.on("click", function () {
            if (!info_focus_locked) {
                if (chart_container.classed("building-info-visible")) {
                    hide_building_info_sidebar();
                }
                return;
            }
            unlock_info_focus();
        });

        function reset_to_default_view() {
            mouse_over_in_action = false;
            stop_merged_pattern_cycle();
            hide_building_info_sidebar();
            hide_area_info_panel();
            hide_pattern_area_panel();

            ctx.clearRect(-width / 2, -height / 2, width, height);
            ctx.globalAlpha = cover_alpha;
            create_lines("character", cover_data);

            //Update the label text
            line_label.text(default_label_text)
            remove_text_timer = setTimeout(function() { line_label.text("")}, 6000);

            //Character names back to normal
            names.style("opacity", null);
            name_dot.style("opacity", null);

            //Character names back to normal
            names.style("opacity", null);
            name_dot.style("opacity", null);

            //Chapter donut back to normal
            chapter_hover_slice.style("fill", "none").style("stroke", "none");
            chapter_number.style("fill", null);
            chapter_dot
                .attr("r", chapter_dot_rad)
                .style("stroke-width", chapter_dot_rad * 0.5)
                .style("fill", "#c4c4c4");

            //Remove cover image
            cover_circle.style("fill", "none");
            show_default_center_image();

            //Hide the hover circle
            hover_circle.style("opacity", 0);
            //Hide the circle around the color chapter group
            color_hover_circle.style("opacity", 0);

            //Bring all relationships back
            relation_lines.style("opacity", 0.7);
            //Remove relationship annotation
            annotation_relation_group.selectAll(".annotation").remove();

            update_mini_map();
        }//function reset_to_default_view

        // 所有悬浮出口统一走该重置逻辑。
        function mouse_out() {
            if (info_focus_locked) return;
            //Only run this if there was a mouseover before
            if(!mouse_over_in_action) return;
            reset_to_default_view();
        }//function mouse_out

        ///////////////////////////////////////////////////////////////////////////
        //////////////////////// Create captured card labels //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var card_group = chart.append("g").attr("class", "card-group");

        //Create a group per character
        var card_label = card_group.selectAll(".card-label")
            .data(chapter_total_data)
            .enter().append("text")
            .attr("class", "card-label")
            .attr("dy", ".35em")
            .each(function(d,i) {
                d.centerAngle = chapterById[d.chapter] ? chapterById[d.chapter].centerAngle : 0;
            })
            .attr("transform", function (d, i) {
                return "rotate(" + (d.centerAngle * 180 / Math.PI - 90) + ")"
                    + "translate(" + rad_card_label + ")"
                    + (isRightSideAngle(d.centerAngle) ? "" : "rotate(180)");
            })
            .style("text-anchor", function (d) { return isRightSideAngle(d.centerAngle) ? "start" : "end"; })
            .style("font-size", (20 * size_factor) + "px")//外圈建筑名字体大小
            .text(function (d, i) { return d.card_captured; });

        //////////////////////////////////////////////////////////////
        ///////////////// Create annotation gradients ////////////////
        //////////////////////////////////////////////////////////////

        //Gradient for the titles of the annotations
        var grad = defs.append("linearGradient")
            .attr("id", "gradient-title")
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "100%").attr("y2", "0%");
        grad.append("stop")
            .attr("offset", "50%")   
            .attr("stop-color", color_sakura);
        grad.append("stop")
            .attr("offset", "200%")   
            .attr("stop-color", "#ED8B6A");

        //Gradient for the titles of the annotations
        var grad = defs.append("linearGradient")
            .attr("id", "gradient-title-legend")
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "100%").attr("y2", "0%");
        grad.append("stop")
            .attr("offset", "50%")   
            .attr("stop-color", color_syaoran);
        grad.append("stop")
            .attr("offset", "200%")   
            .attr("stop-color", "#9ABF2B");
        
        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// Create line title label /////////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var line_label_group = chart.append("g").attr("class", "line-label-group");

        // 以给定角度生成一小段弧线路径，承载弯曲提示文字。
        // 左半侧翻转方向，确保文字保持正向阅读。
        function label_arc(angle) {
            var x1 = rad_line_label * Math.cos(angle + 0.01 - pi1_2),
                y1 = rad_line_label * Math.sin(angle + 0.01 - pi1_2);
            var x2 = rad_line_label * Math.cos(angle - 0.01 - pi1_2),
                y2 = rad_line_label * Math.sin(angle - 0.01 - pi1_2);
            if (angle / Math.PI > 0.5 && angle / Math.PI < 1.5) {
                return "M" + x1 + "," + y1 + " A" + rad_line_label + "," + rad_line_label + " 0 1 1 " + x2 + "," + y2;
            } else {
                return "M" + x2 + "," + y2 + " A" + rad_line_label + "," + rad_line_label + " 0 1 0 " + x1 + "," + y1;
            }//else
        }//function label_arc

        //Create the paths along which the pillar labels will run
        var line_label_path = line_label_group.append("path")
            .attr("class", "line-label-path")
            .attr("id", "line-label-path")
            .attr("d", label_arc(character_total_data.length ? characterByName[character_total_data[0].character].name_angle : 0))
            .style("fill", "none")
            .style("display", "none");

        //Create the label text
        var default_label_text = "彩色连线展示了建筑与窗棂纹样之间的关系";
        var line_label = line_label_group.append("text")
            .attr("class", "line-label")
            .attr("dy", "0.35em")
            .style("text-anchor", "middle")
            .style("font-size", (22 * size_factor) + "px")
            .append("textPath")
            .attr("xlink:href", "#line-label-path")
            .attr("startOffset", "50%")
            .text(default_label_text);

        ///////////////////////////////////////////////////////////////////////////
        //////////////////// Create character & chapter lines /////////////////////
        /////////////////////////////////////////////////////////////////////////// 
        
        //Line function to draw the lines from character to chapter on canvas
        var line = d3.lineRadial()
            .angle(function(d) { return d.angle; })
            .radius(function(d) { return d.radius; })
            .curve(d3.curveBasis)
            .context(ctx);
            
        //Draw the lines for the cover
        ctx.globalAlpha = cover_alpha;
        create_lines("character", cover_data);

        function create_lines(type, data) {
            // 同一套路径生成器复用两种模式：
            // - "character"：强调一个纹样连接多个建筑
            // - "chapter"：强调一个建筑连接多个纹样
            var curve_range = type === "character" ? [rad_line_max, rad_line_min] : [rad_line_min, rad_line_max];
            var start_offset_range = type === "character" ? [0, 0.07] : [0, 0.01];
            var end_offset_range = type === "character" ? [0, 0.02] : [0, 0.07];
            var step = 0.06;

            function interpolate(range, value) {
                return range[0] + (range[1] - range[0]) * value;
            }

            for (var i = 0; i < data.length; i++) {
                var d = data[i];
                var line_data = [];

                if (!characterByName[d.character] || !chapterById[d.chapter]) continue;

                var source_a = characterByName[d.character].name_angle,
                    source_r = characterByName[d.character].dot_name_rad
                var target_a = chapterById[d.chapter].centerAngle,
                    target_r = rad_dot_color;

                // 计算转向与归一化角距 da，
                // 由此决定曲率和首尾偏移量。
                if (target_a - source_a < -Math.PI) {
                    var side = "cw";
                    var da = 2 + (target_a - source_a) / Math.PI;
                    var angle_sign = 1;
                } else if (target_a - source_a < 0) {
                    var side = "ccw";
                    var da = (source_a - target_a) / Math.PI;
                    var angle_sign = -1;
                } else if (target_a - source_a < Math.PI) {
                    var side = "cw";
                    var da = (target_a - source_a) / Math.PI;
                    var angle_sign = 1;
                } else {
                    var side = "ccw";
                    var da = 2 - (target_a - source_a) / Math.PI;
                    var angle_sign = -1;
                }//else
                //console.log(side, da, angle_sign);


                //Calculate the radius of the middle arcing section of the line
                var rad_curve_line = interpolate(curve_range, da) * width;

                //Slightly offset the first point on the curve from the source
                var start_angle = source_a + angle_sign * interpolate(start_offset_range, da) * Math.PI;

                //Slightly offset the last point on the curve from the target
                var end_angle = target_a - angle_sign * interpolate(end_offset_range, da) * Math.PI;

                if (target_a - source_a < -Math.PI) {
                    var da_inner = pi2 + (end_angle - start_angle);
                } else if (target_a - source_a < 0) {
                    var da_inner = (start_angle - end_angle);
                } else if (target_a - source_a < Math.PI) {
                    var da_inner = (end_angle - start_angle);
                } else if (target_a - source_a < 2 * Math.PI) {
                    var da_inner = pi2 - (end_angle - start_angle)
                }//else if

                //Attach first point to data
                line_data.push({
                    angle: source_a,
                    radius: source_r
                });

                //Attach first point of the curve section
                line_data.push({
                    angle: start_angle,
                    radius: rad_curve_line
                });

                // 对弧段进行采样，交给 lineRadial 生成平滑曲线。
                var n = Math.abs(Math.floor(da_inner / step));
                var curve_angle = start_angle;
                var sign = side === "cw" ? 1 : -1;
                if(n >= 1) {
                    for (var j = 0; j < n; j++) {
                        curve_angle += (sign * step) % pi2; 
                        line_data.push({
                            angle: curve_angle,
                            radius: rad_curve_line
                        });
                    }//for j
                }//if

                //Attach last point of the curve section
                line_data.push({
                    angle: end_angle,
                    radius: rad_curve_line
                });

                //Attach last point to data
                line_data.push({
                    angle: target_a,
                    radius: target_r
                });

                //Draw the path
                ctx.beginPath();
                line(line_data);
                ctx.strokeStyle = characterByName[d.character].color;
                ctx.stroke(); 

            }//for

            ctx.globalAlpha = 0.7;
            ctx.lineWidth = 3 * size_factor;

        }//function create_lines

    }//function draw

    // Retina non-blurry canvas
    function crispyCanvas(canvas, ctx, sf) {
        canvas
            .attr('width', sf * width)
            .attr('height', sf * height)
            .style('width', width + "px")
            .style('height', height + "px");
        ctx.scale(sf, sf);
    }//function crispyCanvas

    // //Dragging functions for final positioning adjustments
    // function dragstarted(d) {
    //     if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    //     d.fx = d.x;
    //     d.fy = d.y;
    // }//function dragstarted

    // function dragged(d) {
    //     d.fx = d3.event.x;
    //     d.fy = d3.event.y;
    // }//function dragged

    // function dragended(d) {
    //     if (!d3.event.active) simulation.alphaTarget(0);
    //     d.fx = null;
    //     d.fy = null;
    // }//function dragended

}//function create_CCS_chart

//////////////////////////////////////////////////////////////
////////////////////// Helper functions //////////////////////
//////////////////////////////////////////////////////////////

// 将 RGB 转为 CMYK 比例，用于半调网点半径计算。
// 输出四个通道均为 [0, 1] 范围。
function rgbToCMYK(rgb) {
    var r = rgb.r / 255,
        g = rgb.g / 255,
        b = rgb.b / 255,
        k = 1 - Math.max(r, g, b);

    return {
        cyan: (1 - r - k) / (1 - k),
        magenta: (1 - g - k) / (1 - k),
        yellow: (1 - b - k) / (1 - k),
        black: k
    };
}//function rgbToCMYK

// 固定种子的伪随机函数，用于稳定初始抖动。
// 保持可复现，便于调参与排查布局问题。
//https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
var seed = 4;
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}//function random

function formatRelationType(type) {
    if (type === "same_pattern") return "Same Pattern";
    return "Relation";
}//function formatRelationType

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}//function capitalizeFirstLetter

