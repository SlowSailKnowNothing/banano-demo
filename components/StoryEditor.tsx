/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BookOpen, ArrowRight } from 'lucide-react';
import { useState, useCallback } from 'react';
import { StoryEditorProps } from '../types';

export default function StoryEditor({ 
  story, 
  onStoryChange, 
  onNext, 
  isLoading = false 
}: StoryEditorProps) {
  const [wordCount, setWordCount] = useState(story.length);

  // 处理故事文本变化
  const handleStoryChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newStory = e.target.value;
    onStoryChange(newStory);
    setWordCount(newStory.length);
  }, [onStoryChange]);

  // 处理提交
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (story.trim().length < 50) {
      alert('故事内容太短，请至少写50个字符');
      return;
    }
    onNext();
  }, [story, onNext]);

  const minLength = 50;
  const recommendedLength = 300;
  const maxLength = 2000;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
          <BookOpen className="w-6 h-6 mr-2" />
          编写你的故事
        </h2>
        <p className="text-gray-600 text-sm">
          描述你的主角的冒险故事，AI 将根据你的故事创建精彩的分镜画面
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative">
          <textarea
            value={story}
            onChange={handleStoryChange}
            placeholder="从前，在一个遥远的地方，我们的主角开始了一段奇妙的旅程..."
            className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg resize-none
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                     transition-all text-gray-800 leading-relaxed
                     placeholder-gray-400"
            maxLength={maxLength}
            disabled={isLoading}
          />
          
          {/* 字数统计 */}
          <div className="absolute bottom-3 right-3 text-xs text-gray-500 bg-white px-2 py-1 rounded">
            {wordCount} / {maxLength}
          </div>
        </div>

        {/* 进度指示器 */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>最少 {minLength} 字符</span>
            <span>建议 {recommendedLength} 字符</span>
            <span>最多 {maxLength} 字符</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                wordCount < minLength 
                  ? 'bg-red-400' 
                  : wordCount < recommendedLength 
                    ? 'bg-yellow-400' 
                    : 'bg-green-400'
              }`}
              style={{ 
                width: `${Math.min((wordCount / maxLength) * 100, 100)}%` 
              }}
            />
          </div>
        </div>

        {/* 写作提示 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2">写作提示：</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 描述主角的外貌特征和性格</li>
            <li>• 设定故事的时间和地点</li>
            <li>• 包含一些动作和情感元素</li>
            <li>• 描述不同的场景和环境变化</li>
            <li>• 添加一些冲突或转折点</li>
          </ul>
        </div>

        {/* 示例故事 */}
        {story.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-2">示例故事：</h3>
            <p className="text-sm text-gray-600 italic leading-relaxed">
              "小狐狸艾莉有着火红的毛发和明亮的绿眼睛。一个阳光明媚的早晨，她踏出森林小屋，
              决定去寻找传说中的魔法水晶。穿过茂密的森林，她遇到了一只受伤的小鸟。
              艾莉温柔地照顾小鸟，用自己的围巾为它包扎伤口。突然，天空乌云密布，
              一场暴风雨即将来临。艾莉抱着小鸟，在雨中寻找避雨的地方..."
            </p>
          </div>
        )}

        {/* 提交按钮 */}
        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isLoading || story.trim().length < minLength}
            className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white 
                     rounded-lg font-medium transition-all
                     hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>生成分镜中...</span>
              </>
            ) : (
              <>
                <span>生成故事分镜</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* 状态消息 */}
        {story.trim().length > 0 && story.trim().length < minLength && (
          <p className="text-center text-sm text-red-600">
            还需要至少 {minLength - story.trim().length} 个字符
          </p>
        )}
      </form>
    </div>
  );
}
