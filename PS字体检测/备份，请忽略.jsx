// 这是一个用于 Photoshop 的字体查看和替换工具脚本
// 主要功能:
// 1. 查看当前文档中所有文字图层使用的字体
// 2. 支持批量替换字体
// 3. 可以按文档顺序、字体分组、使用频率等方式排序显示
// 4. 提供友好的字体显示名称
// 5. 支持保存用户偏好设置
// 
// 使用方法:
// 1. 在 Photoshop 中打开需要处理的 PSD 文件
// 2. 运行此脚本
// 3. 在弹出的界面中查看字体信息或进行替换操作
//
// 作者网站: www.z-l.top
// 首发网站：https://getquicker.net/Sharedaction?code=6471ed9b-8254-443d-0267-08ddf9bab61f
// 版本: 2.0
// 最后更新: 2025.9.23

#target photoshop
app.bringToFront();

(function () {

    // ====================== 全局设置变量 ======================
    var showConsoleLog = true; // 默认显示控制台日志
    var layerSortOrder = "document"; // 图层排序：document(文档顺序), font(字体分组), frequency(字体出现次数)
    var showScriptWarning = false; // 默认不弹出脚本警告
    var showDebugPopup = false; // 默认不显示调试弹窗
    
    // 显示格式选项（用户可勾选显示的内容）
    var showFriendlyName = true;    // 显示友好字体名称
    var showLayerContent = true;    // 显示文字内容（图层名称）
    var showPostScriptName = false; // 显示PostScript名称
    var displayOrder = ["friendly", "content"]; // 显示顺序：friendly=友好名称, content=文字内容
    
    // ====================== 后悔药功能变量 ======================
    var regretHistory = []; // 历史记录数组
    var maxRegretVersions = 5; // 最大保留版本数量（用户可设置）
    var regretHistoryFile = null; // 历史记录文件对象（将在初始化时设置）
    var autoRecordEnabled = false; // 自动记录修改操作开关
    var previewRecordEnabled = true; // 查看效果时自动记录开关
    
    // ====================== 撤回上一步功能变量 ======================
    var lastReplaceOperation = null; // 最后一次字体替换操作的详细信息
    
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
    
    // 获取Quicker配置目录路径
    function getQuickerConfigPath() {
        var documentsPath = getUserDocumentsPath();
        var quickerFolder = new Folder(documentsPath + "/Quicker/{当前动作的名称}");
        
        // 如果Quicker文件夹不存在，创建它
        if (!quickerFolder.exists) {
            quickerFolder.create();
        }
        
        return quickerFolder.fsName;
    }
    
    // 设置文件路径 - 保存到用户文档目录下的Quicker文件夹
    var settingsFile = new File(getQuickerConfigPath() + "/FontReplacerSettings.json");
    
    // 初始化历史记录文件路径
    function initRegretHistoryFile() {
        try {
            var quickerPath = getQuickerConfigPath();
            var docName = "Default";
            
            if (app.activeDocument) {
                // 获取文档名称（移除扩展名）
                docName = app.activeDocument.name.replace(/\.[^\.]+$/, "");
                
                // 如果文档已保存，使用文档路径信息
                if (app.activeDocument.path) {
                    var docPath = app.activeDocument.path.fsName;
                    // 使用文档路径的最后一个文件夹名称作为标识
                    var pathParts = docPath.split(/[\\\/]/);
                    var folderName = pathParts[pathParts.length - 1];
                    docName = folderName + "_" + docName;
                }
            }
            
            // 创建历史记录子文件夹
            var historyFolder = new Folder(quickerPath + "/FontReplacer_History");
            if (!historyFolder.exists) {
                historyFolder.create();
            }
            
            // 清理过期的历史文件（保留最近30天的文件）
            cleanupOldHistoryFiles(historyFolder);
            
            regretHistoryFile = new File(historyFolder.fsName + "/" + docName + "_history.json");
        } catch (e) {
            // 出错时使用默认路径
            regretHistoryFile = new File(getQuickerConfigPath() + "/FontReplacer_Default_History.json");
        }
    }
    
    // 清理过期的历史文件
    function cleanupOldHistoryFiles(historyFolder) {
        try {
            if (!historyFolder.exists) return;
            
            var files = historyFolder.getFiles("*_history.json");
            var currentTime = new Date().getTime();
            var maxAge = 30 * 24 * 60 * 60 * 1000; // 30天（毫秒）
            var maxFiles = 50; // 最多保留50个历史文件
            
            var fileInfos = [];
            
            // 收集文件信息
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                try {
                    fileInfos.push({
                        file: file,
                        modified: file.modified.getTime()
                    });
                } catch (e) {
                    // 如果无法获取修改时间，删除该文件
                    try {
                        file.remove();
                    } catch (e2) {}
                }
            }
            
            // 按修改时间排序（最新的在前）
            fileInfos.sort(function(a, b) {
                return b.modified - a.modified;
            });
            
            // 删除过期或超出数量限制的文件
            for (var i = 0; i < fileInfos.length; i++) {
                var fileInfo = fileInfos[i];
                var age = currentTime - fileInfo.modified;
                
                // 删除超过30天或超出数量限制的文件
                if (age > maxAge || i >= maxFiles) {
                    try {
                        fileInfo.file.remove();
                    } catch (e) {
                        // 删除失败时忽略错误
                    }
                }
            }
        } catch (e) {
            // 清理过程出错时忽略，不影响主功能
        }
    }
    
    // ====================== 设置管理函数 ======================
    // 加载设置
    function loadSettings() {
        try {
            var fileToLoad = settingsFile;
            
            // 如果主设置文件不存在，尝试从备份位置加载
            if (!settingsFile.exists) {
                // 首先尝试从桌面加载旧的设置文件
                var backupFile = new File(Folder.desktop + "/FontReplacerSettings.txt");
                if (backupFile.exists) {
                    fileToLoad = backupFile;
                } else {
                    // 尝试从用户文档目录加载旧的设置文件
                    var oldSettingsFile = new File(getUserDocumentsPath() + "/FontReplacerSettings.json");
                    if (oldSettingsFile.exists) {
                        fileToLoad = oldSettingsFile;
                    }
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
                    showDebugPopup = settings.showDebugPopup !== undefined ? settings.showDebugPopup : false;
                    displayOrder = settings.displayOrder || ["friendly", "content"];
                    
                    // 加载后悔药功能设置
                    maxRegretVersions = settings.maxRegretVersions !== undefined ? settings.maxRegretVersions : 5;
                autoRecordEnabled = settings.autoRecordEnabled !== undefined ? settings.autoRecordEnabled : false;
                    previewRecordEnabled = settings.previewRecordEnabled !== undefined ? settings.previewRecordEnabled : true;
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
        showDebugPopup = false;
        displayOrder = ["friendly", "content"];
        
        // 后悔药功能默认设置
        maxRegretVersions = 5;
        autoRecordEnabled = false;
        previewRecordEnabled = true;
        return false;
    }
    
    // 调试信息显示函数 - 根据设置控制是否显示调试弹窗
    function debugAlert(message) {
        if (showDebugPopup) {
            alert("调试信息：" + message);
        }
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
                    showDebugPopup: showDebugPopup,
                    displayOrder: displayOrder,
                    
                    // 后悔药功能设置
                    maxRegretVersions: maxRegretVersions,
                    autoRecordEnabled: autoRecordEnabled,
                    previewRecordEnabled: previewRecordEnabled
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
        
        // 首先加载用户设置，确保使用最新的配置
        loadSettings();
        
        var doc = app.activeDocument;
        textLayers = getAllTextLayers(doc);
        if (textLayers.length == 0) { alert("当前文档没有文字图层！"); return; }

        // 初始化后悔药功能
        initRegretHistoryFile();
        loadRegretHistory();

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
        
        // ====================== 后悔药历史记录管理函数 ======================
        
        // 加载历史记录
        function loadRegretHistory() {
            try {
                if (regretHistoryFile && regretHistoryFile.exists) {
                    regretHistoryFile.open("r");
                    var content = regretHistoryFile.read();
                    regretHistoryFile.close();
                    
                    if (content) {
                        var historyData = eval("(" + content + ")");
                        regretHistory = historyData.history || [];
                        // 不从历史文件中读取版本数量，保持用户设置的优先级
                        // maxRegretVersions 应该已经从用户设置中加载
                        debugAlert("历史记录加载成功，共 " + regretHistory.length + " 条记录");
                        return true;
                    } else {
                        debugAlert("历史记录文件为空");
                    }
                } else {
                    debugAlert("历史记录文件不存在: " + (regretHistoryFile ? regretHistoryFile.fsName : "null"));
                }
            } catch (e) {
                // 如果加载失败，初始化为空数组
                regretHistory = [];
                debugAlert("加载历史记录失败: " + e.message);
            }
            return false;
        }
        
        // 保存历史记录
        function saveRegretHistory() {
            try {
                if (!regretHistoryFile) return false;
                
                // 确保父目录存在
                var parentFolder = regretHistoryFile.parent;
                if (!parentFolder.exists) {
                    parentFolder.create();
                }
                
                var historyData = {
                    version: "1.0",
                    created_date: new Date().toString(),
                    maxVersions: maxRegretVersions,
                    history: regretHistory
                };
                
                var historyString = formatJSON(historyData);
                
                regretHistoryFile.open("w");
                regretHistoryFile.write(historyString);
                regretHistoryFile.close();
                
                return true;
            } catch (e) {
                return false;
            }
        }
        
        // 创建历史记录快照（主要存储替换历史日志）
        function createRegretSnapshot(actionType, description, layerData, fontChanges) {
            try {
                var snapshot = {
                    id: "snapshot_" + new Date().getTime(),
                    timestamp: new Date().toString(),
                    actionType: actionType, // "font_replace", "preview", "manual"
                    description: description,
                    // 只存储关键的替换历史信息，不存储完整图层数据
                    replaceHistory: fontChanges || [], // 字体替换历史 [{layerName, oldFont, newFont, oldSize, newSize}]
                    documentInfo: {
                        name: app.activeDocument ? app.activeDocument.name : "未知文档",
                        width: app.activeDocument ? app.activeDocument.width.value : 0,
                        height: app.activeDocument ? app.activeDocument.height.value : 0
                    },
                    // 只在必要时存储少量图层状态信息（用于撤回操作）
                    affectedLayers: extractAffectedLayerInfo(fontChanges)
                };
                
                // 添加到历史记录数组开头（最新的在前）
                regretHistory.unshift(snapshot);
                
                // 限制历史记录数量
                if (regretHistory.length > maxRegretVersions) {
                    regretHistory = regretHistory.slice(0, maxRegretVersions);
                }
                
                // 保存到文件
                saveRegretHistory();
                
                return snapshot.id;
            } catch (e) {
                return null;
            }
        }
        
        // 提取受影响图层的关键信息（用于撤回操作）
        function extractAffectedLayerInfo(fontChanges) {
            var affectedLayers = [];
            
            if (!fontChanges || fontChanges.length === 0) {
                return affectedLayers;
            }
            
            try {
                if (!app.activeDocument) return affectedLayers;
                
                var doc = app.activeDocument;
                var layers = [];
                
                // 收集所有文字图层
                function collectTextLayers(layerSet) {
                    for (var i = 0; i < layerSet.layers.length; i++) {
                        var layer = layerSet.layers[i];
                        if (layer.kind === LayerKind.TEXT) {
                            layers.push(layer);
                        } else if (layer.typename === "LayerSet") {
                            collectTextLayers(layer);
                        }
                    }
                }
                
                collectTextLayers(doc);
                
                // 只存储受影响图层的关键信息
                for (var i = 0; i < fontChanges.length; i++) {
                    var change = fontChanges[i];
                    
                    // 查找对应的图层
                    for (var j = 0; j < layers.length; j++) {
                        var layer = layers[j];
                        if (layer.name === change.name) {
                            affectedLayers.push({
                                name: layer.name,
                                oldFont: change.oldFont,
                                newFont: change.newFont,
                                // 存储撤回所需的最小信息
                                textContents: layer.textItem.contents,
                                position: [layer.textItem.position[0].value, layer.textItem.position[1].value]
                            });
                            break;
                        }
                    }
                }
            } catch (e) {
                // 如果出错，返回空数组
            }
            
            return affectedLayers;
        }
        
        // 获取当前文档的图层状态
        function getCurrentLayerState() {
            var layerData = [];
            
            try {
                if (!app.activeDocument) return layerData;
                
                var doc = app.activeDocument;
                var layers = [];
                
                // 递归收集所有文字图层
                function collectTextLayers(layerSet) {
                    for (var i = 0; i < layerSet.layers.length; i++) {
                        var layer = layerSet.layers[i];
                        if (layer.typename === "ArtLayer" && layer.kind === LayerKind.TEXT) {
                            layers.push(layer);
                        } else if (layer.typename === "LayerSet") {
                            collectTextLayers(layer);
                        }
                    }
                }
                
                collectTextLayers(doc);
                
                // 记录每个文字图层的状态
                for (var i = 0; i < layers.length; i++) {
                    var layer = layers[i];
                    
                    // 获取字体大小，使用pt作为标准单位
                    var fontSize = null;
                    try {
                        fontSize = layer.textItem.size.as("pt");
                    } catch (e) {
                        try {
                            fontSize = layer.textItem.size.value;
                        } catch (e2) {
                            fontSize = 12; // 默认字体大小
                        }
                    }
                    
                    layerData.push({
                        name: layer.name,
                        font: layer.textItem.font,
                        contents: layer.textItem.contents,
                        size: fontSize,
                        color: [
                            layer.textItem.color.rgb.red,
                            layer.textItem.color.rgb.green,
                            layer.textItem.color.rgb.blue
                        ],
                        position: [layer.textItem.position[0].value, layer.textItem.position[1].value],
                        visible: layer.visible,
                        opacity: layer.opacity
                    });
                }
            } catch (e) {
                // 如果获取失败，返回空数组
            }
            
            return layerData;
        }
        
        // 显示后悔药历史记录界面
        function showRegretDialog() {
            try {
                // 每次显示前重新读取设置，确保版本数量是最新的
                loadSettings();
                
                // 确保历史记录文件已初始化
                if (!regretHistoryFile) {
                    initRegretHistoryFile();
                }
                
                // 确保历史记录已加载
                loadRegretHistory();
                
                // 验证历史记录数据
                if (!regretHistory) {
                    regretHistory = [];
                }
                

                
                // 在控制台日志中记录（如果启用）
                if (showConsoleLog && logText) {
                    var currentText = logText.text;
                    var newText = "📋 后悔药对话框：加载了 " + regretHistory.length + " 个历史记录";
                    logText.text = currentText ? currentText + "\n" + newText : newText;
                }
            
            var regretWin = new Window("dialog", "⏪ 后悔药 - 历史记录管理", undefined, { closeButton: true });
            regretWin.orientation = "column";
            regretWin.alignChildren = ["fill", "top"];
            regretWin.preferredSize = [650, 500];
            
            // 标题面板
            var titlePanel = regretWin.add("panel", undefined, "历史修改记录");
            titlePanel.orientation = "column";
            titlePanel.alignChildren = ["fill", "top"];
            titlePanel.margins = 15;
            
            // 统计信息
            var statsGroup = titlePanel.add("group");
            statsGroup.orientation = "row";
            statsGroup.alignChildren = ["left", "center"];
            
            var statsText = statsGroup.add("statictext", undefined, "📊 共有 " + regretHistory.length + " 个历史版本，最多保留 " + maxRegretVersions + " 个版本");
            // statsText.graphics.foregroundColor = statsText.graphics.newPen(statsText.graphics.PenType.SOLID_COLOR, [0.3, 0.3, 0.7], 1);
            
            // 操作按钮组
            var actionGroup = titlePanel.add("group");
            actionGroup.orientation = "row";
            actionGroup.alignChildren = ["left", "center"];
            actionGroup.spacing = 10;
            
            var createSnapshotBtn = actionGroup.add("button", undefined, "📸 创建快照");
            createSnapshotBtn.preferredSize = [100, 25];
            createSnapshotBtn.helpTip = "手动创建当前状态的快照";
            
            var clearHistoryBtn = actionGroup.add("button", undefined, "🗑️ 清空历史");
            clearHistoryBtn.preferredSize = [100, 25];
            clearHistoryBtn.helpTip = "清空所有历史记录";
            
            var refreshBtn = actionGroup.add("button", undefined, "🔄 刷新");
            refreshBtn.preferredSize = [80, 25];
            refreshBtn.helpTip = "刷新历史记录列表";
            
            // 历史记录列表
            var listGroup = regretWin.add("group");
            listGroup.orientation = "column";
            listGroup.alignChildren = "fill";
            listGroup.margins = [15, 10, 15, 10];
            
            var listLabel = listGroup.add("statictext", undefined, "📋 历史记录列表（按时间倒序排列）：");
            
            var historyList = listGroup.add("listbox", undefined, []);
            historyList.preferredSize = [600, 250];
            
            // 详情面板
            var detailPanel = regretWin.add("panel", undefined, "版本详情");
            detailPanel.orientation = "column";
            detailPanel.alignChildren = ["fill", "top"];
            detailPanel.margins = 15;
            detailPanel.preferredSize = [600, 120];
            
            var detailText = detailPanel.add("edittext", undefined, "请选择一个历史版本查看详情...", { multiline: true, readonly: true });
            detailText.preferredSize = [580, 90];
            
            // 底部按钮组
            var btnGroup = regretWin.add("group");
            btnGroup.orientation = "row";
            btnGroup.alignment = "fill";
            btnGroup.alignChildren = ["fill", "center"];
            btnGroup.margins = [15, 10, 15, 15];
            
            var revertBtn = btnGroup.add("button", undefined, "⏪ 撤回到此版本");
            var previewBtn = btnGroup.add("button", undefined, "👁️ 预览差异");
            var closeBtn = btnGroup.add("button", undefined, "❌ 关闭");
            
            // 初始状态下禁用撤回和预览按钮
            revertBtn.enabled = false;
            previewBtn.enabled = false;
            
            // 填充历史记录列表
            function populateHistoryList() {
                historyList.removeAll();
                
                // 重置按钮状态
                revertBtn.enabled = false;
                previewBtn.enabled = false;
                detailText.text = "请选择一个历史版本查看详情...";
                
                // 调试信息：显示历史记录数量
                debugAlert("历史记录数量 = " + regretHistory.length);
                
                if (regretHistory.length === 0) {
                    var emptyItem = historyList.add("item", "暂无历史记录");
                    emptyItem.regretData = null; // 明确设置为null
                    debugAlert("添加了空记录项");
                    return;
                }
                
                for (var i = 0; i < regretHistory.length; i++) {
                    var record = regretHistory[i];
                    
                    // 验证记录数据的完整性
                    if (!record || !record.timestamp) {
                        continue; // 跳过无效记录
                    }
                    
                    var date = new Date(record.timestamp);
                    // 使用兼容性更好的字符串填充方法
                    function padZero(num) {
                        return num < 10 ? "0" + num : num.toString();
                    }
                    
                    var timeStr = date.getFullYear() + "/" + 
                                 padZero(date.getMonth() + 1) + "/" + 
                                 padZero(date.getDate()) + " " +
                                 padZero(date.getHours()) + ":" + 
                                 padZero(date.getMinutes());
                    
                    var actionIcon = "";
                    switch (record.actionType) {
                        case "font_replace": actionIcon = "🔄"; break;
                        case "preview": actionIcon = "👁️"; break;
                        case "manual": actionIcon = "📸"; break;
                        default: actionIcon = "📝"; break;
                    }
                    
                    var layerCount = 0;
                    if (record.affectedLayers && record.affectedLayers.length > 0) {
                        layerCount = record.affectedLayers.length;
                    } else if (record.replaceHistory && record.replaceHistory.length > 0) {
                        layerCount = record.replaceHistory.length;
                    }
                    
                    var itemText = actionIcon + " " + timeStr + " - " + record.description + " (" + layerCount + "个图层)";
                    var item = historyList.add("item", itemText);
                    item.regretData = record; // 存储完整的记录数据
                }
                
                // 更新统计信息（如果statsText已定义）
                if (typeof statsText !== 'undefined') {
                    statsText.text = "📊 共有 " + regretHistory.length + " 个历史版本，最多保留 " + maxRegretVersions + " 个版本";
                }
            }
            
            // 定义选择处理函数
            function handleHistorySelection() {
                try {
                    debugAlert("选择事件被触发！");
                    
                    // 检查选中项
                    if (historyList.selection) {
                        debugAlert("有选中项，文本=" + historyList.selection.text);
                        
                        if (historyList.selection.regretData) {
                            debugAlert("选中项有regretData");
                        } else {
                            debugAlert("选中项没有regretData");
                        }
                    } else {
                        debugAlert("没有选中项");
                    }
                    
                    // 检查是否有选中项且包含有效数据
                    if (historyList.selection && 
                        historyList.selection.regretData && 
                        historyList.selection.regretData !== null) {
                        
                        var record = historyList.selection.regretData;
                        
                        // 验证记录数据的完整性
                        if (!record.id || !record.timestamp) {
                            throw new Error("记录数据不完整");
                        }
                        
                        // 显示详细信息
                        var detailInfo = "版本ID: " + record.id + "\n";
                        detailInfo += "创建时间: " + new Date(record.timestamp).toLocaleString() + "\n";
                        detailInfo += "操作类型: " + (record.actionType || "未知") + "\n";
                        detailInfo += "描述: " + (record.description || "无描述") + "\n";
                        
                        if (record.documentInfo && record.documentInfo.name) {
                            detailInfo += "文档: " + record.documentInfo.name + "\n";
                        }
                        
                        // 优先显示字体变更详情
                        if (record.replaceHistory && record.replaceHistory.length > 0) {
                            detailInfo += "字体变更详情:\n";
                            for (var i = 0; i < Math.min(record.replaceHistory.length, 10); i++) {
                                var change = record.replaceHistory[i];
                                if (change && change.layerName && change.oldFont && change.newFont) {
                                    var sizeInfo = "";
                                    if (change.oldSize && change.newSize) {
                                        sizeInfo = " (" + change.oldSize + "pt → " + change.newSize + "pt)";
                                    }
                                    detailInfo += "• " + change.layerName + ": " + change.oldFont + " → " + change.newFont + sizeInfo + "\n";
                                }
                            }
                            if (record.replaceHistory.length > 10) {
                                detailInfo += "... 还有 " + (record.replaceHistory.length - 10) + " 个图层变更\n";
                            }
                        } else if (record.affectedLayers && record.affectedLayers.length > 0) {
                            // 如果没有字体变更详情，显示受影响的图层信息
                            var layerCount = record.affectedLayers.length;
                            detailInfo += "受影响图层: " + layerCount + " 个文字图层\n";
                            
                            detailInfo += "\n图层详情:\n";
                            for (var i = 0; i < Math.min(layerCount, 5); i++) {
                                var layer = record.affectedLayers[i];
                                if (layer && layer.name && layer.font) {
                                    detailInfo += "• " + layer.name + " [" + layer.font + "]\n";
                                }
                            }
                            if (layerCount > 5) {
                                detailInfo += "... 还有 " + (layerCount - 5) + " 个图层";
                            }
                        } else {
                            detailInfo += "无详细图层信息";
                        }
                        
                        detailText.text = detailInfo;
                        
                        // 启用按钮
                        revertBtn.enabled = true;
                        previewBtn.enabled = true;
                        
                    } else {
                        // 没有选中项或选中的是空记录
                        detailText.text = "请选择一个历史版本查看详情...";
                        revertBtn.enabled = false;
                        previewBtn.enabled = false;
                    }
                } catch (e) {
                    // 处理错误情况
                    detailText.text = "加载版本详情时出错: " + e.message;
                    revertBtn.enabled = false;
                    previewBtn.enabled = false;
                }
            }
            
            // 绑定选择事件
            historyList.onChange = handleHistorySelection;
            
            // 创建快照按钮事件
            createSnapshotBtn.onClick = function() {
                var currentState = getCurrentLayerState();
                // 将当前状态转换为fontChanges格式
                var fontChanges = [];
                if (currentState && currentState.length > 0) {
                    for (var i = 0; i < currentState.length; i++) {
                        var layer = currentState[i];
                        fontChanges.push({
                            layerName: layer.name,
                            oldFont: layer.font,
                            newFont: layer.font, // 手动快照时新旧字体相同
                            oldSize: layer.size,
                            newSize: layer.size  // 手动快照时新旧大小相同
                        });
                    }
                }
                
                var snapshotId = createRegretSnapshot("manual", "手动创建的快照", null, fontChanges);
                
                if (snapshotId) {
                    populateHistoryList();
                    alert("快照创建成功！\n快照ID: " + snapshotId);
                } else {
                    alert("快照创建失败，请检查文档状态。");
                }
            };
            
            // 清空历史按钮事件
            clearHistoryBtn.onClick = function() {
                if (confirm("确定要清空所有历史记录吗？\n\n此操作不可撤销！")) {
                    regretHistory = [];
                    saveRegretHistory();
                    populateHistoryList();
                    detailText.text = "历史记录已清空。";
                    revertBtn.enabled = false;
                    previewBtn.enabled = false;
                }
            };
            
            // 刷新按钮事件
            refreshBtn.onClick = function() {
                loadRegretHistory();
                populateHistoryList();
            };
            
            // 撤回按钮事件
            revertBtn.onClick = function() {
                try {
                    alert("撤回按钮被点击了！"); // 调试信息
                    
                    if (historyList.selection && historyList.selection.regretData) {
                        var record = historyList.selection.regretData;
                        
                        alert("找到选中的记录：" + record.description); // 调试信息
                        
                        if (confirm("确定要撤回到此版本吗？\n\n版本: " + record.description + "\n时间: " + new Date(record.timestamp).toLocaleString() + "\n\n当前状态将被覆盖！")) {
                            var success = revertToSnapshot(record);
                            if (success) {
                                alert("撤回成功！文档已恢复到选定版本的状态。");
                                regretWin.close();
                            } else {
                                alert("撤回失败，请检查文档状态或图层结构。");
                            }
                        }
                    } else {
                        alert("没有选中的历史记录或记录数据无效！"); // 调试信息
                    }
                } catch (e) {
                    alert("撤回按钮点击事件出错：" + e.toString());
                }
            };
            
            // 预览差异按钮事件
            previewBtn.onClick = function() {
                try {
                    alert("预览差异按钮被点击了！"); // 调试信息
                    
                    if (historyList.selection && historyList.selection.regretData) {
                        var record = historyList.selection.regretData;
                        
                        alert("找到选中的记录，开始预览差异：" + record.description); // 调试信息
                        
                        showDifferencePreview(record);
                    } else {
                        alert("没有选中的历史记录或记录数据无效！"); // 调试信息
                    }
                } catch (e) {
                    alert("预览差异按钮点击事件出错：" + e.toString());
                }
            };
            
            // 关闭按钮事件
            closeBtn.onClick = function() {
                regretWin.close();
            };
            
                // 初始化列表
                populateHistoryList();
                
                // 显示窗口
                regretWin.show();
            } catch (e) {
                alert("后悔药功能出现错误：\n" + e.toString() + "\n\n请检查：\n1. 文档是否已保存\n2. 是否有文件写入权限\n3. 历史记录文件是否损坏");
            }
        }
        
        // 撤回到指定快照
        function revertToSnapshot(snapshot) {
            try {
                if (!app.activeDocument) {
                    alert("没有活动文档，无法执行撤回操作。");
                    return false;
                }
                
                var doc = app.activeDocument;
                
                // 记录撤回操作前的状态
                var preRevertState = getCurrentLayerState();
                
                // 直接执行撤回操作
                var result = revertLayersToSnapshot(snapshot.affectedLayers || []);
                
                if (result.success) {
                    // 创建撤回操作的快照
                    createRegretSnapshot("revert", "撤回到版本: " + snapshot.description, preRevertState, null);
                    
                    if (showConsoleLog && logText) {
                        logText.text += "✅ 撤回成功：处理了 " + result.processedLayers + " 个图层\n";
                    }
                    
                    return true;
                } else {
                    alert("撤回操作部分失败：\n成功: " + result.processedLayers + " 个图层\n失败: " + result.failedLayers + " 个图层");
                    return false;
                }
            } catch (e) {
                alert("撤回操作失败：" + e.toString());
                return false;
            }
        }
        
        // 执行图层撤回的具体操作
        function revertLayersToSnapshot(layerData) {
            var doc = app.activeDocument;
            var processedLayers = 0;
            var failedLayers = 0;
            
            for (var i = 0; i < layerData.length; i++) {
                var layerInfo = layerData[i];
                
                try {
                    // 根据图层名称查找图层（优先使用名称查找）
                    var targetLayer = findLayerByName(layerInfo.name);
                    
                    if (targetLayer && targetLayer.kind === LayerKind.TEXT) {
                        var textItem = targetLayer.textItem;
                        
                        // 恢复字体（最重要的属性）
                        if (layerInfo.font) {
                            try {
                                textItem.font = layerInfo.font;
                            } catch (fontError) {
                                // 如果字体不存在，记录错误但继续处理其他属性
                                if (showConsoleLog && logText) {
                                    logText.text += "⚠️ 字体 '" + layerInfo.font + "' 不存在，跳过字体恢复\n";
                                }
                            }
                        }
                        
                        // 恢复文本内容
                        if (layerInfo.contents) {
                            textItem.contents = layerInfo.contents;
                        }
                        
                        // 恢复字体大小（使用像素单位）
                        if (layerInfo.size) {
                            textItem.size = new UnitValue(layerInfo.size, "px");
                        }
                        
                        // 恢复颜色
                        if (layerInfo.color) {
                            var color = new SolidColor();
                            color.rgb.red = layerInfo.color.red;
                            color.rgb.green = layerInfo.color.green;
                            color.rgb.blue = layerInfo.color.blue;
                            textItem.color = color;
                        }
                        
                        // 恢复图层可见性
                        if (typeof layerInfo.visible !== 'undefined') {
                            targetLayer.visible = layerInfo.visible;
                        }
                        
                        // 恢复图层不透明度
                        if (layerInfo.opacity) {
                            targetLayer.opacity = layerInfo.opacity;
                        }
                        
                        processedLayers++;
                        
                        if (showConsoleLog && logText) {
                            logText.text += "✅ 恢复图层: " + layerInfo.name + " (字体: " + layerInfo.font + ")\n";
                        }
                    } else {
                        failedLayers++;
                        if (showConsoleLog && logText) {
                            logText.text += "❌ 未找到图层或非文本图层: " + layerInfo.name + "\n";
                        }
                    }
                } catch (e) {
                    failedLayers++;
                    if (showConsoleLog && logText) {
                        logText.text += "❌ 恢复图层失败: " + layerInfo.name + " - " + e.toString() + "\n";
                    }
                }
            }
            
            // 返回处理结果
            return {
                success: processedLayers > 0,
                processedLayers: processedLayers,
                failedLayers: failedLayers
            };
        }
        
        // 根据名称查找图层（递归搜索所有图层组）
        function findLayerByName(layerName) {
            try {
                var doc = app.activeDocument;
                return searchLayerByName(doc.layers, layerName);
            } catch (e) {
                return null;
            }
        }
        
        // 递归搜索图层
        function searchLayerByName(layers, targetName) {
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                
                // 检查当前图层名称
                if (layer.name === targetName) {
                    return layer;
                }
                
                // 如果是图层组，递归搜索
                if (layer.typename === "LayerSet") {
                    var found = searchLayerByName(layer.layers, targetName);
                    if (found) {
                        return found;
                    }
                }
            }
            return null;
        }
        
        // 撤回上一步操作（撤回控制台日志中的最后一次字体替换）
        function undoLastAction() {
            try {
                // 检查是否有最后一次替换操作记录
                if (!lastReplaceOperation || !lastReplaceOperation.replacedLayers || lastReplaceOperation.replacedLayers.length === 0) {
                    // 在控制台日志中显示提示
                    if (showConsoleLog && logText) {
                        var currentText = logText.text;
                        var newText = "⚠️ 没有可撤回的字体替换操作";
                        logText.text = currentText ? currentText + "\n" + newText : newText;
                    }
                    return;
                }
                
                var undoCount = 0;
                
                // 撤回每个替换的图层
                for (var i = 0; i < lastReplaceOperation.replacedLayers.length; i++) {
                    try {
                        var layerInfo = lastReplaceOperation.replacedLayers[i];
                        var layer = findLayerByName(layerInfo.name);
                        
                        if (layer && layer.textItem) {
                            // 恢复到原来的字体
                            layer.textItem.font = layerInfo.oldFont;
                            undoCount++;
                        }
                    } catch (e) {
                        // 静默处理错误，不在控制台显示
                    }
                }
                
                // 从控制台日志中删除最后一次替换操作的记录
                if (showConsoleLog && logText && lastReplaceOperation.logMessages) {
                    var currentText = logText.text;
                    
                    // 删除最后一次操作的日志消息
                    for (var j = 0; j < lastReplaceOperation.logMessages.length; j++) {
                        var messageToRemove = lastReplaceOperation.logMessages[j];
                        if (messageToRemove.indexOf("✓ 已替换图层：") === 0) {
                            // 删除这条替换记录
                            var lines = currentText.split("\n");
                            for (var k = lines.length - 1; k >= 0; k--) {
                                if (lines[k] === messageToRemove) {
                                    lines.splice(k, 1);
                                    break;
                                }
                            }
                            currentText = lines.join("\n");
                        }
                    }
                    
                    // 更新控制台日志，不显示撤回详情
                    logText.text = currentText;
                }
                
                // 清除最后一次操作记录
                lastReplaceOperation = null;
                
            } catch (e) {
                // 在控制台日志中显示错误
                if (showConsoleLog && logText) {
                    var currentText = logText.text;
                    var newText = "✗ 撤回操作失败: " + e.message;
                    logText.text = currentText ? currentText + "\n" + newText : newText;
                }
            }
        }
        
        // 显示差异预览
        function showDifferencePreview(snapshot) {
            var currentState = getCurrentLayerState();
            
            var diffWin = new Window("dialog", "📊 版本差异预览", undefined, { closeButton: true });
            diffWin.orientation = "column";
            diffWin.alignChildren = ["fill", "top"];
            diffWin.preferredSize = [700, 600];
            
            // 标题信息
            var titlePanel = diffWin.add("panel", undefined, "版本对比信息");
            titlePanel.orientation = "column";
            titlePanel.alignChildren = ["fill", "top"];
            titlePanel.margins = 15;
            
            var infoGroup = titlePanel.add("group");
            infoGroup.orientation = "column";
            infoGroup.alignChildren = ["fill", "top"];
            
            var snapshotInfo = infoGroup.add("statictext", undefined, "📸 快照版本: " + snapshot.description + " (" + snapshot.timestamp + ")");
            var currentInfo = infoGroup.add("statictext", undefined, "🔄 当前版本: " + new Date().toLocaleString());
            
            // 差异统计
            var statsPanel = diffWin.add("panel", undefined, "差异统计");
            statsPanel.orientation = "column";
            statsPanel.alignChildren = ["fill", "top"];
            statsPanel.margins = 15;
            
            // 使用affectedLayers而不是layerData
            var snapshotLayers = snapshot.affectedLayers || [];
            var diffStats = calculateDifferences(snapshotLayers, currentState);
            
            var statsGroup = statsPanel.add("group");
            statsGroup.orientation = "column";
            statsGroup.alignChildren = ["fill", "top"];
            
            var totalText = statsGroup.add("statictext", undefined, "📊 总计: 快照 " + snapshotLayers.length + " 个图层，当前 " + currentState.length + " 个图层");
            var changedText = statsGroup.add("statictext", undefined, "🔄 已变更: " + diffStats.changed + " 个图层");
            var addedText = statsGroup.add("statictext", undefined, "➕ 新增: " + diffStats.added + " 个图层");
            var removedText = statsGroup.add("statictext", undefined, "➖ 删除: " + diffStats.removed + " 个图层");
            
            // 详细差异列表
            var detailPanel = diffWin.add("panel", undefined, "详细差异");
            detailPanel.orientation = "column";
            detailPanel.alignChildren = ["fill", "top"];
            detailPanel.margins = 15;
            
            var diffList = detailPanel.add("listbox", undefined, []);
            diffList.preferredSize = [650, 350];
            
            // 填充差异列表
            populateDifferenceList(diffList, diffStats.details);
            
            // 底部按钮
            var btnGroup = diffWin.add("group");
            btnGroup.orientation = "row";
            btnGroup.alignment = "fill";
            btnGroup.alignChildren = ["fill", "center"];
            btnGroup.margins = [15, 10, 15, 15];
            
            var exportBtn = btnGroup.add("button", undefined, "📄 导出差异报告");
            var closeBtn = btnGroup.add("button", undefined, "❌ 关闭");
            
            // 导出差异报告
            exportBtn.onClick = function() {
                exportDifferenceReport(snapshot, currentState, diffStats);
            };
            
            // 关闭按钮
            closeBtn.onClick = function() {
                diffWin.close();
            };
            
            diffWin.show();
        }
        
        // 计算两个状态之间的差异
        function calculateDifferences(snapshotLayers, currentLayers) {
            var stats = {
                changed: 0,
                added: 0,
                removed: 0,
                details: []
            };
            
            // 创建当前图层的映射表
            var currentLayerMap = {};
            for (var i = 0; i < currentLayers.length; i++) {
                var layer = currentLayers[i];
                currentLayerMap[layer.name] = layer;
            }
            
            // 检查快照中的图层
            for (var i = 0; i < snapshotLayers.length; i++) {
                var snapshotLayer = snapshotLayers[i];
                var currentLayer = currentLayerMap[snapshotLayer.name];
                
                if (!currentLayer) {
                    // 图层已被删除
                    stats.removed++;
                    stats.details.push({
                        type: "removed",
                        name: snapshotLayer.name,
                        description: "图层已删除: " + snapshotLayer.name
                    });
                } else {
                    // 检查图层是否有变化
                    var changes = [];
                    
                    if (snapshotLayer.font !== currentLayer.font) {
                        changes.push("字体: " + snapshotLayer.font + " → " + currentLayer.font);
                    }
                    
                    if (snapshotLayer.contents !== currentLayer.contents) {
                        changes.push("内容: \"" + snapshotLayer.contents + "\" → \"" + currentLayer.contents + "\"");
                    }
                    
                    if (snapshotLayer.size !== currentLayer.size) {
                        changes.push("大小: " + snapshotLayer.size + " → " + currentLayer.size);
                    }
                    
                    if (snapshotLayer.visible !== currentLayer.visible) {
                        changes.push("可见性: " + snapshotLayer.visible + " → " + currentLayer.visible);
                    }
                    
                    if (changes.length > 0) {
                        stats.changed++;
                        stats.details.push({
                            type: "changed",
                            name: snapshotLayer.name,
                            description: "图层变更: " + snapshotLayer.name + " (" + changes.join(", ") + ")"
                        });
                    }
                    
                    // 从映射表中移除已处理的图层
                    delete currentLayerMap[snapshotLayer.name];
                }
            }
            
            // 检查新增的图层
            for (var layerName in currentLayerMap) {
                stats.added++;
                stats.details.push({
                    type: "added",
                    name: layerName,
                    description: "新增图层: " + layerName
                });
            }
            
            return stats;
        }
        
        // 填充差异列表
        function populateDifferenceList(listBox, details) {
            listBox.removeAll();
            
            if (details.length === 0) {
                listBox.add("item", "✅ 没有发现差异，两个版本完全相同");
                return;
            }
            
            for (var i = 0; i < details.length; i++) {
                var detail = details[i];
                var icon = "";
                
                switch (detail.type) {
                    case "changed": icon = "🔄"; break;
                    case "added": icon = "➕"; break;
                    case "removed": icon = "➖"; break;
                    default: icon = "📝"; break;
                }
                
                listBox.add("item", icon + " " + detail.description);
            }
        }
        
        // 导出差异报告
        function exportDifferenceReport(snapshot, currentState, diffStats) {
            try {
                var reportContent = "=== 后悔药版本差异报告 ===\n\n";
                reportContent += "生成时间: " + new Date().toLocaleString() + "\n";
                reportContent += "快照版本: " + snapshot.description + " (" + snapshot.timestamp + ")\n";
                reportContent += "当前版本: " + new Date().toLocaleString() + "\n\n";
                
                reportContent += "=== 差异统计 ===\n";
                reportContent += "变更图层: " + diffStats.changed + " 个\n";
                reportContent += "新增图层: " + diffStats.added + " 个\n";
                reportContent += "删除图层: " + diffStats.removed + " 个\n\n";
                
                reportContent += "=== 详细差异 ===\n";
                for (var i = 0; i < diffStats.details.length; i++) {
                    reportContent += (i + 1) + ". " + diffStats.details[i].description + "\n";
                }
                
                // 保存报告文件
                var reportFile = new File(Folder.desktop + "/后悔药差异报告_" + new Date().getTime() + ".txt");
                reportFile.open("w");
                reportFile.write(reportContent);
                reportFile.close();
                
                alert("差异报告已导出到桌面：\n" + reportFile.name);
            } catch (e) {
                alert("导出差异报告失败：" + e.toString());
            }
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
             var debugCheckbox = logGroup.add("checkbox", undefined, "显示调试弹窗 🐛");
             debugCheckbox.helpTip = "开启后会显示代码调试信息弹窗，用于问题排查";
             debugCheckbox.value = showDebugPopup; // 使用全局变量

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
            orderListBox.onChange = function() {
                updateOrderListState();
            };
            
            // 上移按钮点击事件
            upBtn.onClick = function() {
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
                    
                    // 实时同步更新主面板内容
                    if (typeof populateFontList === 'function') {
                        populateFontList();
                    }
                }
            };
            
            // 下移按钮点击事件
            downBtn.onClick = function() {
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
                    
                    // 实时同步更新主面板内容
                    if (typeof populateFontList === 'function') {
                        populateFontList();
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
                        parts.push("微软雅黑");
                    } else if (orderType === "content" && contentCheckbox.value) {
                        parts.push("(文字内容)");
                    } else if (orderType === "postscript" && psCheckbox.value) {
                        parts.push("[MicrosoftYaHei]");
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
            friendlyCheckbox.onClick = function() {
                updateOrderList(); // 重新构建显示顺序列表
                updateOrderListState(); // 更新按钮状态
                updatePreview(); // 更新预览
            };
            contentCheckbox.onClick = function() {
                updateOrderList(); // 重新构建显示顺序列表
                updateOrderListState(); // 更新按钮状态
                updatePreview(); // 更新预览
            };
            psCheckbox.onClick = function() {
                updateOrderList(); // 重新构建显示顺序列表
                updateOrderListState(); // 更新按钮状态
                updatePreview(); // 更新预览
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
            sortDropdown.onChange = function() {
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



            // 后悔药功能设置面板
            var regretPanel = settingsWin.add("panel", undefined, "⏪ 后悔药功能设置");
            regretPanel.orientation = "column";
            regretPanel.alignChildren = ["fill", "top"];
            regretPanel.margins = 15;
            
            // 保留版本次数设置
            var versionsGroup = regretPanel.add("group");
            versionsGroup.orientation = "row";
            versionsGroup.alignChildren = ["left", "center"];
            versionsGroup.spacing = 10;
            
            var versionsLabel = versionsGroup.add("statictext", undefined, "📦 保留版本次数：");
            versionsLabel.preferredSize = [120, 20];
            
            var versionsInput = versionsGroup.add("edittext", undefined, maxRegretVersions.toString());
            versionsInput.preferredSize = [60, 25];
            versionsInput.helpTip = "设置最多保留多少个历史版本（建议5-20个）";
            
            var versionsExplain = versionsGroup.add("statictext", undefined, "个（建议5-20个）");
            versionsExplain.graphics.foregroundColor = versionsExplain.graphics.newPen(versionsExplain.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);
            
            // 自动记录设置（两个复选框在一行显示）
            var autoRecordGroup = regretPanel.add("group");
            autoRecordGroup.orientation = "row";
            autoRecordGroup.alignChildren = ["left", "center"];
            autoRecordGroup.spacing = 20;
            
            var autoRecordCheckbox = autoRecordGroup.add("checkbox", undefined, "🔄 自动记录修改操作");
            autoRecordCheckbox.value = autoRecordEnabled; // 根据当前设置
            autoRecordCheckbox.helpTip = "开启后会在每次字体替换时自动创建历史版本";
            
            var previewRecordCheckbox = autoRecordGroup.add("checkbox", undefined, "👁️ 查看效果时自动记录");
            previewRecordCheckbox.value = previewRecordEnabled; // 根据当前设置
            previewRecordCheckbox.helpTip = "开启后会在点击查看效果按钮时自动创建预览快照";

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
              okBtn.onClick = function() {
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
                  showDebugPopup = debugCheckbox.value;
                  
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
                  
                  // 保存后悔药功能设置
                  var newMaxVersions = parseInt(versionsInput.text);
                  if (isNaN(newMaxVersions) || newMaxVersions < 1 || newMaxVersions > 100) {
                      alert("保留版本次数必须是1-100之间的数字！");
                      return;
                  }
                  maxRegretVersions = newMaxVersions;
                  autoRecordEnabled = autoRecordCheckbox.value;
                  previewRecordEnabled = previewRecordCheckbox.value;
                  
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
            resetBtn.onClick = function() {
                if (confirm("确定要将所有设置恢复到初始状态吗？\n\n这将重置：\n• 控制台日志显示\n• 字体显示格式\n• 显示顺序\n• 图层排序方式\n• 后悔药功能设置")) {
                    // 恢复到初始默认设置
                     showLogCheckbox.value = true;
                     friendlyCheckbox.value = true;
                     contentCheckbox.value = true;
                     psCheckbox.value = false;
                     warningCheckbox.value = false; // 默认不弹出警告
                     sortDropdown.selection = 0; // 文档顺序
                    
                    // 重置显示顺序为默认值
                    displayOrder = ["friendly", "content"];
                    
                    // 重置后悔药功能设置
                    versionsInput.text = "5"; // 默认保留5个版本
                    autoRecordCheckbox.value = false;
                    previewRecordCheckbox.value = true;
                    
                    // 更新界面显示
                    updateOrderList();
                    updateOrderListState();
                    updatePreview();
                    
                    alert("设置已恢复到初始状态！");
                }
            };

            cancelBtn.onClick = function() {
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
        settingsBtn.onClick = function() {
            var oldShowConsoleLog = showConsoleLog;
            showSettingsDialog();
            
            // 检查设置是否有变化，如果有则更新界面
            if (oldShowConsoleLog !== showConsoleLog) {
                updateLogGroupVisibility(); // 更新控制台日志显示状态
            }
        };
        
        // 打赏按钮点击事件（支持三状态循环切换）
        donateBtn.onClick = function() {
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

        // 控制台日志（根据设置显示/隐藏）
        var logGroup, logTitle, logText;
        
        // 创建控制台日志组件的函数
        function createLogGroup() {
            if (!logGroup && showConsoleLog) {
                logGroup = win.add("group");
                logGroup.orientation = "column";
                logGroup.alignChildren = "fill";
                
                // 创建日志标题和按钮的水平组
                var logTitleGroup = logGroup.add("group");
                logTitleGroup.orientation = "row";
                logTitleGroup.alignChildren = ["fill", "center"];
                logTitleGroup.alignment = "fill";
                
                logTitle = logTitleGroup.add("statictext", undefined, "📋 控制台日志:");
                
                // 添加弹性空间，将按钮推到右边
                var spacer = logTitleGroup.add("group");
                spacer.alignment = ["fill", "center"];
                
                // 添加撤回上一步按钮
                var undoBtn = logTitleGroup.add("button", undefined, "↶ 撤回上一步");
                undoBtn.preferredSize = [90, 25];
                undoBtn.helpTip = "快速撤回到上一个修改版本";
                undoBtn.alignment = ["right", "center"];
                
                // 撤回上一步按钮点击事件
                undoBtn.onClick = function() {
                    undoLastAction();
                };
                
                // 添加后悔药功能按钮
                var regretBtn = logTitleGroup.add("button", undefined, "⏪ 后悔药");
                regretBtn.preferredSize = [80, 25];
                regretBtn.helpTip = "查看历史修改记录，支持撤回到任意版本状态";
                regretBtn.alignment = ["right", "center"];
                
                // 后悔药按钮点击事件
                regretBtn.onClick = function() {
                    showRegretDialog();
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
        function replaceFont(layers, newFontPS, logText, newSize) {
            // 在执行替换前，先记录当前状态
            var preReplaceState = getCurrentLayerState();
            
            var count = 0;
            var logMessages = [];
            var replacedLayers = []; // 记录成功替换的图层信息
            
            // 获取新字体的友好名称
            var newFontFriendly = getFriendlyFontName(newFontPS) || newFontPS;
            
            for (var i = 0; i < layers.length; i++) {
                try {
                    var oldFontPS = layers[i].textItem.font;
                    var oldFontFriendly = getFriendlyFontName(oldFontPS) || oldFontPS;
                    
                    layers[i].textItem.font = newFontPS;
                    
                    // 如果提供了新的字体大小，则设置字体大小
                    if (newSize && newSize > 0) {
                        var unit = currentUnit ? "pt" : "px";
                        layers[i].textItem.size = new UnitValue(newSize, unit);
                    }
                    
                    count++;
                    
                    // 记录成功替换的图层信息
                    var layerInfo = {
                        name: layers[i].name,
                        oldFont: oldFontFriendly,
                        newFont: newFontFriendly
                    };
                    
                    // 如果设置了新的字体大小，记录大小变更信息
                    if (newSize && newSize > 0) {
                        try {
                            // 使用pt作为标准单位获取字体大小
                            var oldSize = Math.round(layers[i].textItem.size.as("pt"));
                            layerInfo.oldSize = oldSize;
                            layerInfo.newSize = newSize;
                        } catch (e) {
                            try {
                                var oldSize = Math.round(layers[i].textItem.size.value);
                                layerInfo.oldSize = oldSize;
                                layerInfo.newSize = newSize;
                            } catch (e2) {
                                // 获取旧字体大小失败时忽略
                            }
                        }
                    }
                    
                    replacedLayers.push(layerInfo);
                    
                    // 构建日志消息
                    var logMessage = "✓ 已替换图层：" + layers[i].name + " [" + oldFontFriendly + " → " + newFontFriendly;
                    
                    // 如果有字体大小变更，添加大小信息
                    if (layerInfo.oldSize && layerInfo.newSize) {
                        logMessage += ", " + layerInfo.oldSize + "px → " + layerInfo.newSize + "px";
                    }
                    
                    logMessage += "]";
                    logMessages.push(logMessage);
                } catch (e) {
                    logMessages.push("✗ 替换失败图层：" + layers[i].name + "，错误：" + e.message);
                }
            }
            
            // 记录最后一次替换操作（用于撤回上一步功能）
            if (count > 0) {
                lastReplaceOperation = {
                    replacedLayers: replacedLayers,
                    logMessages: logMessages.slice(), // 复制数组
                    timestamp: new Date().getTime()
                };
            }
            
            // 如果有成功替换的图层且开启了自动记录，创建后悔药快照
            if (count > 0 && autoRecordEnabled) {
                var description = "字体替换: " + count + " 个图层 → " + newFontFriendly;
                
                // 添加详细的替换信息到描述中
                if (replacedLayers.length <= 3) {
                    var layerNames = [];
                    for (var i = 0; i < replacedLayers.length; i++) {
                        layerNames.push(replacedLayers[i].name);
                    }
                    description += " (" + layerNames.join(", ") + ")";
                } else {
                    description += " (" + replacedLayers[0].name + " 等" + replacedLayers.length + "个图层)";
                }
                
                // 创建快照记录，包含字体变更详情
                createRegretSnapshot("font_replace", description, preReplaceState, replacedLayers);
                
                // 添加日志记录
                if (showConsoleLog && logText) {
                    logMessages.push("📸 已自动创建后悔药快照: " + description);
                }
            } else if (count > 0 && !autoRecordEnabled && showConsoleLog && logText) {
                // 如果关闭了自动记录，提示用户可以手动创建快照
                logMessages.push("💡 提示: 自动记录已关闭，可点击后悔药按钮手动创建快照");
            }
            
            // 将日志消息添加到文本框（仅在logText存在时）
            if (logMessages.length > 0 && logText) {
                var currentText = logText.text;
                var newText = logMessages.join("\n");
                logText.text = currentText ? currentText + "\n" + newText : newText;
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
                fontOrder.sort(function(a, b) {
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
                
                sortedLayers.sort(function(a, b) {
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
                            displayParts.push(friendlyName);
                        }
                    } else if (orderType === "content" && showLayerContent) {
                        try {
                            var textContent = layer.textItem.contents;
                            // 限制文字内容长度，避免显示过长
                            if (textContent.length > 20) {
                                textContent = textContent.substring(0, 20) + "...";
                            }
                            if (textContent) {
                                displayParts.push("(" + textContent + ")");
                            }
                        } catch (e) {
                            // 如果获取文字内容失败，使用图层名称作为备选
                            displayParts.push("(" + layer.name + ")");
                        }
                    } else if (orderType === "postscript" && showPostScriptName) {
                        if (psName) {
                            displayParts.push("[" + psName + "]");
                        }
                    }
                }
                
                // 构建最终显示文本
                var displayText;
                if (displayParts.length > 0) {
                    displayText = displayParts.join(" ");
                } else {
                    // 如果没有任何显示内容，使用友好字体名称和图层名称作为默认格式
                    displayText = friendlyName + " (" + layer.name + ")";
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
        fontList.onClick = function() {
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
            
            // 更新字体大小显示
            updateFontSizeDisplay();
        };

        // 反选复选框事件处理
        invertSelectionCheckbox.onClick = function() {
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
        clearSelectionCheckbox.onClick = function() {
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
        styleDropdown.preferredSize = [180, 25];
        styleDropdown.selection = 0;
        styleDropdown.helpTip = "选择字体的具体样式（如：Regular、Bold、Light等）";

        // 字体大小设置（在同一行）
        var sizeLabel = groupDropdown.add("statictext", undefined, "大小:");
        sizeLabel.preferredSize = [30, 20];
        
        var sizeInput = groupDropdown.add("edittext", undefined, "");
        sizeInput.preferredSize = [50, 25];
        sizeInput.helpTip = "字体大小（点击单位可切换pt/px）";
        
        // 添加可点击的单位切换按钮
        var sizeUnitBtn = groupDropdown.add("button", undefined, "pt");
        sizeUnitBtn.preferredSize = [25, 25];
        sizeUnitBtn.helpTip = "点击切换单位：pt（点）/ px（像素）";
        
        // 当前单位状态（true=pt, false=px）
        var currentUnit = true; // 默认使用pt
        
        // 单位切换按钮点击事件
        sizeUnitBtn.onClick = function() {
            currentUnit = !currentUnit;
            sizeUnitBtn.text = currentUnit ? "pt" : "px";
            
            // 重新更新字体大小显示
            updateFontSizeDisplay();
        };

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

        // 更新字体大小显示的函数
        function updateFontSizeDisplay() {
            try {
                var selectedLayers = [];
                
                // 收集所有选中的图层
                for (var i = 0; i < fontList.items.length; i++) {
                    if (fontList.items[i].selected) {
                        selectedLayers.push(sortedLayers[i]);
                    }
                }
                
                if (selectedLayers.length === 0) {
                    // 没有选中图层，清空字体大小
                    sizeInput.text = "";
                    return;
                }
                
                // 获取第一个选中图层的字体大小
                var firstSize = null;
                try {
                    var sizeValue;
                    if (currentUnit) {
                        // 使用pt单位
                        sizeValue = selectedLayers[0].textItem.size.as("pt");
                        firstSize = Math.round(sizeValue);
                        debugAlert("获取字体大小成功: " + firstSize + "pt");
                    } else {
                        // 使用px单位
                        sizeValue = selectedLayers[0].textItem.size.as("px");
                        firstSize = Math.round(sizeValue);
                        debugAlert("获取字体大小成功: " + firstSize + "px");
                    }
                } catch (e) {
                    // 如果获取指定单位失败，尝试其他方式
                    try {
                        var sizeValue = selectedLayers[0].textItem.size.value;
                        firstSize = Math.round(sizeValue);
                        debugAlert("使用value属性获取字体大小: " + firstSize);
                    } catch (e2) {
                        debugAlert("获取字体大小失败: " + e2.message);
                        sizeInput.text = "";
                        return;
                    }
                }
                
                var allSame = true;
                
                // 检查所有选中图层的字体大小是否相同
                for (var i = 1; i < selectedLayers.length; i++) {
                    var currentSize = null;
                    try {
                        var sizeValue;
                        if (currentUnit) {
                            // 使用pt单位
                            sizeValue = selectedLayers[i].textItem.size.as("pt");
                        } else {
                            // 使用px单位
                            sizeValue = selectedLayers[i].textItem.size.as("px");
                        }
                        currentSize = Math.round(sizeValue);
                    } catch (e) {
                        try {
                            var sizeValue = selectedLayers[i].textItem.size.value;
                            currentSize = Math.round(sizeValue);
                        } catch (e2) {
                            allSame = false;
                            break;
                        }
                    }
                    
                    if (currentSize !== firstSize) {
                        allSame = false;
                        break;
                    }
                }
                
                if (allSame && firstSize !== null) {
                    // 所有选中图层字体大小相同，显示该大小
                    sizeInput.text = firstSize.toString();
                } else {
                    // 字体大小不同或获取失败，显示空
                    sizeInput.text = "";
                }
            } catch (e) {
                // 整体错误处理
                debugAlert("更新字体大小显示时出错: " + e.message);
                sizeInput.text = "";
            }
        }

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

            // 获取字体大小
            var newSize = parseFloat(sizeInput.text);
            if (isNaN(newSize) || newSize <= 0) {
                alert("请输入有效的字体大小（大于0的数字）！");
                return;
            }

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

            var count = replaceFont(layersToReplace, newPS, logText, newSize);
            if (showScriptWarning) {
                alert("已替换 " + count + " 个文字图层的字体。");
            }
        };

        cancelBtn.onClick = function () { 
            // 检查是否有字体修改，只有在有修改时才保存历史版本
            if (typeof lastReplaceOperation !== 'undefined' && lastReplaceOperation && lastReplaceOperation.replacedLayers && lastReplaceOperation.replacedLayers.length > 0) {
                // 有字体修改，创建预览快照
                if (previewRecordEnabled) {
                    try {
                        var currentState = getCurrentLayerState();
                        createRegretSnapshot("preview", "查看效果时的快照", currentState, lastReplaceOperation.replacedLayers);
                        
                        if (showConsoleLog && logText) {
                            logText.text += "📸 已保存查看效果时的历史版本 (替换了 " + lastReplaceOperation.replacedLayers.length + " 个图层)\n";
                        }
                    } catch (e) {
                        if (showConsoleLog && logText) {
                            logText.text += "❌ 保存查看效果快照失败: " + e.toString() + "\n";
                        }
                    }
                } else if (showConsoleLog && logText) {
                    logText.text += "💡 提示: 预览自动记录已关闭，可点击后悔药按钮手动创建快照\n";
                }
            } else {
                // 没有字体修改，不保存历史版本
                if (showConsoleLog && logText) {
                    logText.text += "💡 没有字体修改，不保存历史版本\n";
                }
            }
            
            win.close(); 
        };

        // 添加窗口关闭事件处理
        win.onClose = function() {
            stopLayerMonitoring();
        };
        
        win.show();
        
        // 启动图层监控功能
        startLayerMonitoring();
    }
    
    // 图层监控功能
    var lastActiveLayerName = null;
    var layerMonitorTimer = null;
    
    function startLayerMonitoring() {
        // 每500毫秒检查一次活动图层变化
        layerMonitorTimer = app.setInterval(function() {
            try {
                if (!app.activeDocument) return;
                
                var currentActiveLayer = app.activeDocument.activeLayer;
                if (!currentActiveLayer) return;
                
                var currentLayerName = currentActiveLayer.name;
                
                // 如果活动图层发生变化
                if (currentLayerName !== lastActiveLayerName) {
                    lastActiveLayerName = currentLayerName;
                    
                    // 检查是否是文字图层
                    if (currentActiveLayer.kind === LayerKind.TEXT) {
                        // 更新字体列表选择状态
                        updateFontListSelection(currentLayerName);
                        // 更新字体大小显示
                        updateFontSizeDisplay();
                    }
                }
            } catch (e) {
                // 忽略监控过程中的错误
            }
        }, 500);
    }
    
    function stopLayerMonitoring() {
        if (layerMonitorTimer) {
            app.clearInterval(layerMonitorTimer);
            layerMonitorTimer = null;
        }
    }
    
    // 根据图层名称更新字体列表选择状态
    function updateFontListSelection(layerName) {
        try {
            // 清除所有选择
            for (var i = 0; i < fontList.items.length; i++) {
                fontList.items[i].selected = false;
            }
            
            // 查找匹配的图层并选中
            for (var i = 0; i < sortedLayers.length; i++) {
                if (sortedLayers[i].name === layerName) {
                    if (i < fontList.items.length) {
                        fontList.items[i].selected = true;
                        // 更新选中状态统计
                        updateSelectionStats();
                        break;
                    }
                }
            }
        } catch (e) {
            // 忽略更新过程中的错误
        }
    }

    // ====================== 执行 ======================
    fontViewerAndReplacer();

})();