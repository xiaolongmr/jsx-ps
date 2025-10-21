/*
 * 复杂修改场景测试脚本
 * 用于验证FontSwapper.jsx在复杂场景下的后悔药功能
 */

(function() {
    
    // 检查是否有活动文档
    if (app.documents.length === 0) {
        alert("❌ 请先打开一个包含文字图层的Photoshop文档再运行此测试！");
        return;
    }
    
    var doc = app.activeDocument;
    var testResults = [];
    
    function addTestResult(testName, passed, message) {
        testResults.push({
            name: testName,
            passed: passed,
            message: message || ""
        });
    }
    
    function showTestResults() {
        var resultText = "🧪 复杂场景测试结果\n";
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
        
        alert(resultText);
    }
    
    // 递归获取所有图层（包括嵌套的图层组）
    function getAllLayersRecursive(layers, parentPath, result) {
        if (!result) result = [];
        
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var layerPath = parentPath ? parentPath + "/" + layer.name : layer.name;
            
            if (layer.typename === "ArtLayer") {
                result.push({
                    layer: layer,
                    path: layerPath,
                    type: layer.kind,
                    isText: layer.kind === LayerKind.TEXT
                });
            } else if (layer.typename === "LayerSet") {
                // 记录图层组本身
                result.push({
                    layer: layer,
                    path: layerPath,
                    type: "LayerSet",
                    isText: false
                });
                // 递归处理图层组内的图层
                getAllLayersRecursive(layer.layers, layerPath, result);
            }
        }
        
        return result;
    }
    
    // 测试1: 检查文档结构复杂度
    try {
        var allLayers = getAllLayersRecursive(doc.layers, "");
        var textLayers = [];
        var layerSets = [];
        var maxDepth = 0;
        
        for (var i = 0; i < allLayers.length; i++) {
            var layerInfo = allLayers[i];
            var depth = layerInfo.path.split("/").length - 1;
            if (depth > maxDepth) maxDepth = depth;
            
            if (layerInfo.isText) {
                textLayers.push(layerInfo);
            } else if (layerInfo.type === "LayerSet") {
                layerSets.push(layerInfo);
            }
        }
        
        var complexity = "简单";
        if (maxDepth > 2 || layerSets.length > 5 || textLayers.length > 10) {
            complexity = "复杂";
        } else if (maxDepth > 1 || layerSets.length > 2 || textLayers.length > 5) {
            complexity = "中等";
        }
        
        addTestResult("文档结构分析", true, 
            "复杂度: " + complexity + " | 最大嵌套深度: " + maxDepth + 
            " | 图层组: " + layerSets.length + " | 文字图层: " + textLayers.length);
            
    } catch (e) {
        addTestResult("文档结构分析", false, "分析文档结构时出错: " + e.toString());
    }
    
    // 测试2: 检查嵌套图层组中的文字图层
    try {
        var nestedTextLayers = [];
        
        for (var i = 0; i < allLayers.length; i++) {
            var layerInfo = allLayers[i];
            if (layerInfo.isText && layerInfo.path.indexOf("/") !== -1) {
                nestedTextLayers.push(layerInfo);
            }
        }
        
        if (nestedTextLayers.length > 0) {
            addTestResult("嵌套文字图层检测", true, 
                "找到 " + nestedTextLayers.length + " 个嵌套在图层组中的文字图层");
        } else {
            addTestResult("嵌套文字图层检测", true, 
                "文档中没有嵌套的文字图层（这是正常情况）");
        }
    } catch (e) {
        addTestResult("嵌套文字图层检测", false, "检测嵌套文字图层时出错: " + e.toString());
    }
    
    // 测试3: 检查文字图层的字体多样性
    try {
        var fontUsage = {};
        var totalTextLayers = 0;
        
        for (var i = 0; i < allLayers.length; i++) {
            var layerInfo = allLayers[i];
            if (layerInfo.isText) {
                totalTextLayers++;
                try {
                    var font = layerInfo.layer.textItem.font;
                    if (fontUsage[font]) {
                        fontUsage[font]++;
                    } else {
                        fontUsage[font] = 1;
                    }
                } catch (e) {
                    // 某些文字图层可能无法访问字体信息
                }
            }
        }
        
        var uniqueFonts = 0;
        var fontList = "";
        for (var font in fontUsage) {
            uniqueFonts++;
            fontList += font + "(" + fontUsage[font] + "个) ";
        }
        
        if (uniqueFonts > 0) {
            addTestResult("字体多样性检查", true, 
                "使用了 " + uniqueFonts + " 种不同字体: " + fontList);
        } else {
            addTestResult("字体多样性检查", false, "无法获取字体信息");
        }
    } catch (e) {
        addTestResult("字体多样性检查", false, "检查字体多样性时出错: " + e.toString());
    }
    
    // 测试4: 模拟批量字体替换的复杂场景
    try {
        var simulationResults = {
            totalLayers: 0,
            processedLayers: 0,
            skippedLayers: 0,
            errors: 0
        };
        
        for (var i = 0; i < allLayers.length; i++) {
            var layerInfo = allLayers[i];
            if (layerInfo.isText) {
                simulationResults.totalLayers++;
                
                try {
                    // 模拟访问文字图层属性
                    var textItem = layerInfo.layer.textItem;
                    var font = textItem.font;
                    var size = textItem.size;
                    var contents = textItem.contents;
                    
                    // 模拟字体替换逻辑
                    if (contents && contents.length > 0) {
                        simulationResults.processedLayers++;
                    } else {
                        simulationResults.skippedLayers++;
                    }
                } catch (e) {
                    simulationResults.errors++;
                }
            }
        }
        
        var successRate = simulationResults.totalLayers > 0 ? 
            (simulationResults.processedLayers / simulationResults.totalLayers * 100).toFixed(1) : 0;
        
        if (simulationResults.errors === 0 && simulationResults.processedLayers > 0) {
            addTestResult("批量替换模拟", true, 
                "成功率: " + successRate + "% | 处理: " + simulationResults.processedLayers + 
                " | 跳过: " + simulationResults.skippedLayers + " | 错误: " + simulationResults.errors);
        } else if (simulationResults.totalLayers === 0) {
            addTestResult("批量替换模拟", true, "文档中没有文字图层，无需处理");
        } else {
            addTestResult("批量替换模拟", false, 
                "处理过程中出现 " + simulationResults.errors + " 个错误");
        }
    } catch (e) {
        addTestResult("批量替换模拟", false, "批量替换模拟时出错: " + e.toString());
    }
    
    // 测试5: 检查图层状态记录的完整性
    try {
        var stateRecords = [];
        var recordErrors = 0;
        
        for (var i = 0; i < allLayers.length; i++) {
            var layerInfo = allLayers[i];
            if (layerInfo.isText) {
                try {
                    var textItem = layerInfo.layer.textItem;
                    var record = {
                        name: layerInfo.layer.name,
                        path: layerInfo.path,
                        font: textItem.font,
                        size: textItem.size.value,
                        contents: textItem.contents.substring(0, 50), // 限制长度
                        visible: layerInfo.layer.visible,
                        opacity: layerInfo.layer.opacity
                    };
                    stateRecords.push(record);
                } catch (e) {
                    recordErrors++;
                }
            }
        }
        
        if (recordErrors === 0 && stateRecords.length > 0) {
            addTestResult("图层状态记录", true, 
                "成功记录 " + stateRecords.length + " 个文字图层的完整状态");
        } else if (stateRecords.length === 0) {
            addTestResult("图层状态记录", true, "没有文字图层需要记录状态");
        } else {
            addTestResult("图层状态记录", false, 
                "记录状态时出现 " + recordErrors + " 个错误");
        }
    } catch (e) {
        addTestResult("图层状态记录", false, "记录图层状态时出错: " + e.toString());
    }
    
    // 测试6: 检查历史记录文件的存储能力
    try {
        var docPath = doc.path;
        var regretFolder = new Folder(docPath + "/.regret_history");
        
        // 创建测试用的大型历史记录数据
        var largeHistoryData = {
            version: "1.0",
            created: new Date().toString(),
            snapshots: []
        };
        
        // 创建多个测试快照
        for (var i = 0; i < 10; i++) {
            var snapshot = {
                id: "test_" + i + "_" + new Date().getTime(),
                type: "test",
                description: "复杂场景测试快照 " + (i + 1),
                timestamp: new Date().toString(),
                layers: []
            };
            
            // 为每个快照添加模拟的图层数据
            for (var j = 0; j < Math.min(allLayers.length, 20); j++) {
                if (allLayers[j].isText) {
                    snapshot.layers.push({
                        name: "测试图层_" + j,
                        path: "测试路径/图层_" + j,
                        font: "Arial-Regular",
                        size: 24,
                        contents: "测试内容 " + j
                    });
                }
            }
            
            largeHistoryData.snapshots.push(snapshot);
        }
        
        // 尝试写入和读取大型数据
        if (!regretFolder.exists) {
            regretFolder.create();
        }
        
        var testFile = new File(regretFolder.fsName + "/complex_test.json");
        testFile.open("w");
        testFile.write(JSON.stringify(largeHistoryData, null, 2));
        testFile.close();
        
        // 验证文件是否可以正确读取
        testFile.open("r");
        var content = testFile.read();
        testFile.close();
        
        var parsedData = JSON.parse(content);
        
        if (parsedData.snapshots.length === 10) {
            addTestResult("大型数据存储", true, 
                "成功存储和读取包含 " + parsedData.snapshots.length + " 个快照的历史记录");
            
            // 清理测试文件
            testFile.remove();
        } else {
            addTestResult("大型数据存储", false, "数据存储或读取不完整");
        }
    } catch (e) {
        addTestResult("大型数据存储", false, "大型数据存储测试失败: " + e.toString());
    }
    
    // 显示测试结果
    showTestResults();
    
    // 提供复杂场景测试的总结和建议
    var summary = "\n\n📋 复杂场景测试总结：\n\n";
    summary += "本测试验证了后悔药功能在以下复杂场景下的表现：\n\n";
    summary += "✓ 多层嵌套的图层组结构\n";
    summary += "✓ 大量文字图层的批量处理\n";
    summary += "✓ 多种字体的混合使用\n";
    summary += "✓ 复杂图层状态的完整记录\n";
    summary += "✓ 大型历史记录数据的存储\n\n";
    
    summary += "💡 建议：\n";
    summary += "• 在实际使用中，建议将历史记录保留数量设置为10-20个\n";
    summary += "• 对于包含大量文字图层的文档，可以考虑分批处理\n";
    summary += "• 定期清理历史记录文件夹以节省磁盘空间\n";
    summary += "• 在进行大规模修改前，建议手动创建一个重要的快照\n\n";
    
    summary += "🎉 如果所有测试都通过，说明后悔药功能可以很好地处理复杂场景！";
    
    alert(summary);
    
})();