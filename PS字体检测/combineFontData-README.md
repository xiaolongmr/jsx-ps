# 字体信息文件合并工具

## 工具介绍

这是一个专门用于合并多个字体信息文本文件为单一JSON格式的Node.js工具。该工具能够准确处理各种格式问题，并确保生成的数据与名称文件严格对应。

**作者：** 小张  
**博客：** [https://blog.z-l.top/](https://blog.z-l.top/)  
**GitHub：** [https://github.com/xiaolongmr](https://github.com/xiaolongmr)

## 功能特点

- **自动数据合并**：将分散在多个文本文件中的字体信息自动合并为统一的JSON格式
- **简化的配置方式**：通过单一的`outputStructure`配置数组，同时控制字段顺序和嵌套结构
- **灵活的特殊字段处理**：支持通过`specialFieldProcessors`配置对特定字段进行自定义处理（如URL拼接等）
- **智能数据校验**：自动检查所有文件的行数一致性，确保数据完整性
- **友好的日志输出**：显示每个文件的读取状态、行数信息等
- **完善的错误处理**：针对文件读取失败、保存失败等异常情况提供明确的错误提示

## 工作原理

工具通过以下步骤完成数据合并：

1. 读取所有字体信息相关的文本文件
2. 统计每个文件的原始行数，并进行比较验证
3. 对每一行内容进行格式清理（移除引号、多余空白等）
4. 按照名称文件的顺序和原始行数进行数据合并
5. 将合并后的数据保存为格式化的JSON文件

## 使用方法

### 前提条件

- 已安装Node.js运行环境
- 确保所有字体信息文件已放置在正确位置

### 执行步骤

1. 进入工具所在目录
2. 运行以下命令：

```bash
node combineFontData.js
```

3. 工具执行完成后，将在当前目录生成名为"免费字体信息.json"的文件

### 输出信息

执行过程中，工具会输出以下信息：

- 每个文件的原始行数和非空行数
- 行数不一致的警告（如有）
- 生成的JSON文件位置和合并的字体信息数量

## 文件结构要求

工具期望在"免费字体信息"目录下存在以下文件：

- **免费字体在PS中名称.txt**：字体在Photoshop中的名称列表
- **免费字体字体系列.txt**：字体系列信息列表
- **免费字体字重数.txt**：字重数信息列表
- **免费字体开发者.txt**：字体开发者信息列表
- **免费字体分类.txt**：字体分类信息列表
- **免费字体授权方式.txt**：字体授权方式信息列表
- **免费字体授权方式 Url.txt**：字体授权方式详细链接列表
- **免费字体发布时间.txt**：字体发布时间信息列表
- **免费字体最新版本.txt**：字体最新版本信息列表
- **免费字体简体字数.txt**：字体简体字数信息列表
- **免费字体猫啃网链接.txt**：字体在猫啃网上的下载链接列表

> **注意**：所有文件中的数据必须按顺序一一对应

## JSON数据结构

生成的JSON文件包含一个字体信息对象数组，每个对象包含以下字段：

```json
{
  "fontPsName": "字体在PS中的名称",
  "fontFamily": "字体系列",
  "fontWeight": "字重数",
  "creator": "字体开发者",
  "category": "字体分类",
  "license": {
    "value": "授权方式",
    "licenseUrl": "授权方式链接"
  },
  "releaseDate": "发布时间",
  "version": "最新版本",
  "simplifiedCharCount": "简体字数",
  "url": "下载链接"
}
```

### 字段说明

| 字段名 | 说明 | 对应文本文件 |
|-------|------|------------|
| fontPsName | 字体在PS中的名称 | 免费字体在PS中名称.txt |
| fontFamily | 字体系列 | 免费字体字体系列.txt |
| fontWeight | 字重数 | 免费字体字重数.txt |
| creator | 字体开发者 | 免费字体开发者.txt |
| category | 字体分类 | 免费字体分类.txt |
| releaseDate | 发布时间 | 免费字体发布时间.txt |
| version | 最新版本 | 免费字体最新版本.txt |
| simplifiedCharCount | 简体字数 | 免费字体简体字数.txt |
| license | 授权方式（可包含嵌套子字段） | 免费字体授权方式.txt |
| licenseUrl | 授权方式链接（通常作为license的子字段） | 免费字体授权方式 Url.txt |
| url | 下载链接 | 免费字体猫啃网链接.txt

## 技术说明

### 技术说明

#### 行数处理机制

- 工具使用文件的原始行数进行比较，而不是过滤空行后的行数
- 即使某些文件包含空行，工具也能正确处理并生成完整的JSON数据
- 合并操作始终以"免费字体在PS中名称.txt"文件（对应fontPsName字段）的行数为基准

#### 输出结构配置

通过`outputStructure`配置，您可以灵活控制JSON输出的字段顺序和嵌套结构，支持多种嵌套模式。

**配置格式说明：**
- **简单字段**：直接写字段名
- **子字段嵌套**：将某些字段作为父字段的子字段，使用对象形式
- **分组嵌套**：将字体按指定字段值分组，创建更有组织的数据结构
- **多层分组嵌套**：支持无限层级的嵌套分组，实现更复杂的数据组织

**配置示例 - 普通嵌套：**

```javascript
const outputStructure = [
    fieldNames.fontPsName,   // 字体名称
    fieldNames.fontFamily,   // 字体系列
    fieldNames.creator,      // 开发者
    fieldNames.releaseDate,  // 发布时间
    fieldNames.version,      // 最新版本
    fieldNames.fontWeight,   // 字重数
    {                        // 授权方式(子字段嵌套结构)
        type: 'nested',      // 嵌套类型
        field: fieldNames.license,  // 父字段
        children: [fieldNames.licenseUrl]  // 子字段列表
    },
    fieldNames.url           // 下载链接
];
```

**配置示例 - 按分类分组：**

```javascript
const outputStructure = {
    type: 'group',           // 分组类型
    field: fieldNames.category,  // 分组字段
    children: [              // 每个分组内的字段结构
        fieldNames.fontPsName,
        fieldNames.fontFamily,
        fieldNames.creator,
        fieldNames.releaseDate,
        fieldNames.version,
        fieldNames.fontWeight,
        {
            type: 'nested',
            field: fieldNames.license,
            children: [fieldNames.licenseUrl]
        },
        fieldNames.url
    ]
};
```

**配置示例 - 多层分组嵌套：**

多层分组嵌套支持无限层级的嵌套分组，使字体分类更加细化和有层次感。

```javascript
const outputStructure = {
    type: 'group',           // 第一层分组
    field: fieldNames.category,  // 按字体分类分组
    children: [
        {
            type: 'group',       // 第二层分组
            field: fieldNames.fontFamily,  // 按字体系列分组
            children: [          // 字体信息字段结构
                fieldNames.fontPsName,
                fieldNames.creator,
                fieldNames.releaseDate,
                fieldNames.version,
                fieldNames.fontWeight,
                fieldNames.simplifiedCharCount,
                {
                    type: 'nested',
                    field: fieldNames.license,
                    children: [fieldNames.licenseUrl]
                },
                fieldNames.url
            ]
        }
    ]
};
```

这样配置后，输出的JSON将按以下结构组织：
1. 第一层：按字体分类(category)分组
2. 第二层：在每个分类内，按字体系列(fontFamily)分组
3. 第三层：在每个字体系列内，包含具体字体信息

**配置示例 - 按字体开发者分组：**

按字体开发者(creator)进行分组，方便查看特定开发者的所有字体作品：

```javascript
const outputStructure = {
    type: 'group',           // 分组类型
    field: fieldNames.creator,  // 按开发者分组
    children: [              // 每个开发者下的字体结构
        fieldNames.fontPsName,
        fieldNames.fontFamily,
        fieldNames.category,
        fieldNames.releaseDate,
        fieldNames.version,
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
```

**配置示例 - 按发布时间年份分组：**

按发布时间(releaseDate)进行分组，可以快速查找特定年份发布的字体：

```javascript
const outputStructure = {
    type: 'group',           // 分组类型
    field: fieldNames.releaseDate,  // 按发布时间分组
    children: [              // 每个时间分组下的字体结构
        fieldNames.fontPsName,
        fieldNames.fontFamily,
        fieldNames.category,
        fieldNames.creator,
        fieldNames.version,
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
```

**配置示例 - 三层嵌套分组：**

实现三层嵌套分组，进一步细化字体分类：

```javascript
const outputStructure = {
    type: 'group',           // 第一层分组
    field: fieldNames.category,  // 按字体分类分组
    children: [
        {
            type: 'group',       // 第二层分组
            field: fieldNames.creator,  // 按开发者分组
            children: [
                {
                    type: 'group',   // 第三层分组
                    field: fieldNames.fontFamily,  // 按字体系列分组
                    children: [      // 字体信息字段
                        fieldNames.fontPsName,
                        fieldNames.releaseDate,
                        fieldNames.version,
                        fieldNames.fontWeight,
                        fieldNames.simplifiedCharCount,
                        {
                            type: 'nested',
                            field: fieldNames.license,
                            children: [fieldNames.licenseUrl]
                        },
                        fieldNames.url
                    ]
                }
            ]
        }
    ]
};
```

**配置示例 - 混合多种嵌套方式：**

结合多种嵌套方式，创建复杂而灵活的字体数据结构：

```javascript
const outputStructure = {
    type: 'group',           // 顶层按分类分组
    field: fieldNames.category,
    children: [
        // 基本信息子字段嵌套
        {
            type: 'nested',
            field: 'basicInfo',
            children: [fieldNames.fontPsName, fieldNames.fontFamily, fieldNames.creator]
        },
        // 技术信息子字段嵌套
        {
            type: 'nested',
            field: 'technicalInfo',
            children: [fieldNames.fontWeight, fieldNames.simplifiedCharCount]
        },
        // 时间信息子字段嵌套
        {
            type: 'nested',
            field: 'timeInfo',
            children: [fieldNames.releaseDate, fieldNames.version]
        },
        // 授权信息子字段嵌套
        {
            type: 'nested',
            field: fieldNames.license,
            children: [fieldNames.licenseUrl]
        },
        // 下载链接作为普通字段
        fieldNames.url
    ]
};
```

这种配置可以将相关字段组织到不同的信息块中，使数据结构更加清晰和结构化。

**生成的JSON示例 - 普通嵌套：**

```json
{
  "fontPsName": "字体名称",
  "fontFamily": "字体系列",
  "creator": "开发者",
  "releaseDate": "发布时间",
  "version": "版本",
  "fontWeight": "字重数",
  "license": {
    "value": "授权方式值",
    "licenseUrl": "授权链接值"
  },
  "url": "下载链接"
}
```

**生成的JSON示例 - 分组嵌套：**

```json
[
  {
    "category": "创意",
    "fonts": [
      {
        "fontPsName": "字体名称1",
        "fontFamily": "字体系列1",
        "creator": "开发者1",
        "releaseDate": "发布时间1",
        "version": "版本1",
        "fontWeight": "字重数1",
        "license": {
          "value": "授权方式1",
          "licenseUrl": "授权链接1"
        },
        "url": "下载链接1"
      },
      // 更多该分类下的字体
    ]
  },
  {
    "category": "手写",
    "fonts": [
      // 该分类下的字体
    ]
  }
]

#### 特殊字段处理

通过`specialFieldProcessors`配置，可以为特定字段添加自定义处理逻辑：

```javascript
const specialFieldProcessors = {
    [fieldNames.url]: (value) => value ? "https://www.maoken.com" + value : "",
    // 可以在这里添加其他需要特殊处理的字段
};
```

当需要为其他字段添加特殊处理时，只需在这里添加相应的处理器函数。

#### 当前支持的字段

- fontPsName（字体名称）
- fontFamily（字体系列）
- fontWeight（字重数）
- creator（开发者）
- category（字体分类）
- releaseDate（发布时间）
- version（版本）
- simplifiedCharCount（简体字数）
- license（授权方式，可嵌套）
- licenseUrl（授权方式链接，作为license的子字段）
- url（下载链接）

### 格式清理功能

- 自动移除行首尾的空白字符
- 智能处理引号：移除行首尾可能存在的引号
- 保留原始数据的完整性，同时确保格式统一

### 数据安全处理

- 对每个字段进行安全访问检查，避免因数组越界导致的错误
- 对于缺失的数据，使用空字符串进行填充，保证JSON结构的完整性
- 详细的错误日志输出，便于调试和问题定位

## 故障排除

### 常见问题

1. **文件不存在错误**
   - 确保所有必需的文本文件都已放置在正确的目录下
   - 检查文件名是否正确（包括中文文件名）

2. **行数不一致警告**
   - 虽然有警告，但工具仍会生成JSON文件
   - 警告仅用于提示数据可能不完整，请检查源文件

3. **编码问题**
   - 确保所有源文件都使用UTF-8编码保存
   - 工具会自动使用UTF-8编码进行文件读写

## 更新日志

- **1.0.0**：初始版本，基本合并功能
- **1.0.1**：添加格式清理功能，修复引号处理问题
- **1.0.2**：改进行数统计机制，使用原始行数进行比较
- **1.0.3**：增强错误处理，优化数据安全访问

## 许可证

本工具遵循MIT许可证，欢迎使用和修改。

---

*如有任何问题或建议，请联系作者。*