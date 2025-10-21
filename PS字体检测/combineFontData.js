/**
 * 字体信息文件合并工具
 * 功能：将多个字体信息文本文件合并为单一JSON格式
 * 作者：小张
 * 博客：https://blog.z-l.top/
 * GitHub：https://github.com/xiaolongmr
 */

const fs = require('fs');
const path = require('path');

// 配置部分 - 用户可自定义
// 字段名称配置 - 使用驼峰命名法，符合互联网大厂编码规范
const fieldNames = {
    fontPsName: "fontPsName",    // 字体在PS中的名称
    fontFamily: "fontFamily",    // 字体系列
    fontWeight: "fontWeight",    // 字重数
    creator: "creator",          // 字体开发者
    releaseDate: "releaseDate",  // 发布时间
    version: "version",          // 最新版本
    license: "license",          // 授权方式
    licenseUrl: "licenseUrl",    // 授权方式链接
    url: "url",                  // 下载链接
    category: "category",        // 字体分类
    simplifiedCharCount: "simplifiedCharCount" // 简体字数
};

// 输出结构配置
// 支持多层嵌套分组，实现复杂的数据组织
// 示例：按开发者分组
const outputStructure = {
    type: 'group',
    field: fieldNames.fontPsName,
    children: [
        fieldNames.fontFamily,
        fieldNames.creator,
        fieldNames.releaseDate,
        fieldNames.version,
        fieldNames.category,
        fieldNames.fontWeight,
        fieldNames.simplifiedCharCount,
        {
            type: 'nested',
            field: fieldNames.license,
            children: [fieldNames.licenseUrl]
        },
        fieldNames.url
    ]
};

// 文件路径设置 - 使用相对路径提高代码可移植性
const basePath = path.resolve(__dirname, "免费字体信息/");
const files = {
    [fieldNames.fontPsName]: path.resolve(basePath, "免费字体在PS中名称.txt"),
    [fieldNames.fontFamily]: path.resolve(basePath, "免费字体字体系列.txt"),
    [fieldNames.fontWeight]: path.resolve(basePath, "免费字体字重数.txt"),
    [fieldNames.creator]: path.resolve(basePath, "免费字体开发者.txt"),
    [fieldNames.releaseDate]: path.resolve(basePath, "免费字体发布时间.txt"),
    [fieldNames.version]: path.resolve(basePath, "免费字体最新版本.txt"),
    [fieldNames.license]: path.resolve(basePath, "免费字体授权方式.txt"),
    [fieldNames.licenseUrl]: path.resolve(basePath, "免费字体授权方式 Url.txt"),
    [fieldNames.url]: path.resolve(basePath, "免费字体猫啃网链接.txt"),
    [fieldNames.category]: path.resolve(basePath, "免费字体分类.txt"),
    [fieldNames.simplifiedCharCount]: path.resolve(basePath, "免费字体简体字数.txt")
};

// 特殊字段处理配置 - 用于处理需要特殊格式化或处理的字段
const specialFieldProcessors = {
    [fieldNames.url]: (value) => value ? "https://www.maoken.com" + value : "",
    // 可以在这里添加其他需要特殊处理的字段
};

// 读取所有文件内容
const fileContents = {};
const rawLineCounts = {}; // 存储原始行数

for (const key in files) {
    try {
        // 明确指定utf-8编码读取文件
        const content = fs.readFileSync(files[key], { encoding: 'utf-8' });
        const rawLines = content.split('\n');
        rawLineCounts[key] = rawLines.length;

        fileContents[key] = rawLines
            .map(line => {
                // 清理行内容，移除可能的引号和空白字符
                let cleaned = line.trim();
                // 移除首尾可能的引号
                if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                    cleaned = cleaned.substring(1, cleaned.length - 1);
                } else if (cleaned.startsWith('"')) {
                    cleaned = cleaned.substring(1);
                } else if (cleaned.endsWith('"')) {
                    cleaned = cleaned.substring(0, cleaned.length - 1);
                }
                return cleaned.trim();
            });
        // 注意：我们不再过滤空行，而是在后续处理中处理

        console.log(`已读取${key}文件，原始行数: ${rawLineCounts[key]}，非空行数: ${fileContents[key].filter(line => line !== '').length}`);
    } catch (error) {
        console.error(`读取文件失败：${files[key]}`, error.message);
        process.exit(1);
    }
}

// 检查文件行数是否一致，以fontPsName文件的原始行数为基准
const nameKey = fieldNames.fontPsName;
const nameRawLength = rawLineCounts[nameKey];
let allSameLength = true;
for (const key in rawLineCounts) {
    if (rawLineCounts[key] !== nameRawLength) {
        allSameLength = false;
        console.warn(`警告：${key}文件原始行数(${rawLineCounts[key]})与名称文件(${nameRawLength})不一致！`);
    }
}

if (!allSameLength) {
    console.warn("文件原始行数不一致，但将确保生成的JSON数据与名称文件行数完全一致");
}

// 合并数据为JSON格式，支持自定义输出结构
const fontData = [];

// 处理输出结构的函数 - 支持多层嵌套分组和子字段嵌套
function processOutputStructure(structure, targetObj, index) {
    // 处理分组嵌套 - 注意：分组嵌套在递归处理时会被专门处理
    // 这里只处理子字段嵌套和普通字段

    // 处理子字段嵌套
    if (typeof structure === 'object' && structure.type === 'nested') {
        const parentField = structure.field;
        const childFields = structure.children;

        // 创建父字段对象
        const parentObj = {};

        // 设置父字段的值
        const parentValue = (fileContents[parentField] && fileContents[parentField][index]) ?
            fileContents[parentField][index] : "";
        parentObj.value = parentValue;

        // 添加所有子字段
        if (Array.isArray(childFields)) {
            childFields.forEach(childField => {
                // 递归处理子字段，可能也是嵌套结构
                processOutputStructure(childField, parentObj, index);
            });
        }

        targetObj[parentField] = parentObj;
    }
    // 处理普通字段
    else if (typeof structure === 'string') {
        const fieldKey = structure;
        let fieldValue = (fileContents[fieldKey] && fileContents[fieldKey][index]) ?
            fileContents[fieldKey][index] : "";

        // 应用特殊字段处理器（如果有）
        if (specialFieldProcessors[fieldKey]) {
            fieldValue = specialFieldProcessors[fieldKey](fieldValue);
        }

        targetObj[fieldKey] = fieldValue;
    }
    // 处理数组
    else if (Array.isArray(structure)) {
        structure.forEach(item => {
            processOutputStructure(item, targetObj, index);
        });
    }
    // 处理分组嵌套 - 注意：这种情况实际上在递归处理时不会被触发，因为分组嵌套在更高层次被单独处理
    // 但为了代码的完整性，这里保留这个条件分支
    else if (typeof structure === 'object' && structure.type === 'group') {
        // 分组嵌套在更高层次处理，这里不直接处理
        return;
    }
}

// 递归处理嵌套分组结构
function processNestedGrouping(structure, items, index) {
    // 检查当前结构是否为分组
    if (typeof structure === 'object' && structure.type === 'group') {
        const groupField = structure.field;
        const childrenStructure = structure.children;

        // 为当前索引创建分组键
        const groupKey = (fileContents[groupField] && fileContents[groupField][index]) ?
            fileContents[groupField][index] : "未分类";

        // 查找或创建当前分组
        let currentGroup = items.find(item => item[groupField] === groupKey);
        if (!currentGroup) {
            currentGroup = {
                [groupField]: groupKey,
                fonts: []
            };
            items.push(currentGroup);
        }

        // 检查子结构是否也包含分组
        const hasChildGrouping = Array.isArray(childrenStructure) &&
            childrenStructure.some(child => typeof child === 'object' &&
                child.type === 'group');

        if (hasChildGrouping) {
            // 存在子分组，递归处理
            const childGroupStructure = childrenStructure.find(child => typeof child === 'object' &&
                child.type === 'group');

            // 递归处理下一级分组
            processNestedGrouping(childGroupStructure, currentGroup.fonts, index);
        } else {
            // 没有子分组，创建字体对象并添加到当前分组
            const font = {};
            processOutputStructure(childrenStructure, font, index);
            currentGroup.fonts.push(font);
        }
    } else {
        // 如果不是分组结构，直接创建字体对象
        const font = {};
        processOutputStructure(structure, font, index);
        items.push(font);
    }
}

// 以fontPsName文件的原始行数为基准进行合并
if (outputStructure.type === 'group') {
    // 处理多层嵌套分组模式
    for (let i = 0; i < nameRawLength; i++) {
        processNestedGrouping(outputStructure, fontData, i);
    }
} else {
    // 处理普通嵌套模式
    for (let i = 0; i < nameRawLength; i++) {
        const font = {};

        // 使用处理函数构建字体对象
        processOutputStructure(outputStructure, font, i);

        fontData.push(font);
    }
}

// 将JSON保存到文件
const jsonContent = JSON.stringify(fontData, null, 2);
const outputFile = path.resolve(__dirname, "猫啃网免费字体合集.json");

try {
    // 明确指定utf-8编码写入文件
    fs.writeFileSync(outputFile, jsonContent, { encoding: 'utf-8' });
    console.log(`成功生成JSON文件！共合并${fontData.length}条字体信息。`);
    console.log(`文件位置：${outputFile}`);
} catch (error) {
    console.error("保存文件失败：", error.message);
    process.exit(1);
}