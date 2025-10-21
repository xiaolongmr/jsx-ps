#target photoshop
app.bringToFront();

(function () {

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

    function replaceFont(layers, newFontPS, logList) {
        var count = 0;
        for (var i = 0; i < layers.length; i++) {
            try {
                layers[i].textItem.font = newFontPS;
                count++;
                logList.add("item", "已替换图层：" + layers[i].name + " → " + newFontPS);
            } catch (e) {
                logList.add("item", "替换失败图层：" + layers[i].name + "，错误：" + e.message);
            }
        }
        return count;
    }

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
    function fontViewerAndReplacer() {
        if (!documents.length) { alert("请先打开 PSD 文件！"); return; }
        var doc = app.activeDocument;
        var textLayers = getAllTextLayers(doc);
        if (textLayers.length == 0) { alert("当前文档没有文字图层！"); return; }

        var systemFonts = getSystemFonts();

        // ====================== UI ======================
        var win = new Window("dialog", "文字图层字体查看与替换", undefined, { closeButton: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];

        // 文档字体显示
        win.add("statictext", undefined, "当前文档文字图层 PostScript 字体名（点击选择要替换的图层字体）:");

        var fontList = win.add("listbox", undefined, [], { multiselect: false });
        fontList.preferredSize = [500, 200];

        // 控制台日志
        win.add("statictext", undefined, "控制台日志:");
        var logList = win.add("listbox", undefined, [], { multiselect: true });
        logList.preferredSize = [500, 150];

        // 左侧列表显示每个文字图层的 PostScript 名称
        for (var i = 0; i < textLayers.length; i++) {
            var psName = textLayers[i].textItem.font;
            fontList.add("item", psName + " (" + textLayers[i].name + ")");
        }

        win.add("statictext", undefined, "选择替换字体：");

        var groupDropdown = win.add("group");
        groupDropdown.orientation = "row";

        // 字体家族下拉
        var familyNames = [];
        for (var f in systemFonts) { familyNames.push(f); }
        var familyDropdown = groupDropdown.add("dropdownlist", undefined, familyNames);
        familyDropdown.preferredSize = [250, 25];
        familyDropdown.selection = 0;

        // 字重下拉
        var styleDropdown = groupDropdown.add("dropdownlist", undefined, []);
        styleDropdown.preferredSize = [250, 25];
        styleDropdown.selection = 0;

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
        var replaceBtn = btnGroup.add("button", undefined, "替换选中字体");
        var cancelBtn = btnGroup.add("button", undefined, "查看替换效果");

        replaceBtn.onClick = function () {
            var selItem = fontList.selection;
            if (!selItem || !familyDropdown.selection || !styleDropdown.selection) {
                alert("请先选择要替换的字体，并选择新的字体和字重！");
                return;
            }

            var oldPS = selItem.text.split(" (")[0]; // 左边为 PostScript 名称
            var newPS = null;
            var arr = systemFonts[familyDropdown.selection.text];
            for (var i = 0; i < arr.length; i++) {
                if (arr[i].style == styleDropdown.selection.text) { newPS = arr[i].psName; break; }
            }
            if (!newPS) { alert("未找到新的 PostScript 名称！"); return; }

            // 修复：只替换选中的图层而不是所有相同字体的图层
            var layersToReplace = [];
            // 通过索引找到对应的文字图层
            for (var i = 0; i < fontList.items.length; i++) {
                if (fontList.items[i].selected) {
                    layersToReplace.push(textLayers[i]);
                    break;
                }
            }

            var count = replaceFont(layersToReplace, newPS, logList);
            alert("已替换 " + count + " 个文字图层的字体。");
        };

        cancelBtn.onClick = function () { win.close(); };

        win.show();
    }

    // ====================== 执行 ======================
    fontViewerAndReplacer();

})();