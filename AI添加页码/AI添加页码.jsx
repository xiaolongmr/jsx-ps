//@target illustrator
app.preferences.setBooleanPreference('ShowExternalJSXWarning', false); // 避免外部脚本警告

// ===== 配置管理系统 =====
// 配置文件路径
var CONFIG_FOLDER = new Folder(Folder.userData + "/AdobeJSXScripts/AddPageNumbers");
var CONFIG_FILE = new File(CONFIG_FOLDER + "/config.json");

// 创建配置文件夹
if (!CONFIG_FOLDER.exists) {
    CONFIG_FOLDER.create();
}

// 保存配置到文件
function saveConfig(configData) {
    try {
        var configStr = JSON.stringify(configData, null, 2);
        CONFIG_FILE.open("w");
        CONFIG_FILE.write(configStr);
        CONFIG_FILE.close();
        return true;
    } catch (e) {
        return false;
    }
}

// 从文件加载配置
function loadConfig() {
    try {
        if (CONFIG_FILE.exists) {
            CONFIG_FILE.open("r");
            var configStr = CONFIG_FILE.read();
            CONFIG_FILE.close();
            return JSON.parse(configStr);
        }
    } catch (e) {
        // 配置文件不存在或损坏，返回默认值
    }
    return getDefaultConfig();
}

// 获取默认配置
function getDefaultConfig() {
    return {
        fontSize: 16,
        margins: 5,
        fontIndex: 0,
        location: "bottom",  // top, middle, bottom
        alignment: "center", // left, center, right
        bindingAlignment: "normal",  // normal, outer, inner
        pageDigits: "auto",  // auto, 2, 3
        footerContent: "*page*",
        timeFormat: "24h"  // 新增：24h 或 12h
    };
}

// 应用配置到UI
function applyConfigToUI(config, ddFont, txtFontSize, txtMargins, radTop, radMiddle, radBottom, 
                          radLeft, radCenter, radRight, radBindingNormal, radBindingOuter, 
                          radBindingInner, ddPageDigits, txtFooter, rad24h, rad12h) {
    try {
        txtFontSize.text = String(config.fontSize || 16);
        txtMargins.text = String(config.margins || 5);
        
        if (ddFont.items.length > 0) {
            var fontIndex = Math.min(config.fontIndex || 0, ddFont.items.length - 1);
            ddFont.selection = fontIndex;
        }
        
        // 位置
        switch (config.location) {
            case "top": radTop.value = true; break;
            case "middle": radMiddle.value = true; break;
            default: radBottom.value = true; break;
        }
        
        // 对齐
        switch (config.alignment) {
            case "left": radLeft.value = true; break;
            case "right": radRight.value = true; break;
            default: radCenter.value = true; break;
        }
        
        // 装订对齐
        switch (config.bindingAlignment) {
            case "outer": radBindingOuter.value = true; break;
            case "inner": radBindingInner.value = true; break;
            default: radBindingNormal.value = true; break;
        }
        
        // 页码位数
        switch (config.pageDigits) {
            case "2": ddPageDigits.selection = 1; break;
            case "3": ddPageDigits.selection = 2; break;
            default: ddPageDigits.selection = 0; break;
        }
        
        // 时间格式（新增）
        if (config.timeFormat === "12h") {
            rad12h.value = true;
        } else {
            rad24h.value = true;
        }
        
        txtFooter.text = config.footerContent || "*page*";
    } catch (e) {
        // 配置应用失败，使用默认值
    }
}

// 从UI获取当前配置
function getConfigFromUI(ddFont, txtFontSize, txtMargins, radTop, radMiddle, radBottom, 
                          radLeft, radCenter, radRight, radBindingNormal, radBindingOuter, 
                          radBindingInner, ddPageDigits, txtFooter, rad24h, rad12h) {
    var location = radTop.value ? "top" : (radMiddle.value ? "middle" : "bottom");
    var alignment = radLeft.value ? "left" : (radRight.value ? "right" : "center");
    var bindingAlignment = radBindingOuter.value ? "outer" : (radBindingInner.value ? "inner" : "normal");
    var pageDigits = ddPageDigits.selection.index === 1 ? "2" : (ddPageDigits.selection.index === 2 ? "3" : "auto");
    var timeFormat = rad12h.value ? "12h" : "24h";  // 新增：获取时间格式选择
    
    return {
        fontSize: parseInt(txtFontSize.text) || 16,
        margins: parseInt(txtMargins.text) || 5,
        fontIndex: ddFont.selection ? ddFont.selection.index : 0,
        location: location,
        alignment: alignment,
        bindingAlignment: bindingAlignment,
        pageDigits: pageDigits,
        footerContent: txtFooter.text,
        timeFormat: timeFormat  // 新增
    };
}

// 核心函数：在Illustrator中打开指定URL (用户提供)
function openURL(url) {
    try {
        // 创建临时HTML文件
        var tempFile = new File(Folder.temp + "/tempLink.html");
        
        // 写入自动跳转的HTML内容
        tempFile.open("w");
        tempFile.write('<html><head><meta http-equiv="Refresh" content="0; URL=' + url + '"></head></html>');
        tempFile.close();
        
        // 执行文件以打开浏览器
        tempFile.execute();
    } catch (e) {
        // 如果tempFile.execute()失败，可能因为安全设置或缺少默认浏览器
        alert("无法自动打开链接。错误: " + e.message + "\n链接已复制到剪贴板: " + url);
        $.setClipboard(url); // 提供剪贴板作为备选
    }
}

try { // 添加顶层try-catch块来捕获启动错误
    if (app.documents.length > 0) {
        // 使用 "dialog" 类型窗口，这是模态的，但更稳定
        var win = new Window("dialog", "添加页码 v2.1 - 小张出品"); 
        win.orientation = "column";
        win.alignChildren = "fill";
        win.spacing = 15;
        win.margins = 15;

        // 设置默认透明度 (99%)
        win.opacity = 0.99; 

        // --- 顶部控制区域 ---
        var mainGroup = win.add("group");
        mainGroup.orientation = "column";
        mainGroup.alignChildren = "fill";
        mainGroup.spacing = 15; // 增加主要组间距

        var topControlsGroup = mainGroup.add("group");
        topControlsGroup.orientation = "row";
        topControlsGroup.alignChildren = "top";
        topControlsGroup.spacing = 15;

        // 左侧设置面板组
        var leftPanelGroup = topControlsGroup.add("group");
        leftPanelGroup.orientation = "column";
        leftPanelGroup.alignChildren = "fill";
        leftPanelGroup.spacing = 10;

        // 字体和字号设置组
        var panelFontSettings = leftPanelGroup.add("panel", undefined, "字体设置");
        panelFontSettings.orientation = "row";
        panelFontSettings.alignChildren = "center";
        panelFontSettings.spacing = 10;
        panelFontSettings.margins = [10,10,10,10];

        panelFontSettings.add("statictext", undefined, "字体:");
        var ddFont = panelFontSettings.add("dropdownlist", undefined, []);
        ddFont.preferredSize.width = 150;

        // 填充字体下拉菜单 (将显示系统可用的字体名称，包括中文)
        var textFonts = app.textFonts;
        var defaultFontIndex = 0;
        var fontDisplayNameList = []; // 新增：用于存储和显示友好的字体名称

        for (var f = 0; f < textFonts.length; f++) {
            var font = textFonts[f];
            // 核心修改：使用 font.family + " " + font.style 拼接友好名称
            var friendlyFontName = font.family + " " + font.style; 
            fontDisplayNameList.push(friendlyFontName); // 存储友好名称
            ddFont.add("item", friendlyFontName); // 将友好名称添加到下拉框
            
            // 尝试默认选中一个常见的字体
            if (friendlyFontName.indexOf("ArialMT") !== -1 || friendlyFontName.indexOf("思源黑体") !== -1 || friendlyFontName.indexOf("Microsoft YaHei") !== -1) {
                defaultFontIndex = f;
                // 如果找到思源黑体或微软雅黑，优先选中
                if (friendlyFontName.indexOf("思源黑体") !== -1 || friendlyFontName.indexOf("Microsoft YaHei") !== -1) {
                    break;
                }
            }
        }
        // 如果没有找到特定字体，确保始终有一个默认选中项
        if (textFonts.length > 0) {
            ddFont.selection = defaultFontIndex; 
        } else {
            // 如果系统没有字体，添加一个占位符
            ddFont.add("item", "无可用字体");
            ddFont.selection = 0;
            ddFont.enabled = false; // 禁用字体选择
        }

        panelFontSettings.add("statictext", undefined, "字号:");
        var txtFontSize = panelFontSettings.add("edittext", undefined, "16"); // 默认字号16pt
        txtFontSize.characters = 4;

        // 边缘设置面板
        var panelMargins = leftPanelGroup.add("panel", undefined, "边缘设置");
        panelMargins.orientation = "row";
        panelMargins.alignChildren = "center";
        panelMargins.spacing = 5;
        panelMargins.add("statictext", undefined, "距离边缘:");
        var txtMargins = panelMargins.add("edittext", undefined, "5"); // 默认值5mm
        txtMargins.characters = 5;
        panelMargins.add("statictext", undefined, "mm"); // 单位改为mm

        // 位置设置面板
        var panelLocation = leftPanelGroup.add("panel", undefined, "页码位置");
        panelLocation.orientation = "row";
        panelLocation.alignChildren = "center";
        panelLocation.spacing = 10;
        var radTop = panelLocation.add("radiobutton", undefined, "顶部");
        var radMiddle = panelLocation.add("radiobutton", undefined, "中间"); // 新增中间选项
        var radBottom = panelLocation.add("radiobutton", undefined, "底部");
        radBottom.value = true; // 默认底部

        // 对齐设置面板
        var panelAlignment = leftPanelGroup.add("panel", undefined, "页码常规对齐"); // 名称更精确
        panelAlignment.orientation = "row";
        panelAlignment.alignChildren = "center";
        panelAlignment.spacing = 10;
        var radLeft = panelAlignment.add("radiobutton", undefined, "左对齐");
        var radCenter = panelAlignment.add("radiobutton", undefined, "居中");
        var radRight = panelAlignment.add("radiobutton", undefined, "右对齐");
        radCenter.value = true; // 默认居中

        // 装订页码对齐设置面板 (新增)
        var panelBindingAlignment = leftPanelGroup.add("panel", undefined, "装订页码对齐 (优先于常规对齐)");
        panelBindingAlignment.orientation = "row";
        panelBindingAlignment.alignChildren = "center";
        panelBindingAlignment.spacing = 10;
        var radBindingNormal = panelBindingAlignment.add("radiobutton", undefined, "关闭"); // 改为“关闭”表示不启用装订对齐
        var radBindingOuter = panelBindingAlignment.add("radiobutton", undefined, "外侧对齐");
        var radBindingInner = panelBindingAlignment.add("radiobutton", undefined, "内侧对齐");
        radBindingNormal.value = true; // 默认关闭装订对齐

        // 页码位数设置面板
        var panelPageDigits = leftPanelGroup.add("panel", undefined, "页码位数");
        panelPageDigits.orientation = "row";
        panelPageDigits.alignChildren = "center";
        panelPageDigits.spacing = 10;
        panelPageDigits.add("statictext", undefined, "页码位数:");
        var ddPageDigits = panelPageDigits.add("dropdownlist", undefined, ["自动", "2位 (01, 10)", "3位 (001, 100)"]);
        ddPageDigits.selection = 0; // Default to "自动"

        // 右侧选择画板面板
        var panelArtboards = topControlsGroup.add("panel", undefined, "选择画板 (勾选添加页码)");
        panelArtboards.orientation = "column";
        panelArtboards.alignChildren = "fill";
        var artboardList = panelArtboards.add("ListBox", [0,0,250,200], [], {multiselect: true, scrolling: true}); // 扩大列表框

        // 填充画板列表
        var idoc = app.activeDocument;
        for (var i = 0; i < idoc.artboards.length; i++) {
            artboardList.add("item", "画板 " + (i + 1) + ": " + idoc.artboards[i].name);
            artboardList.items[i].selected = true; // 默认全部选中
        }

        // ===== 加载保存的配置 =====
        var savedConfig = loadConfig();
        applyConfigToUI(savedConfig, ddFont, txtFontSize, txtMargins, radTop, radMiddle, radBottom, 
                        radLeft, radCenter, radRight, radBindingNormal, radBindingOuter, 
                        radBindingInner, ddPageDigits, txtFooter, rad24h, rad12h);

        // --- 页脚内容设置 ---
        var panelFooter = mainGroup.add("panel", undefined, "页码内容 (可输入文本和变量)");
        panelFooter.orientation = "column";
        panelFooter.alignChildren = "fill";
        panelFooter.spacing = 8;

        var grpVars = panelFooter.add("group");
        grpVars.alignChildren = "center";
        grpVars.spacing = 5;
        var btnPage = grpVars.add("button", undefined, "页码");
        var btnPages = grpVars.add("button", undefined, "总页数");
        var btnDate = grpVars.add("button", undefined, "日期");
        var btnTime = grpVars.add("button", undefined, "时间");
        var btnFullName = grpVars.add("button", undefined, "完整路径");
        var btnFile = grpVars.add("button", undefined, "文件名");
        var btnClear = grpVars.add("button", undefined, "清空");
        btnPage.size = btnPages.size = btnDate.size = btnTime.size = btnFullName.size = btnFile.size = btnClear.size = [60, 24];

        var txtFooter = panelFooter.add("edittext", undefined, "*page*"); // 默认值更改为 *page*
        txtFooter.characters = 50;
        txtFooter.active = true;
        txtFooter.onDraw = function() {
            var gx = this.graphics;
            gx.drawOSControl();
            this.text || this.active || gx.drawString("[在此处输入页码内容，如：第 *page* 页 共 *pages* 页]", grayPen, 0, 0);
        };

        // --- 运行信息框 ---
        var panelInfo = mainGroup.add("panel", undefined, "运行日志");
        panelInfo.orientation = "column";
        panelInfo.alignChildren = "fill";
        var txtInfo = panelInfo.add("edittext", [0,0,500,120], "", {multiline: true, readonly: true, scrollbars: true});
        txtInfo.text = "脚本已加载，请设置选项并点击 '生成页码'。\n";

        // --- 底部操作按钮组 ---
        var actionButtonsGroup = mainGroup.add("group");
        actionButtonsGroup.orientation = "row";
        actionButtonsGroup.alignChildren = "center";
        actionButtonsGroup.spacing = 15;
        actionButtonsGroup.margins = [0, 10, 0, 0];

        var btnSaveConfig = actionButtonsGroup.add("button", undefined, "保存配置");
        var btnAbout = actionButtonsGroup.add("button", undefined, "关于脚本");
        var btnPreview = actionButtonsGroup.add("button", undefined, "预览页码");
        var btnOk = actionButtonsGroup.add("button", undefined, "生成页码");
        var btnDelete = actionButtonsGroup.add("button", undefined, "删除页码");
        var btnCancel = actionButtonsGroup.add("button", undefined, "取消");

        // --- 按钮事件及辅助函数 ---

        // 文本输入框占位符的笔刷
        var wgx = win.graphics;
        var grayPen = wgx.newPen(wgx.PenType.SOLID_COLOR, [0.67, 0.67, 0.67], 1);

        // Custom padding function (ExtendScript doesn't have String.padStart)
        function padZero(num, size) {
            var s = String(num);
            while (s.length < size) {
                s = "0" + s;
            }
            return s;
        }

        // 生成页码的核心函数，is_preview 决定是生成到最终层还是预览层
        function createPageNumbers(is_preview) {
            var idoc = app.activeDocument;
            if (!idoc) {
                throw new Error("没有打开的文档。");
            }

            // ===== 性能优化：禁用自动重绘 =====
            var origRedrawMode = idoc.redrawEnabled;
            idoc.redrawEnabled = false;

            try {
                var targetLayerName = is_preview ? "预览页码层" : "页码层";
                
                // 删除旧的当前目标层（如果存在）
                try {
                    var existingLayer = idoc.layers[targetLayerName];
                    existingLayer.remove();
                    txtInfo.text += "已删除旧的 '" + targetLayerName + "' 图层。\n";
                } catch (e) {
                    // 图层不存在，无需处理
                }
                
                // 创建新的目标层
                var ilayer = idoc.layers.add();
                ilayer.name = targetLayerName;
                txtInfo.text += "创建新的 '" + targetLayerName + "' 图层。\n";

                var totalPages = idoc.artboards.length; // 总画板数量
                var datee = getdate();
                var timee = rad12h.value ? gettime12h() : gettime24h();  // 根据用户选择的格式获取时间
                var fname = idoc.saved ? decodeURI(idoc.fullName.fsName) : "未保存文档";
                var file = idoc.saved ? decodeURI(idoc.name) : "未保存文档";

                txtInfo.text += "正在处理页码内容模板...\n";
                // 使用安全的替换顺序：先替换多字符变量，再替换单字符，避免嵌套问题
                var footerPagesTemplate = txtFooter.text;
                footerPagesTemplate = footerPagesTemplate.replace(/\*fname\*/g, fname);  // 最长的变量
                footerPagesTemplate = footerPagesTemplate.replace(/\*pages\*/g, totalPages);
                footerPagesTemplate = footerPagesTemplate.replace(/\*file\*/g, file);
                footerPagesTemplate = footerPagesTemplate.replace(/\*date\*/g, datee);
                footerPagesTemplate = footerPagesTemplate.replace(/\*time\*/g, timee);
                footerPagesTemplate = footerPagesTemplate.replace(/\*page\*/g, "***PAGE_NUMBER_PLACEHOLDER***");  // 用占位符
                txtInfo.text += "页码内容模板处理完成。\n";

                // 将mm转换为点 (1英寸 = 72点, 1英寸 = 25.4mm)
                var marginsMM = Number(txtMargins.text);
                var margins = (marginsMM / 25.4) * 72;
                if (isNaN(margins) || marginsMM < 0 || marginsMM > 100) {
                    margins = (5 / 25.4) * 72; // 默认5mm
                    var invalidReason = isNaN(margins) ? "格式错误" : (marginsMM < 0 ? "不能为负数" : "不能超过100mm");
                    txtInfo.text += "边缘值 " + invalidReason + "，已使用默认值 5mm。\n";
                } else {
                    txtInfo.text += "边缘: " + marginsMM.toFixed(2) + "mm。\n";
                }

                // 获取选中的字体名称 (这里仍是友好名称)
                var selectedFontDisplayName = ddFont.selection.text; 
                var selectedFontSize = parseFloat(txtFontSize.text);

                if (isNaN(selectedFontSize) || selectedFontSize <= 0 || selectedFontSize > 200) {
                    selectedFontSize = 16; // 默认字号16pt
                    var fontSizeReason = isNaN(selectedFontSize) ? "格式错误" : (selectedFontSize <= 0 ? "必须大于0" : "不能超过200pt");
                    txtInfo.text += "字号 " + fontSizeReason + "，已使用默认值 16pt。\n";
                } else {
                    txtInfo.text += "字号: " + selectedFontSize + "pt。\n";
                }
                txtInfo.text += "字体设置为: " + selectedFontDisplayName + "。\n";


                var selectedArtboardIndices = [];
                for (var i = 0; i < artboardList.items.length; i++) {
                    if (artboardList.items[i].selected) {
                        selectedArtboardIndices.push(i);
                    }
                }

                if (selectedArtboardIndices.length === 0) {
                    throw new Error("未选择任何画板。请至少选择一个画板来添加页码。");
                } else {
                    txtInfo.text += "已选择 " + selectedArtboardIndices.length + " 个画板。\n";
                }

                var actualPageNumber = 1; // 用于页码变量 *page* 的实际页码计数

                for (var i = 0; i < idoc.artboards.length; i += 1) {
                    if (arrayContains(selectedArtboardIndices, i)) {
                        var currentPageNumberFormatted = String(actualPageNumber);
                        var selectedDigitOption = ddPageDigits.selection.text;

                        if (selectedDigitOption.indexOf("2位") !== -1) {
                            currentPageNumberFormatted = padZero(actualPageNumber, 2);
                        } else if (selectedDigitOption.indexOf("3位") !== -1) {
                            currentPageNumberFormatted = padZero(actualPageNumber, 3);
                        }
                        
                        // 使用占位符替换，避免嵌套问题
                        var footerPageContent = footerPagesTemplate.replace(/\*\*\*PAGE_NUMBER_PLACEHOLDER\*\*\*/g, currentPageNumberFormatted);

                        var itext = ilayer.textFrames.add();
                        itext.contents = footerPageContent;

                        try {
                            // 通过 friendlyFontName 查找真正的 textFont 对象
                            // 需要遍历 textFonts 找到匹配 friendlyFontName 的字体对象
                            var fontToApply = null;
                            for (var j = 0; j < textFonts.length; j++) {
                                if ((textFonts[j].family + " " + textFonts[j].style) === selectedFontDisplayName) {
                                    fontToApply = textFonts[j];
                                    break;
                                }
                            }

                            if (fontToApply) {
                                itext.textRange.characterAttributes.textFont = fontToApply;
                            } else {
                                 txtInfo.text += "警告：无法找到与显示名称 '" + selectedFontDisplayName + "' 匹配的字体，将使用默认字体。\n";
                            }
                        } catch (e) {
                            txtInfo.text += "警告：设置字体时发生错误：" + e.message + "，将使用默认字体。\n";
                        }
                        itext.textRange.characterAttributes.size = selectedFontSize;

                        var fontSize = itext.textRange.characterAttributes.size;

                        var activeAB = idoc.artboards[i];
                        var iartBounds = activeAB.artboardRect;

                        var ableft = iartBounds[0] + margins;
                        var abtop = iartBounds[1] - margins;
                        var abright = iartBounds[2] - margins;
                        var abbottom = iartBounds[3] + margins + fontSize;

                        var abcenter_horizontal = ableft + ((abright - ableft) / 2); // 水平居中
                        var abcenter_vertical = iartBounds[1] - (iartBounds[1] - iartBounds[3]) / 2 + fontSize / 2; // 垂直居中，加上字号一半使其基线居中

                        // --- 页码对齐逻辑 ---
                        var currentJustification = Justification.LEFT;
                        var currentHorizontalPos = ableft;
                        var currentVerticalPos = abbottom; // 默认底部
                        var alignmentLog = "";

                        // 优先判断装订对齐
                        if (radBindingOuter.value) { // 外侧对齐
                            var isOddPage = (actualPageNumber % 2 !== 0); // 判断是否为奇数页 (1, 3, 5...)
                            if (isOddPage) { // 奇数页（如右页）
                                currentJustification = Justification.RIGHT;
                                currentHorizontalPos = abright;
                                alignmentLog = "装订对齐 - 外侧对齐 (奇数页 右)";
                            } else { // 偶数页（如左页）
                                currentJustification = Justification.LEFT;
                                currentHorizontalPos = ableft;
                                alignmentLog = "装订对齐 - 外侧对齐 (偶数页 左)";
                            }
                        } else if (radBindingInner.value) { // 内侧对齐
                            var isOddPage = (actualPageNumber % 2 !== 0); // 判断是否为奇数页 (1, 3, 5...)
                            if (isOddPage) { // 奇数页（如左页）
                                currentJustification = Justification.LEFT;
                                currentHorizontalPos = ableft;
                                alignmentLog = "装订对齐 - 内侧对齐 (奇数页 左)";
                            } else { // 偶数页（如右页）
                                currentJustification = Justification.RIGHT;
                                currentHorizontalPos = abright;
                                alignmentLog = "装订对齐 - 内侧对齐 (偶数页 右)";
                            }
                        } else { // 关闭装订对齐，使用常规对齐
                            if (radRight.value) {
                                currentJustification = Justification.RIGHT;
                                currentHorizontalPos = abright;
                                alignmentLog = "常规对齐 - 右对齐";
                            } else if (radCenter.value) {
                                currentJustification = Justification.CENTER;
                                currentHorizontalPos = abcenter_horizontal;
                                alignmentLog = "常规对齐 - 居中";
                            } else { // 默认左对齐
                                currentJustification = Justification.LEFT;
                                currentHorizontalPos = ableft;
                                alignmentLog = "常规对齐 - 左对齐";
                            }
                        }

                        itext.left = currentHorizontalPos;
                        itext.textRange.paragraphAttributes.justification = currentJustification;

                        // 垂直位置
                        if (radTop.value) {
                            currentVerticalPos = abtop;
                            alignmentLog += ", 位置: 顶部。";
                        } else if (radMiddle.value) { // 新增中间选项
                            currentVerticalPos = abcenter_vertical;
                            alignmentLog += ", 位置: 中间。";
                        } else { // 默认底部
                            currentVerticalPos = abbottom;
                            alignmentLog += ", 位置: 底部。";
                        }
                        itext.top = currentVerticalPos;

                        txtInfo.text += "正在为画板 " + (i + 1) + " 添加页码 (" + alignmentLog + ")\n";

                        actualPageNumber++; // 只有在添加了页码的画板上才增加实际页码
                    } else {
                        txtInfo.text += "跳过未选中的画板 " + (i + 1) + "。\n";
                    }
                }
                
            } finally {
                // ===== 性能优化：恢复自动重绘 =====
                idoc.redrawEnabled = origRedrawMode;
            }
            
            app.redraw();
            txtInfo.text += "所有选定画板的页码已添加。刷新 Illustrator 视图。\n";
        }

        // “生成页码”按钮事件
        btnOk.onClick = function() {
            txtInfo.text = "正在生成最终页码...\n";
            try {
                // 如果存在预览层，先删除它
                try {
                    var previewLayer = app.activeDocument.layers["预览页码层"];
                    previewLayer.remove();
                    txtInfo.text += "已清理旧的 '预览页码层'。\n";
                } catch (e) {
                    // 预览层不存在，无须处理
                }
                createPageNumbers(false); // 生成最终页码
                txtInfo.text += "脚本运行成功！页码已生成到 '页码层'。\n";
            } catch (e) {
                txtInfo.text += "脚本运行出错：\n" + e.toString() + "\n";
            }
            win.layout.layout(true);
        };
        // "保存配置"按钮事件
        btnSaveConfig.onClick = function() {
            try {
                var currentConfig = getConfigFromUI(ddFont, txtFontSize, txtMargins, radTop, radMiddle, radBottom, 
                                                     radLeft, radCenter, radRight, radBindingNormal, radBindingOuter, 
                                                     radBindingInner, ddPageDigits, txtFooter, rad24h, rad12h);
                if (saveConfig(currentConfig)) {
                    txtInfo.text += "✓ 配置已保存！下次打开脚本时将自动加载。\n";
                } else {
                    txtInfo.text += "✗ 配置保存失败，请检查权限。\n";
                }
            } catch (e) {
                txtInfo.text += "保存配置时出错：" + e.toString() + "\n";
            }
            win.layout.layout(true);
        };
        // “预览页码”按钮事件
        btnPreview.onClick = function() {
            txtInfo.text = "正在生成页码预览...\n";
            if (txtFooter.text != "") {
                try {
                    createPageNumbers(true); // 生成预览页码
                    txtInfo.text += "页码预览已生成到 '预览页码层'。您可以关闭此对话框查看效果，再次打开可继续操作或生成最终页码。\n";
                } catch (e) {
                    txtInfo.text += "预览生成出错：\n" + e.toString() + "\n";
                }
            } else {
                txtInfo.text += "错误：页码内容为空，未执行预览操作。\n";
            }
            win.layout.layout(true);
        };

        // “删除页码”按钮事件
        btnDelete.onClick = function() {
            var confirmDelete = confirm("将会删除“页码层”和“预览页码层”。\n请确保这些图层中只有页码内容。\n点击确认继续删除。", false, "删除页码确认");
            if (confirmDelete) {
                txtInfo.text = "正在执行删除页码操作...\n";
                try {
                    var idoc = app.activeDocument;
                    if (!idoc) {
                        alert("没有打开的文档。");
                        txtInfo.text += "错误：没有打开的文档，无法执行删除。\n";
                        return;
                    }
                    // 删除最终页码层
                    try {
                        var finalLayer = idoc.layers["页码层"];
                        finalLayer.remove();
                        txtInfo.text += "已成功删除 '页码层'。\n";
                    } catch (e) {
                        txtInfo.text += "'页码层' 不存在或无法删除。\n";
                    }
                    // 删除预览页码层
                    try {
                        var previewLayer = idoc.layers["预览页码层"];
                        previewLayer.remove();
                        txtInfo.text += "已成功删除 '预览页码层'。\n";
                    } catch (e) {
                        txtInfo.text += "'预览页码层' 不存在或无法删除。\n";
                    }
                    app.redraw();
                    txtInfo.text += "删除操作完成。\n";
                } catch (e) {
                    txtInfo.text += "删除页码时出错：\n" + e.toString() + "\n";
                }
            } else {
                txtInfo.text += "用户取消了删除操作。\n";
            }
            win.layout.layout(true);
        };

        btnCancel.onClick = function() {
            txtInfo.text += "用户取消操作。\n";
            // 关闭前尝试删除预览层
            try {
                var idoc = app.activeDocument;
                if (idoc) {
                    var previewLayer = idoc.layers["预览页码层"];
                    previewLayer.remove();
                    txtInfo.text += "已清理旧的 '预览页码层'。\n";
                }
            } catch (e) {
                // 预览层不存在，无须处理
            }
            win.close();
        };

        btnClear.onClick = function() {
            txtFooter.text = "";
            txtInfo.text += "页码内容输入框已清空。\n";
        };
        btnPage.onClick = function() {
            footer("*page*");
            txtInfo.text += "已添加变量: *page*\n";
        };
        btnPages.onClick = function() {
            footer("*pages*");
            txtInfo.text += "已添加变量: *pages*\n";
        };
        btnDate.onClick = function() {
            footer("*date*");
            txtInfo.text += "已添加变量: *date*\n";
        };
        btnTime.onClick = function() {
            footer("*time*");
            txtInfo.text += "已添加变量: *time*\n";
        };
        btnFullName.onClick = function() {
            footer("*fname*");
            txtInfo.text += "已添加变量: *fname*\n";
        };
        btnFile.onClick = function() {
            footer("*file*");
            txtInfo.text += "已添加变量: *file*\n";
        };

        // “关于脚本”按钮点击事件
        btnAbout.onClick = function() {
            txtInfo.text += "正在打开 '关于脚本' 窗口...\n";
            showAboutDialog(txtInfo, win); // 传递主窗口对象以便控制透明度
        };

        win.center();
        win.show();

        function footer(variableTag) {
            txtFooter.text = txtFooter.text + variableTag;
            txtFooter.active = true;
        }

        // 辅助函数：检查数组是否包含某个元素
        function arrayContains(arr, obj) {
            var i = arr.length;
            while (i--) {
                if (arr[i] === obj) {
                    return true;
                }
            }
            return false;
        }

        // 显示关于脚本信息的弹窗
        function showAboutDialog(infoLog, mainWindow) { // 接收主窗口对象
            var aboutWin = new Window("dialog", "关于添加页码 v2.1");
            aboutWin.orientation = "column";
            aboutWin.alignChildren = "center";
            aboutWin.spacing = 15;
            aboutWin.margins = 20;

            // 作者信息
            var authorPanel = aboutWin.add("panel", undefined, "作者信息");
            authorPanel.orientation = "column";
            authorPanel.alignChildren = "left";
            authorPanel.spacing = 5;
            authorPanel.margins = 15;
            
            // 作者名字放在一行
            var authorNameGroup = authorPanel.add("group");
            authorNameGroup.orientation = "row";
            authorNameGroup.alignChildren = "center";
            authorNameGroup.add("statictext", undefined, "作者：");
            authorNameGroup.add("statictext", undefined, "小张");

            // 网站 (改为StaticText并添加事件监听)
            var websiteGroup = authorPanel.add("group");
            websiteGroup.orientation = "row";
            websiteGroup.alignChildren = "center";
            websiteGroup.add("statictext", undefined, "网站：");
            var stWebsite = websiteGroup.add("statictext", undefined, "https://z-l.top"); // 改为 StaticText
            // 为 StaticText 添加事件监听器
            stWebsite.addEventListener('mousedown', function () {
                try {
                    var websiteURL = "https://z-l.top"; // 直接使用固定URL
                    openURL(websiteURL);
                    if (infoLog) {
                        infoLog.text += "已尝试在浏览器中打开作者网站链接: " + websiteURL + "\n";
                        infoLog.parent.layout.layout(true);
                    }
                } catch (e) {
                    if (infoLog) {
                        infoLog.text += "错误：无法打开作者网站链接：" + e.toString() + "\n";
                        infoLog.parent.layout.layout(true);
                    }
                }
            });

            // 作者留言（“留言反馈”改为StaticText并添加事件监听）
            var authorMessageGroup = authorPanel.add("group"); 
            authorMessageGroup.orientation = "row";
            authorMessageGroup.alignChildren = "center";
            authorMessageGroup.spacing = 5; // 增加间距
            authorMessageGroup.add("statictext", undefined, "作者留言：欢迎使用，有问题请");
            var stFeedback = authorMessageGroup.add("statictext", undefined, "留言反馈！"); // 改为 StaticText
            // 为 StaticText 添加事件监听器
            stFeedback.addEventListener('mousedown', function () {
                var feedbackURL = "https://getquicker.net/Sharedaction?code=c6c86159-49c3-40ed-9cde-08ddc5acfa0f";
                openURL(feedbackURL);
                if (infoLog) {
                    infoLog.text += "已尝试在浏览器中打开留言反馈链接: " + feedbackURL + "\n";
                    infoLog.parent.layout.layout(true);
                }
            });
            
            authorPanel.add("statictext", undefined, "开源方式：任何人可用、可编辑、可分享。");

            // 支持作者（打赏）部分
            var donatePanel = aboutWin.add("panel", undefined, "支持作者");
            donatePanel.orientation = "column";
            donatePanel.alignChildren = "center";
            donatePanel.spacing = 10;
            donatePanel.margins = 15;
            donatePanel.add("statictext", undefined, "感谢您的支持！您的鼓励是作者更新的动力！");
            donatePanel.add("statictext", undefined, "点击下方按钮将在浏览器中打开支持页面。");

            var btnAboutDonate = donatePanel.add("button", undefined, "点击支持作者 (打开网页)");
            btnAboutDonate.size = [200, 30];
            btnAboutDonate.onClick = function() {
                try {
                    // 更新赞赏链接，并确保进行 URI 编码
                    var donateURL = "https://getquicker.net/DonateAuthor?serial=388875&nickname=" + encodeURIComponent("星河城野❤");
                    openURL(donateURL); 
                    if (infoLog) {
                        infoLog.text += "已尝试在浏览器中打开支持页面链接: " + donateURL + "\n";
                        infoLog.parent.layout.layout(true);
                    }
                } catch (e) {
                    if (infoLog) {
                        infoLog.text += "错误：无法打开支持页面链接：" + e.toString() + "\n";
                        infoLog.parent.layout.layout(true);
                    }
                }
            };

            // 调节透明度的滑块 (放置在“关于脚本”对话框中，控制主窗口透明度)
            var opacityPanel = aboutWin.add("panel", undefined, "主窗口透明度");
            opacityPanel.orientation = "column";
            opacityPanel.alignChildren = "center";
            opacityPanel.spacing = 10;
            opacityPanel.margins = 15;

            var sliderGroup = opacityPanel.add('group');
            sliderGroup.add('statictext', undefined, '调节透明度:');
            // 滑块值范围 22 到 100，默认值根据当前主窗口透明度设置
            var currentOpacity = (mainWindow && typeof mainWindow.opacity === 'number') ? Math.round(mainWindow.opacity * 100) : 95;
            var opacitySlider = sliderGroup.add('slider', [0, 0, 200, 20], currentOpacity, 22, 100);
            
            var opacityValue = sliderGroup.add('statictext', undefined, currentOpacity + '%');
            
            opacitySlider.onChange = function() {
                var newOpacity = this.value / 100;
                // 确保透明度不低于最低设置 (22%)
                if (newOpacity < 0.22) newOpacity = 0.22; 
                if (mainWindow) { // 再次检查 mainWindow 是否存在
                    mainWindow.opacity = newOpacity;
                }
                opacityValue.text = Math.round(newOpacity * 100) + '%';
            };

            // 关闭按钮
            var closeButton = aboutWin.add('button', undefined, '关闭');
            closeButton.size = [100, 30];
            closeButton.onClick = function() {
                aboutWin.close();
                if (infoLog) infoLog.text += "'关于脚本' 窗口已关闭。\n";
                if (infoLog) infoLog.parent.layout.layout(true);
            };

            aboutWin.center();
            aboutWin.show();
        }


    } else {
        alert("请打开一个文档以运行添加页码 v2.1。");
    }
} catch (e) { // 捕获顶层错误
    // 这里的 alert 是为了在脚本完全崩溃前尽可能给出提示
    alert("脚本启动时发生错误：\n" + e.name + ": " + e.message + "\n请将此信息截图并提供给开发者。\n"); // 添加换行符
    // 您也可以在这里使用 $.writeln(e.stack) 写入 ExtendScript Toolkit Console 以获取更详细的堆栈信息
}

function getdate() {
    var date = new Date();
    var m = date.getMonth() + 1;
    var d = date.getDate();
    var y = date.getFullYear();
    var datemdy = y + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
    return datemdy;
}

function gettime24h() {
    var time = new Date();
    var hours = time.getHours();
    var minutes = time.getMinutes();
    var seconds = time.getSeconds();
    // 24小时制
    if (hours < 10) {
        hours = "0" + hours;
    }
    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }
    var curtime = hours + ":" + minutes + ":" + seconds;
    return curtime;
}

function gettime12h() {
    var time = new Date();
    var hours = time.getHours();
    var minutes = time.getMinutes();
    var seconds = time.getSeconds();
    // 12小时制
    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }
    var ampm = (hours >= 12) ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    if (hours < 10) {
        hours = "0" + hours;
    }
    var curtime = hours + ":" + minutes + ":" + seconds + " " + ampm;
    return curtime;
}

function gettime() {
    // 保持向后兼容，默认使用24小时制
    return gettime24h();
}