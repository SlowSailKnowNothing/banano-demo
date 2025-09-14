/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Palette, Download, RefreshCw } from 'lucide-react';
import { useState, useCallback } from 'react';
import { ImageGeneratorProps, GeneratedImage, Storyboard } from '../types';
import { generateImage, getBase64FromImageUrl } from '../utils/openrouter';

export default function ImageGenerator({ 
  storyboards, 
  characterImage, 
  characterPrompt,
  story,
  onReferenceReady,
  onImagesGenerated, 
  isLoading = false,
  apiKey,
}: ImageGeneratorProps) {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentGenerating, setCurrentGenerating] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [referenceReady, setReferenceReady] = useState<boolean>(!!characterImage);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const withTimeout = async <T,>(p: Promise<T>, ms: number): Promise<T> => {
    let timer: any;
    try {
      return await Promise.race([
        p,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error('请求超时，请稍后重试')), ms);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  // 如果没有参考图，先生成“主角立绘”作为统一参考
  const ensureReferenceImage = useCallback(async (): Promise<string | null> => {
    if (!apiKey) {
      setError('请先设置 API Key');
      return null;
    }
    if (referenceReady && characterImage) return characterImage;
    const identity = characterPrompt?.trim() || story.slice(0, 300);
    if (!identity) return null;

    const preface = `Create a clean, front-facing portrait or full-body illustration of the main character for a children's storybook. White or simple background. Rich colors.`;
    const prompt = `${preface}\n\nMain character identity: ${identity}`;
    
    try {
      const imageUrl = await generateImage(apiKey, prompt, undefined, 'google/gemini-2.5-flash-image-preview');
      setReferenceReady(true);
      onReferenceReady?.(imageUrl);
      return imageUrl;
    } catch (error) {
      console.error('Failed to generate reference image:', error);
      return null;
    }
  }, [characterImage, characterPrompt, story, onReferenceReady, referenceReady, apiKey]);

  // 生成单个场景图片（带一次内部语义重试，非指数退避）
  const generateSingleImage = useCallback(async (storyboard: Storyboard): Promise<GeneratedImage> => {
    if (!apiKey) {
      throw new Error('未设置 API Key');
    }
    const prompt = `
基于提供的角色图片，生成一个新的场景图片。请尽量保持角色的外观特征尤其是绘图风格一致，如无法确定也需输出插画。

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
      // 如果没有参考图，但有故事文本，则尝试从故事中抽取主角身份
      let inferredIdentity = '';
      if (!characterImage && !characterPrompt && story) {
        // 简单启发：取故事的前 300 字作为身份线索
        inferredIdentity = story.slice(0, 300);
      }

      let referenceImageBase64: string | undefined;
      let finalPrompt = prompt;

      if (characterImage) {
        const { base64 } = await getBase64FromImageUrl(characterImage);
        referenceImageBase64 = base64;
      } else {
        // 无参考图：若有主角文字描述，或从故事推断主角身份
        const identityHint = (characterPrompt?.trim() || inferredIdentity)
          ? `Use this as the main character identity: ${characterPrompt?.trim() || inferredIdentity}. Keep the identity consistent across all scenes.`
          : 'If a character identity is implied, keep it consistent across scenes.';
        finalPrompt = `${prompt}\n\n${identityHint}`;
      }

      const imageUrl = await generateImage(
        apiKey, 
        finalPrompt, 
        referenceImageBase64, 
        'google/gemini-2.5-flash-image-preview'
      );
      
      return {
        id: `image-${storyboard.id}-${Date.now()}`,
        storyboardId: storyboard.id,
        imageUrl,
        prompt: finalPrompt,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('生成图片时出错:', error);
      throw error;
    }
  }, [characterImage, characterPrompt, story, apiKey]);

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
          // 为单次请求增加超时（例如 35s）
          return await withTimeout(generateSingleImage(storyboard), 35000);
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
    if (!storyboards.length) return;
    if (!apiKey) {
      setError('请先设置 API Key');
      return;
    }

    setError(null);
    setProgress(0);
    setGeneratedImages([]);
    // 立刻进入加载态（包含前置参考图阶段）
    setCurrentGenerating('preparing');

    const newGeneratedImages: GeneratedImage[] = [];
    const failedStoryboards: Storyboard[] = [];
    
    try {
      // 前置：若没有参考图，先生成统一主角立绘
      let referenceUrl = characterImage;
      if (!referenceUrl) {
        try {
          referenceUrl = await ensureReferenceImage();
          if (referenceUrl) await sleep(800);
        } catch (e) {
          console.warn('参考图生成失败，将直接按场景生成：', e);
        }
      }

      for (let i = 0; i < storyboards.length; i++) {
        const storyboard = storyboards[i];
        setCurrentGenerating(storyboard.id);
        
        try {
          const generatedImage = await generateSingleImageWithRetry(storyboard, 3, 800);
          newGeneratedImages.push(generatedImage);
          setGeneratedImages([...newGeneratedImages]);
          setProgress(((i + 1) / storyboards.length) * 100);
          // 成功则从失败集合移除
          if (failedIds.has(storyboard.id)) {
            const next = new Set(failedIds);
            next.delete(storyboard.id);
            setFailedIds(next);
          }
          
          // 每张成功后延迟 1s，进一步降低速率限制概率
          if (i < storyboards.length - 1) {
            await sleep(1000);
          }
        } catch (error) {
          console.error(`生成场景 ${storyboard.sceneNumber} 的图片时出错:`, error);
          // 继续生成其他图片，但记录错误
          setError(`场景 ${storyboard.sceneNumber} 生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
          failedStoryboards.push(storyboard);
          const next = new Set(failedIds);
          next.add(storyboard.id);
          setFailedIds(next);
        }
      }
      // 二次机会：对失败的场景再统一重试一次
      if (failedStoryboards.length > 0) {
        setCurrentGenerating('retry');
        for (let j = 0; j < failedStoryboards.length; j++) {
          const sb = failedStoryboards[j];
          try {
            const generatedImage = await generateSingleImageWithRetry(sb, 2, 1200);
            newGeneratedImages.push(generatedImage);
            setGeneratedImages([...newGeneratedImages]);
            // 重试成功也从失败集合移除
            if (failedIds.has(sb.id)) {
              const next = new Set(failedIds);
              next.delete(sb.id);
              setFailedIds(next);
            }
          } catch (e) {
            console.warn(`重试场景 ${sb.sceneNumber} 仍失败:`, e);
            const next = new Set(failedIds);
            next.add(sb.id);
            setFailedIds(next);
          }
          if (j < failedStoryboards.length - 1) {
            await sleep(800);
          }
        }
      }
      
      setCurrentGenerating(null);
      onImagesGenerated(newGeneratedImages);
      const totalSucceeded = newGeneratedImages.length;
      if (totalSucceeded < storyboards.length) {
        const remain = storyboards.length - totalSucceeded;
        setError(`有 ${remain} 个场景在重试后仍失败，可点击卡片上的“重试生成”。`);
      } else {
        setError(null);
      }
      // 完成回调（视频功能已回退，不再触发 onFinish）
      
    } catch (error) {
      console.error('批量生成图片时出错:', error);
      setError(error instanceof Error ? error.message : '批量生成时发生未知错误');
      setCurrentGenerating(null);
    }
  }, [storyboards, characterImage, generateSingleImage, onImagesGenerated, apiKey]);

  // 重新生成单个图片
  const regenerateImage = useCallback(async (storyboard: Storyboard) => {
    if (!apiKey) {
      setError('请先设置 API Key');
      return;
    }
    setCurrentGenerating(storyboard.id);
    setError(null);
    
    try {
      const newImage = await generateSingleImageWithRetry(storyboard, 3, 800);
      const existingIdx = generatedImages.findIndex(img => img.storyboardId === storyboard.id);
      const updatedImages = [...generatedImages];
      if (existingIdx >= 0) {
        updatedImages[existingIdx] = newImage;
      } else {
        updatedImages.push(newImage);
      }
      setGeneratedImages(updatedImages);
      onImagesGenerated(updatedImages);
      if (failedIds.has(storyboard.id)) {
        const next = new Set(failedIds);
        next.delete(storyboard.id);
        setFailedIds(next);
      }
    } catch (error) {
      console.error('重新生成图片时出错:', error);
      setError(`重新生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
      const next = new Set(failedIds);
      next.add(storyboard.id);
      setFailedIds(next);
    } finally {
      setCurrentGenerating(null);
    }
  }, [generatedImages, generateSingleImageWithRetry, onImagesGenerated, failedIds, apiKey]);

  // 批量重试所有失败的场景
  const retryAllFailed = useCallback(async () => {
    if (failedIds.size === 0) return;
    if (!apiKey) {
      setError('请先设置 API Key');
      return;
    }
    setCurrentGenerating('retry');
    setError(null);

    const targets = storyboards.filter(sb => failedIds.has(sb.id));
    const updatedImages = [...generatedImages];
    const nextFailed = new Set(failedIds);

    for (let i = 0; i < targets.length; i++) {
      const sb = targets[i];
      try {
        const newImage = await generateSingleImageWithRetry(sb, 2, 1200);
        const existingIdx = updatedImages.findIndex(img => img.storyboardId === sb.id);
        if (existingIdx >= 0) {
          updatedImages[existingIdx] = newImage;
        } else {
          updatedImages.push(newImage);
        }
        if (nextFailed.has(sb.id)) nextFailed.delete(sb.id);
        setGeneratedImages([...updatedImages]);
        onImagesGenerated([...updatedImages]);
      } catch (e) {
        console.warn(`批量重试场景 ${sb.sceneNumber} 失败:`, e);
        nextFailed.add(sb.id);
      }
      if (i < targets.length - 1) {
        await sleep(800);
      }
    }

    setFailedIds(nextFailed);
    setCurrentGenerating(null);
  }, [failedIds, storyboards, generatedImages, generateSingleImageWithRetry, onImagesGenerated, apiKey]);

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
            disabled={isLoading || storyboards.length === 0 || !apiKey}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium
                     hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
          >
            {!apiKey ? '请先设置 API Key' : '开始生成所有场景图片'}
          </button>
          <p className="text-sm text-gray-500 mt-2">
            将为 {storyboards.length} 个场景生成图片，预计需要 {storyboards.length * 2} 分钟
          </p>
        </div>
      )}

      {/* 失败后的一键重试按钮 */}
      {failedIds.size > 0 && !currentGenerating && (
        <div className="mb-6 text-center">
          <button
            onClick={retryAllFailed}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            重试全部失败场景（{failedIds.size}）
          </button>
        </div>
      )}

      {/* 生成进度 */}
      {currentGenerating && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="font-medium text-blue-800">
              {currentGenerating === 'preparing' ? '正在准备参考图...' : `正在生成场景图片... (${Math.round(progress)}%)`}
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
                      {/* 保留图片操作按钮，不包含视频 */}
                    </>
                  ) : isGenerating ? (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-gray-600">生成中...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-2 text-gray-400 p-4">
                      <Palette className="w-8 h-8" />
                      {failedIds.has(storyboard.id) ? (
                        <>
                          <span className="text-sm text-red-600">生成失败</span>
                          <button
                            onClick={() => regenerateImage(storyboard)}
                            className="text-xs text-blue-600 hover:text-blue-700 underline"
                          >
                            重试生成
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm">等待生成</span>
                          <button
                            onClick={() => regenerateImage(storyboard)}
                            className="text-xs text-blue-600 hover:text-blue-700 underline"
                          >
                            {apiKey ? '单独生成' : '请先设置 API Key'}
                          </button>
                        </>
                      )}
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
            <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center">✓</div>
            <span className="font-medium text-green-800">所有场景图片生成完成！({generatedImages.length} 张)</span>
          </div>
        </div>
      )}
    </div>
  );
}
