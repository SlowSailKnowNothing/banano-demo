/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Upload, Image as ImageIcon, X, ArrowRight, Wand2 } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { ImageUploadProps } from '../types';

export default function ImageUpload({ 
  onImageUpload, 
  currentImage, 
  isLoading = false,
  onNext,
  onSkip,
  onCharacterPromptSubmit,
  initialCharacterPrompt,
  onGlobalPromptChange,
  initialGlobalPrompt
}: ImageUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [characterPrompt, setCharacterPrompt] = useState(initialCharacterPrompt || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalPrompt, setGlobalPrompt] = useState(initialGlobalPrompt || '');

  // 处理文件选择
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请选择一个图片文件');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('图片文件不能超过 10MB');
      return;
    }

    const url = URL.createObjectURL(file);
    onImageUpload(file, url);
  }, [onImageUpload]);

  // 处理拖拽事件
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // 处理点击上传
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 处理文件输入变化
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // 清除当前图片
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentImage) {
      URL.revokeObjectURL(currentImage);
    }
    onImageUpload(null as any, null as any);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [currentImage, onImageUpload]);

  // 文本生成主角（占位：仅设置提示并进入下一步，后续由生成阶段使用）
  const handleGenerateCharacter = useCallback(async () => {
    if (!characterPrompt.trim()) return;
    setIsGenerating(true);
    try {
      // 这里先不直接生成图片，仅记录“有角色描述”，交由后续图片生成阶段作为参考
      // 用 data-url 伪占位，保持后续逻辑简单；真正生成在生成阶段完成
      onImageUpload(null as any, null as any);
      onCharacterPromptSubmit?.(characterPrompt.trim());
      onNext?.();
    } finally {
      setIsGenerating(false);
    }
  }, [characterPrompt, onImageUpload, onNext]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          上传故事主角图片
        </h2>
        <p className="text-gray-600 text-sm">
          选择一张图片作为你故事的主角，AI 将基于这个角色生成后续的分镜图片
        </p>
      </div>

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200 hover:border-gray-400
          ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!isLoading ? handleClick : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isLoading}
        />

        {currentImage ? (
          <div className="relative">
            <img
              src={currentImage}
              alt="上传的主角图片"
              className="max-w-full max-h-64 mx-auto rounded-lg shadow-md"
            />
            {!isLoading && (
              <button
                onClick={handleClear}
                className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full
                         flex items-center justify-center hover:bg-red-600 transition-colors"
                aria-label="删除图片"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="mt-4 text-sm text-gray-600">
              点击图片或拖拽新图片来替换
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              {isLoading ? (
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>
            
            <div>
              <p className="text-lg font-medium text-gray-700 mb-2">
                {isLoading ? '正在处理图片...' : '拖拽图片到此处或点击选择'}
              </p>
              <p className="text-sm text-gray-500">
                支持 JPG、PNG、GIF 格式，最大 10MB
              </p>
            </div>

            {!isLoading && (
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <ImageIcon className="w-4 h-4" />
                <span className="text-sm font-medium">选择图片文件</span>
              </div>
            )}
          </div>
        )}
      </div>

      {currentImage && !isLoading && (
        <div className="mt-6 text-center space-y-4">
          <p className="text-sm text-green-600 font-medium">
            ✓ 图片已上传，可以继续编写故事
          </p>
          {onNext && (
            <button
              onClick={onNext}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white 
                       rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 
                       focus:ring-offset-2 transition-all"
            >
              <span>开始编写故事</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* 全局自定义 Prompt（可选） */}
      <div className="mt-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            全局自定义 Prompt（可选）
          </label>
          <textarea
            value={globalPrompt}
            onChange={(e) => {
              setGlobalPrompt(e.target.value);
              onGlobalPromptChange?.(e.target.value);
            }}
            placeholder="例如：保持温暖柔和的色调，卡通插画风，统一的光照方向；生成连贯的故事情节，有起承转合；图片构图遵循三分法。"
            className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <p className="text-xs text-gray-500 mt-1">
            该提示将影响分镜生成与图片生成，留空则使用默认提示。
          </p>
        </div>
      </div>

      {/* 或者：用文字描述主角 / 或跳过 */}
      {!currentImage && (
        <div className="mt-6 space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                不上传图片？用文字描述你的主角（可选）
              </label>
              <textarea
                value={characterPrompt}
                onChange={(e) => setCharacterPrompt(e.target.value)}
                placeholder="例如：一只戴着蓝色围巾的小狐狸，绿色眼睛，开朗勇敢"
                className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                disabled={isGenerating}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleGenerateCharacter}
                  disabled={isGenerating || !characterPrompt.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md disabled:opacity-60"
                >
                  <Wand2 className="w-4 h-4" />
                  依据文字去生成主角（稍后生成）
                </button>
                {onSkip && (
                  <button
                    onClick={onSkip}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
                  >
                    先不设置主角，直接讲故事
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                提示：我们会在“生成图片”阶段根据你的文字描述先生成主角的参考图，再继续生成分镜场景。
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
