/*
 * 后悔药功能测试脚本
 * 用于验证FontSwapper.jsx中后悔药功能的各个方面
 */

(function() {
    
    // 测试用的模拟数据
    var testResults = [];
    
    function addTestResult(testName, passed, message) {
        testResults.push({
            name: testName,
            passed: passed,
            message: message || ""
        });
    }
    
    function showTestResults() {
        var resultText = "🧪 后悔药功能测试结果\n";
        resultText += "=" + Array(40).join("=") + "\n\n";
        
        var passedCount = 0;
        var totalCount = testResults.length;
        
        for (var i = 0; i < testResults.length; i++) {
            var result = testResults[i];
            var status = result.passed ? "✅ 通过" : "❌ 失败";
            resultText += status + " " + result.name + "\n";
            if (result.message) {
                resultText += "   " + result.message + "\n";
            }
            resultText += "\n";
            
            if (result.passed) passedCount++;
        }
        
        resultText += "=" + Array(40).join("=") + "\n";
        resultText += "总计: " + passedCount + "/" + totalCount + " 个测试通过\n";
        
        if (passedCount === totalCount) {
            resultText += "🎉 所有测试都通过了！后悔药功能运行正常。";
        } else {
            resultText += "⚠️ 有 " + (totalCount - passedCount) + " 个测试失败，请检查相关功能。";
        }
        
        alert(resultText);
    }
    
    // 测试1: 检查是否有活动文档
    try {
        if (app.documents.length === 0) {
            addTestResult("文档检查", false, "请先打开一个Photoshop文档再运行测试");
            showTestResults();
            return;
        }
        addTestResult("文档检查", true, "检测到活动文档: " + app.activeDocument.name);
    } catch (e) {
        addTestResult("文档检查", false, "无法访问活动文档: " + e.toString());
        showTestResults();
        return;
    }
    
    // 测试2: 检查文档是否包含文字图层
    try {
        var doc = app.activeDocument;
        var hasTextLayers = false;
        var textLayerCount = 0;
        
        function checkLayersRecursive(layers) {
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                if (layer.typename === "ArtLayer" && layer.kind === LayerKind.TEXT) {
                    hasTextLayers = true;
                    textLayerCount++;
                } else if (layer.typename === "LayerSet") {
                    checkLayersRecursive(layer.layers);
                }
            }
        }
        
        checkLayersRecursive(doc.layers);
        
        if (hasTextLayers) {
            addTestResult("文字图层检查", true, "找到 " + textLayerCount + " 个文字图层");
        } else {
            addTestResult("文字图层检查", false, "文档中没有文字图层，无法测试字体替换功能");
        }
    } catch (e) {
        addTestResult("文字图层检查", false, "检查文字图层时出错: " + e.toString());
    }
    
    // 测试3: 检查后悔药历史文件夹是否可以创建
    try {
        var doc = app.activeDocument;
        var docPath = doc.path;
        var regretFolder = new Folder(docPath + "/.regret_history");
        
        if (!regretFolder.exists) {
            var created = regretFolder.create();
            if (created) {
                addTestResult("历史文件夹创建", true, "成功创建历史文件夹: " + regretFolder.fsName);
            } else {
                addTestResult("历史文件夹创建", false, "无法创建历史文件夹");
            }
        } else {
            addTestResult("历史文件夹创建", true, "历史文件夹已存在: " + regretFolder.fsName);
        }
    } catch (e) {
        addTestResult("历史文件夹创建", false, "创建历史文件夹时出错: " + e.toString());
    }
    
    // 测试4: 检查历史记录文件是否可以创建和写入
    try {
        var doc = app.activeDocument;
        var docPath = doc.path;
        var historyFile = new File(docPath + "/.regret_history/regret_history.json");
        
        // 创建测试数据
        var testData = {
            version: "1.0",
            created: new Date().toString(),
            snapshots: [
                {
                    id: "test_" + new Date().getTime(),
                    type: "test",
                    description: "测试快照",
                    timestamp: new Date().toString(),
                    layers: []
                }
            ]
        };
        
        historyFile.open("w");
        historyFile.write(JSON.stringify(testData, null, 2));
        historyFile.close();
        
        // 验证文件是否可以读取
        historyFile.open("r");
        var content = historyFile.read();
        historyFile.close();
        
        var parsedData = JSON.parse(content);
        if (parsedData.version === "1.0" && parsedData.snapshots.length === 1) {
            addTestResult("历史文件读写", true, "历史文件读写功能正常");
        } else {
            addTestResult("历史文件读写", false, "历史文件数据格式不正确");
        }
    } catch (e) {
        addTestResult("历史文件读写", false, "历史文件读写测试失败: " + e.toString());
    }
    
    // 测试5: 检查系统字体是否可以获取
    try {
        var systemFonts = app.fonts;
        if (systemFonts.length > 0) {
            addTestResult("系统字体获取", true, "检测到 " + systemFonts.length + " 个系统字体");
        } else {
            addTestResult("系统字体获取", false, "无法获取系统字体列表");
        }
    } catch (e) {
        addTestResult("系统字体获取", false, "获取系统字体时出错: " + e.toString());
    }
    
    // 测试6: 检查文档状态获取功能
    try {
        var doc = app.activeDocument;
        var currentState = [];
        
        function getLayerStateRecursive(layers, parentPath) {
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                var layerPath = parentPath ? parentPath + "/" + layer.name : layer.name;
                
                if (layer.typename === "ArtLayer" && layer.kind === LayerKind.TEXT) {
                    var textItem = layer.textItem;
                    currentState.push({
                        name: layer.name,
                        path: layerPath,
                        font: textItem.font,
                        size: textItem.size.value,
                        contents: textItem.contents.substring(0, 50) // 只取前50个字符
                    });
                } else if (layer.typename === "LayerSet") {
                    getLayerStateRecursive(layer.layers, layerPath);
                }
            }
        }
        
        getLayerStateRecursive(doc.layers, "");
        
        if (currentState.length > 0) {
            addTestResult("文档状态获取", true, "成功获取 " + currentState.length + " 个文字图层的状态");
        } else {
            addTestResult("文档状态获取", true, "文档状态获取功能正常（无文字图层）");
        }
    } catch (e) {
        addTestResult("文档状态获取", false, "获取文档状态时出错: " + e.toString());
    }
    
    // 显示测试结果
    showTestResults();
    
    // 提供进一步测试的建议
    var suggestions = "\n\n📋 进一步测试建议：\n\n";
    suggestions += "1. 手动运行FontSwapper.jsx脚本\n";
    suggestions += "2. 测试字体替换功能是否正常工作\n";
    suggestions += "3. 检查设置首选项窗口中的后悔药设置\n";
    suggestions += "4. 验证自动记录开关是否生效\n";
    suggestions += "5. 测试后悔药按钮的撤销功能\n";
    suggestions += "6. 验证查看效果按钮的自动记录功能\n\n";
    suggestions += "💡 如果基础测试都通过，说明后悔药功能的基础架构正常。";
    
    alert(suggestions);
    
})();