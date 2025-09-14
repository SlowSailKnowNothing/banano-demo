# OpenRouter API 迁移说明

本项目已成功从 Google GenAI 迁移到 OpenRouter API，以支持更多模型选择和更好的稳定性。

## 主要变更

### 1. API 调用方式
- **原来**: 使用 `@google/genai` 库
- **现在**: 使用标准的 `fetch` 请求调用 OpenRouter API

### 2. 支持的模型
- **文本生成**: `google/gemini-2.5-flash`
- **图片生成**: `google/gemini-2.5-flash-image-preview`

### 3. API Key 管理
- 需要使用 OpenRouter API Key (不是 Google API Key)
- 支持环境变量: `OPENROUTER_API_KEY`
- 支持本地存储用户自定义的 API Key

## 如何获取 OpenRouter API Key

1. 访问 [https://openrouter.ai](https://openrouter.ai)
2. 注册账户并登录
3. 购买积分 (Credits) 
4. 创建 API Key
5. 在应用中设置你的 API Key

## API 调用格式

项目现在使用以下调用格式：

```javascript
fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <OPENROUTER_API_KEY>",
    "HTTP-Referer": "https://banano-demo.vercel.app",
    "X-Title": "AI故事分镜生成器",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    "model": "google/gemini-2.5-flash-image-preview",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "What is in this image?"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"
            }
          }
        ]
      }
    ]
  })
});
```

## 修改的文件

1. **新增文件**:
   - `utils/openrouter.ts` - OpenRouter API 调用工具

2. **修改的文件**:
   - `components/ImageGenerator.tsx` - 图片生成组件
   - `components/StoryboardGenerator.tsx` - 分镜生成组件
   - `StoryApp.tsx` - 主应用组件
   - `package.json` - 移除 Google GenAI 依赖

3. **主要函数**:
   - `generateText()` - 文本生成
   - `generateImage()` - 图片生成
   - `getBase64FromImageUrl()` - 图片处理工具

## 优势

1. **更好的稳定性**: OpenRouter 提供分布式基础设施
2. **更多模型选择**: 支持多个AI模型提供商
3. **更好的价格**: 通过 OpenRouter 的优化定价
4. **统一接口**: 一个API访问多个模型

## 注意事项

1. OpenRouter 的图片生成功能可能与直接使用 Gemini API 略有不同
2. 需要确保有足够的积分来进行 API 调用  
3. 遵循 OpenRouter 的使用条款和限制

## 环境变量设置

如果要使用环境变量，请在 `.env.local` 文件中设置：

```
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

或者在生产环境中设置相应的环境变量。