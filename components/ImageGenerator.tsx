/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Palette, Download, RefreshCw } from 'lucide-react';
import { useState, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { ImageGeneratorProps, GeneratedImage, Storyboard } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function ImageGenerator({ 
  storyboards, 
  characterImage, 
  onImagesGenerated, 
  isLoading = false 
}: ImageGeneratorProps) {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentGenerating, setCurrentGenerating] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // 生成单个场景图片（带一次内部语义重试，非指数退避）
  const generateSingleImage = useCallback(async (storyboard: Storyboard): Promise<GeneratedImage> => {
    const prompt = `
基于提供的角色图片，生成一个新的场景图片。请保持角色的外观特征（发色、眼睛、服装风格等）完全一致。

场景信息：
- 场景描述: ${storyboard.description}
- 角色动作: ${storyboard.characterAction}
- 环境设定: ${storyboard.setting}
- 情感氛围: ${storyboard.mood}

艺术风格要求：
- 保持角色特征的一致性
- 插画风格，色彩丰富
- 适合儿童故事书的视觉效果
- 清晰的构图和良好的光影效果

请确保生成的图片中角色的外观与提供的参考图片保持高度一致。
`;

    try {
      // 将角色图片（可能是 dataURL 或 blob: URL）转换为 base64
      const getBase64FromImageUrl = async (url: string): Promise<{ base64: string; mimeType: string }> => {
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
      };

      const { base64: characterImageBase64, mimeType } = await getBase64FromImageUrl(characterImage);

      // 参考官方示例：文本 + 图片作为 parts 数组传入
      const promptParts = [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: characterImageBase64,
          },
        },
      ];

      let response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: promptParts as any,
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });
      
      // 查找返回的图片数据
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          const imageUrl = `data:image/png;base64,${imageData}`;
          
          return {
            id: `image-${storyboard.id}-${Date.now()}`,
            storyboardId: storyboard.id,
            imageUrl,
            prompt,
            generatedAt: new Date(),
          };
        }
      }
      // 如果没有拿到图片数据，尝试读取文本提示，并进行一次重试（更强指令 + 仅图像响应）
      const textParts: string[] = [];
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if ((part as any).text) textParts.push((part as any).text as string);
      }

      // 进行一次重试：明确要求仅返回图片
      const retryParts = [
        {
          text:
            `${prompt}\n\nIMPORTANT: Return only ONE image. Do not include any text in the response. Use the provided reference to keep character identity consistent.`,
        },
        {
          inlineData: {
            mimeType,
            data: characterImageBase64,
          },
        },
      ];

      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: retryParts as any,
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          const imageUrl = `data:image/png;base64,${imageData}`;
          return {
            id: `image-${storyboard.id}-${Date.now()}`,
            storyboardId: storyboard.id,
            imageUrl,
            prompt,
            generatedAt: new Date(),
          };
        }
      }

      const fallbackMsg = textParts.join('\n').slice(0, 300) || '无文本响应';
      throw new Error(`未收到图片数据（模型返回文本）：${fallbackMsg}`);
    } catch (error) {
      console.error('生成图片时出错:', error);
      throw error;
    }
  }, [characterImage]);

  // 带指数退避的重试封装
  const generateSingleImageWithRetry = useCallback(
    async (
      storyboard: Storyboard,
      maxRetries: number = 3,
      baseDelayMs: number = 800,
    ): Promise<GeneratedImage> => {
      let attempt = 0;
      while (true) {
        try {
          return await generateSingleImage(storyboard);
        } catch (e) {
          if (attempt >= maxRetries) {
            throw e;
          }
          const backoff = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
          await sleep(backoff);
          attempt += 1;
        }
      }
    },
    [generateSingleImage],
  );

  // 批量生成所有图片
  const generateAllImages = useCallback(async () => {
    if (!storyboards.length || !characterImage) return;

    setError(null);
    setProgress(0);
    setGeneratedImages([]);

    const newGeneratedImages: GeneratedImage[] = [];
    
    try {
      for (let i = 0; i < storyboards.length; i++) {
        const storyboard = storyboards[i];
        setCurrentGenerating(storyboard.id);
        
        try {
          const generatedImage = await generateSingleImageWithRetry(storyboard, 3, 800);
          newGeneratedImages.push(generatedImage);
          setGeneratedImages([...newGeneratedImages]);
          setProgress(((i + 1) / storyboards.length) * 100);
          
          // 每张成功后延迟 1s，进一步降低速率限制概率
          if (i < storyboards.length - 1) {
            await sleep(1000);
          }
        } catch (error) {
          console.error(`生成场景 ${storyboard.sceneNumber} 的图片时出错:`, error);
          // 继续生成其他图片，但记录错误
          setError(`场景 ${storyboard.sceneNumber} 生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      setCurrentGenerating(null);
      onImagesGenerated(newGeneratedImages);
      
    } catch (error) {
      console.error('批量生成图片时出错:', error);
      setError(error instanceof Error ? error.message : '批量生成时发生未知错误');
      setCurrentGenerating(null);
    }
  }, [storyboards, characterImage, generateSingleImage, onImagesGenerated]);

  // 重新生成单个图片
  const regenerateImage = useCallback(async (storyboard: Storyboard) => {
    setCurrentGenerating(storyboard.id);
    setError(null);
    
    try {
      const newImage = await generateSingleImage(storyboard);
      const updatedImages = generatedImages.map(img => 
        img.storyboardId === storyboard.id ? newImage : img
      );
      
      // 如果是新图片，添加到列表中
      if (!generatedImages.find(img => img.storyboardId === storyboard.id)) {
        updatedImages.push(newImage);
      }
      
      setGeneratedImages(updatedImages);
      onImagesGenerated(updatedImages);
    } catch (error) {
      console.error('重新生成图片时出错:', error);
      setError(`重新生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setCurrentGenerating(null);
    }
  }, [generatedImages, generateSingleImage, onImagesGenerated]);

  // 下载图片
  const downloadImage = useCallback((imageUrl: string, sceneNumber: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `story-scene-${sceneNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
          <Palette className="w-6 h-6 mr-2" />
          场景图片生成
        </h2>
        <p className="text-gray-600 text-sm">
          基于你的角色图片和故事分镜，生成一致的场景图片
        </p>
      </div>

      {/* 错误显示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">生成图片时出错</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* 生成按钮和进度 */}
      {generatedImages.length === 0 && !currentGenerating && (
        <div className="text-center mb-6">
          <button
            onClick={generateAllImages}
            disabled={isLoading || !characterImage}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium
                     hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
          >
            开始生成所有场景图片
          </button>
          <p className="text-sm text-gray-500 mt-2">
            将为 {storyboards.length} 个场景生成图片，预计需要 {storyboards.length * 2} 分钟
          </p>
        </div>
      )}

      {/* 生成进度 */}
      {currentGenerating && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="font-medium text-blue-800">
              正在生成场景图片... ({Math.round(progress)}%)
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 图片展示网格 */}
      {(generatedImages.length > 0 || storyboards.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {storyboards.map((storyboard) => {
            const generatedImage = generatedImages.find(img => img.storyboardId === storyboard.id);
            const isGenerating = currentGenerating === storyboard.id;
            
            return (
              <div
                key={storyboard.id}
                className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden shadow-sm"
              >
                {/* 图片区域 */}
                <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
                  {generatedImage ? (
                    <>
                      <img
                        src={generatedImage.imageUrl}
                        alt={`场景 ${storyboard.sceneNumber}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 flex space-x-1">
                        <button
                          onClick={() => downloadImage(generatedImage.imageUrl, storyboard.sceneNumber)}
                          className="w-8 h-8 bg-black/70 text-white rounded-full flex items-center justify-center
                                   hover:bg-black/90 transition-colors"
                          title="下载图片"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => regenerateImage(storyboard)}
                          disabled={isGenerating}
                          className="w-8 h-8 bg-black/70 text-white rounded-full flex items-center justify-center
                                   hover:bg-black/90 transition-colors disabled:opacity-50"
                          title="重新生成"
                        >
                          <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </>
                  ) : isGenerating ? (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-gray-600">生成中...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-2 text-gray-400">
                      <Palette className="w-8 h-8" />
                      <span className="text-sm">等待生成</span>
                      <button
                        onClick={() => regenerateImage(storyboard)}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        单独生成
                      </button>
                    </div>
                  )}
                </div>

                {/* 信息区域 */}
                <div className="p-4">
                  <div className="flex items-center mb-2">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {storyboard.sceneNumber}
                    </div>
                    <h3 className="ml-2 font-semibold text-gray-800">
                      场景 {storyboard.sceneNumber}
                    </h3>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {storyboard.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {storyboard.setting}
                    </span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      {storyboard.mood}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 完成状态 */}
      {generatedImages.length === storyboards.length && generatedImages.length > 0 && !currentGenerating && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-2 px-6 py-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center">
              ✓
            </div>
            <span className="font-medium text-green-800">
              所有场景图片生成完成！({generatedImages.length} 张)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
