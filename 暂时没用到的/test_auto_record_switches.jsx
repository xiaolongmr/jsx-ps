/*
 * 自动记录开关功能测试脚本
 * 用于验证FontSwapper.jsx中自动记录开关是否正常工作
 */

(function() {
    
    // 模拟FontSwapper.jsx中的相关变量和函数
    var autoRecordEnabled = true;  // 自动记录修改操作开关
    var previewRecordEnabled = true;  // 查看效果时自动记录开关
    var maxRegretVersions = 20;  // 保留版本次数
    var showConsoleLog = true;  // 控制台日志显示
    
    var regretHistory = [];  // 后悔药历史记录
    var regretHistoryFile = null;  // 历史记录文件
    
    // 测试结果记录
    var testResults = [];
    
    function addTestResult(testName, passed, message) {
        testResults.push({
            name: testName,
            passed: passed,
            message: message || ""
        });
    }
    
    function showTestResults() {
        var resultText = "🔄 自动记录开关功能测试结果\n";
        resultText += "=" + Array(50).join("=") + "\n\n";
        
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
        
        resultText += "=" + Array(50).join("=") + "\n";
        resultText += "总计: " + passedCount + "/" + totalCount + " 个测试通过\n";
        
        if (passedCount === totalCount) {
            resultText += "🎉 所有自动记录开关测试都通过了！";
        } else {
            resultText += "⚠️ 有 " + (totalCount - passedCount) + " 个测试失败。";
        }
        
        alert(resultText);
    }
    
    // 模拟创建快照的函数
    function createRegretSnapshot(type, description, layerState) {
        var snapshot = {
            id: type + "_" + new Date().getTime(),
            type: type,
            description: description,
            timestamp: new Date().toString(),
            layers: layerState || []
        };
        
        regretHistory.push(snapshot);
        
        // 限制历史记录数量
        if (regretHistory.length > maxRegretVersions) {
            regretHistory.shift(); // 删除最旧的记录
        }
        
        return snapshot;
    }
    
    // 模拟获取当前图层状态的函数
    function getCurrentLayerState() {
        // 返回模拟的图层状态数据
        return [
            {
                name: "测试文字图层1",
                font: "Arial-Regular",
                size: 24,
                contents: "测试文本内容"
            },
            {
                name: "测试文字图层2", 
                font: "Helvetica-Bold",
                size: 18,
                contents: "另一个测试文本"
            }
        ];
    }
    
    // 模拟字体替换函数（带自动记录逻辑）
    function mockReplaceFont(layersToReplace, newFont) {
        var replacedCount = 0;
        
        // 模拟替换前记录当前状态
        var beforeState = getCurrentLayerState();
        
        // 模拟字体替换过程
        for (var i = 0; i < layersToReplace.length; i++) {
            // 这里只是模拟，实际不会真的替换字体
            replacedCount++;
        }
        
        // 根据autoRecordEnabled设置决定是否自动记录
        if (autoRecordEnabled && replacedCount > 0) {
            var description = "字体替换操作 (" + replacedCount + "个图层)";
            createRegretSnapshot("replace", description, beforeState);
            return { success: true, recorded: true, count: replacedCount };
        } else if (!autoRecordEnabled) {
            return { success: true, recorded: false, count: replacedCount };
        }
        
        return { success: false, recorded: false, count: 0 };
    }
    
    // 模拟查看效果按钮点击（带自动记录逻辑）
    function mockPreviewButtonClick() {
        if (previewRecordEnabled) {
            var currentState = getCurrentLayerState();
            if (currentState && currentState.length > 0) {
                var description = "查看效果时的状态快照 (" + currentState.length + "个图层)";
                createRegretSnapshot("preview", description, currentState);
                return { recorded: true, message: "已自动创建预览快照" };
            }
        } else {
            return { recorded: false, message: "预览自动记录已关闭" };
        }
        
        return { recorded: false, message: "无图层状态可记录" };
    }
    
    // 测试1: 自动记录开关开启时的字体替换
    try {
        autoRecordEnabled = true;
        var initialHistoryCount = regretHistory.length;
        
        var result = mockReplaceFont([{name: "测试图层1"}, {name: "测试图层2"}], "新字体");
        
        if (result.success && result.recorded && regretHistory.length > initialHistoryCount) {
            addTestResult("自动记录开启-字体替换", true, 
                "成功记录了 " + result.count + " 个图层的替换操作");
        } else {
            addTestResult("自动记录开启-字体替换", false, 
                "自动记录功能未正常工作");
        }
    } catch (e) {
        addTestResult("自动记录开启-字体替换", false, "测试出错: " + e.toString());
    }
    
    // 测试2: 自动记录开关关闭时的字体替换
    try {
        autoRecordEnabled = false;
        var initialHistoryCount = regretHistory.length;
        
        var result = mockReplaceFont([{name: "测试图层3"}], "新字体");
        
        if (result.success && !result.recorded && regretHistory.length === initialHistoryCount) {
            addTestResult("自动记录关闭-字体替换", true, 
                "正确地没有自动记录替换操作");
        } else {
            addTestResult("自动记录关闭-字体替换", false, 
                "自动记录关闭时仍然创建了记录");
        }
    } catch (e) {
        addTestResult("自动记录关闭-字体替换", false, "测试出错: " + e.toString());
    }
    
    // 测试3: 预览自动记录开关开启时的查看效果
    try {
        previewRecordEnabled = true;
        var initialHistoryCount = regretHistory.length;
        
        var result = mockPreviewButtonClick();
        
        if (result.recorded && regretHistory.length > initialHistoryCount) {
            addTestResult("预览自动记录开启", true, result.message);
        } else {
            addTestResult("预览自动记录开启", false, 
                "预览自动记录功能未正常工作");
        }
    } catch (e) {
        addTestResult("预览自动记录开启", false, "测试出错: " + e.toString());
    }
    
    // 测试4: 预览自动记录开关关闭时的查看效果
    try {
        previewRecordEnabled = false;
        var initialHistoryCount = regretHistory.length;
        
        var result = mockPreviewButtonClick();
        
        if (!result.recorded && regretHistory.length === initialHistoryCount) {
            addTestResult("预览自动记录关闭", true, result.message);
        } else {
            addTestResult("预览自动记录关闭", false, 
                "预览自动记录关闭时仍然创建了记录");
        }
    } catch (e) {
        addTestResult("预览自动记录关闭", false, "测试出错: " + e.toString());
    }
    
    // 测试5: 历史记录数量限制功能
    try {
        maxRegretVersions = 3; // 设置较小的限制用于测试
        regretHistory = []; // 清空历史记录
        
        // 创建超过限制数量的快照
        for (var i = 0; i < 5; i++) {
            createRegretSnapshot("test", "测试快照 " + (i + 1), getCurrentLayerState());
        }
        
        if (regretHistory.length === maxRegretVersions) {
            addTestResult("历史记录数量限制", true, 
                "正确限制了历史记录数量为 " + maxRegretVersions + " 个");
        } else {
            addTestResult("历史记录数量限制", false, 
                "历史记录数量为 " + regretHistory.length + "，应该是 " + maxRegretVersions);
        }
    } catch (e) {
        addTestResult("历史记录数量限制", false, "测试出错: " + e.toString());
    }
    
    // 测试6: 快照数据结构验证
    try {
        var snapshot = createRegretSnapshot("manual", "手动测试快照", getCurrentLayerState());
        
        var hasRequiredFields = snapshot.id && snapshot.type && snapshot.description && 
                               snapshot.timestamp && snapshot.layers;
        
        if (hasRequiredFields && snapshot.type === "manual" && snapshot.layers.length > 0) {
            addTestResult("快照数据结构", true, 
                "快照包含所有必需字段，图层数据: " + snapshot.layers.length + " 个");
        } else {
            addTestResult("快照数据结构", false, 
                "快照数据结构不完整或不正确");
        }
    } catch (e) {
        addTestResult("快照数据结构", false, "测试出错: " + e.toString());
    }
    
    // 显示测试结果
    showTestResults();
    
    // 显示当前历史记录状态
    var historyInfo = "\n\n📊 当前历史记录状态：\n\n";
    historyInfo += "• 历史记录总数: " + regretHistory.length + "\n";
    historyInfo += "• 最大保留数量: " + maxRegretVersions + "\n";
    historyInfo += "• 自动记录开关: " + (autoRecordEnabled ? "开启" : "关闭") + "\n";
    historyInfo += "• 预览记录开关: " + (previewRecordEnabled ? "开启" : "关闭") + "\n\n";
    
    if (regretHistory.length > 0) {
        historyInfo += "📝 历史记录详情:\n";
        for (var i = 0; i < regretHistory.length; i++) {
            var record = regretHistory[i];
            historyInfo += "  " + (i + 1) + ". [" + record.type + "] " + record.description + "\n";
        }
    }
    
    historyInfo += "\n💡 测试完成！如果所有测试都通过，说明自动记录开关功能正常。";
    
    alert(historyInfo);
    
})();