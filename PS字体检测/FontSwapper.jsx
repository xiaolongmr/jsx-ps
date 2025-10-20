// 这是一个用于 Photoshop 的字体查看和替换工具脚本
// 主要功能:
// 1. 查看当前文档中所有文字图层使用的字体
// 2. 支持批量替换字体
// 3. 可以按文档顺序、字体分组、使用频率等方式排序显示
// 4. 提供友好的字体显示名称
// 5. 支持保存用户偏好设置
// 6. 支持撤销最近一次字体替换操作
// 7. 支持自定义显示顺序和格式
// 
// 使用方法:
// 1. 在 Photoshop 中打开需要处理的 PSD 文件
// 2. 运行此脚本
// 3. 在弹出的界面中查看字体信息或进行替换操作
// 4. 点击设置按钮可自定义显示格式和顺序
// 5. 点击撤销按钮可恢复上一次替换操作
//
// 作者网站: https://blog.z-l.top/
// 首发网站：https://getquicker.net/Sharedaction?code=6471ed9b-8254-443d-0267-08ddf9bab61f
// GitHub: https://github.com/xiaolongmr/jsx-ps
// 版本: 2.2
// 最后更新: 2025.10.20

#target photoshop
app.bringToFront();

(function () {

    // ====================== 全局设置变量 ======================
    var showConsoleLog = true; // 默认显示控制台日志
    var layerSortOrder = "document"; // 图层排序：document(文档顺序), font(字体分组), frequency(字体出现次数)
    var showScriptWarning = false; // 默认不弹出脚本警告

    // 显示格式选项（用户可勾选显示的内容）
    var showFriendlyName = true;    // 显示友好字体名称
    var showLayerContent = true;    // 显示文字内容（图层名称）
    var showPostScriptName = false; // 显示PostScript名称
    var displayOrder = ["friendly", "content"]; // 显示顺序：friendly=友好名称, content=文字内容

    // ====================== 辅助函数 ======================
    // 数组比较函数
    function arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (var i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    // 刷新字体列表函数（将在UI创建后定义具体实现）
    var refreshFontList = null;

    // 打开URL函数 - 使用临时HTML文件的方式
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
            return true; // 成功执行
        } catch (e) {
            // 如果tempFile.execute()失败，可能因为安全设置或缺少默认浏览器
            alert("无法自动打开链接。错误: " + e.message + "\n链接已复制到剪贴板: " + url);
            $.setClipboard(url); // 提供剪贴板作为备选
            return false; // 执行失败
        }
    }

    // 获取用户文档目录路径
    function getUserDocumentsPath() {
        try {
            // 尝试获取用户文档目录
            var shell = new ActiveXObject("WScript.Shell");
            var documentsPath = shell.SpecialFolders("MyDocuments");
            return documentsPath;
        } catch (e) {
            // 如果失败，使用用户主目录下的Documents文件夹
            return Folder.myDocuments.fsName;
        }
    }

    // 设置文件路径 - 保存到用户文档目录
    var settingsFile = new File(getUserDocumentsPath() + "/FontReplacerSettings.json");

    // ====================== 设置管理函数 ======================
    // 加载设置
    function loadSettings() {
        try {
            var fileToLoad = settingsFile;

            // 如果主设置文件不存在，尝试从桌面加载
            if (!settingsFile.exists) {
                var backupFile = new File(Folder.desktop + "/FontReplacerSettings.txt");
                if (backupFile.exists) {
                    fileToLoad = backupFile;
                }
            }

            if (fileToLoad.exists) {
                fileToLoad.open("r");
                var settingsData = fileToLoad.read();
                fileToLoad.close();

                if (settingsData) {
                    var settingsObj = eval("(" + settingsData + ")");

                    // 检查是否为新的JSON格式（包含开发者留言）
                    if (settingsObj.developer_message && settingsObj.settings) {
                        var settings = settingsObj.settings;
                    } else {
                        // 兼容旧格式
                        var settings = settingsObj;
                    }

                    showConsoleLog = settings.showConsoleLog !== undefined ? settings.showConsoleLog : true;
                    layerSortOrder = settings.layerSortOrder || "document";
                    showFriendlyName = settings.showFriendlyName !== undefined ? settings.showFriendlyName : true;
                    showLayerContent = settings.showLayerContent !== undefined ? settings.showLayerContent : true;
                    showPostScriptName = settings.showPostScriptName !== undefined ? settings.showPostScriptName : false;
                    showScriptWarning = settings.showScriptWarning !== undefined ? settings.showScriptWarning : false;
                    displayOrder = settings.displayOrder || ["friendly", "content"];
                    return true;
                }
            }
        } catch (e) {
            // 如果读取失败，使用默认设置
        }

        // 使用默认设置
        showConsoleLog = true;
        layerSortOrder = "document";
        showFriendlyName = true;
        showLayerContent = true;
        showPostScriptName = false;
        showScriptWarning = false;
        displayOrder = ["friendly", "content"];
        return false;
    }

    // JSON格式化函数 - 用于美化JSON输出
    function formatJSON(obj, indent) {
        if (typeof indent === 'undefined') indent = 0;
        var spaces = '';
        for (var i = 0; i < indent; i++) {
            spaces += '  ';
        }

        if (obj === null) return 'null';
        if (typeof obj === 'string') return '"' + obj.replace(/"/g, '\\"') + '"';
        if (typeof obj === 'number' || typeof obj === 'boolean') return obj.toString();

        if (obj instanceof Array) {
            var result = '[\n';
            for (var i = 0; i < obj.length; i++) {
                result += spaces + '  ' + formatJSON(obj[i], indent + 1);
                if (i < obj.length - 1) result += ',';
                result += '\n';
            }
            result += spaces + ']';
            return result;
        }

        if (typeof obj === 'object') {
            var result = '{\n';
            var keys = [];
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    keys.push(key);
                }
            }

            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                result += spaces + '  "' + key + '": ' + formatJSON(obj[key], indent + 1);
                if (i < keys.length - 1) result += ',';
                result += '\n';
            }
            result += spaces + '}';
            return result;
        }

        return obj.toString();
    }

    // 保存设置
    function saveSettings() {
        // 创建设置对象的公共函数（消除重复代码）
        function createSettingsObject() {
            return {
                developer_message: "本脚本开源，欢迎使用，玩的开心",
                author_website: "www.z-l.top",
                original_release: "https://getquicker.net/Sharedaction?code=6471ed9b-8254-443d-0267-08ddf9bab61f",
                version: "2.0",
                created_date: new Date().toString(),
                settings: {
                    showConsoleLog: showConsoleLog,
                    layerSortOrder: layerSortOrder,
                    showFriendlyName: showFriendlyName,
                    showLayerContent: showLayerContent,
                    showPostScriptName: showPostScriptName,
                    showScriptWarning: showScriptWarning,
                    displayOrder: displayOrder
                }
            };
        }

        // 保存文件的公共函数
        function saveToFile(file, showAlert) {
            var settingsObj = createSettingsObject();
            var settingsString = formatJSON(settingsObj);

            file.open("w");
            file.write(settingsString);
            file.close();

            if (showAlert) {
                alert("设置已保存到桌面: " + file.fsName);
            }
        }

        try {
            // 确保父目录存在
            var parentFolder = settingsFile.parent;
            if (!parentFolder.exists) {
                parentFolder.create();
            }

            // 保存到主设置文件
            saveToFile(settingsFile, false);
            return true;

        } catch (e) {
            // 如果保存失败，尝试备用路径
            try {
                var backupFile = new File(Folder.desktop + "/FontReplacerSettings.txt");
                saveToFile(backupFile, true);
                return true;
            } catch (e2) {
                alert("保存设置失败: " + e.toString());
                return false;
            }
        }
    }

    // 在脚本开始时加载设置
    loadSettings();

    // ====================== 工具函数 ======================
    function getAllTextLayers(doc) {
        var result = [];
        function traverse(layers) {
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                if (layer.typename == "ArtLayer" && layer.kind == LayerKind.TEXT) {
                    result.push(layer);
                } else if (layer.typename == "LayerSet") {
                    traverse(layer.layers);
                }
            }
        }
        traverse(doc.layers);
        return result;
    }

    // 替换字体函数（将在fontViewerAndReplacer函数内部定义）

    // 获取系统字体信息 { family: [ { style, psName }, ... ] }
    function getSystemFonts() {
        var fontsInfo = {};
        for (var i = 0; i < app.fonts.length; i++) {
            try {
                var f = app.fonts[i];
                if (!fontsInfo[f.family]) fontsInfo[f.family] = [];
                // 修复：使用postScriptName而不是name
                fontsInfo[f.family].push({ style: f.style, psName: f.postScriptName });
            } catch (e) { }
        }
        return fontsInfo;
    }

    // ====================== 主函数 ======================
    // 全局变量：文字图层数组
    var textLayers = [];

    function fontViewerAndReplacer() {
        if (!documents.length) { alert("请先打开 PSD 文件！"); return; }
        var doc = app.activeDocument;
        textLayers = getAllTextLayers(doc);
        if (textLayers.length == 0) { alert("当前文档没有文字图层！"); return; }

        var systemFonts = getSystemFonts();

        // ====================== 字体名称转换函数 ======================
        // 获取字体的友好显示名称（仅返回友好名称，不包含PostScript名称）
        function getFriendlyFontName(postScriptName) {
            // 遍历系统字体，查找匹配的PostScript名称
            var friendlyName = postScriptName; // 默认使用PostScript名称
            var familyName = "";
            var styleName = "";

            for (var family in systemFonts) {
                var styles = systemFonts[family];
                for (var i = 0; i < styles.length; i++) {
                    if (styles[i].psName === postScriptName) {
                        familyName = family;
                        styleName = styles[i].style;
                        friendlyName = family + " " + styles[i].style;
                        break;
                    }
                }
                if (familyName) break;
            }

            // 只返回友好名称，不根据全局设置添加其他内容
            // 这样避免在populateFontList中重复添加PostScript名称
            return friendlyName || postScriptName;
        }

        // ====================== 设置首选项窗口 ======================
        function showSettingsDialog() {
            var settingsWin = new Window("dialog", "设置首选项", undefined, { closeButton: true });
            settingsWin.orientation = "column";
            settingsWin.alignChildren = ["fill", "top"];
            settingsWin.preferredSize = [500, 550];

            // 标题
            var titlePanel = settingsWin.add("panel", undefined, "脚本设置");
            titlePanel.orientation = "column";
            titlePanel.alignChildren = ["fill", "top"];
            titlePanel.margins = 15;

            // 控制台日志和脚本警告设置（合并到一行节省高度）
            var logGroup = titlePanel.add("group");
            logGroup.orientation = "row";
            logGroup.alignChildren = ["left", "center"];
            logGroup.spacing = 20; // 增加间距
            var showLogCheckbox = logGroup.add("checkbox", undefined, "显示控制台日志 📋");
            showLogCheckbox.helpTip = "开启后会在控制台显示每次操作的历史记录"
            showLogCheckbox.value = showConsoleLog; // 读取当前设置状态
            var warningCheckbox = logGroup.add("checkbox", undefined, "替换字体后弹出脚本警告 🔔");
            warningCheckbox.helpTip = "在每一次替换字体后都会弹出替换信息提示";
            warningCheckbox.value = showScriptWarning; // 使用全局变量

            // 字体显示格式设置面板
            var displayPanel = titlePanel.add("panel", undefined, "🎨 字体显示格式设置");
            displayPanel.orientation = "column";
            displayPanel.alignChildren = ["fill", "top"];
            displayPanel.margins = 10;

            // 显示格式说明
            var formatExplainTitle = displayPanel.add("statictext", undefined, "📋 显示内容选择（可多选）：");
            formatExplainTitle.graphics.font = ScriptUI.newFont("dialog", "Bold", 11);

            // 友好名称选项
            var friendlyGroup = displayPanel.add("group");
            friendlyGroup.orientation = "row";
            friendlyGroup.alignChildren = ["left", "center"];
            var friendlyCheckbox = friendlyGroup.add("checkbox", undefined, "字体名称");
            friendlyCheckbox.value = showFriendlyName;
            var friendlyExplain = friendlyGroup.add("statictext", undefined, "（如：微软雅黑、Arial）");
            friendlyExplain.graphics.foregroundColor = friendlyExplain.graphics.newPen(friendlyExplain.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);

            // 文字内容选项
            var contentGroup = displayPanel.add("group");
            contentGroup.orientation = "row";
            contentGroup.alignChildren = ["left", "center"];
            var contentCheckbox = contentGroup.add("checkbox", undefined, "文字内容");
            contentCheckbox.value = showLayerContent;
            var contentExplain = contentGroup.add("statictext", undefined, "（图层中的实际文字内容）");
            contentExplain.graphics.foregroundColor = contentExplain.graphics.newPen(contentExplain.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);

            // PostScript名称选项
            var psGroup = displayPanel.add("group");
            psGroup.orientation = "row";
            psGroup.alignChildren = ["left", "center"];
            var psCheckbox = psGroup.add("checkbox", undefined, "字体PostScript名");
            psCheckbox.value = showPostScriptName;
            var psExplain = psGroup.add("statictext", undefined, "（如：MicrosoftYaHei、ArialMT）");
            psExplain.graphics.foregroundColor = psExplain.graphics.newPen(psExplain.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);

            // 显示顺序设置
            var orderGroup = displayPanel.add("group");
            orderGroup.orientation = "column";
            orderGroup.alignChildren = ["fill", "top"];
            orderGroup.margins = [0, 10, 0, 0]; // 上边距10像素

            var orderTitle = orderGroup.add("statictext", undefined, "🔢 显示顺序设置：");
            orderTitle.graphics.font = ScriptUI.newFont("dialog", "Bold", 11);

            var orderExplain = orderGroup.add("statictext", undefined, "💡 选择项目后点击上下箭头调整顺序");
            orderExplain.graphics.foregroundColor = orderExplain.graphics.newPen(orderExplain.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);

            // 顺序控制区域
            var orderControlGroup = orderGroup.add("group");
            orderControlGroup.orientation = "row";
            orderControlGroup.alignChildren = ["fill", "top"];
            orderControlGroup.spacing = 10;

            // 左侧：顺序列表和按钮
            var leftGroup = orderControlGroup.add("group");
            leftGroup.orientation = "row";
            leftGroup.alignChildren = ["fill", "top"];
            leftGroup.spacing = 10;

            // 顺序列表
            var orderLabels = {
                "friendly": "字体名称",
                "content": "文字内容",
                "postscript": "字体PostScript名"
            };

            var orderListItems = [];
            for (var i = 0; i < displayOrder.length; i++) {
                orderListItems.push((i + 1) + ". " + orderLabels[displayOrder[i]]);
            }

            var orderListBox = leftGroup.add("listbox", undefined, orderListItems);
            orderListBox.preferredSize = [150, 66]; // 减少高度从80到66
            orderListBox.selection = 0;

            // 控制按钮组
            var orderBtnGroup = leftGroup.add("group");
            orderBtnGroup.orientation = "column";
            orderBtnGroup.alignChildren = ["fill", "center"];
            orderBtnGroup.spacing = 5;

            // 右侧：实时预览
            var previewGroup = orderControlGroup.add("group");
            previewGroup.orientation = "column";
            previewGroup.alignChildren = ["fill", "top"];
            previewGroup.spacing = 5;
            var previewTitle = previewGroup.add("statictext", undefined, "实时预览：");
            previewTitle.graphics.font = ScriptUI.newFont("dialog", "Bold", 11);

            var previewText = previewGroup.add("statictext", undefined, "");
            previewText.graphics.font = ScriptUI.newFont("dialog", "Regular", 12);
            previewText.graphics.foregroundColor = previewText.graphics.newPen(previewText.graphics.PenType.SOLID_COLOR, [0.2, 0.4, 0.8], 1);
            previewText.preferredSize = [180, 45]; // 减少高度从60到45，与列表框协调

            var upBtn = orderBtnGroup.add("button", undefined, "↑ 上移");
            upBtn.preferredSize = [60, 25];

            var downBtn = orderBtnGroup.add("button", undefined, "↓ 下移");
            downBtn.preferredSize = [60, 25];

            // 智能管理displayOrder数组的函数
            function updateDisplayOrder() {
                // 保存当前已启用选项的顺序
                var currentEnabledOrder = [];
                for (var i = 0; i < displayOrder.length; i++) {
                    var orderType = displayOrder[i];
                    var isEnabled = false;

                    // 根据复选框状态判断项目是否启用
                    if (orderType === "friendly" && friendlyCheckbox.value) {
                        isEnabled = true;
                    } else if (orderType === "content" && contentCheckbox.value) {
                        isEnabled = true;
                    } else if (orderType === "postscript" && psCheckbox.value) {
                        isEnabled = true;
                    }

                    // 只保留已启用的选项
                    if (isEnabled) {
                        currentEnabledOrder.push(orderType);
                    }
                }

                // 检查是否有新启用的选项需要添加
                var allPossibleOptions = ["friendly", "content", "postscript"];
                for (var i = 0; i < allPossibleOptions.length; i++) {
                    var option = allPossibleOptions[i];
                    var isEnabled = false;
                    var alreadyInOrder = false;

                    // 检查是否启用
                    if (option === "friendly" && friendlyCheckbox.value) {
                        isEnabled = true;
                    } else if (option === "content" && contentCheckbox.value) {
                        isEnabled = true;
                    } else if (option === "postscript" && psCheckbox.value) {
                        isEnabled = true;
                    }

                    // 检查是否已经在当前顺序中
                    for (var j = 0; j < currentEnabledOrder.length; j++) {
                        if (currentEnabledOrder[j] === option) {
                            alreadyInOrder = true;
                            break;
                        }
                    }

                    // 如果启用但不在当前顺序中，按照默认顺序添加到末尾
                    if (isEnabled && !alreadyInOrder) {
                        currentEnabledOrder.push(option);
                    }
                }

                // 更新全局displayOrder数组
                displayOrder = currentEnabledOrder;
            }

            // 更新列表显示的函数
            function updateOrderList() {
                orderListBox.removeAll();

                // 更新displayOrder数组
                updateDisplayOrder();

                // 只显示已启用的选项
                for (var i = 0; i < displayOrder.length; i++) {
                    var itemText = (i + 1) + ". " + orderLabels[displayOrder[i]];
                    var item = orderListBox.add("item", itemText);
                    // 所有显示的项目都是启用的，不需要特殊标记
                }

                // 保持选择状态
                if (orderListBox.items.length > 0) {
                    var selectedIndex = Math.min(orderListBox.selection ? orderListBox.selection.index : 0, orderListBox.items.length - 1);
                    orderListBox.selection = selectedIndex;
                }
                updatePreview(); // 更新实时预览
            }

            // 更新显示顺序列表状态的函数（只更新按钮状态，不重新构建列表）
            function updateOrderListState() {
                // 更新按钮状态
                var selectedIndex = orderListBox.selection ? orderListBox.selection.index : -1;

                // 所有显示的项目都是启用的，只需要检查是否有选中项和边界条件
                upBtn.enabled = selectedIndex > 0;
                downBtn.enabled = selectedIndex >= 0 && selectedIndex < displayOrder.length - 1;
            }

            // 列表选择变化事件
            orderListBox.onChange = function () {
                updateOrderListState();
            };

            // 上移按钮点击事件
            upBtn.onClick = function () {
                var selectedIndex = orderListBox.selection ? orderListBox.selection.index : -1;

                if (selectedIndex > 0) {
                    // 交换displayOrder数组中的位置
                    var temp = displayOrder[selectedIndex];
                    displayOrder[selectedIndex] = displayOrder[selectedIndex - 1];
                    displayOrder[selectedIndex - 1] = temp;

                    // 重新构建列表以反映新的顺序
                    updateOrderList();

                    // 保持选择在新位置
                    orderListBox.selection = selectedIndex - 1;
                    updateOrderListState(); // 更新按钮状态

                    // 实时更新主面板的文本区域显示
                    if (typeof refreshFontList === 'function') {
                        refreshFontList();
                    }
                }
            };

            // 下移按钮点击事件
            downBtn.onClick = function () {
                var selectedIndex = orderListBox.selection ? orderListBox.selection.index : -1;

                if (selectedIndex >= 0 && selectedIndex < displayOrder.length - 1) {
                    // 交换displayOrder数组中的位置
                    var temp = displayOrder[selectedIndex];
                    displayOrder[selectedIndex] = displayOrder[selectedIndex + 1];
                    displayOrder[selectedIndex + 1] = temp;

                    // 重新构建列表以反映新的顺序
                    updateOrderList();

                    // 保持选择在新位置
                    orderListBox.selection = selectedIndex + 1;
                    updateOrderListState(); // 更新按钮状态

                    // 实时更新主面板的文本区域显示
                    if (typeof refreshFontList === 'function') {
                        refreshFontList();
                    }
                }
            };

            // 更新预览的函数
            function updatePreview() {
                var parts = [];

                // 根据displayOrder的顺序来组织显示内容
                for (var i = 0; i < displayOrder.length; i++) {
                    var orderType = displayOrder[i];

                    if (orderType === "friendly" && friendlyCheckbox.value) {
                        parts.push("(微软雅黑)");
                    } else if (orderType === "content" && contentCheckbox.value) {
                        parts.push("[文字内容]");
                    } else if (orderType === "postscript" && psCheckbox.value) {
                        parts.push("(MicrosoftYaHei)");
                    }
                }

                if (parts.length === 0) {
                    previewText.text = "请至少选择一个显示选项";
                    previewText.graphics.foregroundColor = previewText.graphics.newPen(previewText.graphics.PenType.SOLID_COLOR, [0.8, 0.2, 0.2], 1);
                } else {
                    previewText.text = parts.join(" ");
                    previewText.graphics.foregroundColor = previewText.graphics.newPen(previewText.graphics.PenType.SOLID_COLOR, [0.2, 0.4, 0.8], 1);
                }
            }

            // 初始化预览和显示顺序列表
            updateOrderList(); // 初始化显示顺序列表
            updateOrderListState(); // 初始化按钮状态
            updatePreview(); // 初始化预览

            // 为复选框添加事件监听器
            friendlyCheckbox.onClick = function () {
                updateOrderList(); // 重新构建显示顺序列表
                updateOrderListState(); // 更新按钮状态
                updatePreview(); // 更新预览
                // 实时更新主面板的文本区域显示
                if (typeof refreshFontList === 'function') {
                    refreshFontList();
                }
            };
            contentCheckbox.onClick = function () {
                updateOrderList(); // 重新构建显示顺序列表
                updateOrderListState(); // 更新按钮状态
                updatePreview(); // 更新预览
                // 实时更新主面板的文本区域显示
                if (typeof refreshFontList === 'function') {
                    refreshFontList();
                }
            };
            psCheckbox.onClick = function () {
                updateOrderList(); // 重新构建显示顺序列表
                updateOrderListState(); // 更新按钮状态
                updatePreview(); // 更新预览
                // 实时更新主面板的文本区域显示
                if (typeof refreshFontList === 'function') {
                    refreshFontList();
                }
            };

            // 图层排序方式设置
            var sortGroup = titlePanel.add("group");
            sortGroup.orientation = "row";
            sortGroup.alignChildren = ["left", "center"];
            var sortLabel = sortGroup.add("statictext", undefined, "📊 图层排序方式：");
            var sortDropdown = sortGroup.add("dropdownlist", undefined, ["按文档图层中文字图层的顺序", "按文档中相同字体分组排序", "按文档中字体出现次数排序"]);
            sortDropdown.helpTip = "选择图层在列表中的排序方式：文档顺序、字体分组或使用频率";
            // 根据当前设置选择对应项
            switch (layerSortOrder) {
                case "document": sortDropdown.selection = 0; break;
                case "font": sortDropdown.selection = 1; break;
                case "frequency": sortDropdown.selection = 2; break;
                default: sortDropdown.selection = 0; break;
            }

            // 添加排序方式改变事件
            sortDropdown.onChange = function () {
                // 更新排序方式设置
                switch (sortDropdown.selection.index) {
                    case 0: layerSortOrder = "document"; break;
                    case 1: layerSortOrder = "font"; break;
                    case 2: layerSortOrder = "frequency"; break;
                    default: layerSortOrder = "document"; break;
                }

                // 重新填充字体列表
                if (typeof refreshFontList === 'function') {
                    refreshFontList();
                    // 注意：统计更新会在populateFontList函数末尾自动调用
                }
            };



            // 使用说明面板
            var usagePanel = settingsWin.add("panel", undefined, "📖 使用说明");
            usagePanel.orientation = "column";
            usagePanel.alignChildren = ["fill", "top"];
            usagePanel.margins = 15;

            // 创建一个容器来包含标题和内容
            var usageContainer = usagePanel.add("group");
            usageContainer.orientation = "column";
            usageContainer.alignChildren = ["fill", "top"];
            usageContainer.spacing = 5;

            // 使用可滚动的编辑文本框来显示完整的使用说明（包含标题和内容，适中行间距）
            var usageContent = usageContainer.add("edittext", undefined,
                "🖱️ 图层多选操作：\n\n" +
                "   Ctrl + 点击：选择不连续的多个图层\n" +
                "   Shift + 点击：选择连续的多个图层\n" +
                "   勾选自动选择：点击图层时自动选中所有相同字体的图层\n" +
                "   设置面板：可自定义字体显示格式和排序方式\n" +
                "   好用请给点个赞吧: \n" +
                "https://getquicker.net/Sharedaction?code=6471ed9b-8254-443d-0267-08ddf9bab61f \n" +
                "   更多功能说明将在后续版本中添加...",
                { multiline: true, readonly: true, scrolling: true });
            usageContent.graphics.font = ScriptUI.newFont("dialog", "Regular", 11); // 11号普通字体
            usageContent.preferredSize.width = 340;
            usageContent.preferredSize.height = 80; // 保持合适的高度，内容可滚动查看

            // 按钮组 - 三个按钮平均分布
            var btnGroup = settingsWin.add("group");
            btnGroup.orientation = "row";
            btnGroup.alignment = "fill";
            btnGroup.alignChildren = ["fill", "center"];

            var okBtn = btnGroup.add("button", undefined, "✅ 保存设置");
            var resetBtn = btnGroup.add("button", undefined, "🔄 复位设置");
            var cancelBtn = btnGroup.add("button", undefined, "❌ 取消");

            // 确定按钮
            okBtn.onClick = function () {
                // 记录旧的设置值，用于判断是否需要更新界面
                var oldShowConsoleLog = showConsoleLog;
                var oldShowFriendlyName = showFriendlyName;
                var oldShowLayerContent = showLayerContent;
                var oldShowPostScriptName = showPostScriptName;
                var oldLayerSortOrder = layerSortOrder;
                var oldDisplayOrder = displayOrder.slice(); // 复制数组

                // 应用设置到全局变量
                showConsoleLog = showLogCheckbox.value;
                showScriptWarning = warningCheckbox.value;

                // 保存显示格式选项设置
                showFriendlyName = friendlyCheckbox.value;
                showLayerContent = contentCheckbox.value;
                showPostScriptName = psCheckbox.value;

                // 至少要选择一个显示选项
                if (!showFriendlyName && !showLayerContent && !showPostScriptName) {
                    alert("请至少选择一个显示内容选项！");
                    return;
                }

                // 保存图层排序方式设置
                switch (sortDropdown.selection.index) {
                    case 0: layerSortOrder = "document"; break;
                    case 1: layerSortOrder = "font"; break;
                    case 2: layerSortOrder = "frequency"; break;
                    default: layerSortOrder = "document"; break;
                }

                // 保存设置到文件
                if (saveSettings()) {
                    settingsWin.close();

                    // 检查设置是否有变化，如果有则更新主界面
                    var needUpdate = false;

                    // 检查控制台日志显示状态是否改变
                    if (oldShowConsoleLog !== showConsoleLog) {
                        updateLogGroupVisibility(); // 更新控制台日志显示状态
                        needUpdate = true;
                    }

                    // 检查显示格式或排序方式是否改变
                    if (oldShowFriendlyName !== showFriendlyName ||
                        oldShowLayerContent !== showLayerContent ||
                        oldShowPostScriptName !== showPostScriptName ||
                        oldLayerSortOrder !== layerSortOrder ||
                        !arraysEqual(oldDisplayOrder, displayOrder)) {
                        needUpdate = true;
                    }

                    // 如果有设置变化，重新刷新字体列表显示
                    if (needUpdate && typeof refreshFontList === 'function') {
                        refreshFontList();
                    }
                } else {
                    alert("设置保存失败，但当前会话的设置已生效。");
                    settingsWin.close();
                }
            };

            // 复位设置按钮点击事件
            resetBtn.onClick = function () {
                if (confirm("确定要将所有设置恢复为初始状态吗？")) {
                    // 恢复所有设置为初始默认值
                    showLogCheckbox.value = true;
                    friendlyCheckbox.value = true;
                    contentCheckbox.value = true;
                    psCheckbox.value = false;
                    sortDropdown.selection = 0; // 文档顺序

                    // 恢复显示顺序为默认值
                    displayOrder = ["friendly", "content"];
                    updateOrderList();

                    alert("设置已恢复为初始状态！");
                }
            };

            // 复位设置按钮点击事件
            resetBtn.onClick = function () {
                if (confirm("确定要将所有设置恢复到初始状态吗？\n\n这将重置：\n• 控制台日志显示\n• 字体显示格式\n• 显示顺序\n• 图层排序方式")) {
                    // 恢复到初始默认设置
                    showLogCheckbox.value = true;
                    friendlyCheckbox.value = true;
                    contentCheckbox.value = true;
                    psCheckbox.value = false;
                    warningCheckbox.value = false; // 默认不弹出警告
                    sortDropdown.selection = 0; // 文档顺序

                    // 重置显示顺序为默认值
                    displayOrder = ["friendly", "content"];

                    // 更新界面显示
                    updateOrderList();
                    updateOrderListState();
                    updatePreview();

                    alert("设置已恢复到初始状态！");
                }
            };

            cancelBtn.onClick = function () {
                settingsWin.close();
            };

            // 显示设置窗口
            settingsWin.show();
        }

        // ====================== UI ======================
        var win = new Window("dialog", "🎨 文字图层字体查看与替换", undefined, { closeButton: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];

        // 顶部工具栏
        var topToolbar = win.add("group");
        topToolbar.orientation = "row";
        topToolbar.alignChildren = ["fill", "center"];

        // 文档总体统计信息显示
        var titleGroup = topToolbar.add("group");
        var documentStatsText = titleGroup.add("statictext", undefined, "📄 当前文档包含 【0】 个文字图层，包含 【0】 种字体");
        documentStatsText.preferredSize = [400, 20];

        // 设置首选项按钮
        var settingsBtn = topToolbar.add("button", undefined, "⚙ 设置首选项");
        settingsBtn.preferredSize = [90, 25];
        settingsBtn.helpTip = "打开设置面板，自定义显示内容、排序方式和其他首选项";

        // 打赏作者按钮
        var donateBtn = topToolbar.add("button", undefined, "❤ 打赏作者");
        donateBtn.preferredSize = [90, 25];
        donateBtn.helpTip = "支持作者继续开发和维护这个实用的字体管理脚本";

        // 按钮状态管理（三状态循环：打赏 -> 点赞 -> 关注 -> 打赏）
        var buttonState = 0; // 0: 打赏模式, 1: 点赞模式, 2: 关注模式
        var donateURL = "https://getquicker.net/DonateAuthor?serial=388875&nickname=%E6%98%9F%E6%B2%B3%E5%9F%8E%E9%87%8E%E2%9D%A4";
        var likeURL = "https://getquicker.net/Sharedaction?code=6471ed9b-8254-443d-0267-08ddf9bab61f";
        var followURL = "https://open.weixin.qq.com/qr/code?username=gh_3ff7a91772aa";

        // 更新按钮状态的函数
        function updateDonateButtonState() {
            switch (buttonState) {
                case 0: // 打赏模式
                    donateBtn.text = "❤ 打赏作者";
                    donateBtn.helpTip = "支持作者继续开发和维护这个实用的字体管理脚本";
                    break;
                case 1: // 点赞模式
                    donateBtn.text = "👍 点赞动作";
                    donateBtn.helpTip = "为这个实用的字体管理脚本点赞，让更多人发现它";
                    break;
                case 2: // 关注模式
                    donateBtn.text = "📱 关注作者";
                    donateBtn.helpTip = "关注作者微信公众号，获取更多实用脚本和技术分享";
                    break;
            }
        }

        // 设置按钮点击事件
        settingsBtn.onClick = function () {
            var oldShowConsoleLog = showConsoleLog;
            showSettingsDialog();

            // 检查设置是否有变化，如果有则更新界面
            if (oldShowConsoleLog !== showConsoleLog) {
                updateLogGroupVisibility(); // 更新控制台日志显示状态
            }
        };

        // 打赏按钮点击事件（支持三状态循环切换）
        donateBtn.onClick = function () {
            var targetURL;
            var currentAction;

            // 根据当前状态确定目标URL和动作名称
            switch (buttonState) {
                case 0: // 打赏模式
                    targetURL = donateURL;
                    currentAction = "打赏作者";
                    break;
                case 1: // 点赞模式
                    targetURL = likeURL;
                    currentAction = "点赞动作";
                    break;
                case 2: // 关注模式
                    targetURL = followURL;
                    currentAction = "关注作者";
                    break;
            }

            var success = openURL(targetURL);

            // 如果成功打开URL，则切换到下一个状态
            if (success === true) {
                buttonState = (buttonState + 1) % 3; // 循环切换：0->1->2->0
                updateDonateButtonState();

                // 添加日志记录（如果控制台日志开启）
                if (showConsoleLog && typeof logText !== 'undefined' && logText) {
                    var nextAction;
                    switch (buttonState) {
                        case 0: nextAction = "打赏作者"; break;
                        case 1: nextAction = "点赞动作"; break;
                        case 2: nextAction = "关注作者"; break;
                    }
                    logText.text += "🔄 已从「" + currentAction + "」切换到「" + nextAction + "」模式\n";
                }
            }
        };



        var fontList = win.add("listbox", undefined, [], { multiselect: true });
        fontList.preferredSize = [500, 200];

        // 添加自动选择相同字体的复选框和相关控件
        var autoSelectGroup = win.add("group");
        autoSelectGroup.orientation = "row";
        autoSelectGroup.alignChildren = ["left", "center"];
        autoSelectGroup.spacing = 15; // 设置控件间距

        var autoSelectCheckbox = autoSelectGroup.add("checkbox", undefined, "自动选中相同字体");
        autoSelectCheckbox.value = false;
        autoSelectCheckbox.helpTip = "启用后，点击任意图层将自动选中所有使用相同字体的图层";

        // 添加反选复选框
        var invertSelectionCheckbox = autoSelectGroup.add("checkbox", undefined, "🔄 反选");
        invertSelectionCheckbox.helpTip = "点击反转当前所有图层的选中状态";

        // 添加取消选中复选框
        var clearSelectionCheckbox = autoSelectGroup.add("checkbox", undefined, "❌ 取消选中");
        clearSelectionCheckbox.helpTip = "勾选后点击可取消所有图层的选中状态";

        // 添加选中状态统计显示
        var selectionStatsGroup = win.add("group");
        selectionStatsGroup.orientation = "row";
        selectionStatsGroup.alignChildren = ["left", "center"];
        selectionStatsGroup.margins = [0, 5, 0, 5];

        var selectionStatsText = selectionStatsGroup.add("statictext", undefined, "📊 已选中 0 个文字图层，包含 0 种字体");
        selectionStatsText.preferredSize = [400, 20];

        // 撤销历史记录数组
        var undoHistory = []; // 存储图层操作历史，用于撤销功能

        // 控制台日志（根据设置显示/隐藏）
        var logGroup, logTitle, logText, undoBtn;

        // 创建控制台日志组件的函数
        function createLogGroup() {
            if (!logGroup && showConsoleLog) {
                logGroup = win.add("group");
                logGroup.orientation = "column";
                logGroup.alignChildren = "fill";

                // 日志标题和撤销按钮在同一行
                var logHeaderGroup = logGroup.add("group");
                logHeaderGroup.orientation = "row";
                logHeaderGroup.alignment = "fill";

                // 左侧标题
                logTitle = logHeaderGroup.add("statictext", undefined, "📋 控制台日志:");
                logTitle.alignment = ["left", "center"];

                // 右侧撤销按钮
                undoBtn = logHeaderGroup.add("button", undefined, "↩ 撤回上一步");
                undoBtn.alignment = ["right", "center"];
                undoBtn.helpTip = "撤销上一次字体替换操作";
                undoBtn.onClick = function () {
                    // 检查是否有可撤销的操作
                    if (!undoHistory.length) { logText && (logText.text += "⚠️ 已经撤回完所有操作了\n"); return; }

                    // 获取并移除最后一次操作记录
                    var lastOperation = undoHistory.pop();

                    // 执行撤销：恢复所有图层的原始字体
                    for (var i = 0; i < lastOperation.layers.length; i++) {
                        try { lastOperation.layers[i].layer.textItem.font = lastOperation.layers[i].oldFont; }
                        catch (e) { } // 静默处理错误
                    }

                    // 从日志中移除对应记录
                    if (logText) {
                        var logLines = logText.text.split("\n");
                        var linesToRemove = lastOperation.logLines.length || lastOperation.logLines;
                        while (linesToRemove-- > 0 && logLines.length > 0) logLines.pop();
                        logText.text = logLines.join("\n");
                    }
                };

                logText = logGroup.add("edittext", undefined, "", { multiline: true, readonly: true });
                logText.preferredSize = [500, 150];
            }
        }

        // 销毁控制台日志组件的函数
        function destroyLogGroup() {
            if (logGroup) {
                win.remove(logGroup);
                logGroup = null;
                logTitle = null;
                logText = null;
                undoBtn = null;
            }
        }

        // 初始创建控制台日志组件
        createLogGroup();

        // 动态更新控制台日志显示状态的函数
        function updateLogGroupVisibility() {
            if (showConsoleLog && !logGroup) {
                // 需要显示但组件不存在，创建组件
                createLogGroup();
            } else if (!showConsoleLog && logGroup) {
                // 不需要显示但组件存在，销毁组件
                destroyLogGroup();
            }

            // 强制重新计算窗口布局
            win.layout.layout(true);
            win.layout.resize();
        }

        // 替换字体函数（在局部作用域内定义，可以访问logText）
        function replaceFont(layers, newFontPS, logText) {
            var count = 0;
            var logMessages = [];
            var operationLayers = [];

            // 获取新字体的友好名称
            var newFontFriendly = getFriendlyFontName(newFontPS) || newFontPS;

            for (var i = 0; i < layers.length; i++) {
                try {
                    var oldFontPS = layers[i].textItem.font;
                    var oldFontFriendly = getFriendlyFontName(oldFontPS) || oldFontPS;

                    // 记录操作前的状态，用于撤销
                    operationLayers.push({ layer: layers[i], oldFont: oldFontPS });

                    layers[i].textItem.font = newFontPS;
                    count++;
                    logMessages.push("✓ 已替换图层：" + layers[i].name + " [" + oldFontFriendly + " → " + newFontFriendly + "]");
                } catch (e) {
                    logMessages.push("✗ 替换失败图层：" + layers[i].name + "，错误：" + e.message);
                }
            }

            // 记录操作历史，用于撤销
            if (operationLayers.length > 0) {
                undoHistory.push({ layers: operationLayers, logLines: logMessages });
            }

            // 添加日志记录（仅在logText存在时）
            if (logMessages.length > 0 && logText) {
                var currentText = logText.text;
                logText.text = currentText ? currentText + "\n" + logMessages.join("\n") : logMessages.join("\n");
            }

            return count;
        }

        // 全局变量：排序后的图层数组
        var sortedLayers = [];

        // 刷新字体列表函数
        function populateFontList() {
            // 清空现有列表
            fontList.removeAll();

            // 重新排序图层
            sortedLayers = [];
            for (var i = 0; i < textLayers.length; i++) {
                sortedLayers.push(textLayers[i]);
            }

            if (layerSortOrder === "font") {
                // 按文档中相同字体分组排序：保持字体首次出现的顺序，相同字体的实例集中显示
                var fontFirstAppearance = {}; // 记录每种字体首次出现的位置
                var fontGroups = {}; // 按字体分组存储图层

                // 第一步：按照图层顺序从上到下检测，记录字体首次出现位置并分组
                for (var i = 0; i < sortedLayers.length; i++) {
                    var layer = sortedLayers[i];
                    var font = layer.textItem.font;

                    // 记录字体首次出现的位置
                    if (!(font in fontFirstAppearance)) {
                        fontFirstAppearance[font] = i;
                        fontGroups[font] = [];
                    }

                    // 将图层添加到对应字体分组
                    fontGroups[font].push(layer);
                }

                // 第二步：按字体首次出现顺序重新排列
                var fontOrder = []; // 存储字体按首次出现顺序的列表
                for (var font in fontFirstAppearance) {
                    fontOrder.push({
                        font: font,
                        firstIndex: fontFirstAppearance[font]
                    });
                }

                // 按首次出现位置排序字体
                fontOrder.sort(function (a, b) {
                    return a.firstIndex - b.firstIndex;
                });

                // 第三步：重新构建排序后的图层数组
                sortedLayers = [];
                for (var i = 0; i < fontOrder.length; i++) {
                    var font = fontOrder[i].font;
                    var layers = fontGroups[font];

                    // 相同字体内的图层保持原始文档顺序（已经是按检测顺序）
                    for (var j = 0; j < layers.length; j++) {
                        sortedLayers.push(layers[j]);
                    }
                }
            } else if (layerSortOrder === "frequency") {
                // 按文档中字体出现次数排序：先统计每种字体的出现次数，然后按次数排序
                var fontCounts = {};
                for (var i = 0; i < sortedLayers.length; i++) {
                    var font = sortedLayers[i].textItem.font;
                    fontCounts[font] = (fontCounts[font] || 0) + 1;
                }

                sortedLayers.sort(function (a, b) {
                    var fontA = a.textItem.font;
                    var fontB = b.textItem.font;
                    var countA = fontCounts[fontA];
                    var countB = fontCounts[fontB];

                    // 按出现次数降序排序（次数多的在前）
                    if (countA !== countB) {
                        return countB - countA;
                    }

                    // 出现次数相同时按字体名称排序
                    if (fontA !== fontB) {
                        return fontA < fontB ? -1 : 1;
                    }

                    // 字体名称也相同时按图层名称排序
                    return a.name < b.name ? -1 : 1;
                });
            }
            // 如果是 "document" 排序，保持原有顺序（不需要额外处理）

            // 左侧列表显示每个文字图层的字体信息
            for (var i = 0; i < sortedLayers.length; i++) {
                var layer = sortedLayers[i];
                var psName = layer.textItem.font;
                var friendlyName = getFriendlyFontName(psName);

                // 构建显示文本 - 根据displayOrder的顺序来组织显示内容
                var displayParts = [];

                // 按照用户设置的显示顺序来添加内容
                for (var orderIndex = 0; orderIndex < displayOrder.length; orderIndex++) {
                    var orderType = displayOrder[orderIndex];

                    if (orderType === "friendly" && showFriendlyName) {
                        // 使用已定义的friendlyName变量，避免重复调用getFriendlyFontName
                        if (friendlyName) {
                            displayParts.push("(" + friendlyName + ")");
                        }
                    } else if (orderType === "content" && showLayerContent) {
                        try {
                            var textContent = layer.textItem.contents;
                            // 限制文字内容长度，避免显示过长
                            if (textContent.length > 20) {
                                textContent = textContent.substring(0, 20) + "...";
                            }
                            if (textContent) {
                                displayParts.push("[" + textContent + "]");
                            }
                        } catch (e) {
                            // 如果获取文字内容失败，使用图层名称作为备选
                            displayParts.push("[" + layer.name + "]");
                        }
                    } else if (orderType === "postscript" && showPostScriptName) {
                        if (psName) {
                            displayParts.push("(" + psName + ")");
                        }
                    }
                }

                // 构建最终显示文本
                var displayText;
                if (displayParts.length > 0) {
                    displayText = displayParts.join(" ");
                } else {
                    // 如果没有任何显示内容，使用友好字体名称和图层名称作为默认格式
                    displayText = "(" + friendlyName + ") [" + layer.name + "]";
                }

                fontList.add("item", displayText);
            }

            // 更新统计信息（如果统计函数已定义）
            if (typeof updateDocumentStats === 'function') {
                updateDocumentStats();
            }
            if (typeof updateSelectionStats === 'function') {
                updateSelectionStats();
            }
        }

        // 设置全局刷新函数
        refreshFontList = populateFontList;

        // 初始填充字体列表
        populateFontList();

        // 统计信息更新函数
        function updateSelectionStats() {
            var selectedCount = 0;
            var selectedFonts = {};

            // 统计选中的图层数量和字体种类
            for (var i = 0; i < fontList.items.length; i++) {
                if (fontList.items[i].selected) {
                    selectedCount++;
                    var fontName = sortedLayers[i].textItem.font;
                    selectedFonts[fontName] = true;
                }
            }

            var uniqueFontCount = 0;
            for (var font in selectedFonts) {
                uniqueFontCount++;
            }

            // 更新选中状态统计显示
            selectionStatsText.text = "📊 已选中 " + selectedCount + " 个文字图层，包含 " + uniqueFontCount + " 种字体";
        }

        function updateDocumentStats() {
            var totalLayers = sortedLayers.length;
            var totalFonts = {};

            // 统计文档中的总字体种类
            for (var i = 0; i < sortedLayers.length; i++) {
                var fontName = sortedLayers[i].textItem.font;
                totalFonts[fontName] = true;
            }

            var uniqueFontCount = 0;
            for (var font in totalFonts) {
                uniqueFontCount++;
            }

            // 更新文档统计显示（使用特殊字符突出显示数字）
            documentStatsText.text = "📄 当前文档包含 【" + totalLayers + "】 个文字图层，包含 【" + uniqueFontCount + "】 种字体";
        }

        // 初始化统计信息显示
        updateDocumentStats();
        updateSelectionStats();

        // 添加自动选择相同字体的功能
        fontList.onClick = function () {
            if (autoSelectCheckbox.value && fontList.selection) {
                // 获取当前选中项的字体名称
                var selectedItems = fontList.selection;
                if (selectedItems && selectedItems.length > 0) {
                    // 获取最后一个选中项的索引
                    var lastSelectedItem = selectedItems[selectedItems.length - 1];
                    var selectedIndex = lastSelectedItem.index;

                    // 获取对应图层的PostScript字体名称
                    var selectedFont = sortedLayers[selectedIndex].textItem.font;

                    // 自动选择所有使用相同字体的图层
                    for (var i = 0; i < sortedLayers.length; i++) {
                        if (sortedLayers[i].textItem.font === selectedFont) {
                            fontList.items[i].selected = true;
                        }
                    }
                }
            }

            // 更新选中状态统计
            updateSelectionStats();
        };

        // 反选复选框事件处理
        invertSelectionCheckbox.onClick = function () {
            // 反转所有图层的选中状态
            for (var i = 0; i < fontList.items.length; i++) {
                fontList.items[i].selected = !fontList.items[i].selected;
            }

            // 重置复选框状态（点击后自动取消勾选）
            invertSelectionCheckbox.value = false;

            // 添加日志记录
            if (showConsoleLog && logText) {
                logText.text += "🔄 已反转所有图层的选中状态\n";
            }

            // 更新选中状态统计
            updateSelectionStats();
        };

        // 取消选中复选框事件处理
        clearSelectionCheckbox.onClick = function () {
            // 仅在勾选状态下生效
            if (clearSelectionCheckbox.value) {
                // 取消所有图层的选中状态
                for (var i = 0; i < fontList.items.length; i++) {
                    fontList.items[i].selected = false;
                }

                // 重置复选框状态
                clearSelectionCheckbox.value = false;

                // 添加日志记录
                if (showConsoleLog && logText) {
                    logText.text += "❌ 已取消所有图层的选中状态\n";
                }

                // 更新选中状态统计
                updateSelectionStats();
            }
        };

        win.add("statictext", undefined, "选择要替换的字体：");

        var groupDropdown = win.add("group");
        groupDropdown.orientation = "row";

        // 字体家族下拉
        var familyNames = [];
        for (var f in systemFonts) { familyNames.push(f); }
        var familyDropdown = groupDropdown.add("dropdownlist", undefined, familyNames);
        familyDropdown.preferredSize = [250, 25];
        familyDropdown.selection = 0;
        familyDropdown.helpTip = "选择要替换成的字体家族（如：微软雅黑、Arial等）";

        // 字重下拉
        var styleDropdown = groupDropdown.add("dropdownlist", undefined, []);
        styleDropdown.preferredSize = [250, 25];
        styleDropdown.selection = 0;
        styleDropdown.helpTip = "选择字体的具体样式（如：Regular、Bold、Light等）";

        function updateStyleDropdown() {
            styleDropdown.removeAll();
            var arr = systemFonts[familyDropdown.selection.text];
            for (var i = 0; i < arr.length; i++) {
                styleDropdown.add("item", arr[i].style);
            }
            styleDropdown.selection = 0;
        }

        updateStyleDropdown();
        familyDropdown.onChange = function () { updateStyleDropdown(); };

        var btnGroup = win.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignment = "fill";
        var replaceBtn = btnGroup.add("button", undefined, "🔄 替换字体");
        replaceBtn.helpTip = "将选中的图层字体替换为指定的新字体";
        var cancelBtn = btnGroup.add("button", undefined, "👁 查看效果");
        cancelBtn.helpTip = "关闭对话框以查看当前文档的字体替换效果";

        // ExtendScript 不支持按钮背景颜色，使用图标来区分按钮功能

        // 设置按钮为左右分布
        replaceBtn.alignment = ["left", "center"];
        cancelBtn.alignment = ["right", "center"];

        replaceBtn.onClick = function () {
            var selItems = fontList.selection;
            if (!selItems || !familyDropdown.selection || !styleDropdown.selection) {
                alert("请先选择要替换的字体图层，并选择新的字体和字重！");
                return;
            }

            // 获取新字体的PostScript名称
            var newPS = null;
            var arr = systemFonts[familyDropdown.selection.text];
            for (var i = 0; i < arr.length; i++) {
                if (arr[i].style == styleDropdown.selection.text) { newPS = arr[i].psName; break; }
            }
            if (!newPS) { alert("未找到新的 PostScript 名称！"); return; }

            // 收集所有选中的图层进行替换（参考ps copy.jsx的实现方式）
            var layersToReplace = [];

            // 遍历所有fontList项目，找到选中的项目
            for (var i = 0; i < fontList.items.length; i++) {
                if (fontList.items[i].selected) {
                    layersToReplace.push(sortedLayers[i]);
                }
            }

            if (layersToReplace.length == 0) {
                alert("请先选择要替换的图层！");
                return;
            }

            var count = replaceFont(layersToReplace, newPS, logText);
            if (showScriptWarning) {
                alert("已替换 " + count + " 个文字图层的字体。");
            }
        };

        cancelBtn.onClick = function () { win.close(); };

        win.show();
    }

    // ====================== 执行 ======================
    fontViewerAndReplacer();

})();