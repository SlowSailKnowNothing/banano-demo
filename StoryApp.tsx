/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, BookOpen, Camera, Film, Palette } from 'lucide-react';
import ImageUpload from './components/ImageUpload';
import StoryEditor from './components/StoryEditor';
import StoryboardGenerator from './components/StoryboardGenerator';
import ImageGenerator from './components/ImageGenerator';
import { AppState, Storyboard, GeneratedImage } from './types';

export default function StoryApp() {
  const [appState, setAppState] = useState<AppState>({
    currentStep: 'upload',
    characterImage: null,
    story: '',
    storyboards: [],
    generatedImages: [],
    isLoading: false,
    error: null,
    apiKey: null,
  });
  const [characterTextPrompt, setCharacterTextPrompt] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>(() => {
    try { return localStorage.getItem('globalCustomPrompt') || ''; } catch { return ''; }
  });

  // Vite 通过 define 注入了 process.env.OPENROUTER_API_KEY，这里声明以避免 TS 报错
  declare const process: any;

  // 初始化加载 API Key：优先使用用户在本地保存的 Key；否则回退到环境变量
  useEffect(() => {
    const storedKey = (() => {
      try {
        return localStorage.getItem('userApiKey');
      } catch {
        return null;
      }
    })();
    const envKey = process?.env?.OPENROUTER_API_KEY || null;
    const key = storedKey || envKey || null;
    if (key && appState.apiKey !== key) {
      setAppState(prev => ({ ...prev, apiKey: key }));
    }
  }, []);

  // 提供设置 API Key 的方法（将来供 UI 调用）
  const setUserApiKey = useCallback((key: string | null) => {
    try {
      if (key) {
        localStorage.setItem('userApiKey', key);
      } else {
        localStorage.removeItem('userApiKey');
      }
    } catch {}
    setAppState(prev => ({ ...prev, apiKey: key }));
  }, []);

  // 处理图片上传
  const handleImageUpload = useCallback((file: File | null, url: string | null) => {
    setAppState(prev => ({
      ...prev,
      characterImage: url,
      error: null,
    }));
  }, []);

  // 从图片上传进入故事编写
  const handleImageNext = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      currentStep: 'story',
      error: null,
    }));
  }, [appState.characterImage]);

  // 跳过主角设置，直接进入讲故事
  const handleSkipCharacter = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      currentStep: 'story',
      error: null,
    }));
  }, []);

  // 处理故事变化
  const handleStoryChange = useCallback((story: string) => {
    setAppState(prev => ({
      ...prev,
      story,
      error: null,
    }));
  }, []);

  // 进入分镜生成步骤
  const handleStoryNext = useCallback(() => {
    if (appState.story.trim().length < 50) {
      setAppState(prev => ({
        ...prev,
        error: '故事内容太短，请至少写50个字符',
      }));
      return;
    }

    setAppState(prev => ({
      ...prev,
      currentStep: 'storyboard',
      error: null,
    }));
  }, [appState.characterImage, appState.story]);

  // 处理分镜生成完成
  const handleStoryboardsGenerated = useCallback((storyboards: Storyboard[]) => {
    setAppState(prev => ({
      ...prev,
      storyboards,
      currentStep: 'generation',
      error: null,
    }));
  }, []);

  // 处理图片生成完成
  const handleImagesGenerated = useCallback((images: GeneratedImage[]) => {
    setAppState(prev => ({
      ...prev,
      generatedImages: images,
      currentStep: 'result',
      error: null,
    }));
  }, []);

  // 返回上一步
  const handleGoBack = useCallback(() => {
    const stepOrder: AppState['currentStep'][] = ['upload', 'story', 'storyboard', 'generation', 'result'];
    const currentIndex = stepOrder.indexOf(appState.currentStep);
    if (currentIndex > 0) {
      setAppState(prev => ({
        ...prev,
        currentStep: stepOrder[currentIndex - 1],
        error: null,
      }));
    }
  }, [appState.currentStep]);

  // 重新开始
  const handleRestart = useCallback(() => {
    // 清理 URL 对象
    if (appState.characterImage) {
      URL.revokeObjectURL(appState.characterImage);
    }
    appState.generatedImages.forEach(img => {
      if (img.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(img.imageUrl);
      }
    });

    setAppState(prev => ({
      currentStep: 'upload',
      characterImage: null,
      story: '',
      storyboards: [],
      generatedImages: [],
      isLoading: false,
      error: null,
      // 重置流程中保留当前已生效的 API Key（本地或环境）
      apiKey: prev.apiKey,
    }));
  }, [appState]);

  // 步骤指示器数据
  const steps = [
    { id: 'upload', label: '上传角色', icon: Camera },
    { id: 'story', label: '编写故事', icon: BookOpen },
    { id: 'storyboard', label: '生成分镜', icon: Film },
    { id: 'generation', label: '生成图片', icon: Palette },
    { id: 'result', label: '完成', icon: BookOpen },
  ] as const;

  const currentStepIndex = steps.findIndex(step => step.id === appState.currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 头部导航 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              {appState.currentStep !== 'upload' && (
                <button
                  onClick={handleGoBack}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm font-medium">返回</span>
                </button>
              )}
              <h1 className="text-xl font-bold text-gray-900">
                AI 故事分镜生成器
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  const input = window.prompt('请输入你的 OpenRouter API Key（以便在本地使用）');
                  if (input && input.trim()) {
                    setUserApiKey(input.trim());
                  }
                }}
                className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                title={appState.apiKey ? '已设置 API Key，点击可更改' : '点击设置你的 API Key'}
              >
                {appState.apiKey ? '更改 API Key' : '设置 API Key'}
              </button>
              <button
                onClick={handleRestart}
                className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                重新开始
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 步骤指示器 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-center space-x-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === appState.currentStep;
              const isCompleted = index < currentStepIndex;
              
              return (
                <div
                  key={step.id}
                  className={`flex items-center space-x-2 ${
                    isActive ? 'text-blue-600' : 
                    isCompleted ? 'text-green-600' : 
                    'text-gray-400'
                  }`}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    ${isActive ? 'bg-blue-100 border-2 border-blue-600' : 
                      isCompleted ? 'bg-green-100 border-2 border-green-600' : 
                      'bg-gray-100 border-2 border-gray-300'}
                  `}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium hidden sm:block">
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {appState.error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">错误</p>
            <p className="text-red-600 text-sm mt-1">{appState.error}</p>
          </div>
        </div>
      )}

      {/* 主要内容区域 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 首次提醒设置 API Key：当没有用户 Key 且没有环境 Key 时显示 */}
        {!appState.apiKey && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 font-medium">需要设置 API Key</p>
            <p className="text-yellow-700 text-sm mt-1">为了使用生成能力，请设置你的 OpenRouter API Key。不会上传到服务器，仅保存在浏览器本地。</p>
            <div className="mt-3 flex items-center space-x-3">
              <button
                onClick={() => {
                  const input = window.prompt('请输入你的 OpenRouter API Key');
                  if (input && input.trim()) setUserApiKey(input.trim());
                }}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
              >
                现在设置
              </button>
              <button
                onClick={() => {
                  // 若存在环境变量，则使用环境变量；否则提示必须设置
                  const envKey = (process && process.env && process.env.OPENROUTER_API_KEY) || null;
                  if (envKey) {
                    setUserApiKey(envKey);
                  } else {
                    alert('未检测到环境变量 OPENROUTER_API_KEY，请输入你的 API Key');
                  }
                }}
                className="px-4 py-2 border border-yellow-600 text-yellow-800 rounded hover:bg-yellow-100 text-sm"
              >
                使用环境变量
              </button>
            </div>
          </div>
        )}
        {appState.currentStep === 'upload' && (
          <ImageUpload
            onImageUpload={handleImageUpload}
            currentImage={appState.characterImage}
            isLoading={appState.isLoading}
            onNext={handleImageNext}
            onSkip={handleSkipCharacter}
            onCharacterPromptSubmit={setCharacterTextPrompt}
            initialCharacterPrompt={characterTextPrompt}
            onGlobalPromptChange={(p) => {
              setCustomPrompt(p);
              try { localStorage.setItem('globalCustomPrompt', p); } catch {}
            }}
            initialGlobalPrompt={customPrompt}
          />
        )}

        {appState.currentStep === 'story' && (
          <StoryEditor
            story={appState.story}
            onStoryChange={handleStoryChange}
            onNext={handleStoryNext}
            isLoading={appState.isLoading}
          />
        )}

        {appState.currentStep === 'storyboard' && (
          <StoryboardGenerator
            story={appState.story}
            characterImage={appState.characterImage}
            onStoryboardsGenerated={handleStoryboardsGenerated}
            isLoading={appState.isLoading}
            apiKey={appState.apiKey || undefined}
            customPrompt={customPrompt}
          />
        )}

        {appState.currentStep === 'generation' && (
          <ImageGenerator
            storyboards={appState.storyboards}
            characterImage={appState.characterImage}
            characterPrompt={characterTextPrompt}
            story={appState.story}
            onReferenceReady={(url) => setAppState(prev => ({ ...prev, characterImage: url }))}
            onImagesGenerated={handleImagesGenerated}
            isLoading={appState.isLoading}
            apiKey={appState.apiKey || undefined}
            customPrompt={customPrompt}
          />
        )}

        {appState.currentStep === 'result' && (
          <div className="text-center space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                🎉 故事分镜生成完成！
              </h2>
              <p className="text-gray-600 text-lg">
                你的故事已经被转换为 {appState.generatedImages.length} 个精美的场景图片
              </p>
            </div>

            {/* 显示所有生成的图片 */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {appState.storyboards.map((storyboard) => {
                const generatedImage = appState.generatedImages.find(
                  img => img.storyboardId === storyboard.id
                );
                
                return (
                  <div
                    key={storyboard.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden"
                  >
                    <div className="aspect-video bg-gray-100">
                      {generatedImage ? (
                        <img
                          src={generatedImage.imageUrl}
                          alt={`场景 ${storyboard.sceneNumber}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span>图片生成失败</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-800 mb-2">
                        场景 {storyboard.sceneNumber}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {storyboard.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center space-x-4">
              <button
                onClick={handleRestart}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium
                         hover:bg-blue-700 transition-colors"
              >
                创建新故事
              </button>
              <button
                onClick={() => setAppState(prev => ({ ...prev, currentStep: 'generation' }))}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium
                         hover:bg-gray-50 transition-colors"
              >
                返回编辑
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>由 OpenRouter AI 驱动的故事分镜生成器</p>
            <p className="mt-1">上传角色图片 → 编写故事 → 生成分镜 → 创建图片</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
