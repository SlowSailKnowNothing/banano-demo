/**
 * OpenRouter API 调用工具
 */

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      // 某些模型返回 string，某些返回多模态分块数组
      content: any;
      role?: string;
    };
    finish_reason?: string;
  }>;
  id?: string;
  model?: string;
  // 某些模型会把图片放在顶层 images 字段
  images?: Array<{
    type?: string;
    image_url?: { url?: string } | string;
    b64_json?: string;
  }>;
}

/**
 * 将返回体做安全摘要，避免把超长 base64 打到控制台
 */
function summarizeContentForLog(content: any) {
  try {
    if (typeof content === 'string') {
      return {
        kind: 'string',
        length: content.length,
        preview: content.slice(0, 220),
      };
    }
    if (Array.isArray(content)) {
      return {
        kind: 'array',
        length: content.length,
        items: content.slice(0, 5).map((part: any, idx: number) => ({
          index: idx,
          type: part?.type,
          keys: part ? Object.keys(part) : [],
          preview:
            (part?.text ?? part?.image_url?.url ?? part?.image_url ?? '')
              ?.toString()
              .slice(0, 200),
        })),
      };
    }
    if (content && typeof content === 'object') {
      return { kind: 'object', keys: Object.keys(content) };
    }
    return { kind: typeof content };
  } catch (e) {
    return { kind: 'unknown', error: String(e) };
  }
}

function logOpenRouterSummary(tag: string, response: Response, data: any) {
  try {
    const choice = data?.choices?.[0];
    const message = choice?.message;
    const summary = summarizeContentForLog(message?.content);
    console.log(`[OpenRouter][${tag}]`, {
      status: response?.status,
      contentType: response?.headers?.get?.('content-type'),
      model: data?.model,
      choices: Array.isArray(data?.choices) ? data.choices.length : undefined,
      finish_reason: choice?.finish_reason,
      messageRole: message?.role,
      contentSummary: summary,
    });
  } catch (e) {
    console.warn('[OpenRouter] 调试摘要失败:', e);
  }
}

/**
 * 调用OpenRouter API进行文本生成
 */
export async function generateText(
  apiKey: string, 
  prompt: string,
  model: string = 'openrouter/sonoma-sky-alpha'
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://banano-demo.vercel.app', // 你的网站URL
      'X-Title': 'AI-Storyboard-Generator', // 站点名称（必须为 ASCII）
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API 错误: ${response.status} ${response.statusText}`);
  }

  const data: OpenRouterResponse = await response.json();
  logOpenRouterSummary('text', response, data);
  return data.choices[0]?.message?.content || '';
}

/**
 * 调用OpenRouter API进行图片生成（使用Gemini 2.5 Flash Image Preview）
 */
export async function generateImage(
  apiKey: string,
  prompt: string,
  referenceImageBase64?: string,
  model: string = 'google/gemini-2.5-flash-image-preview'
): Promise<string> {
  const messages: OpenRouterMessage[] = [
    {
      role: 'user',
      content: []
    }
  ];

  // 添加文本提示
  messages[0].content.push({
    type: 'text',
    text: prompt
  });

  // 如果有参考图片，添加到消息中
  if (referenceImageBase64) {
    messages[0].content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${referenceImageBase64}`
      }
    });
  }

  // 请求摘要日志（不包含密钥和完整 prompt）
  try {
    console.log('[OpenRouter][image] request', {
      model,
      hasReferenceImage: Boolean(referenceImageBase64),
      textPartLength: prompt?.length ?? 0,
      textPreview: String(prompt).slice(0, 160),
      contentItems: messages?.[0]?.content?.length ?? 0,
    });
  } catch {}

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://banano-demo.vercel.app', // 你的网站URL
      'X-Title': 'AI-Storyboard-Generator', // 站点名称（必须为 ASCII）
    },
    body: JSON.stringify({
      model: model,
      messages: messages
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API 错误: ${response.status} ${response.statusText}`);
  }

  const data: OpenRouterResponse = await response.json();
  logOpenRouterSummary('image', response, data);

  // 情况 0：顶层 images 字段（有些模型把图片放在这里）
  if (Array.isArray(data?.images) && data.images.length > 0) {
    try {
      console.log('[OpenRouter][image] found top-level images', data.images.slice(0, 1));
    } catch {}
    const first = data.images[0];
    const imgUrl = (first?.image_url as any)?.url ?? (typeof (first as any)?.image_url === 'string' ? (first as any).image_url : undefined);
    if (typeof imgUrl === 'string') {
      if (imgUrl.startsWith('data:image') || imgUrl.startsWith('http')) {
        return imgUrl;
      }
      if (imgUrl.length > 1000) {
        return `data:image/png;base64,${imgUrl}`;
      }
    }
    const b64 = (first as any)?.b64_json;
    if (typeof b64 === 'string' && b64.length > 1000) {
      return `data:image/png;base64,${b64}`;
    }
  }

  // 情况 0.1：choices[0].message.images（你 curl 的结构）
  try {
    const msg: any = data?.choices?.[0]?.message;
    if (Array.isArray(msg?.images) && msg.images.length > 0) {
      console.log('[OpenRouter][image] found message.images', msg.images.slice(0, 1));
      const first = msg.images[0];
      const imgUrl = first?.image_url?.url ?? (typeof first?.image_url === 'string' ? first?.image_url : undefined);
      if (typeof imgUrl === 'string') {
        if (imgUrl.startsWith('data:image') || imgUrl.startsWith('http')) {
          return imgUrl;
        }
        if (imgUrl.length > 1000) {
          return `data:image/png;base64,${imgUrl}`;
        }
      }
      const b64 = (first as any)?.b64_json;
      if (typeof b64 === 'string' && b64.length > 1000) {
        return `data:image/png;base64,${b64}`;
      }
    }
  } catch {}

  // 附加：打印 content 的类型与前缀，便于快速判断
  try {
    const c: any = data?.choices?.[0]?.message?.content;
    const head = typeof c === 'string' ? c.slice(0, 50) : Array.isArray(c) ? c.map((p: any) => p?.type || Object.keys(p || {})).join(',').slice(0, 120) : typeof c;
    console.log('[OpenRouter][image] content type', { type: typeof c, isArray: Array.isArray(c), head });
  } catch {}

  // 兼容多模态 content：可能是 string 或 数组
  const content: any = data?.choices?.[0]?.message?.content ?? '';

  // 情况 A：直接字符串
  if (typeof content === 'string') {
    if (content.includes('data:image')) {
      return content;
    }
    if (content.includes('base64') && content.length > 1000) {
      return `data:image/png;base64,${content}`;
    }
    // 打印完整文本（限制到 5000 字）帮助定位
    try {
      console.log('[OpenRouter][image] raw string content', {
        length: content.length,
        preview5000: content.slice(0, 5000),
      });
    } catch {}
    throw new Error(`OpenRouter可能未返回图片数据。返回文本: ${content.slice(0, 200)}...`);
  }

  // 情况 B：数组分块（常见于多模态）
  if (Array.isArray(content)) {
    try {
      console.log('[OpenRouter][image] raw array content (first 5 items)', content.slice(0, 5));
    } catch {}
    for (const part of content) {
      if (part?.type === 'image_url' || part?.type === 'output_image' || part?.type === 'image') {
        const url = part?.image_url?.url ?? part?.image_url;
        if (typeof url === 'string' && (url.startsWith('data:image') || url.startsWith('http'))) {
          return url;
        }
        const b64 = part?.b64_json || part?.image_base64 || part?.data;
        if (typeof b64 === 'string' && b64.length > 1000) {
          return `data:image/png;base64,${b64}`;
        }
      }
    }

    const textPreview = content
      .map((p: any) => p?.text)
      .filter(Boolean)
      .join('\n')
      .slice(0, 200);
    throw new Error(`模型返回多模态分块，但未包含图片。说明: ${textPreview}...`);
  }

  throw new Error('未能从模型响应中解析出图片数据。');
}

/**
 * 从图片URL提取base64数据
 */
export async function getBase64FromImageUrl(url: string): Promise<{ base64: string; mimeType: string }> {
  // data URL 直接解析
  if (url.startsWith('data:')) {
    const commaIdx = url.indexOf(',');
    const header = url.substring(5, url.indexOf(';'));
    const mimeType = header;
    const base64 = url.substring(commaIdx + 1);
    return { base64, mimeType };
  }
  
  // blob/object URL：先拉取为 Blob，再转 dataURL
  const res = await fetch(url);
  const blob = await res.blob();
  const mimeType = blob.type || 'image/png';
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return { base64, mimeType };
}