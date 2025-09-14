/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 应用程序的主要状态类型
export interface AppState {
  currentStep: 'upload' | 'story' | 'storyboard' | 'generation' | 'result';
  characterImage: string | null;
  story: string;
  storyboards: Storyboard[];
  generatedImages: GeneratedImage[];
  isLoading: boolean;
  error: string | null;
  apiKey: string | null;  
}

// 角色图片信息
export interface CharacterImage {
  file: File;
  url: string;
  features: string; // AI 提取的角色特征描述
}

// 分镜信息
export interface Storyboard {
  id: string;
  sceneNumber: number;
  description: string;
  characterAction: string;
  setting: string;
  mood: string;
  customPrompt?: string; // 用户可二次编辑的场景提示词
}

// 生成的图片信息
export interface GeneratedImage {
  id: string;
  storyboardId: string;
  imageUrl: string;
  prompt: string;
  generatedAt: Date;
}

// 图片上传组件的属性
export interface ImageUploadProps {
  onImageUpload: (file: File, url: string) => void;
  currentImage: string | null;
  isLoading?: boolean;
  onNext?: () => void;
  onSkip?: () => void;
  onCharacterPromptSubmit?: (prompt: string) => void;
  initialCharacterPrompt?: string;
}

// 故事编辑器组件的属性
export interface StoryEditorProps {
  story: string;
  onStoryChange: (story: string) => void;
  onNext: () => void;
  isLoading?: boolean;
}

// 分镜生成器组件的属性
export interface StoryboardGeneratorProps {
  story: string;
  characterImage: string | null;
  onStoryboardsGenerated: (storyboards: Storyboard[]) => void;
  isLoading?: boolean;
  apiKey?: string;
}

// 图片生成器组件的属性
export interface ImageGeneratorProps {
  storyboards: Storyboard[];
  characterImage: string | null;
  characterPrompt?: string;
  story: string;
  onReferenceReady?: (url: string) => void;
  onImagesGenerated: (images: GeneratedImage[]) => void;
  isLoading?: boolean;
  apiKey?: string;
}

// Gemini API 相关类型
export interface GeminiStoryboardResponse {
  storyboards: Array<{
    sceneNumber: number;
    description: string;
    characterAction: string;
    setting: string;
    mood: string;
  }>;
}

export interface GeminiImageGenerationPrompt {
  characterFeatures: string;
  sceneDescription: string;
  setting: string;
  mood: string;
  style: string;
}
