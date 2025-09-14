/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Film, CheckCircle } from 'lucide-react';
import { useState, useCallback } from 'react';
import { StoryboardGeneratorProps, Storyboard } from '../types';
import { generateText } from '../utils/openrouter';

export default function StoryboardGenerator({ 
  story, 
  characterImage, 
  onStoryboardsGenerated, 
  isLoading = false,
  apiKey,
  customPrompt,
}: StoryboardGeneratorProps) {
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [currentStep, setCurrentStep] = useState<'ready' | 'generating' | 'completed'>('ready');
  const [error, setError] = useState<string | null>(null);

  // 允许用户直接修改分镜的四个关键字段（描述/动作/环境/氛围），以此作为后续生成提示的来源

  // 生成分镜
  const generateStoryboards = useCallback(async () => {
    if (!story.trim()) return;
    if (!apiKey) {
      setError('请先设置 API Key');
      return;
    }

    setCurrentStep('generating');
    setError(null);

    try {
      const prompt = `
请基于以下故事内容，生成4-8个分镜场景。每个分镜都应该包含：
1. 场景描述 (description)
2. 主角的动作 (characterAction) 
3. 环境设定 (setting)
4. 情感氛围 (mood)

(如果提供了全局自定义提示，请遵循这些偏好：${customPrompt || '无'})

故事内容：
${story}

请以JSON格式返回，格式如下：
{
  "storyboards": [
    {
      "sceneNumber": 1,
      "description": "详细的场景描述",
      "characterAction": "主角在此场景中的具体动作",
      "setting": "环境和背景设定",
      "mood": "情感氛围（如：开心、紧张、神秘等）"
    }
  ]
}

注意：
- 保持主角的一致性
- 确保场景之间有逻辑连贯性
- 描述要具体且富有画面感
- 每个分镜都应该能独立成为一幅画面
`;

      const text = await generateText(apiKey, prompt, 'google/gemini-2.5-flash');

      // 解析 JSON 响应
      let parsedResponse;
      try {
        // 尝试提取 JSON 部分
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法找到有效的JSON响应');
        }
      } catch (parseError) {
        console.error('JSON解析错误:', parseError);
        throw new Error('AI响应格式错误，请重试');
      }

      if (!parsedResponse.storyboards || !Array.isArray(parsedResponse.storyboards)) {
        throw new Error('AI响应格式不正确');
      }

      // 转换为应用的分镜格式（用户后续可直接编辑字段）
      const generatedStoryboards: Storyboard[] = parsedResponse.storyboards.map((sb: any, index: number) => ({
        id: `storyboard-${index + 1}-${Date.now()}`,
        sceneNumber: sb.sceneNumber || index + 1,
        description: sb.description || '',
        characterAction: sb.characterAction || '',
        setting: sb.setting || '',
        mood: sb.mood || '',
      }));

      setStoryboards(generatedStoryboards);
      setCurrentStep('completed');
      
    } catch (error) {
      console.error('生成分镜时出错:', error);
      setError(error instanceof Error ? error.message : '生成分镜时发生未知错误');
      setCurrentStep('ready');
    }
  }, [story, onStoryboardsGenerated, apiKey]);

  // 重新生成分镜
  const handleRegenerate = useCallback(() => {
    setStoryboards([]);
    setCurrentStep('ready');
    generateStoryboards();
  }, [generateStoryboards]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
          <Film className="w-6 h-6 mr-2" />
          故事分镜生成
        </h2>
        <p className="text-gray-600 text-sm">
          AI 正在分析你的故事，并生成适合的分镜场景
        </p>
      </div>

      {/* 错误显示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">生成分镜时出错</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={handleRegenerate}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm
                     hover:bg-red-700 transition-colors"
          >
            重新生成
          </button>
        </div>
      )}

      {/* 生成按钮 */}
      {currentStep === 'ready' && (
        <div className="text-center mb-6">
          <button
            onClick={generateStoryboards}
            disabled={isLoading || !apiKey}
            className="px-8 py-3 bg-purple-600 text-white rounded-lg font-medium
                     hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                     disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? '生成中...' : (!apiKey ? '请先设置 API Key' : '开始生成分镜')}
          </button>
        </div>
      )}

      {/* 生成进度 */}
      {currentStep === 'generating' && (
        <div className="text-center mb-6">
          <div className="inline-flex items-center space-x-3 px-6 py-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <div>
              <p className="font-medium text-blue-800">正在生成分镜...</p>
              <p className="text-sm text-blue-600">AI 正在分析故事结构和关键场景</p>
            </div>
          </div>
        </div>
      )}

      {/* 分镜展示 */}
      {storyboards.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              生成的分镜 ({storyboards.length} 个场景)
            </h3>
            {currentStep === 'completed' && (
              <button
                onClick={handleRegenerate}
                className="px-4 py-2 text-purple-600 border border-purple-600 rounded-lg
                         hover:bg-purple-50 transition-colors text-sm"
              >
                重新生成
              </button>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {storyboards.map((storyboard, index) => (
              <div
                key={storyboard.id}
                className="bg-white border-2 border-gray-200 rounded-lg p-6 shadow-sm
                         hover:border-purple-300 transition-colors"
              >
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {storyboard.sceneNumber}
                  </div>
                  <h4 className="ml-3 text-lg font-semibold text-gray-800">
                    场景 {storyboard.sceneNumber}
                  </h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      场景描述（可编辑）
                    </label>
                    <textarea
                      value={storyboard.description}
                      onChange={(e) => {
                        const next = [...storyboards];
                        next[index] = { ...storyboard, description: e.target.value };
                        setStoryboards(next);
                      }}
                      className="w-full p-3 border rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      主角动作（可编辑）
                    </label>
                    <input
                      value={storyboard.characterAction}
                      onChange={(e) => {
                        const next = [...storyboards];
                        next[index] = { ...storyboard, characterAction: e.target.value };
                        setStoryboards(next);
                      }}
                      className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        环境设定（可编辑）
                      </label>
                      <input
                        value={storyboard.setting}
                        onChange={(e) => {
                          const next = [...storyboards];
                          next[index] = { ...storyboard, setting: e.target.value };
                          setStoryboards(next);
                        }}
                        className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        情感氛围（可编辑）
                      </label>
                      <input
                        value={storyboard.mood}
                        onChange={(e) => {
                          const next = [...storyboards];
                          next[index] = { ...storyboard, mood: e.target.value };
                          setStoryboards(next);
                        }}
                        className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {currentStep === 'completed' && (
            <div className="text-center mt-8">
              <p className="text-green-600 font-medium mb-4">
                ✓ 分镜生成完成！准备生成图片
              </p>
              <button
                className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium
                         hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2
                         transition-all"
                onClick={() => onStoryboardsGenerated(storyboards)}
              >
                保存修改并开始生成图片
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
